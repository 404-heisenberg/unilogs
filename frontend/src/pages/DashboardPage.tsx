import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Flame, Folder, Award } from 'lucide-react';
import { api, getStatsSummary, getFrequencyStats } from '../lib/api';
import { formatRelativeTime } from '@/lib/time';
import type { PagedEntries } from '@/types';

const BAR_COLORS = ['#d4a843', '#4d9b8f', '#c1666b', '#7c9c6b', '#8a7ca8'];

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const startRef = useState<{ v: number | null }>({ v: null })[0];

  useState(() => {
    let raf: number;
    const step = (ts: number) => {
      if (startRef.v === null) startRef.v = ts;
      const progress = Math.min((ts - startRef.v) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });

  return value;
}

function heatColor(count: number, max: number) {
  if (count === 0) return 'bg-[#e8e0d8]';
  const ratio = count / max;
  if (ratio <= 0.25) return 'bg-[#faf0e6]';
  if (ratio <= 0.5) return 'bg-[#e6d4c3]';
  if (ratio <= 0.75) return 'bg-[#d4a373]';
  return 'bg-[#d4a843]';
}

export default function DashboardPage() {
  const [hoveredWeek, setHoveredWeek] = useState<{ weekStart: string; count: number } | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['stats-summary'],
    queryFn: getStatsSummary,
  });

  const frequencyQuery = useQuery({
    queryKey: ['stats-frequency'],
    queryFn: getFrequencyStats,
  });

  const recentEntriesQuery = useQuery({
    queryKey: ['entries', 'recent'],
    queryFn: () => api.get<PagedEntries>('/api/entries?limit=5'),
  });
  const recentEntries = recentEntriesQuery.data?.entries ?? [];
  const lastEntry = recentEntries[0];

  const summary = summaryQuery.data;
  const hasEntries = !!summary && summary.totalHours > 0 && summary.perProject.length > 0;
  const topProject = hasEntries
    ? [...summary!.perProject].sort((a, b) => b.totalHours - a.totalHours)[0]
    : null;

  const streakCount = useCountUp(summary?.streak ?? 0);
  const totalHoursCount = useCountUp(summary?.totalHours ?? 0);
  const topHoursCount = useCountUp(topProject?.totalHours ?? 0);

  if (summaryQuery.isLoading || frequencyQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[#f5ebe0]" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="h-52 animate-pulse rounded-2xl bg-[#f5ebe0] md:col-span-2" />
          <div className="h-52 animate-pulse rounded-2xl bg-[#f5ebe0] md:col-span-1" />
          <div className="h-52 animate-pulse rounded-2xl bg-[#f5ebe0] md:col-span-2" />
        </div>
        <div className="h-40 animate-pulse rounded-2xl bg-[#f5ebe0]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[#f5ebe0]" />
      </div>
    );
  }

  if (summaryQuery.isError || frequencyQuery.isError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-[#1c0d06]">Couldn't load your stats</p>
          <p className="mt-1 text-sm text-[#7a5230]">Check your connection and try again.</p>
        </div>
      </div>
    );
  }

  const frequency = frequencyQuery.data!;
  const maxWeekCount = Math.max(1, ...frequency.weekly.map((w) => w.count));

  const RADIUS = 54;
  const CIRC = 2 * Math.PI * RADIUS;
  const ringProgress = Math.min((summary?.streak ?? 0) / 30, 1);

  if (!hasEntries) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#7a5230]">
            Your logbook
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[#1c0d06]">Dashboard</h1>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#d4a843]/15 bg-[#f5ebe0] py-24 text-center">
          <Flame className="mb-4 h-10 w-10 text-[#7a5230]" strokeWidth={1.5} />
          <p className="text-lg font-semibold text-[#1c0d06]">No entries yet</p>
          <p className="mt-1 max-w-xs text-sm text-[#7a5230]">
            Log your first entry to see your hours, streak, and activity here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#7a5230]">
          Your logbook
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-[#1c0d06]">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="group relative overflow-hidden rounded-2xl border border-[#d4a843]/20 bg-gradient-to-br from-[#f5ebe0] to-[#efe0cc] p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#d4a843]/50 hover:shadow-[0_12px_40px_-8px_rgba(212,168,67,0.2)] md:col-span-2">
          <span className="pointer-events-none absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-[#d4a373] transition-colors duration-300 group-hover:border-[#d4a843]" />
          <span className="pointer-events-none absolute right-4 top-4 h-6 w-6 border-r-2 border-t-2 border-[#d4a373] transition-colors duration-300 group-hover:border-[#d4a843]" />
          <span className="pointer-events-none absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-[#d4a373] transition-colors duration-300 group-hover:border-[#d4a843]" />
          <span className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-[#d4a373] transition-colors duration-300 group-hover:border-[#d4a843]" />
          <div className="flex flex-col items-center">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#e8ddd0" strokeWidth="8" />
                <circle
                  cx="60"
                  cy="60"
                  r={RADIUS}
                  fill="none"
                  stroke="#d4a843"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - ringProgress)}
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <Flame
                  className="mb-1 h-5 w-5 text-[#d4a843] transition-transform duration-300 group-hover:scale-110"
                  strokeWidth={1.5}
                />
                <span className="text-3xl font-bold text-[#1c0d06]">{streakCount}</span>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-[#7a5230]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d4a843]" />
              day streak
            </p>
            <p className="mt-1 text-center text-xs text-[#7a5230]/70">
              Log in every day to grow your streak
            </p>
          </div>
        </div>

        <div className="group rounded-2xl border border-[#d4a843]/15 bg-[#f5ebe0] p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#d4a843]/40 hover:bg-[#efe0cc] md:col-span-1">
          <p className="text-sm text-[#7a5230]">Total logged</p>
          <p className="mt-2 text-4xl font-bold text-[#1c0d06]">{totalHoursCount}h</p>
          <div className="mt-4 flex items-center gap-1 text-xs text-[#7a5230]">
            <Award className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>{summary!.perProject.length} projects</span>
          </div>
        </div>

        <div className="group rounded-2xl border border-[#d4a843]/15 bg-[#f5ebe0] p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#d4a843]/40 hover:bg-[#efe0cc] md:col-span-2">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-[#7a5230]" strokeWidth={1.5} />
            <p className="text-sm text-[#7a5230]">Top project</p>
          </div>
          <p className="mt-2 truncate text-2xl font-bold text-[#1c0d06]">
            {topProject!.projectName}
          </p>
          <p className="mt-1 text-sm text-[#7a5230]">{topHoursCount}h logged</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#e8ddd0]">
            <div
              className="h-full rounded-full bg-[#d4a843] transition-all duration-1000"
              style={{ width: `${(topProject!.totalHours / summary!.totalHours) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {lastEntry && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#d4a843]/15 bg-[#f5ebe0] p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="size-2.5 shrink-0 rounded-full bg-[#d4a843]" aria-hidden />
            <div>
              <p className="font-bold text-[#1c0d06]">
                {lastEntry.project?.name ?? 'Continue logging'}
              </p>
              <p className="text-xs text-[#7a5230]">
                Last logged {formatRelativeTime(lastEntry.date)}
              </p>
            </div>
          </div>
          <Link
            to="/entries/new"
            className="flex min-h-11 shrink-0 items-center rounded-full bg-[#d4a843] px-5 text-sm font-semibold text-[#1c0d06] hover:opacity-90"
          >
            Continue Logging
          </Link>
        </div>
      )}

      <div className="rounded-2xl border border-[#d4a843]/15 bg-[#f5ebe0] p-6 shadow-sm transition-colors duration-300 hover:border-[#d4a843]/30">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1c0d06]">Weekly activity</h2>
          <p className="h-5 text-xs text-[#7a5230]">
            {hoveredWeek
              ? `Week of ${hoveredWeek.weekStart} — ${hoveredWeek.count} ${hoveredWeek.count === 1 ? 'entry' : 'entries'}`
              : ''}
          </p>
        </div>
        <div className="grid grid-flow-col gap-1.5 overflow-x-auto pb-2">
          {frequency.weekly.map((week) => (
            <div
              key={week.weekStart}
              tabIndex={0}
              role="button"
              aria-label={`Week of ${week.weekStart}: ${week.count} ${week.count === 1 ? 'entry' : 'entries'}`}
              onMouseEnter={() => setHoveredWeek(week)}
              onMouseLeave={() => setHoveredWeek(null)}
              onFocus={() => setHoveredWeek(week)}
              onBlur={() => setHoveredWeek(null)}
              className={`h-6 w-6 cursor-pointer rounded transition-all duration-150 hover:scale-110 hover:ring-1 hover:ring-[#d4a843] focus:scale-110 focus:outline-none focus:ring-1 focus:ring-[#d4a843] ${heatColor(week.count, maxWeekCount)} ${
                hoveredWeek?.weekStart === week.weekStart ? 'ring-1 ring-[#1c0d06] scale-110' : ''
              }`}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-[#7a5230]">
          <span>Less</span>
          <div className="h-3 w-3 rounded-sm bg-[#e8e0d8]" />
          <div className="h-3 w-3 rounded-sm bg-[#faf0e6]" />
          <div className="h-3 w-3 rounded-sm bg-[#e6d4c3]" />
          <div className="h-3 w-3 rounded-sm bg-[#d4a373]" />
          <div className="h-3 w-3 rounded-sm bg-[#d4a843]" />
          <span>More</span>
        </div>
      </div>

      <div className="rounded-2xl border border-[#d4a843]/15 bg-[#f5ebe0] p-6 shadow-sm transition-colors duration-300 hover:border-[#d4a843]/30">
        <h2 className="mb-4 text-lg font-semibold text-[#1c0d06]">Hours per project</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={summary!.perProject}>
            <CartesianGrid strokeDasharray="3 3" stroke="#7a5230" opacity={0.15} vertical={false} />
            <XAxis dataKey="projectName" stroke="#7a5230" fontSize={12} tickLine={false} />
            <YAxis stroke="#7a5230" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #d4a843',
                background: '#fffcf7',
                color: '#1c0d06',
              }}
              cursor={{ fill: '#d4a843', opacity: 0.1 }}
            />
            <Bar dataKey="totalHours" radius={[8, 8, 0, 0]}>
              {summary!.perProject.map((_, i) => (
                <Cell
                  key={i}
                  fill={BAR_COLORS[i % BAR_COLORS.length]}
                  style={{ transition: 'opacity 0.2s', cursor: 'pointer' }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {recentEntries.length > 0 && (
        <div className="rounded-2xl border border-[#d4a843]/15 bg-[#f5ebe0] p-6 shadow-sm transition-colors duration-300 hover:border-[#d4a843]/30">
          <h2 className="mb-4 text-lg font-semibold text-[#1c0d06]">Recent entries</h2>
          <ul className="flex flex-col gap-3">
            {recentEntries.map((entry) => (
              <li key={entry.id} className="border-b border-[#e8ddd0] pb-3 last:border-0 last:pb-0">
                <Link
                  to={`/entries/${entry.id}`}
                  className="flex min-h-11 items-center justify-between gap-3 py-1"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1c0d06]">
                      {entry.title ?? Object.keys(entry.content)[0] ?? 'Untitled entry'}
                    </p>
                    <p className="text-xs text-[#7a5230]">{entry.project?.name}</p>
                  </div>
                  <p className="shrink-0 text-xs text-[#7a5230]">
                    {formatRelativeTime(entry.date)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
