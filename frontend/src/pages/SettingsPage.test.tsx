import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';

const { getMock, postMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: getMock, post: postMock, delete: deleteMock } };
});

const SESSION = { session: {}, user: { id: 'u1', name: 'Ada', email: 'ada@example.test' } };

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockCalendarStatus(connected: boolean) {
  getMock.mockImplementation((path: string) => {
    if (path === '/api/auth/get-session') return Promise.resolve(SESSION);
    if (path === '/api/calendar/status') return Promise.resolve({ connected });
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Google Calendar settings', () => {
  it('shows a disconnected state with a Connect action', async () => {
    mockCalendarStatus(false);
    renderPage();

    expect(await screen.findByText('Your Google Calendar is not connected.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect google calendar/i })).toBeInTheDocument();
    // The disconnected state never fires a request for events.
    expect(getMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/calendar/events'));
  });

  it('shows a connected state with a Disconnect action', async () => {
    mockCalendarStatus(true);
    renderPage();

    expect(await screen.findByText('Your Google Calendar is connected.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^disconnect$/i })).toBeInTheDocument();
  });

  it('connect redirects the browser to the URL the backend returns', async () => {
    mockCalendarStatus(false);
    postMock.mockResolvedValue({ url: 'https://accounts.google.com/o/oauth2/consent' });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /connect google calendar/i }));

    await waitFor(() =>
      expect(window.location.href).toBe('https://accounts.google.com/o/oauth2/consent'),
    );
    expect(postMock).toHaveBeenCalledWith('/api/calendar/connect');

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('disconnect updates the interface without a page reload', async () => {
    let connected = true;
    getMock.mockImplementation((path: string) => {
      if (path === '/api/auth/get-session') return Promise.resolve(SESSION);
      if (path === '/api/calendar/status') return Promise.resolve({ connected });
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    deleteMock.mockImplementation(() => {
      connected = false;
      return Promise.resolve({ connected: false });
    });

    renderPage();
    expect(await screen.findByText('Your Google Calendar is connected.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^disconnect$/i }));

    expect(deleteMock).toHaveBeenCalledWith('/api/calendar/disconnect');
    expect(await screen.findByText('Your Google Calendar is not connected.')).toBeInTheDocument();
  });

  it('shows an error state when the status check fails, with a retry action', async () => {
    getMock.mockImplementation((path: string) => {
      if (path === '/api/auth/get-session') return Promise.resolve(SESSION);
      if (path === '/api/calendar/status') return Promise.reject(new Error('network error'));
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });

    renderPage();

    expect(
      await screen.findByText("Couldn't check the Google Calendar connection."),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('surfaces an error if the connect request itself fails', async () => {
    mockCalendarStatus(false);
    postMock.mockRejectedValue(new Error('Failed to connect Google Calendar'));

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /connect google calendar/i }));

    expect(await screen.findByText('Failed to connect Google Calendar')).toBeInTheDocument();
  });
});
