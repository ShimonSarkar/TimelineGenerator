import { HexColorPicker } from "react-colorful";
import { useTimelineStore } from "../state/store";
import type { Block, Bracket, BlockGroup, Guide, Row, Timeline } from "../model/timeline";
import { collectLegendItems } from "./Legend";

const PRESETS = [
  "#4B1E5C",
  "#D8602A",
  "#F3B58A",
  "#1F4E8C",
  "#A9C7E8",
  "#D946EF",
  "#2C7A7B",
  "#10B981",
  "#EF4444",
  "#F59E0B",
  "#6366F1",
  "#111827",
];

export function Inspector() {
  const selection = useTimelineStore((s) => s.selection);
  const timeline = useTimelineStore((s) => s.timeline);
  const deleteSelected = useTimelineStore((s) => s.deleteSelected);

  if (!selection) {
    return (
      <div className="inspector">
        <h3>Inspector</h3>
        <p className="hint">Click a block, guide, or bracket on the canvas to edit it.</p>
        <TimelinePropsPanel timeline={timeline} />
        <LegendOrderPanel timeline={timeline} />
      </div>
    );
  }

  return (
    <div className="inspector">
      <div className="inspector-header">
        <h3>Inspector</h3>
        <button className="danger" onClick={deleteSelected} title="Delete (or press Delete)">
          Delete
        </button>
      </div>
      {selection.kind === "block" && <BlockPanel selection={selection} />}
      {selection.kind === "group" && <GroupPanel selection={selection} />}
      {selection.kind === "row" && <RowPanel selection={selection} />}
      {selection.kind === "bracket" && <BracketPanel id={selection.id} />}
      {selection.kind === "guide" && <GuidePanel id={selection.id} />}
    </div>
  );
}

// ---------- Sub-panels ----------

function TimelinePropsPanel({ timeline }: { timeline: Timeline }) {
  return (
    <div className="panel">
      <h4>Timeline</h4>
      <Field label="Name">
        <span>{timeline.name}</span>
      </Field>
      <Field label="Mode">
        <span>{timeline.mode}</span>
      </Field>
      <Field label="Rows">
        <span>{timeline.rows.length}</span>
      </Field>
      <Field label="Brackets">
        <span>{timeline.brackets.length}</span>
      </Field>
      <Field label="Guides">
        <span>{timeline.guides.length}</span>
      </Field>
    </div>
  );
}

function LegendOrderPanel({ timeline }: { timeline: Timeline }) {
  const setLegendOrder = useTimelineStore((s) => s.setLegendOrder);
  const select = useTimelineStore((s) => s.select);
  const items = collectLegendItems(timeline);
  if (items.length === 0) return null;

  const move = (idx: number, delta: number) => {
    const j = idx + delta;
    if (j < 0 || j >= items.length) return;
    const newOrder = items.map((it) => it.key);
    [newOrder[idx], newOrder[j]] = [newOrder[j], newOrder[idx]];
    setLegendOrder(newOrder);
  };

  return (
    <div className="panel">
      <h4>Legend</h4>
      <p className="hint">Click an entry to edit its block. Use the arrows to reorder.</p>
      <ul className="legend-list">
        {items.map((it, i) => (
          <li key={it.key} className="legend-list-item">
            <span
              className="legend-swatch"
              style={{ background: it.color }}
              aria-hidden
            />
            <button
              className="legend-label"
              title="Edit this block"
              onClick={() => select({ kind: "block", ...it.ref })}
            >
              {it.label}
            </button>
            <span className="legend-reorder">
              <button
                className="icon-btn"
                title="Move up"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                className="icon-btn"
                title="Move down"
                disabled={i === items.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ul>
      {(timeline.legendOrder?.length ?? 0) > 0 && (
        <button className="link" onClick={() => setLegendOrder([])}>
          Reset to default order
        </button>
      )}
    </div>
  );
}

function BlockPanel({
  selection,
}: {
  selection: Extract<NonNullable<ReturnType<typeof useTimelineStore.getState>["selection"]>, { kind: "block" }>;
}) {
  const timeline = useTimelineStore((s) => s.timeline);
  const updateBlock = useTimelineStore((s) => s.updateBlock);
  const updateGroup = useTimelineStore((s) => s.updateGroup);
  const row = timeline.rows.find((r) => r.id === selection.rowId);
  const group = row?.groups.find((g) => g.id === selection.groupId);
  const block = group?.blocks.find((b) => b.id === selection.blockId);
  if (!row || !group || !block) return <p>Selection no longer exists.</p>;

  return (
    <div className="panel">
      <h4>Block</h4>
      <Field label="Label">
        <textarea
          rows={3}
          value={block.label}
          onChange={(e) => updateBlock(row.id, group.id, block.id, { label: e.target.value })}
        />
      </Field>
      <Field label="Kind">
        <select
          value={block.kind}
          onChange={(e) =>
            updateBlock(row.id, group.id, block.id, { kind: e.target.value as Block["kind"] })
          }
        >
          <option value="span">Span (start → end)</option>
          <option value="point">Point (end only)</option>
        </select>
      </Field>
      <Field label="Color">
        <ColorField
          value={block.color}
          onChange={(c) => updateBlock(row.id, group.id, block.id, { color: c })}
        />
      </Field>
      <Field label="Text color (optional)">
        <input
          type="color"
          value={block.textColor ?? "#ffffff"}
          onChange={(e) =>
            updateBlock(row.id, group.id, block.id, { textColor: e.target.value })
          }
        />
        <button
          className="link"
          onClick={() => updateBlock(row.id, group.id, block.id, { textColor: undefined })}
        >
          auto
        </button>
      </Field>
      <Field label="Font size">
        <input
          type="number"
          min={6}
          max={48}
          value={block.fontSize ?? ""}
          placeholder="auto"
          onChange={(e) =>
            updateBlock(row.id, group.id, block.id, {
              fontSize: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
        {block.fontSize !== undefined && (
          <button
            className="link"
            onClick={() => updateBlock(row.id, group.id, block.id, { fontSize: undefined })}
          >
            auto
          </button>
        )}
      </Field>
      <Field label="Orientation">
        <select
          value={block.orientation}
          onChange={(e) =>
            updateBlock(row.id, group.id, block.id, {
              orientation: e.target.value as Block["orientation"],
            })
          }
        >
          <option value="auto">Auto</option>
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
        </select>
      </Field>
      <Field label="Show label">
        <label className="inline-check">
          <input
            type="checkbox"
            checked={!block.hideLabel}
            onChange={(e) =>
              updateBlock(row.id, group.id, block.id, { hideLabel: !e.target.checked })
            }
          />
          <span>Display label inside block</span>
        </label>
      </Field>

      <hr />
      <h4>Placement</h4>
      <Field label="Start">
        <TimePointInput
          value={group.start}
          onChange={(v) => updateGroup(row.id, group.id, { start: v })}
        />
      </Field>
      <Field label="End">
        <TimePointInput
          value={group.end}
          onChange={(v) => updateGroup(row.id, group.id, { end: v })}
        />
      </Field>
      <Field label="Stack position">
        <div className="lane-control">
          <button
            className="icon-btn"
            title="Move up (lower lane number)"
            onClick={() =>
              updateGroup(row.id, group.id, { lane: Math.max(0, (group.lane ?? 0) - 1) })
            }
          >
            ↑
          </button>
          <input
            type="number"
            min={0}
            value={group.lane ?? ""}
            placeholder="auto"
            onChange={(e) =>
              updateGroup(row.id, group.id, {
                lane: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)),
              })
            }
            title="0 = topmost. Leave blank for automatic placement."
          />
          <button
            className="icon-btn"
            title="Move down (higher lane number)"
            onClick={() =>
              updateGroup(row.id, group.id, { lane: (group.lane ?? 0) + 1 })
            }
          >
            ↓
          </button>
          {group.lane !== undefined && (
            <button
              className="link"
              onClick={() => updateGroup(row.id, group.id, { lane: undefined })}
            >
              auto
            </button>
          )}
        </div>
      </Field>
    </div>
  );
}

function GroupPanel({
  selection,
}: {
  selection: Extract<NonNullable<ReturnType<typeof useTimelineStore.getState>["selection"]>, { kind: "group" }>;
}) {
  const timeline = useTimelineStore((s) => s.timeline);
  const updateGroup = useTimelineStore((s) => s.updateGroup);
  const addBlock = useTimelineStore((s) => s.addBlock);
  const row = timeline.rows.find((r) => r.id === selection.rowId);
  const group = row?.groups.find((g) => g.id === selection.groupId);
  if (!row || !group) return null;

  return (
    <div className="panel">
      <h4>Block Group</h4>
      <Field label="Start">
        <TimePointInput
          value={group.start}
          onChange={(v) => updateGroup(row.id, group.id, { start: v })}
        />
      </Field>
      <Field label="End">
        <TimePointInput
          value={group.end}
          onChange={(v) => updateGroup(row.id, group.id, { end: v })}
        />
      </Field>
      <Field label="Stack mode">
        <select
          value={group.stackMode}
          onChange={(e) =>
            updateGroup(row.id, group.id, { stackMode: e.target.value as BlockGroup["stackMode"] })
          }
        >
          <option value="split">Split</option>
          <option value="subrows">Subrows</option>
        </select>
      </Field>
      <button onClick={() => addBlock(row.id, group.id)}>+ Add Block</button>
    </div>
  );
}

function RowPanel({
  selection,
}: {
  selection: Extract<NonNullable<ReturnType<typeof useTimelineStore.getState>["selection"]>, { kind: "row" }>;
}) {
  const timeline = useTimelineStore((s) => s.timeline);
  const updateRow = useTimelineStore((s) => s.updateRow);
  const addGroup = useTimelineStore((s) => s.addGroup);
  const row = timeline.rows.find((r) => r.id === selection.rowId);
  if (!row) return null;
  return (
    <div className="panel">
      <h4>Row</h4>
      <Field label="Label">
        <textarea
          rows={2}
          value={row.label}
          onChange={(e) => updateRow(row.id, { label: e.target.value } as Partial<Row>)}
        />
      </Field>
      <Field label="Height (px)">
        <input
          type="number"
          value={row.height ?? ""}
          placeholder="auto"
          onChange={(e) =>
            updateRow(row.id, { height: e.target.value ? Number(e.target.value) : undefined })
          }
        />
      </Field>
      <button onClick={() => addGroup(row.id)}>+ Add Block</button>
    </div>
  );
}

function BracketPanel({ id }: { id: string }) {
  const timeline = useTimelineStore((s) => s.timeline);
  const updateBracket = useTimelineStore((s) => s.updateBracket);
  const bracket = timeline.brackets.find((b) => b.id === id);
  if (!bracket) return null;
  return (
    <div className="panel">
      <h4>Bracket</h4>
      <Field label="Label mode">
        <select
          value={bracket.labelMode}
          onChange={(e) =>
            updateBracket(id, { labelMode: e.target.value as Bracket["labelMode"] })
          }
        >
          <option value="auto">Auto (from duration)</option>
          <option value="manual">Manual</option>
        </select>
      </Field>
      {bracket.labelMode === "manual" ? (
        <Field label="Label">
          <input
            value={bracket.label}
            onChange={(e) => updateBracket(id, { label: e.target.value })}
          />
        </Field>
      ) : (
        <>
          <Field label="Prefix">
            <input
              value={bracket.autoPrefix}
              onChange={(e) => updateBracket(id, { autoPrefix: e.target.value })}
            />
          </Field>
          <Field label="Suffix">
            <input
              value={bracket.autoSuffix}
              onChange={(e) => updateBracket(id, { autoSuffix: e.target.value })}
            />
          </Field>
        </>
      )}
      <Field label="Side">
        <select
          value={bracket.side}
          onChange={(e) => updateBracket(id, { side: e.target.value as Bracket["side"] })}
        >
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
        </select>
      </Field>
      <Field label="Lane">
        <input
          type="number"
          min={0}
          value={bracket.lane}
          onChange={(e) => updateBracket(id, { lane: Number(e.target.value) })}
        />
      </Field>
      <Field label="Label offset Y (px)">
        <input
          type="number"
          value={bracket.labelOffsetY ?? 0}
          onChange={(e) => updateBracket(id, { labelOffsetY: Number(e.target.value) })}
        />
      </Field>
      <Field label="Label offset X (px)">
        <input
          type="number"
          value={bracket.labelOffsetX ?? 0}
          onChange={(e) => updateBracket(id, { labelOffsetX: Number(e.target.value) })}
        />
      </Field>
      <Field label="Anchor type">
        <select
          value={bracket.anchor.kind}
          onChange={(e) => {
            const kind = e.target.value as "blocks" | "range";
            if (kind === "blocks") {
              const firstBlock = timeline.rows[0]?.groups[0]?.blocks[0]?.id ?? "";
              updateBracket(id, {
                anchor: { kind: "blocks", fromBlockId: firstBlock, toBlockId: firstBlock },
              });
            } else {
              updateBracket(id, { anchor: { kind: "range", from: 0, to: 10 } });
            }
          }}
        >
          <option value="blocks">Span between blocks</option>
          <option value="range">Absolute range</option>
        </select>
      </Field>
      {bracket.anchor.kind === "blocks" ? (
        <>
          <Field label="From block">
            <BlockSelect
              value={bracket.anchor.fromBlockId}
              onChange={(v) =>
                bracket.anchor.kind === "blocks" &&
                updateBracket(id, { anchor: { ...bracket.anchor, fromBlockId: v } })
              }
            />
          </Field>
          <Field label="To block">
            <BlockSelect
              value={bracket.anchor.toBlockId}
              onChange={(v) =>
                bracket.anchor.kind === "blocks" &&
                updateBracket(id, { anchor: { ...bracket.anchor, toBlockId: v } })
              }
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="From">
            <TimePointInput
              value={bracket.anchor.from}
              onChange={(v) =>
                bracket.anchor.kind === "range" &&
                updateBracket(id, { anchor: { ...bracket.anchor, from: v } })
              }
            />
          </Field>
          <Field label="To">
            <TimePointInput
              value={bracket.anchor.to}
              onChange={(v) =>
                bracket.anchor.kind === "range" &&
                updateBracket(id, { anchor: { ...bracket.anchor, to: v } })
              }
            />
          </Field>
        </>
      )}
    </div>
  );
}

function GuidePanel({ id }: { id: string }) {
  const timeline = useTimelineStore((s) => s.timeline);
  const updateGuide = useTimelineStore((s) => s.updateGuide);
  const guide = timeline.guides.find((g) => g.id === id);
  if (!guide) return null;
  return (
    <div className="panel">
      <h4>Guide</h4>
      <Field label="Label">
        <textarea
          rows={2}
          value={guide.label}
          onChange={(e) => updateGuide(id, { label: e.target.value })}
        />
      </Field>
      <Field label="At">
        <TimePointInput value={guide.at} onChange={(v) => updateGuide(id, { at: v })} />
      </Field>
      <Field label="Color">
        <ColorField value={guide.color} onChange={(c) => updateGuide(id, { color: c })} />
      </Field>
      <Field label="Dash">
        <input
          value={guide.dash}
          onChange={(e) => updateGuide(id, { dash: e.target.value })}
        />
      </Field>
      <Field label="Label position">
        <select
          value={guide.labelPosition}
          onChange={(e) =>
            updateGuide(id, { labelPosition: e.target.value as Guide["labelPosition"] })
          }
        >
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
        </select>
      </Field>
      <Field label="Label offset Y (px)">
        <input
          type="number"
          value={guide.labelOffsetY ?? 0}
          onChange={(e) => updateGuide(id, { labelOffsetY: Number(e.target.value) })}
        />
      </Field>
      <Field label="Label offset X (px)">
        <input
          type="number"
          value={guide.labelOffsetX ?? 0}
          onChange={(e) => updateGuide(id, { labelOffsetX: Number(e.target.value) })}
        />
      </Field>
    </div>
  );
}

// ---------- Helpers ----------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <span className="control">{children}</span>
    </label>
  );
}

function TimePointInput({
  value,
  onChange,
}: {
  value: number | string;
  onChange: (v: number | string) => void;
}) {
  const timeline = useTimelineStore((s) => s.timeline);
  if (timeline.mode === "date") {
    const v = typeof value === "string" ? value : "";
    return (
      <input
        type="date"
        value={v}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  const v = typeof value === "number" ? value : Number(value) || 0;
  return (
    <input
      type="number"
      value={v}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function BlockSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const timeline = useTimelineStore((s) => s.timeline);
  const opts: { id: string; label: string }[] = [];
  for (const r of timeline.rows) {
    for (const g of r.groups) {
      for (const b of g.blocks) {
        opts.push({ id: b.id, label: `${r.label} / ${b.label || "(block)"}` });
      }
    }
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {opts.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="color-field">
      <HexColorPicker color={value} onChange={onChange} />
      <input value={value} onChange={(e) => onChange(e.target.value)} />
      <div className="presets">
        {PRESETS.map((c) => (
          <button
            key={c}
            className="swatch"
            style={{ background: c }}
            onClick={() => onChange(c)}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}
