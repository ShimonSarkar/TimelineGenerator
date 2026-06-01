import { useCallback, useEffect, useRef, useState } from "react";
import { useTimelineStore } from "../state/store";
import type { BlockGroup, Timeline } from "../model/timeline";
import { dayToX, fromDay, toDay, xToDay } from "../render/scale";

interface Props {
  rowId: string;
  group: BlockGroup;
  x: number;
  width: number;
  rowY: number;
  rowHeight: number;
  timeline: Timeline;
}

type DragMode = "move" | "resize-left" | "resize-right" | null;

/**
 * Renders interactive overlay handles on the currently-selected group:
 *  - drag body to move
 *  - drag left or right edge to resize
 * Snaps to whole-day positions.
 */
export function DragHandles({ rowId, group, x, width, rowY, rowHeight, timeline }: Props) {
  const selection = useTimelineStore((s) => s.selection);
  const updateGroup = useTimelineStore((s) => s.updateGroup);

  const selectedHere =
    (selection?.kind === "group" && selection.groupId === group.id) ||
    (selection?.kind === "block" && selection.groupId === group.id);

  const [drag, setDrag] = useState<{
    mode: DragMode;
    startX: number;
    origStart: number;
    origEnd: number;
  } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const handleDown = useCallback(
    (mode: Exclude<DragMode, null>) => (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setDrag({
        mode,
        startX: e.clientX,
        origStart: toDay(group.start, timeline),
        origEnd: toDay(group.end, timeline),
      });
    },
    [group.start, group.end, timeline],
  );

  useEffect(() => {
    if (!drag) return;
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      // Snap cursor delta to quarter-day granularity (date mode will re-snap to whole days in fromDay).
      const deltaDays = Math.round(xToDay(dx, timeline) * 4) / 4;
      let newStart = d.origStart;
      let newEnd = d.origEnd;
      if (d.mode === "move") {
        newStart = d.origStart + deltaDays;
        newEnd = d.origEnd + deltaDays;
      } else if (d.mode === "resize-left") {
        newStart = Math.min(d.origStart + deltaDays, d.origEnd);
      } else if (d.mode === "resize-right") {
        newEnd = Math.max(d.origEnd + deltaDays, d.origStart);
      }
      updateGroup(rowId, group.id, {
        start: fromDay(newStart, timeline),
        end: fromDay(newEnd, timeline),
      });
    }
    function onUp() {
      setDrag(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, timeline, rowId, group.id, updateGroup]);

  if (!selectedHere) return null;
  // Don't render move/resize handles on point groups (start === end).
  const isPoint = dayToX(toDay(group.end, timeline) - toDay(group.start, timeline), timeline) < 1;
  const handleW = 6;

  return (
    <g className="drag-handles">
      {/* Move handle (transparent overlay) */}
      {!isPoint && (
        <rect
          x={x + handleW}
          y={rowY}
          width={Math.max(0, width - handleW * 2)}
          height={rowHeight}
          fill="transparent"
          style={{ cursor: "grab" }}
          onMouseDown={handleDown("move")}
        />
      )}
      {/* Left resize */}
      {!isPoint && (
        <rect
          x={x}
          y={rowY}
          width={handleW}
          height={rowHeight}
          fill="rgba(17,24,39,0.15)"
          style={{ cursor: "ew-resize" }}
          onMouseDown={handleDown("resize-left")}
        />
      )}
      {/* Right resize */}
      {!isPoint && (
        <rect
          x={x + width - handleW}
          y={rowY}
          width={handleW}
          height={rowHeight}
          fill="rgba(17,24,39,0.15)"
          style={{ cursor: "ew-resize" }}
          onMouseDown={handleDown("resize-right")}
        />
      )}
      {/* For point groups, allow horizontal move only */}
      {isPoint && (
        <rect
          x={x - 8}
          y={rowY}
          width={16}
          height={rowHeight}
          fill="transparent"
          style={{ cursor: "ew-resize" }}
          onMouseDown={handleDown("move")}
        />
      )}
    </g>
  );
}
