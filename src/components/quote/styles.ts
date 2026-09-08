/**
 * The one primary button on the site. Accent ground, ink text, a slightly lighter accent on
 * hover and a 0.97 press. Only transform and colours transition.
 */
export const primaryButtonClass =
  "inline-flex items-center justify-center bg-accent px-5 py-3 font-medium text-ink transition-[transform,background-color,color] duration-200 ease-out-quint hover:bg-[color-mix(in_oklab,var(--color-accent)_85%,var(--color-accent-lit))] active:scale-[0.97] disabled:cursor-default disabled:active:scale-100";

/** Quiet secondary action: text plus an underline that arrives on hover. */
export const secondaryButtonClass =
  "inline-flex items-center justify-center px-1 py-2 text-bone/80 underline-offset-[6px] decoration-accent/0 transition-colors duration-200 hover:text-bone hover:underline hover:decoration-accent";

export const inputClass =
  "hairline block w-full border bg-transparent px-3.5 py-3 text-bone placeholder:text-bone/40 transition-colors duration-200 focus:border-accent aria-[invalid=true]:border-accent/60";

export const labelClass = "mb-2 block text-sm text-bone/70";
