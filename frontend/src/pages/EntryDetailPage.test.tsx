import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import EntryDetailPage from './EntryDetailPage';
import type { Entry } from '@/types';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: getMock } };
});

const ENTRY: Entry = {
  id: 10,
  projectId: 1,
  date: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-09-01T08:00:00.000Z',
  content: { Notes: 'Read chapter 3' },
  project: { id: 1, name: 'Thesis', archived: false, userId: 'u1' },
  tags: [{ tag: { id: 1, name: 'reading' } }],
};

function renderPage(entryId = '10') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/entries/${entryId}`]}>
        <Routes>
          <Route path="/entries/:entryId" element={<EntryDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EntryDetailPage', () => {
  it('renders the entry content, tags and project name', async () => {
    getMock.mockResolvedValue(ENTRY);

    renderPage();

    expect(await screen.findByText('Thesis')).toBeInTheDocument();
    expect(screen.getByText('Read chapter 3')).toBeInTheDocument();
    expect(screen.getByText('reading')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith('/api/entries/10');
  });

  it('shows a not-found state for a 404', async () => {
    getMock.mockRejectedValue(new ApiError(404, 'Not found'));

    renderPage();

    expect(
      await screen.findByText("This entry doesn't exist, or it isn't yours."),
    ).toBeInTheDocument();
  });

  it('shows a generic error state for other failures', async () => {
    getMock.mockRejectedValue(new ApiError(500, 'Server error'));

    renderPage();

    expect(
      await screen.findByText('Failed to load this entry. Try refreshing the page.'),
    ).toBeInTheDocument();
  });
});
