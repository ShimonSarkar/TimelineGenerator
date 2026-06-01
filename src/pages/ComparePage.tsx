import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { TimelineCanvas } from "../components/TimelineCanvas";
import { TimelineSchema, type Timeline } from "../model/timeline";
import {
  comparisonsApi,
  timelinesApi,
  type ComparisonRecord,
  type TimelineRecord,
} from "../io/api";
import { timelineSpan } from "../render/scale";
import "../App.css";

type Theme = "light" | "dark";
type Point = { x: number; y: number };

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("tlg-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Compute the union day-domain across all timelines so they share a horizontal axis. */
function unionDomain(timelines: Timeline[]): { minDay: number; maxDay: number } {
  let min = 0;
  let max = 1;
  let first = true;
  for (const t of timelines) {
    const s = timelineSpan(t);
    const lo = Math.min(0, Math.floor(s.min));
    const hi = Math.max(Math.ceil(s.max), lo + 1);
    if (first) {
      min = lo;
      max = hi;
      first = false;
    } else {
      min = Math.min(min, lo);
      max = Math.max(max, hi);
    }
  }
  return { minDay: min, maxDay: max };
}

const STAGE_PAD = 400; // empty space around panels in the world
const DEFAULT_PANEL_GAP = 32;
const DEFAULT_PANEL_HEIGHT_GUESS = 520;

export function ComparePage() {
  const [params] = useSearchParams();
  const { id: savedId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [savedRecord, setSavedRecord] = useState<ComparisonRecord | null>(null);
  const [savedName, setSavedName] = useState<string>("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // When loading a saved comparison, fetch it first so we know which timelines to load.
  useEffect(() => {
    if (!savedId) {
      setSavedRecord(null);
      setSavedName("");
      return;
    }
    let cancelled = false;
    comparisonsApi
      .get(savedId)
      .then((rec) => {
        if (cancelled) return;
        setSavedRecord(rec);
        setSavedName(rec.name);
      })
      .catch((err) => {
        if (cancelled) return;
        setSaveError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [savedId]);

  const ids = useMemo(() => {
    if (savedRecord) return savedRecord.data.timelineIds;
    const raw = params.get("ids") ?? "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [savedRecord, params]);
  const positionsKey = useMemo(
    () => (savedId ? `tlg-compare-positions:saved:${savedId}` : `tlg-compare-positions:${ids.join(",")}`),
    [savedId, ids],
  );

  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [sources, setSources] = useState<TimelineRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pxPerDayOverride, setPxPerDayOverride] = useState<number | null>(null);
  const [hiddenLegends, setHiddenLegends] = useState<Set<string>>(new Set());
  /** Figma-style canvas zoom for the whole stage (1 = 100%). */
  const [viewZoom, setViewZoom] = useState(1);
  const viewZoomRef = useRef(viewZoom);
  useEffect(() => {
    viewZoomRef.current = viewZoom;
  }, [viewZoom]);

  // Per-panel position (top-left in world coordinates) and measured size.
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});

  const stageRef = useRef<HTMLDivElement | null>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function toggleLegend(id: string) {
    setHiddenLegends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("tlg-theme", theme);
  }, [theme]);

  // Load any persisted layout for this combination of timelines.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(positionsKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, Point>;
      if (parsed && typeof parsed === "object") setPositions(parsed);
    } catch {
      /* ignore */
    }
  }, [positionsKey]);

  // Persist layout whenever positions change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Object.keys(positions).length === 0) return;
    window.localStorage.setItem(positionsKey, JSON.stringify(positions));
  }, [positions, positionsKey]);

  // Fetch.
  useEffect(() => {
    if (savedId && !savedRecord) return; // wait for saved record first
    if (ids.length === 0) {
      setError("No timelines selected. Add ?ids=a,b,c to the URL.");
      return;
    }
    let cancelled = false;
    setError(null);
    setSources(null);
    Promise.all(ids.map((id) => timelinesApi.get(id)))
      .then((recs) => {
        if (cancelled) return;
        setSources(recs);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const parsed = useMemo<Timeline[] | null>(() => {
    if (!sources) return null;
    try {
      return sources.map((rec) => TimelineSchema.parse(rec.timeline));
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [sources]);

  const basePxPerDay = parsed?.[0]?.pxPerDay ?? 12;
  const pxPerDay = pxPerDayOverride ?? basePxPerDay;

  const normalized = useMemo<Timeline[] | null>(() => {
    if (!parsed) return null;
    return parsed.map((t) => ({ ...t, pxPerDay }));
  }, [parsed, pxPerDay]);

  const domain = useMemo(
    () => (normalized ? unionDomain(normalized) : { minDay: 0, maxDay: 1 }),
    [normalized],
  );

  // Initialize missing positions whenever the set of panels changes. New panels are
  // stacked below already-positioned ones using a height guess (refined once measured).
  useEffect(() => {
    if (!normalized) return;
    setPositions((prev) => {
      let nextY = 0;
      const next: Record<string, Point> = { ...prev };
      let changed = false;
      for (const t of normalized) {
        if (!next[t.id]) {
          next[t.id] = { x: 0, y: nextY };
          nextY += DEFAULT_PANEL_HEIGHT_GUESS + DEFAULT_PANEL_GAP;
          changed = true;
        } else {
          nextY = Math.max(nextY, next[t.id].y + DEFAULT_PANEL_HEIGHT_GUESS + DEFAULT_PANEL_GAP);
        }
      }
      return changed ? next : prev;
    });
  }, [normalized]);

  // Measure each panel after it renders so the world sizes itself correctly.
  useLayoutEffect(() => {
    if (!normalized) return;
    const observers: ResizeObserver[] = [];
    for (const t of normalized) {
      const el = panelRefs.current[t.id];
      if (!el) continue;
      const ro = new ResizeObserver((entries) => {
        const rect = entries[0].contentRect;
        setSizes((prev) => {
          const cur = prev[t.id];
          if (cur && cur.w === rect.width && cur.h === rect.height) return prev;
          return { ...prev, [t.id]: { w: rect.width, h: rect.height } };
        });
      });
      ro.observe(el);
      observers.push(ro);
    }
    return () => {
      for (const o of observers) o.disconnect();
    };
  }, [normalized]);

  // World size = right/bottom-most panel edge + buffer.
  const worldSize = useMemo(() => {
    let w = 2000;
    let h = 1500;
    for (const id of Object.keys(positions)) {
      const p = positions[id];
      const s = sizes[id];
      if (!p || !s) continue;
      w = Math.max(w, p.x + s.w + STAGE_PAD);
      h = Math.max(h, p.y + s.h + STAGE_PAD);
    }
    return { w, h };
  }, [positions, sizes]);

  // --- Panning the stage by dragging empty area ---
  const panState = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);
  const onStageMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    // Only pan when the user grabbed the background, not a panel.
    const target = e.target as HTMLElement;
    if (target.closest(".compare-panel")) return;
    const stage = stageRef.current;
    if (!stage) return;
    e.preventDefault();
    panState.current = {
      x: e.clientX,
      y: e.clientY,
      sx: stage.scrollLeft,
      sy: stage.scrollTop,
    };
    stage.classList.add("panning");
    function onMove(ev: MouseEvent) {
      const st = panState.current;
      if (!st || !stageRef.current) return;
      stageRef.current.scrollLeft = st.sx - (ev.clientX - st.x);
      stageRef.current.scrollTop = st.sy - (ev.clientY - st.y);
    }
    function onUp() {
      panState.current = null;
      stageRef.current?.classList.remove("panning");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // --- Wheel zoom (Ctrl/Cmd + wheel) centered on the cursor, Figma-style. ---
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    function onWheel(ev: WheelEvent) {
      if (!ev.ctrlKey && !ev.metaKey) return; // plain scroll = pan/scroll, ignored
      ev.preventDefault();
      const stageEl = stageRef.current;
      if (!stageEl) return;
      const rect = stageEl.getBoundingClientRect();
      const cx = ev.clientX - rect.left; // cursor in stage-viewport px
      const cy = ev.clientY - rect.top;
      const z0 = viewZoomRef.current;
      // Exponential zoom feels right; trackpad pinch sends many small deltas.
      const factor = Math.exp(-ev.deltaY * 0.0015);
      const z1 = Math.min(4, Math.max(0.1, z0 * factor));
      if (z1 === z0) return;
      // World point currently under the cursor (in world units).
      const worldX = (stageEl.scrollLeft + cx) / z0;
      const worldY = (stageEl.scrollTop + cy) / z0;
      viewZoomRef.current = z1;
      setViewZoom(z1);
      // After scaling, adjust scroll so that same world point stays under cursor.
      requestAnimationFrame(() => {
        const el = stageRef.current;
        if (!el) return;
        el.scrollLeft = worldX * z1 - cx;
        el.scrollTop = worldY * z1 - cy;
      });
    }
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  // --- Dragging an individual panel by its header handle ---
  const dragState = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const onHandleMouseDown = useCallback((id: string) => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = positions[id] ?? { x: 0, y: 0 };
    dragState.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    function onMove(ev: MouseEvent) {
      const st = dragState.current;
      if (!st) return;
      const z = viewZoomRef.current || 1;
      const dx = (ev.clientX - st.startX) / z;
      const dy = (ev.clientY - st.startY) / z;
      setPositions((prev) => ({
        ...prev,
        [st.id]: { x: Math.max(0, st.origX + dx), y: Math.max(0, st.origY + dy) },
      }));
    }
    function onUp() {
      dragState.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [positions]);

  const incompatibleModes =
    normalized && normalized.length > 1
      ? new Set(normalized.map((s) => s.mode)).size > 1
      : false;

  function autoStack() {
    if (!normalized) return;
    let y = 0;
    const next: Record<string, Point> = {};
    for (const t of normalized) {
      next[t.id] = { x: 0, y };
      y += (sizes[t.id]?.h ?? DEFAULT_PANEL_HEIGHT_GUESS) + DEFAULT_PANEL_GAP;
    }
    setPositions(next);
    stageRef.current?.scrollTo({ top: 0, left: 0 });
  }

  // Hydrate from a freshly loaded saved comparison.
  const hydratedForId = useRef<string | null>(null);
  useEffect(() => {
    if (!savedRecord) return;
    if (hydratedForId.current === savedRecord.id) return;
    hydratedForId.current = savedRecord.id;
    const d = savedRecord.data;
    setPositions(d.positions || {});
    setPxPerDayOverride(typeof d.pxPerDayOverride === "number" ? d.pxPerDayOverride : null);
    setViewZoom(typeof d.viewZoom === "number" ? d.viewZoom : 1);
    setHiddenLegends(new Set(d.hiddenLegends || []));
  }, [savedRecord]);

  // Auto-save (debounced) when on a saved comparison and state changes.
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!savedId) return;
    if (hydratedForId.current !== savedId) return; // wait until initial hydration
    if (ids.length < 2) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    saveTimerRef.current = window.setTimeout(() => {
      comparisonsApi
        .update(savedId, savedName || "Untitled comparison", {
          timelineIds: ids,
          positions,
          pxPerDayOverride,
          viewZoom,
          hiddenLegends: Array.from(hiddenLegends),
        })
        .then(() => setSaveState("saved"))
        .catch((err) => {
          setSaveError((err as Error).message);
          setSaveState("error");
        });
    }, 700);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [savedId, savedName, ids, positions, pxPerDayOverride, viewZoom, hiddenLegends]);

  async function saveAsNew() {
    if (ids.length < 2) return;
    const name = window.prompt(
      "Name this comparison",
      `Comparison of ${ids.length} timelines`,
    );
    if (!name) return;
    setSaveState("saving");
    setSaveError(null);
    try {
      const rec = await comparisonsApi.create(name, {
        timelineIds: ids,
        positions,
        pxPerDayOverride,
        viewZoom,
        hiddenLegends: Array.from(hiddenLegends),
      });
      setSaveState("saved");
      navigate(`/compare/${rec.id}`);
    } catch (err) {
      setSaveError((err as Error).message);
      setSaveState("error");
    }
  }

  async function renameSaved() {
    if (!savedId) return;
    const next = window.prompt("Rename comparison", savedName);
    if (!next || next === savedName) return;
    setSaveState("saving");
    try {
      await comparisonsApi.rename(savedId, next);
      setSavedName(next);
      setSaveState("saved");
    } catch (err) {
      setSaveError((err as Error).message);
      setSaveState("error");
    }
  }

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
      ? "Saved"
      : saveState === "error"
      ? "Save failed"
      : savedId
      ? "Saved"
      : "Save comparison";

  return (
    <div className="app">
      <div className="app-bar">
        <Link to="/" className="home-link" title="Back to all timelines">
          ← All timelines
        </Link>
        <div className="app-bar-actions">
          {savedId ? (
            <span className="compare-badge" title="Saved comparison">
              ⤓ {savedName || "Untitled comparison"}
            </span>
          ) : (
            <span className="compare-badge">Comparison view · read-only</span>
          )}
          <label className="zoom">
            Zoom
            <input
              className="zoom-slider"
              type="range"
              min={4}
              max={48}
              step={1}
              value={pxPerDay}
              onChange={(e) => setPxPerDayOverride(Number(e.target.value))}
            />
            <input
              className="zoom-number"
              type="number"
              min={1}
              max={200}
              step={1}
              value={pxPerDay}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n > 0) {
                  setPxPerDayOverride(Math.min(200, Math.max(1, Math.round(n))));
                }
              }}
              title="Pixels per day"
            />
            <span className="zoom-unit">px/d</span>
          </label>
          <button className="bar-btn" onClick={autoStack} title="Stack panels vertically from origin">
            ⇅ Auto-stack
          </button>
          <div className="view-zoom" title="Canvas zoom · Ctrl+scroll to zoom">
            <button
              className="bar-btn"
              onClick={() => setViewZoom((z) => Math.max(0.1, +(z / 1.2).toFixed(3)))}
              title="Zoom out"
            >
              −
            </button>
            <button
              className="bar-btn view-zoom-label"
              onClick={() => setViewZoom(1)}
              title="Reset to 100%"
            >
              {Math.round(viewZoom * 100)}%
            </button>
            <button
              className="bar-btn"
              onClick={() => setViewZoom((z) => Math.min(4, +(z * 1.2).toFixed(3)))}
              title="Zoom in"
            >
              +
            </button>
          </div>
          <button
            className="bar-btn"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            title="Toggle theme"
          >
            {theme === "light" ? "☾ Dark" : "☼ Light"}
          </button>
          {savedId && (
            <button
              className="bar-btn"
              onClick={renameSaved}
              title="Rename this comparison"
            >
              Rename
            </button>
          )}
          <button
            className="primary"
            onClick={savedId ? undefined : saveAsNew}
            disabled={ids.length < 2 || (!!savedId && saveState !== "error")}
            title={
              savedId
                ? saveState === "error"
                  ? saveError ?? "Retry save"
                  : "Auto-saving"
                : ids.length < 2
                ? "Need at least 2 timelines"
                : "Save this comparison so it shows up on the home page"
            }
          >
            {saveLabel}
          </button>
        </div>
      </div>
      <div className="compare-sources">
        <span className="compare-sources-label">Comparing:</span>
        {sources?.map((rec, i) => (
          <span key={rec.id} className="compare-source-chip">
            <span className="compare-source-dot" data-i={i % 6} />
            <Link to={`/t/${rec.id}`}>{rec.timeline.name || "Untitled"}</Link>
          </span>
        ))}
        {incompatibleModes && (
          <span className="compare-warning">
            ⚠ These timelines use different axis modes — horizontal alignment may be off.
          </span>
        )}
        <span className="compare-hint">Drag the header to move a timeline · drag empty space to pan</span>
      </div>
      {error && <div className="home-error">{error}</div>}

      <div
        ref={stageRef}
        className="compare-stage"
        onMouseDown={onStageMouseDown}
      >
        <div
          className="compare-world-scaled"
          style={{ width: worldSize.w * viewZoom, height: worldSize.h * viewZoom }}
        >
          <div
            className="compare-world"
            style={{
              width: worldSize.w,
              height: worldSize.h,
              transform: `scale(${viewZoom})`,
              transformOrigin: "0 0",
            }}
          >
          {normalized?.map((t, i) => {
            const pos = positions[t.id] ?? { x: 0, y: i * DEFAULT_PANEL_HEIGHT_GUESS };
            return (
              <div
                key={t.id + "-" + i}
                ref={(el) => {
                  panelRefs.current[t.id] = el;
                }}
                className="compare-panel"
                style={{ left: pos.x, top: pos.y }}
              >
                <div
                  className="compare-panel-handle"
                  onMouseDown={onHandleMouseDown(t.id)}
                  title="Drag to move"
                >
                  <span className="compare-source-dot" data-i={i % 6} />
                  <span className="compare-panel-title">{t.name || "Untitled"}</span>
                  <label
                    className="compare-legend-toggle"
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Show/hide legend"
                  >
                    <input
                      type="checkbox"
                      checked={!hiddenLegends.has(t.id)}
                      onChange={() => toggleLegend(t.id)}
                    />
                    <span>Legend</span>
                  </label>
                  <Link
                    to={`/t/${t.id}`}
                    className="compare-panel-edit"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    Open editor →
                  </Link>
                </div>
                <div className="compare-panel-body">
                  <TimelineCanvas
                    timeline={t}
                    domain={domain}
                    readOnly
                    hideLegend={hiddenLegends.has(t.id)}
                  />
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
