import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ResetPasswordPage from './ResetPasswordPage';

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, post: postMock } };
});

function renderPage(initialEntry = '/reset-password') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ResetPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ResetPasswordPage without a token', () => {
  it('requests a reset link and shows the confirmation', async () => {
    postMock.mockResolvedValue({ message: 'ok' });

    renderPage();
    await userEvent.type(screen.getByLabelText(/email address/i), 'ada@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(postMock).toHaveBeenCalledWith('/api/auth/forgot-password', {
      email: 'ada@example.test',
    });
    expect(await screen.findByText('Request received')).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    postMock.mockRejectedValue(new Error('Failed to send reset link'));

    renderPage();
    await userEvent.type(screen.getByLabelText(/email address/i), 'ada@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(await screen.findByText('Failed to send reset link')).toBeInTheDocument();
  });
});

describe('ResetPasswordPage with a token', () => {
  it('rejects mismatched passwords without calling the API', async () => {
    renderPage('/reset-password?token=abc123');

    await userEvent.type(screen.getByLabelText(/^new password/i), 'password1');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'password2');
    await userEvent.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('resets the password and shows the confirmation', async () => {
    postMock.mockResolvedValue({ message: 'ok' });

    renderPage('/reset-password?token=abc123');
    await userEvent.type(screen.getByLabelText(/^new password/i), 'new-password-1');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'new-password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(postMock).toHaveBeenCalledWith('/api/auth/reset-password', {
      token: 'abc123',
      newPassword: 'new-password-1',
    });
    expect(await screen.findByText('Password updated')).toBeInTheDocument();
  });
});
