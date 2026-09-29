import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NavRail from './NavRail';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
}));

function renderRail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NavRail explorerCollapsed={false} onToggleExplorer={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NavRail account badge', () => {
  it('shows the users initials instead of a product monogram', async () => {
    vi.mocked(api.get).mockResolvedValue({
      user: { id: 'u1', name: 'Renda M', email: 'renda@example.com' },
    } as never);

    renderRail();

    expect(await screen.findByText('RM')).toBeInTheDocument();
    expect(screen.queryByText('UL')).not.toBeInTheDocument();
  });

  it('falls back to a placeholder when the session has no name', async () => {
    vi.mocked(api.get).mockResolvedValue({
      user: { id: 'u1', name: '', email: 'renda@example.com' },
    } as never);

    renderRail();

    expect(await screen.findByText('?')).toBeInTheDocument();
  });

  it('sits with the notifications and settings controls, not in the primary nav', async () => {
    vi.mocked(api.get).mockResolvedValue({
      user: { id: 'u1', name: 'Renda M', email: 'renda@example.com' },
    } as never);

    const { container } = renderRail();

    const link = screen.getByRole('link', { name: 'Your account' });
    expect(link).toHaveAttribute('href', '/settings?tab=account');

    // The primary nav holds the three product destinations only. The account
    // badge must not be one of them, or it reads as another product area -
    // which is what user testing round 2 flagged.
    const nav = container.querySelector('nav');
    expect(nav).not.toContainElement(link);
  });

  it('keeps the settings rail item out of the account link', async () => {
    vi.mocked(api.get).mockResolvedValue(null as never);

    renderRail();
    await screen.findAllByRole('link');

    // Guards the Playwright substring-matching collision: if the account link
    // were labelled "Your account settings" it would match
    // getByRole('link', { name: 'Settings' }) and break the e2e specs.
    expect(screen.getByRole('link', { name: 'Your account' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });
});
