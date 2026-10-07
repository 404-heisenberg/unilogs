import { useMemo, useState } from 'react';
import DeleteProjectDialog from '@/components/project/DeleteProjectDialog';
import ExportDialog from '@/components/project/ExportDialog';
import ShareDialog from '@/components/project/ShareDialog';
import PaneLayout from '@/components/PaneLayout';
import { projectColor } from '@/lib/colors';
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
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    project,
    fields,
    entries,
    summary,
    insights: insightsQuery,
    unfinished,
    trash,
  } = useProjectWorkspace(projectId);
  const {
    fieldActions,
    projectActions,
    markDone,
    markFailed,
    restoreEntry: restoreTrashEntry,
    restoringId,
  } = useProjectMutations(projectId);

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
        <div className="h-8 w-56 animate-pulse rounded bg-cream" />
        <div className="h-40 animate-pulse rounded-xl bg-cream/60" />
      </div>
    );
  }

  if (project.isError || !project.data) {
    return (
      <div>
        <Link to="/projects" className="text-sm text-clay hover:text-espresso">
          Projects
        </Link>
        <p className="mt-4 text-sm text-error">
          Couldn't load this project. Try refreshing the page.
        </p>
      </div>
    );
  }

  const outlineButton =
    'inline-flex h-9 items-center rounded-lg border border-line px-4 text-sm font-medium text-espresso transition-colors hover:bg-cream';

  const pane = (
    <MetadataPanel
      key={project.data.id}
      project={project.data}
      fieldCount={fields.data?.length}
      actions={projectActions}
      onExport={() => setExportOpen(true)}
      onShare={() => setShareOpen(true)}
      onDelete={() => setDeleteOpen(true)}
    />
  );

  return (
    <PaneLayout pane={pane} paneLabel="Project details">
      {/* On mobile the top bar shows the project name, so this header is
          visually hidden there (the h1 stays for screen readers). */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="hidden text-[13px] font-medium md:block">
            <Link to="/projects" className="text-caramel hover:underline">
              Projects
            </Link>
            <span aria-hidden className="text-clay">
              {' / '}
            </span>
            <span className="text-clay">{project.data.name}</span>
          </nav>
          <h1 className="sr-only md:not-sr-only md:mt-2 md:flex md:items-center md:gap-3 md:text-[28px] md:font-bold md:text-espresso">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: projectColor(project.data.id) }}
              aria-hidden
            />
            <span className="truncate">{project.data.name}</span>
          </h1>
          {project.data.description && (
            <p className="hidden text-sm text-clay md:mt-2 md:block">{project.data.description}</p>
          )}
        </div>
        <div className="hidden shrink-0 items-center gap-2 md:mt-7 md:flex">
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className={`${outlineButton} hidden lg:inline-flex`}
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className={`${outlineButton} hidden lg:inline-flex`}
          >
            Share report
          </button>
          <Link
            to={`/entries/new?projectId=${project.data.id}`}
            className="inline-flex h-9 items-center rounded-lg bg-espresso px-4 text-[13px] font-medium text-cream transition-colors hover:bg-deep"
          >
            Log entry
          </Link>
        </div>
      </div>

      {project.data && (
        <>
          <ExportDialog
            open={exportOpen}
            onOpenChange={setExportOpen}
            projectId={project.data.id.toString()}
          />
          <ShareDialog
            key={project.data.id}
            open={shareOpen}
            onOpenChange={setShareOpen}
            projectId={project.data.id.toString()}
          />
          <DeleteProjectDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            projectId={project.data.id.toString()}
            projectName={project.data.name}
            entryCount={entries.data?.length ?? 0}
          />
        </>
      )}

      <div className="md:mt-8">
        <div className="min-w-0">
          <TabBar tab={tab} onChange={changeTab} />
          <TabPanel tab={tab}>
            {tab === 'overview' && (
              <OverviewTab
                projectId={projectId}
                fields={fieldList}
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
                trash={{
                  entries: trash.data?.entries ?? [],
                  isLoading: trash.isPending && trash.fetchStatus !== 'idle',
                  isError: trash.isError,
                }}
                restoringId={restoringId}
                onRestore={restoreTrashEntry}
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
      </div>
    </PaneLayout>
  );
}
