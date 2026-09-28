import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import Skeleton from '@/components/Skeleton';
import { useReminderSettings } from '@/hooks/useReminderSettings';
import { api } from '@/lib/api';
import type { Project, ReminderFrequency } from '@/types';
import { toast } from '@/lib/toast';

const FREQUENCY_LABEL: Record<ReminderFrequency, string> = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  OFF: 'off',
};

function ComingSoonRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-espresso">{title}</p>
          <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-semibold text-clay uppercase">
            Coming soon
          </span>
        </div>
        <p className="mt-0.5 text-xs text-clay">{description}</p>
      </div>
      <Switch
        checked={false}
        disabled
        aria-label={`${title} (coming soon)`}
        className="data-checked:bg-gold"
      />
    </div>
  );
}

function ProjectFrequencyRow({ project }: { project: Project }) {
  const queryClient = useQueryClient();

  const updateFrequency = useMutation({
    mutationFn: (reminderFrequency: ReminderFrequency) =>
      api.patch<Project>(`/api/projects/${project.id}`, { reminderFrequency }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    onError: (error) => toast.error(error),
  });

  const frequency = updateFrequency.isPending
    ? (updateFrequency.variables ?? project.reminderFrequency)
    : project.reminderFrequency;

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-espresso">{project.name}</p>
        <p className="mt-0.5 text-xs text-clay">
          {frequency === 'OFF'
            ? "You won't be reminded about this project."
            : `You'll get a ${FREQUENCY_LABEL[frequency]} reminder if you haven't logged an entry.`}
        </p>
      </div>
      <select
        value={frequency}
        onChange={(e) => updateFrequency.mutate(e.target.value as ReminderFrequency)}
        disabled={updateFrequency.isPending}
        aria-label={`Reminder frequency for ${project.name}`}
        className="h-11 shrink-0 rounded-lg border border-line bg-white px-2 text-sm text-espresso outline-none focus:ring-2 focus:ring-espresso disabled:opacity-50 md:h-10"
      >
        <option value="DAILY">Daily</option>
        <option value="WEEKLY">Weekly</option>
        <option value="OFF">Off</option>
      </select>
    </div>
  );
}

export default function NotificationsSettings() {
  const { settingsQuery, updateSettings } = useReminderSettings();

  const projectsQuery = useQuery({
    queryKey: ['projects', { archived: false }],
    queryFn: () => api.get<Project[]>('/api/projects'),
  });

  const remindersEnabled = updateSettings.isPending
    ? (updateSettings.variables?.remindersEnabled ?? settingsQuery.data?.remindersEnabled)
    : settingsQuery.data?.remindersEnabled;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold text-espresso">Notifications</p>

      {settingsQuery.isError && (
        <p className="text-sm text-error">Couldn&apos;t load notification settings.</p>
      )}

      <div className="w-full overflow-hidden rounded-xl border border-line bg-paper">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-espresso">All notifications</p>
            <p className="mt-0.5 text-xs text-clay">Master switch for every reminder and email</p>
          </div>
          {settingsQuery.isPending ? (
            <Skeleton rows={1} barClassName="h-[22px] w-10 rounded-full bg-sand" />
          ) : (
            <Switch
              checked={remindersEnabled ?? false}
              onCheckedChange={(checked) => updateSettings.mutate({ remindersEnabled: checked })}
              disabled={updateSettings.isPending}
              aria-label="All notifications"
              className="data-checked:bg-gold"
            />
          )}
        </div>
        <div className="h-px w-full bg-sand" />
        <ComingSoonRow
          title="Reminders & streak alerts"
          description="Daily and weekly reminders, plus streak-at-risk alerts"
        />
        <div className="h-px w-full bg-sand" />
        <ComingSoonRow
          title="Weekly summary email"
          description="A Monday recap of your logging activity"
        />
      </div>

      <p className="mt-2 text-sm font-bold text-espresso">Reminder frequency</p>
      <p className="text-xs text-clay">
        Set how often each project nudges you when it goes quiet. Turned off entirely by the switch
        above.
      </p>

      <div className="w-full overflow-hidden rounded-xl border border-line bg-paper">
        {projectsQuery.isPending && (
          <Skeleton rows={2} barClassName="h-10 rounded-md bg-sand" className="p-4" />
        )}

        {projectsQuery.isError && (
          <p className="px-5 py-4 text-sm text-error">Couldn&apos;t load your projects.</p>
        )}

        {projectsQuery.data?.length === 0 && (
          <p className="px-5 py-4 text-sm text-clay">No projects yet.</p>
        )}

        {(projectsQuery.data ?? []).map((project, index) => (
          <div key={project.id}>
            {index > 0 && <div className="h-px w-full bg-sand" />}
            <ProjectFrequencyRow project={project} />
          </div>
        ))}
      </div>
    </div>
  );
}
