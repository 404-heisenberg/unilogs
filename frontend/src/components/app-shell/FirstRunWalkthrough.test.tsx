import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FirstRunWalkthrough from './FirstRunWalkthrough';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
}));

const DISMISS_KEY = 'unilogs:walkthrough-dismissed';

// The dialog reflects its open state back through onOpenChange, so a tiny
// harness keeps that state real instead of stubbing it.
const onOpenChange = vi.hoisted(() => vi.fn());

function Harness() {
  const [open, setOpen] = useState(false);
  onOpenChange.mockImplementation((next: boolean) => setOpen(next));
  return <FirstRunWalkthrough open={open} onOpenChange={onOpenChange} />;
}

function renderHarness(projects: unknown[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api.get).mockResolvedValue(projects as never);
  const router = createMemoryRouter(
    [
      { path: '/', element: <Harness /> },
      { path: '/projects/new', element: <div>PROJECT NEW PAGE</div> },
    ],
    { initialEntries: ['/'] },
  );
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem(DISMISS_KEY);
  vi.mocked(api.get).mockResolvedValue([] as never);
});

describe('FirstRunWalkthrough', () => {
  it('auto-opens on first run when the user has no projects', async () => {
    renderHarness([]);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(true));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Your journal, your rules')).toBeInTheDocument();
  });

  it('stays closed for users who already have projects', async () => {
    renderHarness([{ id: 1, name: 'Gym', description: null, userId: 'u1' }]);

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stays closed once dismissed', async () => {
    localStorage.setItem(DISMISS_KEY, '1');
    renderHarness([]);

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('walks from welcome to create-a-project, then lands on the new project page', async () => {
    renderHarness([]);

    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(screen.getByText('Create a project first')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Create a project' }));
    expect(await screen.findByText('PROJECT NEW PAGE')).toBeInTheDocument();
    expect(localStorage.getItem(DISMISS_KEY)).toBe('1');
  });

  it('Skip dismisses and remembers the choice', async () => {
    renderHarness([]);

    await userEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    expect(localStorage.getItem(DISMISS_KEY)).toBe('1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
