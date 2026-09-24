import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectDetailPage from './ProjectDetailPage';
import type { BackendFieldInsight } from '@/lib/project-workspace';
import type { Entry, FieldDefinition, Project } from '@/types';

configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20_000 });

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: mocks.apiGet,
      post: mocks.apiPost,
      put: mocks.apiPut,
      patch: mocks.apiPatch,
      delete: mocks.apiDelete,
    },
  };
});

vi.mock('@/hooks/useSession', () => ({ useSession: mocks.useSession }));

const PROJECT: Project = {
  id: 1,
  name: 'Thesis Research',
  description: 'PhD research and supervisor meetings',
  archived: false,
  userId: 'u1',
  reminderFrequency: 'WEEKLY',
};

const FIELDS: FieldDefinition[] = [
  { id: 1, projectId: 1, name: 'Time spent', fieldType: 'duration', aggregationOverride: null },
  { id: 2, projectId: 1, name: 'Pages read', fieldType: 'number', aggregationOverride: null },
  { id: 3, projectId: 1, name: 'Mood', fieldType: 'text', aggregationOverride: null },
  {
    id: 4,
    projectId: 1,
    name: 'Supervisor reviewed',
    fieldType: 'boolean',
    aggregationOverride: null,
  },
  { id: 5, projectId: 1, name: 'Next session', fieldType: 'date', aggregationOverride: null },
];

const NO_TREND = { deltaPct: null, direction: null } as const;

const FIELD_STATS: { projectId: number; fields: BackendFieldInsight[] } = {
  projectId: 1,
  fields: [
    {
      name: 'Time spent',
      fieldType: 'duration',
      family: 'sum',
      valueMinutes: 300,
      sampleCount: 2,
      trend: NO_TREND,
    },
    {
      name: 'Pages read',
      fieldType: 'number',
      family: 'number',
      value: { average: 30, total: 90 },
      sampleCount: 3,
      trend: NO_TREND,
    },
    {
      name: 'Mood',
      fieldType: 'text',
      family: 'frequency',
      value: {
        top: [
          { value: 'focused', count: 2 },
          { value: 'tired', count: 1 },
        ],
      },
      sampleCount: 3,
      trend: NO_TREND,
    },
    {
      name: 'Supervisor reviewed',
      fieldType: 'boolean',
      family: 'percentage',
      value: { pctTrue: 50 },
      sampleCount: 2,
      trend: NO_TREND,
    },
    {
      name: 'Next session',
      fieldType: 'date',
      family: 'recency',
      value: { mostRecent: '2026-09-22T00:00:00.000Z' },
      sampleCount: 1,
      trend: NO_TREND,
    },
  ],
};

function makeEntry(
  id: number,
  day: string,
  content: Record<string, unknown>,
  extra: Partial<Entry> = {},
): Entry {
  return {
    id,
    projectId: 1,
    title: `Entry ${id}`,
    date: `${day}T00:00:00.000Z`,
    createdAt: `${day}T09:30:00.000Z`,
    content,
    tags: [],
    ...extra,
  };
}

const ENTRIES: Entry[] = [
  makeEntry(
    1,
    '2026-09-20',
    {
      'Time spent': 2.5,
      'Pages read': 40,
      Mood: 'focused',
      'Supervisor reviewed': true,
      'Next session': '2026-09-22',
    },
    { title: 'Literature review notes', tags: [{ tag: { id: 1, name: 'reading' } }] },
  ),
  makeEntry(2, '2026-09-19', {
    'Time spent': 1.5,
    'Pages read': 20,
    Mood: 'focused',
    'Supervisor reviewed': false,
  }),
  makeEntry(
    3,
    '2026-09-10',
    { 'Time spent': 1, 'Pages read': 30, Mood: 'tired' },
    { title: 'Draft intro pipeline' },
  ),
];

const SUMMARY = {
  projectId: 1,
  name: 'Thesis Research',
  entryCount: 18,
  trackedTimeMinutes: 3840,
  lastLoggedAt: '2026-09-20T00:00:00.000Z',
  entriesThisWeek: 3,
};

const UNFINISHED_ALL = {
  overdue: [
    {
      entryId: 11,
      fieldName: 'Submitted',
      label: 'Submit ethics form',
      projectName: 'Thesis Research',
      dueDate: '2026-09-10',
    },
    {
      entryId: 21,
      fieldName: 'Filed',
      label: 'Register interference graph',
      projectName: 'Computer Architecture',
      dueDate: '2026-09-05',
    },
  ],
  dueThisWeek: [
    {
      entryId: 12,
      fieldName: 'Done',
      label: 'Draft intro pipeline',
      projectName: 'Thesis Research',
      dueDate: '2026-09-22',
    },
  ],
  noDueDate: [],
};

type Server = {
  project: Project | null;
  fields: FieldDefinition[];
  entries: Entry[] | null;
  summary: typeof SUMMARY | null;
  fieldStats: typeof FIELD_STATS | null;
  unfinished: typeof UNFINISHED_ALL | null;
};

const server: Server = {
  project: PROJECT,
  fields: FIELDS,
  entries: ENTRIES,
  summary: SUMMARY,
  fieldStats: FIELD_STATS,
  unfinished: UNFINISHED_ALL,
};

function resetServer() {
  server.project = structuredClone(PROJECT);
  server.fields = structuredClone(FIELDS);
  server.entries = structuredClone(ENTRIES);
  server.summary = structuredClone(SUMMARY);
  server.fieldStats = structuredClone(FIELD_STATS);
  server.unfinished = structuredClone(UNFINISHED_ALL);
}

function paged(entries: Entry[]) {
  return { entries, total: entries.length, page: 1, limit: 100 };
}

function renderPage(url = '/projects/1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openTab(name: 'Overview' | 'Entries' | 'Fields') {
  await userEvent.click(await screen.findByRole('tab', { name }));
}

function card(label: string): HTMLElement {
  const element = screen.getByText(label).closest('li, dl > div');
  if (!element) throw new Error(`no card for ${label}`);
  return element as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-20T12:00:00Z') });
  resetServer();
  mocks.useSession.mockReturnValue({ data: { user: { id: 'u1', name: 'Lee', email: 'l@x.io' } } });

  mocks.apiGet.mockImplementation(async (path: string) => {
    if (path === '/api/projects/1') {
      if (!server.project) throw new Error('project down');
      return structuredClone(server.project);
    }
    if (path === '/api/field-definitions?projectId=1') return structuredClone(server.fields);
    if (path.startsWith('/api/entries?projectId=1')) {
      if (!server.entries) throw new Error('entries down');
      return paged(structuredClone(server.entries));
    }
    if (path === '/api/projects/1/summary') {
      if (!server.summary) throw new Error('not found');
      return structuredClone(server.summary);
    }
    if (path === '/api/stats/fields/1') {
      if (!server.fieldStats) throw new Error('field stats down');
      return structuredClone(server.fieldStats);
    }
    if (path === '/api/stats/unfinished') {
      if (!server.unfinished) throw new Error('unfinished down');
      return structuredClone(server.unfinished);
    }
    if (path === '/api/entries/11') return makeEntry(11, '2026-09-01', { Submitted: false });
    throw new Error(`unexpected GET ${path}`);
  });

  mocks.apiPut.mockImplementation(async (path: string, body: unknown) => {
    if (path === '/api/entries/11' && server.unfinished) {
      server.unfinished.overdue = server.unfinished.overdue.filter((item) => item.entryId !== 11);
      return {};
    }
    const fieldMatch = path.match(/^\/api\/field-definitions\/(\d+)$/);
    const payload = body as {
      name?: string;
      fieldType?: string;
      aggregationOverride?: string | null;
    };
    if (fieldMatch) {
      const field = server.fields.find((f) => f.id === Number(fieldMatch[1]));
      if (!field) throw new Error('field not found');
      if (payload.name && server.entries) {
        const previous = field.name;
        field.name = payload.name;
        for (const entry of server.entries) {
          if (previous in entry.content) {
            entry.content[payload.name] = entry.content[previous];
            delete entry.content[previous];
          }
        }
      }
      if (payload.fieldType) field.fieldType = payload.fieldType;
      if (payload.aggregationOverride !== undefined) {
        field.aggregationOverride =
          payload.aggregationOverride as FieldDefinition['aggregationOverride'];
      }
      return structuredClone(field);
    }
    return {};
  });

  mocks.apiPatch.mockImplementation(async (_path: string, body: unknown) => {
    Object.assign(server.project as Project, body);
    return server.project;
  });

  mocks.apiPost.mockImplementation(async (path: string, body: unknown) => {
    if (path === '/api/projects/1/archive') (server.project as Project).archived = true;
    if (path === '/api/projects/1/unarchive') (server.project as Project).archived = false;
    return body ?? {};
  });

  mocks.apiDelete.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ProjectDetailPage workspace', () => {
  it('shows the project header, the three tabs and the metadata panel', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Thesis Research' })).toBeVisible();
    expect(screen.getAllByText('PhD research and supervisor meetings').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Entries',
      'Fields',
    ]);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: 'Log entry' })).toHaveAttribute('href', '/entries/new');
    const panel = screen.getByRole('complementary', { name: 'Project details' });
    expect(within(panel).getByText('Fields').nextSibling).toHaveTextContent('5');
  });

  it('shows an error when the project cannot be loaded', async () => {
    server.project = null;

    renderPage();

    expect(
      await screen.findByText("Couldn't load this project. Try refreshing the page."),
    ).toBeInTheDocument();
  });

  it('opens on the tab named in the URL', async () => {
    renderPage('/projects/1?tab=fields');

    expect(await screen.findByRole('tab', { name: 'Fields' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByLabelText('Field name')).toBeInTheDocument();
  });

  describe('Overview', () => {
    it('fills the summary cards from the project summary endpoint', async () => {
      renderPage();

      await screen.findByRole('heading', { level: 1, name: 'Thesis Research' });
      await waitFor(() => expect(card('Tracked')).toHaveTextContent('64h'));
      expect(card('Last logged')).toHaveTextContent('Today');
      expect(card('This week')).toHaveTextContent('3 entries');
      expect(mocks.apiGet).toHaveBeenCalledWith('/api/projects/1/summary');
    });

    it('shows dashes while the summary endpoint is unavailable', async () => {
      server.summary = null;

      renderPage();

      await screen.findByRole('heading', { level: 1, name: 'Thesis Research' });
      await waitFor(() => expect(card('Tracked')).toHaveTextContent('—'));
      expect(card('Last logged')).toHaveTextContent('—');
      expect(card('This week')).toHaveTextContent('—');
    });

    it('shows the server-computed insight for every field type', async () => {
      renderPage();

      await waitFor(() => expect(card('Time spent')).toHaveTextContent('5h'));
      expect(card('Time spent')).toHaveTextContent('2 entries');
      expect(card('Pages read')).toHaveTextContent('90');
      expect(card('Pages read')).toHaveTextContent('avg 30 per entry');
      expect(card('Mood')).toHaveTextContent('Mostly focused');
      expect(card('Supervisor reviewed')).toHaveTextContent('50%');
      expect(card('Supervisor reviewed')).toHaveTextContent('1 of 2 entries');
      expect(card('Next session')).toHaveTextContent('22 Sep');
      expect(card('Next session')).toHaveTextContent('in 2 days');
      expect(mocks.apiGet).toHaveBeenCalledWith('/api/stats/fields/1');
    });

    it('shows "No data yet" for a field the backend marks as having no data', async () => {
      server.fields = [
        ...server.fields,
        { id: 6, projectId: 1, name: 'Reading list', fieldType: 'text', aggregationOverride: null },
      ];
      server.fieldStats!.fields = [
        ...server.fieldStats!.fields,
        {
          name: 'Reading list',
          fieldType: 'text',
          family: 'frequency',
          hasData: false,
          sampleCount: 0,
          trend: NO_TREND,
        },
      ];

      renderPage();

      await waitFor(() => expect(card('Reading list')).toHaveTextContent('No data yet'));
    });

    it("says so when field insights can't be loaded", async () => {
      server.fieldStats = null;

      renderPage();

      expect(
        await screen.findByText('Failed to load field insights. Try refreshing the page.'),
      ).toBeInTheDocument();
    });

    it('lists open items for this project only, overdue first, and ticks one off in place', async () => {
      renderPage();

      const section = await screen.findByRole('region', { name: 'Still open' });
      expect(await within(section).findByText('2 open · 1 overdue')).toBeInTheDocument();
      const rows = within(section)
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('aria-label'));
      expect(rows).toEqual(['Mark Submit ethics form done', 'Mark Draft intro pipeline done']);
      expect(within(section).queryByText('Register interference graph')).not.toBeInTheDocument();
      expect(within(section).getByText('Overdue · due 10 Sep')).toBeInTheDocument();
      expect(within(section).getByText('Due this week · 22 Sep')).toBeInTheDocument();

      await userEvent.click(
        within(section).getByRole('checkbox', { name: 'Mark Submit ethics form done' }),
      );

      await waitFor(() =>
        expect(within(section).queryByText('Submit ethics form')).not.toBeInTheDocument(),
      );
      expect(mocks.apiPut).toHaveBeenCalledWith('/api/entries/11', {
        content: { Submitted: true },
      });
      expect(within(section).getByText('Draft intro pipeline')).toBeInTheDocument();
    });

    it("says so when the open items can't be loaded", async () => {
      server.unfinished = null;

      renderPage();

      expect(await screen.findByText("Couldn't load open items.")).toBeInTheDocument();
    });

    it('shows the last 8 weeks of activity and the most recent entries', async () => {
      renderPage();

      expect(await screen.findByLabelText('Week of 14 Sep: 2 entries')).toBeInTheDocument();
      expect(screen.getByLabelText('Week of 7 Sep: 1 entry')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem', { name: /^Week of/ })).toHaveLength(8);
      const recent = screen.getByRole('region', { name: 'Recent entries' });
      expect(within(recent).getByText('Literature review notes')).toBeInTheDocument();
      expect(within(recent).getByText('Today')).toBeInTheDocument();
      expect(within(recent).getByText('Sep 10')).toBeInTheDocument();
    });

    it('shows an error when the entries cannot be loaded', async () => {
      server.entries = null;

      renderPage();

      expect(
        await screen.findByText('Failed to load entries. Try refreshing the page.'),
      ).toBeInTheDocument();
    });
  });

  describe('Entries tab', () => {
    it('lists this project’s entries with tags, durations and dates', async () => {
      renderPage();
      await openTab('Entries');

      const row = (await screen.findByText('Literature review notes')).closest('a');
      expect(row).toHaveAttribute('href', '/entries/1');
      expect(within(row as HTMLElement).getByText('reading')).toBeInTheDocument();
      expect(within(row as HTMLElement).getByText('2h 30m · Today')).toBeInTheDocument();
      expect(screen.getByText('1h 30m · Yesterday')).toBeInTheDocument();
      expect(screen.getByText('1h · Sep 10')).toBeInTheDocument();
    });

    it('asks the API for this project only', async () => {
      renderPage();
      await openTab('Entries');
      await screen.findByText('Literature review notes');

      expect(mocks.apiGet).toHaveBeenCalledWith('/api/entries?projectId=1&limit=100&page=1');
    });

    it('shows the first few entries and reveals the rest on request', async () => {
      server.entries = Array.from({ length: 12 }, (_, index) =>
        makeEntry(index + 1, '2026-09-01', { 'Time spent': 1 }),
      );

      renderPage();
      await openTab('Entries');

      await screen.findByText('Entry 1');
      expect(screen.getAllByText(/^Entry \d+$/)).toHaveLength(8);

      await userEvent.click(screen.getByRole('button', { name: '4 more entries' }));

      expect(screen.getAllByText(/^Entry \d+$/)).toHaveLength(12);
      expect(screen.queryByRole('button', { name: /more entr/ })).not.toBeInTheDocument();
    });

    it('shows an empty state with a link to log the first entry', async () => {
      server.entries = [];

      renderPage();
      await openTab('Entries');

      expect(
        await screen.findByText('No entries logged for this project yet.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Log an entry' })).toHaveAttribute(
        'href',
        '/entries/new',
      );
    });

    it('shows an error state when entries fail to load', async () => {
      server.entries = null;

      renderPage('/projects/1?tab=entries');

      expect(
        await screen.findByText('Failed to load entries. Try refreshing the page.'),
      ).toBeInTheDocument();
    });
  });

  describe('Fields tab', () => {
    it('lists each field with its type label', async () => {
      renderPage();
      await openTab('Fields');

      const rowFor = async (name: string) =>
        (await screen.findByRole('button', { name: `Edit ${name}` })).closest('li') as HTMLElement;

      expect(within(await rowFor('Time spent')).getByText('Duration')).toBeInTheDocument();
      expect(within(await rowFor('Pages read')).getByText('Number')).toBeInTheDocument();
      expect(within(await rowFor('Mood')).getByText('Text')).toBeInTheDocument();
      expect(within(await rowFor('Supervisor reviewed')).getByText('Toggle')).toBeInTheDocument();
      expect(within(await rowFor('Next session')).getByText('Date')).toBeInTheDocument();
    });

    it('shows an empty state when the project has no fields', async () => {
      server.fields = [];

      renderPage('/projects/1?tab=fields');

      expect(
        await screen.findByText(
          'No fields yet. Add your first field below to define what an entry for this project looks like.',
        ),
      ).toBeInTheDocument();
    });

    it('adds a field', async () => {
      mocks.apiPost.mockResolvedValue({
        id: 9,
        projectId: 1,
        name: 'Hours',
        fieldType: 'text',
        aggregationOverride: null,
      });

      renderPage('/projects/1?tab=fields');
      await userEvent.type(await screen.findByPlaceholderText('e.g. Time spent'), 'Hours');
      await userEvent.click(screen.getByRole('button', { name: 'Add field' }));

      expect(mocks.apiPost).toHaveBeenCalledWith('/api/field-definitions', {
        projectId: 1,
        name: 'Hours',
        fieldType: 'text',
      });
    });

    it('adds a duration field when Duration is chosen', async () => {
      mocks.apiPost.mockResolvedValue({
        id: 9,
        projectId: 1,
        name: 'Hours',
        fieldType: 'duration',
        aggregationOverride: null,
      });

      renderPage('/projects/1?tab=fields');
      await userEvent.type(await screen.findByPlaceholderText('e.g. Time spent'), 'Hours');
      await userEvent.selectOptions(screen.getByLabelText('Type'), 'duration');
      await userEvent.click(screen.getByRole('button', { name: 'Add field' }));

      expect(mocks.apiPost).toHaveBeenCalledWith('/api/field-definitions', {
        projectId: 1,
        name: 'Hours',
        fieldType: 'duration',
      });
    });

    it('deletes a field', async () => {
      renderPage('/projects/1?tab=fields');

      await userEvent.click(await screen.findByRole('button', { name: 'Delete Mood' }));

      expect(mocks.apiDelete).toHaveBeenCalledWith('/api/field-definitions/3');
    });

    it('changes a field’s type', async () => {
      renderPage('/projects/1?tab=fields');

      await userEvent.click(await screen.findByRole('button', { name: 'Edit Mood' }));
      await userEvent.selectOptions(screen.getByLabelText('Type for Mood'), 'number');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(mocks.apiPut).toHaveBeenCalledWith('/api/field-definitions/3', {
        fieldType: 'number',
      });
    });

    it('renames a field and the insight follows the renamed key once the backend refreshes it', async () => {
      renderPage('/projects/1?tab=fields');

      await userEvent.click(await screen.findByRole('button', { name: 'Edit Mood' }));
      const input = screen.getByLabelText('Name for Mood');
      await userEvent.clear(input);
      await userEvent.type(input, 'Feeling');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(mocks.apiPut).toHaveBeenCalledWith('/api/field-definitions/3', { name: 'Feeling' });
      expect(mocks.apiGet).toHaveBeenCalledWith('/api/stats/fields/1');
    });

    it('sends an aggregation override to the field-definitions endpoint', async () => {
      renderPage('/projects/1?tab=fields');

      await userEvent.selectOptions(
        await screen.findByLabelText('Aggregation for Pages read'),
        'average',
      );

      expect(mocks.apiPut).toHaveBeenCalledWith('/api/field-definitions/2', {
        aggregationOverride: 'average',
      });
      expect(screen.queryByLabelText('Aggregation for Mood')).not.toBeInTheDocument();
    });
  });

  describe('Metadata panel', () => {
    it('edits the name and description', async () => {
      renderPage();

      await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
      const name = screen.getByLabelText('Project name');
      await userEvent.clear(name);
      await userEvent.type(name, 'Thesis');
      const description = screen.getByLabelText('Description');
      await userEvent.clear(description);
      await userEvent.type(description, 'Final year');
      await userEvent.click(screen.getByRole('button', { name: 'Save details' }));

      expect(mocks.apiPatch).toHaveBeenCalledWith('/api/projects/1', {
        name: 'Thesis',
        description: 'Final year',
      });
      expect(await screen.findByRole('heading', { level: 1, name: 'Thesis' })).toBeVisible();
      expect(screen.queryByLabelText('Project name')).not.toBeInTheDocument();
    });

    it('archives and unarchives the project', async () => {
      renderPage();

      await userEvent.click(await screen.findByRole('button', { name: 'Archive project' }));
      expect(mocks.apiPost).toHaveBeenCalledWith('/api/projects/1/archive');

      await userEvent.click(await screen.findByRole('button', { name: 'Unarchive project' }));
      expect(mocks.apiPost).toHaveBeenCalledWith('/api/projects/1/unarchive');
    });
  });
});
