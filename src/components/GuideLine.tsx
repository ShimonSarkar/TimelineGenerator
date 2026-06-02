import type { Guide } from "../model/timeline";
import { useTimelineStore } from "../state/store";

interface Props {
  guide: Guide;
  /** x position on the chart (already includes leftGutter and minDay offset). */
  x: number;
  chartTop: number;
  chartBottom: number;
  /** Stacking lane (0 = closest to the chart edge). */
  lane: number;
  /** Total lanes used on this side. */
  totalLanes: number;
  /** "top" or "bottom" */
  side: "top" | "bottom";
  /** Reserved vertical space for the label area on this side. */
  reservedHeight: number;
  /**
   * The y coordinate of the edge of the label area that is closest to the chart.
   * Labels sit between (edge - reservedHeight) and (edge) for top side; for bottom
   * side, between (edge) and (edge + reservedHeight).
   */
  labelAreaEdge: number;
}

const LINE_H = 14;
const FONT = 11;
const LANE_GAP = 8;

export function GuideLine({
  guide,
  x,
  chartTop,
  chartBottom,
  lane,
  totalLanes,
  side,
  reservedHeight,
  labelAreaEdge,
}: Props) {
  const select = useTimelineStore((s) => s.select);
  const selection = useTimelineStore((s) => s.selection);
  const selected = selection?.kind === "guide" && selection.id === guide.id;

  const labelLines = guide.label.split("\n");
  const labelBlockH = labelLines.length * LINE_H;

  // For top side: labelAreaEdge = bottom edge of the label area (sits just above the ruler).
  // Lane 0 is closest to chart (just above ruler); higher lanes go further up.
  // For bottom side: labelAreaEdge = top edge of the label area; lane 0 is closest to chart.
  let labelTopY: number;
  let labelBottomY: number;
  let connectorFromY: number;
  let connectorToY: number;

  if (side === "top") {
    labelBottomY = labelAreaEdge - lane * (labelBlockH + LANE_GAP) - (guide.labelOffsetY ?? 0);
    labelTopY = labelBottomY - labelBlockH;
    connectorFromY = labelBottomY + 1;
    connectorToY = chartTop;
  } else {
    labelTopY = labelAreaEdge + lane * (labelBlockH + LANE_GAP) + (guide.labelOffsetY ?? 0);
    labelBottomY = labelTopY + labelBlockH;
    connectorFromY = chartBottom;
    connectorToY = labelTopY - 1;
  }
  void reservedHeight; // not needed for positioning anymore (kept for future)
  void totalLanes;

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: "guide", id: guide.id });
      }}
      style={{ cursor: "pointer" }}
    >
      {/* Dashed line crossing the chart */}
      <line
        x1={x}
        x2={x}
        y1={chartTop}
        y2={chartBottom}
        stroke={guide.color}
        strokeWidth={selected ? 2 : 1.25}
        strokeDasharray={guide.dash}
      />
      {/* Thin connector between chart edge and the label */}
      <line
        x1={x}
        x2={x}
        y1={Math.min(connectorFromY, connectorToY)}
        y2={Math.max(connectorFromY, connectorToY)}
        stroke={guide.color}
        strokeWidth={1}
        strokeDasharray={guide.dash}
        opacity={0.55}
      />
      {/* Wider invisible hit target */}
      <line
        x1={x}
        x2={x}
        y1={chartTop}
        y2={chartBottom}
        stroke="transparent"
        strokeWidth={10}
      />
      <text
        x={x + (guide.labelOffsetX ?? 0)}
        y={labelTopY + LINE_H - 3}
        textAnchor="middle"
        fontSize={FONT}
        fontStyle="italic"
        fill="var(--svg-text-strong)"
        style={{ userSelect: "none" }}
      >
        {labelLines.map((ln, i) => (
          <tspan key={i} x={x + (guide.labelOffsetX ?? 0)} dy={i === 0 ? 0 : LINE_H}>
            {ln}
          </tspan>
        ))}
      </text>
    </g>
  );
}
