import { describe, expect, it } from 'vitest';
import {
  groupByDay,
  legendCalendars,
  rangeLabel,
  shiftAnchor,
  toGridEntry,
  toGridEvent,
  textOn,
  visibleWeeks,
  type GridEntry,
  type GridEvent,
  type GridItem,
} from './calendar';
import type { Entry } from '@/types';

function gridEvent(overrides: Partial<GridEvent>): GridEvent {
  return {
    kind: 'event',
    key: 'event',
    day: 'd',
    time: null,
    hour: null,
    title: 't',
    description: null,
    calendar: 'A',
    color: '#000000',
    start: null,
    ...overrides,
  };
}

function gridEntry(overrides: Partial<GridEntry>): GridEntry {
  return {
    kind: 'entry',
    key: 'entry',
    day: 'd',
    id: 1,
    title: 'Entry',
    projectId: 1,
    time: '10:00',
    hour: 10,
    ...overrides,
  };
}

describe('visibleWeeks', () => {
  it('pads a month out to whole Monday-first weeks', () => {
    // September 2026 starts on a Tuesday and ends on a Wednesday.
    const weeks = visibleWeeks('2026-09-12', 'month');

    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toBe('2026-08-31');
    expect(weeks[4][6]).toBe('2026-10-04');
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('gives a single Monday-to-Sunday row for a week', () => {
    expect(visibleWeeks('2026-09-12', 'week')).toEqual([
      [
        '2026-09-07',
        '2026-09-08',
        '2026-09-09',
        '2026-09-10',
        '2026-09-11',
        '2026-09-12',
        '2026-09-13',
      ],
    ]);
  });
});

describe('shiftAnchor', () => {
  it('moves by calendar month, landing on the 1st', () => {
    expect(shiftAnchor('2026-01-31', 'month', 1)).toBe('2026-02-01');
    expect(shiftAnchor('2026-01-15', 'month', -1)).toBe('2025-12-01');
  });

  it('moves a week by seven days', () => {
    expect(shiftAnchor('2026-09-12', 'week', 1)).toBe('2026-09-19');
  });
});

describe('rangeLabel', () => {
  it('names the month, or the week span', () => {
    expect(rangeLabel('2026-09-12', 'month')).toBe('September 2026');
    expect(rangeLabel('2026-09-12', 'week')).toBe('September 7–13, 2026');
    expect(rangeLabel('2026-10-01', 'week')).toBe('Sep 28 – Oct 4, 2026');
  });
});

describe('toGridEvent', () => {
  it('reads an all-day event as its own day, with no time', () => {
    const event = toGridEvent(
      { id: 'a', summary: 'Reading week', start: { date: '2026-09-14' }, color: '#d4a843' },
      0,
    );
    expect(event).toMatchObject({ day: '2026-09-14', time: null, color: '#d4a843' });
  });

  it('skips an event with no start', () => {
    expect(toGridEvent({ id: 'b', summary: 'Broken' }, 0)).toBeNull();
  });
});

describe('toGridEntry', () => {
  it('places an entry on its stored day and falls back to content for a title', () => {
    const entry = {
      id: 7,
      projectId: 1,
      date: '2026-09-10T00:00:00.000Z',
      createdAt: '2026-09-10T15:00:00.000Z',
      title: null,
      content: { Notes: 'Cache results' },
    } as Entry;

    const logged = new Date('2026-09-10T15:00:00.000Z');
    expect(toGridEntry(entry)).toMatchObject({
      day: '2026-09-10',
      title: 'Cache results',
      // Placed by when it was logged, in the viewer's time zone.
      hour: logged.getHours(),
    });
  });
});

describe('groupByDay', () => {
  it('orders timed events, then all-day events, then entries', () => {
    const items: GridItem[] = [
      gridEntry({ key: 'e' }),
      gridEvent({ key: 'late', time: '15:00', hour: 15 }),
      gridEvent({ key: 'all' }),
      gridEvent({ key: 'early', time: '09:00', hour: 9 }),
    ];

    expect(
      groupByDay(items)
        .get('d')!
        .map((item) => item.key),
    ).toEqual(['early', 'late', 'all', 'e']);
  });
});

describe('legendCalendars', () => {
  it('lists each calendar once, in first-seen order', () => {
    const event = (calendar: string, color: string) =>
      gridEvent({ key: calendar + color, calendar, color });

    expect(
      legendCalendars([
        event('Lectures', '#d4a843'),
        event('Tutorials', '#44a054'),
        event('Lectures', '#d4a843'),
      ]),
    ).toEqual([
      { name: 'Lectures', color: '#d4a843' },
      { name: 'Tutorials', color: '#44a054' },
    ]);
  });
});

describe('textOn', () => {
  it('puts dark text on gold and white text on blue or green', () => {
    expect(textOn('#d4a843')).toBe('dark');
    expect(textOn('#4178db')).toBe('light');
    expect(textOn('#44a054')).toBe('light');
  });
});
