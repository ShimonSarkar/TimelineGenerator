/**
 * Helpers for fitting/wrapping SVG text labels into bounded boxes.
 * All measurements are estimates (no DOM measurement) — width per char ≈ fontSize * 0.55.
 */

export interface LabelLayout {
  /** How the label should be rendered. */
  mode: "wrap" | "rotate" | "hide";
  fontSize: number;
  lines: string[];
  /** Estimated rendered width in horizontal layout (or height when rotated). */
  textWidth: number;
  /** Estimated rendered height in horizontal layout (or width when rotated). */
  textHeight: number;
}

const CHAR_W_RATIO = 0.55;
const LINE_H_RATIO = 1.22;
const PAD = 8;

function charWidth(fontSize: number): number {
  return fontSize * CHAR_W_RATIO;
}

function wrapToWidth(
  text: string,
  fontSize: number,
  maxWidth: number,
  allowHardBreak = false,
): string[] | null {
  const maxChars = Math.max(1, Math.floor(maxWidth / charWidth(fontSize)));
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let cur = "";
    for (const w of words) {
      // If a single word is longer than a line, bail unless hard-break is allowed.
      if (w.length > maxChars) {
        if (!allowHardBreak) return null; // signal: word-wrap can't fit; try a different strategy
        if (cur) {
          out.push(cur);
          cur = "";
        }
        let rest = w;
        while (rest.length > maxChars) {
          out.push(rest.slice(0, maxChars));
          rest = rest.slice(maxChars);
        }
        cur = rest;
        continue;
      }
      const next = cur ? cur + " " + w : w;
      if (next.length <= maxChars) {
        cur = next;
      } else {
        out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

function dims(lines: string[], fontSize: number): { w: number; h: number } {
  const w = Math.max(0, ...lines.map((l) => l.length * charWidth(fontSize)));
  const h = lines.length * fontSize * LINE_H_RATIO;
  return { w, h };
}

/**
 * Pick the best layout for a label to fit inside a box.
 * Strategy: try base font 12 with word-wrap; shrink to 11/10/9; try rotated 90°;
 * if still nothing fits, fall back to a horizontal wrap that may hard-break words
 * (last resort — looks ugly but stays legible).
 */
export function chooseLabelLayout(
  text: string,
  boxW: number,
  boxH: number,
): LabelLayout {
  if (!text.trim()) return { mode: "hide", fontSize: 0, lines: [], textWidth: 0, textHeight: 0 };

  const innerW = Math.max(0, boxW - PAD);
  const innerH = Math.max(0, boxH - PAD);

  // 1) Try shrinking horizontal word-wrap fonts.
  for (const fs of [12, 11, 10, 9]) {
    if (innerW < charWidth(fs) * 2) break;
    const lines = wrapToWidth(text, fs, innerW, /* allowHardBreak */ false);
    if (!lines) continue;
    const { w, h } = dims(lines, fs);
    if (w <= innerW && h <= innerH) {
      return { mode: "wrap", fontSize: fs, lines, textWidth: w, textHeight: h };
    }
  }

  // 2) Try rotated 90° (text reads vertically; works well in tall narrow blocks).
  for (const fs of [11, 10, 9]) {
    if (innerH < charWidth(fs) * 2) break;
    const lines = wrapToWidth(text, fs, innerH, /* allowHardBreak */ false);
    if (!lines) continue;
    const { w, h } = dims(lines, fs);
    if (w <= innerH && h <= innerW) {
      return { mode: "rotate", fontSize: fs, lines, textWidth: w, textHeight: h };
    }
  }

  // 3) Hide the label — it'll appear in the legend / tooltip instead of being
  // chopped into illegible character fragments inside the block.
  return { mode: "hide", fontSize: 0, lines: [], textWidth: 0, textHeight: 0 };
}

/**
 * Force-render a label at a specific font size (used when the user opts out of auto-fit).
 * Always returns a `wrap` layout; lines may exceed box dimensions.
 */
export function forcedLabelLayout(text: string, fontSize: number, boxW: number): LabelLayout {
  if (!text.trim()) return { mode: "hide", fontSize: 0, lines: [], textWidth: 0, textHeight: 0 };
  const innerW = Math.max(8, boxW - PAD);
  const lines = wrapToWidth(text, fontSize, innerW, true) ?? [text];
  const { w, h } = dims(lines, fontSize);
  return { mode: "wrap", fontSize, lines, textWidth: w, textHeight: h };
}

/** A single-line wrap layout (used for fixed-line labels like point markers and ruler ticks). */
export function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  return wrapToWidth(text, fontSize, maxWidth, true) ?? [text];
}
