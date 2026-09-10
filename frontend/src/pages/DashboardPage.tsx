import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { getStatsSummary, getFrequencyStats } from '../lib/api';

const BAR_COLORS = ['#e8a33d', '#4d9b8f', '#c1666b', '#7c9c6b', '#8a7ca8'];

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
  if (count === 0) return 'bg-white/8';
  const ratio = count / max;
  if (ratio <= 0.25) return 'bg-[#5a4530]';
  if (ratio <= 0.5) return 'bg-[#8a6f4f]';
  if (ratio <= 0.75) return 'bg-[#c99a5c]';
  return 'bg-[#ffcc70]';
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
      <div className="-m-8 min-h-screen bg-[#241407] p-8 text-[#f5ebe0]">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="h-52 animate-pulse rounded-2xl bg-white/5 md:col-span-2" />
            <div className="h-52 animate-pulse rounded-2xl bg-white/5 md:col-span-1" />
            <div className="h-52 animate-pulse rounded-2xl bg-white/5 md:col-span-2" />
          </div>
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (summaryQuery.isError || frequencyQuery.isError) {
    return (
      <div className="-m-8 flex min-h-screen items-center justify-center bg-[#241407] p-8 text-[#f5ebe0]">
        <div className="text-center">
          <p className="text-lg font-semibold text-white">Couldn't load your stats</p>
          <p className="mt-1 text-sm text-[#c2a480]">Check your connection and try again.</p>
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
      <div className="-m-8 min-h-screen bg-[#241407] p-8 text-[#f5ebe0]">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c2a480]">
              Your logbook
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#e8a33d]/15 bg-[#2e1a0c]/70 py-24 text-center">
            <Flame className="mb-4 h-10 w-10 text-[#c2a480]" strokeWidth={1.5} />
            <p className="text-lg font-semibold text-white">No entries yet</p>
            <p className="mt-1 max-w-xs text-sm text-[#c2a480]">
              Log your first entry to see your hours, streak, and activity here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-8 min-h-screen bg-[#241407] p-8 text-[#f5ebe0]">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c2a480]">
            Your logbook
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="group relative overflow-hidden rounded-2xl border border-[#e8a33d]/20 bg-gradient-to-br from-[#2e1a0c] to-[#3d2312] p-8 shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:border-[#e8a33d]/50 hover:shadow-[0_12px_40px_-8px_rgba(232,163,61,0.25)] md:col-span-2">
            <span className="pointer-events-none absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-[#c2a480] transition-colors duration-300 group-hover:border-[#e8a33d]" />
            <span className="pointer-events-none absolute right-4 top-4 h-6 w-6 border-r-2 border-t-2 border-[#c2a480] transition-colors duration-300 group-hover:border-[#e8a33d]" />
            <span className="pointer-events-none absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-[#c2a480] transition-colors duration-300 group-hover:border-[#e8a33d]" />
            <span className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-[#c2a480] transition-colors duration-300 group-hover:border-[#e8a33d]" />
            <div className="flex flex-col items-center">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r={RADIUS}
                    fill="none"
                    stroke="#f5ebe0"
                    strokeOpacity={0.1}
                    strokeWidth="8"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r={RADIUS}
                    fill="none"
                    stroke="#e8a33d"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={CIRC * (1 - ringProgress)}
                    style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <Flame
                    className="mb-1 h-5 w-5 text-[#e8a33d] transition-transform duration-300 group-hover:scale-110"
                    strokeWidth={1.5}
                  />
                  <span className="text-3xl font-bold text-white">{streakCount}</span>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-sm text-[#c2a480]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#e8a33d]" />
                day streak
              </p>
              <p className="mt-1 text-center text-xs text-[#c2a480]/70">
                Log in every day to grow your streak
              </p>
            </div>
          </div>

          <div className="group rounded-2xl border border-[#e8a33d]/15 bg-[#2e1a0c]/70 p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-[#e8a33d]/40 hover:bg-[#3d2312] md:col-span-1">
            <p className="text-sm text-[#c2a480]">Total logged</p>
            <p className="mt-2 text-4xl font-bold text-white">{totalHoursCount}h</p>
            <div className="mt-4 flex items-center gap-1 text-xs text-[#e0b37e]">
              <Award className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>{summary!.perProject.length} projects</span>
            </div>
          </div>

          <div className="group rounded-2xl border border-[#e8a33d]/15 bg-[#2e1a0c]/70 p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-[#e8a33d]/40 hover:bg-[#3d2312] md:col-span-2">
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-[#c2a480]" strokeWidth={1.5} />
              <p className="text-sm text-[#c2a480]">Top project</p>
            </div>
            <p className="mt-2 truncate text-2xl font-bold text-white">{topProject!.projectName}</p>
            <p className="mt-1 text-sm text-[#e0b37e]">{topHoursCount}h logged</p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#e8a33d] transition-all duration-1000"
                style={{ width: `${(topProject!.totalHours / summary!.totalHours) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e8a33d]/15 bg-[#2e1a0c]/70 p-6 shadow-lg transition-colors duration-300 hover:border-[#e8a33d]/30">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Weekly activity</h2>
            <p className="h-5 text-xs text-[#c2a480]">
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
                className={`h-6 w-6 cursor-pointer rounded transition-all duration-150 hover:scale-110 hover:ring-1 hover:ring-[#e8a33d] focus:scale-110 focus:outline-none focus:ring-1 focus:ring-[#e8a33d] ${heatColor(week.count, maxWeekCount)} ${
                  hoveredWeek?.weekStart === week.weekStart ? 'ring-1 ring-[#f5ebe0] scale-110' : ''
                }`}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-[#c2a480]">
            <span>Less</span>
            <div className="h-3 w-3 rounded-sm bg-white/8" />
            <div className="h-3 w-3 rounded-sm bg-[#5a4530]" />
            <div className="h-3 w-3 rounded-sm bg-[#8a6f4f]" />
            <div className="h-3 w-3 rounded-sm bg-[#c99a5c]" />
            <div className="h-3 w-3 rounded-sm bg-[#ffcc70]" />
            <span>More</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e8a33d]/15 bg-[#2e1a0c]/70 p-6 shadow-lg transition-colors duration-300 hover:border-[#e8a33d]/30">
          <h2 className="mb-4 text-lg font-semibold text-white">Hours per project</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={summary!.perProject}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#7a5230"
                opacity={0.15}
                vertical={false}
              />
              <XAxis dataKey="projectName" stroke="#c2a480" fontSize={12} tickLine={false} />
              <YAxis stroke="#c2a480" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e8a33d',
                  background: '#2e1a0c',
                  color: '#f5ebe0',
                }}
                cursor={{ fill: '#e8a33d', opacity: 0.1 }}
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
      </div>
    </div>
  );
}
