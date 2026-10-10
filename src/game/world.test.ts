import assert from "node:assert/strict";
import { test } from "node:test";

import { PLAYER } from "./entities";
import {
  BAY_FIRST,
  BAY_SPACING,
  BAY_W,
  PX_PER_POINT,
  SPEED,
  STAGES,
  baysInView,
  createRng,
  createWorld,
  panelsFor,
  speedFor,
  stageFor,
  startRun,
  stepWorld,
} from "./world";

void test("speed ramps from min to max and holds", () => {
  assert.equal(speedFor(0), SPEED.min);
  assert.ok(speedFor(500) > SPEED.min && speedFor(500) < SPEED.max);
  assert.equal(speedFor(SPEED.rampScore), SPEED.max);
  assert.equal(speedFor(99999), SPEED.max);
});

void test("the stretch of the shift changes every 500 points and loops", () => {
  assert.equal(stageFor(0), "The forecourt");
  assert.equal(stageFor(499), "The forecourt");
  assert.equal(stageFor(500), "Wash bay");
  assert.equal(stageFor(500 * STAGES.length), "The forecourt");
});

void test("seeded rng is deterministic", () => {
  const a = createRng(7);
  const b = createRng(7);
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
});

void test("every gap between grounded obstacles is clearable at the speed it was spawned", () => {
  const w = createWorld(3, 800);
  const fullJump = (2 * PLAYER.jumpV) / PLAYER.gravity;
  // Record every obstacle as it appears, with the speed the spawner saw.
  const seen = new Map<number, { x: number; w: number; lift: number; speed: number }>();
  for (let i = 0; i < 60 * 240; i++) {
    const speed = speedFor(w.score);
    stepWorld(w, 1 / 60, speed, 800);
    for (const o of w.obstacles) {
      if (!seen.has(o.id)) seen.set(o.id, { x: o.x, w: o.def.w, lift: o.def.lift, speed });
    }
  }
  const all = [...seen.values()].sort((a, b) => a.x - b.x);
  assert.ok(all.length > 100, `spawned ${all.length}`);
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1]!;
    const b = all[i]!;
    if (a.lift > 0 || b.lift > 0) continue;
    const gap = b.x - (a.x + a.w);
    // A double is placed one full jump apart; anything else gets a jump plus landing room.
    assert.ok(gap >= b.speed * fullJump * 0.9, `gap ${gap.toFixed(0)} too tight at ${b.speed.toFixed(0)} px/s`);
  }
});

void test("early game only shows tyres, cones and bollards", () => {
  const w = createWorld(11, 800);
  for (let i = 0; i < 60 * 6; i++) stepWorld(w, 1 / 60, speedFor(w.score), 800);
  assert.ok(w.score < 200, `score ${w.score}`);
  for (const o of w.obstacles) {
    assert.ok(["tyres", "tyres2", "cone1", "cone2", "cone3", "bollard"].includes(o.def.kind), o.def.kind);
  }
});

void test("bays sit on a fixed grid", () => {
  assert.deepEqual(baysInView(0, 800), []);
  assert.deepEqual(baysInView(1300, 800), [BAY_FIRST]);
  assert.deepEqual(baysInView(BAY_FIRST + BAY_SPACING - 100, 800), [BAY_FIRST + BAY_SPACING]);
});

void test("the frontage is continuous and never builds over a bay", () => {
  const w = createWorld(5, 900);
  const modules: { x: number; w: number }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 60 * 120; i++) {
    stepWorld(w, 1 / 60, speedFor(w.score), 900);
    for (const m of w.facade) {
      const key = `${m.x}`;
      if (!seen.has(key)) {
        seen.add(key);
        modules.push(m);
      }
    }
  }
  modules.sort((a, b) => a.x - b.x);
  assert.ok(modules.length > 50, `built ${modules.length}`);
  for (let i = 1; i < modules.length; i++) {
    const prev = modules[i - 1]!;
    const next = modules[i]!;
    const end = prev.x + prev.w;
    // Either the next module abuts this one, or the gap is exactly a bay.
    const gap = next.x - end;
    assert.ok(Math.abs(gap) < 1e-6 || Math.abs(gap - BAY_W) < 1e-6, `gap of ${gap} at ${end}`);
    if (gap > 1) assert.equal((end - BAY_FIRST) % BAY_SPACING, 0, `bay out of place at ${end}`);
  }
});

void test("the title screen drift never spawns obstacles or scores", () => {
  const w = createWorld(9, 800);
  for (let i = 0; i < 60 * 20; i++) stepWorld(w, 1 / 60, 70, 800, false);
  assert.equal(w.obstacles.length, 0);
  assert.equal(w.pickups.length, 0);
  assert.equal(w.score, 0);
  assert.ok(w.distance > 1000);
});

void test("a run starts where the scenery is and counts from there", () => {
  const w = createWorld(13, 800);
  for (let i = 0; i < 60 * 5; i++) stepWorld(w, 1 / 60, 70, 800, false);
  const facade = w.facade.map((m) => `${m.kind}@${m.x}`).join();
  const at = w.distance;
  startRun(w, 800);
  assert.equal(w.origin, at);
  assert.equal(w.facade.map((m) => `${m.kind}@${m.x}`).join(), facade, "the frontage carries straight on");
  for (let i = 0; i < 60; i++) stepWorld(w, 1 / 60, SPEED.min, 800);
  // One second at the opening speed, give or take a float step.
  assert.ok(Math.abs(w.score - SPEED.min / PX_PER_POINT) <= 1, `score ${w.score}`);
  assert.ok(w.nextObstacleX > at + 800);
});

void test("ten bottles polish a panel, and a car has eight", () => {
  assert.equal(panelsFor(9), 0);
  assert.equal(panelsFor(10), 1);
  assert.equal(panelsFor(80), 8);
  assert.equal(panelsFor(500), 8);
});
