import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "zustand";
import { Toolbar } from "./components/Toolbar";
import { Inspector } from "./components/Inspector";
import { JsonEditor } from "./components/JsonEditor";
import { TimelineCanvas } from "./components/TimelineCanvas";
import { useTimelineStore } from "./state/store";
import { TimelineSchema } from "./model/timeline";
import { timelinesApi } from "./io/api";
import "./App.css";

type Theme = "light" | "dark";
type SyncState = "idle" | "loading" | "saving" | "saved" | "error";

const SIDE_MIN = 280;
const SIDE_MAX = 900;
const SIDE_DEFAULT = 360;

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("tlg-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialSideWidth(): number {
  if (typeof window === "undefined") return SIDE_DEFAULT;
  const stored = Number(window.localStorage.getItem("tlg-side-width"));
  if (Number.isFinite(stored) && stored >= SIDE_MIN && stored <= SIDE_MAX) return stored;
  return SIDE_DEFAULT;
}

function App() {
  const { id: routeId } = useParams<{ id: string }>();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [sideOpen, setSideOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("tlg-side-open") !== "0";
  });
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [sideWidth, setSideWidth] = useState<number>(getInitialSideWidth);
  const [resizing, setResizing] = useState(false);
  const [sync, setSync] = useState<SyncState>("loading");
  const [syncError, setSyncError] = useState<string | null>(null);
  const timeline = useTimelineStore((s) => s.timeline);
  const setTimeline = useTimelineStore((s) => s.setTimeline);
  const deleteSelected = useTimelineStore((s) => s.deleteSelected);
  const undo = useTimelineStore.temporal.getState().undo;
  const redo = useTimelineStore.temporal.getState().redo;
  const pastCount = useStore(useTimelineStore.temporal, (s) => s.pastStates.length);
  const futureCount = useStore(useTimelineStore.temporal, (s) => s.futureStates.length);
  const canUndo = pastCount > 0;
  const canRedo = futureCount > 0;

  // Track which timeline id we've loaded into the store so we know when to PUT.
  const loadedIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  // Load timeline from API when route id changes.
  useEffect(() => {
    if (!routeId) return;
    let cancelled = false;
    setSync("loading");
    setSyncError(null);
    timelinesApi
      .get(routeId)
      .then((rec) => {
        if (cancelled) return;
        const parsed = TimelineSchema.parse(rec.timeline);
        loadedIdRef.current = rec.id;
        setTimeline(parsed);
        useTimelineStore.temporal.getState().clear();
        setSync("idle");
      })
      .catch((err) => {
        if (cancelled) return;
        setSyncError((err as Error).message);
        setSync("error");
      });
    return () => {
      cancelled = true;
    };
  }, [routeId, setTimeline]);

  // Debounced auto-save back to the server whenever the timeline changes.
  useEffect(() => {
    if (!routeId) return;
    if (loadedIdRef.current !== routeId) return; // wait for initial load
    if (sync === "loading" || sync === "error") return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      setSync("saving");
      timelinesApi
        .update(routeId, timeline)
        .then(() => setSync("saved"))
        .catch((err) => {
          setSyncError((err as Error).message);
          setSync("error");
        });
    }, 5000);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline, routeId]);

  // Manual save: flush any pending debounce and PUT immediately.
  const saveNow = useCallback(async () => {
    if (!routeId) return;
    if (loadedIdRef.current !== routeId) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSync("saving");
    setSyncError(null);
    try {
      await timelinesApi.update(routeId, useTimelineStore.getState().timeline);
      setSync("saved");
    } catch (err) {
      setSyncError((err as Error).message);
      setSync("error");
    }
  }, [routeId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("tlg-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("tlg-side-width", String(sideWidth));
  }, [sideWidth]);

  useEffect(() => {
    window.localStorage.setItem("tlg-side-open", sideOpen ? "1" : "0");
  }, [sideOpen]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(true);
  }, []);

  useEffect(() => {
    if (!resizing) return;
    function onMove(e: MouseEvent) {
      const w = Math.min(SIDE_MAX, Math.max(SIDE_MIN, window.innerWidth - e.clientX));
      setSideWidth(w);
    }
    function onUp() {
      setResizing(false);
    }
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const editing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      // Save: Ctrl/Cmd+S works even while editing form fields.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNow();
        return;
      }
      if (editing) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelected();
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) redo();
        else undo();
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        redo();
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected, undo, redo, saveNow]);

  return (
    <div className="app">
      <div className="app-bar">
        <Link to="/" className="home-link" title="Back to all timelines">
          ← All timelines
        </Link>
        <div className="app-bar-actions">
          <button
            className="bar-btn"
            onClick={() => undo()}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            className="bar-btn"
            onClick={() => redo()}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷ Redo
          </button>
          <button
            className="bar-btn primary"
            onClick={() => saveNow()}
            disabled={sync === "saving" || sync === "loading"}
            title="Save (Ctrl+S)"
          >
            {sync === "saving" ? "Saving…" : "Save"}
          </button>
          <SyncBadge state={sync} error={syncError} />
          <button
            className={sideOpen ? "bar-btn active" : "bar-btn"}
            onClick={() => setSideOpen((v) => !v)}
            title={sideOpen ? "Hide inspector" : "Show inspector"}
            aria-pressed={sideOpen}
          >
            {sideOpen ? "☰ Inspector ›" : "‹ ☰ Inspector"}
          </button>
        </div>
      </div>
      <Toolbar
        svgRef={svgRef}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      />
      <div className="layout">
        <main className="canvas-pane">
          <div className="canvas-scroll">
            <TimelineCanvas exportRef={svgRef} />
          </div>
        </main>
        <div
          className={resizing ? "side-resizer resizing" : "side-resizer"}
          onMouseDown={startResize}
          onDoubleClick={() => setSideWidth(SIDE_DEFAULT)}
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize · double-click to reset"
          hidden={!sideOpen}
        />
        <aside
          className="side-pane"
          style={{ width: sideWidth }}
          hidden={!sideOpen}
        >
          <div className="tabs">
            <button
              className={!showJson ? "tab active" : "tab"}
              onClick={() => setShowJson(false)}
            >
              Inspector
            </button>
            <button
              className={showJson ? "tab active" : "tab"}
              onClick={() => setShowJson(true)}
            >
              JSON
            </button>
          </div>
          <div className="side-content">{showJson ? <JsonEditor /> : <Inspector />}</div>
        </aside>
      </div>
    </div>
  );
}

function SyncBadge({ state, error }: { state: SyncState; error: string | null }) {
  const label = (() => {
    switch (state) {
      case "loading":
        return "Loading…";
      case "saving":
        return "Saving…";
      case "saved":
        return "Saved";
      case "error":
        return `Error: ${error ?? "save failed"}`;
      default:
        return "Synced";
    }
  })();
  return <span className={`sync-badge sync-${state}`}>{label}</span>;
}

export default App;
