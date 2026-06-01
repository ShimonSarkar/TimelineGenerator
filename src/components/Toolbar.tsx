import { useEffect, useRef, useState } from "react";
import { useTimelineStore } from "../state/store";
import { createMsrcExample } from "../data/msrcExample";
import {
  copyPngToClipboard,
  exportPdf,
  exportPng,
  exportSvg,
  exportTimelineJson,
  importTimelineJson,
} from "../io/export";

interface Props {
  svgRef: React.RefObject<SVGSVGElement | null>;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function Toolbar({ svgRef, theme, onToggleTheme }: Props) {
  const timeline = useTimelineStore((s) => s.timeline);
  const setTimeline = useTimelineStore((s) => s.setTimeline);
  const setMode = useTimelineStore((s) => s.setMode);
  const setOrigin = useTimelineStore((s) => s.setOrigin);
  const setPxPerDay = useTimelineStore((s) => s.setPxPerDay);
  const setName = useTimelineStore((s) => s.setName);
  const addRow = useTimelineStore((s) => s.addRow);
  const addGroup = useTimelineStore((s) => s.addGroup);
  const addBracket = useTimelineStore((s) => s.addBracket);
  const addGuide = useTimelineStore((s) => s.addGuide);
  const fileInput = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string>("");

  // Close any open <details> dropdowns when clicking outside the toolbar.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const root = toolbarRef.current;
      if (!root) return;
      const target = e.target as Node;
      root.querySelectorAll("details[open]").forEach((d) => {
        if (!d.contains(target)) d.removeAttribute("open");
      });
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const firstRowId = timeline.rows[0]?.id;

  function flash(msg: string) {
    setStatus(msg);
    window.setTimeout(() => setStatus(""), 1800);
  }

  async function handleExport(kind: "png" | "svg" | "pdf" | "clip" | "json") {
    try {
      if (kind === "json") {
        exportTimelineJson(timeline);
        flash("JSON downloaded");
        return;
      }
      const svg = svgRef.current;
      if (!svg) return;
      if (kind === "png") await exportPng(svg, timeline.name);
      if (kind === "svg") exportSvg(svg, timeline.name);
      if (kind === "pdf") await exportPdf(svg, timeline.name);
      if (kind === "clip") {
        await copyPngToClipboard(svg);
        flash("PNG copied to clipboard");
        return;
      }
      flash(`${kind.toUpperCase()} exported`);
    } catch (err) {
      console.error(err);
      flash(`Export failed: ${(err as Error).message}`);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const t = await importTimelineJson(file);
      setTimeline(t);
      flash("Imported");
    } catch (err) {
      flash(`Import failed: ${(err as Error).message}`);
    } finally {
      e.target.value = "";
    }
  }

  function closeMenu(e: React.MouseEvent) {
    (e.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
  }

  return (
    <div className="toolbar" ref={toolbarRef}>
      {/* --- Section 1: Document --- */}
      <div className="tb-group tb-doc">
        <input
          className="name-input"
          value={timeline.name}
          onChange={(e) => setName(e.target.value)}
          title="Timeline name"
          size={Math.max(8, timeline.name.length + 1)}
        />
      </div>

      <div className="sep" />

      {/* --- Section 2: Insert --- */}
      <div className="tb-group">
        <div className="menu">
          <details>
            <summary className="primary">+ Add ▾</summary>
            <div className="menu-items">
              <button onClick={(e) => { addRow(); closeMenu(e); }}>
                <span className="mi-label">Row</span>
                <span className="mi-hint">A new horizontal track</span>
              </button>
              <button
                disabled={!firstRowId}
                onClick={(e) => {
                  firstRowId && addGroup(firstRowId);
                  closeMenu(e);
                }}
              >
                <span className="mi-label">Block</span>
                <span className="mi-hint">A new bar on the first row</span>
              </button>
              <div className="menu-sep" />
              <button onClick={(e) => { addGuide({ at: 0 }); closeMenu(e); }}>
                <span className="mi-label">Guide</span>
                <span className="mi-hint">Dashed vertical marker</span>
              </button>
              <button onClick={(e) => { addBracket(); closeMenu(e); }}>
                <span className="mi-label">Bracket</span>
                <span className="mi-hint">Span label above/below chart</span>
              </button>
            </div>
          </details>
        </div>
      </div>

      <div className="sep" />

      {/* --- Section 3: Chart settings --- */}
      <div className="tb-group tb-chart">
        <label className="mode-toggle">
          Mode
          <select
            value={timeline.mode}
            onChange={(e) => setMode(e.target.value as "duration" | "date")}
          >
            <option value="duration">Duration</option>
            <option value="date">Date</option>
          </select>
        </label>
        {timeline.mode === "date" && (
          <label className="origin">
            Origin
            <input
              type="date"
              value={timeline.origin ?? ""}
              onChange={(e) => setOrigin(e.target.value || undefined)}
            />
          </label>
        )}
        <label className="zoom">
          Zoom
          <input
            className="zoom-slider"
            type="range"
            min={4}
            max={48}
            step={1}
            value={timeline.pxPerDay}
            onChange={(e) => setPxPerDay(Number(e.target.value))}
          />
          <input
            className="zoom-number"
            type="number"
            min={1}
            max={200}
            step={1}
            value={timeline.pxPerDay}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) {
                setPxPerDay(Math.min(200, Math.max(1, Math.round(n))));
              }
            }}
            title="Pixels per day"
          />
          <span className="zoom-unit">px/d</span>
        </label>
      </div>

      <div className="tb-spacer" />

      {/* --- Section 4: File ops --- */}
      <div className="tb-group">
        <div className="menu">
          <details>
            <summary>File ▾</summary>
            <div className="menu-items">
              <button
                onClick={(e) => {
                  if (confirm("Start a new empty timeline?")) {
                    setTimeline({
                      id: crypto.randomUUID(),
                      name: "Untitled",
                      mode: "duration",
                      pxPerDay: 18,
                      rows: [{ id: crypto.randomUUID(), label: "Row 1", groups: [] }],
                      brackets: [],
                      guides: [],
                    });
                  }
                  closeMenu(e);
                }}
              >
                <span className="mi-label">New timeline</span>
              </button>
              <button
                onClick={(e) => {
                  if (confirm("Load the MSRC example? This replaces the current timeline.")) {
                    setTimeline(createMsrcExample());
                  }
                  closeMenu(e);
                }}
              >
                <span className="mi-label">Load example</span>
              </button>
              <div className="menu-sep" />
              <button onClick={(e) => { fileInput.current?.click(); closeMenu(e); }}>
                <span className="mi-label">Import JSON…</span>
              </button>
              <button onClick={(e) => { handleExport("json"); closeMenu(e); }}>
                <span className="mi-label">Download JSON</span>
              </button>
            </div>
          </details>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={handleImport}
        />
        <div className="menu">
          <details>
            <summary>Export ▾</summary>
            <div className="menu-items">
              <button onClick={(e) => { handleExport("png"); closeMenu(e); }}>
                <span className="mi-label">PNG image</span>
              </button>
              <button onClick={(e) => { handleExport("svg"); closeMenu(e); }}>
                <span className="mi-label">SVG vector</span>
              </button>
              <button onClick={(e) => { handleExport("pdf"); closeMenu(e); }}>
                <span className="mi-label">PDF document</span>
              </button>
              <div className="menu-sep" />
              <button onClick={(e) => { handleExport("clip"); closeMenu(e); }}>
                <span className="mi-label">Copy PNG to clipboard</span>
              </button>
            </div>
          </details>
        </div>
      </div>

      <div className="sep" />

      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? "\u263C Light" : "\u263D Dark"}
      </button>
      {status && <span className="status">{status}</span>}
    </div>
  );
}
