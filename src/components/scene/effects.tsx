"use client";

import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useFrame } from "@react-three/fiber";
import {
  BlendFunction,
  type ChromaticAberrationEffect,
  type NoiseEffect,
  type VignetteEffect,
} from "postprocessing";
import { useRef } from "react";
import { Vector2 } from "three";

import { damp } from "~/lib/motion";
import { fx } from "~/lib/scene/fx";
import { useScene } from "~/lib/scene/store";

type Props = { bloom: boolean };

/** Rest values; everything below scales up with damped scroll velocity. */
const ABERRATION_REST = 0.0;
const GRAIN_REST = 0.02;
const VIGNETTE_REST = 0.72;
/** The bay is a touch grainier and closes in a little: a workshop at night, not a white cube. */
const BAY_GRAIN_REST = 0.03;
const BAY_VIGNETTE_REST = 0.75;

/**
 * Bloom thresholds at 1.0 so only HDR sources (the neon sign, the light bar, foam
 * highlights and water glints) glow; the paint itself tops out at 1.0 and is never
 * bloomed on its own. Aberration, grain and
 * the vignette's darkness all follow scroll speed and settle to almost nothing at rest.
 */
export function Effects({ bloom }: Props) {
  const aberration = useRef<ChromaticAberrationEffect>(null);
  const noise = useRef<NoiseEffect>(null);
  const vignette = useRef<VignetteEffect>(null);
  const offset = useRef(new Vector2(ABERRATION_REST, ABERRATION_REST));
  const speed = useRef(0);

  useFrame((_, dt) => {
    const { velocity, mode } = useScene.getState();
    const v = (speed.current = damp(speed.current, velocity, 6, dt));
    const bay = mode === "bay";
    const ab = ABERRATION_REST + v * 0.004;
    offset.current.set(ab, ab);
    if (aberration.current) aberration.current.offset.copy(offset.current);
    if (noise.current)
      noise.current.blendMode.opacity.value =
        (bay ? BAY_GRAIN_REST : GRAIN_REST) + fx.grainBoost + v * 0.06;
    if (vignette.current)
      vignette.current.darkness =
        (bay ? BAY_VIGNETTE_REST : VIGNETTE_REST) + fx.vignetteBoost + v * 0.12;
  });

  return (
    <EffectComposer multisampling={0}>
      {bloom ? (
        <Bloom luminanceThreshold={1} luminanceSmoothing={0.1} intensity={0.9} mipmapBlur />
      ) : (
        <></>
      )}
      <ChromaticAberration
        ref={aberration}
        blendFunction={BlendFunction.NORMAL}
        offset={offset.current}
        radialModulation
        modulationOffset={0.4}
      />
      <Noise ref={noise} premultiply opacity={GRAIN_REST} blendFunction={BlendFunction.SOFT_LIGHT} />
      <Vignette ref={vignette} eskil={false} offset={0.25} darkness={VIGNETTE_REST} />
    </EffectComposer>
  );
}
