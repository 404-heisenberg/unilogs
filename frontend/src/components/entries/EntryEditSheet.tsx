import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Trash2, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FieldInput } from '@/components/FieldInput';
import TagPicker from '@/components/entries/TagPicker';
import { api, ApiError } from '@/lib/api';
import { buildContent, defaultValueForType, type FieldValue } from '@/lib/field-values';
import type { Entry, FieldDefinition } from '@/types';

function entryToValues(entry: Entry, fields: FieldDefinition[]): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  for (const field of fields) {
    const raw = entry.content[field.name];
    values[field.name] =
      raw !== undefined ? (raw as FieldValue) : defaultValueForType(field.fieldType);
  }
  return values;
}

export default function EntryEditSheet({
  entry,
  open,
  onOpenChange,
}: {
  entry: Entry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fieldsQuery = useQuery({
    queryKey: ['field-definitions', String(entry.projectId)],
    queryFn: () =>
      api.get<FieldDefinition[]>(`/api/field-definitions?projectId=${entry.projectId}`),
    // Only once the sheet is actually opened — no point fetching field
    // definitions for an edit form nobody has asked to see yet.
    enabled: open,
  });
  const fields = fieldsQuery.data ?? [];

  const [date, setDate] = useState(entry.date.slice(0, 10));
  const [title, setTitle] = useState(entry.title ?? '');
  const [body, setBody] = useState(entry.body ?? '');
  const [tagIds, setTagIds] = useState<number[]>((entry.tags ?? []).map((t) => t.tag.id));
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Seed field values from the entry's existing content once fields load.
  // Adjusting state during render (not an effect) — same pattern as the
  // create form — so this only re-runs when the fetched field set changes.
  const [loadedFields, setLoadedFields] = useState(fieldsQuery.data);
  if (fieldsQuery.data !== loadedFields) {
    setLoadedFields(fieldsQuery.data);
    setValues(entryToValues(entry, fieldsQuery.data ?? []));
  }

  const updateEntry = useMutation({
    mutationFn: (input: {
      date: string;
      title: string | null;
      body: string | null;
      tagIds: number[];
      content: Record<string, unknown>;
    }) => api.put<Entry>(`/api/entries/${entry.id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entry', String(entry.id)] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      onOpenChange(false);
    },
    onError: (error) => {
      const body = error instanceof ApiError ? (error.body as { errors?: string[] } | null) : null;
      const messages = Array.isArray(body?.errors) ? body.errors : [error.message];
      const nextFieldErrors: Record<string, string> = {};
      const general: string[] = [];
      for (const message of messages) {
        const match = message.match(/^Field '([^']+)'/);
        if (match) nextFieldErrors[match[1]] = message;
        else general.push(message);
      }
      setFieldErrors(nextFieldErrors);
      setFormError(general.length > 0 ? general.join(' ') : null);
    },
  });

  const deleteEntry = useMutation({
    mutationFn: () => api.delete(`/api/entries/${entry.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      navigate('/entries');
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    updateEntry.mutate({
      date,
      title: title.trim() || null,
      body: body.trim() || null,
      tagIds,
      content: buildContent(fields, values),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="flex max-h-[85vh] flex-col gap-0 rounded-t-2xl bg-paper p-0"
      >
        <SheetHeader className="flex-row items-center justify-between p-0">
          <SheetTitle className="px-4 pt-2 pb-1 text-lg font-bold text-espresso">
            Properties
          </SheetTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="mr-3 flex size-11 shrink-0 items-center justify-center rounded-full bg-cream text-clay"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </SheetHeader>

        <form onSubmit={handleSave} className="flex flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4">
          <div>
            <label htmlFor="edit-date" className="mb-1 block text-xs text-clay">
              Date
            </label>
            <input
              id="edit-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-espresso outline-none focus:ring-2 focus:ring-espresso"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-title" className="mb-1 block text-xs text-clay">
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-espresso outline-none focus:ring-2 focus:ring-espresso"
            />
          </div>

          <div>
            <label htmlFor="edit-body" className="mb-1 block text-xs text-clay">
              Notes
            </label>
            <textarea
              id="edit-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-espresso outline-none focus:ring-2 focus:ring-espresso"
            />
          </div>

          {fields.length > 0 && (
            <>
              <div className="h-px w-full bg-sand" />
              <p className="text-[11px] font-medium tracking-wide text-clay uppercase">
                Custom fields
              </p>
              {fields.map((field) => (
                <FieldInput
                  key={field.id}
                  field={field}
                  value={values[field.name] ?? defaultValueForType(field.fieldType)}
                  error={fieldErrors[field.name]}
                  onChange={(value) => setValues((prev) => ({ ...prev, [field.name]: value }))}
                />
              ))}
            </>
          )}

          <div className="h-px w-full bg-sand" />
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wide text-clay uppercase">Tags</p>
            <TagPicker selected={tagIds} onChange={setTagIds} />
          </div>

          {formError && <p className="text-sm text-error">{formError}</p>}

          <button
            type="submit"
            disabled={updateEntry.isPending}
            className="min-h-11 rounded-lg bg-espresso text-sm font-semibold text-cream hover:opacity-90 disabled:opacity-60"
          >
            {updateEntry.isPending ? 'Saving…' : 'Save changes'}
          </button>

          <div className="h-px w-full bg-sand" />

          {confirmingDelete ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-danger-text">
                Delete this entry permanently? This can&apos;t be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => deleteEntry.mutate()}
                  disabled={deleteEntry.isPending}
                  className="min-h-11 flex-1 rounded-lg bg-danger-text text-sm font-semibold text-white disabled:opacity-60"
                >
                  {deleteEntry.isPending ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="min-h-11 flex-1 rounded-lg border border-line text-sm font-semibold text-espresso"
                >
                  Cancel
                </button>
              </div>
              {deleteEntry.isError && (
                <p className="text-sm text-error">{deleteEntry.error.message}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-danger-soft text-sm font-medium text-danger-text"
            >
              <Trash2 size={14} strokeWidth={1.75} />
              Delete entry
            </button>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
