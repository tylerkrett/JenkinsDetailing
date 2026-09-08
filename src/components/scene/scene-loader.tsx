"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { detectSceneSupport } from "~/lib/scene/capabilities";

// three, fiber, drei and the post stack only download once WebGL2 is confirmed and
// motion is allowed; everyone else gets the DOM site with none of that JavaScript.
const SceneCanvas = dynamic(() => import("./scene-canvas").then((m) => m.SceneCanvas), {
  ssr: false,
});

export function SceneLoader() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(detectSceneSupport().ok), []);
  if (!ok) return null;
  return <SceneCanvas />;
}
