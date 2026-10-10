"use client";

import type { View } from "~/lib/view";

type Props = {
  value: View;
  /** False when the device cannot run the scene; the 3D side is then disabled. */
  canUse3d: boolean;
  onChange: (view: View) => void;
};

/** The 3D | Plain switch in the watch page's top bar. Two toggle buttons; the pressed one is the current view. */
export function ViewSwitch({ value, canUse3d, onChange }: Props) {
  return (
    <div role="group" aria-label="How to watch" className="view-switch">
      <button
        type="button"
        aria-pressed={value === "3d"}
        disabled={!canUse3d}
        title={canUse3d ? undefined : "3D needs WebGL 2, with reduced motion and data saver off"}
        onClick={() => onChange("3d")}
      >
        3D
      </button>
      <button type="button" aria-pressed={value === "plain"} onClick={() => onChange("plain")}>
        Plain
      </button>
    </div>
  );
}
