import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { FieldInput } from '@/components/FieldInput';
import {
  api,
  ApiError,
  type CalendarSuggestion,
  type CalendarSuggestionsResponse,
} from '@/lib/api';
import { buildContent, defaultValueForType } from '@/lib/field-values';
import type { FieldValue } from '@/lib/field-values';
import { useCalendarConnection } from '@/hooks/useCalendarConnection';
import type { FieldDefinition, Project } from '@/types';

function eventDate(suggestion: CalendarSuggestion): string {
  const start = suggestion.start;
  if (!start) return new Date().toISOString().slice(0, 10);
  return start.includes('T') ? start.slice(0, 10) : start;
}

function formatTime(suggestion: CalendarSuggestion): string {
  const start = suggestion.start;
  if (!start) return '';
  if (!start.includes('T')) return start;
  return new Date(start).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function AcceptForm({
  suggestion,
  onDone,
}: {
  suggestion: CalendarSuggestion;
  onDone: () => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(eventDate(suggestion));
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/api/projects'),
  });

  const fieldsQuery = useQuery({
    queryKey: ['field-definitions', projectId],
    queryFn: () => api.get<FieldDefinition[]>(`/api/field-definitions?projectId=${projectId}`),
    enabled: !!projectId,
  });
  const fields = fieldsQuery.data ?? [];

  // Reset entered values whenever the selected project's field set changes so
  // stale values from a previous project never leak into a submission.
  const [loadedFields, setLoadedFields] = useState(fieldsQuery.data);
  if (fieldsQuery.data !== loadedFields) {
    setLoadedFields(fieldsQuery.data);
    const initial: Record<string, FieldValue> = {};
    for (const field of fieldsQuery.data ?? []) {
      initial[field.name] = defaultValueForType(field.fieldType);
    }
    setValues(initial);
    setFieldErrors({});
    setFormError(null);
  }

  const accept = useMutation({
    mutationFn: (input: { projectId: number; date: string; content: Record<string, unknown> }) =>
      api.post<{ id: number }>(`/api/calendar/events/suggestions/${suggestion.id}/accept`, input),
    onSuccess: onDone,
    onError: (error) => {
      const body = error instanceof ApiError ? (error.body as { errors?: string[] } | null) : null;
      const messages = Array.isArray(body?.errors) ? body.errors : [error.message];

      const nextFieldErrors: Record<string, string> = {};
      const general: string[] = [];
      for (const message of messages) {
        const match = message.match(/^Field '([^']+)'/);
        if (match) {
          nextFieldErrors[match[1]] = message;
        } else {
          general.push(message);
        }
      }
      setFieldErrors(nextFieldErrors);
      setFormError(general.length > 0 ? general.join(' ') : null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    const nextFieldErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.fieldType === 'boolean') continue;
      const raw = values[field.name];
      if (raw === undefined || String(raw).trim() === '') {
        nextFieldErrors[field.name] = `${field.name} is required`;
      }
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    accept.mutate({
      projectId: Number(projectId),
      date,
      content: buildContent(fields, values),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-col gap-4 border-t border-[#d4a373]/40 pt-3"
    >
      <div>
        <label
          htmlFor={`accept-project-${suggestion.id}`}
          className="mb-1 block text-sm text-[#4a3525]"
        >
          Project
        </label>
        <select
          id={`accept-project-${suggestion.id}`}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full rounded-md border border-[#d4a373]/60 bg-white px-3 py-2 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
          required
        >
          <option value="">Select a project…</option>
          {(projects ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={`accept-date-${suggestion.id}`}
          className="mb-1 block text-sm text-[#4a3525]"
        >
          Date
        </label>
        <input
          id={`accept-date-${suggestion.id}`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-md border border-[#d4a373]/60 bg-white px-3 py-2 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
          required
        />
      </div>

      {projectId && fieldsQuery.isPending && (
        <p className="text-sm text-slate-500">Loading fields…</p>
      )}
      {projectId && !fieldsQuery.isPending && fields.length === 0 && (
        <p className="text-sm text-[#7a5230]">
          This project has no fields — no extra values needed.
        </p>
      )}

      {fields.map((field) => (
        <FieldInput
          key={field.id}
          field={field}
          value={values[field.name] ?? defaultValueForType(field.fieldType)}
          error={fieldErrors[field.name]}
          onChange={(value) => setValues((prev) => ({ ...prev, [field.name]: value }))}
        />
      ))}

      {formError && <p className="text-sm text-red-700">{formError}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={accept.isPending || !projectId}>
          {accept.isPending ? 'Saving…' : 'Log entry'}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function SuggestionsPage() {
  const queryClient = useQueryClient();
  const { statusQuery, connect } = useCalendarConnection();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const suggestionsQuery = useQuery({
    queryKey: ['calendar-suggestions'],
    queryFn: () => api.get<CalendarSuggestionsResponse>('/api/calendar/events/suggestions'),
    enabled: !!statusQuery.data?.connected,
  });

  const invalidateSuggestions = () =>
    queryClient.invalidateQueries({ queryKey: ['calendar-suggestions'] });

  const reject = useMutation({
    mutationFn: (eventId: string) =>
      api.post<{ message: string }>(`/api/calendar/events/suggestions/${eventId}/reject`),
    onSuccess: invalidateSuggestions,
  });

  const suggestions = suggestionsQuery.data?.suggestions ?? [];

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Calendar suggestions</h1>
      <p className="mb-6 text-sm text-[#7a5230]">
        Events from your Google Calendar, ready to log as entries.
      </p>

      {statusQuery.isPending && <p className="text-sm text-[#7a5230]">Checking connection…</p>}

      {statusQuery.isError && (
        <div className="mt-2">
          <p className="text-sm text-red-700">
            Couldn&apos;t check the Google Calendar connection.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => statusQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      )}

      {statusQuery.isSuccess && !statusQuery.data.connected && (
        <div className="rounded-md border border-[#d4a373]/40 bg-white p-4">
          <p className="text-sm text-[#4a3525]">
            Connect your Google Calendar to turn upcoming events into entry suggestions.
          </p>
          <Button
            type="button"
            className="mt-3 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90"
            onClick={() => connect.mutate()}
            disabled={connect.isPending}
          >
            {connect.isPending ? 'Connecting…' : 'Connect Google Calendar'}
          </Button>
          {connect.isError && <p className="mt-2 text-sm text-red-700">{connect.error.message}</p>}
        </div>
      )}

      {statusQuery.isSuccess && statusQuery.data.connected && (
        <div>
          {suggestionsQuery.isPending && (
            <p className="text-sm text-[#7a5230]">Loading suggestions…</p>
          )}

          {suggestionsQuery.isError && (
            <div className="mt-2">
              <p className="text-sm text-red-700">Couldn&apos;t load calendar suggestions.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => suggestionsQuery.refetch()}
              >
                Try again
              </Button>
            </div>
          )}

          {suggestionsQuery.isSuccess && suggestions.length === 0 && (
            <div className="rounded-md border border-[#d4a373]/40 bg-white p-4">
              <p className="text-sm text-[#4a3525]">
                No upcoming events to suggest. Check back after you&apos;ve had something worth
                logging.
              </p>
            </div>
          )}

          {suggestions.map((suggestion) => {
            const isRejecting = rejectingId === suggestion.id;
            return (
              <div
                key={suggestion.id}
                className="mb-4 rounded-md border border-[#d4a373]/40 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1c0d06]">{suggestion.title}</p>
                    <p className="text-sm text-[#7a5230]">{formatTime(suggestion)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90"
                      onClick={() =>
                        setAcceptingId((current) =>
                          current === suggestion.id ? null : suggestion.id,
                        )
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isRejecting}
                      onClick={() => {
                        setRejectingId(suggestion.id);
                        reject.mutate(suggestion.id);
                      }}
                    >
                      {isRejecting ? 'Rejecting…' : 'Reject'}
                    </Button>
                  </div>
                </div>

                {acceptingId === suggestion.id && (
                  <AcceptForm
                    suggestion={suggestion}
                    onDone={() => {
                      setAcceptingId(null);
                      invalidateSuggestions();
                      queryClient.invalidateQueries({ queryKey: ['entries'] });
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
