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

import { Bay } from "./bay/bay";
import { CameraRig } from "./camera-rig";
import { Effects } from "./effects";
import { ScrollDriver, scrollToProgress } from "./scroll-driver";

/**
 * The one persistent canvas. Mounted in the root layout, it never unmounts on
 * navigation; each route sets a scene mode and the camera moves. The bay is the only
 * world, so it stays mounted; "off" routes stop the frame loop and fade it out. Under
 * reduced motion or without WebGL2 it renders nothing and the DOM stands alone.
 */
export function SceneCanvas() {
  const pathname = usePathname();
  const setMode = useScene((s) => s.setMode);
  const setActive = useScene((s) => s.setActive);
  const mode = useScene((s) => s.mode);
  const [support, setSupport] = useState<ReturnType<typeof detectSceneSupport> | null>(null);
  const [dpr, setDpr] = useState(1.5);

  useEffect(() => {
    const s = detectSceneSupport();
    setSupport(s);
    setActive(s.ok);
  }, [setActive]);

  useEffect(() => setMode(modeForPath(pathname)), [pathname, setMode]);

  if (!support?.ok) return null;

  const mobile = support.coarsePointer;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-0 transition-opacity duration-700 ease-out",
        mode === "off" && "opacity-0",
        mode === "void" && "opacity-40",
        mode === "alcove" && "opacity-70",
      )}
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
        frameloop={mode === "off" ? "never" : "always"}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", () => setActive(false));
        }}
      >
        {process.env.NODE_ENV !== "production" ? <StatsProbe /> : null}
        <PerformanceMonitor
          bounds={() => [40, 58]}
          onIncline={() => setDpr((d) => Math.min(mobile ? 1.5 : 2, d + 0.25))}
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
