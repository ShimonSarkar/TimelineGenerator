import type { Bracket, Timeline } from "../model/timeline";
import { dayToX, toDay, findBlockGroup } from "../render/scale";
import { curlyBracketPath } from "../render/bracket";
import { useTimelineStore } from "../state/store";

interface Props {
  bracket: Bracket;
  timeline: Timeline;
  baselineY: number; // the y value where the bracket "opens" (closest to chart)
  side: "top" | "bottom";
  offsetX: number;
  minDay: number;
}

/** Resolve a bracket's [xLeft, xRight] in chart coordinates, or null if not resolvable. */
function resolveBracketRange(bracket: Bracket, timeline: Timeline): { from: number; to: number } | null {
  if (bracket.anchor.kind === "range") {
    return {
      from: toDay(bracket.anchor.from, timeline),
      to: toDay(bracket.anchor.to, timeline),
    };
  }
  const a = findBlockGroup(timeline, bracket.anchor.fromBlockId);
  const b = findBlockGroup(timeline, bracket.anchor.toBlockId);
  if (!a || !b) return null;
  const from = Math.min(toDay(a.group.start, timeline), toDay(b.group.start, timeline));
  const to = Math.max(toDay(a.group.end, timeline), toDay(b.group.end, timeline));
  return { from, to };
}

export function BracketLabel({ bracket, timeline, baselineY, side, offsetX, minDay }: Props) {
  const select = useTimelineStore((s) => s.select);
  const selection = useTimelineStore((s) => s.selection);
  const selected = selection?.kind === "bracket" && selection.id === bracket.id;
  const range = resolveBracketRange(bracket, timeline);
  if (!range) return null;
  const xLeft = offsetX + dayToX(range.from - minDay, timeline);
  const xRight = offsetX + dayToX(range.to - minDay, timeline);
  const days = Math.max(0, Math.round(range.to - range.from));
  const labelText =
    bracket.labelMode === "auto"
      ? `${bracket.autoPrefix ?? "~"}${days}${bracket.autoSuffix ?? " days"}`
      : bracket.label;

  // labelOffsetY translates the whole bracket+label assembly perpendicular to the chart.
  // Positive = away from the chart (up for top, down for bottom).
  const offset = bracket.labelOffsetY ?? 0;
  const translatedBaselineY = side === "top" ? baselineY - offset : baselineY + offset;

  // Depth is positive for top brackets (peak above baseline) and negative for bottom.
  const depth = side === "top" ? 16 : -16;
  const path = curlyBracketPath(xLeft, xRight, translatedBaselineY, depth);

  // Label position: above peak for top, below peak for bottom.
  const peakY = translatedBaselineY - depth;
  const labelY = side === "top" ? peakY - 6 : peakY + 14;

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: "bracket", id: bracket.id });
      }}
      style={{ cursor: "pointer" }}
    >
      <path
        d={path}
        fill="none"
        stroke={selected ? "var(--svg-text)" : "var(--svg-text-strong)"}
        strokeWidth={selected ? 2 : 1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x={(xLeft + xRight) / 2 + (bracket.labelOffsetX ?? 0)}
        y={labelY}
        textAnchor="middle"
        fontSize={12}
        fontWeight={500}
        fill="var(--svg-text-strong)"
      >
        {labelText}
      </text>
    </g>
  );
}
