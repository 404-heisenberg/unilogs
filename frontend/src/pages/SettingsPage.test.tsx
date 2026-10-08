import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import SettingsPage from './SettingsPage';

const { getMock, postMock, deleteMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
  patchMock: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, get: getMock, post: postMock, delete: deleteMock, patch: patchMock },
    // The real helpers close over the unmocked `api`, so route them here.
    listCalendarSources: () => getMock('/api/calendar/sources'),
    updateCalendarSource: (id: number, input: unknown) =>
      patchMock(`/api/calendar/sources/${id}`, input),
  };
});

const SOURCES = [
  {
    id: 1,
    calendarId: 'lectures@group.calendar.google.com',
    summary: 'Lectures',
    description: '',
    color: '#d4a843',
    enabled: true,
    order: 0,
  },
  {
    id: 2,
    calendarId: 'tutorials@group.calendar.google.com',
    summary: 'Tutorials',
    description: '',
    color: '#3e7a52',
    enabled: false,
    order: 1,
  },
];

const SESSION = { session: {}, user: { id: 'u1', name: 'Ada', email: 'ada@example.test' } };

function renderPage(initialEntry = '/settings') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Toaster />
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The Notifications and Tags sections added by D-09 fetch their own data on
// mount; these tests don't exercise them, so give every GET a harmless
// default rather than leaving them to reject as "unexpected".
function otherSettingsSectionsDefault(path: string): unknown {
  if (path === '/api/settings') return { remindersEnabled: true };
  if (path.startsWith('/api/projects')) return [];
  if (path === '/api/tags') return [];
  if (path === '/api/calendar/sources') return { connected: true, sources: SOURCES };
  return undefined;
}

function mockCalendarStatus(connected: boolean) {
  getMock.mockImplementation((path: string) => {
    if (path === '/api/auth/get-session') return Promise.resolve(SESSION);
    if (path === '/api/calendar/status') return Promise.resolve({ connected });
    const fallback = otherSettingsSectionsDefault(path);
    if (fallback !== undefined) return Promise.resolve(fallback);
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Settings sections', () => {
  it('shows the two sections, with App selected by default', () => {
    mockCalendarStatus(false);
    renderPage();

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Account', 'App']);
    expect(screen.getByRole('tab', { name: 'App' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'false');
  });

  it('opens on the section named in the URL', () => {
    mockCalendarStatus(false);
    renderPage('/settings?tab=account');

    expect(screen.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true');
  });

  it('falls back to App for an unknown section in the URL', () => {
    mockCalendarStatus(false);
    renderPage('/settings?tab=nonsense');

    expect(screen.getByRole('tab', { name: 'App' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps the account details and delete action on the Account section', async () => {
    mockCalendarStatus(false);
    renderPage('/settings?tab=account');

    expect(await screen.findByText('ada@example.test')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign out$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
  });

  it('keeps reminders, calendar and tags on the App section', async () => {
    mockCalendarStatus(false);
    renderPage('/settings?tab=app');

    expect(await screen.findByText('Not connected')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    // The destructive action is deliberately not on this section.
    expect(screen.queryByRole('button', { name: /delete account/i })).not.toBeInTheDocument();
  });

  it('switches sections when a tab is clicked', async () => {
    mockCalendarStatus(false);
    renderPage();

    await userEvent.click(screen.getByRole('tab', { name: 'Account' }));

    expect(await screen.findByText('ada@example.test')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: 'App' }));
    expect(await screen.findByText('Notifications')).toBeInTheDocument();
  });
});

describe('Google Calendar settings', () => {
  it('shows a disconnected state with a Connect action', async () => {
    mockCalendarStatus(false);
    renderPage();

    expect(await screen.findByText('Not connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect google calendar/i })).toBeInTheDocument();
    // The disconnected state never fires a request for events.
    expect(getMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/calendar/events'));
  });

  it('shows a connected state with a Disconnect action', async () => {
    mockCalendarStatus(true);
    renderPage();

    expect(await screen.findByText('Connected')).toBeInTheDocument();
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
      const fallback = otherSettingsSectionsDefault(path);
      if (fallback !== undefined) return Promise.resolve(fallback);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    deleteMock.mockImplementation(() => {
      connected = false;
      return Promise.resolve({ connected: false });
    });

    renderPage();
    expect(await screen.findByText('Connected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^disconnect$/i }));

    expect(deleteMock).toHaveBeenCalledWith('/api/calendar/disconnect');
    expect(await screen.findByText('Not connected')).toBeInTheDocument();
  });

  it('shows an error state when the status check fails, with a retry action', async () => {
    getMock.mockImplementation((path: string) => {
      if (path === '/api/auth/get-session') return Promise.resolve(SESSION);
      if (path === '/api/calendar/status') return Promise.reject(new Error('network error'));
      const fallback = otherSettingsSectionsDefault(path);
      if (fallback !== undefined) return Promise.resolve(fallback);
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

describe('Calendar sources', () => {
  it('lists each Google calendar with its on/off switch once connected', async () => {
    mockCalendarStatus(true);
    renderPage();

    const lectures = await screen.findByRole('switch', { name: 'Use the Lectures calendar' });
    const tutorials = screen.getByRole('switch', { name: 'Use the Tutorials calendar' });
    expect(lectures).toBeChecked();
    expect(tutorials).not.toBeChecked();
    expect(screen.getByText('Lectures')).toBeInTheDocument();
    expect(screen.getAllByText('Google')).toHaveLength(2);
  });

  it('is hidden, and asks Google for nothing, while disconnected', async () => {
    mockCalendarStatus(false);
    renderPage();

    expect(await screen.findByText('Not connected')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Calendars' })).not.toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalledWith('/api/calendar/sources');
  });

  it('turns a calendar off with a PATCH', async () => {
    mockCalendarStatus(true);
    patchMock.mockResolvedValue({ ...SOURCES[0], enabled: false });
    renderPage();

    const lectures = await screen.findByRole('switch', { name: 'Use the Lectures calendar' });
    await userEvent.click(lectures);

    expect(patchMock).toHaveBeenCalledWith('/api/calendar/sources/1', { enabled: false });
    await waitFor(() => expect(lectures).not.toBeChecked());
  });

  it('puts the switch back if the change fails', async () => {
    mockCalendarStatus(true);
    patchMock.mockRejectedValue(new Error('Failed to update calendar sources'));
    renderPage();

    const tutorials = await screen.findByRole('switch', { name: 'Use the Tutorials calendar' });
    await userEvent.click(tutorials);

    expect(await screen.findByText('Failed to update calendar sources')).toBeInTheDocument();
    expect(tutorials).not.toBeChecked();
  });
});
