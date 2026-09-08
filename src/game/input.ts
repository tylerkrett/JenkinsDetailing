/**
 * Keyboard, pointer and touch. The engine decides what a press means (start, jump,
 * restart); this module only turns events into press, release, duck and pause.
 */
export type InputHandlers = {
  press(): void;
  release(): void;
  duck(down: boolean): void;
  pause(): void;
  /** Called for every input, before the specific handler, so the engine can wake or restart. */
  any(): void;
};

export type InputOptions = {
  /** Whether the game should swallow Space and the arrows right now. */
  isActive(): boolean;
  /** A touch press that slides down this fast becomes a duck and cancels the hop. */
  swipeWindowMs?: number;
  swipePx?: number;
};

const JUMP_KEYS = new Set(["Space", "ArrowUp", "KeyW"]);
const DUCK_KEYS = new Set(["ArrowDown", "KeyS"]);
const PAUSE_KEYS = new Set(["KeyP", "Escape"]);

/** Keys aimed at a form field or a focused control keep their native meaning. */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    tag === "BUTTON" ||
    tag === "A" ||
    target.getAttribute("role") === "button" ||
    target.isContentEditable
  );
}

export function attachInput(canvas: HTMLCanvasElement, h: InputHandlers, opts: InputOptions) {
  const swipeWindow = opts.swipeWindowMs ?? 90;
  const swipePx = opts.swipePx ?? 24;
  let jumpDown = false;
  let duckDown = false;
  let pointer: { id: number; y: number; at: number; touch: boolean; ducked: boolean } | null = null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    // Only a visible game takes keys: Space on the footer must scroll, not start a run.
    const active = opts.isActive();
    if (!active) return;
    if (JUMP_KEYS.has(e.code)) {
      e.preventDefault();
      if (e.repeat || jumpDown) return;
      jumpDown = true;
      h.any();
      h.press();
    } else if (DUCK_KEYS.has(e.code)) {
      e.preventDefault();
      if (e.repeat || duckDown) return;
      duckDown = true;
      h.any();
      h.duck(true);
    } else if (PAUSE_KEYS.has(e.code)) {
      if (e.repeat) return;
      h.pause();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (JUMP_KEYS.has(e.code)) {
      jumpDown = false;
      h.release();
    } else if (DUCK_KEYS.has(e.code)) {
      duckDown = false;
      h.duck(false);
    }
  };
  const onBlur = () => {
    if (jumpDown) h.release();
    if (duckDown) h.duck(false);
    jumpDown = false;
    duckDown = false;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    if (pointer) return;
    pointer = { id: e.pointerId, y: e.clientY, at: performance.now(), touch: e.pointerType !== "mouse", ducked: false };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety; the window listeners cover the release either way.
    }
    h.any();
    h.press();
  };
  const onPointerMove = (e: PointerEvent) => {
    if (pointer?.id !== e.pointerId || pointer.ducked) return;
    const dy = e.clientY - pointer.y;
    if (dy < swipePx) return;
    const quick = performance.now() - pointer.at <= swipeWindow;
    pointer.ducked = true;
    // A quick slide down was a duck all along; a later one is a fast fall.
    if (quick) h.release();
    h.duck(true);
    void pointer.touch;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (pointer?.id !== e.pointerId) return;
    const wasDucked = pointer.ducked;
    pointer = null;
    h.release();
    if (wasDucked) h.duck(false);
  };
  const onContextMenu = (e: Event) => e.preventDefault();

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("contextmenu", onContextMenu);
  // Stop the page scrolling or zooming under a thumb on the canvas.
  const prevTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = "none";

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("contextmenu", onContextMenu);
    canvas.style.touchAction = prevTouchAction;
  };
}
