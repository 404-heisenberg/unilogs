import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Eye,
  Flame,
  GripVertical,
  Maximize2,
  Minimize2,
  Pin,
  Plus,
  Sparkles,
  Star,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import type { FrequencyStats, StatsSummary } from '@/lib/api';
import { entryWord, formatStatValue } from '@/lib/stat-panels';
import {
  CARD,
  DARK_BUTTON,
  GOLD_BUTTON,
  LABEL,
  MUTED,
  TEXT_BUTTON,
  WIDGET_META,
  entryDateLabel,
  entryTitle,
  formatDayLabel,
  formatDurationHours,
  formatEventTime,
  formatEventWhen,
  logEventPath,
  formatMonthDay,
  formatShortDate,
  isPanelWidget,
  panelIdOf,
  relativeTime,
  toBlocks,
  type ActivityStats,
  type DormantProject,
  type EntryDurations,
  type HeatCell,
  type HeatLevel,
  type InsightStat,
  type ThumbnailKind,
  type UnfinishedItem,
  type UnfinishedStats,
  type UpcomingData,
  type UpcomingEvent,
  type BuiltinWidgetId,
  type WidgetId,
  type WidgetSize,
  type WidgetState,
} from '@/lib/dashboard';
import type { DashboardStatPanel, Entry, StatPanelPoint } from '@/types';

export type DashboardCtx = {
  today: string;
  // Every saved panel, from the one /api/stat-panels request. Panel widgets
  // read their value from here rather than fetching their own.
  panels: {
    byId: ReadonlyMap<number, DashboardStatPanel>;
    isLoading: boolean;
    isError: boolean;
  };
  isDesktop: boolean;
  summary: StatsSummary;
  counts: { streak: number; totalHours: number };
  topProject: { name: string; percent: number } | null;
  heatmap: {
    cells: HeatCell[] | null;
    stats: ActivityStats | null;
    isLoading: boolean;
    isError: boolean;
  };
  recent: {
    entries: Entry[] | undefined;
    durations: EntryDurations;
    isLoading: boolean;
    isError: boolean;
  };
  unfinished: { stats: UnfinishedStats | undefined; isLoading: boolean; isError: boolean };
  insight: { stat: InsightStat | null | undefined; isLoading: boolean };
  frequency: { stats: FrequencyStats | undefined; isLoading: boolean; isError: boolean };
  upcoming: { data: UpcomingData | undefined; isLoading: boolean; isError: boolean };
  dormant: DormantProject[] | null;
  markFailed: boolean;
  onMarkDone: (item: UnfinishedItem) => void;
};

function WidgetSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={CARD} aria-hidden>
      <div className="mb-3 h-3 w-24 animate-pulse rounded bg-cream" />
      <Skeleton rows={rows} />
    </div>
  );
}

function WidgetMessage({ title, message }: { title: string; message: ReactNode }) {
  return (
    <section className={CARD}>
      <h2 className="text-sm font-semibold text-espresso">{title}</h2>
      <p className={`mt-1 text-xs ${MUTED}`}>{message}</p>
    </section>
  );
}

type SummaryStripProps = {
  streak: number;
  totalHours: number;
  projectCount: number;
  topProject: { name: string; percent: number } | null;
};

function SummaryStripWidgetBase({
  streak,
  totalHours,
  projectCount,
  topProject,
}: SummaryStripProps) {
  return (
    <section className="flex flex-col gap-1 rounded-xl bg-cream px-4 py-3 text-sm text-espresso md:flex-row md:items-center md:justify-between">
      <p className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-gold" strokeWidth={1.75} aria-hidden />
        <span className="font-semibold">{streak}-day streak</span>
        <span className={MUTED}>·</span>
        <span>{totalHours}h total</span>
      </p>
      <p className={`text-xs md:text-sm ${MUTED}`}>
        {topProject && (
          <>
            Top project:{' '}
            <span className="font-semibold text-espresso">
              {topProject.name} ({topProject.percent}%)
            </span>{' '}
            ·{' '}
          </>
        )}
        Across {projectCount} {projectCount === 1 ? 'project' : 'projects'}
      </p>
    </section>
  );
}

const SummaryStripWidget = memo(SummaryStripWidgetBase);

const LEVEL_CLASS: Record<HeatLevel, string> = {
  0: 'bg-heat-0',
  1: 'bg-heat-1',
  2: 'bg-heat-2',
  3: 'bg-caramel',
  4: 'bg-gold',
};

const LEGEND_LEVELS: HeatLevel[] = [0, 1, 2, 3, 4];

function entryCount(count: number): string {
  return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}

type HeatmapGridProps = {
  cells: HeatCell[];
  onHover: (cell: HeatCell | null) => void;
};

const HeatmapGrid = memo(function HeatmapGrid({ cells, onHover }: HeatmapGridProps) {
  const handleOver = (event: MouseEvent<HTMLDivElement>) => {
    const index = (event.target as HTMLElement).dataset.index;
    onHover(index === undefined ? null : cells[Number(index)]);
  };

  return (
    <div
      className="grid w-max grid-flow-col grid-rows-7 gap-[2px] md:gap-[3px]"
      onMouseOver={handleOver}
      onMouseLeave={() => onHover(null)}
    >
      {cells.map((cell, index) =>
        cell.future ? (
          <div key={cell.date} aria-hidden className="size-2.5 md:size-3" />
        ) : (
          <div
            key={cell.date}
            data-index={index}
            role="img"
            aria-label={`${formatDayLabel(cell.date)}: ${entryCount(cell.count)}`}
            className={`size-2.5 rounded-[2px] md:size-3 ${LEVEL_CLASS[cell.level]}`}
          />
        ),
      )}
    </div>
  );
});

type HeatmapProps = {
  cells: HeatCell[] | null;
  stats: ActivityStats | null;
  isLoading: boolean;
  isError: boolean;
  size: WidgetSize;
};

function HeatmapWidgetBase({ cells, stats, isLoading, isError, size }: HeatmapProps) {
  const [hovered, setHovered] = useState<HeatCell | null>(null);

  if (isLoading) return <WidgetSkeleton rows={4} />;
  if (isError || !cells || !stats) {
    return <WidgetMessage title="Activity" message="Couldn't load your activity." />;
  }

  const wide = size === 'wide';

  return (
    <section className={CARD}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={`shrink-0 ${LABEL}`}>Activity — last 12 weeks</h2>
        <p className={`min-w-0 flex-1 truncate text-right text-[11px] ${MUTED}`}>
          {hovered ? `${formatDayLabel(hovered.date)} — ${entryCount(hovered.count)}` : ''}
        </p>
        <div className={`flex shrink-0 items-center gap-1 text-[11px] ${MUTED}`} aria-hidden>
          <span className="mr-0.5">Less</span>
          {LEGEND_LEVELS.map((level) => (
            <span key={level} className={`size-2.5 rounded-[2px] ${LEVEL_CLASS[level]}`} />
          ))}
          <span className="ml-0.5">More</span>
        </div>
      </div>

      <div
        className={`flex gap-6 ${wide ? 'flex-col md:flex-row md:items-center md:justify-between' : 'flex-col'}`}
      >
        <HeatmapGrid cells={cells} onHover={setHovered} />

        <dl className="hidden grid-cols-3 gap-6 text-center md:grid md:gap-12 md:pr-8">
          <Stat value={String(stats.activeDays)} label="Active days" />
          <Stat value={`${stats.daysThisWeek} of 7`} label="Days this week" />
          <Stat value={String(stats.avgDaysPerWeek)} label="Avg days per week" />
        </dl>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col-reverse gap-0.5">
      <dt className={LABEL}>{label}</dt>
      <dd className="text-2xl font-semibold text-espresso">{value}</dd>
    </div>
  );
}

const HeatmapWidget = memo(HeatmapWidgetBase);

type ContinueProps = {
  latest: Entry | undefined;
  isLoading: boolean;
  isDesktop: boolean;
};

function ContinueWidgetBase({ latest, isLoading, isDesktop }: ContinueProps) {
  if (isLoading) return <WidgetSkeleton rows={2} />;

  const projectName = latest?.project?.name;

  return (
    <section
      className={`${CARD} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}
    >
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-espresso">
          <span className="size-2 shrink-0 rounded-full bg-data-orange" aria-hidden />
          <span className="truncate">{projectName ?? 'Start logging'}</span>
        </h2>
        <p className={`mt-1 text-xs ${MUTED}`}>
          {latest ? `Last logged ${relativeTime(latest.createdAt)}` : 'Nothing logged yet'}
        </p>
      </div>
      <Link to="/entries/new" className={`${GOLD_BUTTON} ${isDesktop ? '' : 'w-full'}`}>
        {isDesktop ? 'Continue' : 'Continue Logging'}
      </Link>
    </section>
  );
}

const ContinueWidget = memo(ContinueWidgetBase);

function entryMeta(entry: Entry, hours: number | null | undefined, today: string): string {
  const date = entryDateLabel(entry, today);
  if (hours === undefined) return date;
  return `${date} · ${hours === null ? 'No duration' : formatDurationHours(hours)}`;
}

type RecentEntriesProps = {
  entries: Entry[] | undefined;
  durations: EntryDurations;
  isLoading: boolean;
  isError: boolean;
  today: string;
};

function RecentEntriesWidgetBase({
  entries,
  durations,
  isLoading,
  isError,
  today,
}: RecentEntriesProps) {
  if (isLoading) return <WidgetSkeleton rows={5} />;
  if (isError)
    return <WidgetMessage title="Recent entries" message="Couldn't load your entries." />;
  if (!entries || entries.length === 0) {
    return <WidgetMessage title="Recent entries" message="Entries you log will show up here." />;
  }

  return (
    <section className={CARD}>
      <h2 className="mb-2 text-sm font-semibold text-espresso">Recent entries</h2>
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link
              to={`/entries/${entry.id}`}
              className="flex items-start justify-between gap-3 rounded-md py-2 focus-visible:outline-2 focus-visible:outline-gold"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-espresso">
                  {entryTitle(entry)}
                </span>
                <span className={`block truncate text-xs ${MUTED}`}>{entry.project?.name}</span>
              </span>
              <span className={`shrink-0 text-xs ${MUTED}`}>
                {entryMeta(entry, durations[entry.id], today)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const RecentEntriesWidget = memo(RecentEntriesWidgetBase);

type InsightProps = {
  stat: InsightStat | null | undefined;
  isLoading: boolean;
};

function Header() {
  return (
    <div className="flex items-center justify-between">
      <p className={`flex items-center gap-1.5 ${LABEL}`}>
        <Sparkles className="h-3 w-3" strokeWidth={1.75} aria-hidden />
        Insight
      </p>
      <Pin className={`h-3 w-3 ${MUTED}`} strokeWidth={1.75} aria-hidden />
    </div>
  );
}

function InsightWidgetBase({ stat, isLoading }: InsightProps) {
  if (isLoading) return <WidgetSkeleton rows={2} />;

  if (!stat) {
    return (
      <section className={CARD}>
        <Header />
        <p className="mt-3 text-base font-semibold text-espresso">No data yet</p>
        <p className={`mt-1 text-xs ${MUTED}`}>Your pinned stat will show up here.</p>
      </section>
    );
  }

  const up = stat.current >= stat.previous;
  const same = stat.current === stat.previous;
  const TrendIcon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <section className={CARD}>
      <Header />
      <p className={`mt-2 inline-block rounded bg-paper px-2 py-0.5 text-[11px] ${MUTED}`}>
        {stat.projectName} · {stat.fieldName}
      </p>
      <p className="mt-2 text-lg font-semibold text-espresso">
        {stat.current} {stat.fieldName.toLowerCase()} this week
      </p>
      <p
        className={`mt-1 flex items-center gap-1 text-xs ${same ? MUTED : up ? 'text-success' : 'text-error'}`}
      >
        {!same && <TrendIcon className="h-3 w-3" strokeWidth={2} aria-hidden />}
        {same ? 'Same as last week' : `${up ? 'Up' : 'Down'} from ${stat.previous} last week`}
      </p>
    </section>
  );
}

const InsightWidget = memo(InsightWidgetBase);

type UpcomingProps = {
  data: UpcomingData | undefined;
  isLoading: boolean;
  isError: boolean;
  isDesktop: boolean;
  today: string;
};

type EventDetailsProps = {
  event: UpcomingEvent;
  today: string;
  heading: ReactNode;
  stacked: boolean;
  onDismiss: () => void;
};

function EventDetails({ event, today, heading, stacked, onDismiss }: EventDetailsProps) {
  const when = formatEventWhen(event, today);
  return (
    <div className="flex flex-col gap-2">
      {heading}
      {when && <p className={`text-xs ${MUTED}`}>{when}</p>}
      <span className="w-fit rounded bg-cream px-2 py-0.5 text-[10px] font-medium text-clay">
        From Google Calendar
      </span>
      {event.description && <p className="text-xs text-cocoa">{event.description}</p>}
      <div
        className={
          stacked ? 'mt-3 flex flex-col items-stretch gap-1' : 'mt-2 flex items-center gap-3'
        }
      >
        <Link to={logEventPath(event)} className={`${DARK_BUTTON} ${stacked ? 'w-full' : ''}`}>
          Create UniLogs entry
        </Link>
        <button type="button" onClick={onDismiss} className={TEXT_BUTTON}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

const EVENT_ROW =
  'flex min-w-0 flex-1 items-center gap-3 rounded text-left text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';
const LOG_LINK =
  'shrink-0 rounded px-1 py-1 text-[11px] font-medium text-cocoa transition-colors hover:text-espresso hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';

function UpcomingWidgetBase({ data, isLoading, isError, isDesktop, today }: UpcomingProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading) return <WidgetSkeleton rows={3} />;
  if (isError) return <WidgetMessage title="Upcoming" message="Couldn't load your calendar." />;
  if (data?.needsReauth) {
    return (
      <WidgetMessage
        title="Upcoming"
        message={
          <>
            Google Calendar needs reconnecting.{' '}
            <Link to="/settings" className="font-semibold text-espresso underline">
              Reconnect
            </Link>
          </>
        }
      />
    );
  }
  if (!data || !data.connected || data.events.length === 0) {
    return <WidgetMessage title="Upcoming" message="No upcoming events." />;
  }

  const close = () => setOpenId(null);
  const selected = data.events.find((event) => event.id === openId) ?? null;

  return (
    <section className={CARD}>
      <h2 className="mb-3 text-sm font-bold text-espresso">Upcoming</h2>
      <ul className="flex flex-col gap-1">
        {data.events.map((event) => {
          const label = (
            <>
              <span className="shrink-0 font-bold text-clay">{formatEventTime(event.start)}</span>
              <span className="truncate text-espresso">{event.title}</span>
            </>
          );
          return (
            <li
              key={event.id}
              className={`-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors ${
                openId === event.id ? 'bg-gold-light/50' : ''
              }`}
            >
              {isDesktop ? (
                <Popover
                  open={openId === event.id}
                  onOpenChange={(open) => setOpenId(open ? event.id : null)}
                >
                  <PopoverTrigger asChild>
                    <button type="button" className={EVENT_ROW}>
                      {label}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-72 gap-0 bg-paper p-3 text-espresso ring-caramel/40"
                  >
                    <EventDetails
                      event={event}
                      today={today}
                      stacked={false}
                      onDismiss={close}
                      heading={<p className="text-sm font-semibold">{event.title}</p>}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <button type="button" onClick={() => setOpenId(event.id)} className={EVENT_ROW}>
                  {label}
                </button>
              )}
              <Link
                to={logEventPath(event)}
                aria-label={`Log entry for ${event.title}`}
                className={LOG_LINK}
              >
                Log
              </Link>
            </li>
          );
        })}
      </ul>

      {!isDesktop && (
        <Sheet
          open={selected !== null}
          onOpenChange={(open) => {
            if (!open) close();
          }}
        >
          <SheetContent
            side="bottom"
            showCloseButton={false}
            aria-describedby={undefined}
            className="rounded-t-3xl bg-paper px-5 pb-8 pt-5 text-espresso"
          >
            {selected && (
              <EventDetails
                event={selected}
                today={today}
                stacked
                onDismiss={close}
                heading={
                  <SheetTitle className="text-base font-semibold text-espresso">
                    {selected.title}
                  </SheetTitle>
                }
              />
            )}
          </SheetContent>
        </Sheet>
      )}
    </section>
  );
}

const UpcomingWidget = memo(UpcomingWidgetBase);

type WhatsLeftProps = {
  stats: UnfinishedStats | undefined;
  isLoading: boolean;
  isError: boolean;
  markFailed: boolean;
  onMarkDone: (item: UnfinishedItem) => void;
};

type GroupProps = {
  heading: string;
  items: UnfinishedItem[];
  overdue?: boolean;
  onMarkDone: (item: UnfinishedItem) => void;
};

function itemMeta(item: UnfinishedItem): string {
  const due = item.dueDate ? ` · due ${formatShortDate(item.dueDate.slice(0, 10))}` : '';
  return `${item.projectName}${due}`;
}

function Group({ heading, items, overdue = false, onMarkDone }: GroupProps) {
  if (items.length === 0) return null;
  const accent = overdue ? 'text-error' : MUTED;

  return (
    <div className="flex flex-col gap-1.5">
      <h3
        className={`flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.08em] ${accent}`}
      >
        {overdue && <Clock className="h-3 w-3" strokeWidth={2} aria-hidden />}
        {heading}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={`${item.entryId}-${item.fieldName}`} className="flex items-center gap-2">
            <button
              type="button"
              role="checkbox"
              aria-checked="false"
              aria-label={`Mark ${item.label} done`}
              onClick={() => onMarkDone(item)}
              className={`size-4 shrink-0 rounded-[3px] border-[1.5px] bg-paper transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                overdue ? 'border-error' : 'border-cocoa'
              }`}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-espresso">
              {item.label}
            </span>
            <span className={`shrink-0 text-[11px] ${overdue ? 'text-error' : MUTED}`}>
              {itemMeta(item)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WhatsLeftWidgetBase({
  stats,
  isLoading,
  isError,
  markFailed,
  onMarkDone,
}: WhatsLeftProps) {
  if (isLoading) return <WidgetSkeleton rows={4} />;
  if (isError || !stats) {
    return <WidgetMessage title="What's left" message="Couldn't load your open items." />;
  }

  const total = stats.overdue.length + stats.dueThisWeek.length + stats.noDueDate.length;
  if (total === 0) {
    return <WidgetMessage title="What's left" message="Nothing open. You're all caught up." />;
  }

  return (
    <section className={`${CARD} flex flex-col gap-3`}>
      <h2 className={LABEL}>What's left</h2>
      <Group heading="Overdue" items={stats.overdue} overdue onMarkDone={onMarkDone} />
      <Group heading="Due this week" items={stats.dueThisWeek} onMarkDone={onMarkDone} />
      <Group heading="No due date" items={stats.noDueDate} onMarkDone={onMarkDone} />
      {markFailed && (
        <p role="alert" className="text-xs text-error">
          Couldn't mark that done. Try again.
        </p>
      )}
    </section>
  );
}

const WhatsLeftWidget = memo(WhatsLeftWidgetBase);

const COLORS = ['#D4A843', '#7a9e6b', '#8c709c', '#ef8a4b'];
const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MAX_LEGEND = 4;

type TimeByProjectProps = { projects: StatsSummary['perProject'] };

function TimeByProjectWidgetBase({ projects }: TimeByProjectProps) {
  const ranked = [...projects]
    .filter((p) => p.totalHours > 0)
    .sort((a, b) => b.totalHours - a.totalHours);
  const total = ranked.reduce((sum, project) => sum + project.totalHours, 0);

  if (total === 0) {
    return <WidgetMessage title="Time by project" message="Log some hours to see the split." />;
  }

  const shown = ranked.slice(0, MAX_LEGEND);
  const topPercent = Math.round((shown[0].totalHours / total) * 100);
  const segments = shown.map((project, index) => {
    const length = (project.totalHours / total) * CIRCUMFERENCE;
    const offset = shown
      .slice(0, index)
      .reduce((sum, earlier) => sum + (earlier.totalHours / total) * CIRCUMFERENCE, 0);
    return { project, length, offset };
  });

  return (
    <section className={CARD}>
      <h2 className={`mb-3 ${LABEL}`}>Time by project</h2>
      <div className="flex items-center gap-5">
        <div className="relative size-[104px] shrink-0">
          <svg
            viewBox="0 0 100 100"
            className="size-full -rotate-90"
            role="img"
            aria-label={`${shown[0].projectName} is ${topPercent}% of your time`}
          >
            <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#e8e0d8" strokeWidth="12" />
            {segments.map(({ project, length, offset }, index) => (
              <circle
                key={project.projectId}
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={COLORS[index % COLORS.length]}
                strokeWidth="12"
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={-offset}
              />
            ))}
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-base font-semibold text-espresso">
            {topPercent}%
          </span>
        </div>
        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {shown.map((project, index) => (
            <li key={project.projectId} className="flex items-center gap-2 text-xs text-espresso">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{project.projectName}</span>
              <span className={MUTED}>{project.totalHours}h</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const TimeByProjectWidget = memo(TimeByProjectWidgetBase);

const WEEKS_SHOWN = 6;
const BAR_AREA_PX = 88;

type FrequencyProps = {
  stats: FrequencyStats | undefined;
  isLoading: boolean;
  isError: boolean;
};

function FrequencyWidgetBase({ stats, isLoading, isError }: FrequencyProps) {
  if (isLoading) return <WidgetSkeleton rows={4} />;
  if (isError || !stats) {
    return (
      <WidgetMessage title="Logging frequency" message="Couldn't load your logging frequency." />
    );
  }

  const weeks = stats.weekly.slice(-WEEKS_SHOWN);
  if (weeks.length === 0) {
    return (
      <WidgetMessage
        title="Logging frequency"
        message="Log a few entries to see your weekly rhythm."
      />
    );
  }

  const max = Math.max(1, ...weeks.map((week) => week.count));

  return (
    <section className={CARD}>
      <h2 className={`mb-3 ${LABEL}`}>Logging frequency — last 6 weeks</h2>
      <ul className="flex items-end justify-between gap-2">
        {weeks.map((week) => {
          const isMax = week.count === max;
          return (
            <li
              key={week.weekStart}
              className="flex flex-1 flex-col items-center gap-1"
              aria-label={`Week of ${formatShortDate(week.weekStart)}: ${week.count} ${week.count === 1 ? 'entry' : 'entries'}`}
            >
              <span className={`text-[11px] ${MUTED}`}>{week.count}</span>
              <span
                className={`w-full max-w-7 rounded-t-[3px] ${isMax ? 'bg-gold' : 'bg-clay'}`}
                style={{ height: `${Math.max(4, (week.count / max) * BAR_AREA_PX)}px` }}
              />
              <span className={`text-[10px] ${MUTED}`}>{formatShortDate(week.weekStart)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const FrequencyWidget = memo(FrequencyWidgetBase);

type DueDormantProps = {
  dormant: DormantProject[] | null;
  overdue: UnfinishedItem[] | undefined;
  isLoading: boolean;
};

function Row({ title, meta, alert = false }: { title: string; meta: string; alert?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <Clock
        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${alert ? 'text-error' : MUTED}`}
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-espresso">{title}</span>
        <span className={`block text-[11px] ${alert ? 'text-error' : MUTED}`}>{meta}</span>
      </span>
    </li>
  );
}

function DueDormantWidgetBase({ dormant, overdue, isLoading }: DueDormantProps) {
  if (isLoading || dormant === null) return <WidgetSkeleton rows={3} />;

  const overdueItems = overdue ?? [];
  if (dormant.length === 0 && overdueItems.length === 0) {
    return (
      <WidgetMessage
        title="Due & dormant projects"
        message="Nothing overdue and no quiet projects."
      />
    );
  }

  return (
    <section className={CARD}>
      <h2 className={`mb-3 ${LABEL}`}>Due &amp; dormant projects</h2>
      <ul className="flex flex-col gap-3">
        {dormant.map((project) => (
          <Row
            key={`dormant-${project.projectId}`}
            title={project.projectName}
            meta={
              project.lastLogged
                ? `last logged ${formatMonthDay(project.lastLogged)} · dormant`
                : 'no entries in 12 weeks · dormant'
            }
          />
        ))}
        {overdueItems.map((item) => (
          <Row
            key={`overdue-${item.entryId}-${item.fieldName}`}
            alert
            title={`${item.label} — ${item.projectName}`}
            meta={`due ${item.dueDate ? formatShortDate(item.dueDate.slice(0, 10)) : 'soon'} · overdue`}
          />
        ))}
      </ul>
    </section>
  );
}

const DueDormantWidget = memo(DueDormantWidgetBase);

function WidgetThumbnail({ kind }: { kind: ThumbnailKind }) {
  return (
    <svg viewBox="0 0 80 48" className="h-12 w-20" aria-hidden>
      {kind === 'donut' && (
        <>
          <circle cx="40" cy="24" r="14" fill="none" stroke="#e8e0d8" strokeWidth="7" />
          <circle
            cx="40"
            cy="24"
            r="14"
            fill="none"
            stroke="#D4A843"
            strokeWidth="7"
            strokeDasharray="56 88"
            transform="rotate(-90 40 24)"
          />
        </>
      )}
      {kind === 'bars' && (
        <>
          <rect x="16" y="24" width="8" height="16" rx="1.5" fill="#7a5230" />
          <rect x="28" y="30" width="8" height="10" rx="1.5" fill="#7a5230" />
          <rect x="40" y="12" width="8" height="28" rx="1.5" fill="#D4A843" />
          <rect x="52" y="26" width="8" height="14" rx="1.5" fill="#7a5230" />
        </>
      )}
      {kind === 'list' && (
        <>
          <rect x="14" y="10" width="7" height="7" rx="1.5" fill="none" stroke="#7a5230" />
          <rect x="26" y="12" width="38" height="3" rx="1.5" fill="#baa38c" />
          <rect x="14" y="22" width="7" height="7" rx="1.5" fill="none" stroke="#7a5230" />
          <rect x="26" y="24" width="30" height="3" rx="1.5" fill="#baa38c" />
          <rect x="14" y="34" width="7" height="7" rx="1.5" fill="none" stroke="#7a5230" />
          <rect x="26" y="36" width="34" height="3" rx="1.5" fill="#baa38c" />
        </>
      )}
      {kind === 'stat' && (
        <>
          <rect x="14" y="12" width="22" height="3" rx="1.5" fill="#baa38c" />
          <rect x="14" y="20" width="52" height="16" rx="3" fill="#e6c687" />
        </>
      )}
      {kind === 'card' && (
        <>
          <rect x="14" y="12" width="30" height="4" rx="2" fill="#7a5230" />
          <rect x="14" y="22" width="52" height="3" rx="1.5" fill="#baa38c" />
          <rect x="14" y="32" width="24" height="7" rx="3.5" fill="#D4A843" />
        </>
      )}
    </svg>
  );
}

function widgetTitle(id: WidgetId, ctx: DashboardCtx): string {
  if (!isPanelWidget(id)) return WIDGET_META[id].title;
  return ctx.panels.byId.get(panelIdOf(id))?.name ?? 'Stat panel';
}

function panelValue(panel: DashboardStatPanel): string {
  return panel.value === null ? '' : formatStatValue(panel.value, panel.expression, panel.fields);
}

// Figma's sparkline: a gold line over a fading gold fill, in a 48px well.
function PanelSparkline({ series }: { series: StatPanelPoint[] }) {
  if (series.length < 2) return null;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const width = 100;
  const height = 48;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - 4 - ((value - min) / span) * (height - 8);
    return `${x},${y}`;
  });

  return (
    <div className="h-12 w-full overflow-hidden rounded-lg border border-line bg-cream">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Daily trend over the panel's range"
        className="size-full text-gold"
      >
        <defs>
          <linearGradient id="panel-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.2} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${height} ${points.join(' ')} ${width},${height}`}
          fill="url(#panel-fill)"
        />
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

type StatPanelWidgetProps = {
  panel: DashboardStatPanel | undefined;
  isLoading: boolean;
  isError: boolean;
};

// A saved stat panel on the dashboard (Figma "stat-panel-card"). The whole
// card opens the panel's project.
export function StatPanelWidget({ panel, isLoading, isError }: StatPanelWidgetProps) {
  if (!panel) {
    return (
      <div className="rounded-xl border border-line bg-cream p-5">
        {isLoading ? (
          <Skeleton rows={3} />
        ) : (
          <p className={`text-sm ${MUTED}`}>
            {isError ? 'Couldn’t load this panel.' : 'This panel no longer exists.'}
          </p>
        )}
      </div>
    );
  }

  // Figma's footer uses the short form: "18 entries · Last 30 days · Avg".
  const aggregation = panel.aggregation === 'average' ? 'Avg' : 'Sum';
  const hasValue = panel.value !== null && panel.sampleCount > 0;

  return (
    <Link
      to={`/projects/${panel.projectId}`}
      aria-label={`${panel.name}, ${panel.project.name}: open project`}
      className="flex flex-col gap-4 rounded-xl border border-line bg-cream p-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <div className="flex items-center gap-2.5">
        <Star className="size-4.5 shrink-0 text-rail" strokeWidth={1.75} aria-hidden />
        <p className="truncate text-sm font-semibold text-rail">{panel.name}</p>
      </div>
      {panel.error ? (
        <p className="text-sm text-error">Couldn’t calculate this panel: {panel.error}</p>
      ) : hasValue ? (
        <div className="flex flex-col gap-3">
          <p className="truncate text-4xl font-bold text-rail">{panelValue(panel)}</p>
          <PanelSparkline series={panel.series} />
          <p className={`text-xs ${MUTED}`}>
            {entryWord(panel.sampleCount)} · Last {panel.rangeDays} days · {aggregation}
          </p>
        </div>
      ) : (
        <p className={`text-sm ${MUTED}`}>No data yet</p>
      )}
    </Link>
  );
}

type FrameProps = {
  widget: WidgetState;
  title: string;
  customising: boolean;
  isDragging: boolean;
  onDragStart: (id: WidgetId) => void;
  onDragEnd: () => void;
  onDropOn: (id: WidgetId, event: DragEvent<HTMLDivElement>) => void;
  onMoveBy: (id: WidgetId, delta: -1 | 1) => void;
  onToggle: (id: WidgetId) => void;
  onResize: (id: WidgetId) => void;
  children: ReactNode;
};

const CHIP =
  'flex size-6 items-center justify-center rounded-md border border-line-strong bg-paper text-cocoa transition-colors hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';

function WidgetFrameBase({
  widget,
  title,
  customising,
  isDragging,
  onDragStart,
  onDragEnd,
  onDropOn,
  onMoveBy,
  onToggle,
  onResize,
  children,
}: FrameProps) {
  if (!customising) return <div>{children}</div>;

  const { id, size } = widget;
  const wide = size === 'wide';

  const handleDragStart = (event: DragEvent<HTMLButtonElement>) => {
    const frame = event.currentTarget.closest('[data-widget-frame]');
    if (frame) event.dataTransfer.setDragImage(frame, 16, 16);
    event.dataTransfer.effectAllowed = 'move';
    onDragStart(id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      onMoveBy(id, -1);
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      onMoveBy(id, 1);
    }
  };

  return (
    <div
      data-widget-frame
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDropOn(id, event);
      }}
      className={`relative rounded-xl border border-dashed border-line-strong p-1.5 transition-opacity ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onKeyDown={handleKeyDown}
        aria-label={`Reorder ${title}`}
        className={`${CHIP} absolute -top-3 left-3 z-10 cursor-grab active:cursor-grabbing`}
      >
        <GripVertical className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
      <div className="absolute -top-3 right-3 z-10 flex gap-1">
        <button
          type="button"
          onClick={() => onResize(id)}
          aria-label={wide ? `Make ${title} standard width` : `Make ${title} wide`}
          className={CHIP}
        >
          {wide ? (
            <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={() => onToggle(id)}
          aria-label={`Hide ${title}`}
          className={CHIP}
        >
          <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <div inert>{children}</div>
    </div>
  );
}

const WidgetFrame = memo(WidgetFrameBase);

type ContentProps = { id: WidgetId; size: WidgetSize; ctx: DashboardCtx };

function WidgetContent({ id, size, ctx }: ContentProps) {
  if (isPanelWidget(id)) {
    return (
      <StatPanelWidget
        panel={ctx.panels.byId.get(panelIdOf(id))}
        isLoading={ctx.panels.isLoading}
        isError={ctx.panels.isError}
      />
    );
  }
  switch (id) {
    case 'summary':
      return (
        <SummaryStripWidget
          streak={ctx.counts.streak}
          totalHours={ctx.counts.totalHours}
          projectCount={ctx.summary.perProject.length}
          topProject={ctx.topProject}
        />
      );
    case 'heatmap':
      return (
        <HeatmapWidget
          cells={ctx.heatmap.cells}
          stats={ctx.heatmap.stats}
          isLoading={ctx.heatmap.isLoading}
          isError={ctx.heatmap.isError}
          size={size}
        />
      );
    case 'whatsLeft':
      return (
        <WhatsLeftWidget
          stats={ctx.unfinished.stats}
          isLoading={ctx.unfinished.isLoading}
          isError={ctx.unfinished.isError}
          markFailed={ctx.markFailed}
          onMarkDone={ctx.onMarkDone}
        />
      );
    case 'recent':
      return (
        <RecentEntriesWidget
          entries={ctx.recent.entries}
          durations={ctx.recent.durations}
          isLoading={ctx.recent.isLoading}
          isError={ctx.recent.isError}
          today={ctx.today}
        />
      );
    case 'continue':
      return (
        <ContinueWidget
          latest={ctx.recent.entries?.[0]}
          isLoading={ctx.recent.isLoading}
          isDesktop={ctx.isDesktop}
        />
      );
    case 'upcoming':
      return (
        <UpcomingWidget
          data={ctx.upcoming.data}
          isLoading={ctx.upcoming.isLoading}
          isError={ctx.upcoming.isError}
          isDesktop={ctx.isDesktop}
          today={ctx.today}
        />
      );
    case 'insight':
      return <InsightWidget stat={ctx.insight.stat} isLoading={ctx.insight.isLoading} />;
    case 'timeByProject':
      return <TimeByProjectWidget projects={ctx.summary.perProject} />;
    case 'frequency':
      return (
        <FrequencyWidget
          stats={ctx.frequency.stats}
          isLoading={ctx.frequency.isLoading}
          isError={ctx.frequency.isError}
        />
      );
    case 'dueDormant':
      return (
        <DueDormantWidget
          dormant={ctx.dormant}
          overdue={ctx.unfinished.stats?.overdue}
          isLoading={ctx.heatmap.isLoading || ctx.unfinished.isLoading}
        />
      );
  }
}

type TrayProps = {
  hidden: WidgetState[];
  onAdd: (id: WidgetId) => void;
  /** Saved panels not on the dashboard right now. */
  panels: DashboardStatPanel[];
  panelsLoading: boolean;
  onAddPanel: (panelId: number) => void;
};

const TRAY_TILE =
  'flex w-full flex-col items-center gap-2 rounded-lg bg-cream px-3 py-3 text-xs font-medium text-espresso transition-colors hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';

// Figma's "Your panels" tile: a star over the first panel's value. It opens a
// list of the saved panels that aren't on the dashboard yet.
function YourPanelsTile({
  panels,
  isLoading,
  onAddPanel,
}: {
  panels: DashboardStatPanel[];
  isLoading: boolean;
  onAddPanel: (panelId: number) => void;
}) {
  const preview = panels.find((panel) => panel.value !== null);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Add from your panels" className={TRAY_TILE}>
          <span className="flex h-12 flex-col items-center justify-center gap-1" aria-hidden>
            <Star className="size-4.5 text-espresso" strokeWidth={1.75} />
            <span className="max-w-full truncate text-sm font-bold text-rail">
              {preview ? panelValue(preview) : '—'}
            </span>
          </span>
          Your panels
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-1 bg-paper p-2">
        <p className="px-2 pt-1 text-xs font-bold text-espresso">Your panels</p>
        {isLoading && <p className={`px-2 py-1.5 text-xs ${MUTED}`}>Loading your panels…</p>}
        {!isLoading && panels.length === 0 && (
          <p className={`px-2 py-1.5 text-xs ${MUTED}`}>
            Every saved panel is on your dashboard. Build more from a project&apos;s Overview.
          </p>
        )}
        <ul className="flex flex-col">
          {panels.map((panel) => (
            <li key={panel.id}>
              <button
                type="button"
                onClick={() => onAddPanel(panel.id)}
                aria-label={`Add ${panel.name}`}
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-cream focus-visible:outline-2 focus-visible:outline-gold"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-espresso">
                    {panel.name}
                  </span>
                  <span className={`block truncate text-[11px] ${MUTED}`}>
                    {panel.project.name}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold text-espresso">
                  {panel.value === null ? '—' : panelValue(panel)}
                </span>
                <Plus className="size-4 shrink-0 text-clay" strokeWidth={2} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function AddWidgetTray({ hidden, onAdd, panels, panelsLoading, onAddPanel }: TrayProps) {
  const builtins = hidden.filter(
    (widget): widget is WidgetState & { id: BuiltinWidgetId } => !isPanelWidget(widget.id),
  );

  return (
    <section
      aria-label="Add widget"
      className="rounded-xl border border-dashed border-line-strong p-4"
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-espresso">
        <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        Add widget
      </h2>
      <p className={`mb-3 mt-1 text-xs ${MUTED}`}>
        Drag a tile onto the dashboard to put the widget where you want it, or click to add it at
        the end.
      </p>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {builtins.map((widget) => {
          const meta = WIDGET_META[widget.id];
          return (
            <li key={widget.id}>
              <button
                type="button"
                draggable
                onClick={() => onAdd(widget.id)}
                onDragStart={(event) => {
                  event.dataTransfer.setData(ADD_WIDGET_MIME, widget.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                aria-label={`Add ${meta.title}`}
                className={`${TRAY_TILE} cursor-grab active:cursor-grabbing`}
              >
                <WidgetThumbnail kind={meta.thumbnail} />
                {meta.title}
              </button>
            </li>
          );
        })}
        <li>
          <YourPanelsTile panels={panels} isLoading={panelsLoading} onAddPanel={onAddPanel} />
        </li>
      </ul>
    </section>
  );
}

/** Drag payload type for tiles dragged out of the add tray onto the grid. */
const ADD_WIDGET_MIME = 'application/x-unilogs-widget';

/** The nearest ancestor that scrolls, or null. Used to keep a drag reachable. */
function findScrollParent(from: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = from;
  while (node) {
    if (node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

type DashboardGridProps = {
  widgets: WidgetState[];
  customising: boolean;
  isDesktop: boolean;
  ctx: DashboardCtx;
  onMove: (activeId: WidgetId, overId: WidgetId) => void;
  onAddAt: (id: WidgetId, overId: WidgetId) => void;
  onMoveBy: (id: WidgetId, delta: -1 | 1) => void;
  onToggle: (id: WidgetId) => void;
  onResize: (id: WidgetId) => void;
};

export function DashboardGrid({
  widgets,
  customising,
  isDesktop,
  ctx,
  onMove,
  onAddAt,
  onMoveBy,
  onToggle,
  onResize,
}: DashboardGridProps) {
  const [draggingId, setDraggingId] = useState<WidgetId | null>(null);
  const dragRef = useRef<WidgetId | null>(null);

  const blocks = useMemo(() => toBlocks(widgets, isDesktop), [widgets, isDesktop]);

  const handleDragStart = useCallback((id: WidgetId) => {
    dragRef.current = id;
    setDraggingId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
    setDraggingId(null);
  }, []);

  const handleDrop = useCallback(
    (overId: WidgetId, event: DragEvent<HTMLDivElement>) => {
      // A tile dragged from the tray carries the widget it's adding, so a new
      // widget can land on a specific spot instead of always going to the end.
      const addId = event.dataTransfer.getData(ADD_WIDGET_MIME);
      if (addId) {
        onAddAt(addId as WidgetId, overId);
        dragRef.current = null;
        setDraggingId(null);
        return;
      }
      const activeId = dragRef.current;
      if (activeId) onMove(activeId, overId);
      dragRef.current = null;
      setDraggingId(null);
    },
    [onMove, onAddAt],
  );

  // Native drags suspend page scrolling, so nudge the nearest scroller near
  // the top/bottom edge to keep a drag to a far widget reachable.
  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    const scroller = findScrollParent(event.currentTarget);
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    const EDGE = 48;
    if (event.clientY < rect.top + EDGE) scroller.scrollTop -= 20;
    else if (event.clientY > rect.bottom - EDGE) scroller.scrollTop += 20;
  }, []);

  const renderFrame = (widget: WidgetState) => (
    <WidgetFrame
      key={widget.id}
      widget={widget}
      title={widgetTitle(widget.id, ctx)}
      customising={customising}
      isDragging={draggingId === widget.id}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDropOn={handleDrop}
      onMoveBy={onMoveBy}
      onToggle={onToggle}
      onResize={onResize}
    >
      <WidgetContent id={widget.id} size={widget.size} ctx={ctx} />
    </WidgetFrame>
  );

  return (
    <div className={`flex flex-col ${customising ? 'gap-6' : 'gap-4'}`} onDragOver={handleDragOver}>
      {blocks.map((block) =>
        block.kind === 'row' ? (
          renderFrame(block.widget)
        ) : (
          <div
            key={`columns-${block.left[0].id}`}
            className={`grid grid-cols-2 items-start ${customising ? 'gap-6' : 'gap-4'}`}
          >
            <div className={`flex flex-col ${customising ? 'gap-6' : 'gap-4'}`}>
              {block.left.map(renderFrame)}
            </div>
            <div className={`flex flex-col ${customising ? 'gap-6' : 'gap-4'}`}>
              {block.right.map(renderFrame)}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
