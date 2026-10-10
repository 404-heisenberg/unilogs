import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExplorerPane from './ExplorerPane';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
}));

function renderPane(collapsed: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ExplorerPane collapsed={collapsed} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { container: result.container };
}

describe('ExplorerPane', () => {
  it('keeps the tree mounted but hidden when collapsed so it can animate', async () => {
    vi.mocked(api.get).mockResolvedValue([] as never);
    const { container } = renderPane(true);

    const aside = container.querySelector('aside');
    expect(aside).toHaveAttribute('aria-hidden', 'true');
    expect(aside?.className).toContain('invisible');

    // Mounted and present in the DOM, ready to slide back out.
    expect(await screen.findByText('Projects')).toBeInTheDocument();
  });

  it('shows the tree when expanded', () => {
    vi.mocked(api.get).mockResolvedValue([] as never);
    const { container } = renderPane(false);

    const aside = container.querySelector('aside');
    expect(aside).toHaveAttribute('aria-hidden', 'false');
    expect(aside?.className).not.toContain('invisible');
  });
});
