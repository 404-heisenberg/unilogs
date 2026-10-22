import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
  content: { notes: 'Read chapter 3' },
  project: { id: 1, name: 'Thesis', archived: false, userId: 'u1', reminderFrequency: 'WEEKLY' },
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
    getMock.mockImplementation((path: string) => {
      if (path === '/api/entries/10') return Promise.resolve(ENTRY);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });

    renderPage();

    // Target the properties sidebar specifically to check the project name
    const propertiesHeading = await screen.findByRole('heading', { name: /properties/i });
    const sidebar = propertiesHeading.closest('aside')!;
    expect(within(sidebar).getByText('Thesis')).toBeInTheDocument();

    // Target the main article element to scope the content check and avoid duplicates
    const article = screen.getByRole('article');
    expect(within(article).getByText('Read chapter 3')).toBeInTheDocument();

    expect(getMock).toHaveBeenCalledWith('/api/entries/10');
  });

  it('shows the body as the prose when the entry has one', async () => {
    getMock.mockImplementation((path: string) => {
      if (path === '/api/entries/10') {
        return Promise.resolve({
          ...ENTRY,
          body: 'The discussion now answers each research question in order.',
        });
      }
      if (path === '/api/field-definitions?projectId=1') {
        return Promise.resolve([
          { id: 1, projectId: 1, name: 'hours', fieldType: 'number' },
          { id: 2, projectId: 1, name: 'notes', fieldType: 'text' },
        ]);
      }
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });

    renderPage();

    const article = await screen.findByRole('article');
    expect(
      await within(article).findByText(/The discussion now answers each research question/),
    ).toBeInTheDocument();
    // The body is the prose. A field value is not.
    expect(within(article).queryByText('Read chapter 3')).not.toBeInTheDocument();
  });

  it('falls back to a text field when the entry has no body', async () => {
    getMock.mockImplementation((path: string) => {
      if (path === '/api/entries/10') return Promise.resolve(ENTRY);
      if (path === '/api/field-definitions?projectId=1') {
        return Promise.resolve([
          { id: 1, projectId: 1, name: 'hours', fieldType: 'number' },
          { id: 2, projectId: 1, name: 'notes', fieldType: 'text' },
        ]);
      }
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });

    renderPage();

    const article = await screen.findByRole('article');
    expect(await within(article).findByText('Read chapter 3')).toBeInTheDocument();
    expect(within(article).queryByText('No notes')).not.toBeInTheDocument();
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
