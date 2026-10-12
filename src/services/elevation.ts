
export function elevationGain(points: { alt?: number }[]): number {
  let gain = 0;
  let prev: number | undefined;
  for (const p of points) {
    if (p.alt == null) continue;
    if (prev == null) {
      prev = p.alt;
      continue;
    }
    const d = p.alt - prev;
    if (Math.abs(d) >= 2) {
      if (d > 0) gain += d;
      prev = p.alt;
    }
  }
  return gain;
}