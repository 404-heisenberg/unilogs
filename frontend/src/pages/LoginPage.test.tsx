import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, post: postMock } };
});

function renderPage(initialEntry = '/login') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginPage Google sign-in', () => {
  it('starts the OAuth flow and redirects to the URL the backend returns', async () => {
    postMock.mockResolvedValue({ url: 'https://accounts.google.com/o/oauth2/consent' });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });

    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /google/i }));

    expect(postMock).toHaveBeenCalledWith('/api/auth/social/google', { from: 'login' });
    await waitFor(() =>
      expect(window.location.href).toBe('https://accounts.google.com/o/oauth2/consent'),
    );

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('shows an error if starting the OAuth flow fails', async () => {
    postMock.mockRejectedValue(new Error('Failed to start Google sign-in'));

    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /google/i }));

    expect(await screen.findByText('Failed to start Google sign-in')).toBeInTheDocument();
  });

  it('shows a cancellation notice when redirected back with an OAuth error', () => {
    renderPage('/login?oauthError=1');

    expect(
      screen.getByText("Google sign-in was cancelled or didn't complete. Please try again."),
    ).toBeInTheDocument();
  });

  it('does not show a cancellation notice on a plain visit', () => {
    renderPage();

    expect(
      screen.queryByText("Google sign-in was cancelled or didn't complete. Please try again."),
    ).not.toBeInTheDocument();
  });
});
