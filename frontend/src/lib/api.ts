const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

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

export function getStatsSummary() {
  return api.get<StatsSummary>('/api/stats');
}

export function getFrequencyStats() {
  return api.get<FrequencyStats>('/api/stats/frequency');
}
