"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { Material, Mesh, Texture } from "three";

import { markWarm } from "~/lib/scene/warm";

/** Longest the preloader will wait on the compile before it gives up and lifts anyway. */
const FALLBACK_MS = 8000;

/**
 * Mounts with the car, once everything the bay draws exists, and readies it all before the
 * preloader lifts: every texture uploaded, every shader compiled, including the tools,
 * spray and foam that stay hidden until their act. Without this each act compiled its own
 * the moment it came into view, and the scroll stalled for a fifth of a second each time.
 * The compile runs in parallel off the main thread where the browser allows it.
 */
export function Warmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      markWarm();
    };
    const textures = new Set<Texture>();
    scene.traverse((object) => {
      const material = (object as Mesh).material as Material | Material[] | undefined;
      if (!material) return;
      for (const m of Array.isArray(material) ? material : [material]) {
        for (const value of Object.values(m)) {
          const t = value as Texture | null;
          if (t?.isTexture && !t.isRenderTargetTexture && t.image) textures.add(t);
        }
      }
    });
    for (const t of textures) gl.initTexture(t);
    gl.compileAsync(scene, camera).then(finish, finish);
    const fallback = window.setTimeout(finish, FALLBACK_MS);
    return () => window.clearTimeout(fallback);
  }, [gl, scene, camera]);

  return null;
}
