import type { Block, BlockGroup } from "../model/timeline";
import { LAYOUT } from "../render/layout";
import { useTimelineStore } from "../state/store";
import { useMemo } from "react";
import { chooseLabelLayout, forcedLabelLayout } from "../render/labelFit";

interface Props {
  rowId: string;
  group: BlockGroup;
  block: Block;
  index: number; // index within group.blocks
  total: number; // total blocks in group
  x: number; // group's left x
  width: number; // group width
  rowY: number; // row top y
  rowHeight: number;
}

function autoTextColor(bg: string): string {
  let h = bg.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1f2937" : "#ffffff";
}

export function BlockView({
  rowId,
  group,
  block,
  index,
  total,
  x,
  width,
  rowY,
  rowHeight,
}: Props) {
  const select = useTimelineStore((s) => s.select);
  const selection = useTimelineStore((s) => s.selection);
  const selected =
    selection?.kind === "block" &&
    selection.blockId === block.id &&
    selection.groupId === group.id;

  const textColor = useMemo(
    () => block.textColor || autoTextColor(block.color),
    [block.color, block.textColor],
  );

  if (block.kind === "point") {
    const w = LAYOUT.pointBlockWidth;
    const px = x - w / 2;
    const pointFontSize = block.fontSize ?? 11;
    const pointOrientation = block.orientation === "auto" ? "vertical" : block.orientation;
    return (
      <g
        onClick={(e) => {
          e.stopPropagation();
          select({ kind: "block", rowId, groupId: group.id, blockId: block.id });
        }}
        style={{ cursor: "pointer" }}
      >
        <rect
          x={px}
          y={rowY}
          width={w}
          height={rowHeight}
          rx={2}
          ry={2}
          fill={block.color}
          stroke={selected ? "#2c6cf6" : "none"}
          strokeWidth={selected ? 2 : 0}
          filter="url(#tlg-block-shadow)"
        />
        <title>{block.label}</title>
        {block.label && !block.hideLabel && pointOrientation === "vertical" && (
          <g transform={`rotate(-90 ${x} ${rowY + rowHeight / 2})`} pointerEvents="none">
            <text
              x={x}
              y={rowY + rowHeight / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={pointFontSize}
              fontWeight={700}
              fill={textColor}
              style={{ userSelect: "none" }}
            >
              {block.label}
            </text>
          </g>
        )}
        {block.label && !block.hideLabel && pointOrientation === "horizontal" && (
          <text
            x={x}
            y={rowY + rowHeight / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={pointFontSize}
            fontWeight={700}
            fill={textColor}
            pointerEvents="none"
            style={{ userSelect: "none" }}
          >
            {block.label}
          </text>
        )}
      </g>
    );
  }

  // SPAN block: each block gets an equal vertical slice of the row.
  const blockH = rowHeight / Math.max(1, total);
  const blockY = rowY + blockH * index;
  const hideLabel = block.hideLabel || !block.label.trim();
  let layout;
  if (hideLabel) {
    layout = { mode: "hide" as const, fontSize: 0, lines: [] as string[], textWidth: 0, textHeight: 0 };
  } else if (block.fontSize || block.orientation !== "auto") {
    const fs = block.fontSize ?? 12;
    const orient = block.orientation === "vertical" ? "rotate" : "wrap";
    const boxW = orient === "rotate" ? blockH : width;
    const forced = forcedLabelLayout(block.label, fs, boxW);
    layout = { ...forced, mode: orient };
  } else {
    layout = chooseLabelLayout(block.label, width, blockH);
  }

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: "block", rowId, groupId: group.id, blockId: block.id });
      }}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={x}
        y={blockY}
        width={width}
        height={blockH}
        rx={LAYOUT.blockCornerRadius}
        ry={LAYOUT.blockCornerRadius}
        fill={block.color}
        stroke={selected ? "#2c6cf6" : "rgba(15,23,42,0.08)"}
        strokeWidth={selected ? 2 : 0.5}
        filter="url(#tlg-block-shadow)"
      />
      <title>{block.label}</title>
      {layout.mode === "wrap" && (
        <BlockLabelWrap
          lines={layout.lines}
          fontSize={layout.fontSize}
          x={x + width / 2}
          y={blockY + blockH / 2}
          color={textColor}
        />
      )}
      {layout.mode === "rotate" && (
        <BlockLabelRotated
          lines={layout.lines}
          fontSize={layout.fontSize}
          cx={x + width / 2}
          cy={blockY + blockH / 2}
          color={textColor}
        />
      )}
      {/* mode === "hide" → render nothing; the legend will list it. */}
    </g>
  );
}

function BlockLabelWrap({
  lines,
  fontSize,
  x,
  y,
  color,
}: {
  lines: string[];
  fontSize: number;
  x: number;
  y: number;
  color: string;
}) {
  const lineH = fontSize * 1.22;
  const startDy = -((lines.length - 1) * lineH) / 2;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={fontSize}
      fontWeight={600}
      fill={color}
      pointerEvents="none"
      style={{ userSelect: "none" }}
    >
      {lines.map((ln, i) => (
        <tspan key={i} x={x} dy={i === 0 ? startDy : lineH}>
          {ln}
        </tspan>
      ))}
    </text>
  );
}

function BlockLabelRotated({
  lines,
  fontSize,
  cx,
  cy,
  color,
}: {
  lines: string[];
  fontSize: number;
  cx: number;
  cy: number;
  color: string;
}) {
  const lineH = fontSize * 1.22;
  const startDy = -((lines.length - 1) * lineH) / 2;
  return (
    <g transform={`rotate(-90 ${cx} ${cy})`} pointerEvents="none">
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={600}
        fill={color}
        style={{ userSelect: "none" }}
      >
        {lines.map((ln, i) => (
          <tspan key={i} x={cx} dy={i === 0 ? startDy : lineH}>
            {ln}
          </tspan>
        ))}
      </text>
    </g>
  );
}
