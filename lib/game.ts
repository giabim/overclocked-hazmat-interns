export const WORLD = { width: 960, height: 600, radius: 19, speed: 220, margin: 32 };
export const COLORS = ["#e8fa79", "#91ddfa", "#f7a8c6", "#bda4fa", "#fea779", "#85e3b3", "#f2d39b", "#c6d5f2"];
export const ONLINE_MS = 30000;
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function direction(x: unknown, y: unknown) {
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}
export function normalizeName(value: unknown) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 18) : "";
}
