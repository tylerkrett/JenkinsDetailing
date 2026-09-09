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

import { Forecourt } from "./forecourt";
import { Street } from "./street";
import {
  makeCorrugatedTexture,
  makeRoundelTexture,
  makeSignTexture,
  makeForecourtTexture,
  makeSkyTexture,
  makeStoneTexture,
  makeTotemTexture,
} from "~/lib/scene/bay-textures";

type Props = { mobile: boolean };

const SODIUM = new Color("#ffb45c");

/**
 * The stone side building: its walls, the head of the bay opening in its front, and the
 * ridge its roof rises to. The pitch follows from the depth and the rise, so the slopes
 * and the gables always agree.
 */
const SIDE = { w: 12, d: 8, h: 3.2, head: 2.9, ridge: 4.5 } as const;
const SIDE_PITCH = Math.atan((SIDE.ridge - SIDE.h) / (SIDE.d / 2));

/** The stone house on the left of the garage: its walls, and the ridge over them. */
const HOUSE = { w: 9, d: 8.5, h: 6.8, ridge: 8.7 } as const;
const HOUSE_PITCH = Math.atan((HOUSE.ridge - HOUSE.h) / (HOUSE.d / 2));
const HOUSE_SLOPE = Math.hypot(HOUSE.d / 2, HOUSE.ridge - HOUSE.h);
/** How high the lift holds the car off the bay floor. */
const LIFT = 1.15;

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
    const tarmac = makeForecourtTexture();
    tarmac.repeat.set(7, 2);
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
      totem: makeTotemTexture(),
      sky: makeSkyTexture(),
    };
  }, []);
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex]);

  const gable = useMemo(() => gableShape(6.6, BAY.height + 0.3, BAY.height + 2.4), []);
  const sideGable = useMemo(() => gableShape(SIDE.d / 2, SIDE.h, SIDE.ridge), []);
  const houseGable = useMemo(() => gableShape(HOUSE.d / 2, HOUSE.h, HOUSE.ridge), []);
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
      {/* The yard's own kit, the boundary round it and the hills behind. */}
      <Forecourt mobile={mobile} />

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

      {/* The long stone side building to the right: the second bay, open to the
          forecourt with a car up on the two-post lift, under a pitched corrugated roof.
          Built as walls rather than one box so the bay is a real opening with depth. */}
      <group position={[15.5, 0, Z + 2.5]}>
        {/* Back and both ends. */}
        <mesh position={[0, SIDE.h / 2, -SIDE.d / 2]}>
          <boxGeometry args={[SIDE.w, SIDE.h, 0.3]} />
          <meshStandardMaterial map={tex.stone} roughness={0.95} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[(sx * SIDE.w) / 2, SIDE.h / 2, 0]}>
            <boxGeometry args={[0.3, SIDE.h, SIDE.d]} />
            <meshStandardMaterial map={tex.stone} roughness={0.95} />
          </mesh>
        ))}
        {/* The front, in two piers either side of the bay mouth, with its lintel. */}
        <mesh position={[-4.88, SIDE.h / 2, SIDE.d / 2]}>
          <boxGeometry args={[2.25, SIDE.h, 0.3]} />
          <meshStandardMaterial map={tex.stone} roughness={0.95} />
        </mesh>
        <mesh position={[3.38, SIDE.h / 2, SIDE.d / 2]}>
          <boxGeometry args={[5.25, SIDE.h, 0.3]} />
          <meshStandardMaterial map={tex.stone} roughness={0.95} />
        </mesh>
        <mesh position={[-1.5, (SIDE.head + SIDE.h) / 2, SIDE.d / 2]}>
          <boxGeometry args={[4.5, SIDE.h - SIDE.head, 0.3]} />
          <meshStandardMaterial map={tex.stone} roughness={0.95} />
        </mesh>
        {/* The floor inside, and the dark of the far corners. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <planeGeometry args={[SIDE.w, SIDE.d]} />
          <meshStandardMaterial color="#3a3b3f" roughness={0.85} />
        </mesh>

        {/* The roof: two slopes to a ridge along the building, and a gable at each end. */}
        {[-1, 1].map((sz) => (
          <mesh key={sz} position={[0, (SIDE.h + SIDE.ridge) / 2, (sz * SIDE.d) / 4]} rotation={[sz * SIDE_PITCH, 0, 0]}>
            <boxGeometry args={[SIDE.w + 0.5, 0.14, SIDE.d / 2 + 0.45]} />
            <meshStandardMaterial map={tex.corrugated} roughness={0.6} metalness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, SIDE.ridge, 0]}>
          <boxGeometry args={[SIDE.w + 0.6, 0.16, 0.36]} />
          <meshStandardMaterial color="#4c5158" roughness={0.7} metalness={0.3} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[(sx * SIDE.w) / 2, 0, 0]} rotation={[0, (sx * Math.PI) / 2, 0]}>
            <shapeGeometry args={[sideGable]} />
            <meshStandardMaterial map={tex.stone} roughness={0.95} side={2} />
          </mesh>
        ))}

        {/* The bay's strip light, and the light it throws over the car and the floor. */}
        <mesh position={[-1.5, SIDE.head - 0.22, 0.4]}>
          <boxGeometry args={[3.2, 0.1, 0.34]} />
          <meshBasicMaterial color={new Color(1.5, 1.55, 1.6)} toneMapped={false} />
        </mesh>
        <pointLight color="#cfe0f2" intensity={26} distance={15} decay={2} position={[-1.5, SIDE.head - 0.6, 0.9]} />

        {/* The two-post lift, and the car standing on it. */}
        <group position={[-1.5, 0, 0.2]}>
          {[-1.32, 1.32].map((px) => (
            <group key={px} position={[px, 0, 0]}>
              <mesh position={[0, 0.06, 0]}>
                <boxGeometry args={[0.5, 0.12, 0.7]} />
                <meshStandardMaterial color="#2b2e34" roughness={0.7} metalness={0.35} />
              </mesh>
              <mesh position={[0, 1.35, 0]}>
                <boxGeometry args={[0.26, 2.7, 0.26]} />
                <meshStandardMaterial color="#1f4fa8" roughness={0.5} metalness={0.4} />
              </mesh>
              {/* The arms under the sills, at the height the car is held. */}
              {[-1, 1].map((sz) => (
                <mesh key={sz} position={[px < 0 ? 0.55 : -0.55, LIFT, sz * 1.05]}>
                  <boxGeometry args={[1.1, 0.14, 0.16]} />
                  <meshStandardMaterial color="#2b2e34" roughness={0.6} metalness={0.4} />
                </mesh>
              ))}
            </group>
          ))}
          <mesh position={[0, 2.78, 0]}>
            <boxGeometry args={[2.9, 0.18, 0.22]} />
            <meshStandardMaterial color="#1f4fa8" roughness={0.5} metalness={0.4} />
          </mesh>
          {/* The car up on it: a plain massing, read at this distance as a silhouette. */}
          <group position={[0, LIFT + 0.2, 0]}>
            {/* Sills, then the body over them, then a narrower glasshouse: enough of a
                step to read as a car rather than a slab at this distance. */}
            <mesh position={[0, 0.16, 0]}>
              <boxGeometry args={[1.72, 0.3, 4.2]} />
              <meshStandardMaterial color="#6e767e" roughness={0.6} metalness={0.4} />
            </mesh>
            <mesh position={[0, 0.46, 0.05]}>
              <boxGeometry args={[1.84, 0.42, 4.3]} />
              <meshStandardMaterial color="#a8afb6" roughness={0.38} metalness={0.55} />
            </mesh>
            <mesh position={[0, 0.83, -0.3]}>
              <boxGeometry args={[1.54, 0.4, 2.0]} />
              <meshStandardMaterial color="#1b1f27" roughness={0.24} metalness={0.5} />
            </mesh>
            <mesh position={[0, 1.02, -0.3]}>
              <boxGeometry args={[1.46, 0.06, 1.9]} />
              <meshStandardMaterial color="#a8afb6" roughness={0.38} metalness={0.55} />
            </mesh>
            {/* The wheels hang below the sills, as they do on a raised car. */}
            {[-1, 1].flatMap((sx) =>
              [-1.42, 1.42].map((oz) => (
                <mesh key={`${sx}${oz}`} position={[sx * 0.84, -0.16, oz]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.32, 0.32, 0.2, 12]} />
                  <meshStandardMaterial color="#15161a" roughness={0.95} />
                </mesh>
              )),
            )}
          </group>
        </group>

        {/* A bench down the back wall of the bay, and a wheeled tool chest. */}
        <mesh position={[-2.6, 0.85, -3.4]}>
          <boxGeometry args={[4.4, 0.1, 0.7]} />
          <meshStandardMaterial color="#6b5537" roughness={0.9} />
        </mesh>
        <mesh position={[-2.6, 0.42, -3.4]}>
          <boxGeometry args={[4.2, 0.74, 0.6]} />
          <meshStandardMaterial color="#2c3f5c" roughness={0.7} />
        </mesh>
        <mesh position={[0.2, 0.55, -2.9]}>
          <boxGeometry args={[0.9, 1.1, 0.6]} />
          <meshStandardMaterial color="#a02330" roughness={0.55} metalness={0.2} />
        </mesh>

        {/* Two lit windows high in the right-hand pier, over the forecourt. */}
        {[4.0, 5.3].map((x) => (
          <mesh key={x} position={[x, 2.3, SIDE.d / 2 + 0.16]}>
            <planeGeometry args={[0.9, 0.9]} />
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

      {/* The totem sign by the road: the artwork on the two faces only, the edges left
          as the white board they are, and lit from within as forecourt signs are. */}
      <group position={[-7.5, 0, Z + 9]}>
        <mesh position={[0, 2.7, 0]}>
          <boxGeometry args={[1.34, 4.4, 0.22]} />
          {[0, 1].map((i) => (
            <meshStandardMaterial key={i} attach={`material-${i}`} color="#e9e7e0" roughness={0.7} />
          ))}
          {[2, 3].map((i) => (
            <meshStandardMaterial key={i} attach={`material-${i}`} color="#d7d4cc" roughness={0.75} />
          ))}
          {[4, 5].map((i) => (
            <meshStandardMaterial
              key={i}
              attach={`material-${i}`}
              map={tex.totem}
              emissiveMap={tex.totem}
              emissive="#ffffff"
              emissiveIntensity={i === 4 ? 0.4 : 0.24}
              roughness={0.55}
            />
          ))}
        </mesh>
        {/* The plinth it stands on. */}
        <mesh position={[0, 0.28, 0]}>
          <boxGeometry args={[1.1, 0.56, 0.42]} />
          <meshStandardMaterial color="#5b5d62" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.58, 0]}>
          <boxGeometry args={[1.18, 0.08, 0.5]} />
          <meshStandardMaterial color="#6d6f74" roughness={0.85} />
        </mesh>
      </group>

      {/* The stone house joined on to the left of the garage, its windows lit. */}
      <group position={[-11.2, 0, Z - 1.2]}>
        <mesh position={[0, HOUSE.h / 2, 0]}>
          <boxGeometry args={[HOUSE.w, HOUSE.h, HOUSE.d]} />
          <meshStandardMaterial map={tex.house} roughness={1} />
        </mesh>
        {/* A slated roof: a slope each side reaching the eaves, a ridge along the top and
            a stone gable closing each end. */}
        {[-1, 1].map((sz) => (
          <mesh key={sz} position={[0, (HOUSE.h + HOUSE.ridge) / 2, (sz * HOUSE.d) / 4]} rotation={[sz * HOUSE_PITCH, 0, 0]}>
            <boxGeometry args={[HOUSE.w + 0.5, 0.16, HOUSE_SLOPE + 0.4]} />
            <meshStandardMaterial color="#23272e" roughness={0.75} />
          </mesh>
        ))}
        <mesh position={[0, HOUSE.ridge, 0]}>
          <boxGeometry args={[HOUSE.w + 0.6, 0.18, 0.36]} />
          <meshStandardMaterial color="#2c3038" roughness={0.8} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[(sx * HOUSE.w) / 2, 0, 0]} rotation={[0, (sx * Math.PI) / 2, 0]}>
            <shapeGeometry args={[houseGable]} />
            <meshStandardMaterial map={tex.house} roughness={1} side={2} />
          </mesh>
        ))}
        {/* The chimney, seated on the ridge with its pots. */}
        <mesh position={[-3.2, HOUSE.ridge + 0.55, 0]}>
          <boxGeometry args={[0.9, 1.9, 0.9]} />
          <meshStandardMaterial map={tex.house} roughness={1} />
        </mesh>
        <mesh position={[-3.2, HOUSE.ridge + 1.6, 0]}>
          <boxGeometry args={[1.02, 0.16, 1.02]} />
          <meshStandardMaterial color="#4a453e" roughness={0.95} />
        </mesh>
        {[-0.22, 0.22].map((o) => (
          <mesh key={o} position={[-3.2 + o, HOUSE.ridge + 1.88, 0]}>
            <cylinderGeometry args={[0.14, 0.16, 0.42, 8]} />
            <meshStandardMaterial color="#6b4b3a" roughness={1} />
          </mesh>
        ))}
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
