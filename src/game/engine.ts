/**
 * Bucket Run: the engine. One canvas, no framework. A fixed 60 Hz simulation with
 * interpolated drawing, so it moves smoothly at 30, 60 or 120 frames a second. It caps the
 * canvas resolution, stops painting when nothing moves or nobody can see it, pauses a run
 * that scrolls out of view, and tells its host about phase changes (and the score at most
 * four times a second), never every frame.
 */
import {
  PARTICLE,
  clearParticles,
  createArt,
  createParticles,
  drawBays,
  drawBottle,
  drawFacade,
  drawGround,
  drawHills,
  drawLamps,
  drawLightPools,
  drawObstacle,
  drawParticles,
  drawPlayer,
  drawSky,
  drawTrees,
  emit,
  stepParticles,
  type Fonts,
} from "./draw";
import {
  BOTTLE,
  PLAYER,
  bottleBox,
  createPlayer,
  obstacleBox,
  overlaps,
  playerBox,
  pressJump,
  releaseJump,
  setDuck,
  stepPlayer,
  type PlayerState,
} from "./entities";
import { drawHud, drawOverCard, drawPausedCard, drawTitleCard, type HudFx } from "./hud";
import { attachInput } from "./input";
import { createStorage } from "./storage";
import { FONT_BODY_FALLBACK, FONT_DISPLAY_FALLBACK, VIEW } from "./theme";
import type { CreateGame, GameHandle, GamePhase, GameState } from "./types";
import {
  baysInView,
  createWorld,
  lampsInView,
  panelsFor,
  speedFor,
  startRun,
  stepWorld,
  type WorldState,
} from "./world";

const STEP = 1 / 60;
const MAX_STEPS = 4;
const FREEZE = 0.12;
const RESTART_LOCKOUT = 0.4;
/** How fast the frontage drifts past behind the title. */
const ATTRACT_SPEED = 70;
/** Canvas pixel budget, about 2560 x 1400. A bigger box trades a little sharpness for speed. */
const MAX_PIXELS = 3_600_000;
const NOTIFY_EVERY = 0.25;

export const createGame: CreateGame = (canvas, options = {}) => {
  const maybeCtx = canvas.getContext("2d", { alpha: false });
  if (!maybeCtx) throw new Error("Bucket Run needs a 2D canvas context");
  const ctx: CanvasRenderingContext2D = maybeCtx;
  const reducedMotion =
    options.reducedMotion ??
    (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const attract = !reducedMotion;
  const cards = options.cards ?? true;
  const storage = createStorage(options.storageKey);
  const fonts = resolveFonts(canvas);
  const art = createArt(fonts);

  if (!canvas.hasAttribute("role")) canvas.setAttribute("role", "img");
  if (!canvas.hasAttribute("aria-label")) {
    canvas.setAttribute("aria-label", "Bucket Run, a running game. Space jumps, the down arrow ducks.");
  }

  let touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

  // The box in CSS pixels, the device pixel ratio actually used, and the world in logical units.
  let cssW: number = VIEW.minWidth;
  let cssH: number = VIEW.height;
  let viewW: number = VIEW.minWidth;
  let viewH: number = VIEW.height;
  let groundY = viewH - 72;
  let playerX: number = VIEW.playerX;
  let compact = false;

  const world: WorldState = createWorld(options.seed ?? Math.floor(Math.random() * 2 ** 31), viewW);
  let player: PlayerState = createPlayer();
  let prevPlayerY = 0;
  const particles = createParticles();
  const lamps: number[] = [];
  const bays: number[] = [];

  const state: GameState = {
    phase: "title",
    score: 0,
    best: storage.readBest(),
    newBest: false,
    bottles: 0,
    stage: world.stage,
    plays: storage.readPlays(),
  };

  const fx: HudFx = { scoreFlashAt: -1, bestFlashAt: -1, panelFlashAt: -1, stageAt: -1 };
  let lastHundred = 0;
  let lastPanels = 0;
  let freeze = 0;
  let overAt = 0;
  let elapsed = 0;
  let lastNotify = -1;
  let foamClock = 0;
  let liveParticles = 0;
  /** Something changed that needs painting even though nothing moves. */
  let dirty = true;
  /** On screen, and in a tab that is showing. */
  let visible = true;
  let onScreen = true;

  /* ---------- sizing ---------- */

  function resize() {
    cssW = canvas.clientWidth || VIEW.minWidth;
    cssH = canvas.clientHeight || VIEW.height;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    const budget = Math.sqrt(MAX_PIXELS / (cssW * cssH));
    if (dpr > budget) dpr = Math.max(1, budget);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    // Narrow or portrait boxes (phones) frame the street from the width so the bucket stays
    // legible and the sky fills the box; wide boxes get the long view.
    const narrow = cssW < 600 || cssH > cssW;
    compact = cssW < 520;
    const scale = narrow ? cssW / VIEW.narrowWidth : Math.min(cssW / VIEW.minWidth, cssH / VIEW.height);
    viewW = cssW / scale;
    viewH = cssH / scale;
    groundY = viewH - Math.max(56, viewH * (narrow ? 0.16 : 0.2));
    playerX = narrow ? VIEW.playerXNarrow : VIEW.playerX;
    art.setResolution(pw / viewW);
    // A wider box needs more frontage built ahead.
    stepWorld(world, 0, 0, viewW, false);
    dirty = true;
    draw(1);
  }

  /* ---------- state plumbing ---------- */

  function notify(force = false) {
    if (!options.onState) return;
    if (!force && elapsed - lastNotify < NOTIFY_EVERY) return;
    lastNotify = elapsed;
    options.onState({ ...state });
  }

  function setPhase(phase: GamePhase) {
    if (state.phase === phase) return;
    state.phase = phase;
    dirty = true;
    notify(true);
  }

  function begin() {
    // The run starts where the frontage has drifted to, so nothing jumps.
    startRun(world, viewW);
    player = createPlayer();
    prevPlayerY = 0;
    clearParticles(particles);
    state.score = 0;
    state.bottles = 0;
    state.newBest = false;
    state.stage = world.stage;
    fx.scoreFlashAt = -1;
    fx.bestFlashAt = -1;
    fx.panelFlashAt = -1;
    fx.stageAt = 0;
    lastHundred = 0;
    lastPanels = 0;
    freeze = 0;
    foamClock = 0;
    setPhase("running");
    // A run starts in the air: the press that started it is also the first jump.
    pressJump(player);
    if (!inputHeld) releaseJump(player);
  }

  function die() {
    player.dead = true;
    freeze = FREEZE;
    state.plays += 1;
    storage.writePlays(state.plays);
    if (state.score > state.best) {
      state.best = state.score;
      storage.writeBest(state.best);
    }
    // The bucket tips and the foam goes everywhere.
    const bx = world.distance + playerX + PLAYER.w / 2;
    const by = groundY - player.y - PLAYER.h * 0.8;
    for (let i = 0; i < 16; i++) {
      emit(
        particles,
        PARTICLE.foam,
        bx,
        by,
        40 + Math.random() * 180,
        -120 - Math.random() * 220,
        0.7 + Math.random() * 0.6,
        2 + Math.random() * 3,
      );
    }
    try {
      navigator.vibrate?.(30);
    } catch {
      // Not every browser allows it; nothing to do.
    }
  }

  /* ---------- simulation ---------- */

  function step(dt: number) {
    elapsed += dt;
    if (fx.scoreFlashAt >= 0) fx.scoreFlashAt += dt;
    if (fx.bestFlashAt >= 0) fx.bestFlashAt += dt;
    if (fx.panelFlashAt >= 0) fx.panelFlashAt += dt;
    if (fx.stageAt >= 0) fx.stageAt += dt;
    liveParticles = stepParticles(particles, dt, groundY + 2);

    if (state.phase === "title") {
      if (attract) {
        stepWorld(world, dt, ATTRACT_SPEED, viewW, false);
        stepPlayer(player, dt, ATTRACT_SPEED);
      }
      return;
    }
    if (state.phase === "over") {
      stepPlayer(player, dt, 0);
      return;
    }
    if (state.phase !== "running") return;

    if (freeze > 0) {
      freeze -= dt;
      if (freeze <= 0) {
        overAt = elapsed;
        setPhase("over");
      }
      return;
    }

    const speed = speedFor(world.score);
    prevPlayerY = player.y;
    stepPlayer(player, dt, speed);
    stepWorld(world, dt, speed, viewW);

    // Foam flicks off the bucket as it runs.
    foamClock += dt;
    if (player.onGround && !player.ducking && foamClock > 0.11) {
      foamClock = 0;
      emit(
        particles,
        PARTICLE.foam,
        world.distance + playerX + PLAYER.w * 0.3,
        groundY - PLAYER.h * 0.86,
        -30 - Math.random() * 50,
        -90 - Math.random() * 90,
        0.45,
        1.3 + Math.random() * 1.2,
      );
    }

    // Pickups. The player box lives in world x, like everything it can touch.
    const pb = playerBox(player, world.distance + playerX);
    const before = world.bottles;
    for (const b of world.pickups) {
      if (b.taken || !overlaps(pb, bottleBox(b))) continue;
      b.taken = true;
      world.bottles += 1;
      const cx = b.x + BOTTLE.w / 2;
      const cy = groundY - b.y - BOTTLE.h / 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        emit(particles, PARTICLE.sparkle, cx, cy, Math.cos(a) * 90 + speed * 0.6, Math.sin(a) * 90, 0.38, 3);
      }
    }
    // Score first, so a death on this very step banks the points that were earned.
    state.score = world.score + (world.bottles - before) * BOTTLE.points;
    state.bottles = world.bottles;
    if (world.stage !== state.stage) {
      state.stage = world.stage;
      fx.stageAt = 0;
    }
    for (const o of world.obstacles) {
      if (o.x > world.distance + playerX + 80) break;
      if (overlaps(pb, obstacleBox(o))) {
        die();
        break;
      }
    }
    const hundred = Math.floor(state.score / 100);
    if (hundred > lastHundred && state.score > 0) {
      lastHundred = hundred;
      fx.scoreFlashAt = 0;
    }
    if (!state.newBest && state.best > 0 && state.score > state.best) {
      state.newBest = true;
      fx.bestFlashAt = 0;
      notify(true);
    }
    const panels = panelsFor(world.bottles);
    if (panels > lastPanels) {
      lastPanels = panels;
      fx.panelFlashAt = 0;
    }
    notify();
  }

  /* ---------- drawing ---------- */

  function draw(alpha: number) {
    const k = canvas.width / viewW;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const running = state.phase === "running" && freeze <= 0;
    const moving = running || (state.phase === "title" && attract);
    const d = moving ? world.prevDistance + (world.distance - world.prevDistance) * alpha : world.distance;
    const py = running ? prevPlayerY + (player.y - prevPlayerY) * alpha : player.y;
    const t = elapsed;
    const g = groundY;
    // Under reduced motion the sky and hills hold still; only the street itself moves.
    const far = reducedMotion ? 0 : d;

    drawSky(ctx, art, viewW, g, world.stars, far);
    drawHills(ctx, viewW, g, far, world.hills);
    drawTrees(ctx, viewW, g, far, world.hills[2]);
    drawFacade(ctx, art, world.facade, d, g, viewW);
    const panels = panelsFor(world.bottles);
    drawBays(ctx, art, baysInView(d, viewW, bays), panels, d, g, t);
    drawGround(ctx, viewW, viewH, g, d);
    drawLightPools(ctx, art, bays, lampsInView(d, viewW, lamps), d, g);
    drawLamps(ctx, art, lamps, g, d);
    for (const b of world.pickups) {
      if (b.taken) continue;
      const x = b.x - d;
      if (x > viewW || x + BOTTLE.w < 0) continue;
      drawBottle(ctx, art, b, x, g, t);
    }
    for (const o of world.obstacles) {
      const x = o.x - d;
      if (x > viewW || x + o.def.w < 0) continue;
      drawObstacle(ctx, o, x, g, t);
    }
    drawParticles(ctx, particles, d);
    drawPlayer(ctx, player, playerX, py, g, t);

    // The HUD and cards are laid out in CSS pixels.
    ctx.setTransform(canvas.width / cssW, 0, 0, canvas.height / cssH, 0, 0);
    // A host that draws its own run-over card shows the result there, so the HUD steps aside.
    if (state.phase === "running" || state.phase === "paused" || (cards && state.phase === "over")) {
      drawHud(ctx, cssW, state, fonts, fx, panels, compact);
    }
    if (cards) {
      if (state.phase === "title") drawTitleCard(ctx, cssW, cssH, state, fonts, touch);
      else if (state.phase === "paused") drawPausedCard(ctx, cssW, cssH, fonts, touch);
      else if (state.phase === "over") drawOverCard(ctx, cssW, cssH, state, fonts, touch, elapsed - overAt);
    }
    dirty = false;
  }

  /* ---------- loop ---------- */

  let raf = 0;
  let last = 0;
  let acc = 0;
  let destroyed = false;

  /** Whether anything on screen is moving this frame. */
  function animating() {
    if (state.phase === "running") return true;
    if (state.phase === "title") return attract;
    if (state.phase === "over") return elapsed - overAt < 1 || liveParticles > 0 || (cards && elapsed - overAt < 0.5);
    return false;
  }

  function frame(now: number) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    if (!visible) {
      last = 0;
      return;
    }
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      step(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) acc = 0;
    if (animating() || dirty) draw(acc / STEP);
  }

  /* ---------- input ---------- */

  let inputHeld = false;

  function onPress() {
    inputHeld = true;
    switch (state.phase) {
      case "title":
        begin();
        break;
      case "over":
        if (elapsed - overAt >= RESTART_LOCKOUT) begin();
        break;
      case "paused":
        handle.resume();
        break;
      case "running":
        pressJump(player);
        break;
      default:
        break;
    }
  }
  function onRelease() {
    inputHeld = false;
    if (state.phase === "running") releaseJump(player);
  }
  function onDuck(down: boolean) {
    if (state.phase === "running") setDuck(player, down);
    else if (!down) setDuck(player, false);
  }
  function onPause() {
    if (state.phase === "running") handle.pause();
    else if (state.phase === "paused") handle.resume();
  }
  function isActive() {
    if (state.phase === "running" || state.phase === "paused") return true;
    const r = canvas.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
  }

  const detachInput =
    options.attachInput === false
      ? () => undefined
      : attachInput(
          canvas,
          { press: onPress, release: onRelease, duck: onDuck, pause: onPause, any: () => undefined },
          { isActive },
        );

  const onPointerType = (e: PointerEvent) => {
    const next = e.pointerType !== "mouse";
    if (next !== touch) {
      touch = next;
      dirty = true;
    }
  };
  canvas.addEventListener("pointerdown", onPointerType, { passive: true });

  // Nobody watching: stop painting, and pause a run rather than let it play out unseen.
  function updateVisible() {
    const next = onScreen && !document.hidden;
    if (next === visible) return;
    visible = next;
    if (!visible && state.phase === "running") handle.pause();
    dirty = true;
  }
  const onVisibility = () => updateVisible();
  document.addEventListener("visibilitychange", onVisibility);
  const io =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(
          (entries) => {
            const entry = entries[entries.length - 1];
            if (!entry) return;
            onScreen = entry.isIntersecting;
            updateVisible();
          },
          { threshold: 0.15 },
        )
      : null;
  io?.observe(canvas);

  const onResize = () => resize();
  window.addEventListener("resize", onResize);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
  ro?.observe(canvas);

  // Web fonts arrive after the first frame; once they do, repaint the sign and the HUD in them.
  if (typeof document !== "undefined" && "fonts" in document) {
    void Promise.all([document.fonts.load(`800 21px ${fonts.display}`), document.fonts.load(`600 12px ${fonts.body}`)])
      .then(() => {
        art.invalidate();
        dirty = true;
      })
      .catch(() => undefined);
  }

  /* ---------- handle ---------- */

  const handle: GameHandle = {
    start() {
      if (state.phase === "title" || state.phase === "over") begin();
    },
    pause() {
      if (state.phase !== "running") return;
      setPhase("paused");
    },
    resume() {
      if (state.phase !== "paused") return;
      last = 0;
      acc = 0;
      setPhase("running");
    },
    restart() {
      begin();
    },
    jump() {
      onPress();
      // A programmatic tap has no release, so it counts as a full hold.
      inputHeld = false;
    },
    press() {
      onPress();
    },
    release() {
      onRelease();
    },
    duck(down) {
      onDuck(down);
    },
    resize,
    getState: () => ({ ...state }),
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      detachInput();
      canvas.removeEventListener("pointerdown", onPointerType);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      io?.disconnect();
    },
  };

  resize();
  notify(true);
  raf = requestAnimationFrame(frame);
  return handle;
};

/**
 * Display and body fonts. The site loads its fonts through next/font, which renames the
 * families, so the real names are read from the CSS variables it sets on the root; the
 * offline page and anything else fall back to the named fonts.
 */
function resolveFonts(canvas: HTMLCanvasElement): Fonts {
  let display = canvas.dataset.fontDisplay;
  let body = canvas.dataset.fontBody;
  try {
    const cs = getComputedStyle(canvas);
    display ??= cs.getPropertyValue("--font-archivo").trim() || undefined;
    body ??= cs.getPropertyValue("--font-figtree").trim() || undefined;
  } catch {
    // Detached canvas: fall through to the named fonts.
  }
  return {
    display: display ? `${display}, ${FONT_DISPLAY_FALLBACK}` : FONT_DISPLAY_FALLBACK,
    body: body ? `${body}, ${FONT_BODY_FALLBACK}` : FONT_BODY_FALLBACK,
  };
}

export default createGame;
export type { CreateGame, GameHandle, GameOptions, GameState, GamePhase } from "./types";
