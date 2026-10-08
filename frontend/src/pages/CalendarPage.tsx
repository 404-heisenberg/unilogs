import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { api, getCalendarEvents } from '@/lib/api';
import {
  WEEKDAYS,
  fetchWindow,
  groupByDay,
  isSameMonth,
  legendCalendars,
  localToday,
  longDayLabel,
  rangeLabel,
  shiftAnchor,
  toGridEntry,
  toGridEvent,
  visibleWeeks,
  type CalendarView,
  type GridEntry,
  type GridEvent,
  type GridItem,
} from '@/lib/calendar';
import { logEventPath } from '@/lib/dashboard';
import { addDays } from '@/lib/project-workspace';
import type { PagedEntries } from '@/types';

// How much a month cell shows before collapsing the rest into "+N more". An
// event pill (time + title) is about twice the height of an entry line, so
// it costs two: a cell fits one event or two entries, as in Figma.
const MONTH_CELL_BUDGET = 2;

function fitMonthCell(items: GridItem[]): GridItem[] {
  const shown: GridItem[] = [];
  let used = 0;
  for (const item of items) {
    const cost = item.kind === 'event' ? 2 : 1;
    if (used + cost > MONTH_CELL_BUDGET) break;
    shown.push(item);
    used += cost;
  }
  return shown;
}
// The entries list caps a page at 100; a month rarely comes close.
const ENTRY_LIMIT = 100;
const SHOW_ENTRIES_KEY = 'calendar.showEntries';

function readShowEntries(): boolean {
  try {
    return localStorage.getItem(SHOW_ENTRIES_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeShowEntries(value: boolean) {
  try {
    localStorage.setItem(SHOW_ENTRIES_KEY, String(value));
  } catch {
    // Private browsing can refuse storage; the toggle still works this visit.
  }
}

function eventLogPath(event: GridEvent): string {
  return logEventPath({
    id: event.key,
    title: event.title,
    start: event.start,
    end: null,
    description: null,
    projectId: null,
  });
}

function EventPopover({ event, children }: { event: GridEvent; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 bg-paper p-3 text-espresso">
        <div className="flex items-start gap-2">
          <span
            className="mt-1.5 size-2 shrink-0 rounded-full"
            style={{ backgroundColor: event.color }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{event.title}</p>
            <p className="text-xs text-clay">
              {event.time ?? 'All day'} · {event.calendar}
            </p>
          </div>
        </div>
        <Link
          to={eventLogPath(event)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gold px-3 text-[13px] font-bold text-espresso hover:opacity-90"
        >
          <Plus className="size-3.5" strokeWidth={2} aria-hidden />
          Log entry
        </Link>
      </PopoverContent>
    </Popover>
  );
}

function EventPill({ event }: { event: GridEvent }) {
  return (
    <EventPopover event={event}>
      <button
        type="button"
        className="flex w-full min-w-0 flex-col rounded border-l-3 bg-paper px-2 py-1 text-left hover:bg-sand"
        style={{ borderLeftColor: event.color }}
      >
        {event.time && <span className="text-[10px] font-bold text-espresso">{event.time}</span>}
        <span className="w-full truncate text-[11px] font-medium text-cocoa">{event.title}</span>
      </button>
    </EventPopover>
  );
}

function EntryPill({ entry }: { entry: GridEntry }) {
  return (
    <Link
      to={`/entries/${entry.id}`}
      className="flex w-full min-w-0 items-center gap-1 rounded px-1 py-0.5 hover:bg-sand"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-data-orange" aria-hidden />
      <span className="truncate text-[11px] text-clay">{entry.title}</span>
    </Link>
  );
}

function ItemPill({ item }: { item: GridItem }) {
  return item.kind === 'event' ? <EventPill event={item} /> : <EntryPill entry={item} />;
}

function DayCell({
  day,
  items,
  today,
  muted,
  view,
}: {
  day: string;
  items: GridItem[];
  today: boolean;
  muted: boolean;
  view: CalendarView;
}) {
  const shown = view === 'month' ? fitMonthCell(items) : items;
  const hidden = items.length - shown.length;

  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-lg p-2 ${
        view === 'month' ? 'h-28' : 'min-h-80'
      } ${
        today
          ? 'border-2 border-gold bg-gold/5'
          : muted
            ? 'border border-cream bg-canvas opacity-40'
            : 'border border-cream bg-white'
      }`}
    >
      <div className="flex items-start justify-between">
        <span className={`text-xs ${today ? 'font-bold text-gold' : 'font-medium text-espresso'}`}>
          {Number(day.slice(8))}
        </span>
        {today && (
          <span className="rounded-sm bg-gold px-1 text-[8px] font-bold text-espresso">TODAY</span>
        )}
      </div>
      <div className="flex min-h-0 flex-col gap-0.5">
        {shown.map((item) => (
          <ItemPill key={item.key} item={item} />
        ))}
      </div>
      {hidden > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="mt-auto self-start text-[11px] font-medium text-clay hover:underline"
            >
              +{hidden} more
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 gap-1 bg-paper p-2">
            <p className="px-1 text-xs font-bold text-espresso">{longDayLabel(day)}</p>
            {items.map((item) => (
              <ItemPill key={item.key} item={item} />
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function MobileDay({
  day,
  items,
  today,
  muted,
  selected,
  onSelect,
}: {
  day: string;
  items: GridItem[];
  today: boolean;
  muted: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  // Up to three dots: one per calendar colour, then entries.
  const dots = [
    ...new Set(items.map((item) => (item.kind === 'event' ? item.color : 'entry'))),
  ].slice(0, 3);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${longDayLabel(day)}${items.length ? `, ${items.length} items` : ''}`}
      className={`flex size-11 flex-col items-center justify-center gap-px justify-self-center rounded-full border text-xs ${
        today
          ? 'border-gold bg-gold font-bold text-espresso'
          : selected
            ? 'border-gold bg-white font-semibold text-espresso'
            : muted
              ? 'border-cream bg-cream/50 text-taupe opacity-40'
              : 'border-cream bg-white text-espresso'
      }`}
    >
      {Number(day.slice(8))}
      <span className="flex h-1 gap-0.5" aria-hidden>
        {dots.map((dot) => (
          <span
            key={dot}
            className={`size-1 rounded-full ${dot === 'entry' ? 'bg-data-orange' : ''}`}
            style={dot === 'entry' ? undefined : { backgroundColor: dot }}
          />
        ))}
      </span>
    </button>
  );
}

function MobileDayPanel({ day, items, today }: { day: string; items: GridItem[]; today: boolean }) {
  return (
    <section className="-mx-4 flex flex-col gap-3 border-t border-cream bg-canvas p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-espresso">
          <span className="size-2 rounded-full bg-gold" aria-hidden />
          {longDayLabel(day)}
        </h2>
        {today && <span className="text-xs font-semibold text-gold">TODAY</span>}
      </div>

      {items.length === 0 && <p className="text-sm text-clay">Nothing on this day.</p>}

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-3 rounded-lg border border-cream bg-white p-3"
          >
            <span
              className={`h-9 w-1 shrink-0 rounded-sm ${item.kind === 'entry' ? 'bg-data-orange' : ''}`}
              style={item.kind === 'event' ? { backgroundColor: item.color } : undefined}
              aria-hidden
            />
            {item.kind === 'event' ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-clay">{item.time ?? 'All day'}</p>
                  <p className="truncate text-sm font-bold text-espresso">{item.title}</p>
                  <p className="truncate text-xs text-clay">{item.calendar}</p>
                </div>
                <Link
                  to={eventLogPath(item)}
                  className="flex min-h-11 shrink-0 items-center rounded-lg px-2 text-xs font-bold text-clay hover:bg-sand"
                >
                  Log entry
                </Link>
              </>
            ) : (
              <Link to={`/entries/${item.id}`} className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-data-orange">Logged entry</p>
                <p className="truncate text-sm font-bold text-espresso">{item.title}</p>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CalendarPage() {
  const today = localToday();
  const [anchor, setAnchor] = useState(today);
  const [view, setView] = useState<CalendarView>('month');
  const [selectedDay, setSelectedDay] = useState(today);
  const [showEntries, setShowEntries] = useState(readShowEntries);

  const weeks = useMemo(() => visibleWeeks(anchor, view), [anchor, view]);
  const firstDay = weeks[0][0];
  const lastDay = weeks[weeks.length - 1][6];
  const range = useMemo(() => fetchWindow([firstDay, lastDay]), [firstDay, lastDay]);

  // One request per page of the calendar; revisiting a month is cached.
  const eventsQuery = useQuery({
    queryKey: ['calendar-events', range.from, range.to],
    queryFn: () => getCalendarEvents(range),
  });

  const entriesQuery = useQuery({
    queryKey: ['entries', { calendar: [firstDay, lastDay] }],
    queryFn: () =>
      api.get<PagedEntries>(
        `/api/entries?dateFrom=${firstDay}T00:00:00.000Z&dateTo=${lastDay}T23:59:59.999Z&limit=${ENTRY_LIMIT}`,
      ),
    enabled: showEntries,
  });

  const events = useMemo(() => {
    const data = eventsQuery.data;
    if (!data?.connected) return [];
    return data.events.map(toGridEvent).filter((event): event is GridEvent => event !== null);
  }, [eventsQuery.data]);

  const itemsByDay = useMemo(() => {
    const entries = showEntries ? (entriesQuery.data?.entries ?? []).map(toGridEntry) : [];
    return groupByDay([...events, ...entries]);
  }, [events, entriesQuery.data, showEntries]);

  const legend = legendCalendars(events);
  const notConnected = eventsQuery.data?.connected === false;

  const move = (direction: 1 | -1) => {
    const next = shiftAnchor(anchor, view, direction);
    setAnchor(next);
    // Keep the mobile day panel on a day that's on screen: today when the
    // new month holds it, otherwise the 1st; a week moves it along by 7.
    if (view === 'week') setSelectedDay(addDays(selectedDay, 7 * direction));
    else setSelectedDay(isSameMonth(today, next) ? today : next);
  };

  const changeView = (next: CalendarView) => {
    setView(next);
    setAnchor(selectedDay);
  };

  const toggleEntries = (value: boolean) => {
    setShowEntries(value);
    writeShowEntries(value);
  };

  const unit = view === 'month' ? 'month' : 'week';

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden items-center justify-between md:flex">
        <div>
          <h1 className="text-[28px] font-bold text-espresso">Calendar</h1>
          <p className="mt-1 text-sm text-clay">
            Plan coursework, lectures and verify digital entries
          </p>
        </div>
        <Link
          to="/entries/new"
          className="inline-flex h-10 items-center rounded-lg bg-gold px-4 text-[13px] font-bold text-espresso hover:opacity-90"
        >
          Log entry
        </Link>
      </div>
      <h1 className="sr-only md:hidden">Calendar</h1>

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 md:gap-4">
          <div className="flex gap-1 md:gap-2">
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label={`Previous ${unit}`}
              className="flex size-11 items-center justify-center rounded-md bg-cream text-clay hover:bg-sand md:size-8"
            >
              <ChevronLeft className="size-4" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label={`Next ${unit}`}
              className="flex size-11 items-center justify-center rounded-md bg-cream text-clay hover:bg-sand md:size-8"
            >
              <ChevronRight className="size-4" strokeWidth={2.5} />
            </button>
          </div>
          <h2
            aria-live="polite"
            className="truncate text-base font-bold text-espresso md:text-lg md:font-semibold"
          >
            {rangeLabel(anchor, view)}
          </h2>
        </div>

        <div
          role="group"
          aria-label="Calendar view"
          className="flex shrink-0 gap-0.5 rounded-md bg-cream p-0.5 md:rounded-lg"
        >
          {(['month', 'week'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => changeView(option)}
              aria-pressed={view === option}
              className={`min-h-11 rounded px-2 text-[11px] md:min-h-0 md:rounded-md md:px-4 md:py-2 md:text-[13px] ${
                view === option ? 'bg-gold font-bold text-espresso' : 'font-medium text-clay'
              }`}
            >
              {option === 'month' ? 'Month' : 'Week'}
            </button>
          ))}
        </div>
      </div>

      {notConnected && (
        <p className="rounded-lg bg-cream px-4 py-2.5 text-[13px] text-clay">
          Connect Google Calendar in{' '}
          <Link to="/settings" className="font-semibold text-espresso underline">
            Settings
          </Link>{' '}
          to see your events here.
        </p>
      )}
      {eventsQuery.isError && (
        <p className="rounded-lg bg-danger-soft px-4 py-2.5 text-[13px] text-error">
          Couldn&apos;t load your calendar events.
        </p>
      )}

      {/* Desktop: the full grid. */}
      <div className="hidden flex-col gap-2 md:flex">
        <div className="grid grid-cols-7 gap-2">
          {weeks[0].map((day, i) => (
            <div
              key={day}
              className={`rounded-md py-2 text-center text-xs font-bold ${
                view === 'week' && day === today ? 'bg-gold text-espresso' : 'bg-cream text-clay'
              }`}
            >
              {WEEKDAYS[i]}
              {view === 'week' && ` ${Number(day.slice(8))}`}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="grid grid-cols-7 gap-2">
            {week.map((day) => (
              <DayCell
                key={day}
                day={day}
                items={itemsByDay.get(day) ?? []}
                today={day === today}
                muted={view === 'month' && !isSameMonth(day, anchor)}
                view={view}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Mobile: a compact grid, and the chosen day's items below it. */}
      <div className="flex flex-col gap-2 md:hidden">
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((weekday) => (
            <span key={weekday} className="text-center text-[11px] font-bold text-clay">
              {weekday[0]}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="grid grid-cols-7">
            {week.map((day) => (
              <MobileDay
                key={day}
                day={day}
                items={itemsByDay.get(day) ?? []}
                today={day === today}
                muted={view === 'month' && !isSameMonth(day, anchor)}
                selected={day === selectedDay}
                onSelect={() => setSelectedDay(day)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="md:hidden">
        <MobileDayPanel
          day={selectedDay}
          items={itemsByDay.get(selectedDay) ?? []}
          today={selectedDay === today}
        />
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-cream pt-3 md:pt-4">
        <ul
          aria-label="Legend"
          className="flex min-w-0 gap-4 overflow-x-auto text-[11px] font-semibold text-clay md:gap-6 md:text-[13px] md:font-medium"
        >
          {legend.map(({ name, color }) => (
            <li key={name} className="flex shrink-0 items-center gap-1.5 md:gap-2">
              <span
                className="size-1.5 rounded-full md:size-2.5"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              {name}
            </li>
          ))}
          <li className="flex shrink-0 items-center gap-1.5 md:gap-2">
            <span className="size-1.5 rounded-full bg-data-orange md:size-2.5" aria-hidden />
            Logged entries
          </li>
        </ul>
        <label className="flex shrink-0 items-center gap-3 text-[13px] font-semibold text-clay">
          <span className="hidden sm:inline">Show entries</span>
          <Switch
            checked={showEntries}
            onCheckedChange={toggleEntries}
            aria-label="Show entries"
            className="data-checked:bg-gold"
          />
        </label>
      </div>
    </div>
  );
}
