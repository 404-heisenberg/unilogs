import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  EntriesTab,
  FieldsTab,
  MetadataPanel,
  OverviewTab,
  TabBar,
  TabPanel,
} from '@/components/project/workspace';
import {
  mapFieldInsights,
  parseTab,
  sortEntries,
  toDayKey,
  useProjectMutations,
  useProjectWorkspace,
  weeklyActivity,
  type TabId,
} from '@/lib/project-workspace';

const RECENT_COUNT = 5;

export default function ProjectDetailPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));
  const [today] = useState(() => toDayKey(new Date()));

  const {
    project,
    fields,
    entries,
    summary,
    insights: insightsQuery,
    unfinished,
  } = useProjectWorkspace(projectId);
  const { fieldActions, projectActions, markDone, markFailed } = useProjectMutations(projectId);

  const fieldList = useMemo(() => fields.data ?? [], [fields.data]);
  const sortedEntries = useMemo(() => sortEntries(entries.data ?? []), [entries.data]);
  const insights = useMemo(
    () => mapFieldInsights(fieldList, insightsQuery.data?.fields ?? [], today),
    [fieldList, insightsQuery.data, today],
  );
  const bars = useMemo(() => weeklyActivity(sortedEntries, today), [sortedEntries, today]);
  const recent = useMemo(() => sortedEntries.slice(0, RECENT_COUNT), [sortedEntries]);

  const changeTab = (next: TabId) => setSearchParams(next === 'overview' ? {} : { tab: next });

  if (project.isPending && project.fetchStatus !== 'idle') {
    return (
      <div aria-busy className="flex flex-col gap-4">
        <div className="h-8 w-56 animate-pulse rounded bg-[#EADFCF]" />
        <div className="h-40 animate-pulse rounded-xl bg-[#EADFCF]/60" />
      </div>
    );
  }

  if (project.isError || !project.data) {
    return (
      <div>
        <Link to="/projects" className="text-sm text-[#8A7660] hover:text-[#1C0D06]">
          Projects
        </Link>
        <p className="mt-4 text-sm text-red-700">
          Couldn't load this project. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-xs text-[#8A7660]">
        <Link to="/projects" className="hover:text-[#1C0D06]">
          Projects
        </Link>
        <span aria-hidden> / </span>
        <span>{project.data.name}</span>
      </nav>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-[#1C0D06]">
            <span className="size-2.5 shrink-0 rounded-full bg-[#D9A97F]" aria-hidden />
            <span className="truncate">{project.data.name}</span>
          </h1>
          {project.data.description && (
            <p className="mt-1 text-sm text-[#8A7660]">{project.data.description}</p>
          )}
        </div>
        <Link
          to="/entries/new"
          className="hidden shrink-0 items-center justify-center rounded-md bg-[#1C0D06] px-3.5 py-2 text-sm font-medium text-[#FFFCF7] transition-colors hover:bg-[#3A2214] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843] sm:inline-flex"
        >
          Log entry
        </Link>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <TabBar tab={tab} onChange={changeTab} />
          <TabPanel tab={tab}>
            {tab === 'overview' && (
              <OverviewTab
                today={today}
                summary={summary.data}
                insights={insights}
                insightsLoading={insightsQuery.isPending}
                insightsError={insightsQuery.isError}
                bars={bars}
                recent={recent}
                entriesLoading={entries.isPending}
                entriesError={entries.isError}
                unfinished={{
                  stats: unfinished.data,
                  isLoading: unfinished.isPending && unfinished.fetchStatus !== 'idle',
                  isError: unfinished.isError,
                }}
                markFailed={markFailed}
                onMarkDone={markDone}
              />
            )}
            {tab === 'entries' && (
              <EntriesTab
                entries={sortedEntries}
                fields={fieldList}
                isLoading={entries.isPending}
                isError={entries.isError}
                today={today}
              />
            )}
            {tab === 'fields' && (
              <FieldsTab
                fields={fieldList}
                isLoading={fields.isPending}
                isError={fields.isError}
                actions={fieldActions}
              />
            )}
          </TabPanel>
        </div>

        <div className="lg:border-l lg:border-[#EADFCF] lg:pl-8">
          <MetadataPanel
            key={project.data.id}
            project={project.data}
            fieldCount={fields.data?.length}
            actions={projectActions}
          />
        </div>
      </div>
    </div>
  );
}
