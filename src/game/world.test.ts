import assert from "node:assert/strict";
import { test } from "node:test";

import { PLAYER } from "./entities";
import {
  NEIGHBOURHOODS,
  SPEED,
  createRng,
  createWorld,
  muralsInView,
  neighbourhoodFor,
  speedFor,
  stepWorld,
} from "./world";

void test("speed ramps from min to max and holds", () => {
  assert.equal(speedFor(0), SPEED.min);
  assert.ok(speedFor(500) > SPEED.min && speedFor(500) < SPEED.max);
  assert.equal(speedFor(SPEED.rampScore), SPEED.max);
  assert.equal(speedFor(99999), SPEED.max);
});

void test("neighbourhood changes every 500 points and loops", () => {
  assert.equal(neighbourhoodFor(0), "Shoreditch");
  assert.equal(neighbourhoodFor(499), "Shoreditch");
  assert.equal(neighbourhoodFor(500), "Brooklyn");
  assert.equal(neighbourhoodFor(500 * NEIGHBOURHOODS.length), "Shoreditch");
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

void test("early game only shows bins and cones", () => {
  const w = createWorld(11, 800);
  for (let i = 0; i < 60 * 6; i++) stepWorld(w, 1 / 60, speedFor(w.score), 800);
  assert.ok(w.score < 200, `score ${w.score}`);
  for (const o of w.obstacles) {
    assert.ok(["bin", "bin2", "cone1", "cone2", "cone3", "bollard"].includes(o.def.kind), o.def.kind);
  }
});

void test("murals are placed on a fixed grid", () => {
  assert.deepEqual(muralsInView(0, 800), []);
  const m = muralsInView(1300, 800);
  assert.equal(m.length, 1);
  assert.equal(m[0]!.x, 1400);
});
