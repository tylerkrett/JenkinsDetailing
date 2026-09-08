/**
 * Per-frame post-processing nudges a world can make without owning the composer: the
 * street raises grain and closes the vignette under the railway arches. Plain mutable
 * numbers read inside the effects' useFrame, never subscribed to. A world writes them
 * each frame while mounted and zeroes them on unmount, so the corridor is untouched.
 */
export const fx = {
  grainBoost: 0,
  vignetteBoost: 0,
};

export function resetFx() {
  fx.grainBoost = 0;
  fx.vignetteBoost = 0;
}
