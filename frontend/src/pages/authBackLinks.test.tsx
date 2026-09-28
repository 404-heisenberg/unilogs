import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage';
import SignupPage from './SignupPage';
import ResetPasswordPage from './ResetPasswordPage';
import VerifyEmailPage from './VerifyEmailPage';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn() } };
});

type Entry = string | { pathname: string; search?: string; state?: unknown };

// The four auth pages wired together, so links between them can be clicked.
function renderAt(entry: Entry) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/" element={<p>Home page</p>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const backLink = () => screen.getByRole('link', { name: /^Back to / });

describe('auth back links', () => {
  it('sign in goes back home when opened directly', () => {
    renderAt('/login');

    expect(backLink()).toHaveTextContent('Back to home');
    expect(backLink()).toHaveAttribute('href', '/');
  });

  it('sign up goes back home when opened directly', () => {
    renderAt('/signup');

    expect(backLink()).toHaveTextContent('Back to home');
    expect(backLink()).toHaveAttribute('href', '/');
  });

  it('sign in → sign up offers "Back to sign in", which leads back to sign in', async () => {
    const user = userEvent.setup();
    renderAt('/login');

    await user.click(screen.getByRole('link', { name: 'Sign up' }));
    expect(backLink()).toHaveTextContent('Back to sign in');

    await user.click(backLink());
    // Back on sign in, whose own back link now goes home (no ping-pong).
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(backLink()).toHaveTextContent('Back to home');
  });

  it('sign up → sign in offers "Back to sign up", which leads back to sign up', async () => {
    const user = userEvent.setup();
    renderAt('/signup');

    await user.click(screen.getByRole('link', { name: 'Sign In' }));
    expect(backLink()).toHaveTextContent('Back to sign up');

    await user.click(backLink());
    expect(screen.getByRole('heading', { name: 'Create an account' })).toBeInTheDocument();
    expect(backLink()).toHaveTextContent('Back to home');
  });

  it('sign in → reset password offers "Back to sign in"', async () => {
    const user = userEvent.setup();
    renderAt('/login');

    await user.click(screen.getByRole('link', { name: 'Reset' }));
    expect(backLink()).toHaveTextContent('Back to sign in');
    expect(backLink()).toHaveAttribute('href', '/login');
  });

  it('verify email goes back to sign up right after signing up', () => {
    renderAt({
      pathname: '/verify-email',
      search: '?email=sam%40example.com',
      state: { from: 'signup' },
    });

    expect(backLink()).toHaveTextContent('Back to sign up');
    expect(backLink()).toHaveAttribute('href', '/signup');
  });

  it('verify email goes back to sign in otherwise (e.g. from the email link)', () => {
    renderAt('/verify-email?email=sam%40example.com');

    expect(backLink()).toHaveTextContent('Back to sign in');
    expect(backLink()).toHaveAttribute('href', '/login');
  });
});
