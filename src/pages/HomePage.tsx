import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  comparisonsApi,
  timelinesApi,
  type ComparisonSummary,
  type TimelineSummary,
} from "../io/api";
import "../App.css";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("tlg-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function HomePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<TimelineSummary[] | null>(null);
  const [comparisons, setComparisons] = useState<ComparisonSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onCompare() {
    if (selected.size < 2) return;
    const ids = Array.from(selected).join(",");
    navigate(`/compare?ids=${ids}`);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("tlg-theme", theme);
  }, [theme]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [data, comps] = await Promise.all([
        timelinesApi.list(),
        comparisonsApi.list().catch(() => [] as ComparisonSummary[]),
      ]);
      setItems(data);
      setComparisons(comps);
    } catch (err) {
      setError((err as Error).message);
      setItems([]);
      setComparisons([]);
    }
  }, []);

  async function onRenameComparison(id: string, currentName: string) {
    const next = window.prompt("Rename comparison", currentName);
    if (!next || next === currentName) return;
    setBusy(true);
    try {
      await comparisonsApi.rename(id, next);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteComparison(id: string, name: string) {
    if (!window.confirm(`Delete saved comparison "${name}"?`)) return;
    setBusy(true);
    try {
      await comparisonsApi.remove(id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onNew() {
    setBusy(true);
    try {
      const rec = await timelinesApi.create({ name: "Untitled timeline" });
      navigate(`/t/${rec.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDuplicate(id: string) {
    setBusy(true);
    try {
      await timelinesApi.duplicate(id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await timelinesApi.remove(id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onRename(id: string, currentName: string) {
    const next = window.prompt("Rename timeline", currentName);
    if (!next || next === currentName) return;
    setBusy(true);
    try {
      await timelinesApi.rename(id, next);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const filtered =
    items?.filter((t) => t.name.toLowerCase().includes(query.toLowerCase())) ?? null;

  return (
    <div className="app home">
      <header className="home-header">
        <div className="home-brand">
          <svg
            className="home-logo"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* rounded card frame */}
            <rect
              x="3" y="3" width="18" height="18" rx="3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="home-logo-frame"
            />
            {/* stacked timeline bars of varying widths */}
            <rect x="6"  y="7.5"  width="9"  height="1.8" rx="0.9" />
            <rect x="6"  y="11.1" width="12" height="1.8" rx="0.9" className="home-logo-bar" />
            <rect x="6"  y="14.7" width="7"  height="1.8" rx="0.9" />
          </svg>
          <h1>Timegrid</h1>
        </div>
        <div className="home-actions">
          <input
            className="home-search"
            type="search"
            placeholder="Search timelines…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            title="Toggle theme"
          >
            {theme === "light" ? "☾ Dark" : "☼ Light"}
          </button>
          <button
            className="bar-btn"
            onClick={onCompare}
            disabled={selected.size < 2}
            title={
              selected.size < 2
                ? "Select 2 or more timelines to compare"
                : `Compare ${selected.size} timelines`
            }
          >
            ⇄ Compare{selected.size >= 2 ? ` (${selected.size})` : ""}
          </button>
          <button className="primary" onClick={onNew} disabled={busy}>
            + New timeline
          </button>
        </div>
      </header>

      <main className="home-main">
        {error && (
          <div className="home-error">
            <strong>Couldn't reach the API.</strong> {error}
            <div className="home-error-hint">
              Start the server with <code>npm run server</code> and make sure Postgres
              is running. Connection is read from <code>DATABASE_URL</code>.
            </div>
          </div>
        )}

        {items === null && !error && <div className="home-empty">Loading…</div>}

        {comparisons && comparisons.length > 0 && (
          <section className="home-section">
            <h2 className="home-section-title">Saved comparisons</h2>
            <div className="home-grid">
              {comparisons.map((c) => (
                <article key={c.id} className="home-card comparison">
                  <Link to={`/compare/${c.id}`} className="home-card-body">
                    <h3 title={c.name}>{c.name || "Untitled comparison"}</h3>
                    <div className="home-card-meta">
                      <span>
                        {c.timelineIds.length} timeline
                        {c.timelineIds.length === 1 ? "" : "s"}
                      </span>
                      <span>Updated {formatDate(c.updatedAt)}</span>
                    </div>
                  </Link>
                  <div className="home-card-actions">
                    <button onClick={() => onRenameComparison(c.id, c.name)}>
                      Rename
                    </button>
                    <button
                      className="danger"
                      onClick={() => onDeleteComparison(c.id, c.name)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {filtered && filtered.length === 0 && !error && (
          <div className="home-empty">
            {items && items.length === 0 ? (
              <>
                <p>No timelines yet.</p>
                <button className="primary" onClick={onNew} disabled={busy}>
                  Create your first timeline
                </button>
              </>
            ) : (
              <p>No timelines match "{query}".</p>
            )}
          </div>
        )}

        {filtered && filtered.length > 0 && (
          <section className="home-section">
            {comparisons && comparisons.length > 0 && (
              <h2 className="home-section-title">Timelines</h2>
            )}
            <div className="home-grid">
              {filtered.map((t) => (
                <article
                  key={t.id}
                  className={selected.has(t.id) ? "home-card selected" : "home-card"}
                >
                  <label
                    className="home-card-check"
                    title="Select for comparison"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleSelected(t.id)}
                    />
                  </label>
                  <Link to={`/t/${t.id}`} className="home-card-body">
                    <h3 title={t.name}>{t.name || "Untitled"}</h3>
                    <div className="home-card-meta">
                      <span>{t.rowCount} row{t.rowCount === 1 ? "" : "s"}</span>
                      <span>Updated {formatDate(t.updatedAt)}</span>
                    </div>
                  </Link>
                  <div className="home-card-actions">
                    <button onClick={() => onRename(t.id, t.name)} title="Rename">
                      Rename
                    </button>
                    <button onClick={() => onDuplicate(t.id)} title="Duplicate">
                      Duplicate
                    </button>
                    <button
                      className="danger"
                      onClick={() => onDelete(t.id, t.name)}
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
