import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entry, FieldDefinition } from '@/types';
import type { StatsSummary } from '@/lib/api';
import {
  buildDurations,
  entryDateLabel,
  entryDurationHours,
  entryTitle,
  findDormantProjects,
  formatDayLabel,
  formatDurationHours,
  formatEventTime,
  formatEventWhen,
  formatLongDate,
  formatShortDate,
  loadActivity,
  loadUpcoming,
  logEventPath,
  relativeTime,
  summariseActivity,
  withoutItem,
  type UnfinishedItem,
  type UpcomingEvent,
} from './dashboard';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: getMock } };
});

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    projectId: 1,
    date: '2026-09-28T00:00:00.000Z',
    createdAt: '2026-09-28T09:30:00.000Z',
    title: null,
    content: {},
    ...overrides,
  };
}

function event(overrides: Partial<UpcomingEvent> = {}): UpcomingEvent {
  return {
    id: 'evt',
    title: 'Supervisor meeting',
    start: null,
    end: null,
    description: null,
    projectId: null,
    ...overrides,
  };
}

const FIELDS: FieldDefinition[] = [
  { id: 1, projectId: 1, name: 'Hours', fieldType: 'duration' },
  { id: 2, projectId: 1, name: 'Travel', fieldType: 'duration' },
  { id: 3, projectId: 1, name: 'Notes', fieldType: 'text' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('date formatting', () => {
  it('formats days in short, labelled and long forms', () => {
    expect(formatShortDate('2026-09-28')).toBe('28 Sep');
    expect(formatDayLabel('2026-09-28')).toBe('Mon 28 Sep');
    expect(formatLongDate('2026-09-28')).toBe('Monday, 28 September');
  });

  it('describes how long ago something happened', () => {
    const now = new Date('2026-09-28T12:00:00.000Z').getTime();
    expect(relativeTime('2026-09-28T12:00:20.000Z', now)).toBe('just now');
    expect(relativeTime('2026-09-28T11:45:00.000Z', now)).toBe('15m ago');
    expect(relativeTime('2026-09-28T09:00:00.000Z', now)).toBe('3h ago');
    expect(relativeTime('2026-09-25T12:00:00.000Z', now)).toBe('3d ago');
  });
});

describe('entryTitle and entryDateLabel', () => {
  it('uses the title, then the first text value, then a placeholder', () => {
    expect(entryTitle(entry({ title: '  Chapter 2  ' }))).toBe('Chapter 2');
    expect(entryTitle(entry({ content: { Hours: 2, Notes: ' Read papers ' } }))).toBe(
      'Read papers',
    );
    expect(entryTitle(entry({ content: { Notes: '   ' } }))).toBe('Untitled entry');
  });

  it('labels today with a time, then yesterday, then the date', () => {
    expect(entryDateLabel(entry(), '2026-09-28')).toMatch(/^Today \d{1,2}:\d{2} [AP]M$/);
    expect(entryDateLabel(entry({ date: '2026-09-27' }), '2026-09-28')).toBe('Yesterday');
    expect(entryDateLabel(entry({ date: '2026-09-20' }), '2026-09-28')).toBe('Sep 20');
  });
});

describe('summariseActivity', () => {
  it('counts entries per day and tracks the latest day per project', () => {
    const result = summariseActivity([
      entry({ id: 1, projectId: 1, date: '2026-09-27T00:00:00Z' }),
      entry({ id: 2, projectId: 1, date: '2026-09-28T00:00:00Z' }),
      entry({ id: 3, projectId: 2, date: '2026-09-28T00:00:00Z' }),
      entry({ id: 4, projectId: 1, date: '2026-09-26T00:00:00Z' }),
    ]);
    expect(result.daily).toEqual([
      { date: '2026-09-27', count: 1 },
      { date: '2026-09-28', count: 2 },
      { date: '2026-09-26', count: 1 },
    ]);
    expect(result.lastLogged).toEqual({ 1: '2026-09-28', 2: '2026-09-28' });
  });
});

describe('durations', () => {
  it('sums duration fields and ignores other types and non-numbers', () => {
    expect(entryDurationHours(entry({ content: { Hours: 1.5, Travel: 0.5 } }), FIELDS)).toBe(2);
    expect(entryDurationHours(entry({ content: { Hours: 'x', Notes: 'hi' } }), FIELDS)).toBeNull();
  });

  it('formats hours as hours and minutes', () => {
    expect(formatDurationHours(0.25)).toBe('15m');
    expect(formatDurationHours(2)).toBe('2h');
    expect(formatDurationHours(1.75)).toBe('1h 45m');
  });

  it('only computes durations for projects whose fields have loaded', () => {
    const durations = buildDurations(
      [
        entry({ id: 1, projectId: 1, content: { Hours: 2 } }),
        entry({ id: 2, projectId: 2, content: { Hours: 3 } }),
      ],
      [1, 2],
      [FIELDS, undefined],
    );
    expect(durations).toEqual({ 1: 2 });
  });
});

describe('calendar events', () => {
  it('formats an event start time or all-day date', () => {
    expect(formatEventTime(null)).toBe('');
    expect(formatEventTime('2026-09-30')).toBe('30 Sep');
    expect(formatEventTime('2026-09-30T09:00:00.000Z')).toMatch(/\d{2}:\d{2}/);
  });

  it('describes when an event happens relative to today', () => {
    const today = '2026-09-28';
    expect(formatEventWhen(event(), today)).toBe('');
    expect(formatEventWhen(event({ start: '2026-09-28' }), today)).toBe('Today · All day');
    expect(formatEventWhen(event({ start: '2026-09-29T09:00:00.000Z' }), today)).toMatch(
      /^Tomorrow · \d{1,2}:\d{2} [AP]M$/,
    );
    expect(
      formatEventWhen(
        event({ start: '2026-10-02T09:00:00.000Z', end: '2026-10-02T10:00:00.000Z' }),
        today,
      ),
    ).toMatch(/^2 Oct · \d{1,2}:\d{2} [AP]M – \d{1,2}:\d{2} [AP]M$/);
  });

  it('builds the log-entry link with only the values the event has', () => {
    expect(logEventPath(event())).toBe('/entries/new?title=Supervisor+meeting');
    expect(logEventPath(event({ start: '2026-09-30T09:00:00Z', projectId: 7 }))).toBe(
      '/entries/new?title=Supervisor+meeting&date=2026-09-30&projectId=7',
    );
  });
});

describe('loadUpcoming', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns nothing when the calendar is not connected', async () => {
    getMock.mockResolvedValue({ connected: false, suggestions: [] });
    await expect(loadUpcoming()).resolves.toEqual({ connected: false, events: [] });
  });

  it('keeps future and undated events, sorted, and at most five', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T12:00:00.000Z'));
    getMock.mockResolvedValue({
      connected: true,
      suggestions: [
        { id: 'past', title: 'Past', start: '2026-09-27T09:00:00.000Z' },
        { id: 'b', title: 'B', start: '2026-09-30T09:00:00.000Z', description: '  ' },
        { id: 'a', title: 'A', start: '2026-09-29T09:00:00.000Z', description: ' Notes ' },
        { id: 'none', title: 'Undated', projectId: 3 },
        { id: 'c', title: 'C', start: '2026-10-01T09:00:00.000Z' },
        { id: 'd', title: 'D', start: '2026-10-02T09:00:00.000Z' },
        { id: 'e', title: 'E', start: '2026-10-03T09:00:00.000Z' },
      ],
    });

    const result = await loadUpcoming();

    expect(result.connected).toBe(true);
    expect(result.events.map((e) => e.id)).toEqual(['none', 'a', 'b', 'c', 'd']);
    expect(result.events[0]).toEqual(
      expect.objectContaining({ start: null, end: null, projectId: 3 }),
    );
    expect(result.events[1].description).toBe('Notes');
    expect(result.events[2].description).toBeNull();
  });
});

describe('loadActivity', () => {
  it('fetches every page of entries in the heatmap range', async () => {
    getMock.mockImplementation((path: string) => {
      const page = Number(new URLSearchParams(path.split('?')[1]).get('page'));
      return Promise.resolve({
        total: 150,
        entries: [entry({ id: page, date: page === 1 ? '2026-09-27' : '2026-09-28' })],
      });
    });

    const result = await loadActivity('2026-09-28');

    expect(getMock).toHaveBeenCalledTimes(2);
    expect(result.daily).toEqual([
      { date: '2026-09-27', count: 1 },
      { date: '2026-09-28', count: 1 },
    ]);
  });
});

describe('withoutItem and findDormantProjects', () => {
  it('removes one unfinished field from every group', () => {
    const item = (entryId: number, fieldName: string): UnfinishedItem => ({
      entryId,
      fieldName,
      label: fieldName,
      projectName: 'Thesis',
      dueDate: null,
    });
    const stats = {
      overdue: [item(1, 'Draft'), item(1, 'Review')],
      dueThisWeek: [item(1, 'Draft')],
      noDueDate: [item(2, 'Draft')],
    };
    expect(withoutItem(stats, item(1, 'Draft'))).toEqual({
      overdue: [item(1, 'Review')],
      dueThisWeek: [],
      noDueDate: [item(2, 'Draft')],
    });
  });

  it('lists projects never logged or quiet past the threshold, oldest first', () => {
    const projects = [
      { projectId: 1, projectName: 'Active' },
      { projectId: 2, projectName: 'Quiet' },
      { projectId: 3, projectName: 'Never' },
      { projectId: 4, projectName: 'Quieter' },
    ] as StatsSummary['perProject'];
    const lastLogged = { 1: '2026-09-27', 2: '2026-09-14', 4: '2026-09-01' };

    expect(
      findDormantProjects(projects, lastLogged, '2026-09-28', 7).map((p) => p.projectName),
    ).toEqual(['Never', 'Quieter', 'Quiet']);
  });
});
