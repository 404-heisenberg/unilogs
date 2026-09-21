import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { layoutKey } from '@/lib/dashboard';
import DashboardPage from './DashboardPage';

configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20_000 });

const mocks = vi.hoisted(() => ({
  getStatsSummary: vi.fn(),
  getFrequencyStats: vi.fn(),
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { get: mocks.apiGet, put: mocks.apiPut },
  getStatsSummary: mocks.getStatsSummary,
  getFrequencyStats: mocks.getFrequencyStats,
}));

vi.mock('@/hooks/useSession', () => ({ useSession: mocks.useSession }));

const SUMMARY = {
  perProject: [
    { projectId: 1, projectName: 'Thesis Research', totalHours: 75 },
    { projectId: 2, projectName: 'Computer Architecture', totalHours: 25 },
  ],
  totalHours: 100,
  streak: 6,
};

function makeEntry(
  id: number,
  projectId: number,
  day: string,
  content: Record<string, unknown> = {},
  projectName = 'Thesis Research',
) {
  return {
    id,
    projectId,
    title: 'Literature review notes',
    date: `${day}T00:00:00.000Z`,
    createdAt: `${day}T09:30:00.000Z`,
    content,
    project: { id: projectId, name: projectName, archived: false, userId: 'u1' },
  };
}

const ACTIVITY_ENTRIES = [
  ...[15, 16, 17, 18, 19, 20].map((day) => makeEntry(day, 1, `2026-09-${day}`)),
  makeEntry(30, 2, '2026-09-01'),
];

const RECENT = [
  makeEntry(7, 1, '2026-09-20', { 'Time spent': 2.5, 'Pages read': 40 }),
  makeEntry(8, 2, '2026-09-19', {}, 'Personal Diary'),
  makeEntry(9, 1, '2026-09-18', { 'Time spent': 0.25 }),
];

const FIELDS: Record<number, { id: number; projectId: number; name: string; fieldType: string }[]> =
  {
    1: [
      { id: 1, projectId: 1, name: 'Time spent', fieldType: 'duration' },
      { id: 2, projectId: 1, name: 'Pages read', fieldType: 'number' },
    ],
    2: [{ id: 3, projectId: 2, name: 'Notes', fieldType: 'text' }],
  };

const UNFINISHED = {
  overdue: [
    {
      entryId: 11,
      fieldName: 'Submitted',
      label: 'Submit ethics form',
      projectName: 'Thesis Research',
      dueDate: '2026-09-10',
    },
  ],
  dueThisWeek: [
    {
      entryId: 12,
      fieldName: 'Done',
      label: 'Draft intro pipeline',
      projectName: 'Thesis Research',
      dueDate: '2026-09-18',
    },
  ],
  noDueDate: [],
};

const server = { unfinished: structuredClone(UNFINISHED), fieldsFail: false };

function paged<T>(entries: T[], limit: number) {
  return { entries, total: entries.length, page: 1, limit };
}

function stubMedia(desktop: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('reduced-motion') ? true : desktop,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-20T12:00:00Z') });
  stubMedia(true);
  server.unfinished = structuredClone(UNFINISHED);
  server.fieldsFail = false;
  mocks.useSession.mockReturnValue({ data: { user: { id: 'u1', name: 'Lee', email: 'l@x.io' } } });
  mocks.getStatsSummary.mockResolvedValue(SUMMARY);
  mocks.getFrequencyStats.mockResolvedValue({
    weekly: [
      { weekStart: '2026-08-10', count: 2 },
      { weekStart: '2026-08-17', count: 6 },
    ],
    terms: [],
  });
  mocks.apiGet.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/entries?dateFrom')) return paged(ACTIVITY_ENTRIES, 100);
    if (path.startsWith('/api/entries?limit=5')) return paged(RECENT, 5);
    if (path.startsWith('/api/field-definitions')) {
      if (server.fieldsFail) throw new Error('fields down');
      return FIELDS[Number(path.split('projectId=')[1])] ?? [];
    }
    if (path === '/api/stats/unfinished') return structuredClone(server.unfinished);
    if (path === '/api/entries/11') return { ...RECENT[0], id: 11, content: { Submitted: false } };
    throw new Error(`unexpected GET ${path}`);
  });
  mocks.apiPut.mockImplementation(async () => {
    server.unfinished.overdue = [];
    return {};
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DashboardPage', () => {
  it('shows an empty state when there are no entries yet', async () => {
    mocks.getStatsSummary.mockResolvedValue({ perProject: [], totalHours: 0, streak: 0 });

    renderPage();

    expect(await screen.findByText('No entries yet')).toBeInTheDocument();
  });

  it("shows an error state when the stats can't be loaded", async () => {
    mocks.getStatsSummary.mockRejectedValue(new Error('network error'));

    renderPage();

    expect(await screen.findByText("Couldn't load your stats")).toBeInTheDocument();
  });

  it('renders the default widgets in order and leaves off-by-default widgets out', async () => {
    renderPage();

    expect(await screen.findByText('6-day streak')).toBeInTheDocument();
    expect(screen.getByText('Top project:', { exact: false })).toHaveTextContent(
      'Thesis Research (75%)',
    );
    expect(screen.getByText('Activity — last 12 weeks')).toBeInTheDocument();
    expect(await screen.findByText("What's left")).toBeInTheDocument();
    expect(await screen.findByText('Recent entries')).toBeInTheDocument();
    expect(await screen.findByText('No data yet')).toBeInTheDocument();

    expect(screen.queryByText('Time by project')).not.toBeInTheDocument();
    expect(screen.queryByText('Logging frequency — last 6 weeks')).not.toBeInTheDocument();
    expect(screen.queryByText('Due & dormant projects')).not.toBeInTheDocument();
    expect(screen.queryByText('Upcoming')).not.toBeInTheDocument();
    expect(mocks.getFrequencyStats).not.toHaveBeenCalled();
  });

  it('draws 12 weeks of days with the streak at the top level', async () => {
    renderPage();

    const cells = await screen.findAllByRole('img', { name: /: \d+ entr(y|ies)$/ });
    expect(cells).toHaveLength(84);

    const today = screen.getByRole('img', { name: 'Sun 20 Sep: 1 entry' });
    expect(today).toHaveClass('bg-[#D4A843]');
    expect(screen.getByRole('img', { name: 'Sat 19 Sep: 1 entry' })).toHaveClass('bg-[#D4A843]');
    expect(screen.getByRole('img', { name: 'Mon 14 Sep: 0 entries' })).toHaveClass('bg-[#E2DCD2]');

    expect(screen.getByText('6 of 7')).toBeInTheDocument();
  });

  it("shows each entry's duration from its project's duration fields", async () => {
    renderPage();

    expect(await screen.findByText(/· 2h 30m$/)).toBeInTheDocument();
    expect(screen.getByText(/· No duration$/)).toBeInTheDocument();
    expect(screen.getByText(/· 15m$/)).toBeInTheDocument();
  });

  it('shows only the date when the field lookup fails', async () => {
    server.fieldsFail = true;
    renderPage();

    expect(await screen.findByText('Yesterday')).toBeInTheDocument();
    expect(screen.queryByText(/No duration/)).not.toBeInTheDocument();
  });

  it('points the log and continue affordances at the new entry page', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'Log entry' })).toHaveAttribute(
      'href',
      '/entries/new',
    );
    expect(await screen.findByRole('link', { name: 'Continue' })).toHaveAttribute(
      'href',
      '/entries/new',
    );
  });

  it('groups open items and marks one done in place', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    expect(await screen.findByText('Submit ethics form')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Overdue', 'Due this week']);

    await user.click(screen.getByRole('checkbox', { name: 'Mark Submit ethics form done' }));

    await waitFor(() => expect(screen.queryByText('Submit ethics form')).not.toBeInTheDocument());
    expect(mocks.apiPut).toHaveBeenCalledWith('/api/entries/11', {
      content: { Submitted: true },
    });
    expect(screen.getByText('Draft intro pipeline')).toBeInTheDocument();
  });

  it('restores an item and shows a message when marking done fails', async () => {
    mocks.apiPut.mockRejectedValue(new Error('nope'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(await screen.findByRole('checkbox', { name: 'Mark Submit ethics form done' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't mark that done");
    expect(await screen.findByText('Submit ethics form')).toBeInTheDocument();
  });

  it('customises: hides, re-adds, turns on a tray widget and resets', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Customise' }));
    expect(screen.getByRole('heading', { name: 'Customise dashboard' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide Recent entries' }));
    expect(screen.queryByText('Literature review notes')).not.toBeInTheDocument();

    const tray = screen.getByRole('region', { name: 'Add widget' });
    expect(within(tray).getByRole('button', { name: 'Add Recent entries' })).toBeInTheDocument();

    await user.click(within(tray).getByRole('button', { name: 'Add Time by project' }));
    expect(await screen.findByText('75%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Make Insight wide' }));
    expect(screen.getByRole('button', { name: 'Make Insight standard width' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset to default' }));
    expect(screen.queryByText('75%')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide Recent entries' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('remembers the layout for the signed-in user', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const first = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Customise' }));
    await user.click(screen.getByRole('button', { name: 'Hide Insight' }));
    await waitFor(() => expect(localStorage.getItem(layoutKey('u1'))).not.toBeNull(), {
      timeout: 5000,
    });
    first.unmount();

    renderPage();
    expect(await screen.findByText("What's left")).toBeInTheDocument();
    expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
  });

  it('stacks in a single column with shorter labels on small screens', async () => {
    stubMedia(false);
    renderPage();

    expect(await screen.findByRole('link', { name: 'Log' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Continue Logging' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Customise' })).not.toBeInTheDocument();
  });
});
