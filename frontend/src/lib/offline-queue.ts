import type { SyncQueuedEntry } from '@/lib/api';

// Mirrors MAX_SYNC_BATCH_SIZE on the endpoint. A flush sends the queue in
// chunks of this size, because one request over the limit is rejected outright
// and would strand an entire offline session.
export const SYNC_BATCH_SIZE = 100;

const STORAGE_KEY = 'unilogs:offline-queue';

/**
 * The id a queued entry carries to the sync endpoint, which upserts on it.
 * `crypto.randomUUID` needs a secure context, so there is a fallback: an
 * insecure LAN address is an odd place to run this app, but losing an offline
 * entry to it is not a trade worth making. The backend only requires a
 * non-empty string under 192 characters.
 */
export function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function isQueuedEntry(value: unknown): value is SyncQueuedEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.clientId === 'string' &&
    entry.clientId.length > 0 &&
    typeof entry.projectId === 'number' &&
    typeof entry.content === 'object' &&
    entry.content !== null
  );
}

/**
 * Reads the queue. Never throws: a corrupt or unreadable store must not stop
 * someone saving an entry, and an unreadable queue is simply an empty one.
 */
export function readQueue(): SyncQueuedEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueuedEntry);
  } catch {
    return [];
  }
}

function writeQueue(queue: SyncQueuedEntry[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    return true;
  } catch {
    // Quota exceeded, or storage is disabled. The caller has to keep the entry
    // in front of the user rather than pretend it was queued.
    return false;
  }
}

export function queueSize(): number {
  return readQueue().length;
}

/**
 * Queues one entry. Returns false when it could not be persisted, which the
 * caller must surface: losing an offline entry silently is worse than refusing
 * to queue it. Re-adding a clientId already present is a no-op success - that
 * is exactly what makes replaying the queue safe.
 */
export function enqueue(entry: SyncQueuedEntry): boolean {
  const queue = readQueue();
  if (queue.some((queued) => queued.clientId === entry.clientId)) return true;
  return writeQueue([...queue, entry]);
}

/** Drops the entries the server has acknowledged. */
export function removeQueued(clientIds: string[]): void {
  if (clientIds.length === 0) return;
  const acknowledged = new Set(clientIds);
  writeQueue(readQueue().filter((queued) => !acknowledged.has(queued.clientId)));
}
