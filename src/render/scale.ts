import type { Timeline, TimePoint } from "../model/timeline";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Convert an ISO date string into a JS Date (UTC midnight). */
function parseIsoDate(iso: string): Date {
  // Accept YYYY-MM-DD or full ISO; treat date-only as UTC.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00Z") : new Date(iso);
  return d;
}

/** Convert a TimePoint into a numeric day offset relative to the timeline origin. */
export function toDay(value: TimePoint, timeline: Timeline): number {
  if (typeof value === "number") return value;
  if (timeline.mode === "date" && timeline.origin) {
    const a = parseIsoDate(timeline.origin).getTime();
    const b = parseIsoDate(value).getTime();
    return (b - a) / MS_PER_DAY;
  }
  // If string given but no origin, try to parse as number
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Convert a day offset back into a TimePoint for storage (preserves mode). */
export function fromDay(day: number, timeline: Timeline): TimePoint {
  if (timeline.mode === "date" && timeline.origin) {
    const a = parseIsoDate(timeline.origin).getTime();
    const d = new Date(a + Math.round(day) * MS_PER_DAY);
    return d.toISOString().slice(0, 10);
  }
  // Duration mode: snap to quarter-day granularity.
  return Math.round(day * 4) / 4;
}

export function dayToX(day: number, timeline: Timeline): number {
  return day * timeline.pxPerDay;
}

export function xToDay(x: number, timeline: Timeline): number {
  return x / timeline.pxPerDay;
}

/** Compute the [minDay, maxDay] span of a timeline. */
export function timelineSpan(timeline: Timeline): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;

  for (const row of timeline.rows) {
    for (const group of row.groups) {
      // Skip groups with no blocks — they're invisible but would otherwise
      // stretch the ruler. Groups are an internal grouping concept; only
      // actual blocks should drive the visible span.
      if (group.blocks.length === 0) continue;
      const s = toDay(group.start, timeline);
      const e = toDay(group.end, timeline);
      if (s < min) min = s;
      if (e > max) max = e;
    }
  }
  for (const g of timeline.guides) {
    const d = toDay(g.at, timeline);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  for (const b of timeline.brackets) {
    if (b.anchor.kind === "range") {
      const from = toDay(b.anchor.from, timeline);
      const to = toDay(b.anchor.to, timeline);
      if (from < min) min = from;
      if (to > max) max = to;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 100 };
  }
  return { min, max };
}

/** Find a block's parent group across all rows. */
export function findBlockGroup(
  timeline: Timeline,
  blockId: string,
): { row: Timeline["rows"][number]; group: Timeline["rows"][number]["groups"][number] } | null {
  for (const row of timeline.rows) {
    for (const group of row.groups) {
      if (group.blocks.some((b) => b.id === blockId)) return { row, group };
    }
  }
  return null;
}
