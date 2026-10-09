import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectExplorer from './ProjectExplorer';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
}));

const PROJECTS = [
  { id: 1, name: 'Gym', description: null, userId: 'u1' },
  { id: 2, name: 'Sunrise Study', description: null, userId: 'u1' },
];

function renderExplorer(path = '/projects/1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ProjectExplorer />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/api/projects') return Promise.resolve(PROJECTS);
    if (url === '/api/entries?projectId=1&limit=5')
      return Promise.resolve({ entries: [{ id: 5, title: 'Leg day', projectId: 1 }] });
    if (url === '/api/entries?projectId=2&limit=5')
      return Promise.resolve({ entries: [{ id: 6, title: 'Read Ch.2', projectId: 2 }] });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
});

describe('ProjectExplorer', () => {
  it('expands the project on the current page and keeps the rest collapsed', async () => {
    renderExplorer();

    expect(await screen.findByText('Gym')).toBeInTheDocument();
    expect(await screen.findByText('Leg day')).toBeInTheDocument();

    expect(screen.queryByText('Read Ch.2')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse Gym' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Expand Sunrise Study' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('lets the chevron expand and collapse a project without navigating', async () => {
    renderExplorer();

    await userEvent.click(await screen.findByRole('button', { name: 'Expand Sunrise Study' }));
    expect(await screen.findByText('Read Ch.2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse Sunrise Study' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    // Still on project 1 — the chevron is not the row's link.
    expect(screen.getByRole('button', { name: 'Collapse Gym' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Collapse Gym' }));
    expect(screen.queryByText('Leg day')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Gym' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
