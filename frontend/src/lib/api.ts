import type {
  EntriesAsAt,
  Entry,
  EntryVersion,
  ProjectTrash,
  StatPanel,
  StatPanelInput,
  StatPanelPreview,
} from '@/types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body?.error ??
      body?.message ??
      (Array.isArray(body?.errors) ? body.errors.join(' ') : undefined) ??
      `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message, body);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'DELETE', body: data ? JSON.stringify(data) : undefined }),
};

export type StatsSummary = {
  perProject: { projectId: number; projectName: string; totalHours: number }[];
  totalHours: number;
  streak: number;
};

export type FrequencyStats = {
  weekly: { weekStart: string; count: number }[];
  terms: { termName: string; total: number }[];
};

export type CalendarStatus = { connected: boolean };

export type CalendarConnectResult = { url?: string; connected?: boolean };

// One of the user's Google calendars. `enabled` decides whether its events
// feed suggestions and the upcoming list.
export type CalendarSource = {
  id: number;
  calendarId: string;
  summary: string;
  description: string;
  color: string;
  enabled: boolean;
  order: number;
};

export type CalendarSourcesResponse = {
  connected: boolean;
  sources: CalendarSource[];
};

export type CalendarSuggestion = {
  id: string;
  title: string;
  start?: string;
  end?: string;
  description?: string;
  projectId?: number;
};

// A Google event as GET /api/calendar/events returns it: Google's own shape,
// tagged with the calendar it came from.
export type CalendarEvent = {
  id?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  calendarId?: string;
  calendarSummary?: string;
  color?: string | null;
};

export type CalendarEventsResponse =
  { connected: true; events: CalendarEvent[] } | { connected: false; message?: string };

/** Every event from the enabled calendars between two ISO instants. */
export function getCalendarEvents(range: { from: string; to: string }) {
  const params = new URLSearchParams(range);
  return api.get<CalendarEventsResponse>(`/api/calendar/events?${params.toString()}`);
}

export type CalendarSuggestionsResponse = {
  connected: boolean;
  suggestions: CalendarSuggestion[];
};

export function listCalendarSources() {
  return api.get<CalendarSourcesResponse>('/api/calendar/sources');
}

export function updateCalendarSource(
  id: number,
  input: Partial<Pick<CalendarSource, 'enabled' | 'color' | 'order'>>,
) {
  return api.patch<CalendarSource>(`/api/calendar/sources/${id}`, input);
}

export function getStatsSummary() {
  return api.get<StatsSummary>('/api/stats');
}

export function getFrequencyStats() {
  return api.get<FrequencyStats>('/api/stats/frequency');
}

const statPanelsPath = (projectId: number | string) => `/api/projects/${projectId}/stat-panels`;

// One request returns visible AND hidden panels; the UI splits them on `hidden`.
export function listStatPanels(projectId: number | string) {
  return api.get<StatPanel[]>(`${statPanelsPath(projectId)}?includeHidden=true`);
}

export function previewStatPanel(projectId: number | string, input: StatPanelInput) {
  return api.post<StatPanelPreview>(`${statPanelsPath(projectId)}/preview`, input);
}

export function createStatPanel(
  projectId: number | string,
  input: StatPanelInput & { name: string },
) {
  return api.post<StatPanel>(statPanelsPath(projectId), input);
}

export function updateStatPanel(
  projectId: number | string,
  panelId: number,
  input: Partial<StatPanelInput & { name: string; position: number; hidden: boolean }>,
) {
  return api.patch<StatPanel>(`${statPanelsPath(projectId)}/${panelId}`, input);
}

export function deleteStatPanel(projectId: number | string, panelId: number) {
  return api.delete<void>(`${statPanelsPath(projectId)}/${panelId}`);
}

// Entry history endpoints.
//
// The history route answers 404 both for an entry that does not exist and for
// one that has no audit rows yet. Which of the two it is is the entry query's
// job to report, so here "no history yet" is an empty list rather than an
// error — otherwise a freshly created entry would show a failure instead of
// its empty state.
export async function getEntryHistory(entryId: string | number): Promise<EntryVersion[]> {
  try {
    const { versions } = await api.get<{ versions: EntryVersion[] | null }>(
      `/api/entries/${entryId}/history`,
    );
    return versions ?? [];
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return [];
    throw err;
  }
}

// Restore is append-only: it writes a new UPDATE row that reuses an old one's
// values, so the caller passes the audit row to replay, not an entry id.
export function restoreEntryVersion(entryId: string | number, auditId: number) {
  return api.post<{ entry: Entry; tagsChanged: boolean }>(
    `/api/entries/${entryId}/history/${auditId}/restore`,
  );
}
export function getProjectTrash(projectId: number | string) {
  return api.get<ProjectTrash>(`/api/projects/${projectId}/trash`);
}

/** The logbook as it stood at the end of `date` (YYYY-MM-DD). */
export function getEntriesAsAt(date: string) {
  return api.get<EntriesAsAt>(`/api/entries/as-at?date=${encodeURIComponent(date)}`);
}

export function restoreEntry(entryId: number) {
  return api.post<Entry>(`/api/entries/${entryId}/restore`);
}
