import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import EntryHistoryPage from './EntryHistoryPage';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe('EntryHistoryPage - Version Restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores the selected version when the restore button is clicked', async () => {
    const queryClient = createTestQueryClient();

    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/entries/123') {
        return Promise.resolve({
          id: 123,
          projectId: 1,
          title: 'Current Entry Title',
          body: 'Current body text',
          createdAt: '2026-09-01T10:00:00.000Z',
          project: { id: 1, name: 'Test Project', code: 'TP' },
          tags: [],
        });
      }
      if (url.startsWith('/api/field-definitions')) {
        return Promise.resolve([]);
      }
      if (url === '/api/entries/123/history') {
        return Promise.resolve([
          {
            id: 1,
            title: 'Historical Version Title',
            body: 'Historical body text',
            createdAt: '2026-08-01T10:00:00.000Z',
            content: { title: 'Historical Version Title', body: 'Historical body text' },
          },
        ]);
      }
      return Promise.reject(new Error(`Unknown GET: ${url}`));
    });

    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      entry: { id: 123, title: 'Historical Version Title' },
      tagsChanged: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/entries/123/history']}>
          <Routes>
            <Route path="/entries/:entryId/history" element={<EntryHistoryPage />} />
            <Route path="/entries/:entryId" element={<div>Entry Detail View</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const restoreButton = await screen.findByRole('button', { name: /restore this version/i });
    expect(restoreButton).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Historical Version Title' })).toBeInTheDocument();

    await userEvent.click(restoreButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.post).toHaveBeenCalledWith('/api/entries/123/history/1/restore');
    });

    expect(screen.getByText('Entry Detail View')).toBeInTheDocument();
  });
});
