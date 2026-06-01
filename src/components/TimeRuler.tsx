import type { Timeline } from "../model/timeline";
import { dayToX } from "../render/scale";

interface Props {
  timeline: Timeline;
  minDay: number;
  maxDay: number;
  offsetX: number;
  y: number; // top y of the ruler band
  height: number; // ruler band height
}

/**
 * Compute a "nice" tick interval given pixels-per-day so labels don't collide.
 * Targets roughly 60px between major ticks.
 */
function computeTickInterval(pxPerDay: number): { major: number; minor: number } {
  const targetPx = 60;
  const targetDays = targetPx / pxPerDay;
  // round to nearest "nice" number
  const niceMajors = [1, 2, 5, 10, 15, 30, 60, 90, 180, 365];
  let major = niceMajors[niceMajors.length - 1];
  for (const n of niceMajors) {
    if (n >= targetDays) {
      major = n;
      break;
    }
  }
  const minor = major >= 10 ? Math.max(1, Math.round(major / 5)) : 1;
  return { major, minor };
}

/**
 * Format a tick label. In "duration" mode it's the day number; in "date" mode
 * it's a short date string (only the day-month part to save space).
 */
function formatTick(day: number, timeline: Timeline): string {
  if (timeline.mode === "date" && timeline.origin) {
    const ms = new Date(timeline.origin + "T00:00:00Z").getTime() + day * 86400000;
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  return String(day);
}

export function TimeRuler({ timeline, minDay, maxDay, offsetX, y, height }: Props) {
  const { major, minor } = computeTickInterval(timeline.pxPerDay);

  // Snap range to nice boundaries
  const firstMajor = Math.ceil(minDay / major) * major;
  const ticks: { day: number; isMajor: boolean }[] = [];
  for (let d = Math.ceil(minDay / minor) * minor; d <= maxDay; d += minor) {
    ticks.push({ day: d, isMajor: (d - firstMajor) % major === 0 });
  }

  const baselineY = y + height - 1;
  return (
    <g className="time-ruler">
      <rect
        x={offsetX}
        y={y}
        width={dayToX(maxDay - minDay, timeline)}
        height={height}
        fill="var(--svg-surface)"
        stroke="var(--svg-border)"
      />
      {/* Tick marks */}
      {ticks.map((t) => {
        const x = offsetX + dayToX(t.day - minDay, timeline);
        const tickH = t.isMajor ? 10 : 5;
        return (
          <g key={t.day}>
            <line
              x1={x}
              x2={x}
              y1={baselineY}
              y2={baselineY - tickH}
              stroke={t.isMajor ? "var(--svg-tick-major)" : "var(--svg-tick-minor)"}
              strokeWidth={1}
            />
            {t.isMajor && (
              <text
                x={x}
                y={y + 14}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill="var(--svg-text-faint)"
                style={{ userSelect: "none" }}
              >
                {formatTick(t.day, timeline)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
