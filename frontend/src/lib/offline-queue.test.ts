import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SyncQueuedEntry } from '@/lib/api';
import {
  enqueue,
  newClientId,
  queueSize,
  readQueue,
  removeQueued,
  SYNC_BATCH_SIZE,
} from './offline-queue';

const STORAGE_KEY = 'unilogs:offline-queue';

function makeEntry(overrides: Partial<SyncQueuedEntry> = {}): SyncQueuedEntry {
  return { clientId: 'c-1', projectId: 1, content: { Notes: 'Chest day' }, ...overrides };
}

afterEach(() => vi.restoreAllMocks());

describe('the offline queue store', () => {
  it('stores an entry and reads it back', () => {
    expect(enqueue(makeEntry())).toBe(true);

    expect(readQueue()).toEqual([makeEntry()]);
    expect(queueSize()).toBe(1);
  });

  it('re-adding a clientId already queued is a no-op, not a duplicate', () => {
    enqueue(makeEntry({ clientId: 'c-1', content: { Notes: 'first' } }));
    enqueue(makeEntry({ clientId: 'c-1', content: { Notes: 'second' } }));

    expect(queueSize()).toBe(1);
    expect(readQueue()[0].content).toEqual({ Notes: 'first' });
  });

  it('appends without disturbing what is already queued', () => {
    enqueue(makeEntry({ clientId: 'c-1' }));
    enqueue(makeEntry({ clientId: 'c-2' }));

    expect(readQueue().map((entry) => entry.clientId)).toEqual(['c-1', 'c-2']);
  });

  it('treats an unreadable store as an empty queue rather than throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{ not json');

    expect(readQueue()).toEqual([]);
    expect(queueSize()).toBe(0);
  });

  it('treats a value that is not a list as empty', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ clientId: 'c-1' }));

    expect(readQueue()).toEqual([]);
  });

  it('drops entries that do not match the payload shape', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        makeEntry({ clientId: 'c-1' }),
        { clientId: '', projectId: 1, content: {} },
        { clientId: 'c-3', projectId: 'one', content: {} },
        { clientId: 'c-4', projectId: 1 },
        null,
        'nope',
      ]),
    );

    expect(readQueue().map((entry) => entry.clientId)).toEqual(['c-1']);
  });

  it('returns false when the browser refuses to store, so the caller can say so', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(enqueue(makeEntry())).toBe(false);
  });

  it('removes only the acknowledged entries', () => {
    enqueue(makeEntry({ clientId: 'c-1' }));
    enqueue(makeEntry({ clientId: 'c-2' }));
    enqueue(makeEntry({ clientId: 'c-3' }));

    removeQueued(['c-1', 'c-3']);

    expect(readQueue().map((entry) => entry.clientId)).toEqual(['c-2']);
  });

  it('leaves the queue untouched when nothing was acknowledged', () => {
    enqueue(makeEntry({ clientId: 'c-1' }));

    removeQueued([]);

    expect(queueSize()).toBe(1);
  });
});

describe('SYNC_BATCH_SIZE', () => {
  // The endpoint rejects a batch over its own limit outright, which would
  // strand a whole offline session in one failed request.
  it('matches the backend batch limit of 100', () => {
    expect(SYNC_BATCH_SIZE).toBe(100);
  });
});

describe('newClientId', () => {
  it('produces distinct non-empty ids', () => {
    const ids = Array.from({ length: 1000 }, () => newClientId());

    expect(new Set(ids).size).toBe(1000);
    for (const id of ids) expect(id.length).toBeGreaterThan(0);
  });
});
