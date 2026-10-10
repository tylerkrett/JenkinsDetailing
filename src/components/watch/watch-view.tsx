"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { LoadCover } from "~/components/scene/load-cover";
import type { ProcessStep } from "~/lib/content";
import { prefetchCar } from "~/lib/scene/assets";
import { detectSceneSupport } from "~/lib/scene/capabilities";
import { VIEW_COOKIE, VIEW_MAX_AGE, type View } from "~/lib/view";

import { ViewSwitch } from "./view-switch";

// three, fiber and the bay only download when the 3D view is actually shown. The cover
// stays up while they do, so a visitor never sees the plain page flash past.
const Experience = dynamic(() => import("./watch-experience").then((m) => m.WatchExperience), {
  ssr: false,
  loading: () => <LoadCover />,
});

type Props = {
  /** The visitor's saved choice, from the jd-view cookie or a ?view= link. */
  saved?: View;
  /** The request asked to save data. */
  saveData: boolean;
  steps: ProcessStep[];
  headline: string;
  /** The plain version, the steps as a page. Server-rendered for everyone. */
  plain: ReactNode;
  /** What follows the reveal in the 3D version. */
  children: ReactNode;
};

/**
 * The watch page: the 3D bay or the plain steps. A saved choice wins; with none, the
 * scene runs wherever it can (WebGL2, motion allowed, no data saver) and everyone else
 * gets the plain page. Using the switch keeps the choice in a cookie for a year, so the
 * server renders the right version on the next visit.
 */
export function WatchView({ saved, saveData, steps, headline, plain, children }: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [choice, setChoice] = useState<View>(saved ?? "3d");
  const switched = useRef(false);

  useEffect(() => {
    const check = () => setSupported(!saveData && detectSceneSupport().ok);
    check();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    motion.addEventListener("change", check);
    return () => motion.removeEventListener("change", check);
  }, [saveData]);

  const immersive = supported === true && choice === "3d";

  // The 3D code and the car download side by side, not one after the other.
  useEffect(() => {
    if (immersive) prefetchCar(window.matchMedia("(pointer: coarse)").matches);
  }, [immersive]);

  // A step linked from the home page (?act=3) opens at that step. The scene handles it
  // in 3D; here it is the plain page's anchor.
  useEffect(() => {
    if (supported === null || immersive) return;
    const step = steps[Number(new URLSearchParams(window.location.search).get("act")) - 1];
    if (step) document.getElementById(step.slug)?.scrollIntoView();
  }, [supported, immersive, steps]);

  // A switch always starts the new view from the top.
  useEffect(() => {
    if (!switched.current) return;
    switched.current = false;
    window.scrollTo(0, 0);
  }, [choice]);

  function select(view: View) {
    if (view === (immersive ? "3d" : "plain")) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${VIEW_COOKIE}=${view}; Path=/; Max-Age=${VIEW_MAX_AGE}; SameSite=Lax${secure}`;
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    url.searchParams.delete("act");
    window.history.replaceState(null, "", url);
    switched.current = true;
    setChoice(view);
  }

  return (
    <>
      <div className="watch-toolbar">
        <p className="watch-status" aria-live="polite">
          {supported === false ? "3D is not available on this device" : "Inside the detailing bay"}
        </p>
        <ViewSwitch value={immersive ? "3d" : "plain"} canUse3d={supported === true} onChange={select} />
      </div>
      {immersive ? (
        <Experience steps={steps} headline={headline} fallback={plain}>
          {children}
        </Experience>
      ) : (
        <>
          {supported === null && choice === "3d" ? <LoadCover /> : null}
          {plain}
          {supported && choice === "plain" ? (
            <div className="site-container -mt-8 pb-20">
              <button type="button" onClick={() => select("3d")} className="button-outline">
                Try it in 3D
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
