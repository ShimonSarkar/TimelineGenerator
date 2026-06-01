import { create } from "zustand";
import { temporal } from "zundo";
import { nanoid } from "nanoid";
import type {
  Block,
  BlockGroup,
  Bracket,
  Guide,
  Row,
  SelectionRef,
  Timeline,
} from "../model/timeline";
import { TimelineSchema } from "../model/timeline";
import { createMsrcExample } from "../data/msrcExample";

const STORAGE_KEY = "timelineGenerator:current";

function loadInitial(): Timeline {
  if (typeof window === "undefined") return createMsrcExample();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createMsrcExample();
    const parsed = TimelineSchema.parse(JSON.parse(raw));
    return parsed;
  } catch (err) {
    console.warn("Failed to load saved timeline, using example.", err);
    return createMsrcExample();
  }
}

let saveTimer: number | undefined;
function persist(timeline: Timeline) {
  if (typeof window === "undefined") return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timeline));
    } catch {
      /* ignore */
    }
  }, 250);
}

export interface TimelineState {
  timeline: Timeline;
  selection: SelectionRef;

  // selection
  select: (ref: SelectionRef) => void;

  // replace whole timeline (import / new)
  setTimeline: (t: Timeline) => void;

  // top-level mutators
  setName: (name: string) => void;
  setMode: (mode: Timeline["mode"]) => void;
  setOrigin: (origin: string | undefined) => void;
  setPxPerDay: (px: number) => void;

  // rows
  addRow: (label?: string) => void;
  updateRow: (rowId: string, patch: Partial<Row>) => void;
  removeRow: (rowId: string) => void;

  // groups
  addGroup: (rowId: string, partial?: Partial<BlockGroup>) => void;
  updateGroup: (rowId: string, groupId: string, patch: Partial<BlockGroup>) => void;
  removeGroup: (rowId: string, groupId: string) => void;

  // blocks
  addBlock: (rowId: string, groupId: string, partial?: Partial<Block>) => void;
  updateBlock: (
    rowId: string,
    groupId: string,
    blockId: string,
    patch: Partial<Block>,
  ) => void;
  removeBlock: (rowId: string, groupId: string, blockId: string) => void;

  // brackets
  addBracket: (partial?: Partial<Bracket>) => void;
  updateBracket: (id: string, patch: Partial<Bracket>) => void;
  removeBracket: (id: string) => void;

  // guides
  addGuide: (partial?: Partial<Guide>) => void;
  updateGuide: (id: string, patch: Partial<Guide>) => void;
  removeGuide: (id: string) => void;

  // legend
  setLegendOrder: (order: string[]) => void;

  deleteSelected: () => void;
}

function withTimeline(
  state: TimelineState,
  mutator: (t: Timeline) => Timeline,
): Partial<TimelineState> {
  const next = mutator(state.timeline);
  persist(next);
  return { timeline: next };
}

export const useTimelineStore = create<TimelineState>()(
  temporal(
    (set, get) => ({
      timeline: loadInitial(),
      selection: null,

      select: (ref) => set({ selection: ref }),

      setTimeline: (t) => {
        persist(t);
        set({ timeline: t, selection: null });
      },

      setName: (name) =>
        set((s) => withTimeline(s, (t) => ({ ...t, name }))),
      setMode: (mode) =>
        set((s) => withTimeline(s, (t) => ({ ...t, mode }))),
      setOrigin: (origin) =>
        set((s) => withTimeline(s, (t) => ({ ...t, origin }))),
      setPxPerDay: (pxPerDay) =>
        set((s) => withTimeline(s, (t) => ({ ...t, pxPerDay }))),

      addRow: (label = "New Row") =>
        set((s) =>
          withTimeline(s, (t) => ({
            ...t,
            rows: [...t.rows, { id: nanoid(), label, groups: [] }],
          })),
        ),
      updateRow: (rowId, patch) =>
        set((s) =>
          withTimeline(s, (t) => ({
            ...t,
            rows: t.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
          })),
        ),
      removeRow: (rowId) =>
        set((s) =>
          withTimeline(s, (t) => ({
            ...t,
            rows: t.rows.filter((r) => r.id !== rowId),
          })),
        ),

      addGroup: (rowId, partial) =>
        set((s) =>
          withTimeline(s, (t) => ({
            ...t,
            rows: t.rows.map((r) =>
              r.id !== rowId
                ? r
                : {
                    ...r,
                    groups: [
                      ...r.groups,
                      {
                        id: nanoid(),
                        start: 0,
                        end: 7,
                        stackMode: "split",
                        blocks: [
                          {
                            id: nanoid(),
                            label: "New Block",
                            color: "#4F46E5",
                            kind: "span",
                          },
                        ],
                        ...partial,
                      } as BlockGroup,
                    ],
                  },
            ),
          })),
        ),
      updateGroup: (rowId, groupId, patch) =>
        set((s) =>
          withTimeline(s, (t) => ({
            ...t,
            rows: t.rows.map((r) =>
              r.id !== rowId
                ? r
                : {
                    ...r,
                    groups: r.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
                  },
            ),
          })),
        ),
      removeGroup: (rowId, groupId) =>
        set((s) =>
          withTimeline(s, (t) => ({
            ...t,
            rows: t.rows.map((r) =>
              r.id !== rowId ? r : { ...r, groups: r.groups.filter((g) => g.id !== groupId) },
            ),
          })),
        ),

      addBlock: (rowId, groupId, partial) =>
        set((s) =>
          withTimeline(s, (t) => ({
            ...t,
            rows: t.rows.map((r) =>
              r.id !== rowId
                ? r
                : {
                    ...r,
                    groups: r.groups.map((g) =>
                      g.id !== groupId
                        ? g
                        : {
                            ...g,
                            blocks: [
                              ...g.blocks,
                              {
                                id: nanoid(),
                                label: "New Block",
                                color: "#4F46E5",
                                kind: "span",
                                ...partial,
                              } as Block,
                            ],
                          },
                    ),
                  },
            ),
          })),
        ),
      updateBlock: (rowId, groupId, blockId, patch) =>
        set((s) =>
          withTimeline(s, (t) => ({
            ...t,
            rows: t.rows.map((r) =>
              r.id !== rowId
                ? r
                : {
                    ...r,
                    groups: r.groups.map((g) =>
                      g.id !== groupId
                        ? g
                        : {
                            ...g,
                            blocks: g.blocks.map((b) =>
                              b.id === blockId ? { ...b, ...patch } : b,
                            ),
                          },
                    ),
                  },
            ),
          })),
        ),
      removeBlock: (rowId, groupId, blockId) =>
        set((s) =>
          withTimeline(s, (t) => ({
            ...t,
            rows: t.rows.map((r) =>
              r.id !== rowId
                ? r
                : {
                    ...r,
                    groups: r.groups.map((g) =>
                      g.id !== groupId
                        ? g
                        : { ...g, blocks: g.blocks.filter((b) => b.id !== blockId) },
                    ),
                  },
            ),
          })),
        ),

      addBracket: (partial) =>
        set((s) =>
          withTimeline(s, (t) => ({
            ...t,
            brackets: [
              ...t.brackets,
              {
                id: nanoid(),
                label: "label",
                labelMode: "auto",
                autoPrefix: "~",
                autoSuffix: " days",
                side: "top",
                lane: 0,
                anchor: { kind: "range", from: 0, to: 10 },
                ...partial,
              } as Bracket,
            ],
          })),
        ),
      updateBracket: (id, patch) =>
        set((s) =>
          withTimeline(s, (t) => ({
            ...t,
            brackets: t.brackets.map((b) => (b.id === id ? { ...b, ...patch } : b)),
          })),
        ),
      removeBracket: (id) =>
        set((s) =>
          withTimeline(s, (t) => ({
            ...t,
            brackets: t.brackets.filter((b) => b.id !== id),
          })),
        ),

      addGuide: (partial) =>
        set((s) =>
          withTimeline(s, (t) => ({
            ...t,
            guides: [
              ...t.guides,
              {
                id: nanoid(),
                label: "Marker",
                at: 0,
                color: "#2C7A7B",
                dash: "6 4",
                labelPosition: "top",
                ...partial,
              } as Guide,
            ],
          })),
        ),
      updateGuide: (id, patch) =>
        set((s) =>
          withTimeline(s, (t) => ({
            ...t,
            guides: t.guides.map((g) => (g.id === id ? { ...g, ...patch } : g)),
          })),
        ),
      removeGuide: (id) =>
        set((s) =>
          withTimeline(s, (t) => ({ ...t, guides: t.guides.filter((g) => g.id !== id) })),
        ),

      setLegendOrder: (order) =>
        set((s) => withTimeline(s, (t) => ({ ...t, legendOrder: order }))),

      deleteSelected: () => {
        const sel = get().selection;
        if (!sel) return;
        const s = get();
        if (sel.kind === "block") s.removeBlock(sel.rowId, sel.groupId, sel.blockId);
        else if (sel.kind === "group") s.removeGroup(sel.rowId, sel.groupId);
        else if (sel.kind === "row") s.removeRow(sel.rowId);
        else if (sel.kind === "bracket") s.removeBracket(sel.id);
        else if (sel.kind === "guide") s.removeGuide(sel.id);
        set({ selection: null });
      },
    }),
    {
      partialize: (state) => ({ timeline: state.timeline }) as TimelineState,
      limit: 100,
    },
  ),
);
