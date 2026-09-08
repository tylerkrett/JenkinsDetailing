"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, Float32BufferAttribute, NormalBlending, type Points, ShaderMaterial, Vector3 } from "three";

export type SprayFrame = {
  /** Nozzle position, world. */
  origin: Vector3;
  /** Where the jet lands, world. */
  target: Vector3;
  /** 0..1 flow. */
  on: number;
};

type Props = { count: number; frame: React.MutableRefObject<SprayFrame> };

const vertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform vec3 uOrigin;
  uniform vec3 uTarget;
  uniform float uOn;
  uniform float uDpr;
  varying float vAlpha;
  varying float vSplash;

  void main() {
    // Each drop lives 0..1 along the jet, then 1..1.35 as splash off the panel. A
    // closed-form ballistic arc: no simulation, no state.
    float life = 1.35;
    float t = mod(aSeed.x * life + uTime * (2.6 + aSeed.y * 0.8), life);
    vec3 dir = uTarget - uOrigin;
    float len = max(0.001, length(dir));
    vec3 fwd = dir / len;
    vec3 side = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(side, fwd);
    float spread = 0.06 + t * 0.16;
    float a = aSeed.z * 6.2831;
    vec3 pos;
    float splash = 0.0;
    if (t < 1.0) {
      pos = uOrigin + fwd * (t * len) + (side * cos(a) + up * sin(a)) * spread * aSeed.w * len * 0.12;
      pos.y -= t * t * 0.35;
    } else {
      float s = t - 1.0;
      splash = 1.0;
      vec3 bounce = normalize(vec3(cos(a) * 0.8, 0.9 + aSeed.w * 0.6, sin(a) * 0.8));
      pos = uTarget + bounce * s * 1.6 * (0.6 + aSeed.w) - vec3(0.0, 4.9 * s * s, 0.0) + fwd * s * 0.2;
    }
    vAlpha = uOn * (t < 1.0 ? 1.0 : 0.8 * (1.0 - (t - 1.0) / 0.35));
    vSplash = splash;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = clamp((2.4 + aSeed.w * 1.6 + splash * 0.8) * uDpr * 30.0 / max(0.4, -mv.z), 1.5, 22.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const fragment = /* glsl */ `
  varying float vAlpha;
  varying float vSplash;
  void main() {
    if (vAlpha <= 0.003) discard;
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = dot(p, p);
    float a = (1.0 - smoothstep(0.15, 1.0, r)) * vAlpha;
    // A bright core with a darker blue rim, so the drops read over foam and over paint alike.
    float core = 1.0 - smoothstep(0.0, 0.55, r);
    vec3 col = mix(vec3(0.42, 0.56, 0.86), vec3(0.95, 0.98, 1.0), core + vSplash * 0.3);
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** A pressure-washer jet: one Points draw call from nozzle to panel, with splash. */
export function Spray({ count, frame }: Props) {
  const points = useRef<Points>(null);
  const geometry = useMemo(() => {
    const seed = new Float32Array(count * 4);
    let s = 0x1234567;
    const rand = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
    for (let i = 0; i < count * 4; i++) seed[i] = rand();
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSeed", new Float32BufferAttribute(seed, 4));
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
        blending: NormalBlending,
        uniforms: {
          uTime: { value: 0 },
          uOrigin: { value: new Vector3() },
          uTarget: { value: new Vector3() },
          uOn: { value: 0 },
          uDpr: { value: 1 },
        },
      }),
    [],
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
    (u.uOrigin!.value as Vector3).copy(f.origin);
    (u.uTarget!.value as Vector3).copy(f.target);
    u.uOn!.value = f.on;
    u.uDpr!.value = state.viewport.dpr;
    if (points.current) points.current.visible = f.on > 0.01;
  });
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
