import { Matrix4 } from "three";
import type { Material, MeshPhysicalMaterial, MeshStandardMaterial, WebGLProgramParametersWithUniforms } from "three";

/**
 * A "sweep" is the act's process moving over the car: a plane along the car's length
 * behind which the work is done. The paint and the shells read it in the shader so the
 * change is local and visible (a wipe line), not a global fade. `sweep` is 0..1 from the
 * nose to the tail; `amount` is how strong the untreated state is.
 */
export type SweepUniforms = {
  uSweep: { value: number };
  uAmount: { value: number };
  uNose: { value: number };
  uTail: { value: number };
  uSoft: { value: number };
};

/**
 * The nose and tail sit a little beyond the bodywork so a sweep at 0 leaves the whole
 * car untreated and a sweep at 1 has covered all of it, ends included.
 */
export function sweepUniforms(nose = -2.9, tail = 2.9): SweepUniforms {
  return { uSweep: { value: 0 }, uAmount: { value: 0 }, uNose: { value: nose }, uTail: { value: tail }, uSoft: { value: 0.18 } };
}

/**
 * The inverse of the car root's world matrix, shared by every material on the car and
 * rewritten each frame. Everything below works in this "car space": the origin is on the
 * floor under the middle of the car, +y is up, +z runs to the tail. Patterns keyed to it
 * are painted onto the bodywork and stay there while the car drives, turns and lifts —
 * world space would slide them across the panels over the drive-in.
 */
export type CarSpace = { value: Matrix4 };
export function carSpace(): CarSpace {
  return { value: new Matrix4() };
}

const VERTEX_DECL = /* glsl */ `
  varying vec3 vJdCar;
  uniform mat4 uJdCarInv;
`;
const VERTEX_BODY = /* glsl */ `
  vJdCar = (uJdCarInv * modelMatrix * vec4(transformed, 1.0)).xyz;
`;

/** Cheap value noise in car space; enough for road film and buffing haze. */
const NOISE = /* glsl */ `
  varying vec3 vJdCar;
  float jdHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float jdNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(jdHash(i), jdHash(i + vec3(1, 0, 0)), f.x), mix(jdHash(i + vec3(0, 1, 0)), jdHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(jdHash(i + vec3(0, 0, 1)), jdHash(i + vec3(1, 0, 1)), f.x), mix(jdHash(i + vec3(0, 1, 1)), jdHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float jdFbm(vec3 p) {
    return jdNoise(p) * 0.68 + jdNoise(p * 2.9) * 0.32;
  }
`;

/** One sweep channel: its uniforms and the 0..1 "not yet treated" test, under a suffix. */
function channel(suffix: string) {
  return /* glsl */ `
  uniform float uSweep${suffix};
  uniform float uAmount${suffix};
  uniform float uNose${suffix};
  uniform float uTail${suffix};
  uniform float uSoft${suffix};
  /* 1 where the sweep has not yet passed, 0 where it has; soft at the line. */
  float jdUntreated${suffix}() {
    float line = mix(uNose${suffix}, uTail${suffix}, uSweep${suffix});
    float wave = sin(vJdCar.y * 9.0 + vJdCar.x * 5.0) * 0.06;
    return uAmount${suffix} * smoothstep(line - uSoft${suffix}, line + uSoft${suffix}, vJdCar.z + wave);
  }
`;
}

function inject(shader: WebGLProgramParametersWithUniforms, car: CarSpace, channels: [SweepUniforms, string][], extra = "") {
  shader.uniforms.uJdCarInv = car;
  for (const [uniforms, suffix] of channels) {
    for (const [key, value] of Object.entries(uniforms)) shader.uniforms[key + suffix] = value;
  }
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${VERTEX_DECL}`)
    .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${VERTEX_BODY}`);
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <common>",
    `#include <common>\n${NOISE}\n${extra}\n${channels.map(([, suffix]) => channel(suffix)).join("\n")}`,
  );
}

/**
 * Road film, brake dust and salt: patches rather than a wash, heaviest low down the
 * flanks and off the tail where the spray comes up. Returns 0..1.
 */
const GRIME = /* glsl */ `
  float jdGrime(vec3 p) {
    // Fine and broken up: road film is speckle and streaks, not continents, so the
    // coarse layer is only half of it and the fine one carries the edges.
    float n = jdFbm(p * 5.0);
    float fine = jdNoise(p * 13.0);
    // Low on the body and toward the tail: that is where the road throws it.
    float low = 1.0 - smoothstep(0.30, 0.95, p.y);
    float rear = smoothstep(0.6, 2.2, p.z);
    float blotch = smoothstep(0.50, 0.72, n * 0.62 + fine * 0.38);
    // Run-off streaks: stretched down the panel, so they read as weather rather than as
    // a pattern. Long in y, tight across x and z.
    float streak = smoothstep(0.48, 0.86, jdNoise(vec3(p.x * 11.0, p.y * 0.8, p.z * 11.0)));
    float film = 0.10 + 0.30 * low + 0.16 * rear;
    return clamp(film + blotch * 0.6 * (0.25 + 0.75 * low) + streak * 0.3 * low + fine * 0.14 * low, 0.0, 1.0);
  }
`;

/**
 * Swirls and scratches. Swirls are the fine circular haze a bad wash leaves, so they are
 * rings about a scattered lattice of centres; scratches are a few longer broken lines.
 * Both only show in the finish, which is why the inspection light in act 5 finds them.
 */
const MARKS = /* glsl */ `
  float jdSwirl(vec3 p) {
    vec3 q = p * 9.0;
    vec3 cell = floor(q);
    vec3 local = fract(q) - 0.5;
    float r = length(local);
    float rings = sin((r + jdHash(cell)) * 150.0);
    return smoothstep(0.86, 1.0, abs(rings)) * (1.0 - smoothstep(0.20, 0.48, r));
  }
  /**
   * One family of scratches: parallel nicks along dir, broken into runs. A fine core
   * with a soft scuff either side, because a bare hairline is under a pixel wide at any
   * sensible camera distance and averages straight out of the frame.
   */
  float jdScratchSet(vec3 p, vec3 dir, float freq, float seed, float warp) {
    float d = abs(fract(dot(p, dir) * freq + warp + seed) - 0.5);
    float core = 1.0 - smoothstep(0.0, 0.02, d);
    float halo = 1.0 - smoothstep(0.0, 0.09, d);
    float run = smoothstep(0.60, 0.72, jdNoise(p * vec3(5.0, 5.0, 1.4) + seed));
    return (core * 0.7 + halo * 0.3) * run;
  }
  float jdScratch(vec3 p) {
    // Warping them far turns the set into contour lines, which is what a wandering
    // scratch field reads as from any distance.
    float warp = jdFbm(p * 2.2) * 0.8;
    // Two families crossing at different pitches, so the marks do not comb into bands.
    return max(jdScratchSet(p, vec3(0.19, 0.0, 1.0), 7.0, 0.0, warp), jdScratchSet(p, vec3(1.0, 0.25, 0.45), 4.6, 11.3, warp));
  }
`;

/**
 * The paint carries two independent states, each lifted by its own sweep.
 *
 * `dull` is the condition of the finish: flat, low on flake, swirled and scratched. The
 * polisher takes it out in act 5. It stays blue throughout — a neglected car is a dull
 * blue car, not a grey one, so the colour survives and only the finish changes.
 *
 * `grime` is what is sitting on top: road film, brake dust, salt. The jet takes it off in
 * act 2, well before the polisher, so the wash actually reads as a wash.
 */
export function patchPaint(material: MeshPhysicalMaterial, car: CarSpace, dull: SweepUniforms, grime: SweepUniforms) {
  material.onBeforeCompile = (shader) => {
    inject(
      shader,
      car,
      [
        [dull, ""],
        [grime, "G"],
      ],
      `${GRIME}\n${MARKS}`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float jdDull = jdUntreated();
        float jdDirt = 0.0;
        float jdSw = 0.0;
        float jdSc = 0.0;
        if (uAmount > 0.0) {
          jdSw = jdSwirl(vJdCar) * jdDull;
          jdSc = jdScratch(vJdCar) * jdDull;
        }
        if (uAmountG > 0.0) jdDirt = jdGrime(vJdCar) * jdUntreatedG();
        {
          // Flatter and a shade darker, but still the same blue.
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          vec3 tired = mix(diffuseColor.rgb, vec3(lum), 0.16) * 0.9;
          diffuseColor.rgb = mix(diffuseColor.rgb, tired, jdDull);
          // The marks themselves: fine light haze where the clearcoat is cut.
          diffuseColor.rgb += (jdSw * 0.09 + jdSc * 0.40) * vec3(0.78, 0.83, 1.0);
          // Filth over the top, patchy, so the blue reads through between the patches.
          vec3 filth = mix(vec3(0.30, 0.27, 0.22), vec3(0.19, 0.15, 0.13), jdNoise(vJdCar * 5.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, filth, jdDirt * 0.7);
        }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.5, jdDull);
        roughnessFactor = mix(roughnessFactor, 0.85, jdDirt);
        roughnessFactor = clamp(roughnessFactor + jdSw * 0.24 + jdSc * 0.3, 0.0, 1.0);`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        // The flake is what carries the colour on clean paint; buried under haze and dirt
        // the panel turns dielectric, which is what keeps it blue instead of a black mirror.
        metalnessFactor = mix(metalnessFactor, 0.14, jdDull);
        metalnessFactor = mix(metalnessFactor, 0.05, jdDirt);`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
        material.clearcoat = mix(material.clearcoat, 0.45, jdDull);
        material.clearcoat = mix(material.clearcoat, 0.08, jdDirt);
        material.clearcoatRoughness = clamp(mix(material.clearcoatRoughness, 0.34, jdDull) + jdSw * 0.32 + jdSc * 0.36, 0.0, 1.0);
        material.specularF90 = mix(material.specularF90, 0.6, jdDull);`,
      );
  };
  material.customProgramCacheKey = () => "jd-paint";
  material.needsUpdate = true;
}

/**
 * The underside: grimy where untreated, bare where the jet has passed. Same idea on a
 * standard material.
 */
export function patchChassis(material: MeshStandardMaterial, car: CarSpace, uniforms: SweepUniforms) {
  material.onBeforeCompile = (shader) => {
    inject(shader, car, [[uniforms, ""]]);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float jdDirt = jdUntreated();
        {
          float n = jdNoise(vJdCar * 14.0);
          vec3 grime = vec3(0.16, 0.13, 0.09) * (0.7 + 0.5 * n);
          diffuseColor.rgb = mix(diffuseColor.rgb, grime, jdDirt);
        }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 1.0, jdDirt);`,
      );
  };
  material.customProgramCacheKey = () => "jd-chassis";
  material.needsUpdate = true;
}

/**
 * A shell over the paint: foam, or the milky haze of a coating before it is buffed.
 * Alpha is the untreated amount times a soft noise so the edge of the wipe breaks up.
 */
export function patchShell(material: MeshStandardMaterial, car: CarSpace, uniforms: SweepUniforms, kind: "foam" | "haze") {
  material.onBeforeCompile = (shader) => {
    inject(shader, car, [[uniforms, ""]]);
    shader.uniforms.uTime = { value: 0 };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <alphamap_fragment>",
        `#include <alphamap_fragment>
        {
          float u = jdUntreated();
          vec3 p = vJdCar * ${kind === "foam" ? "6.0" : "3.0"};
          float n = sin(p.x * 1.7 + p.y * 2.3 + uTime * 0.4) * sin(p.z * 2.1 - p.y * 1.3 + uTime * 0.3) * 0.5 + 0.5;
          ${
            kind === "foam"
              ? `// Foam sags: thicker up top, running into drips below.
                 float drip = smoothstep(0.2, 1.0, fract(vJdCar.x * 3.0 + vJdCar.z * 5.0 + n) ) * (1.0 - smoothstep(0.3, 1.1, vJdCar.y));
                 diffuseColor.a *= u * clamp(0.55 + 0.6 * n + 0.3 * drip, 0.0, 1.0);`
              : `diffuseColor.a *= u * (0.55 + 0.45 * n);`
          }
        }`,
      );
    (material.userData as { shader?: WebGLProgramParametersWithUniforms }).shader = shader;
  };
  material.customProgramCacheKey = () => `jd-shell-${kind}`;
  material.needsUpdate = true;
}

/** Advance a shell's time uniform once the program exists. */
export function tickShell(material: Material, dt: number) {
  const shader = (material.userData as { shader?: WebGLProgramParametersWithUniforms }).shader;
  if (shader?.uniforms.uTime) shader.uniforms.uTime.value = (shader.uniforms.uTime.value as number) + dt;
}
