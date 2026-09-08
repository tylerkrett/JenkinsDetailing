"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { type PerspectiveCamera, Vector3 } from "three";

import { SPRING_CAMERA, damp, lerp, springStep } from "~/lib/motion";
import { enter } from "~/lib/scene/enter";
import { bindPointer, parallaxInput } from "~/lib/scene/pointer";
import { activeWorld, useScene } from "~/lib/scene/store";
import type { CameraPose } from "~/lib/scene/world";

const BASE_FOV = 50;
/** Metres the look-at point shifts at full pointer deflection. */
const PARALLAX = 0.35;
/** Spring is considered arrived when every axis is within these of its target. */
const SETTLE_POS = 0.004;
const SETTLE_VEL = 0.02;
/** Hard cap on the dolly so a stalled spring can never leave the site locked. */
const DOLLY_MAX_S = 1.8;
/** Where the camera rests on routes with no scrollable world: the reveal, a little back. */
const REST: CameraPose = { position: [6.5, 1.7, 9], target: [0, 0.6, 0], fov: BASE_FOV };

type Spring = { v: number; vel: number };

const look = new Vector3();
const right = new Vector3();
const up = new Vector3(0, 1, 0);
const forward = new Vector3();

/**
 * Drives the camera from scroll progress with frame-rate independent damping, adds
 * pointer parallax and a slow breathing sway, and widens the FOV with scroll speed.
 * Everything scroll-related is a function of progress so it scrubs exactly. The pose
 * (position, look-at, field of view) comes from the active world's layout, so the rig
 * knows nothing about the bay.
 *
 * During click-to-enter it hands the camera to a spring (SPRING_CAMERA) that dollies
 * to the requested pose and reports when it has settled.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const aspect = useThree((s) => s.viewport.aspect);
  const gl = useThree((s) => s.gl);
  const pos = useRef(new Vector3(...REST.position));
  const tgt = useRef(new Vector3(...REST.target));
  const fov = useRef(BASE_FOV);
  const springs = useRef<Spring[] | null>(null);
  const dollyStart = useRef(0);

  useEffect(() => bindPointer(), []);

  // The DOM wrapper is what the entry sequence fades; publish it for the interaction layer.
  useEffect(() => {
    enter.canvasWrapper = gl.domElement.parentElement;
    return () => {
      enter.canvasWrapper = null;
    };
  }, [gl]);

  useFrame(({ clock }, dt) => {
    const state = useScene.getState();
    const { progress, velocity, setStation } = state;
    const world = activeWorld(state);
    const t = clock.elapsedTime;
    const step = Math.min(dt, 1 / 30);

    if (enter.phase === "dolly" && enter.target) {
      const target = enter.target;
      const goal = [...target.position, ...target.target];
      if (!springs.current) {
        const p = pos.current;
        const g = tgt.current;
        springs.current = [p.x, p.y, p.z, g.x, g.y, g.z].map((v) => ({ v, vel: 0 }));
        dollyStart.current = t;
      }
      const s = springs.current;
      let settled = true;
      for (let i = 0; i < 6; i++) {
        const sp = s[i]!;
        [sp.v, sp.vel] = springStep(sp.v, sp.vel, goal[i]!, step, SPRING_CAMERA);
        if (Math.abs(sp.v - goal[i]!) > SETTLE_POS || Math.abs(sp.vel) > SETTLE_VEL) settled = false;
      }
      pos.current.set(s[0]!.v, s[1]!.v, s[2]!.v);
      tgt.current.set(s[3]!.v, s[4]!.v, s[5]!.v);
      camera.position.copy(pos.current);
      camera.lookAt(tgt.current);
      if (camera.fov !== BASE_FOV) {
        camera.fov = BASE_FOV;
        camera.updateProjectionMatrix();
      }
      if (settled || t - dollyStart.current > DOLLY_MAX_S) {
        enter.phase = "cover";
        springs.current = null;
        enter.onSettled?.();
      }
      return;
    }
    if (enter.phase === "cover") return; // hold the pose while the DOM takes over
    springs.current = null;

    // The world's pose at rest for this scroll position; damped so it never jumps.
    const pose = world ? world.pose(progress, aspect) : REST;
    const p = pos.current;
    const g = tgt.current;
    p.set(
      damp(p.x, pose.position[0], 5, dt),
      damp(p.y, pose.position[1], 5, dt),
      damp(p.z, pose.position[2], 5, dt),
    );
    g.set(
      damp(g.x, pose.target[0], 5, dt),
      damp(g.y, pose.target[1], 5, dt),
      damp(g.z, pose.target[2], 5, dt),
    );

    // Parallax moves the look-at point sideways and up in the camera's own frame.
    const { x: px, y: py } = parallaxInput();
    forward.subVectors(g, p).normalize();
    right.crossVectors(forward, up).normalize();
    look.copy(g).addScaledVector(right, px * PARALLAX).addScaledVector(up, py * PARALLAX * 0.6);

    // Breathing: two incommensurate sines so it never visibly repeats.
    const swayX = Math.sin(t * 0.31) * 0.03 + Math.sin(t * 0.73) * 0.012;
    const swayY = Math.sin(t * 0.47) * 0.02;

    camera.position.set(p.x + swayX, p.y + swayY, p.z);
    camera.lookAt(look);
    camera.rotateZ(Math.sin(t * 0.21) * 0.003);

    const target = lerp(pose.fov ?? BASE_FOV, (pose.fov ?? BASE_FOV) + 4, velocity);
    fov.current = damp(fov.current, target, 6, dt);
    if (Math.abs(camera.fov - fov.current) > 0.01) {
      camera.fov = fov.current;
      camera.updateProjectionMatrix();
    }

    if (world) setStation(world.nearestStation(progress));
  });

  return null;
}
