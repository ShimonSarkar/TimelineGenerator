import type { Timeline } from "../model/timeline";
import { TimelineSchema } from "../model/timeline";

export function exportTimelineJson(timeline: Timeline): void {
  const blob = new Blob([JSON.stringify(timeline, null, 2)], { type: "application/json" });
  triggerDownload(blob, `${slug(timeline.name) || "timeline"}.timeline.json`);
}

export async function importTimelineJson(file: File): Promise<Timeline> {
  const text = await file.text();
  const data = JSON.parse(text);
  return TimelineSchema.parse(data);
}

export function svgElementToString(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  return new XMLSerializer().serializeToString(clone);
}

export function exportSvg(svg: SVGSVGElement, name: string): void {
  const str = svgElementToString(svg);
  const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
  triggerDownload(blob, `${slug(name) || "timeline"}.svg`);
}

export async function svgToPngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const str = svgElementToString(svg);
  const svgBlob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load SVG"));
      img.src = url;
    });
    const w = svg.viewBox.baseVal.width || svg.width.baseVal.value || img.width;
    const h = svg.viewBox.baseVal.height || svg.height.baseVal.value || img.height;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas context");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportPng(svg: SVGSVGElement, name: string): Promise<void> {
  const blob = await svgToPngBlob(svg);
  triggerDownload(blob, `${slug(name) || "timeline"}.png`);
}

export async function copyPngToClipboard(svg: SVGSVGElement): Promise<void> {
  const blob = await svgToPngBlob(svg);
  if (!navigator.clipboard || !("write" in navigator.clipboard)) {
    throw new Error("Clipboard image write is not supported in this browser.");
  }
  // ClipboardItem might not exist in older typings.
  const ItemCtor = (window as unknown as { ClipboardItem: typeof ClipboardItem }).ClipboardItem;
  await navigator.clipboard.write([new ItemCtor({ "image/png": blob })]);
}

export async function exportPdf(svg: SVGSVGElement, name: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const blob = await svgToPngBlob(svg, 2);
  const dataUrl = await blobToDataUrl(blob);
  const w = svg.viewBox.baseVal.width;
  const h = svg.viewBox.baseVal.height;
  const orientation = w >= h ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: [w, h] });
  pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
  pdf.save(`${slug(name) || "timeline"}.pdf`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
