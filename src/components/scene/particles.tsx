"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  type Points,
  ShaderMaterial,
  Vector3,
  Vector4,
} from "three";

import { damp } from "~/lib/motion";

/**
 * Per-frame inputs for the ambient cloud. Owned by the world and written in its
 * useFrame so the particles never subscribe to anything.
 */
export type ParticleFrame = {
  cameraZ: number;
  /** World position of the current station's canvas centre. */
  station: Vector3;
  /** 0..1 assembly of the current station; 1 at hold. */
  hold: number;
  /** The world's light colour; the cloud tints toward its hue. */
  bleed: Color;
};

type Props = {
  /** Motes in the cloud: about 600 desktop, 250 mobile. */
  count: number;
  frame: React.MutableRefObject<ParticleFrame>;
  /** The volume the cloud fills. */
  room: { halfW: number; floorY: number; ceilY: number };
};

/** Depth of the band the cloud lives in, ahead of the camera. Fog ends at 34. */
const BAND = 36;
const LEAF_FRACTION = 0.14;
const WARM = new Color("#f1e6cf");

const vertex = /* glsl */ `
  attribute vec4 aSeed;   // xyz: unit position in the band, w: per-mote random
  attribute float aKind;  // 0 dust, 1 leaf fragment

  uniform float uTime;
  uniform float uCameraZ;
  uniform vec3 uStation;
  uniform float uDim;
  uniform float uDpr;
  uniform vec4 uRoom;     // halfW, floorY, ceilY, band

  varying float vAlpha;
  varying float vKind;
  varying float vSpin;
  varying float vSparkle;

  void main() {
    float t = uTime;
    float s = aSeed.w;
    float ph = s * 6.2831;
    float halfW = uRoom.x;
    float floorY = uRoom.y;
    float roomH = uRoom.z - uRoom.y;
    float band = uRoom.w;

    // Leaves settle slowly and recycle from the ceiling; dust hangs.
    float fall = aKind * t * (0.05 + s * 0.06);
    float y = floorY + 0.15 + mod(aSeed.y * roomH - fall, roomH - 0.3);
    float x = (aSeed.x * 2.0 - 1.0) * (halfW - 0.4);

    // The band drifts with the camera; motes wrap along Z so the cloud follows it.
    float zLocal = mod(aSeed.z * band + t * (0.12 + s * 0.12), band);
    float z = uCameraZ + 3.0 - zLocal;

    // Curl-ish drift: incommensurate sines so the field never visibly repeats.
    float k = 0.6 + aKind * 0.9;
    vec3 drift = vec3(
      sin(t * 0.21 + ph) * 0.35 + sin(t * 0.53 + ph * 2.0) * 0.12,
      cos(t * 0.17 + ph * 1.3) * 0.18 + sin(t * 0.41 + ph) * 0.07,
      sin(t * 0.13 + ph * 0.7) * 0.4
    ) * k;
    vec3 pos = vec3(x, y, z) + drift;
    pos.x = clamp(pos.x, -halfW + 0.2, halfW - 0.2);

    // Fade at both ends of the band so nothing pops in or out.
    float edge = smoothstep(0.0, 2.5, zLocal) * (1.0 - smoothstep(band - 8.0, band, zLocal));
    // Brighter inside the current station's light; near-invisible in the dark between.
    float d = distance(pos, uStation);
    float spot = 1.0 - smoothstep(1.5, 7.5, d);
    float bright = (0.08 + 0.92 * spot) * edge;

    // A few motes twinkle above white so bloom catches only those.
    float sparkle = step(0.975, s) * (0.5 + 0.5 * sin(t * (2.5 + s * 5.0) + ph * 3.0));
    vSparkle = sparkle * spot * edge;
    vAlpha = bright * uDim;
    vKind = aKind;
    vSpin = t * (0.3 + s * 0.6) + ph;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float base = mix(1.4, 3.2, s) * (1.0 + aKind * 1.8);
    gl_PointSize = clamp(base * uDpr * 14.0 / max(1.0, -mv.z), 1.0, 26.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;

  varying float vAlpha;
  varying float vKind;
  varying float vSpin;
  varying float vSparkle;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float a;
    if (vKind > 0.5) {
      // Leaf fragment: a thin rotated ellipse.
      float c = cos(vSpin);
      float s = sin(vSpin);
      vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
      q.x *= 2.6;
      a = 1.0 - smoothstep(0.5, 1.0, dot(q, q));
    } else {
      float r = dot(p, p);
      a = 1.0 - smoothstep(0.0, 1.0, r);
      a *= a;
    }
    if (a < 0.01) discard;
    // Never above 1.0 so the cloud sits under the bloom threshold; sparkles alone cross it.
    vec3 col = min(uColor * a * vAlpha, vec3(1.0));
    col += uColor * a * vSparkle * 1.8;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Ambient life: one Points draw call of dust motes and leaf-like fragments drifting on
 * a cheap sum-of-sines field in a band around the camera. Attenuated toward the
 * current station's light, tinted toward its colour bleed, and dimmed to 30% at hold
 * so nothing competes with the painting.
 */
export function Particles({ count, frame, room }: Props) {
  const points = useRef<Points>(null);
  const dim = useRef(1);
  const tint = useRef(new Color(WARM));

  const geometry = useMemo(() => {
    const seed = new Float32Array(count * 4);
    const kind = new Float32Array(count);
    // Deterministic so the cloud is identical every visit.
    let state = 0x9e3779b9;
    const rand = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return ((state >>> 0) % 100000) / 100000;
    };
    for (let i = 0; i < count; i++) {
      seed[i * 4] = rand();
      seed[i * 4 + 1] = rand();
      seed[i * 4 + 2] = rand();
      seed[i * 4 + 3] = rand();
      kind[i] = rand() < LEAF_FRACTION ? 1 : 0;
    }
    const g = new BufferGeometry();
    // Positions are computed on the GPU; the attribute only sets the vertex count.
    g.setAttribute("position", new Float32BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSeed", new Float32BufferAttribute(seed, 4));
    g.setAttribute("aKind", new Float32BufferAttribute(kind, 1));
    g.boundingSphere = null;
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uCameraZ: { value: 0 },
          uStation: { value: new Vector3(0, 0, 9999) },
          uDim: { value: 1 },
          uDpr: { value: 1 },
          uRoom: { value: new Vector4(room.halfW, room.floorY, room.ceilY, BAND) },
          uColor: { value: new Color(WARM) },
        },
      }),
    [room],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state, dt) => {
    const f = frame.current;
    const u = material.uniforms;
    u.uTime!.value = (u.uTime!.value as number) + dt;
    u.uCameraZ!.value = f.cameraZ;
    (u.uStation!.value as Vector3).copy(f.station);
    u.uDpr!.value = state.viewport.dpr;

    // 30% while the piece is seated, back to full as it dissolves.
    const seated = f.hold > 0.85 ? (f.hold - 0.85) / 0.15 : 0;
    dim.current = damp(dim.current, 1 - 0.7 * seated, 3, dt);
    u.uDim!.value = dim.current;

    // Tint: the bleed's hue at full brightness, mixed with warm light.
    const b = f.bleed;
    const max = Math.max(b.r, b.g, b.b, 1e-4);
    const c = tint.current;
    c.r = damp(c.r, WARM.r * 0.5 + (b.r / max) * 0.5, 2, dt);
    c.g = damp(c.g, WARM.g * 0.5 + (b.g / max) * 0.5, 2, dt);
    c.b = damp(c.b, WARM.b * 0.5 + (b.b / max) * 0.5, 2, dt);
    (u.uColor!.value as Color).copy(c);
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
