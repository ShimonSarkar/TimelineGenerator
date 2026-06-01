import type { Guide, Timeline } from "../model/timeline";
import { dayToX, toDay } from "./scale";

const APPROX_CHAR_W = 5.5; // for fontSize 11

/** Compute the visual width occupied by a guide label (max line width). */
export function estimateGuideLabelWidth(label: string): number {
  if (!label) return 0;
  const lines = label.split("\n");
  return Math.max(...lines.map((l) => l.length * APPROX_CHAR_W));
}

export interface GuideLayoutEntry {
  guide: Guide;
  /** x position on the chart (already includes offsetX). */
  x: number;
  /** 0-based lane index for label stacking; lane 0 is furthest from the chart. */
  lane: number;
}

/**
 * Compute lanes for guide labels so overlapping labels stack vertically.
 * Guides are grouped by their labelPosition ("top" vs "bottom") and assigned
 * a lane index per side. Lane 0 is the row furthest from the chart; higher
 * lane indices are closer to the chart edge.
 */
export function layoutGuideLabels(
  guides: Guide[],
  timeline: Timeline,
  offsetX: number,
  minDay: number,
): { top: GuideLayoutEntry[]; bottom: GuideLayoutEntry[]; topLanes: number; bottomLanes: number } {
  const byPos: Record<"top" | "bottom", Guide[]> = { top: [], bottom: [] };
  for (const g of guides) byPos[g.labelPosition].push(g);

  function place(list: Guide[]): { entries: GuideLayoutEntry[]; lanes: number } {
    // sort by x position
    const xs = list.map((g) => ({
      guide: g,
      x: offsetX + dayToX(toDay(g.at, timeline) - minDay, timeline),
      halfWidth: estimateGuideLabelWidth(g.label) / 2 + 6, // 6px padding
    }));
    xs.sort((a, b) => a.x - b.x);
    // greedy: pick the lowest lane (closest to chart edge) whose last-used right edge < this.left
    const laneRights: number[] = [];
    const entries: GuideLayoutEntry[] = [];
    for (const item of xs) {
      const left = item.x - item.halfWidth;
      const right = item.x + item.halfWidth;
      let lane = 0;
      while (lane < laneRights.length && laneRights[lane] > left) lane++;
      if (lane === laneRights.length) laneRights.push(right);
      else laneRights[lane] = right;
      entries.push({ guide: item.guide, x: item.x, lane });
    }
    return { entries, lanes: laneRights.length };
  }

  const top = place(byPos.top);
  const bottom = place(byPos.bottom);
  return {
    top: top.entries,
    bottom: bottom.entries,
    topLanes: top.lanes,
    bottomLanes: bottom.lanes,
  };
}
