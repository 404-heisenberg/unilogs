import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entry, FieldDefinition } from '@/types';
import {
  addDays,
  dayLabel,
  entryDurationHours,
  entryTitle,
  formatDurationHours,
  loadProjectEntries,
  mapFieldInsights,
  mondayOf,
  parseTab,
  relativeDay,
  renameEntryKeys,
  sortEntries,
  weeklyActivity,
  withoutItem,
  type BackendFieldInsight,
} from './project-workspace';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: apiGet } };
});

const TODAY = '2026-09-20';

function field(id: number, name: string, fieldType: string): FieldDefinition {
  return { id, projectId: 1, name, fieldType };
}

function entry(id: number, day: string, content: Record<string, unknown>): Entry {
  return {
    id,
    projectId: 1,
    date: `${day}T00:00:00.000Z`,
    createdAt: `${day}T08:00:00.000Z`,
    content,
  };
}

const NO_TREND = { deltaPct: null, direction: null } as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('formatting helpers', () => {
  it('formats hours as hours and minutes', () => {
    expect(formatDurationHours(2.5)).toBe('2h 30m');
    expect(formatDurationHours(64)).toBe('64h');
    expect(formatDurationHours(0.25)).toBe('15m');
    expect(formatDurationHours(4.25)).toBe('4h 15m');
  });

  it('labels days relative to today and otherwise month first', () => {
    expect(dayLabel('2026-09-20', TODAY)).toBe('Today');
    expect(dayLabel('2026-09-19', TODAY)).toBe('Yesterday');
    expect(dayLabel('2026-09-10', TODAY)).toBe('Sep 10');
    expect(relativeDay(0)).toBe('today');
    expect(relativeDay(1)).toBe('tomorrow');
    expect(relativeDay(3)).toBe('in 3 days');
    expect(relativeDay(-4)).toBe('4 days ago');
  });

  it('falls back to the first text value when an entry has no title', () => {
    expect(entryTitle({ ...entry(1, TODAY, { Notes: ' Read ch 3 ' }), title: 'Titled' })).toBe(
      'Titled',
    );
    expect(entryTitle(entry(1, TODAY, { Notes: ' Read ch 3 ' }))).toBe('Read ch 3');
    expect(entryTitle(entry(1, TODAY, { Reps: 12 }))).toBe('Untitled entry');
  });

  it('sorts entries newest first', () => {
    const sorted = sortEntries([entry(1, '2026-09-01', {}), entry(2, '2026-09-05', {})]);
    expect(sorted.map((item) => item.id)).toEqual([2, 1]);
  });

  it('reads a tab from the URL and defaults to overview', () => {
    expect(parseTab('fields')).toBe('fields');
    expect(parseTab('nope')).toBe('overview');
    expect(parseTab(null)).toBe('overview');
  });
});

describe('entryDurationHours', () => {
  const fields = [
    field(1, 'Time', 'duration'),
    field(2, 'Reading', 'duration'),
    field(3, 'N', 'number'),
  ];

  it('sums every duration field and ignores other types', () => {
    expect(entryDurationHours(entry(1, TODAY, { Time: 1.5, Reading: 0.5, N: 9 }), fields)).toBe(2);
  });

  it('returns null when the entry has no duration value', () => {
    expect(entryDurationHours(entry(1, TODAY, { N: 9 }), fields)).toBeNull();
    expect(entryDurationHours(entry(1, TODAY, { Time: 'abc' }), fields)).toBeNull();
  });
});

describe('mapFieldInsights', () => {
  const fields = [
    field(1, 'Time spent', 'duration'),
    field(2, 'Pages', 'number'),
    field(3, 'Mood', 'text'),
    field(4, 'Reviewed', 'boolean'),
    field(5, 'Next', 'date'),
    field(6, 'Empty', 'text'),
  ];

  function insightFor(name: string, backend: BackendFieldInsight[]) {
    const result = mapFieldInsights(fields, backend, TODAY).find((i) => i.name === name);
    if (!result) throw new Error(`no insight for ${name}`);
    return result;
  }

  it('converts duration minutes to hours and shows the entry count', () => {
    const backend: BackendFieldInsight[] = [
      {
        name: 'Time spent',
        fieldType: 'duration',
        family: 'sum',
        valueMinutes: 180,
        sampleCount: 2,
        trend: NO_TREND,
      },
    ];
    expect(insightFor('Time spent', backend)).toMatchObject({
      value: '3h',
      sub: '2 entries',
      trend: null,
    });
  });

  it('shows the total with the per-entry average for a plain number field', () => {
    const backend: BackendFieldInsight[] = [
      {
        name: 'Pages',
        fieldType: 'number',
        family: 'number',
        value: { average: 30, total: 90 },
        sampleCount: 3,
        trend: NO_TREND,
      },
    ];
    expect(insightFor('Pages', backend)).toMatchObject({ value: '90', sub: 'avg 30 per entry' });
  });

  it('shows the aggregated value with the entry count when an override is set', () => {
    const backend: BackendFieldInsight[] = [
      {
        name: 'Pages',
        fieldType: 'number',
        family: 'average',
        value: 30,
        sampleCount: 3,
        trend: NO_TREND,
      },
    ];
    expect(insightFor('Pages', backend)).toMatchObject({ value: '30', sub: '3 entries' });
  });

  it('shows a percentage and pass count for boolean fields', () => {
    const backend: BackendFieldInsight[] = [
      {
        name: 'Reviewed',
        fieldType: 'boolean',
        family: 'percentage',
        value: { pctTrue: 50 },
        sampleCount: 2,
        trend: NO_TREND,
      },
    ];
    expect(insightFor('Reviewed', backend)).toMatchObject({ value: '50%', sub: '1 of 2 entries' });
  });

  it('formats the most recent date and its relative distance from today', () => {
    const backend: BackendFieldInsight[] = [
      {
        name: 'Next',
        fieldType: 'date',
        family: 'recency',
        value: { mostRecent: '2026-09-25T00:00:00.000Z' },
        sampleCount: 1,
        trend: NO_TREND,
      },
    ];
    expect(insightFor('Next', backend)).toMatchObject({
      value: '25 Sep',
      sub: 'in 5 days',
      trend: null,
    });
  });

  it('shows the top text value, prefixed with Mostly when it repeats', () => {
    const repeated: BackendFieldInsight[] = [
      {
        name: 'Mood',
        fieldType: 'text',
        family: 'frequency',
        value: {
          top: [
            { value: 'calm', count: 2 },
            { value: 'tired', count: 1 },
          ],
        },
        sampleCount: 3,
        trend: NO_TREND,
      },
    ];
    expect(insightFor('Mood', repeated)).toMatchObject({ value: 'Mostly calm', sub: '3 entries' });

    const unique: BackendFieldInsight[] = [
      {
        name: 'Mood',
        fieldType: 'text',
        family: 'frequency',
        value: { top: [{ value: 'calm', count: 1 }] },
        sampleCount: 1,
        trend: NO_TREND,
      },
    ];
    expect(insightFor('Mood', unique).value).toBe('calm');
  });

  it('maps up and down trend directions and drops flat or missing ones', () => {
    const up: BackendFieldInsight[] = [
      {
        name: 'Pages',
        fieldType: 'number',
        family: 'sum',
        value: 10,
        sampleCount: 1,
        trend: { deltaPct: 10, direction: 'up' },
      },
    ];
    const down: BackendFieldInsight[] = [
      {
        name: 'Pages',
        fieldType: 'number',
        family: 'sum',
        value: 10,
        sampleCount: 1,
        trend: { deltaPct: -10, direction: 'down' },
      },
    ];
    const flat: BackendFieldInsight[] = [
      {
        name: 'Pages',
        fieldType: 'number',
        family: 'sum',
        value: 10,
        sampleCount: 1,
        trend: { deltaPct: 0, direction: 'flat' },
      },
    ];
    expect(insightFor('Pages', up).trend).toBe('up');
    expect(insightFor('Pages', down).trend).toBe('down');
    expect(insightFor('Pages', flat).trend).toBeNull();
  });

  it('shows no value for a field with no data, and for a field the backend has no entry for', () => {
    const backend: BackendFieldInsight[] = [
      {
        name: 'Empty',
        fieldType: 'text',
        family: 'frequency',
        hasData: false,
        sampleCount: 0,
        trend: NO_TREND,
      },
    ];
    expect(mapFieldInsights(fields, backend, TODAY).find((i) => i.name === 'Empty')).toMatchObject({
      value: null,
      trend: null,
    });
    expect(mapFieldInsights(fields, [], TODAY).find((i) => i.name === 'Mood')).toMatchObject({
      value: null,
      trend: null,
    });
  });
});

describe('weeklyActivity', () => {
  it('counts entries per Monday-started week for the last 8 weeks', () => {
    const bars = weeklyActivity(
      [
        entry(1, '2026-09-20', {}),
        entry(2, '2026-09-14', {}),
        entry(3, '2026-09-10', {}),
        entry(4, '2026-01-01', {}),
      ],
      TODAY,
    );
    expect(bars).toHaveLength(8);
    expect(bars[7]).toEqual({ weekStart: '2026-09-14', count: 2 });
    expect(bars[6]).toEqual({ weekStart: '2026-09-07', count: 1 });
    expect(bars[0].weekStart).toBe(addDays(mondayOf(TODAY), -49));
    expect(bars.reduce((sum, bar) => sum + bar.count, 0)).toBe(3);
  });
});

describe('renameEntryKeys', () => {
  it('renames the key in entries that carry it and leaves the others alone', () => {
    const entries = [entry(1, TODAY, { Mood: 'calm', Pages: 4 }), entry(2, TODAY, { Pages: 2 })];
    const renamed = renameEntryKeys(entries, 'Mood', 'Feeling');
    expect(renamed[0].content).toEqual({ Feeling: 'calm', Pages: 4 });
    expect(Object.keys(renamed[0].content)).toEqual(['Feeling', 'Pages']);
    expect(renamed[1]).toBe(entries[1]);
    expect(entries[0].content).toEqual({ Mood: 'calm', Pages: 4 });
  });
});

describe('withoutItem', () => {
  it('removes one open item from whichever group holds it', () => {
    const item = { entryId: 1, fieldName: 'Done', label: 'A', projectName: 'P', dueDate: null };
    const other = { ...item, entryId: 2 };
    const stats = { overdue: [item], dueThisWeek: [other], noDueDate: [] };
    expect(withoutItem(stats, item)).toEqual({ overdue: [], dueThisWeek: [other], noDueDate: [] });
  });
});

describe('loadProjectEntries', () => {
  it('asks for one project and reads every page', async () => {
    const page = (ids: number[], total: number) => ({
      entries: ids.map((id) => entry(id, TODAY, {})),
      total,
      page: 1,
      limit: 100,
    });
    apiGet.mockImplementation(async (path: string) => {
      if (path.endsWith('page=1')) return page([1, 2], 250);
      if (path.endsWith('page=2')) return page([3, 4], 250);
      if (path.endsWith('page=3')) return page([5], 250);
      throw new Error(`unexpected ${path}`);
    });

    const entries = await loadProjectEntries('7');

    expect(entries.map((item) => item.id)).toEqual([1, 2, 3, 4, 5]);
    expect(apiGet).toHaveBeenCalledTimes(3);
    expect(apiGet).toHaveBeenCalledWith('/api/entries?projectId=7&limit=100&page=1');
  });

  it('makes a single request when everything fits on one page', async () => {
    apiGet.mockResolvedValue({ entries: [], total: 0, page: 1, limit: 100 });

    await expect(loadProjectEntries('7')).resolves.toEqual([]);
    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});
