"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, type Group, type MeshBasicMaterial } from "three";

import { CAR } from "~/lib/scene/bay-layout";

import type { CarFrame } from "./car";

/** Shadow plane size: the footprint plus a soft margin all round, in metres. */
const W = CAR.width + 1.1;
const L = CAR.length + 1.2;

type Props = { frame: React.MutableRefObject<CarFrame>; driveFromZ: number };

/**
 * The car's contact shadow, painted once: the footprint, darker pools under the four
 * wheels. It follows the car in, turns with it and fades and spreads as the lift takes it
 * up. Stands in for a contact-shadow pass, which re-rendered the whole car from below
 * every frame, several hundred draw calls for a soft grey shape.
 */
export function CarShadow({ frame, driveFromZ }: Props) {
  const group = useRef<Group>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const texture = useMemo(paintShadow, []);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    const g = group.current;
    const m = material.current;
    if (!g || !m) return;
    const f = frame.current;
    g.position.set(f.x, 0.012, driveFromZ * (1 - f.driveIn));
    g.rotation.y = f.yaw;
    g.scale.setScalar(1 + f.lift * 0.3);
    m.opacity = 1 - f.lift * 0.6;
  });

  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
        <planeGeometry args={[W, L]} />
        <meshBasicMaterial ref={material} map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A soft black footprint with alpha: the body as a stretched ellipse, a pool under each wheel. */
function paintShadow() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    const stretch = ((c.height / c.width) * (CAR.length / L)) / (CAR.width / W);
    g.save();
    g.translate(c.width / 2, c.height / 2);
    g.scale(1, stretch);
    const body = g.createRadialGradient(0, 0, 0, 0, 0, c.width * 0.46);
    body.addColorStop(0, "rgba(0, 0, 0, 0.62)");
    body.addColorStop(0.6, "rgba(0, 0, 0, 0.46)");
    body.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = body;
    g.fillRect(-c.width / 2, -c.height / (2 * stretch), c.width, c.height / stretch);
    g.restore();
    // Wheels sit near the corners of the footprint, about a sixth in from each end.
    const wx = (CAR.width / W) * c.width * 0.4;
    const wy = (CAR.length / L) * c.height * 0.33;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const x = c.width / 2 + sx * wx;
        const y = c.height / 2 + sy * wy;
        const pool = g.createRadialGradient(x, y, 0, x, y, 18);
        pool.addColorStop(0, "rgba(0, 0, 0, 0.55)");
        pool.addColorStop(1, "rgba(0, 0, 0, 0)");
        g.fillStyle = pool;
        g.fillRect(x - 18, y - 18, 36, 36);
      }
    }
  }
  return new CanvasTexture(c);
}
