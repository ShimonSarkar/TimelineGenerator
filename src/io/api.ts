import type { Timeline } from "../model/timeline";

export interface TimelineSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  rowCount: number;
}

export interface TimelineRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  timeline: Timeline;
}

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const timelinesApi = {
  list: () => jsonFetch<TimelineSummary[]>("/api/timelines"),
  get: (id: string) => jsonFetch<TimelineRecord>(`/api/timelines/${id}`),
  create: (timeline?: Partial<Timeline>) =>
    jsonFetch<TimelineRecord>("/api/timelines", {
      method: "POST",
      body: JSON.stringify({ timeline }),
    }),
  update: (id: string, timeline: Timeline) =>
    jsonFetch<TimelineRecord>(`/api/timelines/${id}`, {
      method: "PUT",
      body: JSON.stringify({ timeline, name: timeline.name }),
    }),
  rename: (id: string, name: string) =>
    jsonFetch<TimelineSummary>(`/api/timelines/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  duplicate: (id: string) =>
    jsonFetch<TimelineRecord>(`/api/timelines/${id}/duplicate`, {
      method: "POST",
    }),
  remove: (id: string) =>
    jsonFetch<void>(`/api/timelines/${id}`, { method: "DELETE" }),
};

// --------------------------------------------------------------------------
// Comparisons
// --------------------------------------------------------------------------

export interface ComparisonViewState {
  timelineIds: string[];
  positions: Record<string, { x: number; y: number }>;
  pxPerDayOverride: number | null;
  viewZoom: number;
  hiddenLegends: string[];
}

export interface ComparisonSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  timelineIds: string[];
}

export interface ComparisonRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  data: ComparisonViewState;
}

export const comparisonsApi = {
  list: () => jsonFetch<ComparisonSummary[]>("/api/comparisons"),
  get: (id: string) => jsonFetch<ComparisonRecord>(`/api/comparisons/${id}`),
  create: (name: string, data: ComparisonViewState) =>
    jsonFetch<ComparisonRecord>("/api/comparisons", {
      method: "POST",
      body: JSON.stringify({ name, data }),
    }),
  update: (id: string, name: string, data: ComparisonViewState) =>
    jsonFetch<ComparisonRecord>(`/api/comparisons/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, data }),
    }),
  rename: (id: string, name: string) =>
    jsonFetch<ComparisonSummary>(`/api/comparisons/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  remove: (id: string) =>
    jsonFetch<void>(`/api/comparisons/${id}`, { method: "DELETE" }),
};
