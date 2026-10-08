import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
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
  textOn,
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
import type { PagedEntries, Project } from '@/types';

// How much a month cell shows before collapsing the rest into "+N more". An
// event pill (time + title) is about twice the height of an entry line, so
// it costs two: a cell fits one event or two entries, as in Figma.
const MONTH_CELL_BUDGET = 2;
// The entries list caps a page at 100; a month rarely comes close.
const ENTRY_LIMIT = 100;
const SHOW_ENTRIES_KEY = 'calendar.showEntries';
// Week view: one 64px row per hour, scrolled to 08:00 as in Figma.
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HOUR_HEIGHT = 64;
const FIRST_VISIBLE_HOUR = 8;

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
    description: event.description,
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

// Month view: a pale pill with a coloured left edge.
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

// Week view: a solid pill in the calendar's colour.
function SolidEventPill({ event }: { event: GridEvent }) {
  return (
    <EventPopover event={event}>
      <button
        type="button"
        className={`flex w-full min-w-0 flex-col rounded px-1.5 py-1 text-left hover:opacity-90 ${
          textOn(event.color) === 'dark' ? 'text-espresso' : 'text-white'
        }`}
        style={{ backgroundColor: event.color }}
      >
        {event.time && <span className="text-[10px] font-bold">{event.time}</span>}
        <span className="w-full truncate text-[11px] font-medium">{event.title}</span>
      </button>
    </EventPopover>
  );
}

function EntryPill({ entry, small = false }: { entry: GridEntry; small?: boolean }) {
  return (
    <Link
      to={`/entries/${entry.id}`}
      className="flex w-full min-w-0 items-center gap-1 rounded px-1 py-0.5 hover:bg-sand"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-logged" aria-hidden />
      <span className={`truncate text-clay ${small ? 'text-[10px]' : 'text-[11px]'}`}>
        {entry.title}
      </span>
    </Link>
  );
}

function ItemPill({ item }: { item: GridItem }) {
  return item.kind === 'event' ? <EventPill event={item} /> : <EntryPill entry={item} />;
}

function MonthCell({
  day,
  items,
  today,
  muted,
}: {
  day: string;
  items: GridItem[];
  today: boolean;
  muted: boolean;
}) {
  const shown = fitMonthCell(items);
  const hidden = items.length - shown.length;

  return (
    <div
      className={`flex h-27.5 min-w-0 flex-col gap-1.5 overflow-hidden rounded-lg p-2 ${
        today
          ? 'border-2 border-gold bg-today-soft'
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
          <span className="rounded-xs bg-gold px-1 py-px text-[8px] font-bold text-espresso">
            TODAY
          </span>
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
              className="self-start text-[11px] font-medium text-clay hover:underline"
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

function WeekGrid({
  days,
  itemsByDay,
  today,
}: {
  days: string[];
  itemsByDay: Map<string, GridItem[]>;
  today: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = FIRST_VISIBLE_HOUR * HOUR_HEIGHT;
  }, []);

  // All-day events have no hour, so they get a row of their own above the
  // hours. Figma has none; the row only appears when a week needs it.
  const allDay = days.map((day) =>
    (itemsByDay.get(day) ?? []).filter(
      (item): item is GridEvent => item.kind === 'event' && item.hour === null,
    ),
  );
  const hasAllDay = allDay.some((events) => events.length > 0);
  const columns = 'grid grid-cols-[56px_repeat(7,minmax(0,1fr))] gap-2';

  return (
    <div className="flex flex-col">
      <div className={columns}>
        <span />
        {days.map((day, i) => (
          <div
            key={day}
            className={`rounded-md py-2 text-center text-xs font-bold ${
              day === today ? 'bg-gold text-espresso' : 'bg-cream text-clay'
            }`}
          >
            {WEEKDAYS[i]} {Number(day.slice(8))}
          </div>
        ))}
      </div>

      {hasAllDay && (
        <div className={`${columns} pt-2`}>
          <span className="pt-1 text-xs font-medium text-clay">All day</span>
          {allDay.map((dayEvents, i) => (
            <div key={days[i]} className="flex min-w-0 flex-col gap-0.5">
              {dayEvents.map((event) => (
                <SolidEventPill key={event.key} event={event} />
              ))}
            </div>
          ))}
        </div>
      )}

      <div
        ref={scroller}
        data-testid="week-hours"
        className={`${columns} h-130 overflow-y-auto pt-2`}
      >
        <div className="flex flex-col">
          {HOURS.map((hour) => (
            <span key={hour} className="h-16 shrink-0 pt-1 text-xs font-medium text-clay">
              {`${String(hour).padStart(2, '0')}:00`}
            </span>
          ))}
        </div>
        {days.map((day) => {
          const timed = (itemsByDay.get(day) ?? []).filter((item) => item.hour !== null);
          return (
            <div
              key={day}
              className={`flex min-w-0 flex-col self-start overflow-hidden rounded-lg ${
                day === today ? 'border border-gold' : ''
              }`}
            >
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="flex h-16 shrink-0 flex-col gap-0.5 overflow-hidden border-b border-cream bg-white p-1"
                >
                  {timed
                    .filter((item) => item.hour === hour)
                    .map((item) =>
                      item.kind === 'event' ? (
                        <SolidEventPill key={item.key} event={item} />
                      ) : (
                        <EntryPill key={item.key} entry={item} small />
                      ),
                    )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
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
      className={`flex size-9 flex-col items-center justify-center gap-px justify-self-center rounded-full border text-xs ${
        today
          ? 'border-gold bg-gold font-bold text-espresso'
          : muted
            ? 'border-cream bg-cream/50 text-[#998066] opacity-30'
            : selected
              ? 'border-gold bg-white font-medium text-espresso'
              : `border-cream bg-white text-espresso ${items.length ? 'font-medium' : ''}`
      }`}
    >
      {Number(day.slice(8))}
      {dots.length > 0 && (
        <span className="flex h-1 gap-0.5" aria-hidden>
          {dots.map((dot) => (
            <span
              key={dot}
              className={`size-1 rounded-full ${dot === 'entry' ? 'bg-logged' : ''}`}
              style={dot === 'entry' ? undefined : { backgroundColor: dot }}
            />
          ))}
        </span>
      )}
    </button>
  );
}

const PANEL_CARD = 'flex w-full items-center gap-3 rounded-lg border border-cream bg-white p-3';

function MobileDayPanel({
  day,
  items,
  today,
  projectNames,
}: {
  day: string;
  items: GridItem[];
  today: boolean;
  projectNames: Map<number, string>;
}) {
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
          <li key={item.key}>
            {item.kind === 'event' ? (
              <EventPopover event={item}>
                <button type="button" className={`${PANEL_CARD} text-left`}>
                  <span
                    className="h-9 w-1 shrink-0 rounded-xs"
                    style={{ backgroundColor: item.color }}
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[11px] font-semibold text-clay">
                      {item.time ?? 'All day'}
                    </span>
                    <span className="truncate text-sm font-bold text-espresso">{item.title}</span>
                    <span className="truncate text-xs text-clay">
                      {item.description ?? item.calendar}
                    </span>
                  </span>
                </button>
              </EventPopover>
            ) : (
              <Link to={`/entries/${item.id}`} className={PANEL_CARD}>
                <span className="h-9 w-1 shrink-0 rounded-xs bg-logged" aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[11px] font-semibold text-logged">Logged Entry</span>
                  <span className="truncate text-sm font-bold text-espresso">{item.title}</span>
                  <span className="truncate text-xs text-clay">
                    {projectNames.get(item.projectId) ?? ''}
                  </span>
                </span>
                <span className="shrink-0 rounded bg-logged-soft px-1.5 py-0.5 text-[10px] font-semibold text-logged">
                  LOGGED
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: CalendarView;
  onChange: (view: CalendarView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Calendar view"
      className="flex shrink-0 gap-0.5 rounded-md bg-cream p-0.5 md:rounded-lg"
    >
      {(['month', 'week'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={view === option}
          className={`rounded px-2 py-1 text-[11px] md:rounded-md md:px-4 md:py-2 md:text-[13px] ${
            view === option ? 'bg-gold font-bold text-espresso' : 'font-medium text-clay'
          }`}
        >
          {option === 'month' ? 'Month' : 'Week'}
        </button>
      ))}
    </div>
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

  // Always fetched: mobile has no "Show entries" switch, so it always shows
  // them, and the desktop switch only filters what's drawn.
  const entriesQuery = useQuery({
    queryKey: ['entries', { calendar: [firstDay, lastDay] }],
    queryFn: () =>
      api.get<PagedEntries>(
        `/api/entries?dateFrom=${firstDay}T00:00:00.000Z&dateTo=${lastDay}T23:59:59.999Z&limit=${ENTRY_LIMIT}`,
      ),
  });

  // Same query as the explorer pane, so it's served from cache.
  const { data: projects } = useQuery({
    queryKey: ['projects', { archived: false }],
    queryFn: () => api.get<Project[]>('/api/projects'),
  });
  const projectNames = useMemo(
    () => new Map((projects ?? []).map((project) => [project.id, project.name])),
    [projects],
  );

  const events = useMemo(() => {
    const data = eventsQuery.data;
    if (!data?.connected) return [];
    return data.events.map(toGridEvent).filter((event): event is GridEvent => event !== null);
  }, [eventsQuery.data]);

  const entries = useMemo(
    () => (entriesQuery.data?.entries ?? []).map(toGridEntry),
    [entriesQuery.data],
  );
  const allByDay = useMemo(() => groupByDay([...events, ...entries]), [events, entries]);
  const desktopByDay = useMemo(
    () => (showEntries ? allByDay : groupByDay(events)),
    [showEntries, allByDay, events],
  );

  const legend = legendCalendars(events);
  const notConnected = eventsQuery.data?.connected === false;
  const label = rangeLabel(anchor, view);

  const goTo = (nextAnchor: string, nextSelected: string) => {
    setAnchor(nextAnchor);
    setSelectedDay(nextSelected);
  };

  const move = (direction: 1 | -1) => {
    const next = shiftAnchor(anchor, view, direction);
    // Keep the mobile day panel on a day that's on screen: today when the
    // new month holds it, otherwise the 1st; a week moves it along by 7.
    if (view === 'week') goTo(next, addDays(selectedDay, 7 * direction));
    else goTo(next, isSameMonth(today, next) ? today : next);
  };

  // Mobile's month label opens the browser's month picker, as Figma's
  // chevron suggests, instead of arrows.
  const pickMonth = (value: string) => {
    if (!/^\d{4}-\d{2}$/.test(value)) return;
    const first = `${value}-01`;
    goTo(first, isSameMonth(today, first) ? today : first);
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
    <div className="flex flex-col md:gap-6">
      <div className="hidden items-center justify-between md:flex">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold text-espresso">Calendar</h1>
          <p className="text-sm text-clay">Plan coursework, lectures and verify digital entries</p>
        </div>
        <Link
          to="/entries/new"
          className="inline-flex h-10 items-center rounded-lg bg-gold px-4 text-[13px] leading-4.5 font-bold text-espresso hover:opacity-90"
        >
          Log entry
        </Link>
      </div>
      <h1 className="sr-only md:hidden">Calendar</h1>

      {/* Desktop toolbar: arrows, the range, and the view switch. */}
      <div className="hidden items-center justify-between gap-3 md:flex">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label={`Previous ${unit}`}
              className="flex size-8 items-center justify-center rounded-md bg-cream text-clay hover:bg-sand"
            >
              <ChevronLeft className="size-3.5" strokeWidth={3} />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label={`Next ${unit}`}
              className="flex size-8 items-center justify-center rounded-md bg-cream text-clay hover:bg-sand"
            >
              <ChevronRight className="size-3.5" strokeWidth={3} />
            </button>
          </div>
          <h2 aria-live="polite" className="truncate text-lg font-semibold text-espresso">
            {label}
          </h2>
        </div>
        <ViewToggle view={view} onChange={changeView} />
      </div>

      {/* Mobile toolbar: the month label is a picker, then the view switch. */}
      <div className="flex items-center justify-between gap-3 pt-3 pb-2 md:hidden">
        <div className="relative flex min-h-11 min-w-0 items-center gap-1.5 text-espresso">
          <h2 aria-live="polite" className="truncate text-base font-bold">
            {label}
          </h2>
          <ChevronDown className="size-2.5 shrink-0" strokeWidth={3} aria-hidden />
          <input
            type="month"
            value={anchor.slice(0, 7)}
            onChange={(e) => pickMonth(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            aria-label="Choose month"
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
        <ViewToggle view={view} onChange={changeView} />
      </div>

      {notConnected && (
        <p className="mb-2 rounded-lg bg-cream px-4 py-2.5 text-[13px] text-clay md:mb-0">
          Connect Google Calendar in{' '}
          <Link to="/settings" className="font-semibold text-espresso underline">
            Settings
          </Link>{' '}
          to see your events here.
        </p>
      )}
      {eventsQuery.isError && (
        <p className="mb-2 rounded-lg bg-danger-soft px-4 py-2.5 text-[13px] text-error md:mb-0">
          Couldn&apos;t load your calendar events.
        </p>
      )}

      {/* Desktop grid. */}
      <div className="hidden md:block">
        {view === 'week' ? (
          <WeekGrid days={weeks[0]} itemsByDay={desktopByDay} today={today} />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-7 gap-2">
              {WEEKDAYS.map((weekday) => (
                <div
                  key={weekday}
                  className="rounded-md bg-cream py-2 text-center text-xs font-bold text-clay"
                >
                  {weekday}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {weeks.map((week) => (
                <div key={week[0]} className="grid grid-cols-7 gap-2">
                  {week.map((day) => (
                    <MonthCell
                      key={day}
                      day={day}
                      items={desktopByDay.get(day) ?? []}
                      today={day === today}
                      muted={!isSameMonth(day, anchor)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile: a compact grid, and the chosen day's items below it. */}
      <div className="flex flex-col gap-2 pb-3 md:hidden">
        <div className="grid grid-cols-7 py-1.5">
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
                items={allByDay.get(day) ?? []}
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
          items={allByDay.get(selectedDay) ?? []}
          today={selectedDay === today}
          projectNames={projectNames}
        />
      </div>

      {/* On mobile the legend stays pinned above the bottom bar while the day
          list scrolls under it, as in Figma. */}
      <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 flex items-center justify-between gap-4 border-t border-cream bg-paper px-4 py-3 md:static md:mx-0 md:mb-0 md:bg-transparent md:px-0 md:pt-4 md:pb-0">
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
            <span className="size-1.5 rounded-full bg-logged md:size-2.5" aria-hidden />
            <span className="md:hidden">Logged</span>
            <span className="hidden md:inline">Logged entries</span>
          </li>
        </ul>
        {/* Figma's mobile frame has no switch; entries always show there. */}
        <label className="hidden shrink-0 items-center gap-3 text-[13px] font-semibold text-clay md:flex">
          Show entries
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
