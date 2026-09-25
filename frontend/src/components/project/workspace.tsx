import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
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
import type { Entry, FieldDefinition, Project } from '@/types';

const CARD = 'rounded-xl border border-[#EADFCF] bg-white';
const LABEL = 'text-[11px] font-medium uppercase tracking-[0.08em] text-[#8A7660]';
const MUTED = 'text-[#8A7660]';
const INPUT =
  'w-full rounded-md border border-[#D9C9AE] bg-white px-3 py-2 text-sm text-[#1C0D06] outline-none focus:ring-2 focus:ring-[#D4A843]';
const DARK_BUTTON =
  'inline-flex items-center justify-center rounded-md bg-[#1C0D06] px-3.5 py-2 text-sm font-medium text-[#FFFCF7] transition-colors hover:bg-[#3A2214] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843]';
const OUTLINE_BUTTON =
  'inline-flex w-full items-center justify-center rounded-md border border-[#D9C9AE] bg-white px-3 py-2 text-sm font-medium text-[#1C0D06] transition-colors hover:bg-[#F5EBE0] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843]';
const LINK_BUTTON =
  'rounded px-1.5 py-0.5 text-xs font-medium text-[#5C4630] transition-colors hover:text-[#1C0D06] hover:underline disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[#D4A843]';
const DANGER_BUTTON =
  'inline-flex w-full items-center justify-center rounded-md border border-[#E6B8AE] bg-white px-3 py-2 text-sm font-medium text-[#B5432F] transition-colors hover:bg-[#FBEDE9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843]';

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
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-xl bg-[#EADFCF]/60" />
      ))}
    </div>
  );
}

function ErrorNote({ children }: { children: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {children}
    </div>
  );
}

export function TabBar({ tab, onChange }: { tab: TabId; onChange: (tab: TabId) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Project sections"
      className="flex gap-6 border-b border-[#EADFCF]"
    >
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`tab-${id}`}
          aria-selected={tab === id}
          aria-controls={`panel-${id}`}
          onClick={() => onChange(id)}
          className={`-mb-px border-b-2 px-1 pb-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[#D4A843] ${
            tab === id
              ? 'border-[#D4A843] font-semibold text-[#1C0D06]'
              : `border-transparent ${MUTED} hover:text-[#1C0D06]`
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

  const cards = [
    { label: 'Entries', value: summary ? String(summary.entryCount) : '—', Icon: FileText },
    { label: 'Tracked', value: tracked, Icon: Clock },
    { label: 'Last logged', value: lastLogged, Icon: CalendarDays },
    { label: 'This week', value: thisWeek, Icon: TrendingUp },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ label, value, Icon }) => (
        <div key={label} className={`${CARD} p-4`}>
          <div className="flex items-center justify-between">
            <dt className={LABEL}>{label}</dt>
            <Icon className="h-4 w-4 text-[#B8825C]" strokeWidth={1.75} aria-hidden />
          </div>
          <dd className="mt-2 text-2xl font-semibold text-[#1C0D06]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function InsightCard({ insight }: { insight: FieldInsight }) {
  const Icon = INSIGHT_ICONS[insight.fieldType];
  const TrendIcon = insight.trend === 'down' ? ArrowDownRight : ArrowUpRight;

  return (
    <li className={`${CARD} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`truncate ${LABEL}`}>{insight.name}</p>
        <Icon className="h-4 w-4 shrink-0 text-[#B8825C]" strokeWidth={1.75} aria-hidden />
      </div>
      {insight.value === null ? (
        <p className={`mt-2 text-sm ${MUTED}`}>No data yet</p>
      ) : (
        <>
          <p className="mt-2 truncate text-xl font-semibold text-[#1C0D06]">{insight.value}</p>
          <p
            className={`mt-0.5 flex items-center gap-1 text-[11px] ${
              insight.trend === 'up' ? 'text-[#3E7A52]' : MUTED
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
        <h2 id="still-open-heading" className="text-sm font-semibold text-[#1C0D06]">
          Still open
        </h2>
        {stats && rows.length > 0 && (
          <p className={`text-xs ${overdueCount > 0 ? 'text-[#B5432F]' : MUTED}`}>
            {rows.length} open{overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
          </p>
        )}
      </div>
      {isLoading && <Skeleton rows={2} />}
      {isError && <p className={`text-sm ${MUTED}`}>Couldn't load open items.</p>}
      {stats && rows.length === 0 && <p className={`text-sm ${MUTED}`}>Nothing open.</p>}
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
                className={`mt-0.5 size-4 shrink-0 rounded-[3px] border-[1.5px] bg-white transition-colors hover:bg-[#EBD9A3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843] ${
                  group === 'overdue' ? 'border-[#B5432F]' : 'border-[#5C4630]'
                }`}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#1C0D06]">
                {item.label}
              </span>
              <span
                className={`shrink-0 text-[11px] ${group === 'overdue' ? 'text-[#B5432F]' : MUTED}`}
              >
                {dueLabel(item, group)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {markFailed && (
        <p role="alert" className="mt-2 text-xs text-[#B5432F]">
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
        <h2 id="activity-heading" className="text-sm font-semibold text-[#1C0D06]">
          Activity
        </h2>
        <p className={`text-[11px] ${MUTED}`}>Last 8 weeks</p>
      </div>
      <ul className={`${CARD} flex h-32 items-end justify-between gap-2 p-4`}>
        {bars.map((bar, index) => (
          <li
            key={bar.weekStart}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            aria-label={`Week of ${formatShortDate(bar.weekStart)}: ${bar.count} ${
              bar.count === 1 ? 'entry' : 'entries'
            }`}
          >
            <span
              className="w-2 rounded-t-sm bg-[#D9A97F]"
              style={{ height: `${Math.max(4, (bar.count / max) * 72)}px` }}
            />
            <span className={`text-[9px] ${MUTED}`}>W{index + 1}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecentEntries({ entries, today }: { entries: Entry[]; today: string }) {
  return (
    <section aria-labelledby="recent-heading">
      <h2 id="recent-heading" className="mb-3 text-sm font-semibold text-[#1C0D06]">
        Recent entries
      </h2>
      {entries.length === 0 ? (
        <p className={`text-sm ${MUTED}`}>Entries you log will show up here.</p>
      ) : (
        <ul className="flex flex-col">
          {entries.map((entry) => (
            <li key={entry.id} className="border-b border-[#EADFCF] last:border-b-0">
              <Link
                to={`/entries/${entry.id}`}
                className="flex items-center justify-between gap-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#D4A843]"
              >
                <span className="min-w-0 truncate font-medium text-[#1C0D06]">
                  {entryTitle(entry)}
                </span>
                <span className={`shrink-0 text-xs ${MUTED}`}>
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
  return (
    <div className="flex flex-col gap-8">
      <SummaryCards summary={summary} today={today} />

      <section aria-labelledby="insights-heading">
        <h2 id="insights-heading" className="mb-3 text-sm font-semibold text-[#1C0D06]">
          Field insights
        </h2>
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
      <div className="rounded-xl border border-dashed border-[#D9C9AE] bg-white/40 p-10 text-center">
        <p className="text-sm text-[#4A3525]">No entries logged for this project yet.</p>
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
          const tags = entry.tags ?? [];
          return (
            <li key={entry.id} className="border-b border-[#EADFCF] last:border-b-0">
              <Link
                to={`/entries/${entry.id}`}
                className="flex items-start justify-between gap-4 py-3 focus-visible:outline-2 focus-visible:outline-[#D4A843]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[#1C0D06]">
                    {entryTitle(entry)}
                  </span>
                  {tags.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {tags.map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="rounded-full bg-[#F5EBE0] px-2 py-0.5 text-[11px] text-[#5C4630]"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className={`shrink-0 text-xs ${MUTED}`}>
                  {hours !== null && `${formatDurationHours(hours)} · `}
                  {dayLabel(entry.date.slice(0, 10), today)}
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
          className={`mt-3 w-full py-2 text-center text-xs ${MUTED} hover:text-[#1C0D06]`}
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
    <li className="flex flex-wrap items-center gap-3 border-b border-[#EADFCF] py-3 last:border-b-0">
      <span className="min-w-[8rem] flex-1 truncate text-sm text-[#1C0D06]">{field.name}</span>
      <span className="rounded-full bg-[#F5EBE0] px-2.5 py-0.5 text-[11px] text-[#5C4630]">
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
          className="rounded-md border border-[#D9C9AE] bg-white px-2 py-1 text-xs text-[#1C0D06]"
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
          className={`${LINK_BUTTON} text-[#B5432F]`}
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
        <div className="rounded-xl border border-dashed border-[#D9C9AE] bg-white/40 p-10 text-center">
          <p className="text-sm text-[#4A3525]">
            No fields yet. Add your first field below to define what an entry for this project looks
            like.
          </p>
        </div>
      )}
      {fields.length > 0 && (
        <ul className="flex flex-col">
          {fields.map((field) => (
            <FieldRow key={field.id} field={field} actions={actions} />
          ))}
        </ul>
      )}
      {actions.updateError && <p className="mt-2 text-sm text-red-700">{actions.updateError}</p>}

      <form
        onSubmit={submit}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-[#D9C9AE] bg-white/40 p-4"
      >
        <div className="min-w-[10rem] flex-1">
          <label htmlFor="new-field-name" className="mb-1 block text-sm text-[#4A3525]">
            Field name
          </label>
          <input
            id="new-field-name"
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="e.g. Time spent"
            className={INPUT}
            required
          />
        </div>
        <div>
          <label htmlFor="new-field-type" className="mb-1 block text-sm text-[#4A3525]">
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
      {actions.createError && <p className="mt-2 text-sm text-red-700">{actions.createError}</p>}
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
    <aside aria-label="Project details" className="flex flex-col gap-6">
      <div>
        <p className={LABEL}>Metadata</p>
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#1C0D06]">
          <span className="size-2 shrink-0 rounded-full bg-[#D9A97F]" aria-hidden />
          <span className="truncate">{project.name}</span>
        </p>
        {project.description && <p className={`mt-1 text-xs ${MUTED}`}>{project.description}</p>}
        <dl className="mt-4 flex justify-between text-xs">
          <dt className={MUTED}>Fields</dt>
          <dd className="text-[#1C0D06]">{fieldCount ?? '—'}</dd>
        </dl>
      </div>

      <div>
        <p className={LABEL}>Actions</p>
        <div className="mt-3 flex flex-col gap-2">
          {editing ? (
            <form onSubmit={submit} className="flex flex-col gap-2">
              <label htmlFor="project-name" className="text-xs text-[#4A3525]">
                Project name
              </label>
              <input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={INPUT}
                required
              />
              <label htmlFor="project-description" className="text-xs text-[#4A3525]">
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
          <button type="button" onClick={onExport} className={OUTLINE_BUTTON}>
            Export…
          </button>
          <button type="button" onClick={onShare} className={OUTLINE_BUTTON}>
            Share report…
          </button>
          <button type="button" onClick={onDelete} className={DANGER_BUTTON}>
            Delete project
          </button>
        </div>
        {actions.error && <p className="mt-2 text-xs text-red-700">{actions.error}</p>}
      </div>
    </aside>
  );
}
