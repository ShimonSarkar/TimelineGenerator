import { useEffect, useMemo, useRef, useState } from "react";
import { useTimelineStore } from "../state/store";
import { TimelineSchema } from "../model/timeline";

const INDENT = "  ";

export function JsonEditor() {
  const timeline = useTimelineStore((s) => s.timeline);
  const setTimeline = useTimelineStore((s) => s.setTimeline);
  const [text, setText] = useState(() => JSON.stringify(timeline, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync from store when the user isn't editing.
  useEffect(() => {
    if (!dirty) setText(JSON.stringify(timeline, null, 2));
  }, [timeline, dirty]);

  // Live validation (debounced) — sets error without committing.
  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => {
      try {
        TimelineSchema.parse(JSON.parse(text));
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [text, dirty]);

  const lineCount = useMemo(() => text.split("\n").length, [text]);
  const charCount = text.length;
  const valid = !dirty || error === null;

  function commit() {
    try {
      const parsed = TimelineSchema.parse(JSON.parse(text));
      setTimeline(parsed);
      setError(null);
      setDirty(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function revert() {
    setText(JSON.stringify(timeline, null, 2));
    setDirty(false);
    setError(null);
  }

  function prettify() {
    try {
      const obj = JSON.parse(text);
      setText(JSON.stringify(obj, null, 2));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  function updateCaret() {
    const ta = taRef.current;
    if (!ta) return;
    const upto = text.slice(0, ta.selectionStart);
    const line = upto.split("\n").length;
    const col = upto.length - upto.lastIndexOf("\n");
    setCaret({ line, col });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    // Ctrl/Cmd+Enter → apply
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      commit();
      return;
    }
    // Ctrl/Cmd+S → apply
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      commit();
      return;
    }
    // Ctrl/Cmd+Shift+F → prettify
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      prettify();
      return;
    }
    // Tab / Shift+Tab → indent / dedent
    if (e.key === "Tab") {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = text.slice(0, start);
      const sel = text.slice(start, end);
      const after = text.slice(end);

      if (sel.includes("\n") || e.shiftKey) {
        // Multi-line indent / dedent
        const lineStart = before.lastIndexOf("\n") + 1;
        const head = text.slice(0, lineStart);
        const block = text.slice(lineStart, end);
        const lines = block.split("\n");
        let newBlock: string;
        if (e.shiftKey) {
          newBlock = lines
            .map((ln) => (ln.startsWith(INDENT) ? ln.slice(INDENT.length) : ln.replace(/^\s/, "")))
            .join("\n");
        } else {
          newBlock = lines.map((ln) => INDENT + ln).join("\n");
        }
        const next = head + newBlock + after;
        setText(next);
        setDirty(true);
        requestAnimationFrame(() => {
          ta.selectionStart = lineStart;
          ta.selectionEnd = lineStart + newBlock.length;
        });
      } else {
        const next = before + INDENT + after;
        setText(next);
        setDirty(true);
        const pos = start + INDENT.length;
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = pos;
        });
      }
    }
  }

  return (
    <div className="json-editor">
      <div className="json-header">
        <div className="json-title">
          <strong>JSON</strong>
          <span className={valid ? "json-status ok" : "json-status err"}>
            {valid ? (dirty ? "valid · unsaved" : "in sync") : "invalid"}
          </span>
        </div>
        <div className="json-actions">
          <button onClick={prettify} title="Reformat (Ctrl+Shift+F)">
            Prettify
          </button>
          <button onClick={copy} title="Copy to clipboard">
            {copied ? "Copied!" : "Copy"}
          </button>
          <button disabled={!dirty} onClick={revert} title="Revert to current timeline">
            Revert
          </button>
          <button
            className="primary"
            disabled={!dirty || !!error}
            onClick={commit}
            title="Apply (Ctrl+Enter)"
          >
            Apply
          </button>
        </div>
      </div>
      <textarea
        ref={taRef}
        spellCheck={false}
        wrap="off"
        value={text}
        onKeyDown={onKeyDown}
        onKeyUp={updateCaret}
        onClick={updateCaret}
        onSelect={updateCaret}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
      />
      <div className="json-statusbar">
        <span>
          Ln <strong>{caret.line}</strong>, Col <strong>{caret.col}</strong>
        </span>
        <span>
          {lineCount} lines · {charCount} chars
        </span>
        <span className={valid ? "ok" : "err"}>
          {valid ? "✓ valid JSON" : "× invalid"}
        </span>
      </div>
      {error && <pre className="error">{error}</pre>}
    </div>
  );
}
