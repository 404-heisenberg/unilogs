import { apiFetch } from './client';

export async function getEntries() {
  return apiFetch('/api/entries');
}

export async function createEntry(data: { projectId: number; content: string; date?: string }) {
  return apiFetch('/api/entries', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
