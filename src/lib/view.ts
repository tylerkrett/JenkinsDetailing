export type View = "plain" | "3d";
export const VIEW_COOKIE = "jd-view";
export const VIEW_MAX_AGE = 60 * 60 * 24 * 365;
export function parseView(value: string | undefined | null): View | undefined {
  return value === "plain" || value === "3d" ? value : undefined;
}
