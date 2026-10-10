import { addDays, mondayOf } from '@/lib/project-workspace';
import type { CalendarEvent } from '@/lib/api';
import type { Entry } from '@/types';

// Days are `YYYY-MM-DD` strings throughout, as in project-workspace.ts, so
// grid arithmetic never trips over time zones or daylight saving.

export type CalendarView = 'month' | 'week';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Today in the viewer's own time zone. */
export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function clock(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function parts(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  return { year, month, date };
}

function firstOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

function lastOfMonth(day: string): string {
  const { year, month } = parts(day);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${day.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}

/**
 * The days on screen, in weeks of seven starting on Monday. A month view
 * pads out to whole weeks, so it spans four to six rows.
 */
export function visibleWeeks(anchor: string, view: CalendarView): string[][] {
  const start = view === 'week' ? mondayOf(anchor) : mondayOf(firstOfMonth(anchor));
  const end = view === 'week' ? addDays(start, 6) : addDays(mondayOf(lastOfMonth(anchor)), 6);

  const weeks: string[][] = [];
  for (let monday = start; monday <= end; monday = addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
  }
  return weeks;
}

/** Moves the anchor one page: a calendar month, or seven days. */
export function shiftAnchor(anchor: string, view: CalendarView, direction: 1 | -1): string {
  if (view === 'week') return addDays(anchor, 7 * direction);
  const { year, month } = parts(anchor);
  const moved = new Date(Date.UTC(year, month - 1 + direction, 1));
  return moved.toISOString().slice(0, 10);
}

export function isSameMonth(day: string, anchor: string): boolean {
  return day.slice(0, 7) === anchor.slice(0, 7);
}

/** `September 2026`, or `September 7–13, 2026` for a week. */
export function rangeLabel(anchor: string, view: CalendarView): string {
  if (view === 'month') {
    const { year, month } = parts(anchor);
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }

  const [first] = visibleWeeks(anchor, 'week');
  const start = parts(first[0]);
  const end = parts(first[6]);
  if (start.month === end.month) {
    return `${MONTH_NAMES[start.month - 1]} ${start.date}–${end.date}, ${end.year}`;
  }
  const short = (p: typeof start) => `${MONTH_NAMES[p.month - 1].slice(0, 3)} ${p.date}`;
  return `${short(start)} – ${short(end)}, ${end.year}`;
}

/** `Saturday, 12 September` for the mobile day panel. */
export function longDayLabel(day: string): string {
  const { year, month, date } = parts(day);
  const weekday = new Date(Date.UTC(year, month - 1, date)).toLocaleDateString('en-GB', {
    weekday: 'long',
    timeZone: 'UTC',
  });
  return `${weekday}, ${date} ${MONTH_NAMES[month - 1]}`;
}

/**
 * The window to ask the API for: local midnight at the start of the first
 * visible day to local midnight after the last, as ISO instants.
 */
export function fetchWindow(days: string[]): { from: string; to: string } {
  const local = (day: string) => {
    const { year, month, date } = parts(day);
    return new Date(year, month - 1, date);
  };
  return {
    from: local(days[0]).toISOString(),
    to: local(addDays(days[days.length - 1], 1)).toISOString(),
  };
}

export type GridEvent = {
  kind: 'event';
  key: string;
  day: string;
  /** `14:00`, or null for an all-day event. */
  time: string | null;
  /** The hour row it sits in on the week view; null for all-day. */
  hour: number | null;
  title: string;
  description: string | null;
  calendar: string;
  color: string;
  start: string | null;
};

export type GridEntry = {
  kind: 'entry';
  key: string;
  day: string;
  id: number;
  title: string;
  projectId: number;
  /** When it was logged, `16:35`; the week view places it by this. */
  time: string;
  hour: number;
};

export type GridItem = GridEvent | GridEntry;

// Google's own default when a calendar has no colour of its own.
const FALLBACK_COLOR = '#808080';

export function toGridEvent(event: CalendarEvent, index: number): GridEvent | null {
  const dateTime = event.start?.dateTime;
  const allDay = event.start?.date;
  if (!dateTime && !allDay) return null;

  // A timed event belongs to the day it starts on where the viewer is; an
  // all-day event is already a plain day.
  const start = dateTime ? new Date(dateTime) : null;
  const day = start
    ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
    : allDay!;

  return {
    kind: 'event',
    key: `event-${event.calendarId ?? ''}-${event.id ?? index}`,
    day,
    time: start ? clock(start) : null,
    hour: start ? start.getHours() : null,
    title: event.summary?.trim() || 'Untitled event',
    description: event.description?.trim() || null,
    calendar: event.calendarSummary ?? 'Calendar',
    color: event.color ?? FALLBACK_COLOR,
    start: dateTime ?? allDay ?? null,
  };
}

export function toGridEntry(entry: Entry): GridEntry {
  const fromContent = Object.values(entry.content).find(
    (value) => typeof value === 'string' && value.trim() !== '',
  );
  const logged = new Date(entry.createdAt);
  return {
    kind: 'entry',
    key: `entry-${entry.id}`,
    time: clock(logged),
    hour: logged.getHours(),
    // Entry dates are stored as midnight UTC, so the first ten characters
    // are the day itself.
    day: entry.date.slice(0, 10),
    id: entry.id,
    title: entry.title?.trim() || (fromContent as string | undefined) || 'Untitled entry',
    projectId: entry.projectId,
  };
}

/**
 * Items grouped by day. Within a day, timed events come first in time order,
 * then all-day events, then logged entries.
 */
export function groupByDay(items: GridItem[]): Map<string, GridItem[]> {
  const rank = (item: GridItem) => (item.kind === 'entry' ? 2 : item.time === null ? 1 : 0);
  const sorted = [...items].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return (a.time ?? '').localeCompare(b.time ?? '');
  });

  const byDay = new Map<string, GridItem[]>();
  for (const item of sorted) {
    const bucket = byDay.get(item.day);
    if (bucket) bucket.push(item);
    else byDay.set(item.day, [item]);
  }
  return byDay;
}

/** One legend row per calendar seen, in the order they first appear. */
export function legendCalendars(events: GridEvent[]): { name: string; color: string }[] {
  const seen = new Map<string, string>();
  for (const event of events) {
    if (!seen.has(event.calendar)) seen.set(event.calendar, event.color);
  }
  return Array.from(seen, ([name, color]) => ({ name, color }));
}

/** Dark or light text, whichever reads on a solid pill of `hex`. */
export function textOn(hex: string): 'dark' | 'light' {
  const value = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return 'light';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  // Perceived brightness; gold (#d4a843) lands above the line, blue below.
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? 'dark' : 'light';
}
