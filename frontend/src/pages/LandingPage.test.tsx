import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, get: getMock },
    getStatsSummary: () => getMock('/api/stats'),
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Signed out by default: the session request fails.
  getMock.mockRejectedValue(new Error('Unauthorized'));
});

describe('LandingPage', () => {
  it('links sign-in and sign-up actions to the right routes', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Start logging for free' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('link', { name: 'I have an account' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.getByRole('link', { name: 'Create your logbook' })).toHaveAttribute(
      'href',
      '/signup',
    );
  });

  it('renders the feature highlights', () => {
    renderPage();

    expect(screen.getByText('Your projects, your way')).toBeInTheDocument();
    expect(screen.getByText('Three seconds, not three excuses')).toBeInTheDocument();
    expect(screen.getByText('Everywhere you are')).toBeInTheDocument();
  });

  it('shows no streak to a signed-out visitor', () => {
    renderPage();

    expect(screen.queryByText(/day streak/)).not.toBeInTheDocument();
  });

  it("shows a signed-in visitor's streak in the masthead", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === '/api/auth/get-session') {
        return Promise.resolve({ session: {}, user: { id: 'u1', name: 'Sam', email: 's@x.io' } });
      }
      if (path === '/api/stats') {
        return Promise.resolve({ perProject: [], totalHours: 12, streak: 6 });
      }
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });

    renderPage();

    // Rendered once for mobile and once for desktop (one is CSS-hidden).
    expect((await screen.findAllByText('6-day streak')).length).toBeGreaterThan(0);
  });
});
