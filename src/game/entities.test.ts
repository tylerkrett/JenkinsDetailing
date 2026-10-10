import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BOTTLE,
  OBSTACLES,
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
} from "./entities";

function run(p: ReturnType<typeof createPlayer>, seconds: number, speed = 300) {
  let peak = 0;
  for (let i = 0; i < seconds * 60; i++) {
    stepPlayer(p, 1 / 60, speed);
    peak = Math.max(peak, p.y);
  }
  return peak;
}

void test("a held jump clears about 120 px and lands", () => {
  const p = createPlayer();
  pressJump(p);
  const peak = run(p, 1.2);
  assert.ok(peak > 112 && peak < 126, `peak ${peak}`);
  assert.ok(p.onGround);
});

void test("a tap is a short hop", () => {
  const p = createPlayer();
  pressJump(p);
  run(p, 0.08);
  releaseJump(p);
  const peak = run(p, 1.2);
  assert.ok(peak < 80, `peak ${peak}`);
});

void test("ducking lowers the hitbox on the ground and drops you fast in the air", () => {
  const p = createPlayer();
  assert.equal(playerBox(p, 0).h, PLAYER.h * (1 - 2 * PLAYER.hitInset));
  setDuck(p, true);
  assert.equal(playerBox(p, 0).h, PLAYER.duckH * (1 - 2 * PLAYER.hitInset));
  setDuck(p, false);
  const slow = createPlayer();
  pressJump(slow);
  run(slow, 0.3);
  const fast = createPlayer();
  pressJump(fast);
  run(fast, 0.3);
  setDuck(fast, true);
  run(fast, 0.2);
  run(slow, 0.2);
  assert.ok(fast.y < slow.y);
});

void test("a jump pressed just before landing fires on touchdown", () => {
  const p = createPlayer();
  pressJump(p);
  run(p, 0.6);
  assert.ok(!p.onGround);
  pressJump(p);
  run(p, 0.2);
  assert.ok(!p.onGround, "second jump launched from the buffer");
});

void test("a low kite hits a standing bucket and misses a ducking one", () => {
  const kite = OBSTACLES.find((d) => d.kind === "kiteLow")!;
  const box = obstacleBox({ def: kite, x: 0, id: 1 });
  const standing = createPlayer();
  assert.ok(overlaps(playerBox(standing, 0), box));
  setDuck(standing, true);
  assert.ok(!overlaps(playerBox(standing, 0), box));
});

void test("a high kite clears a standing bucket", () => {
  const kite = OBSTACLES.find((d) => d.kind === "kiteHigh")!;
  const box = obstacleBox({ def: kite, x: 0, id: 1 });
  assert.ok(!overlaps(playerBox(createPlayer(), 0), box));
});

void test("bottles are generous to pick up", () => {
  const b = { x: 100, y: 10, id: 1, taken: false };
  const box = bottleBox(b);
  assert.ok(box.w > BOTTLE.w && box.h > BOTTLE.h);
  assert.ok(overlaps(playerBox(createPlayer(), 100 - PLAYER.w + 6), box), "a near miss still collects");
});
