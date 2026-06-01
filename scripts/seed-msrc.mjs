// One-off seed script that posts the original MSRC Package timeline
// into the running API (http://localhost:4000 by default).
//
// Usage:  node scripts/seed-msrc.mjs
import { randomUUID } from "node:crypto";

const API = process.env.API_URL || "http://localhost:4000";

const bIntake = "b-intake";
const bBuild = "b-build";
const bVTeam = "b-vteam";
const bAzQ = "b-azq";
const bStage = "b-stage";
const bCanary = "b-canary";
const bSafeFly = "b-safefly";
const bDeploy = "b-deploy";
const bBatched = "b-batched";

const timeline = {
  id: randomUUID(),
  name: "MSRC Package",
  mode: "duration",
  pxPerDay: 18,
  rows: [
    {
      id: "row-1",
      label: "MSRC\nPackage",
      groups: [
        {
          id: "g-intake",
          start: 0,
          end: 48,
          stackMode: "split",
          blocks: [
            {
              id: bIntake,
              label: "Bug Intake & Pre-Shiproom Validation & Approval & Check-in",
              color: "#4B1E5C",
              textColor: "#ffffff",
              kind: "span",
            },
          ],
        },
        {
          id: "g-build",
          start: 48,
          end: 50,
          stackMode: "split",
          blocks: [
            {
              id: bBuild,
              label: "Build & Package",
              color: "#F3B58A",
              textColor: "#1f2937",
              kind: "span",
            },
          ],
        },
        {
          id: "g-validation",
          start: 50,
          end: 53,
          stackMode: "split",
          blocks: [
            { id: bVTeam, label: "V-Team Validation", color: "#D8602A", textColor: "#ffffff", kind: "span" },
            { id: bAzQ, label: "AzQ Validation", color: "#D8602A", textColor: "#ffffff", kind: "span" },
          ],
        },
        {
          id: "g-stagecanary",
          start: 50,
          end: 53,
          stackMode: "split",
          blocks: [
            { id: bStage, label: "Stage", color: "#1F4E8C", textColor: "#ffffff", kind: "span" },
            { id: bCanary, label: "Canary", color: "#1F4E8C", textColor: "#ffffff", kind: "span" },
          ],
        },
        {
          id: "g-safefly",
          start: 53,
          end: 53,
          stackMode: "split",
          blocks: [
            { id: bSafeFly, label: "SafeFly", color: "#D946EF", textColor: "#ffffff", kind: "point" },
          ],
        },
        {
          id: "g-deploy",
          start: 53,
          end: 62,
          stackMode: "split",
          blocks: [
            {
              id: bDeploy,
              label: "Deployment on Non-Batched Nodes\n(Cheyenne \u2192 Quality Critical)",
              color: "#1F4E8C",
              textColor: "#ffffff",
              kind: "span",
            },
          ],
        },
        {
          id: "g-batched",
          start: 62,
          end: 69,
          stackMode: "split",
          blocks: [
            {
              id: bBatched,
              label: "Only for RCE/SSIRP Cases\nBatched Node Deployment & Catch-up Rollout",
              color: "#A9C7E8",
              textColor: "#1f2937",
              kind: "span",
            },
          ],
        },
      ],
    },
  ],
  brackets: [
    { id: "bk-31", label: "", labelMode: "auto", autoPrefix: "", autoSuffix: " days", side: "top", lane: 1, anchor: { kind: "blocks", fromBlockId: bBuild, toBlockId: bBatched } },
    { id: "bk-21", label: "", labelMode: "auto", autoPrefix: "~", autoSuffix: " days", side: "top", lane: 0, anchor: { kind: "blocks", fromBlockId: bVTeam, toBlockId: bBatched } },
    { id: "bk-48", label: "", labelMode: "auto", autoPrefix: "~", autoSuffix: " days", side: "bottom", lane: 0, anchor: { kind: "blocks", fromBlockId: bIntake, toBlockId: bIntake } },
    { id: "bk-2", label: "", labelMode: "auto", autoPrefix: "~", autoSuffix: " days", side: "bottom", lane: 0, anchor: { kind: "blocks", fromBlockId: bBuild, toBlockId: bBuild } },
    { id: "bk-3", label: "", labelMode: "auto", autoPrefix: "~", autoSuffix: " days", side: "bottom", lane: 0, anchor: { kind: "blocks", fromBlockId: bVTeam, toBlockId: bCanary } },
    { id: "bk-9", label: "", labelMode: "auto", autoPrefix: "~", autoSuffix: " days", side: "bottom", lane: 0, anchor: { kind: "blocks", fromBlockId: bDeploy, toBlockId: bDeploy } },
    { id: "bk-7", label: "", labelMode: "auto", autoPrefix: "~", autoSuffix: " days", side: "bottom", lane: 0, anchor: { kind: "blocks", fromBlockId: bBatched, toBlockId: bBatched } },
  ],
  guides: [
    { id: "gd-last", label: "Last possible day new\ncase can come in", at: 40, color: "#2C7A7B", dash: "6 4", labelPosition: "top" },
    { id: "gd-assess", label: "Assessment", at: 46, color: "#2C7A7B", dash: "6 4", labelPosition: "top" },
    { id: "gd-bugcut", label: "Bug Cutoff", at: 50, color: "#2C7A7B", dash: "2 3", labelPosition: "top" },
  ],
};

const res = await fetch(`${API}/api/timelines`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ timeline }),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`Seed failed (${res.status}):`, text);
  process.exit(1);
}

const created = await res.json();
console.log(`Seeded "${created.name}" -> id ${created.id}`);
console.log(`Open: http://localhost:5173/t/${created.id}`);
