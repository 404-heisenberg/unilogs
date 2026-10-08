import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { enqueue, readQueue } from '@/lib/offline-queue';
import { useOfflineQueue } from './useOfflineQueue';

const { syncEntriesMock, toastMock } = vi.hoisted(() => ({
  syncEntriesMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, syncEntries: syncEntriesMock };
});

vi.mock('@/lib/toast', () => ({ toast: toastMock }));

function State() {
  const { isOffline, queuedCount } = useOfflineQueue();
  return (
    <div data-testid="state">
      offline={String(isOffline)} queued={queuedCount}
    </div>
  );
}

function renderHook() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <State />
    </QueryClientProvider>,
  );
}

/** Answers a flush with every entry created, which is the happy path. */
function acceptAll() {
  syncEntriesMock.mockImplementation((entries: { clientId: string }[]) =>
    Promise.resolve({
      results: entries.map((entry) => ({ clientId: entry.clientId, status: 'created' as const })),
    }),
  );
}

function queue(count: number) {
  for (let index = 0; index < count; index += 1) {
    enqueue({
      clientId: `c-${index}`,
      projectId: 1,
      content: { Notes: `entry ${index}` },
    });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  acceptAll();
});

describe('useOfflineQueue', () => {
  it('drains a leftover queue on mount, so a reload finishes what offline capture started', async () => {
    queue(2);

    renderHook();

    await waitFor(() => expect(readQueue()).toEqual([]));
    expect(syncEntriesMock).toHaveBeenCalledTimes(1);
    expect(syncEntriesMock).toHaveBeenCalledWith([
      expect.objectContaining({ clientId: 'c-0' }),
      expect.objectContaining({ clientId: 'c-1' }),
    ]);
    expect(toastMock.success).toHaveBeenCalledWith('Your 2 offline entries have synced');
  });

  it('flushes when the browser reports it is back online', async () => {
    renderHook();
    // Let the mount flush finish before queueing, so the two cannot overlap.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Queued after the mount flush, standing in for a save made while offline.
    queue(1);
    window.dispatchEvent(new Event('online'));

    await waitFor(() => expect(readQueue()).toEqual([]));
    expect(toastMock.success).toHaveBeenCalledWith('Your offline entry has synced');
  });

  it('keeps an entry the server rejected and says why', async () => {
    syncEntriesMock.mockImplementation((entries: { clientId: string }[]) =>
      Promise.resolve({
        results: entries.map((entry) =>
          entry.clientId === 'c-0'
            ? {
                clientId: entry.clientId,
                status: 'failed' as const,
                reason: 'Reps must be a number',
              }
            : { clientId: entry.clientId, status: 'created' as const },
        ),
      }),
    );
    queue(2);

    renderHook();

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    // c-0 was rejected and is still queued; c-1 synced and is gone.
    expect(readQueue().map((entry) => entry.clientId)).toEqual(['c-0']);
    expect(toastMock.error).toHaveBeenCalledWith("Couldn't sync an offline entry", {
      description: 'Reps must be a number',
    });
  });

  it('keeps the entire queue when the request itself fails', async () => {
    syncEntriesMock.mockRejectedValue(new TypeError('Failed to fetch'));
    queue(3);

    renderHook();

    // No success toast, no drop: everything waits for the next reconnect.
    await waitFor(() => expect(syncEntriesMock).toHaveBeenCalledTimes(1));
    expect(readQueue()).toHaveLength(3);
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('sends a long queue in batches of 100 rather than one oversized request', async () => {
    queue(250);

    renderHook();

    await waitFor(() => expect(readQueue()).toEqual([]));
    expect(syncEntriesMock).toHaveBeenCalledTimes(3);
    expect(syncEntriesMock.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 50]);
  });

  it('does not touch the network while offline', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    queue(1);

    renderHook();

    expect(await screen.findByTestId('state')).toHaveTextContent('offline=true');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(syncEntriesMock).not.toHaveBeenCalled();
    expect(readQueue()).toHaveLength(1);

    onLine.mockRestore();
  });
});
