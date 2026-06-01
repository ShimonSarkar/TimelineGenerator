/**
 * Generate an SVG path for a horizontal curly bracket.
 *
 * @param x1 left x
 * @param x2 right x
 * @param y baseline y (the line at the open end)
 * @param depth how far the bracket extends away from the baseline (positive = upward for top bracket if y is bottom, etc.)
 * @param tickDepth the small inward bend at the ends (usually < depth)
 *
 * The bracket consists of two end-ticks pointing inward and a central peak pointing outward.
 */
export function curlyBracketPath(x1: number, x2: number, y: number, depth: number): string {
  const mid = (x1 + x2) / 2;
  const peakY = y - depth; // depth > 0 → peak above baseline; depth < 0 → peak below
  // Tick depth must match the sign of `depth` so bottom brackets bend downward like top ones bend upward.
  const tickDepth = Math.sign(depth) * Math.min(8, Math.abs(depth) / 2);
  const tickY = y - tickDepth;
  const r = 6; // corner radius for smoothing

  // Path: start at left baseline, curve up to tick, line across to near mid, curve up to peak, back down, line across to right tick, curve to right baseline.
  // Simpler: use cubic beziers for the two halves.
  return [
    `M ${x1} ${y}`,
    `Q ${x1} ${tickY} ${x1 + r} ${tickY}`,
    `L ${mid - r} ${tickY}`,
    `Q ${mid} ${tickY} ${mid} ${peakY}`,
    `Q ${mid} ${tickY} ${mid + r} ${tickY}`,
    `L ${x2 - r} ${tickY}`,
    `Q ${x2} ${tickY} ${x2} ${y}`,
  ].join(" ");
}
