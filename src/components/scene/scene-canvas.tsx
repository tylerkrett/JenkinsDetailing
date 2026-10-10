"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NoToneMapping, SRGBColorSpace } from "three";

import { cn } from "~/lib/cn";
import { detectSceneSupport } from "~/lib/scene/capabilities";
import { current } from "~/lib/scene/enter";
import { modeForPath } from "~/lib/scene/mode";
import { useScene } from "~/lib/scene/store";
import { resetWarm } from "~/lib/scene/warm";

import { Bay } from "./bay/bay";
import { CameraRig } from "./camera-rig";
import { Effects } from "./effects";
import { ScrollDriver, scrollToProgress } from "./scroll-driver";

/** Highest render resolution, in device pixels per CSS pixel. Past it the post effects cost more than they show. */
const MAX_DPR = { desktop: 1.5, mobile: 1.25 } as const;
/** How long the canvas waits on the warm-up before drawing regardless. */
const WARMUP_FALLBACK_MS = 15000;

/**
 * The scene's canvas. It mounts with the 3D view of /watch and unmounts when the visitor
 * switches to the plain view or leaves, resetting the shared scene state so the next
 * mount starts clean. Under reduced motion or without WebGL2 it renders nothing.
 */
export function SceneCanvas() {
  const pathname = usePathname();
  const setMode = useScene((s) => s.setMode);
  const setActive = useScene((s) => s.setActive);
  const mode = useScene((s) => s.mode);
  const compiled = useScene((s) => s.compiled);
  const [support, setSupport] = useState<ReturnType<typeof detectSceneSupport> | null>(null);
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    const s = detectSceneSupport();
    // A fresh warm-up for this mount; the preloader waits on it.
    resetWarm();
    setSupport(s);
    setDpr(Math.min(window.devicePixelRatio || 1, s.coarsePointer ? MAX_DPR.mobile : MAX_DPR.desktop));
    setActive(s.ok);
    // Should the warm-up never report (the car failing to load), draw anyway.
    const fallback = window.setTimeout(() => useScene.getState().setCompiled(true), WARMUP_FALLBACK_MS);
    return () => {
      window.clearTimeout(fallback);
      resetWarm();
      useScene.setState({ active: false, ready: false, compiled: false, world: null, progress: 0, entering: false });
    };
  }, [setActive]);

  useEffect(() => setMode(modeForPath(pathname)), [pathname, setMode]);

  if (!support?.ok) return null;

  const mobile = support.coarsePointer;
  const maxDpr = Math.min(window.devicePixelRatio || 1, mobile ? MAX_DPR.mobile : MAX_DPR.desktop);

  return (
    <div
      aria-hidden="true"
      className={cn("fixed inset-0 z-0 transition-opacity duration-700 ease-out", mode === "off" && "opacity-0")}
    >
      <Canvas
        dpr={dpr}
        camera={{ fov: 50, near: 0.1, far: 260, position: [7, 1.6, 17] }}
        gl={{
          antialias: false,
          powerPreference: "high-performance",
          toneMapping: NoToneMapping,
          outputColorSpace: SRGBColorSpace,
        }}
        // Nothing draws until the shaders are compiled: a frame drawn mid-compile waits for it.
        frameloop={mode === "off" || !compiled ? "never" : "always"}
        onCreated={({ gl }) => {
          // The error check reads every program's log back synchronously, a stall per shader;
          // the shaders are fixed, so production skips it.
          gl.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
          gl.domElement.addEventListener("webglcontextlost", () => setActive(false));
        }}
      >
        {process.env.NODE_ENV !== "production" ? <StatsProbe /> : null}
        {/* Only a scene that is really struggling steps down. A browser that holds every page
            to 30 fps (Chrome's energy saver, low power mode) must not read as one, or the bay
            renders blurred for no gain. */}
        <PerformanceMonitor
          bounds={() => [24, 50]}
          onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.25))}
          onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))}
        />
        <ScrollDriver />
        <CameraRig />
        <Bay mobile={mobile} />
        <Effects bloom={!mobile} />
      </Canvas>
    </div>
  );
}

/**
 * Dev only. The post stack ends every frame with one full-screen quad, so a snapshot of
 * renderer.info after render sees a single call; accumulate across frames instead and
 * let scripts/perf-check.mjs read per-frame averages.
 */
function StatsProbe() {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  useEffect(() => {
    gl.info.autoReset = false;
    const w = window as unknown as { __jd?: unknown; __jdGo?: (i: number) => void };
    // Screenshot tooling: jump straight to an act's hold, as the index does.
    w.__jdGo = (i: number) => {
      const world = useScene.getState().world;
      if (world) scrollToProgress(world.holdProgress(i), 0.3);
    };
    w.__jd = {
      scene: () => {
        const { progress, velocity, station, stationCount, mode, ready, active, entering } = useScene.getState();
        return {
          progress,
          velocity,
          station,
          stationCount,
          mode,
          ready,
          active,
          entering,
          current: { index: current.index, seated: current.seated, hasHit: Boolean(current.hit) },
        };
      },
      stats: () => {
        const n = Math.max(1, frames.current);
        const out = {
          calls: Math.round(gl.info.render.calls / n),
          triangles: Math.round(gl.info.render.triangles / n),
          textures: gl.info.memory.textures,
          geometries: gl.info.memory.geometries,
          // Shader programs compiled so far: should not grow once the preloader has lifted.
          programs: gl.info.programs?.length ?? 0,
          frames: frames.current,
        };
        gl.info.reset();
        frames.current = 0;
        return out;
      },
    };
    return () => {
      gl.info.autoReset = true;
      delete w.__jd;
      delete w.__jdGo;
    };
  }, [gl]);
  useFrame(() => {
    frames.current += 1;
  });
  return null;
}
