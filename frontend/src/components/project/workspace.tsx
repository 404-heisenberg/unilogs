import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import SkeletonPrimitive from '@/components/Skeleton';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CircleCheck,
  Clock,
  FileText,
  Hash,
  TrendingUp,
  Type,
} from 'lucide-react';
import { FIELD_TYPES, type FieldType } from '@/lib/field-types';
import {
  AGGREGATIONS,
  AGGREGATION_HINT,
  FIELD_TYPE_LABELS,
  dayLabel,
  entryDurationHours,
  entryTitle,
  formatDurationHours,
  formatShortDate,
  isFieldType,
  type AggregationKind,
  type FieldActions,
  type FieldInsight,
  type ProjectActions,
  type ProjectSummary,
  type TabId,
  type UnfinishedItem,
  type UnfinishedStats,
  type WeekBar,
} from '@/lib/project-workspace';
import type { Entry, FieldDefinition, Project, StatPanel } from '@/types';
import { projectColor } from '@/lib/colors';
import StatPanelBuilderDialog from '@/components/project/StatPanelBuilderDialog';
import { SavedStatPanels } from '@/components/project/StatPanelCard';

const CARD = 'rounded-xl border border-cream bg-paper';
const LABEL = 'text-[11px] font-bold uppercase text-clay';
const SECTION_HEADING = 'text-base font-bold text-espresso';
const MUTED = 'text-clay';
const INPUT =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-espresso outline-none focus:ring-2 focus:ring-gold';
const DARK_BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-espresso px-4 text-[13px] font-semibold text-cream transition-colors hover:bg-deep md:min-h-9 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';
const OUTLINE_BUTTON =
  'inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line-strong px-3 text-[13px] font-medium text-espresso transition-colors hover:bg-cream md:min-h-9 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';
const LINK_BUTTON =
  'rounded px-1.5 py-0.5 text-xs font-medium text-cocoa transition-colors hover:text-espresso hover:underline disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-gold';
const DANGER_BUTTON =
  'inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-danger-soft px-3 text-[13px] font-medium text-danger-text transition-opacity hover:opacity-90 md:min-h-9 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'entries', label: 'Entries' },
  { id: 'fields', label: 'Fields' },
];

const INSIGHT_ICONS: Record<FieldType, typeof Clock> = {
  duration: Clock,
  number: Hash,
  text: Type,
  boolean: CircleCheck,
  date: CalendarDays,
};

function Skeleton({ rows = 2 }: { rows?: number }) {
  return (
    <SkeletonPrimitive rows={rows} barClassName="h-14 rounded-xl bg-cream/60" className="gap-3" />
  );
}

function ErrorNote({ children }: { children: string }) {
  return (
    <div className="rounded-xl border border-danger-soft bg-danger-soft p-4 text-sm text-error">
      {children}
    </div>
  );
}

export function TabBar({ tab, onChange }: { tab: TabId; onChange: (tab: TabId) => void }) {
  return (
    <div role="tablist" aria-label="Project sections" className="flex gap-6 border-b border-cream">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`tab-${id}`}
          aria-selected={tab === id}
          aria-controls={`panel-${id}`}
          onClick={() => onChange(id)}
          className={`-mb-px min-h-11 flex-1 border-b-2 px-1 pb-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-gold md:min-h-0 md:flex-none ${
            tab === id
              ? 'border-gold font-bold text-espresso'
              : `border-transparent ${MUTED} hover:text-espresso`
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ tab, children }: { tab: TabId; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
      {children}
    </div>
  );
}

function SummaryCards({ summary, today }: { summary: ProjectSummary | undefined; today: string }) {
  const tracked =
    summary?.trackedTimeMinutes == null
      ? '—'
      : formatDurationHours(summary.trackedTimeMinutes / 60);
  const lastLogged = summary?.lastLoggedAt
    ? dayLabel(summary.lastLoggedAt.slice(0, 10), today)
    : '—';
  const thisWeek = summary
    ? `${summary.entriesThisWeek} ${summary.entriesThisWeek === 1 ? 'entry' : 'entries'}`
    : '—';

  // `numeric` drives the visual hierarchy: the two headline figures get the
  // large display size, while the date and count-as-words values are set
  // smaller so a row of mixed value types doesn't read as four equal numbers.
  // Explicit flag rather than inspecting the string — the caller already knows.
  const cards = [
    {
      label: 'Entries',
      value: summary ? String(summary.entryCount) : '—',
      Icon: FileText,
      numeric: true,
    },
    { label: 'Tracked', value: tracked, Icon: Clock, numeric: true },
    { label: 'Last logged', value: lastLogged, Icon: CalendarDays, numeric: false },
    { label: 'This week', value: thisWeek, Icon: TrendingUp, numeric: false },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ label, value, Icon, numeric }) => (
        <div key={label} className={`${CARD} p-4`}>
          <div className="flex items-center justify-between">
            <dt className={LABEL}>{label}</dt>
            <Icon className="size-4.5 text-cocoa" strokeWidth={1.75} aria-hidden />
          </div>
          <dd
            title={value}
            className={`mt-2 truncate ${
              numeric
                ? 'text-[28px] leading-9 font-bold text-espresso'
                : 'text-lg leading-8 font-semibold text-espresso'
            }`}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Figma's Mood bar: one segment per answer, sized by count.
const DISTRIBUTION_COLORS = [
  'bg-gold',
  'bg-line-strong',
  'bg-success',
  'bg-caramel',
  'bg-data-plum',
];

function DistributionBar({ items }: { items: { value: string; count: number }[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
  return (
    <div
      className="mt-2 flex h-1.5 gap-0.5"
      role="img"
      aria-label={items.map((item) => `${item.value}: ${item.count}`).join(', ')}
    >
      {items.map((item, index) => (
        <span
          key={item.value}
          className={`rounded-[2px] ${DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]}`}
          style={{ width: `${(item.count / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function InsightCard({ insight }: { insight: FieldInsight }) {
  const Icon = INSIGHT_ICONS[insight.fieldType];
  const TrendIcon = insight.trend === 'down' ? ArrowDownRight : ArrowUpRight;

  return (
    <li className={`${CARD} p-3.5`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`truncate ${LABEL}`}>{insight.name}</p>
        <Icon className="size-4.5 shrink-0 text-cocoa" strokeWidth={1.75} aria-hidden />
      </div>
      {insight.value === null ? (
        <p className={`mt-2 text-sm ${MUTED}`}>No data yet</p>
      ) : insight.distribution ? (
        <>
          <p className="mt-1.5 line-clamp-2 text-base leading-5 font-bold text-espresso">
            {insight.value}
          </p>
          <DistributionBar items={insight.distribution} />
        </>
      ) : (
        <>
          <p className="mt-1.5 truncate text-2xl font-bold text-espresso">{insight.value}</p>
          <p
            className={`mt-1 flex items-center gap-1 text-[11px] ${
              insight.trend === 'up' ? 'text-success' : 'text-cocoa'
            }`}
          >
            {insight.sub}
            {insight.trend && (
              <TrendIcon
                className="h-3 w-3"
                strokeWidth={2}
                aria-label={insight.trend === 'up' ? 'Trending up' : 'Trending down'}
              />
            )}
          </p>
        </>
      )}
    </li>
  );
}

function dueLabel(item: UnfinishedItem, group: 'overdue' | 'week' | 'none'): string {
  if (group === 'none' || !item.dueDate) return '';
  const due = formatShortDate(item.dueDate.slice(0, 10));
  return group === 'overdue' ? `Overdue · due ${due}` : `Due this week · ${due}`;
}

function StillOpen({
  stats,
  isLoading,
  isError,
  markFailed,
  onMarkDone,
}: {
  stats: UnfinishedStats | undefined;
  isLoading: boolean;
  isError: boolean;
  markFailed: boolean;
  onMarkDone: (item: UnfinishedItem) => void;
}) {
  const rows = stats
    ? [
        ...stats.overdue.map((item) => ({ item, group: 'overdue' as const })),
        ...stats.dueThisWeek.map((item) => ({ item, group: 'week' as const })),
        ...stats.noDueDate.map((item) => ({ item, group: 'none' as const })),
      ]
    : [];
  const overdueCount = stats?.overdue.length ?? 0;

  return (
    <section aria-labelledby="still-open-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="still-open-heading" className={SECTION_HEADING}>
          Still open
        </h2>
        {stats && rows.length > 0 && (
          <p className={`text-xs ${overdueCount > 0 ? 'text-error' : MUTED}`}>
            {rows.length} open{overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
          </p>
        )}
      </div>
      {isLoading && <Skeleton rows={2} />}
      {isError && <p className={`text-sm ${MUTED}`}>Couldn't load open items.</p>}
      {stats && rows.length === 0 && (
        <p className={`text-sm ${MUTED}`}>
          Nothing outstanding — every tracked item in this project has been marked done.
        </p>
      )}
      {rows.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rows.map(({ item, group }) => (
            <li key={`${item.entryId}-${item.fieldName}`} className="flex items-start gap-3">
              <button
                type="button"
                role="checkbox"
                aria-checked="false"
                aria-label={`Mark ${item.label} done`}
                onClick={() => onMarkDone(item)}
                className={`mt-0.5 size-3.5 shrink-0 rounded-[3px] border-[1.5px] bg-white transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                  group === 'overdue' ? 'border-error' : 'border-cocoa'
                }`}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-espresso">
                {item.label}
              </span>
              <span
                className={`shrink-0 text-xs font-medium ${group === 'overdue' ? 'text-error' : 'text-cocoa'}`}
              >
                {dueLabel(item, group)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {markFailed && (
        <p role="alert" className="mt-2 text-xs text-error">
          Couldn't mark that done. Try again.
        </p>
      )}
    </section>
  );
}

function ActivityChart({ bars }: { bars: WeekBar[] }) {
  const max = Math.max(1, ...bars.map((bar) => bar.count));

  return (
    <section aria-labelledby="activity-heading">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="activity-heading" className={SECTION_HEADING}>
          Activity
        </h2>
        <p className={`text-[11px] ${MUTED}`}>Last 8 weeks</p>
      </div>
      <ul className={`${CARD} flex h-41 items-end justify-between gap-1 p-3`}>
        {bars.map((bar, index) => (
          <li
            key={bar.weekStart}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            aria-label={`Week of ${formatShortDate(bar.weekStart)}: ${bar.count} ${
              bar.count === 1 ? 'entry' : 'entries'
            }`}
          >
            <span
              className="w-3 rounded-t-sm bg-caramel"
              style={{ height: `${Math.max(4, (bar.count / max) * 120)}px` }}
            />
            <span className={`text-[10px] ${MUTED}`}>W{index + 1}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecentEntries({ entries, today }: { entries: Entry[]; today: string }) {
  return (
    <section aria-labelledby="recent-heading">
      <div className="mb-4">
        <h2 id="recent-heading" className={SECTION_HEADING}>
          Recent entries
        </h2>
        <span className="mt-1 block h-1 w-12 rounded-sm bg-gold-light" aria-hidden />
      </div>
      {entries.length === 0 ? (
        <p className={`text-sm ${MUTED}`}>Entries you log will show up here.</p>
      ) : (
        <ul className="flex flex-col">
          {entries.map((entry) => (
            <li key={entry.id} className="border-b border-cream last:border-b-0">
              <Link
                to={`/entries/${entry.id}`}
                className="flex min-h-11 items-center justify-between gap-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-gold"
              >
                <span className="min-w-0 truncate font-semibold text-espresso">
                  {entryTitle(entry)}
                </span>
                <span className={`shrink-0 text-[13px] ${MUTED}`}>
                  {dayLabel(entry.date.slice(0, 10), today)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type OverviewProps = {
  projectId: string;
  fields: FieldDefinition[];
  today: string;
  summary: ProjectSummary | undefined;
  insights: FieldInsight[];
  insightsLoading: boolean;
  insightsError: boolean;
  bars: WeekBar[];
  recent: Entry[];
  entriesLoading: boolean;
  entriesError: boolean;
  unfinished: {
    stats: UnfinishedStats | undefined;
    isLoading: boolean;
    isError: boolean;
  };
  markFailed: boolean;
  onMarkDone: (item: UnfinishedItem) => void;
};

export function OverviewTab({
  projectId,
  fields,
  today,
  summary,
  insights,
  insightsLoading,
  insightsError,
  bars,
  recent,
  entriesLoading,
  entriesError,
  unfinished,
  markFailed,
  onMarkDone,
}: OverviewProps) {
  const [builder, setBuilder] = useState<{ open: boolean; panel: StatPanel | null }>({
    open: false,
    panel: null,
  });

  return (
    <div className="flex flex-col gap-8">
      <SummaryCards summary={summary} today={today} />

      <section aria-labelledby="insights-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="insights-heading" className={SECTION_HEADING}>
            Field insights
          </h2>
          <button
            type="button"
            onClick={() => setBuilder({ open: true, panel: null })}
            className={LINK_BUTTON}
          >
            Add stat panel
          </button>
        </div>
        {insightsLoading && <Skeleton rows={1} />}
        {insightsError && (
          <ErrorNote>Failed to load field insights. Try refreshing the page.</ErrorNote>
        )}
        {!insightsLoading && !insightsError && insights.length === 0 && (
          <p className={`text-sm ${MUTED}`}>Add fields to see insights for this project.</p>
        )}
        {insights.length > 0 && !insightsLoading && !insightsError && (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {insights.map((insight) => (
              <InsightCard key={insight.fieldId} insight={insight} />
            ))}
          </ul>
        )}
      </section>

      <SavedStatPanels
        projectId={projectId}
        fields={fields}
        onEdit={(panel) => setBuilder({ open: true, panel })}
      />

      <StillOpen
        stats={unfinished.stats}
        isLoading={unfinished.isLoading}
        isError={unfinished.isError}
        markFailed={markFailed}
        onMarkDone={onMarkDone}
      />

      {entriesLoading && <Skeleton rows={3} />}
      {entriesError && <ErrorNote>Failed to load entries. Try refreshing the page.</ErrorNote>}
      {!entriesLoading && !entriesError && (
        <div className="grid gap-8 lg:grid-cols-2">
          <ActivityChart bars={bars} />
          <RecentEntries entries={recent} today={today} />
        </div>
      )}

      <StatPanelBuilderDialog
        open={builder.open}
        onOpenChange={(open) => setBuilder((prev) => ({ ...prev, open }))}
        projectId={projectId}
        fields={fields}
        panel={builder.panel}
      />
    </div>
  );
}

const ENTRIES_STEP = 20;
const ENTRIES_FIRST = 8;

export function EntriesTab({
  entries,
  fields,
  isLoading,
  isError,
  today,
}: {
  entries: Entry[];
  fields: FieldDefinition[];
  isLoading: boolean;
  isError: boolean;
  today: string;
}) {
  const [shown, setShown] = useState(ENTRIES_FIRST);

  if (isLoading) return <Skeleton rows={3} />;
  if (isError) return <ErrorNote>Failed to load entries. Try refreshing the page.</ErrorNote>;
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-white/40 p-10 text-center">
        <p className="text-sm text-cocoa">No entries logged for this project yet.</p>
        <Link to="/entries/new" className={`${DARK_BUTTON} mt-4`}>
          Log an entry
        </Link>
      </div>
    );
  }

  const remaining = entries.length - shown;

  return (
    <div>
      <ul className="flex flex-col">
        {entries.slice(0, shown).map((entry) => {
          const hours = entryDurationHours(entry, fields);
          const day = dayLabel(entry.date.slice(0, 10), today);
          const duration = hours !== null ? formatDurationHours(hours) : null;
          return (
            <li key={entry.id} className="border-b border-cream last:border-b-0">
              {/* Figma: one compact line on desktop; on mobile the date and
                  duration sit under the title. */}
              <Link
                to={`/entries/${entry.id}`}
                className="flex flex-col gap-1 py-4 focus-visible:outline-2 focus-visible:outline-gold sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-3"
              >
                <span className="min-w-0 truncate text-sm text-espresso">{entryTitle(entry)}</span>
                <span className="flex shrink-0 gap-2 text-xs text-clay sm:gap-3">
                  <span className="sm:order-2">{day}</span>
                  {duration && (
                    <>
                      <span aria-hidden className="sm:hidden">
                        ·
                      </span>
                      <span className="sm:order-1">{duration}</span>
                    </>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setShown((count) => count + ENTRIES_STEP)}
          className={`mt-3 w-full py-2 text-center text-xs ${MUTED} hover:text-espresso`}
        >
          {remaining} more {remaining === 1 ? 'entry' : 'entries'}
        </button>
      )}
    </div>
  );
}

function FieldRow({ field, actions }: { field: FieldDefinition; actions: FieldActions }) {
  const fieldType: FieldType = isFieldType(field.fieldType) ? field.fieldType : 'text';
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(field.name);
  const [type, setType] = useState<FieldType>(fieldType);
  const aggregatable = fieldType === 'duration' || fieldType === 'number';

  const startEdit = () => {
    setName(field.name);
    setType(fieldType);
    setEditing(true);
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const nameChanged = trimmed !== field.name;
    const typeChanged = type !== fieldType;
    if (nameChanged || typeChanged) {
      actions.update({
        id: field.id,
        previousName: field.name,
        ...(nameChanged ? { name: trimmed } : {}),
        ...(typeChanged ? { fieldType: type } : {}),
      });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <li>
        <form onSubmit={save} className="flex flex-wrap items-center gap-2 py-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label={`Name for ${field.name}`}
            className={`${INPUT} min-w-[8rem] flex-1`}
            required
          />
          <select
            value={type}
            onChange={(event) => setType(event.target.value as FieldType)}
            aria-label={`Type for ${field.name}`}
            className={`${INPUT} w-auto`}
          >
            {FIELD_TYPES.map((option) => (
              <option key={option} value={option}>
                {FIELD_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
          <button type="submit" className={DARK_BUTTON}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className={LINK_BUTTON}>
            Cancel
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-cream py-2.5 last:border-b-0">
      <span className="min-w-[8rem] flex-1 truncate text-sm text-espresso">{field.name}</span>
      <span className="w-24 rounded bg-cream py-1 text-center text-[11px] text-cocoa">
        {FIELD_TYPE_LABELS[fieldType]}
      </span>
      {aggregatable && (
        <select
          value={field.aggregationOverride ?? 'sum'}
          onChange={(event) =>
            actions.update({
              id: field.id,
              previousName: field.name,
              aggregationOverride: event.target.value as AggregationKind,
            })
          }
          aria-label={`Aggregation for ${field.name}`}
          title={AGGREGATION_HINT[field.aggregationOverride ?? 'sum']}
          className="w-24 rounded bg-cream py-1 text-center text-[11px] text-cocoa outline-none focus:ring-2 focus:ring-espresso"
        >
          {AGGREGATIONS.map(({ kind, label }) => (
            <option key={kind} value={kind}>
              {label}
            </option>
          ))}
        </select>
      )}
      <span className="flex gap-1">
        <button
          type="button"
          onClick={startEdit}
          aria-label={`Edit ${field.name}`}
          className={LINK_BUTTON}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => actions.remove(field.id)}
          disabled={actions.deletingId === field.id}
          aria-label={`Delete ${field.name}`}
          className={`${LINK_BUTTON} text-error`}
        >
          {actions.deletingId === field.id ? 'Deleting…' : 'Delete'}
        </button>
      </span>
    </li>
  );
}

export function FieldsTab({
  fields,
  isLoading,
  isError,
  actions,
}: {
  fields: FieldDefinition[];
  isLoading: boolean;
  isError: boolean;
  actions: FieldActions;
}) {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FieldType>(FIELD_TYPES[0]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    actions.create({ name: trimmed, fieldType: newType });
    setNewName('');
    setNewType(FIELD_TYPES[0]);
  };

  return (
    <div>
      {isLoading && <Skeleton rows={2} />}
      {isError && <ErrorNote>Failed to load fields. Try refreshing the page.</ErrorNote>}
      {!isLoading && !isError && fields.length === 0 && (
        <div className="rounded-xl border border-dashed border-line bg-white/40 p-10 text-center">
          <p className="text-sm text-cocoa">
            No fields yet. Add your first field below to define what an entry for this project looks
            like.
          </p>
        </div>
      )}
      {fields.length > 0 && (
        <>
          <p className={`mb-3 ${MUTED}`}>
            Number and duration fields are combined into a single number on this project&apos;s
            Insights tab. Choose how each one is combined.
          </p>
          {/* Figma's table header; rows below line up with it. */}
          <div
            aria-hidden
            className={`hidden gap-3 border-b border-cream pb-2 sm:flex ${LABEL} normal-case`}
          >
            <span className="flex-1">Name</span>
            <span className="w-24 text-center">Type</span>
            <span className="w-24 text-center">Insight</span>
            <span className="w-24">Actions</span>
          </div>
          <ul className="flex flex-col">
            {fields.map((field) => (
              <FieldRow key={field.id} field={field} actions={actions} />
            ))}
          </ul>
        </>
      )}

      <form onSubmit={submit} className="mt-6 flex flex-wrap items-center gap-2">
        <div className="min-w-[10rem] flex-1 sm:max-w-52">
          <label htmlFor="new-field-name" className="sr-only">
            Field name
          </label>
          <input
            id="new-field-name"
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Field name"
            className={INPUT}
            required
          />
        </div>
        <div>
          <label htmlFor="new-field-type" className="sr-only">
            Type
          </label>
          <select
            id="new-field-type"
            value={newType}
            onChange={(event) => setNewType(event.target.value as FieldType)}
            className={`${INPUT} w-auto`}
          >
            {FIELD_TYPES.map((option) => (
              <option key={option} value={option}>
                {FIELD_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={actions.creating} className={DARK_BUTTON}>
          {actions.creating ? 'Adding…' : 'Add field'}
        </button>
      </form>
    </div>
  );
}

export function MetadataPanel({
  project,
  fieldCount,
  actions,
  onExport,
  onShare,
  onDelete,
}: {
  project: Project;
  fieldCount: number | undefined;
  actions: ProjectActions;
  onExport: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');

  const startEdit = () => {
    setName(project.name);
    setDescription(project.description ?? '');
    setEditing(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    actions.save({ name: trimmed, description: description.trim() }, () => setEditing(false));
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs font-bold text-clay uppercase">Metadata</p>
      <div>
        <p className="flex items-center gap-2 text-lg font-bold text-espresso">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: projectColor(project.id) }}
            aria-hidden
          />
          <span className="truncate">{project.name}</span>
        </p>
        {project.description && (
          <p className={`mt-2 text-[13px] ${MUTED}`}>{project.description}</p>
        )}
      </div>
      <dl className="flex justify-between border-y border-cream py-5 text-[13px]">
        <dt className={MUTED}>Fields</dt>
        <dd className="font-medium text-espresso">
          {fieldCount === undefined
            ? '—'
            : `${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'}`}
        </dd>
      </dl>

      <div>
        <p className="text-xs font-bold text-clay uppercase">Actions</p>
        <div className="mt-3 flex flex-col gap-2">
          {editing ? (
            <form onSubmit={submit} className="flex flex-col gap-2">
              <label htmlFor="project-name" className="text-xs text-cocoa">
                Project name
              </label>
              <input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={INPUT}
                required
              />
              <label htmlFor="project-description" className="text-xs text-cocoa">
                Description
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className={INPUT}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={actions.saving} className={DARK_BUTTON}>
                  {actions.saving ? 'Saving…' : 'Save details'}
                </button>
                <button type="button" onClick={() => setEditing(false)} className={LINK_BUTTON}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={startEdit} className={OUTLINE_BUTTON}>
              Edit details
            </button>
          )}
          <button
            type="button"
            onClick={() => actions.toggleArchive(project.archived)}
            disabled={actions.archiving}
            className={OUTLINE_BUTTON}
          >
            {project.archived ? 'Unarchive project' : 'Archive project'}
          </button>
          {/* On desktop these live in the page header, as in Figma. */}
          <button type="button" onClick={onExport} className={`${OUTLINE_BUTTON} lg:hidden`}>
            Export…
          </button>
          <button type="button" onClick={onShare} className={`${OUTLINE_BUTTON} lg:hidden`}>
            Share report…
          </button>
          <button type="button" onClick={onDelete} className={DANGER_BUTTON}>
            Delete project
          </button>
        </div>
      </div>
    </div>
  );
}
