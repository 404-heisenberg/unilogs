import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import EntryHistoryPage from './EntryHistoryPage';
import type { Entry, EntryVersion } from '@/types';

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, get: getMock, post: postMock },
    // The real helpers close over the unmocked `api`, so route them here.
    getEntryHistory: (entryId: string | number) => getMock(`/api/entries/${entryId}/history`),
    restoreEntryVersion: (entryId: string | number, auditId: number) =>
      postMock(`/api/entries/${entryId}/history/${auditId}/restore`),
  };
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const ENTRY: Entry = {
  id: 123,
  projectId: 1,
  date: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-09-01T10:00:00.000Z',
  title: 'Current Entry Title',
  body: 'Current body text',
  content: {},
  tags: [],
  project: {
    id: 1,
    name: 'Test Project',
    archived: false,
    userId: 'u1',
    reminderFrequency: 'WEEKLY',
  },
};

const HISTORY: EntryVersion[] = [
  {
    auditId: 1,
    action: 'UPDATE',
    modifiedAt: '2026-08-01T10:00:00.000Z',
    snapshot: {
      title: 'Historical Version Title',
      body: 'Historical body text',
      content: {},
      date: '2026-08-01T00:00:00.000Z',
      tagIds: [],
    },
  },
];

function renderHistoryPage() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/entries/123/history']}>
        <Routes>
          <Route path="/entries/:entryId/history" element={<EntryHistoryPage />} />
          <Route path="/entries/:entryId" element={<div>Entry Detail View</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockGet(history: EntryVersion[]) {
  getMock.mockImplementation((url: string) => {
    if (url === '/api/entries/123') return Promise.resolve(ENTRY);
    if (url.startsWith('/api/field-definitions')) return Promise.resolve([]);
    if (url === '/api/entries/123/history') return Promise.resolve(history);
    return Promise.reject(new Error(`Unknown GET: ${url}`));
  });
}

describe('EntryHistoryPage - Version Restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores the selected version when the restore button is clicked', async () => {
    mockGet(HISTORY);

    renderHistoryPage();

    const restoreButton = await screen.findByRole('button', { name: /restore this version/i });
    expect(restoreButton).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Historical Version Title' })).toBeInTheDocument();

    await userEvent.click(restoreButton);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(1);
      expect(postMock).toHaveBeenCalledWith('/api/entries/123/history/1/restore');
    });

    expect(screen.getByText('Entry Detail View')).toBeInTheDocument();
  });

  it('shows the empty state when the entry has no history yet', async () => {
    mockGet([]);

    renderHistoryPage();

    expect(await screen.findByText('No previous versions yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restore this version/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Current Entry Title' })).toBeInTheDocument();
  });
});
