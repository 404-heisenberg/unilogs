import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, Check, Clock, Download, Hash, Type, type LucideIcon } from 'lucide-react';
import {
  dayKey,
  entriesLabel,
  entryMeta,
  entryPreview,
  formatMinutes,
  groupEntriesByDay,
  insightDisplay,
  normaliseInsights,
  relativeDay,
  tagStyle,
  type Insight,
  type SharedReport,
} from '@/lib/sharedReport';

// Public page: no auth, no app shell, no editor code. Keep imports light.
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

type State =
  | { status: 'loading' }
  | { status: 'ready'; report: SharedReport }
  | { status: 'gone' }
  | { status: 'error'; message: string };

const DOWNLOAD_BUTTON =
  'inline-flex items-center gap-1 rounded-md border border-[#d4a373]/60 bg-white px-2 py-1 text-[10px] font-medium text-[#1c0d06] transition-colors hover:bg-[#F5EBE0] md:text-[11px]';

const CARD_LABEL = 'text-[10px] font-medium uppercase tracking-[0.08em] text-[#7a5230]';

const FIELD_ICONS: Record<string, LucideIcon> = {
  duration: Clock,
  number: Hash,
  text: Type,
  boolean: Check,
  date: CalendarDays,
};

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-5 items-center justify-center rounded bg-[#D4A843] text-[9px] font-bold text-[#1c0d06]">
        UL
      </span>
      <span className="text-sm font-semibold">UniLogs</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#F5EBE0] px-3 py-2.5">
      <p className={CARD_LABEL}>{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#1c0d06]">{value}</p>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const { value, sub } = insightDisplay(insight);
  const Icon = FIELD_ICONS[insight.fieldType] ?? Hash;
  return (
    <div className="rounded-lg bg-[#F5EBE0] px-3 py-2.5">
      <p className={`flex items-center gap-1.5 ${CARD_LABEL}`}>
        <Icon className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="truncate">{insight.name}</span>
      </p>
      <p className="mt-1.5 text-base font-semibold text-[#1c0d06]">{value}</p>
      <p className="mt-0.5 text-[10px] text-[#7a5230]">{sub}</p>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFCF7] p-6 text-center text-[#1c0d06]">
      <div className="max-w-sm">
        <p className="text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm text-[#7a5230]">{body}</p>
      </div>
    </div>
  );
}

function Report({ report, token }: { report: SharedReport; token: string }) {
  const today = dayKey(new Date().toISOString());
  const insights = normaliseInsights(report.insights);
  const groups = groupEntriesByDay(report.entries, today);
  const updated = new Date(report.dateTo).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const exportUrl = (format: 'csv' | 'md') =>
    `${BASE_URL}/share/${encodeURIComponent(token)}/export?format=${format}`;

  return (
    <div className="min-h-screen bg-[#FFFCF7] text-[#1c0d06]">
      <header className="border-b border-[#EADFCF]">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-3 px-4 py-3 md:px-0">
          <Logo />
          <div className="flex items-center gap-2">
            <a href={exportUrl('csv')} download className={DOWNLOAD_BUTTON}>
              <Download className="h-3 w-3" strokeWidth={1.75} aria-hidden />
              Download CSV
            </a>
            <a href={exportUrl('md')} download className={DOWNLOAD_BUTTON}>
              <Download className="h-3 w-3" strokeWidth={1.75} aria-hidden />
              Download Markdown
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[960px] flex-col gap-5 px-4 py-6 md:px-0 md:py-8">
        <section>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <span className="size-2 shrink-0 rounded-full bg-[#E8813D]" aria-hidden />
            {report.project.name}
          </h1>
          {report.project.description && (
            <p className="mt-1 text-sm text-[#4a3525]">{report.project.description}</p>
          )}
          <p className="mt-1 text-[10px] text-[#a68c73]">
            Last {report.rangeDays} days · {entriesLabel(report.entries.length)} · Updated today,{' '}
            {updated}
          </p>
        </section>

        {report.summary && (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Summary">
            <StatCard label="Entries" value={String(report.summary.entryCount)} />
            <StatCard
              label="Tracked time"
              value={
                report.summary.trackedTimeMinutes === null
                  ? '—'
                  : formatMinutes(report.summary.trackedTimeMinutes)
              }
            />
            <StatCard label="Last logged" value={relativeDay(report.summary.lastLoggedAt, today)} />
            <StatCard label="This week" value={String(report.summary.entriesThisWeek)} />
          </section>
        )}

        {insights.length > 0 && (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Field insights">
            {insights.map((insight) => (
              <InsightCard key={insight.name} insight={insight} />
            ))}
          </section>
        )}

        <section aria-label="Entries" className="flex flex-col gap-4">
          {groups.length === 0 && (
            <p className="text-sm text-[#7a5230]">No entries in this period.</p>
          )}
          {groups.map((group) => (
            <div key={group.day} className="flex flex-col gap-2">
              <h2 className="text-[10px] font-medium tracking-[0.08em] text-[#a68c73]">
                {group.label}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.entries.map((entry) => {
                  const preview = entryPreview(entry);
                  const meta = entryMeta(entry, report.fields);
                  return (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-2 rounded-lg bg-[#F5EBE0] px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {entry.title?.trim() || 'Untitled entry'}
                        </p>
                        {preview && <p className="truncate text-xs text-[#7a5230]">{preview}</p>}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-[#4a3525]">
                        {entry.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tagStyle(tag)}`}
                          >
                            {tag}
                          </span>
                        ))}
                        {meta && <span>{meta}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();

    const load = async () => {
      try {
        if (import.meta.env.DEV && token === 'demo') {
          const { demoReport } = await import('@/lib/sharedReportDemo');
          setState({ status: 'ready', report: demoReport() });
          return;
        }
        const response = await fetch(`${BASE_URL}/share/${encodeURIComponent(token)}`, {
          signal: controller.signal,
        });
        if (response.status === 404) {
          setState({ status: 'gone' });
          return;
        }
        if (response.status === 429) {
          setState({ status: 'error', message: 'Too many requests. Try again in a moment.' });
          return;
        }
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        setState({ status: 'ready', report: (await response.json()) as SharedReport });
      } catch {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: 'Couldn’t load this report. Try again later.' });
      }
    };

    void load();
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (state.status === 'ready') {
      document.title = `${state.report.project.name} — UniLogs report`;
    }
  }, [state]);

  if (state.status === 'loading') {
    return <div className="min-h-screen bg-[#FFFCF7]" aria-busy="true" />;
  }
  if (state.status === 'gone') {
    return (
      <Message
        title="This link isn’t available"
        body="It may have been revoked or expired. Ask the person who shared it for a new link."
      />
    );
  }
  if (state.status === 'error') {
    return <Message title="Something went wrong" body={state.message} />;
  }
  return <Report report={state.report} token={token ?? ''} />;
}
