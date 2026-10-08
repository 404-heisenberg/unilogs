import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import Skeleton from '@/components/Skeleton';
import { useCalendarConnection } from '@/hooks/useCalendarConnection';
import {
  listCalendarSources,
  updateCalendarSource,
  type CalendarSource,
  type CalendarSourcesResponse,
} from '@/lib/api';
import { QUERY_KEYS } from '@/lib/dashboard';
import { toast } from '@/lib/toast';

const SOURCES_KEY = ['calendar-sources'];

function SourceRow({ source }: { source: CalendarSource }) {
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => updateCalendarSource(source.id, { enabled }),
    // Flip the switch straight away; a failed PATCH puts it back.
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: SOURCES_KEY });
      const previous = queryClient.getQueryData<CalendarSourcesResponse>(SOURCES_KEY);
      queryClient.setQueryData<CalendarSourcesResponse>(SOURCES_KEY, (data) =>
        data
          ? {
              ...data,
              sources: data.sources.map((s) => (s.id === source.id ? { ...s, enabled } : s)),
            }
          : data,
      );
      return { previous };
    },
    onError: (error, _enabled, context) => {
      if (context?.previous) queryClient.setQueryData(SOURCES_KEY, context.previous);
      toast.error(error);
    },
    // The backend only reads enabled calendars, so both lists built from
    // calendar events have to be fetched again.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-suggestions'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.upcoming });
    },
  });

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 md:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: source.color }}
          aria-hidden
        />
        <p className="truncate text-sm font-semibold text-espresso">{source.summary}</p>
        <span className="shrink-0 rounded bg-cream px-2 py-0.5 text-[11px] font-medium text-clay">
          Google
        </span>
      </div>
      <Switch
        checked={source.enabled}
        onCheckedChange={(checked) => toggle.mutate(checked)}
        disabled={toggle.isPending}
        aria-label={`Use the ${source.summary} calendar`}
        className="data-checked:bg-gold"
      />
    </div>
  );
}

// Which Google calendars feed suggestions and the upcoming list. Only shown
// once Google Calendar is connected: listing sources asks Google for them.
export default function CalendarSourcesSettings() {
  const { statusQuery } = useCalendarConnection();
  const connected = statusQuery.data?.connected === true;

  const sourcesQuery = useQuery({
    queryKey: SOURCES_KEY,
    queryFn: listCalendarSources,
    enabled: connected,
  });

  if (!connected) return null;

  const sources = sourcesQuery.data?.sources ?? [];

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-bold text-espresso">Calendars</h2>
        <p className="mt-1 text-xs text-clay">
          Choose which calendars feed suggestions and the calendar view.
        </p>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-line bg-paper">
        {sourcesQuery.isPending && (
          <Skeleton rows={3} barClassName="h-8 rounded-md bg-sand" className="p-4" />
        )}

        {sourcesQuery.isError && (
          <p className="px-5 py-4 text-sm text-error">Couldn&apos;t load your calendars.</p>
        )}

        {sourcesQuery.isSuccess && sources.length === 0 && (
          <p className="px-5 py-4 text-sm text-clay">No calendars found on your Google account.</p>
        )}

        {sources.map((source, index) => (
          <div key={source.id}>
            {index > 0 && <div className="h-px w-full bg-sand" />}
            <SourceRow source={source} />
          </div>
        ))}
      </div>
    </section>
  );
}
