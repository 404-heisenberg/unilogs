import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configure, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CalendarPage from './CalendarPage';
import type { CalendarEvent } from '@/lib/api';
import type { Entry } from '@/types';

// The page draws a month on desktop and on mobile at once; the first render
// in a cold worker can pass the default 1s wait, so allow a little longer.
configure({ asyncUtilTimeout: 3000 });

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, get: getMock },
    // The real helper closes over the unmocked `api`, so route it here.
    getCalendarEvents: (range: { from: string; to: string }) =>
      getMock(`/api/calendar/events?${new URLSearchParams(range).toString()}`),
  };
});

const EVENTS: CalendarEvent[] = [
  {
    id: 'meeting',
    summary: 'Supervisor meeting',
    description: 'Thesis presentation & outline',
    start: { dateTime: new Date(2026, 8, 12, 14, 0).toISOString() },
    calendarSummary: 'Personal',
    color: '#4178db',
  },
  {
    id: 'lecture',
    summary: 'CS Theory Lecture',
    start: { date: '2026-09-14' },
    calendarSummary: 'Lectures',
    color: '#d4a843',
  },
  {
    id: 'tutorial',
    summary: 'Pipelining lab',
    start: { date: '2026-09-15' },
    calendarSummary: 'Tutorials',
    color: '#44a054',
  },
];

const ENTRIES: Entry[] = [
  {
    id: 42,
    projectId: 1,
    date: '2026-09-10T00:00:00.000Z',
    createdAt: '2026-09-10T15:00:00.000Z',
    title: 'Register interference graph',
    content: {},
  },
  {
    id: 43,
    projectId: 2,
    date: '2026-09-12T00:00:00.000Z',
    createdAt: new Date(2026, 8, 12, 9, 15).toISOString(),
    title: 'Literature review notes',
    content: {},
  },
];

function mockApi({ connected = true }: { connected?: boolean } = {}) {
  getMock.mockImplementation((path: string) => {
    if (path.startsWith('/api/calendar/events')) {
      return Promise.resolve(
        connected ? { connected: true, events: EVENTS } : { connected: false },
      );
    }
    if (path.startsWith('/api/projects')) {
      return Promise.resolve([{ id: 2, name: 'Computer Architecture', archived: false }]);
    }
    if (path.startsWith('/api/entries')) {
      return Promise.resolve({ entries: ENTRIES, total: ENTRIES.length, page: 1, limit: 100 });
    }
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Desktop and mobile toolbars each show the range as a heading.
function rangeHeading(name: string) {
  return screen.getAllByRole('heading', { name })[0];
}

function calls(prefix: string) {
  return getMock.mock.calls.map(([path]) => path as string).filter((p) => p.startsWith(prefix));
}

describe('CalendarPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    localStorage.clear();
    // Saturday 12 September 2026, as in the Figma frames.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 12, 10, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows events colour-coded by calendar, with a legend entry per calendar', async () => {
    mockApi();
    renderPage();

    const lecture = await screen.findByRole('button', { name: /CS Theory Lecture/ });
    expect(lecture).toHaveStyle({ borderLeftColor: '#d4a843' });
    expect(screen.getByRole('button', { name: /Pipelining lab/ })).toHaveStyle({
      borderLeftColor: '#44a054',
    });

    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(within(legend).getByText('Lectures')).toBeInTheDocument();
    expect(within(legend).getByText('Tutorials')).toBeInTheDocument();
    expect(within(legend).getByText('Logged entries')).toBeInTheDocument();
  });

  it('asks for exactly the visible month', async () => {
    mockApi();
    renderPage();
    await screen.findByRole('button', { name: /CS Theory Lecture/ });

    const url = new URL(calls('/api/calendar/events')[0], 'http://test');
    expect(new Date(url.searchParams.get('from')!).getTime()).toBe(new Date(2026, 7, 31).getTime());
    expect(new Date(url.searchParams.get('to')!).getTime()).toBe(new Date(2026, 9, 5).getTime());
    expect(calls('/api/entries')[0]).toContain('dateFrom=2026-08-31');
  });

  it('links a logged entry to its page, and hides entries when toggled off', async () => {
    mockApi();
    renderPage();

    const entry = await screen.findByRole('link', { name: /Register interference graph/ });
    expect(entry).toHaveAttribute('href', '/entries/42');

    await userEvent.click(screen.getByRole('switch', { name: 'Show entries' }));

    expect(screen.queryByRole('link', { name: /Register interference graph/ })).toBeNull();
    expect(localStorage.getItem('calendar.showEntries')).toBe('false');
  });

  it('offers a Log entry action for an event, prefilled from it', async () => {
    mockApi();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /CS Theory Lecture/ }));

    const popover = await screen.findByRole('dialog');
    const log = within(popover).getByRole('link', { name: 'Log entry' });
    expect(log.getAttribute('href')).toBe('/entries/new?title=CS+Theory+Lecture&date=2026-09-14');
  });

  it('moves between months and into week view', async () => {
    mockApi();
    renderPage();
    expect(
      (await screen.findAllByRole('heading', { name: 'September 2026' }))[0],
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(rangeHeading('October 2026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    // Desktop and mobile each have a view switch; they share state.
    await userEvent.click(screen.getAllByRole('button', { name: 'Week' })[0]);

    expect(rangeHeading('September 7–13, 2026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(rangeHeading('September 14–20, 2026')).toBeInTheDocument();
  });

  it('points to Settings when Google Calendar is not connected', async () => {
    mockApi({ connected: false });
    renderPage();

    expect(await screen.findByText(/to see your events here/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    // Entries still show without a calendar.
    expect(screen.getByRole('link', { name: /Register interference graph/ })).toBeInTheDocument();
  });

  it('places events and entries on their hour in the week view', async () => {
    mockApi();
    renderPage();
    await screen.findAllByRole('heading', { name: 'September 2026' });

    await userEvent.click(screen.getAllByRole('button', { name: 'Week' })[0]);

    const hours = screen.getByTestId('week-hours');
    // Saturday is the sixth day column; each column has 24 hour rows.
    const saturday = hours.children[6];
    expect(
      within(saturday.children[14] as HTMLElement).getByText('Supervisor meeting'),
    ).toBeInTheDocument();
    expect(
      within(saturday.children[9] as HTMLElement).getByText('Literature review notes'),
    ).toBeInTheDocument();
  });

  it('lists the chosen day on mobile, with event details and logged entries', async () => {
    mockApi();
    renderPage();

    const panel = (await screen.findByRole('heading', { name: 'Saturday, 12 September' }))
      .parentElement!.parentElement!;
    expect(await within(panel).findByText('Thesis presentation & outline')).toBeInTheDocument();
    expect(within(panel).getByText('Logged Entry')).toBeInTheDocument();
    expect(within(panel).getByText('Computer Architecture')).toBeInTheDocument();
    expect(within(panel).getByText('LOGGED')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Thursday, 10 September/ }));
    expect(screen.getByRole('heading', { name: 'Thursday, 10 September' })).toBeInTheDocument();
  });

  it('jumps to a month picked from the mobile month label', async () => {
    mockApi();
    renderPage();
    await screen.findAllByRole('heading', { name: 'September 2026' });

    fireEvent.change(screen.getByLabelText('Choose month'), { target: { value: '2026-11' } });

    expect(rangeHeading('November 2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sunday, 1 November' })).toBeInTheDocument();
  });
});
