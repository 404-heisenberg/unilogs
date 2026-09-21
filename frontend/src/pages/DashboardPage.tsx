import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Plus } from 'lucide-react';
import { AddWidgetTray, DashboardGrid, type DashboardCtx } from '@/components/dashboard/widgets';
import { useSession } from '@/hooks/useSession';
import {
  DARK_BUTTON,
  GOLD_BUTTON,
  MUTED,
  TEXT_BUTTON,
  activityStats,
  buildHeatmap,
  findDormantProjects,
  formatLongDate,
  toDayKey,
  useCountUp,
  useDashboardData,
  useDashboardLayout,
  useMediaQuery,
} from '@/lib/dashboard';

const DORMANT_AFTER_DAYS = 7;

const PAGE =
  '-m-4 min-h-[calc(100%_+_2rem)] bg-[#FFFCF7] p-4 text-[#2A1A0E] md:-m-8 md:min-h-[calc(100%_+_4rem)] md:p-8';

export default function DashboardPage() {
  const session = useSession();
  const userId = session.data?.user.id ?? null;

  const { layout, visible, hidden, move, moveBy, toggle, resize, reset } =
    useDashboardLayout(userId);
  const [customising, setCustomising] = useState(false);
  const [today] = useState(() => toDayKey(new Date()));
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const data = useDashboardData(today, layout);

  const summary = data.summary.data;
  const activityData = data.activity.data;
  const streak = summary?.streak ?? 0;
  const hasEntries = !!summary && summary.totalHours > 0 && summary.perProject.length > 0;

  const streakCount = useCountUp(streak);
  const totalHoursCount = useCountUp(summary?.totalHours ?? 0);

  const heatmap = useMemo(() => {
    if (!activityData) return null;
    const cells = buildHeatmap(activityData.daily, streak, today);
    return { cells, stats: activityStats(cells) };
  }, [activityData, streak, today]);

  const dormant = useMemo(
    () =>
      summary && activityData
        ? findDormantProjects(
            summary.perProject,
            activityData.lastLogged,
            today,
            DORMANT_AFTER_DAYS,
          )
        : null,
    [summary, activityData, today],
  );

  const activityLoading = data.activity.isLoading;
  const activityError = data.activity.isError;
  const recentData = data.recent.data;
  const durations = data.durations;
  const recentLoading = data.recent.isLoading;
  const recentError = data.recent.isError;
  const unfinishedData = data.unfinished.data;
  const unfinishedLoading = data.unfinished.isLoading;
  const unfinishedError = data.unfinished.isError;
  const insightData = data.insight.data;
  const insightLoading = data.insight.isLoading;
  const frequencyData = data.frequency.data;
  const frequencyLoading = data.frequency.isLoading;
  const frequencyError = data.frequency.isError;
  const markFailed = data.markDone.isError;
  const onMarkDone = data.markDone.mutate;

  const ctx = useMemo<DashboardCtx | null>(() => {
    if (!summary) return null;
    const top = [...summary.perProject].sort((a, b) => b.totalHours - a.totalHours)[0];
    return {
      today,
      isDesktop,
      summary,
      counts: { streak: streakCount, totalHours: totalHoursCount },
      topProject:
        top && summary.totalHours > 0
          ? {
              name: top.projectName,
              percent: Math.round((top.totalHours / summary.totalHours) * 100),
            }
          : null,
      heatmap: {
        cells: heatmap?.cells ?? null,
        stats: heatmap?.stats ?? null,
        isLoading: activityLoading,
        isError: activityError,
      },
      recent: {
        entries: recentData,
        durations,
        isLoading: recentLoading,
        isError: recentError,
      },
      unfinished: { stats: unfinishedData, isLoading: unfinishedLoading, isError: unfinishedError },
      insight: { stat: insightData, isLoading: insightLoading },
      frequency: { stats: frequencyData, isLoading: frequencyLoading, isError: frequencyError },
      dormant,
      markFailed,
      onMarkDone,
    };
  }, [
    today,
    isDesktop,
    summary,
    streakCount,
    totalHoursCount,
    heatmap,
    activityLoading,
    activityError,
    recentData,
    durations,
    recentLoading,
    recentError,
    unfinishedData,
    unfinishedLoading,
    unfinishedError,
    insightData,
    insightLoading,
    frequencyData,
    frequencyLoading,
    frequencyError,
    dormant,
    markFailed,
    onMarkDone,
  ]);

  if (data.summary.isLoading) {
    return (
      <div className={PAGE}>
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <div className="h-8 w-48 animate-pulse rounded bg-[#EADFCF]" />
          <div className="h-12 animate-pulse rounded-xl bg-[#F5EBE0]" />
          <div className="h-44 animate-pulse rounded-xl bg-[#F5EBE0]" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="h-40 animate-pulse rounded-xl bg-[#F5EBE0]" />
            <div className="h-40 animate-pulse rounded-xl bg-[#F5EBE0]" />
          </div>
        </div>
      </div>
    );
  }

  if (data.summary.isError || !ctx) {
    return (
      <div className={`${PAGE} flex items-center justify-center`}>
        <div className="text-center">
          <p className="text-lg font-semibold text-[#2A1A0E]">Couldn't load your stats</p>
          <p className={`mt-1 text-sm ${MUTED}`}>Check your connection and try again.</p>
        </div>
      </div>
    );
  }

  if (!hasEntries) {
    return (
      <div className={PAGE}>
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className={`mt-1 text-sm ${MUTED}`}>{formatLongDate(today)}</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl bg-[#F5EBE0] py-24 text-center">
            <Flame className={`mb-4 h-10 w-10 ${MUTED}`} strokeWidth={1.5} aria-hidden />
            <p className="text-lg font-semibold">No entries yet</p>
            <p className={`mt-1 max-w-xs text-sm ${MUTED}`}>
              Log your first entry to see your hours, streak, and activity here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {customising ? 'Customise dashboard' : 'Dashboard'}
            </h1>
            <p className={`mt-1 text-sm ${MUTED}`}>{formatLongDate(today)}</p>
          </div>
          <div className="flex items-center gap-2">
            {customising ? (
              <>
                <button type="button" onClick={reset} className={TEXT_BUTTON}>
                  Reset to default
                </button>
                <button type="button" onClick={() => setCustomising(false)} className={GOLD_BUTTON}>
                  Done
                </button>
              </>
            ) : (
              <>
                {isDesktop && (
                  <button
                    type="button"
                    onClick={() => setCustomising(true)}
                    className={TEXT_BUTTON}
                  >
                    Customise
                  </button>
                )}
                <Link to="/entries/new" className={DARK_BUTTON}>
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  {isDesktop ? 'Log entry' : 'Log'}
                </Link>
              </>
            )}
          </div>
        </header>

        <DashboardGrid
          widgets={visible}
          customising={customising}
          isDesktop={isDesktop}
          ctx={ctx}
          onMove={move}
          onMoveBy={moveBy}
          onToggle={toggle}
          onResize={resize}
        />

        {customising && (
          <div className="mt-6">
            <AddWidgetTray hidden={hidden} onAdd={toggle} />
          </div>
        )}
      </div>
    </div>
  );
}
