import { z } from "zod";

// ----- Primitives -----

// A point in time on the timeline is either a day-offset (number) or an ISO date string.
// In "duration" mode, all values must be numbers (days).
// In "date" mode, values may be either ISO dates or numbers (interpreted as days from origin).
export const TimePointSchema = z.union([z.number(), z.string()]);
export type TimePoint = z.infer<typeof TimePointSchema>;

export const StackModeSchema = z.enum(["split", "subrows"]);
export type StackMode = z.infer<typeof StackModeSchema>;

export const BlockKindSchema = z.enum(["span", "point"]);
export type BlockKind = z.infer<typeof BlockKindSchema>;

// ----- Block -----

export const BlockSchema = z.object({
  id: z.string(),
  label: z.string().default(""),
  color: z.string().default("#4F46E5"),
  textColor: z.string().optional(),
  kind: BlockKindSchema.default("span"),
  /** When set, forces this exact font size for the label (skips auto-fit). */
  fontSize: z.number().int().min(6).max(48).optional(),
  /** Label orientation. "auto" lets the renderer choose; "horizontal"/"vertical" force a direction. */
  orientation: z.enum(["auto", "horizontal", "vertical"]).default("auto"),
  /** When true, the label is not rendered on the block (it still shows in the legend / tooltip). */
  hideLabel: z.boolean().default(false),
  /** Manual vertical offset (in px) added to the label position. Allows drag-to-reposition. */
  labelOffsetY: z.number().default(0),
});
export type Block = z.infer<typeof BlockSchema>;

// ----- Block Group -----

export const BlockGroupSchema = z.object({
  id: z.string(),
  start: TimePointSchema,
  end: TimePointSchema,
  stackMode: StackModeSchema.default("split"),
  /** Optional preferred sub-lane within the row (0 = topmost). When unset, the
   *  layout picks the first available lane greedily. */
  lane: z.number().int().min(0).optional(),
  blocks: z.array(BlockSchema).default([]),
});
export type BlockGroup = z.infer<typeof BlockGroupSchema>;

// ----- Row -----

export const RowSchema = z.object({
  id: z.string(),
  label: z.string().default(""),
  height: z.number().optional(),
  groups: z.array(BlockGroupSchema).default([]),
});
export type Row = z.infer<typeof RowSchema>;

// ----- Bracket (duration label above/below the chart) -----

export const BracketAnchorSchema = z.union([
  z.object({
    kind: z.literal("blocks"),
    fromBlockId: z.string(),
    toBlockId: z.string(),
  }),
  z.object({
    kind: z.literal("range"),
    from: TimePointSchema,
    to: TimePointSchema,
  }),
]);
export type BracketAnchor = z.infer<typeof BracketAnchorSchema>;

export const BracketSchema = z.object({
  id: z.string(),
  label: z.string().default(""),
  // "auto" derives the label from the resolved day-span (e.g., "~12 days").
  // "manual" uses the `label` field as-is.
  labelMode: z.enum(["manual", "auto"]).default("manual"),
  // Prefix/suffix used when labelMode === "auto" (default: "~" prefix, " days" suffix).
  autoPrefix: z.string().default("~"),
  autoSuffix: z.string().default(" days"),
  side: z.enum(["top", "bottom"]).default("top"),
  lane: z.number().int().min(0).default(0),
  /** Vertical offset (in px) applied to the bracket's label. Positive = away from chart. */
  labelOffsetY: z.number().default(0),
  /** Horizontal offset (in px) applied to the bracket's label only. Positive = right. */
  labelOffsetX: z.number().default(0),
  anchor: BracketAnchorSchema,
});
export type Bracket = z.infer<typeof BracketSchema>;

// ----- Guide (dashed vertical marker) -----

export const GuideSchema = z.object({
  id: z.string(),
  label: z.string().default(""),
  at: TimePointSchema,
  color: z.string().default("#2C7A7B"),
  dash: z.string().default("6 4"),
  labelPosition: z.enum(["top", "bottom"]).default("top"),
  /** Vertical offset (in px) applied to the guide's label. Positive = away from chart. */
  labelOffsetY: z.number().default(0),
  /** Horizontal offset (in px) applied to the guide's label only. Positive = right. */
  labelOffsetX: z.number().default(0),
});
export type Guide = z.infer<typeof GuideSchema>;

// ----- Timeline -----

export const TimelineSchema = z.object({
  id: z.string(),
  name: z.string().default("Untitled"),
  mode: z.enum(["duration", "date"]).default("duration"),
  origin: z.string().optional(),
  pxPerDay: z.number().positive().default(12),
  rows: z.array(RowSchema).default([]),
  brackets: z.array(BracketSchema).default([]),
  guides: z.array(GuideSchema).default([]),
  /** Ordered list of legend entry keys ("color|label"). Unknown entries are appended in discovery order. */
  legendOrder: z.array(z.string()).default([]),
});
export type Timeline = z.infer<typeof TimelineSchema>;

// ----- Selection -----

export type SelectionRef =
  | { kind: "block"; rowId: string; groupId: string; blockId: string }
  | { kind: "group"; rowId: string; groupId: string }
  | { kind: "row"; rowId: string }
  | { kind: "bracket"; id: string }
  | { kind: "guide"; id: string }
  | null;
