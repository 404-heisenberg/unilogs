import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import Segmented from '@/components/project/Segmented';
import { ApiError } from '@/lib/api';
import {
  AGGREGATION_OPTIONS,
  RANGE_OPTIONS,
  entryWord,
  formatStatValue,
  useDebouncedValue,
  useStatPanelMutations,
  useStatPanelPreview,
} from '@/lib/stat-panels';
import { toast } from '@/lib/toast';
import type { FieldDefinition, StatPanel, StatPanelAggregation } from '@/types';

const LABEL = 'text-[13px] font-medium text-espresso';
const INPUT =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-espresso outline-none focus:ring-2 focus:ring-gold';

type BuilderFormProps = {
  projectId: string;
  fields: FieldDefinition[];
  panel: StatPanel | null;
  onClose: () => void;
};

function BuilderForm({ projectId, fields, panel, onClose }: BuilderFormProps) {
  const [name, setName] = useState(panel?.name ?? '');
  const [expression, setExpression] = useState(panel?.expression ?? '');
  const [aggregation, setAggregation] = useState<StatPanelAggregation>(panel?.aggregation ?? 'sum');
  const [rangeDays, setRangeDays] = useState(panel?.rangeDays ?? 30);
  const formulaRef = useRef<HTMLInputElement>(null);

  const { create, update } = useStatPanelMutations(projectId);
  const saving = create.isPending || update.isPending;

  // Only number and duration fields can be used in a formula.
  const numericFields = useMemo(
    () => fields.filter((f) => f.fieldType === 'number' || f.fieldType === 'duration'),
    [fields],
  );

  // Debounce: one preview request after typing pauses, never one per keystroke.
  const trimmed = expression.trim();
  const debounced = useDebouncedValue(trimmed);
  const settled = debounced === trimmed;
  const preview = useStatPanelPreview(
    projectId,
    debounced ? { expression: debounced, aggregation, rangeDays } : null,
  );

  // A bad formula (400) is shown inline. Anything else (network, 500) is a toast.
  const previewError = preview.error;
  const isFormulaError = previewError instanceof ApiError && previewError.status === 400;
  const inlineError = isFormulaError ? previewError.message : null;

  useEffect(() => {
    if (previewError && !(previewError instanceof ApiError && previewError.status === 400)) {
      toast.error(previewError);
    }
  }, [previewError]);

  const rangeOptions = useMemo(
    () => Array.from(new Set([...RANGE_OPTIONS, rangeDays])).sort((a, b) => a - b),
    [rangeDays],
  );

  const checking = trimmed !== '' && (!settled || preview.isFetching);
  const canSave =
    name.trim() !== '' &&
    trimmed !== '' &&
    settled &&
    preview.isSuccess &&
    !preview.isFetching &&
    !saving;

  const insertField = (fieldName: string) => {
    setExpression((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${fieldName}`);
    formulaRef.current?.focus();
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    const body = { name: name.trim(), expression: trimmed, aggregation, rangeDays };
    if (panel) update.mutate({ id: panel.id, ...body }, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  };

  let previewLine: React.ReactNode = (
    <span className="text-clay">Type a formula to see a preview.</span>
  );
  if (checking) {
    previewLine = <span className="text-clay">Calculating…</span>;
  } else if (inlineError) {
    previewLine = (
      <span role="alert" className="text-error">
        {inlineError}
      </span>
    );
  } else if (preview.isError) {
    previewLine = <span className="text-error">Couldn’t calculate the preview.</span>;
  } else if (preview.data && trimmed) {
    previewLine =
      preview.data.sampleCount === 0 ? (
        <span className="text-clay">No data yet for this range.</span>
      ) : (
        <span className="text-espresso">
          ≈ {formatStatValue(preview.data.value, trimmed, fields)} ·{' '}
          {entryWord(preview.data.sampleCount)}
        </span>
      );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="stat-panel-name" className={LABEL}>
          Name
        </label>
        <input
          id="stat-panel-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Pages per hour"
          className={INPUT}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="stat-panel-formula" className={LABEL}>
          Formula
        </label>
        <input
          id="stat-panel-formula"
          ref={formulaRef}
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          placeholder="Pages read / Time spent"
          aria-invalid={inlineError ? true : undefined}
          className={`${INPUT} font-mono`}
          autoComplete="off"
          spellCheck={false}
        />
        {numericFields.length > 0 && (
          <div
            role="group"
            aria-label="Insert a field"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {numericFields.map((field) => (
              <button
                key={field.id}
                type="button"
                onClick={() => insertField(field.name)}
                className="shrink-0 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-cocoa transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-gold"
              >
                {field.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className={LABEL}>Aggregation</p>
        <Segmented
          label="Aggregation"
          value={aggregation}
          onChange={setAggregation}
          options={AGGREGATION_OPTIONS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="stat-panel-range" className={LABEL}>
          Range
        </label>
        <select
          id="stat-panel-range"
          value={rangeDays}
          onChange={(event) => setRangeDays(Number(event.target.value))}
          className={INPUT}
        >
          {rangeOptions.map((days) => (
            <option key={days} value={days}>
              Last {days} days
            </option>
          ))}
        </select>
      </div>

      <p aria-live="polite" className="min-h-5 text-[13px]">
        {previewLine}
      </p>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 md:min-h-10"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!canSave}
          className="min-h-11 bg-gold text-espresso hover:opacity-90 md:min-h-10"
        >
          {saving ? 'Saving…' : 'Save panel'}
        </Button>
      </div>
    </form>
  );
}

type StatPanelBuilderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  fields: FieldDefinition[];
  // Pass a panel to edit it (the form opens pre-filled); omit to create.
  panel?: StatPanel | null;
};

export default function StatPanelBuilderDialog({
  open,
  onOpenChange,
  projectId,
  fields,
  panel = null,
}: StatPanelBuilderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Centered modal on desktop; pinned to the bottom edge below 640px. */}
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="bg-paper text-espresso max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none"
      >
        <DialogTitle>{panel ? 'Edit stat panel' : 'New stat panel'}</DialogTitle>
        {/* Mounted only while open, so every open starts from the panel's values. */}
        <BuilderForm
          projectId={projectId}
          fields={fields}
          panel={panel}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
