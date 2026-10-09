import { useCallback, useEffect, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { syncEntries, type SyncEntryResult } from '@/lib/api';
import { readQueue, removeQueued, SYNC_BATCH_SIZE } from '@/lib/offline-queue';
import { toast } from '@/lib/toast';

export type FlushOutcome = {
  /** Entries the server accepted, so they were dropped from the queue. */
  synced: number;
  /** Entries the server rejected. They stay queued. */
  failures: { clientId: string; reason?: string }[];
};

const EMPTY: FlushOutcome = { synced: 0, failures: [] };

// The queue can be replayed from two places at once - the shell on app load and
// the entry editor when it mounts. Without this, both would send the same batch
// in the same tick. It is safe either way (the endpoint upserts on clientId),
// but one request instead of two is the point.
let inFlight: Promise<FlushOutcome> | null = null;

async function runFlush(queryClient: QueryClient): Promise<FlushOutcome> {
  // Announcing "online" and actually reaching the server are different things,
  // but attempting a flush while still offline only produces a doomed request
  // and a console error, so start there.
  if (typeof navigator !== 'undefined' && !navigator.onLine) return EMPTY;

  const queue = readQueue();
  if (queue.length === 0) return EMPTY;

  const outcome: FlushOutcome = { synced: 0, failures: [] };
  const acknowledged: string[] = [];

  for (let start = 0; start < queue.length; start += SYNC_BATCH_SIZE) {
    const batch = queue.slice(start, start + SYNC_BATCH_SIZE);
    let results: SyncEntryResult[];
    try {
      ({ results } = await syncEntries(batch));
    } catch {
      // The request itself failed - still offline, or the server is down.
      // Break rather than throw: every entry not acknowledged above stays in
      // the queue, and the next reconnect picks up from there.
      break;
    }

    for (const result of results) {
      if (result.status === 'failed') {
        outcome.failures.push({ clientId: result.clientId, reason: result.reason });
      } else {
        acknowledged.push(result.clientId);
        outcome.synced += 1;
      }
    }
  }

  removeQueued(acknowledged);
  if (outcome.synced > 0) {
    void queryClient.invalidateQueries({ queryKey: ['entries'] });
  }

  if (outcome.failures.length === 1) {
    toast.error("Couldn't sync an offline entry", { description: outcome.failures[0].reason });
  } else if (outcome.failures.length > 1) {
    toast.error(`Couldn't sync ${outcome.failures.length} offline entries`, {
      description: outcome.failures[0].reason,
    });
  } else if (outcome.synced > 0) {
    toast.success(
      outcome.synced === 1
        ? 'Your offline entry has synced'
        : `Your ${outcome.synced} offline entries have synced`,
    );
  }

  return outcome;
}

export function flushQueue(queryClient: QueryClient): Promise<FlushOutcome> {
  if (!inFlight) {
    inFlight = runFlush(queryClient).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/**
 * Tracks connectivity and drains the offline queue.
 *
 * Call it anywhere the queue matters: `AppShell` calls it so a leftover queue
 * replays on every app load, and the entry editor calls it so the banner and
 * the queued count stay current while someone is writing.
 */
export function useOfflineQueue() {
  const queryClient = useQueryClient();
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(() => readQueue().length);

  const refresh = useCallback(() => setQueuedCount(readQueue().length), []);

  const flush = useCallback(() => {
    return flushQueue(queryClient).then((outcome) => {
      refresh();
      return outcome;
    });
  }, [queryClient, refresh]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      void flush();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Reconnect or a fresh load: replay whatever is still queued. The count
    // itself is read when the component mounts and refreshed once this flush
    // settles, so there is no need to set state synchronously in here.
    void flush();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flush]);

  return { isOffline, queuedCount, flush, refresh };
}
