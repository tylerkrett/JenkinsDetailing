import type { Material, MeshPhysicalMaterial, MeshStandardMaterial, WebGLProgramParametersWithUniforms } from "three";

/**
 * A "sweep" is the act's process moving over the car: a plane along the car's length
 * behind which the work is done. The paint and the shells read it in the shader so the
 * change is local and visible (a wipe line), not a global fade. `sweep` is 0..1 from the
 * nose to the tail in world z; `amount` is how strong the untreated state is.
 */
export type SweepUniforms = {
  uSweep: { value: number };
  uAmount: { value: number };
  uNose: { value: number };
  uTail: { value: number };
  uSoft: { value: number };
};

export function sweepUniforms(nose = -2.35, tail = 2.35): SweepUniforms {
  return { uSweep: { value: 0 }, uAmount: { value: 0 }, uNose: { value: nose }, uTail: { value: tail }, uSoft: { value: 0.18 } };
}

const VERTEX_DECL = /* glsl */ `
  varying vec3 vJdWorld;
`;
const VERTEX_BODY = /* glsl */ `
  vJdWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;
const FRAGMENT_DECL = /* glsl */ `
  varying vec3 vJdWorld;
  uniform float uSweep;
  uniform float uAmount;
  uniform float uNose;
  uniform float uTail;
  uniform float uSoft;
  /* 1 where the sweep has not yet passed, 0 where it has; soft at the line. */
  float jdUntreated() {
    float line = mix(uNose, uTail, uSweep);
    float wave = sin(vJdWorld.y * 9.0 + vJdWorld.x * 5.0) * 0.06;
    return uAmount * smoothstep(line - uSoft, line + uSoft, vJdWorld.z + wave);
  }
`;

function inject(shader: WebGLProgramParametersWithUniforms, uniforms: SweepUniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${VERTEX_DECL}`)
    .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${VERTEX_BODY}`);
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${FRAGMENT_DECL}`);
}

/**
 * Paint that is dull and faded where the sweep has not passed: desaturated and darker,
 * rough, no clearcoat. Where the polisher has been it is the material as authored.
 */
export function patchPaint(material: MeshPhysicalMaterial, uniforms: SweepUniforms) {
  material.onBeforeCompile = (shader) => {
    inject(shader, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float jdDull = jdUntreated();
        {
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          vec3 faded = mix(diffuseColor.rgb, vec3(lum), 0.7) * 0.55 + vec3(0.06, 0.06, 0.05);
          diffuseColor.rgb = mix(diffuseColor.rgb, faded, jdDull);
        }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.82, jdDull);`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
        material.clearcoat *= (1.0 - jdDull);
        material.specularF90 = mix(material.specularF90, 0.4, jdDull);`,
      );
  };
  material.customProgramCacheKey = () => "jd-paint";
  material.needsUpdate = true;
}

/**
 * The underside: grimy where untreated, bare where the jet has passed. Same idea on a
 * standard material.
 */
export function patchChassis(material: MeshStandardMaterial, uniforms: SweepUniforms) {
  material.onBeforeCompile = (shader) => {
    inject(shader, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float jdDirt = jdUntreated();
        {
          float n = fract(sin(dot(floor(vJdWorld.xz * 14.0), vec2(12.9898, 78.233))) * 43758.5453);
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
export function patchShell(material: MeshStandardMaterial, uniforms: SweepUniforms, kind: "foam" | "haze") {
  material.onBeforeCompile = (shader) => {
    inject(shader, uniforms);
    shader.uniforms.uTime = { value: 0 };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <alphamap_fragment>",
        `#include <alphamap_fragment>
        {
          float u = jdUntreated();
          vec3 p = vJdWorld * ${kind === "foam" ? "6.0" : "3.0"};
          float n = sin(p.x * 1.7 + p.y * 2.3 + uTime * 0.4) * sin(p.z * 2.1 - p.y * 1.3 + uTime * 0.3) * 0.5 + 0.5;
          ${
            kind === "foam"
              ? `// Foam sags: thicker up top, running into drips below.
                 float drip = smoothstep(0.2, 1.0, fract(vJdWorld.x * 3.0 + vJdWorld.z * 5.0 + n) ) * (1.0 - smoothstep(0.3, 1.1, vJdWorld.y));
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
