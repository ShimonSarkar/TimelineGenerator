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
