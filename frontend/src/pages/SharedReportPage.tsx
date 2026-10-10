import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  CircleCheck,
  Clock,
  Download,
  Hash,
  Smile,
  type LucideIcon,
} from 'lucide-react';
import Skeleton from '@/components/Skeleton';
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

// Figma "Share Report" (86:5 desktop, 86:137 mobile).
const DOWNLOAD_BUTTON =
  'inline-flex items-center gap-1 rounded-lg border border-clay px-2.5 py-1.5 text-[10px] font-semibold whitespace-nowrap text-clay transition-colors hover:bg-cream md:px-3 md:py-2 md:text-xs';

const CARD = 'flex flex-col gap-1.5 rounded-xl bg-cream p-3 md:gap-2 md:p-4';
const CARD_LABEL = 'text-[10px] font-semibold text-clay uppercase md:text-[11px]';

const FIELD_ICONS: Record<string, LucideIcon> = {
  duration: Clock,
  number: BookOpen,
  text: Smile,
  boolean: CircleCheck,
  date: Calendar,
};

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded bg-gold px-1.5 py-1 text-xs font-extrabold text-white">UL</span>
      <span className="text-base font-bold">UniLogs</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={CARD}>
      <p className={CARD_LABEL}>{label}</p>
      <p className="text-lg font-bold md:text-xl">{value}</p>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const { value, sub } = insightDisplay(insight);
  const Icon = FIELD_ICONS[insight.fieldType] ?? Hash;
  // The trend arrow is green when rising: the whole line on mobile, only the
  // bold arrow on desktop.
  const arrow = /[↗↘]$/.exec(sub)?.[0];
  const text = arrow ? sub.slice(0, -2) : sub;
  const up = arrow === '↗';
  return (
    <div className={CARD}>
      <Icon className="size-3.5 text-cocoa md:size-4" strokeWidth={1.75} aria-hidden />
      <p className={`truncate ${CARD_LABEL}`}>{insight.name}</p>
      <p className="truncate text-[15px] font-bold md:text-lg">{value}</p>
      <p
        className={`text-[10px] md:text-[11px] ${up ? 'text-success md:text-cocoa' : 'text-cocoa'}`}
      >
        {text}
        {arrow && (
          <span className={`md:font-bold ${up ? 'md:text-success' : 'md:text-error'}`}>
            {' '}
            {arrow}
          </span>
        )}
      </p>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6 text-center text-espresso">
      <div className="max-w-sm">
        <p className="text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm text-clay">{body}</p>
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
    <div className="min-h-screen bg-paper leading-normal text-espresso">
      <header className="border-b border-[#e8ddd0]">
        <div className="mx-auto flex h-14 max-w-[960px] items-center justify-between gap-2 px-4 md:px-0">
          <Logo />
          <div className="flex items-center gap-2">
            <a href={exportUrl('csv')} download className={DOWNLOAD_BUTTON}>
              <Download className="size-3" strokeWidth={2} aria-hidden />
              Download CSV
            </a>
            <a href={exportUrl('md')} download className={DOWNLOAD_BUTTON}>
              <Download className="size-3" strokeWidth={2} aria-hidden />
              Download Markdown
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[960px] flex-col gap-6 p-4 md:gap-8 md:px-0 md:py-10">
        <section className="flex flex-col gap-2 md:gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-[28px]">
            <span className="size-1.5 shrink-0 rounded-full bg-data-orange md:size-2" aria-hidden />
            {report.project.name}
          </h1>
          {report.project.description && (
            <p className="text-sm text-clay md:text-[15px]">{report.project.description}</p>
          )}
          <p className="text-[11px] text-line-strong md:text-xs">
            Last {report.rangeDays} days · {entriesLabel(report.entries.length)} · Updated today,{' '}
            {updated}
          </p>
          {/* Not in Figma: tells the viewer what the link shares (#333). */}
          <p className="text-[11px] text-clay md:text-xs">
            {report.includeBodies
              ? "This report includes every entry's notes (bodies)."
              : "Entry notes (bodies) aren't included — titles and summary data only."}
          </p>
        </section>

        {report.summary && (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-label="Summary">
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
          <section
            className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4"
            aria-label="Field insights"
          >
            {insights.map((insight) => (
              <InsightCard key={insight.name} insight={insight} />
            ))}
          </section>
        )}

        <section aria-label="Entries" className="flex flex-col gap-5 md:gap-6">
          {groups.length === 0 && <p className="text-sm text-clay">No entries in this period.</p>}
          {groups.map((group) => (
            <div key={group.day} className="flex flex-col gap-2 md:gap-3">
              <h2 className="text-[10px] font-bold text-line-strong md:text-[11px]">
                {group.label}
              </h2>
              <ul className="flex flex-col gap-2 md:gap-3">
                {group.entries.map((entry) => {
                  const preview = entryPreview(entry);
                  const meta = entryMeta(entry, report.fields);
                  return (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-2 rounded-xl bg-cream p-3 md:flex-row md:items-center md:justify-between md:gap-4 md:p-4"
                    >
                      <div className="flex min-w-0 flex-col gap-2 md:w-[500px] md:gap-1">
                        <p className="truncate text-sm font-semibold md:text-[15px]">
                          {entry.title?.trim() || 'Untitled entry'}
                        </p>
                        {preview && (
                          <p className="truncate text-xs text-clay md:text-[13px]">{preview}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 md:shrink-0 md:gap-4">
                        <div className="flex flex-wrap gap-1">
                          {entry.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`rounded px-2 py-0.5 text-[11px] font-semibold ${tagStyle(tag)}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        {meta && (
                          <span className="text-[11px] whitespace-nowrap md:text-[13px] md:font-medium">
                            {meta}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <footer className="pt-4 pb-6 text-center text-[10px] text-line-strong md:pt-6 md:pb-0 md:text-xs">
          Live report — always current. Shared read-only from UniLogs.
        </footer>
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
    return (
      <div className="min-h-screen bg-paper" aria-busy="true">
        <div className="mx-auto max-w-[960px] px-4 py-8">
          <Skeleton rows={1} barClassName="h-6 w-48" className="mb-6" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} rows={1} barClassName="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton rows={4} barClassName="h-16 rounded-lg" className="mt-5" />
        </div>
      </div>
    );
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
