import { useMemo } from "react";
import { useTimelineStore } from "../state/store";
import { dayToX, timelineSpan, toDay, findBlockGroup } from "../render/scale";
import { LAYOUT } from "../render/layout";
import { BlockView } from "./BlockView";
import { GuideLine } from "./GuideLine";
import { BracketLabel } from "./BracketLabel";
import { DragHandles } from "./DragHandles";
import { TimeRuler } from "./TimeRuler";
import { Legend, legendHeight } from "./Legend";
import { layoutGuideLabels } from "../render/guideLayout";
import type { Timeline } from "../model/timeline";

interface Props {
  exportRef?: React.RefObject<SVGSVGElement | null>;
  /** Optional timeline override — bypasses the store. */
  timeline?: Timeline;
  /** Force a specific day domain so multiple canvases can share the same horizontal axis. */
  domain?: { minDay: number; maxDay: number };
  /** When true, selection clicks and drag handles are disabled. */
  readOnly?: boolean;
  /** When true, the legend at the bottom is omitted. */
  hideLegend?: boolean;
}

const RULER_H = 28;
const GUIDE_LINE_H = 14;
const GUIDE_LANE_GAP = 8;
const GUIDE_AREA_PAD = 10; // gap between guide label area and adjacent bracket / ruler
const LEGEND_GAP = 16;

export function TimelineCanvas({ exportRef, timeline: timelineProp, domain, readOnly, hideLegend }: Props) {
  const storeTimeline = useTimelineStore((s) => s.timeline);
  const storeSelect = useTimelineStore((s) => s.select);
  const timeline = timelineProp ?? storeTimeline;
  const select = readOnly ? (() => {}) : storeSelect;

  const layout = useMemo(() => {
    const span = timelineSpan(timeline);
    const minDay = domain ? domain.minDay : Math.min(0, Math.floor(span.min));
    const maxDay = domain
      ? Math.max(domain.maxDay, minDay + 1)
      : Math.max(Math.ceil(span.max), minDay + 1);
    const chartWidthPx = dayToX(maxDay - minDay, timeline);

    // Bracket lanes (auto-collision-avoidance: respect user-assigned lane as a minimum,
    // bump to a deeper lane if the bracket's span/label would overlap something already placed).
    const topBrackets = timeline.brackets.filter((b) => b.side === "top");
    const bottomBrackets = timeline.brackets.filter((b) => b.side === "bottom");

    function computeBracketLanes(brackets: typeof timeline.brackets): Map<string, number> {
      const items = brackets
        .map((b) => {
          let from: number | null = null;
          let to: number | null = null;
          if (b.anchor.kind === "range") {
            from = toDay(b.anchor.from, timeline);
            to = toDay(b.anchor.to, timeline);
          } else {
            const a = findBlockGroup(timeline, b.anchor.fromBlockId);
            const c = findBlockGroup(timeline, b.anchor.toBlockId);
            if (a && c) {
              from = Math.min(toDay(a.group.start, timeline), toDay(c.group.start, timeline));
              to = Math.max(toDay(a.group.end, timeline), toDay(c.group.end, timeline));
            }
          }
          if (from == null || to == null) return null;
          const xLeft = LAYOUT.leftGutter + dayToX(from - minDay, timeline);
          const xRight = LAYOUT.leftGutter + dayToX(to - minDay, timeline);
          const days = Math.max(0, Math.round(to - from));
          const labelText =
            b.labelMode === "auto"
              ? `${b.autoPrefix ?? "~"}${days}${b.autoSuffix ?? " days"}`
              : b.label;
          const labelWidth = labelText.length * 7 + 12; // estimate, with padding
          const cx = (xLeft + xRight) / 2;
          const labelLeft = cx - labelWidth / 2;
          const labelRight = cx + labelWidth / 2;
          return {
            id: b.id,
            userLane: Math.max(0, b.lane),
            left: Math.min(xLeft, labelLeft),
            right: Math.max(xRight, labelRight),
          };
        })
        .filter((x): x is { id: string; userLane: number; left: number; right: number } => x !== null);
      items.sort((a, b) => a.userLane - b.userLane || a.left - b.left);
      const result = new Map<string, number>();
      const laneRights: number[] = [];
      for (const it of items) {
        let lane = it.userLane;
        while (lane < laneRights.length && laneRights[lane] !== undefined && laneRights[lane] > it.left + 1) {
          lane++;
        }
        while (laneRights.length <= lane) laneRights.push(-Infinity);
        laneRights[lane] = it.right;
        result.set(it.id, lane);
      }
      return result;
    }

    const topBracketEffectiveLane = computeBracketLanes(topBrackets);
    const bottomBracketEffectiveLane = computeBracketLanes(bottomBrackets);
    const topLanes = topBracketEffectiveLane.size
      ? Math.max(...topBracketEffectiveLane.values()) + 1
      : 0;
    const bottomLanes = bottomBracketEffectiveLane.size
      ? Math.max(...bottomBracketEffectiveLane.values()) + 1
      : 0;
    // Per-bracket reservation: each bracket needs (effLane + 1) * laneHeight + its own
    // labelOffsetY pixels above the topBracketsBaseline. The header section grows to fit
    // the most-demanding bracket, and shrinks when all brackets are pulled toward the
    // chart via negative offsets. Floored at 0.
    const topBracketsH = Math.max(
      0,
      ...topBrackets.map(
        (b) =>
          ((topBracketEffectiveLane.get(b.id) ?? 0) + 1) * LAYOUT.bracketLaneHeight +
          (b.labelOffsetY ?? 0),
      ),
    );
    const bottomBracketsH = Math.max(
      0,
      ...bottomBrackets.map(
        (b) =>
          ((bottomBracketEffectiveLane.get(b.id) ?? 0) + 1) * LAYOUT.bracketLaneHeight +
          (b.labelOffsetY ?? 0),
      ),
    );

    // Guide label lanes (independent of brackets)
    const guideLayout = layoutGuideLabels(timeline.guides, timeline, LAYOUT.leftGutter, minDay);
    const topGuides = timeline.guides.filter((g) => g.labelPosition === "top");
    const bottomGuides = timeline.guides.filter((g) => g.labelPosition === "bottom");
    const topGuideMaxLines = Math.max(
      0,
      ...topGuides.map((g) => g.label.split("\n").length),
    );
    const bottomGuideMaxLines = Math.max(
      0,
      ...bottomGuides.map((g) => g.label.split("\n").length),
    );
    const topGuideLaneBlock = topGuideMaxLines * GUIDE_LINE_H + GUIDE_LANE_GAP;
    const bottomGuideLaneBlock = bottomGuideMaxLines * GUIDE_LINE_H + GUIDE_LANE_GAP;

    // Per-guide reservation, same logic as brackets.
    const topGuideLaneById = new Map(guideLayout.top.map((e) => [e.guide.id, e.lane]));
    const bottomGuideLaneById = new Map(guideLayout.bottom.map((e) => [e.guide.id, e.lane]));
    const topGuideH =
      guideLayout.topLanes > 0
        ? Math.max(
            0,
            ...topGuides.map(
              (g) =>
                ((topGuideLaneById.get(g.id) ?? 0) + 1) * topGuideLaneBlock +
                GUIDE_AREA_PAD +
                (g.labelOffsetY ?? 0),
            ),
          )
        : 0;
    const bottomGuideH =
      guideLayout.bottomLanes > 0
        ? Math.max(
            0,
            ...bottomGuides.map(
              (g) =>
                ((bottomGuideLaneById.get(g.id) ?? 0) + 1) * bottomGuideLaneBlock +
                GUIDE_AREA_PAD +
                (g.labelOffsetY ?? 0),
            ),
          )
        : 0;

    // Header layout (top → bottom):
    //   topBrackets → (gap) → topGuideLabels → (gap) → ruler → chart
    const headerH = topBracketsH + topGuideH + LAYOUT.topPad + RULER_H;

    // ---- Row sub-lane stacking ----
    // Within each row, multiple groups whose time ranges overlap are placed on separate
    // sub-lanes so they don't visually block one another. Row height grows to fit.
    const SUBLANE_MIN_H = 44;
    const SUBLANE_GAP = 4;

    type RowGeom = {
      y: number;
      height: number;
      subLanes: number;
      subLaneH: number;
      groupLanes: Map<string, number>;
      /** For each group, the inclusive lane range it should visually span. */
      groupLaneSpan: Map<string, { from: number; to: number }>;
    };
    const rowGeoms: Record<string, RowGeom> = {};
    let rowsH = 0;
    {
      for (const row of timeline.rows) {
        const items = row.groups
          .filter((g) => g.blocks.length > 0)
          .map((g) => ({
            id: g.id,
            start: toDay(g.start, timeline),
            end: toDay(g.end, timeline),
            preferredLane: g.lane,
          }));
        const groupLanes = new Map<string, number>();
        // Per-lane occupied time ranges, used to test for conflicts.
        const laneSchedules: Array<Array<{ start: number; end: number }>> = [];
        // Keep per-group time ranges keyed by id for overlap lookups below.
        const itemById = new Map<string, { start: number; end: number }>();

        function fits(lane: number, start: number, end: number): boolean {
          if (lane >= laneSchedules.length) return true;
          for (const r of laneSchedules[lane]) {
            if (r.start < end && r.end > start) return false;
          }
          return true;
        }
        function place(id: string, lane: number, start: number, end: number) {
          while (laneSchedules.length <= lane) laneSchedules.push([]);
          laneSchedules[lane].push({ start, end });
          groupLanes.set(id, lane);
          itemById.set(id, { start, end });
        }

        // Treat zero-length (point) groups as occupying a tiny epsilon so they
        // don't share a lane with a span that touches the same instant.
        const normalized = items.map((it) => ({
          ...it,
          end: Math.max(it.end, it.start + 0.0001),
        }));

        // Pass 1: items with an explicit lane preference. Sort by preferred lane
        // then start so the requested order is honored when there are conflicts.
        const explicit = normalized
          .filter((it) => it.preferredLane != null)
          .sort(
            (a, b) =>
              (a.preferredLane! - b.preferredLane!) || a.start - b.start || a.end - b.end,
          );
        for (const it of explicit) {
          let lane = it.preferredLane!;
          while (!fits(lane, it.start, it.end)) lane++;
          place(it.id, lane, it.start, it.end);
        }

        // Pass 2: greedy fit for the rest (current default behavior).
        const greedy = normalized
          .filter((it) => it.preferredLane == null)
          .sort((a, b) => a.start - b.start || a.end - b.end);
        for (const it of greedy) {
          let lane = 0;
          while (!fits(lane, it.start, it.end)) lane++;
          place(it.id, lane, it.start, it.end);
        }

        const subLanes = Math.max(1, laneSchedules.length);
        const declared = row.height ?? LAYOUT.rowHeight;
        const stackedMin = subLanes * SUBLANE_MIN_H + (subLanes - 1) * SUBLANE_GAP;
        const effectiveH = Math.max(declared, stackedMin);
        const subLaneH = (effectiveH - (subLanes - 1) * SUBLANE_GAP) / subLanes;

        // For each group, expand vertically into any adjacent sub-lanes that have
        // no other group overlapping in time. A group with no conflicts in the row
        // therefore fills the full row height.
        const groupLaneSpan = new Map<string, { from: number; to: number }>();
        for (const it of normalized) {
          const myLane = groupLanes.get(it.id)!;
          const me = itemById.get(it.id)!;
          const laneFree = (L: number): boolean => {
            if (L === myLane) return true;
            for (const other of normalized) {
              if (other.id === it.id) continue;
              if (groupLanes.get(other.id) !== L) continue;
              const o = itemById.get(other.id)!;
              const overlaps = o.start < me.end && o.end > me.start;
              if (overlaps) return false;
            }
            return true;
          };
          let from = myLane;
          while (from > 0 && laneFree(from - 1)) from--;
          let to = myLane;
          while (to < subLanes - 1 && laneFree(to + 1)) to++;
          groupLaneSpan.set(it.id, { from, to });
        }

        rowGeoms[row.id] = {
          y: 0, // filled in below once chartTop is known
          height: effectiveH,
          subLanes,
          subLaneH,
          groupLanes,
          groupLaneSpan,
        };
        rowsH += effectiveH + LAYOUT.rowGap;
      }
      rowsH = Math.max(0, rowsH - LAYOUT.rowGap);
    }

    const chartTop = headerH;
    const chartBottom = headerH + Math.max(0, rowsH);

    // Fill in absolute y positions for each row now that chartTop is known.
    {
      let y = chartTop;
      for (const row of timeline.rows) {
        rowGeoms[row.id].y = y;
        y += rowGeoms[row.id].height + LAYOUT.rowGap;
      }
    }

    // The y position where the ruler begins (= top of ruler) and where guide labels end.
    const rulerY = chartTop - RULER_H;
    // Top guide labels sit immediately above the ruler with a small pad.
    const topGuideLabelEdge = rulerY - 4; // bottom edge of top guide label area

    const footerBaseH = bottomBracketsH + bottomGuideH + LAYOUT.bottomPad;
    const legendW = chartWidthPx;
    const legendH = hideLegend ? 0 : legendHeight(timeline, legendW);
    const LEGEND_BOTTOM_PAD = 24;
    const footerH =
      footerBaseH + (legendH > 0 ? LEGEND_GAP + legendH + LEGEND_BOTTOM_PAD : 0);

    const totalHeight = chartBottom + footerH;
    const totalWidth = LAYOUT.leftGutter + chartWidthPx + LAYOUT.rightPad;
    const offsetX = LAYOUT.leftGutter;

    return {
      minDay,
      maxDay,
      chartWidthPx,
      topGuideH,
      bottomGuideH,
      topGuideLaneBlock,
      bottomGuideLaneBlock,
      guideLayout,
      chartTop,
      chartBottom,
      totalHeight,
      totalWidth,
      offsetX,
      rulerY,
      topGuideLabelEdge,
      bottomGuideLabelEdge: chartBottom + bottomBracketsH + LAYOUT.bottomPad + 4,
      bottomBracketsBottom: chartBottom + bottomBracketsH + LAYOUT.bottomPad,
      topBracketEffectiveLane,
      bottomBracketEffectiveLane,
      legendH,
      legendW,
      rowGeoms,
      SUBLANE_GAP,
    };
  }, [timeline, domain?.minDay, domain?.maxDay, hideLegend]);

  // Use the row geometry computed during layout (includes sub-lane stacking heights).
  const rowYs: Record<string, { y: number; height: number }> = {};
  for (const row of timeline.rows) {
    const g = layout.rowGeoms[row.id];
    rowYs[row.id] = { y: g.y, height: g.height };
  }

  return (
    <svg
      ref={exportRef}
      width={layout.totalWidth}
      height={layout.totalHeight}
      viewBox={`0 0 ${layout.totalWidth} ${layout.totalHeight}`}
      onClick={() => select(null)}
      style={{ background: "var(--svg-bg)", display: "block" }}
    >
      <defs>
        <pattern
          id="tlg-grid-minor"
          width={timeline.pxPerDay}
          height={timeline.pxPerDay}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${timeline.pxPerDay} 0 L 0 0 0 ${timeline.pxPerDay}`}
            fill="none"
            stroke="var(--svg-grid-light)"
            strokeWidth="1"
          />
        </pattern>
        <pattern
          id="tlg-grid-major"
          width={timeline.pxPerDay * 5}
          height={timeline.pxPerDay * 5}
          patternUnits="userSpaceOnUse"
        >
          <rect width="100%" height="100%" fill="url(#tlg-grid-minor)" />
          <path
            d={`M ${timeline.pxPerDay * 5} 0 L 0 0 0 ${timeline.pxPerDay * 5}`}
            fill="none"
            stroke="var(--svg-grid-strong)"
            strokeWidth="1"
          />
        </pattern>
        <filter id="tlg-block-shadow" x="-10%" y="-30%" width="120%" height="160%">
          <feDropShadow
            dx="0"
            dy="1"
            stdDeviation="1.2"
            floodColor="#0f172a"
            floodOpacity="0.18"
          />
        </filter>
      </defs>

      {/* Background grid only beneath chart rows (not the ruler/legend) */}
      <rect
        x={layout.offsetX}
        y={layout.chartTop}
        width={layout.chartWidthPx}
        height={layout.chartBottom - layout.chartTop}
        fill="url(#tlg-grid-major)"
      />

      {/* Time ruler */}
      <TimeRuler
        timeline={timeline}
        minDay={layout.minDay}
        maxDay={layout.maxDay}
        offsetX={layout.offsetX}
        y={layout.rulerY}
        height={RULER_H}
      />

      {/* Row labels */}
      {timeline.rows.map((row) => {
        const ry = rowYs[row.id];
        const labelLines = row.label.split("\n");
        return (
          <text
            key={row.id}
            x={LAYOUT.leftGutter - 16}
            y={ry.y + ry.height / 2}
            textAnchor="end"
            dominantBaseline="central"
            fontSize={13}
            fontWeight={600}
            fill="var(--svg-text-strong)"
            style={{ userSelect: "none", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              select({ kind: "row", rowId: row.id });
            }}
          >
            <title>Click to edit or delete this row</title>
            {labelLines.map((ln, i) => (
              <tspan
                key={i}
                x={LAYOUT.leftGutter - 16}
                dy={i === 0 ? -((labelLines.length - 1) * 8) : 16}
              >
                {ln}
              </tspan>
            ))}
          </text>
        );
      })}

      {/* Block groups */}
      {timeline.rows.map((row) => {
        const ry = rowYs[row.id];
        const geom = layout.rowGeoms[row.id];
        return (
          <g key={row.id}>
            {row.groups.map((group) => {
              const startDay = toDay(group.start, timeline);
              const endDay = toDay(group.end, timeline);
              const x = layout.offsetX + dayToX(startDay - layout.minDay, timeline);
              const width = dayToX(endDay - startDay, timeline);
              const lane = geom.groupLanes.get(group.id) ?? 0;
              const span = geom.groupLaneSpan.get(group.id) ?? { from: lane, to: lane };
              const groupY = ry.y + span.from * (geom.subLaneH + layout.SUBLANE_GAP);
              const lanesSpanned = span.to - span.from + 1;
              const groupHeight =
                lanesSpanned * geom.subLaneH + (lanesSpanned - 1) * layout.SUBLANE_GAP;
              return (
                <g key={group.id}>
                  {group.blocks.map((block, i) => (
                    <BlockView
                      key={block.id}
                      rowId={row.id}
                      group={group}
                      block={block}
                      index={i}
                      total={group.blocks.length}
                      x={x}
                      width={width}
                      rowY={groupY}
                      rowHeight={groupHeight}
                    />
                  ))}
                  {!readOnly && (
                    <DragHandles
                      rowId={row.id}
                      group={group}
                      x={x}
                      width={width}
                      rowY={groupY}
                      rowHeight={groupHeight}
                      timeline={timeline}
                    />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Guides (with stacked labels) */}
      {layout.guideLayout.top.map((g) => (
        <GuideLine
          key={g.guide.id}
          guide={g.guide}
          x={g.x}
          lane={g.lane}
          totalLanes={layout.guideLayout.topLanes}
          side="top"
          reservedHeight={layout.topGuideH}
          labelAreaEdge={layout.topGuideLabelEdge}
          chartTop={layout.chartTop}
          chartBottom={layout.chartBottom}
        />
      ))}
      {layout.guideLayout.bottom.map((g) => (
        <GuideLine
          key={g.guide.id}
          guide={g.guide}
          x={g.x}
          lane={g.lane}
          totalLanes={layout.guideLayout.bottomLanes}
          side="bottom"
          reservedHeight={layout.bottomGuideH}
          labelAreaEdge={layout.bottomGuideLabelEdge}
          chartTop={layout.chartTop}
          chartBottom={layout.chartBottom}
        />
      ))}

      {/* Top brackets — sit above the guide-label area */}
      {timeline.brackets
        .filter((b) => b.side === "top")
        .map((b) => {
          const eff = layout.topBracketEffectiveLane.get(b.id) ?? b.lane;
          // Baseline of lane-0 bracket sits just above the guide label area.
          const topBracketsBaseline = layout.rulerY - layout.topGuideH - LAYOUT.topPad;
          const baselineY = topBracketsBaseline - eff * LAYOUT.bracketLaneHeight;
          return (
            <BracketLabel
              key={b.id}
              bracket={b}
              timeline={timeline}
              baselineY={baselineY}
              side="top"
              offsetX={layout.offsetX}
              minDay={layout.minDay}
            />
          );
        })}

      {/* Bottom brackets */}
      {timeline.brackets
        .filter((b) => b.side === "bottom")
        .map((b) => {
          const eff = layout.bottomBracketEffectiveLane.get(b.id) ?? b.lane;
          const baselineY =
            layout.chartBottom + LAYOUT.bottomPad + eff * LAYOUT.bracketLaneHeight;
          return (
            <BracketLabel
              key={b.id}
              bracket={b}
              timeline={timeline}
              baselineY={baselineY}
              side="bottom"
              offsetX={layout.offsetX}
              minDay={layout.minDay}
            />
          );
        })}

      {/* Legend */}
      {layout.legendH > 0 && (
        <Legend
          timeline={timeline}
          x={layout.offsetX}
          y={layout.bottomBracketsBottom + LEGEND_GAP}
          width={layout.legendW}
          onSelect={(ref) => select({ kind: "block", ...ref })}
        />
      )}
    </svg>
  );
}
