import { nanoid } from "nanoid";
import type { Timeline } from "../model/timeline";

// Days reference (matches the screenshot proportions):
//   Bug Intake & Pre-Shiproom: ~48 days  -> 0..48
//   Build & Package:           ~2 days   -> 48..50
//   V-Team Validation + AzQ + Stage + Canary (split groups): ~3 days -> 50..53
//   SafeFly point at 53
//   Deployment on Non-Batched Nodes:  ~9 days  -> 53..62
//   Batched Node Deployment & Catch-up Rollout: ~7 days -> 62..69
// Top brackets:
//   "31 days"  spans Build&Package -> end of batched deployment (lane 1)
//   "~21 days" spans V-Team start -> end of batched deployment (lane 0, closer to chart)
// Guides:
//   Last possible day new case can come in @ day ~40
//   Assessment @ day ~46

const intakeId = "g-intake";
const buildId = "g-build";
const valId = "g-validation"; // V-Team + AzQ split
const stageCanaryId = "g-stagecanary"; // Stage + Canary split
const safeFlyId = "g-safefly";
const deployId = "g-deploy";
const batchedId = "g-batched";

const bIntake = "b-intake";
const bBuild = "b-build";
const bVTeam = "b-vteam";
const bAzQ = "b-azq";
const bStage = "b-stage";
const bCanary = "b-canary";
const bSafeFly = "b-safefly";
const bDeploy = "b-deploy";
const bBatched = "b-batched";

export function createMsrcExample(): Timeline {
  return {
    id: nanoid(),
    name: "MSRC Package",
    mode: "duration",
    pxPerDay: 18,
    rows: [
      {
        id: "row-1",
        label: "MSRC\nPackage",
        groups: [
          {
            id: intakeId,
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
            id: buildId,
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
            id: valId,
            start: 50,
            end: 53,
            stackMode: "split",
            blocks: [
              {
                id: bVTeam,
                label: "V-Team Validation",
                color: "#D8602A",
                textColor: "#ffffff",
                kind: "span",
              },
              {
                id: bAzQ,
                label: "AzQ Validation",
                color: "#D8602A",
                textColor: "#ffffff",
                kind: "span",
              },
            ],
          },
          {
            id: stageCanaryId,
            start: 50,
            end: 53,
            stackMode: "split",
            blocks: [
              {
                id: bStage,
                label: "Stage",
                color: "#1F4E8C",
                textColor: "#ffffff",
                kind: "span",
              },
              {
                id: bCanary,
                label: "Canary",
                color: "#1F4E8C",
                textColor: "#ffffff",
                kind: "span",
              },
            ],
          },
          {
            id: safeFlyId,
            start: 53,
            end: 53,
            stackMode: "split",
            blocks: [
              {
                id: bSafeFly,
                label: "SafeFly",
                color: "#D946EF",
                textColor: "#ffffff",
                kind: "point",
              },
            ],
          },
          {
            id: deployId,
            start: 53,
            end: 62,
            stackMode: "split",
            blocks: [
              {
                id: bDeploy,
                label: "Deployment on Non-Batched Nodes\n(Cheyenne → Quality Critical)",
                color: "#1F4E8C",
                textColor: "#ffffff",
                kind: "span",
              },
            ],
          },
          {
            id: batchedId,
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
      {
        id: "bk-31",
        label: "",
        labelMode: "auto",
        autoPrefix: "",
        autoSuffix: " days",
        side: "top",
        lane: 1,
        anchor: { kind: "blocks", fromBlockId: bBuild, toBlockId: bBatched },
      },
      {
        id: "bk-21",
        label: "",
        labelMode: "auto",
        autoPrefix: "~",
        autoSuffix: " days",
        side: "top",
        lane: 0,
        anchor: { kind: "blocks", fromBlockId: bVTeam, toBlockId: bBatched },
      },
      {
        id: "bk-48",
        label: "",
        labelMode: "auto",
        autoPrefix: "~",
        autoSuffix: " days",
        side: "bottom",
        lane: 0,
        anchor: { kind: "blocks", fromBlockId: bIntake, toBlockId: bIntake },
      },
      {
        id: "bk-2",
        label: "",
        labelMode: "auto",
        autoPrefix: "~",
        autoSuffix: " days",
        side: "bottom",
        lane: 0,
        anchor: { kind: "blocks", fromBlockId: bBuild, toBlockId: bBuild },
      },
      {
        id: "bk-3",
        label: "",
        labelMode: "auto",
        autoPrefix: "~",
        autoSuffix: " days",
        side: "bottom",
        lane: 0,
        anchor: { kind: "blocks", fromBlockId: bVTeam, toBlockId: bCanary },
      },
      {
        id: "bk-9",
        label: "",
        labelMode: "auto",
        autoPrefix: "~",
        autoSuffix: " days",
        side: "bottom",
        lane: 0,
        anchor: { kind: "blocks", fromBlockId: bDeploy, toBlockId: bDeploy },
      },
      {
        id: "bk-7",
        label: "",
        labelMode: "auto",
        autoPrefix: "~",
        autoSuffix: " days",
        side: "bottom",
        lane: 0,
        anchor: { kind: "blocks", fromBlockId: bBatched, toBlockId: bBatched },
      },
    ],
    guides: [
      {
        id: "gd-last",
        label: "Last possible day new\ncase can come in",
        at: 40,
        color: "#2C7A7B",
        dash: "6 4",
        labelPosition: "top",
      },
      {
        id: "gd-assess",
        label: "Assessment",
        at: 46,
        color: "#2C7A7B",
        dash: "6 4",
        labelPosition: "top",
      },
      {
        id: "gd-bugcut",
        label: "Bug Cutoff",
        at: 50,
        color: "#2C7A7B",
        dash: "2 3",
        labelPosition: "top",
      },
    ],
  };
}
