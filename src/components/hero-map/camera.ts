/** Camera in SVG user units: center + visible width. */
export type Camera = [cx: number, cy: number, w: number];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Camera that fits `box` into a `vw`×`vh` viewport, leaving `pad` (0–1) of breathing room. */
export function fitBox(box: Box, vw: number, vh: number, pad = 0.1): Camera {
  const unitsPerPx = Math.max(box.w / (vw * (1 - pad)), box.h / (vh * (1 - pad)));
  return [box.x + box.w / 2, box.y + box.h / 2, unitsPerPx * vw];
}

/**
 * Smooth zoom-and-pan between two cameras (van Wijk & Nuij, "Smooth and efficient zooming
 * and panning" — the same curve as d3.interpolateZoom). Feels like a flight, not a lerp.
 */
export function interpolateZoom(a: Camera, b: Camera, rho = 1.3): (t: number) => Camera {
  const [ux0, uy0, w0] = a;
  const [ux1, uy1, w1] = b;
  const dx = ux1 - ux0;
  const dy = uy1 - uy0;
  const d2 = dx * dx + dy * dy;
  const rho2 = rho * rho;
  const rho4 = rho2 * rho2;

  if (d2 < 1e-12) {
    const S = Math.log(w1 / w0) / rho;
    return (t) => [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S)];
  }
  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  return (t) => {
    const s = t * S;
    const coshr0 = Math.cosh(r0);
    const u = (w0 / (rho2 * d1)) * (coshr0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
    return [ux0 + u * dx, uy0 + u * dy, (w0 * coshr0) / Math.cosh(rho * s + r0)];
  };
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
