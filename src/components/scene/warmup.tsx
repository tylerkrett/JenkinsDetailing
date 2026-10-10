"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { HalfFloatType, type Material, type Mesh, type Texture, WebGLRenderTarget } from "three";

import { useScene } from "~/lib/scene/store";
import { markWarm } from "~/lib/scene/warm";

/** Longest the warm-up may take before the scene starts drawing and the preloader lifts anyway. */
const FALLBACK_MS = 8000;

/**
 * Mounts with the car, once everything the bay draws exists, and readies it all before the
 * preloader lifts: every texture uploaded and every shader compiled, including the spray,
 * foam and coating that stay hidden until their act. Without it each act compiled its own
 * the moment it came into view, and the scroll stalled for a fifth of a second each time.
 *
 * The canvas does not draw until this is done (see SceneCanvas), so the compile runs in
 * parallel off the main thread where the browser allows it and no frame waits on it.
 * Then two frames are drawn, which builds the post-processing chain's own shaders, and
 * only then does the preloader get the all-clear.
 */
export function Warmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const setCompiled = useScene((s) => s.setCompiled);

  useEffect(() => {
    let done = false;
    let frame = 0;
    const finish = () => {
      if (done) return;
      done = true;
      setCompiled(true);
      // Two frames: the first draws through the post-processing chain and compiles it.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(markWarm);
      });
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

    // The scene is drawn through the post-processing chain, into an off-screen buffer in
    // linear colour, so its shaders are built for that buffer, not the screen. A shader
    // compiled for the screen would be a different program, compiled again on first use.
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(target);
    const compiled = gl.compileAsync(scene, camera);
    gl.setRenderTarget(previous);
    target.dispose();
    compiled.then(finish, finish);

    const fallback = window.setTimeout(finish, FALLBACK_MS);
    return () => {
      window.clearTimeout(fallback);
      cancelAnimationFrame(frame);
    };
  }, [gl, scene, camera, setCompiled]);

  return null;
}
