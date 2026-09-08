"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  type Points,
  Shape,
  ShaderMaterial,
} from "three";

import { BAY } from "~/lib/scene/bay-layout";

import { Street } from "./street";
import {
  makeCorrugatedTexture,
  makeRoundelTexture,
  makeSignTexture,
  makeSkyTexture,
  makeStoneTexture,
  makeTarmacTexture,
} from "~/lib/scene/bay-textures";

type Props = { mobile: boolean };

const SODIUM = new Color("#ffb45c");

/** The gable above the garage front: a triangle from the eaves to the ridge. */
function gableShape(halfW: number, eaves: number, ridge: number) {
  const s = new Shape();
  s.moveTo(-halfW, eaves - 0.02);
  s.lineTo(halfW, eaves - 0.02);
  s.lineTo(0, ridge);
  s.closePath();
  return s;
}

const rainVertex = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uTime;
  uniform float uDpr;
  varying float vAlpha;
  void main() {
    // Each drop falls its own lane and wraps; the band sits over the forecourt.
    float y = mod(aSeed.y * 14.0 - uTime * (6.0 + aSeed.z * 3.0), 14.0);
    vec3 pos = vec3(aSeed.x, y, aSeed.z * 30.0 + 6.0);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = clamp(1.6 * uDpr * 30.0 / max(1.0, -mv.z), 1.0, 4.0);
    vAlpha = 0.35;
    gl_Position = projectionMatrix * mv;
  }
`;
const rainFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float a = (1.0 - smoothstep(0.2, 1.0, abs(p.x))) * (1.0 - smoothstep(0.6, 1.0, abs(p.y)));
    gl_FragColor = vec4(vec3(0.75, 0.8, 0.9) * a * vAlpha, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Beyond the shutter: Central Garage's forecourt on a wet Welsh evening. The white
 * gabled front with the JJ roundel and the lettering, the long stone side building
 * under a corrugated roof, the church tower behind, two trees, the green railings, a
 * totem sign, the high street of shops beyond (street.tsx), an overcast sky and light
 * rain. All drawn at runtime; nothing fetched.
 */
export function Exterior({ mobile }: Props) {
  const tex = useMemo(() => {
    const stone = makeStoneTexture(3);
    stone.repeat.set(4, 2);
    const stoneDark = makeStoneTexture(11, true);
    stoneDark.repeat.set(2, 6);
    const corrugated = makeCorrugatedTexture();
    corrugated.repeat.set(10, 1);
    const tarmac = makeTarmacTexture();
    tarmac.repeat.set(9, 3);
    const house = makeStoneTexture(21);
    house.repeat.set(2, 1.6);
    return {
      stone,
      stoneDark,
      corrugated,
      tarmac,
      house,
      roundel: makeRoundelTexture(),
      lettering: makeSignTexture("CENTRAL GARAGE", { width: 1024, height: 160, bg: "#f4f1ea", fg: "#1c1f2a" }),
      totem: makeSignTexture("JENKINS", { width: 256, height: 1024, bg: "#f6f5f0", fg: "#c8102e", font: "bold 44px Archivo, Arial, sans-serif" }),
      sky: makeSkyTexture(),
    };
  }, []);
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex]);

  const gable = useMemo(() => gableShape(6.6, BAY.height + 0.3, BAY.height + 2.4), []);
  const Z = BAY.shutterZ;

  // Rain as one Points draw call.
  const rain = useMemo(() => {
    const n = mobile ? 900 : 2400;
    const seed = new Float32Array(n * 3);
    let s = 0x2545f491;
    const r = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
    for (let i = 0; i < n; i++) {
      seed[i * 3] = (r() * 2 - 1) * 26;
      seed[i * 3 + 1] = r();
      seed[i * 3 + 2] = r();
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aSeed", new Float32BufferAttribute(seed, 3));
    g.boundingSphere = null;
    const m = new ShaderMaterial({
      vertexShader: rainVertex,
      fragmentShader: rainFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uDpr: { value: 1 } },
    });
    return { g, m };
  }, [mobile]);
  useEffect(
    () => () => {
      rain.g.dispose();
      rain.m.dispose();
    },
    [rain],
  );
  const points = useRef<Points>(null);
  useFrame((state, dt) => {
    rain.m.uniforms.uTime!.value = (rain.m.uniforms.uTime!.value as number) + dt;
    rain.m.uniforms.uDpr!.value = state.viewport.dpr;
  });


  return (
    <group>
      {/* Sky: a dome with the evening gradient, inside the camera's far plane. */}
      <mesh position={[0, -8, 10]}>
        <sphereGeometry args={[110, 24, 12]} />
        <meshBasicMaterial map={tex.sky} side={BackSide} fog={false} />
      </mesh>

      {/* The forecourt: black tarmac from the shutter out to the railings. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, Z + 5.75]} receiveShadow>
        <planeGeometry args={[44, 12.5]} />
        <meshStandardMaterial map={tex.tarmac} roughness={0.55} metalness={0.05} envMapIntensity={0.15} />
      </mesh>
      {/* The street beyond it. */}
      <Street mobile={mobile} />

      {/* The gable over the garage front: rendered white, front and back faces. */}
      <mesh position={[0, 0, Z + 0.16]}>
        <shapeGeometry args={[gable]} />
        <meshStandardMaterial color="#efece4" roughness={0.9} side={2} />
      </mesh>
      {/* The render skin over the blockwork either side of the door, outside. */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 4.55, (BAY.height + 0.3) / 2, Z + 0.18]}>
          <planeGeometry args={[4.1, BAY.height + 0.3]} />
          <meshStandardMaterial color="#efece4" roughness={0.9} />
        </mesh>
      ))}
      {/* Bargeboards and the eaves line. */}
      <mesh position={[0, BAY.height + 0.3, Z + 0.36]}>
        <boxGeometry args={[13.4, 0.12, 0.1]} />
        <meshStandardMaterial color="#3a3d44" roughness={0.8} />
      </mesh>
      {/* The roundel on the gable and the lettering over the door. */}
      <mesh position={[0, BAY.height + 1.45, Z + 0.4]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshStandardMaterial map={tex.roundel} transparent roughness={0.6} />
      </mesh>
      <mesh position={[0, BAY.height + 0.05, Z + 0.4]}>
        <planeGeometry args={[4.2, 0.62]} />
        <meshStandardMaterial map={tex.lettering} roughness={0.7} />
      </mesh>
      {/* Two bulkhead lamps either side of the door, with their sodium pools. */}
      {[-3.2, 3.2].map((x) => (
        <group key={x} position={[x, BAY.height - 0.4, Z + 0.45]}>
          <mesh>
            <boxGeometry args={[0.28, 0.18, 0.2]} />
            <meshBasicMaterial color={new Color(1.25, 0.95, 0.55)} toneMapped={false} />
          </mesh>
          <pointLight color={SODIUM} intensity={6} distance={9} decay={2} position={[0, -0.2, 0.5]} />
        </group>
      ))}

      {/* The long stone side building to the right, under its corrugated roof. */}
      <group position={[15.5, 0, Z + 2.5]}>
        <mesh position={[0, 1.6, 0]}>
          <boxGeometry args={[12, 3.2, 8]} />
          <meshStandardMaterial map={tex.stone} roughness={0.95} />
        </mesh>
        <mesh position={[0, 3.55, 0]} rotation={[0, 0, 0.16]}>
          <boxGeometry args={[12.6, 0.12, 8.6]} />
          <meshStandardMaterial map={tex.corrugated} roughness={0.6} metalness={0.4} />
        </mesh>
        {[-4, -1, 2].map((x) => (
          <mesh key={x} position={[x, 1.7, -4.02]}>
            <planeGeometry args={[1.1, 1.2]} />
            <meshBasicMaterial color="#ffd9a0" />
          </mesh>
        ))}
      </group>

      {/* The church tower behind and to the left, battlements on top. */}
      <group position={[-9, 0, Z - 22]}>
        <mesh position={[0, 9, 0]}>
          <boxGeometry args={[6.5, 18, 6.5]} />
          <meshStandardMaterial map={tex.stoneDark} roughness={1} />
        </mesh>
        {Array.from({ length: 12 }, (_, i) => {
          const side = Math.floor(i / 3);
          const t = (i % 3) - 1;
          const pos: [number, number, number] =
            side === 0 ? [t * 2.3, 18.5, 3.1] : side === 1 ? [t * 2.3, 18.5, -3.1] : side === 2 ? [3.1, 18.5, t * 2.3] : [-3.1, 18.5, t * 2.3];
          return (
            <mesh key={i} position={pos}>
              <boxGeometry args={[1.2, 1, 1.2]} />
              <meshStandardMaterial map={tex.stoneDark} roughness={1} />
            </mesh>
          );
        })}
        <mesh position={[0, 13, 3.26]}>
          <planeGeometry args={[0.7, 2.2]} />
          <meshBasicMaterial color="#05060a" />
        </mesh>
        {/* The nave, low and long, behind the tower. */}
        <mesh position={[9, 4, 0]}>
          <boxGeometry args={[14, 8, 7]} />
          <meshStandardMaterial map={tex.stoneDark} roughness={1} />
        </mesh>
      </group>

      {/* Two trees by the church: dark clusters, the way they read at dusk. */}
      {[
        [-3, Z - 19],
        [5, Z - 22],
      ].map(([x, z], i) => (
        <group key={i} position={[x!, 0, z!]}>
          <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[0.18, 0.3, 4.4, 7]} />
            <meshStandardMaterial color="#2b241c" roughness={1} />
          </mesh>
          {[
            [0, 5.6, 0, 3.2],
            [-1.6, 4.6, 0.8, 2.3],
            [1.7, 4.9, -0.6, 2.5],
            [0.4, 7.4, 0.5, 2.1],
          ].map(([ox, oy, oz, r], j) => (
            <mesh key={j} position={[ox!, oy!, oz!]}>
              <sphereGeometry args={[r, 10, 8]} />
              <meshStandardMaterial color="#1d3320" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Green railings along the front of the forecourt, a gap for the entrance. */}
      {Array.from({ length: 26 }, (_, i) => {
        const x = -16 + i * 1.3;
        if (Math.abs(x) < 4.7) return null;
        return (
          <mesh key={i} position={[x, 0.6, Z + 12]}>
            <boxGeometry args={[0.06, 1.2, 0.06]} />
            <meshStandardMaterial color="#2f7a3a" roughness={0.6} metalness={0.3} />
          </mesh>
        );
      })}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <mesh position={[sx * 10.6, 1.15, Z + 12]}>
            <boxGeometry args={[12, 0.06, 0.06]} />
            <meshStandardMaterial color="#2f7a3a" roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh position={[sx * 10.6, 0.25, Z + 12]}>
            <boxGeometry args={[12, 0.06, 0.06]} />
            <meshStandardMaterial color="#2f7a3a" roughness={0.6} metalness={0.3} />
          </mesh>
        </group>
      ))}

      {/* The totem sign by the road. */}
      <group position={[-7.5, 0, Z + 9]}>
        <mesh position={[0, 2.6, 0]}>
          <boxGeometry args={[1.1, 4.2, 0.25]} />
          <meshStandardMaterial map={tex.totem} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.3, 0.5, 0.3]} />
          <meshStandardMaterial color="#555" roughness={0.8} />
        </mesh>
      </group>

      {/* The stone house joined on to the left of the garage, its windows lit. */}
      <group position={[-11.2, 0, Z - 1.2]}>
        <mesh position={[0, 3.4, 0]}>
          <boxGeometry args={[9, 6.8, 8.5]} />
          <meshStandardMaterial map={tex.house} roughness={1} />
        </mesh>
        <mesh position={[0, 6.8 + 1.15, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[9.4, 0.14, 4.6]} />
          <meshStandardMaterial color="#23272e" roughness={0.75} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[0, 6.8 + 1.15, sx * 2.6]} rotation={[sx * 0.62, 0, 0]}>
            <boxGeometry args={[9.4, 0.14, 4.6]} />
            <meshStandardMaterial color="#23272e" roughness={0.75} />
          </mesh>
        ))}
        <mesh position={[-3.2, 9.2, 0]}>
          <boxGeometry args={[0.8, 1.6, 0.8]} />
          <meshStandardMaterial map={tex.house} roughness={1} />
        </mesh>
        {[
          [-2.6, 1.5, true],
          [0.4, 1.5, false],
          [-2.6, 4.4, true],
          [0.4, 4.4, true],
          [2.9, 4.4, false],
        ].map(([x, y, lit], i) => (
          <mesh key={i} position={[x as number, y as number, 4.27]}>
            <planeGeometry args={[1.0, 1.4]} />
            <meshBasicMaterial color={lit ? "#ffd9a0" : "#0a0c12"} />
          </mesh>
        ))}
        <mesh position={[2.9, 1.1, 4.27]}>
          <planeGeometry args={[0.95, 2.1]} />
          <meshStandardMaterial color="#1f3d2b" roughness={0.8} />
        </mesh>
      </group>

      {/* Rain over the forecourt. */}
      <points ref={points} geometry={rain.g} material={rain.m} frustumCulled={false} />
    </group>
  );
}
