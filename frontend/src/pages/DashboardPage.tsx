import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import { AddWidgetTray, DashboardGrid, type DashboardCtx } from '@/components/dashboard/widgets';
import { useSession } from '@/hooks/useSession';
import { api, listAllStatPanels } from '@/lib/api';
import type { Project } from '@/types';
import {
  DARK_BUTTON,
  GOLD_BUTTON,
  MUTED,
  TEXT_BUTTON,
  activityStats,
  buildHeatmap,
  findDormantProjects,
  formatLongDate,
  panelWidgetId,
  toDayKey,
  useCountUp,
  useDashboardData,
  useDashboardLayout,
  useMediaQuery,
} from '@/lib/dashboard';

const DORMANT_AFTER_DAYS = 7;

// No bg/padding/text overrides here — the app shell's own <main> already
// provides those (bg-canvas, p-4 md:p-8, text-espresso), so blending in
// rather than breaking out keeps the dashboard from showing a visible seam
// against the rest of the app.
const PAGE = '';

export default function DashboardPage() {
  const session = useSession();
  const userId = session.data?.user.id ?? null;

  // Every saved panel in one request; panel widgets and the tray both read
  // from it, so no widget fetches its own value.
  const panelsQuery = useQuery({
    queryKey: ['stat-panels', 'all'],
    queryFn: listAllStatPanels,
    enabled: userId !== null,
  });
  const allPanels = panelsQuery.data;
  const panelIds = useMemo(
    () => (allPanels ? new Set(allPanels.map((panel) => panel.id)) : null),
    [allPanels],
  );

  const { layout, visible, hidden, move, addAt, moveBy, toggle, resize, addPanel, reset } =
    useDashboardLayout(userId, panelIds);
  const [customising, setCustomising] = useState(false);
  const [today] = useState(() => toDayKey(new Date()));
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const data = useDashboardData(today, layout);
  // Same query as the explorer, so this is served from its cache.
  const projects = useQuery({
    queryKey: ['projects', { archived: false }],
    queryFn: () => api.get<Project[]>('/api/projects'),
  });

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
  const upcomingData = data.upcoming.data;
  const upcomingLoading = data.upcoming.isLoading;
  const upcomingError = data.upcoming.isError;
  const panelsById = useMemo(
    () => new Map((allPanels ?? []).map((panel) => [panel.id, panel])),
    [allPanels],
  );
  const panelsLoading = panelsQuery.isLoading;
  const panelsError = panelsQuery.isError;
  const trayPanels = useMemo(() => {
    const shown = new Set(visible.map((widget) => widget.id));
    return (allPanels ?? []).filter((panel) => !shown.has(panelWidgetId(panel.id)));
  }, [allPanels, visible]);
  const markFailed = data.markDone.isError;
  const onMarkDone = data.markDone.mutate;

  const ctx = useMemo<DashboardCtx | null>(() => {
    if (!summary) return null;
    const top = [...summary.perProject].sort((a, b) => b.totalHours - a.totalHours)[0];
    return {
      today,
      panels: { byId: panelsById, isLoading: panelsLoading, isError: panelsError },
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
      upcoming: { data: upcomingData, isLoading: upcomingLoading, isError: upcomingError },
      dormant,
      markFailed,
      onMarkDone,
    };
  }, [
    today,
    panelsById,
    panelsLoading,
    panelsError,
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
    upcomingData,
    upcomingLoading,
    upcomingError,
    dormant,
    markFailed,
    onMarkDone,
  ]);

  if (data.summary.isLoading) {
    return (
      <div className={PAGE}>
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <div className="h-8 w-48 animate-pulse rounded bg-cream" />
          <div className="h-12 animate-pulse rounded-xl bg-cream" />
          <div className="h-44 animate-pulse rounded-xl bg-cream" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="h-40 animate-pulse rounded-xl bg-cream" />
            <div className="h-40 animate-pulse rounded-xl bg-cream" />
          </div>
        </div>
      </div>
    );
  }

  if (data.summary.isError || !ctx) {
    return (
      <div className={`${PAGE} flex items-center justify-center`}>
        <div className="text-center">
          <p className="text-lg font-semibold text-espresso">Couldn't load your stats</p>
          <p className={`mt-1 text-sm ${MUTED}`}>Check your connection and try again.</p>
        </div>
      </div>
    );
  }

  if (!hasEntries) {
    return (
      <div className={PAGE}>
        <div className="mx-auto flex max-w-6xl flex-col">
          {/* Figma's empty-state frames have no page header. */}
          <h1 className="sr-only">Dashboard</h1>
          <FirstRun hasProjects={(projects.data?.length ?? 0) > 0} />
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <div className="mx-auto max-w-6xl">
        <header className="flex items-start justify-between gap-4 md:mb-8">
          <div>
            <h1 className="sr-only text-[28px] font-bold md:not-sr-only">
              {customising ? 'Customise dashboard' : 'Dashboard'}
            </h1>
            <p className={`mt-1 hidden text-sm md:block ${MUTED}`}>{formatLongDate(today)}</p>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            {customising ? (
              <>
                {/* Figma 81:4: 14px semibold clay text, then a gold 8px-radius button. */}
                <button
                  type="button"
                  onClick={reset}
                  className={`${TEXT_BUTTON} px-4 py-3 text-sm`}
                >
                  Reset to default
                </button>
                <button
                  type="button"
                  onClick={() => setCustomising(false)}
                  className={`${GOLD_BUTTON} rounded-lg px-6 py-3 text-paper`}
                >
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

        {/* Figma insets the cards 32px inside the header's width. */}
        <div className="md:px-8">
          {customising && (
            <p className="mb-4 text-sm text-cocoa">
              Drag a widget&apos;s grip onto another widget to swap them, or use the arrow keys on a
              grip. Tiles dragged from the Add widget tray below land where you drop them — the page
              scrolls while you drag.
            </p>
          )}
          <DashboardGrid
            widgets={visible}
            customising={customising}
            isDesktop={isDesktop}
            ctx={ctx}
            onMove={move}
            onAddAt={addAt}
            onMoveBy={moveBy}
            onToggle={toggle}
            onResize={resize}
          />

          {customising && (
            <div className="mt-6">
              <AddWidgetTray
                hidden={hidden}
                onAdd={toggle}
                panels={trayPanels}
                panelsLoading={panelsLoading}
                onAddPanel={addPanel}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const FIRST_RUN_STEPS = ['Create a project', 'Define fields', 'Log your first entry'];

function Steps({ current, className }: { current: number; className: string }) {
  return (
    <ol className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      {FIRST_RUN_STEPS.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          {index > 0 && (
            <span className="font-normal text-[#b29473] md:text-clay" aria-hidden>
              →
            </span>
          )}
          <span className={index === current ? 'md:font-semibold' : 'md:font-normal'}>
            {index + 1}. {step}
          </span>
        </li>
      ))}
    </ol>
  );
}

// Figma "Dashboard — Empty State" (17:276 desktop, 37:788 mobile): a centred
// setup prompt. With no projects the first step is highlighted; once a
// project exists, the last one is (no frame for that state, same styling).
function FirstRun({ hasProjects }: { hasProjects: boolean }) {
  const current = hasProjects ? 2 : 0;
  const action = (
    <Link
      to={hasProjects ? '/entries/new' : '/projects/new'}
      className="inline-flex items-center rounded-lg bg-espresso px-5 py-3 text-[15px] font-medium text-cream transition-opacity hover:opacity-90 md:px-6 md:text-sm md:font-semibold"
    >
      {hasProjects ? 'Log entry' : 'Create project'}
    </Link>
  );

  // Centred between the mobile top bar (56px), bottom nav (64px) and page padding.
  return (
    <div className="flex min-h-[calc(100dvh-152px)] flex-col items-center justify-center text-center md:min-h-[calc(100dvh-6rem)]">
      {/* Mobile */}
      <div className="flex flex-col items-center gap-3 md:hidden">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-cream" aria-hidden>
          <span className="h-7 w-6 rounded-[3px] border-[1.5px] border-clay" />
        </div>
        <p className="text-xl font-bold text-espresso">
          {hasProjects ? 'Log your first entry' : 'No projects yet'}
        </p>
        {!hasProjects && (
          <p className="text-[15px] font-medium text-clay">Set up your first project</p>
        )}
        <p className="text-sm leading-normal text-[#99734d]">
          {hasProjects ? (
            'Your hours, streak and activity will show up here once you log something.'
          ) : (
            <>
              Create a project, define its fields,
              <br />
              and log your first entry.
            </>
          )}
        </p>
        <Steps
          current={current}
          className="flex-nowrap pt-2 text-[11px] font-medium whitespace-nowrap text-clay"
        />
        <div className="mt-1">{action}</div>
      </div>

      {/* Desktop */}
      <div className="hidden w-[520px] max-w-full flex-col items-center gap-7 md:flex">
        <div className="flex size-20 items-center justify-center rounded-full bg-cream">
          <FileText className="size-9 text-cocoa" strokeWidth={1.5} aria-hidden />
        </div>
        <div className="flex flex-col items-center gap-3">
          <p className="text-2xl font-bold text-espresso">
            {hasProjects ? 'Log your first entry' : 'Set up your first project'}
          </p>
          <p className="text-[15px] leading-[22px] text-cocoa">
            {hasProjects
              ? 'Your hours, streak and activity will show up here once you log something.'
              : 'Create a project, define its fields, and log your first entry.'}
          </p>
        </div>
        {action}
        <Steps current={current} className="pt-4 text-xs text-clay" />
      </div>
    </div>
  );
}
