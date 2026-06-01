import type { Timeline } from "../model/timeline";
import { LAYOUT } from "../render/layout";

export interface LegendBlockRef {
  rowId: string;
  groupId: string;
  blockId: string;
}

export interface LegendItem {
  /** Stable key (`color|label`) used for ordering. */
  key: string;
  color: string;
  label: string;
  /** First block (in document order) that contributes this entry. */
  ref: LegendBlockRef;
}

interface Props {
  timeline: Timeline;
  x: number; // left x
  y: number; // top y
  width: number;
  onSelect?: (ref: LegendBlockRef) => void;
}

/**
 * Build a unique legend list. Blocks sharing both color and label are deduped.
 * Items are sorted according to `timeline.legendOrder`; unknown entries are
 * appended in document order so newly-added blocks always show up.
 */
export function collectLegendItems(timeline: Timeline): LegendItem[] {
  const seen = new Map<string, LegendItem>();
  for (const row of timeline.rows) {
    for (const group of row.groups) {
      for (const block of group.blocks) {
        const label = block.label.replace(/\n+/g, " ").trim();
        if (!label) continue;
        const key = `${block.color}|${label}`;
        if (seen.has(key)) continue;
        seen.set(key, {
          key,
          color: block.color,
          label,
          ref: { rowId: row.id, groupId: group.id, blockId: block.id },
        });
      }
    }
  }
  const order = timeline.legendOrder ?? [];
  const ordered: LegendItem[] = [];
  const usedKeys = new Set<string>();
  for (const k of order) {
    const item = seen.get(k);
    if (item) {
      ordered.push(item);
      usedKeys.add(k);
    }
  }
  for (const [k, item] of seen) {
    if (!usedKeys.has(k)) ordered.push(item);
  }
  return ordered;
}

// Layout constants.
const PAD_X = 16;
const PAD_TOP = 30;
const PAD_BOTTOM = 16;
const COL_GAP = 18;
const ROW_H = 22;
const SWATCH = 12;
const SWATCH_GAP = 8;
const HEADER_H = 24;
const CHAR_W = 6.6; // approx average char width at 12px
const MIN_COL_W = 140;
const MAX_COL_W = 280;

/** Choose the column width (and resulting column count) that best fits `items` into `innerW`. */
function chooseColumns(items: LegendItem[], innerW: number): {
  cols: number;
  colW: number;
  maxChars: number;
} {
  if (items.length === 0) return { cols: 1, colW: innerW, maxChars: 1 };

  // The widest label drives the minimum useful column width.
  const longest = items.reduce((m, it) => Math.max(m, it.label.length), 0);
  const idealColW = Math.min(MAX_COL_W, SWATCH + SWATCH_GAP + longest * CHAR_W + 8);

  let best = { cols: 1, colW: innerW, maxChars: Math.max(8, Math.floor((innerW - SWATCH - SWATCH_GAP) / CHAR_W)) };
  for (let cols = Math.min(items.length, 6); cols >= 1; cols--) {
    const colW = (innerW - COL_GAP * (cols - 1)) / cols;
    if (colW < MIN_COL_W && cols > 1) continue;
    // Prefer the densest layout that still leaves each column close to ideal.
    if (colW <= idealColW + 40) {
      const maxChars = Math.max(6, Math.floor((colW - SWATCH - SWATCH_GAP) / CHAR_W));
      best = { cols, colW, maxChars };
      break;
    }
  }
  return best;
}

export function legendHeight(timeline: Timeline, width: number): number {
  const items = collectLegendItems(timeline);
  if (items.length === 0) return 0;
  const innerW = Math.max(0, width - PAD_X * 2);
  const { cols } = chooseColumns(items, innerW);
  const rows = Math.ceil(items.length / cols);
  return PAD_TOP + rows * ROW_H + PAD_BOTTOM;
}

export function Legend({ timeline, x, y, width, onSelect }: Props) {
  const items = collectLegendItems(timeline);
  if (items.length === 0) return null;

  const innerW = Math.max(0, width - PAD_X * 2);
  const { cols, colW, maxChars } = chooseColumns(items, innerW);
  const height = legendHeight(timeline, width);

  return (
    <g className="legend">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="var(--svg-surface)"
        stroke="var(--svg-border)"
        rx={LAYOUT.blockCornerRadius}
        ry={LAYOUT.blockCornerRadius}
      />
      <text
        x={x + PAD_X}
        y={y + HEADER_H - 6}
        fontSize={11}
        fontWeight={700}
        fill="var(--svg-text-muted)"
        style={{ textTransform: "uppercase", letterSpacing: "0.6px" }}
      >
        Legend
      </text>
      {items.map((it, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const ix = x + PAD_X + col * (colW + COL_GAP);
        const iy = y + PAD_TOP + row * ROW_H;
        const truncated =
          it.label.length > maxChars ? it.label.slice(0, Math.max(1, maxChars - 1)) + "…" : it.label;
        const clickable = !!onSelect;
        return (
          <g
            key={it.key}
            style={clickable ? { cursor: "pointer" } : undefined}
            onClick={
              clickable
                ? (e) => {
                    e.stopPropagation();
                    onSelect!(it.ref);
                  }
                : undefined
            }
          >
            {/* Invisible hit area covers swatch + label */}
            <rect
              x={ix - 4}
              y={iy - 4}
              width={colW + 8}
              height={ROW_H}
              fill="transparent"
            />
            <rect
              x={ix}
              y={iy}
              width={SWATCH}
              height={SWATCH}
              rx={3}
              ry={3}
              fill={it.color}
              stroke="rgba(15,23,42,0.1)"
            />
            <text
              x={ix + SWATCH + SWATCH_GAP}
              y={iy + SWATCH - 1}
              fontSize={12}
              fill="var(--svg-text)"
              style={{ userSelect: "none" }}
            >
              <title>{it.label}</title>
              {truncated}
            </text>
          </g>
        );
      })}
    </g>
  );
}
