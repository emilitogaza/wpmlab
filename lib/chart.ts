// Scale and geometry helpers shared by the results chart and the race chart.

export function niceCeiling(value: number) {
  const step = value > 200 ? 50 : value > 100 ? 25 : 10;
  return Math.ceil(value / step) * step;
}

export function yTicks(max: number, count = 4) {
  return Array.from({ length: count + 1 }, (_, i) => Math.round((max / count) * i));
}

export function xTicks(last: number, target = 8) {
  const step = Math.max(1, Math.round(last / target));
  const ticks: number[] = [];
  for (let s = 1; s <= last; s += step) ticks.push(s);
  return ticks;
}

// monotone cubic (Fritsch-Carlson) so the smoothed curve never overshoots
// below zero or above a local peak
export function smoothPath(points: [number, number][]) {
  if (points.length === 0) return "";
  if (points.length < 3) return points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px} ${py}`).join("");

  const n = points.length;
  const dx: number[] = [];
  const slopes: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1][0] - points[i][0]);
    slopes.push((points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0]));
  }

  const tangents = [slopes[0]];
  for (let i = 1; i < n - 1; i++) {
    // flatten tangents at local extrema
    tangents.push(slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2);
  }
  tangents.push(slopes[n - 2]);

  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i] / 3;
    d += `C${points[i][0] + third} ${points[i][1] + tangents[i] * third} ${points[i + 1][0] - third} ${
      points[i + 1][1] - tangents[i + 1] * third
    } ${points[i + 1][0]} ${points[i + 1][1]}`;
  }
  return d;
}
