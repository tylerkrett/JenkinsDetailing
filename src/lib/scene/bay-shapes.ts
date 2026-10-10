import { Shape } from "three";

/**
 * Flat geometry shared by the buildings around the garage. Kept out of the components
 * so the forecourt and the exterior can both use it without importing each other.
 */

/**
 * The gable above a wall: a triangle from the eaves at each side up to the ridge in the
 * middle, in the x-y plane. Rotate it about y to close the end of a roof running in z.
 */
export function gableShape(halfW: number, eaves: number, ridge: number) {
  const s = new Shape();
  s.moveTo(-halfW, eaves - 0.02);
  s.lineTo(halfW, eaves - 0.02);
  s.lineTo(0, ridge);
  s.closePath();
  return s;
}
