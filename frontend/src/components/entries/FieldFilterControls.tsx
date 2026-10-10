import type { FieldFilter, FieldShape } from '@/lib/entryFields';

const INPUT =
  'min-h-11 w-full min-w-0 rounded-lg border border-line bg-white px-3 text-sm text-espresso outline-none placeholder:text-taupe focus:ring-2 focus:ring-espresso md:min-h-10';

function RangeInputs({
  filter,
  type,
  step,
  unit,
  onChange,
}: {
  filter: FieldFilter;
  type: 'number' | 'date';
  step?: string;
  unit?: string;
  onChange: (next: FieldFilter) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type={type}
        step={step}
        value={filter.min ?? ''}
        onChange={(e) => onChange({ ...filter, min: e.target.value, value: undefined })}
        placeholder="From"
        aria-label={`${filter.name} from${unit ? ` (${unit})` : ''}`}
        className={INPUT}
      />
      <span className="shrink-0 text-sm text-clay">to</span>
      <input
        type={type}
        step={step}
        value={filter.max ?? ''}
        onChange={(e) => onChange({ ...filter, max: e.target.value, value: undefined })}
        placeholder="To"
        aria-label={`${filter.name} to${unit ? ` (${unit})` : ''}`}
        className={INPUT}
      />
      {unit && <span className="shrink-0 text-xs text-clay">{unit}</span>}
    </div>
  );
}

/**
 * Pick one of a project's fields, then a value that fits its type: words to
 * look for in text, a range for numbers, hours and dates, yes or no for a
 * toggle. `filter` is null until a field is chosen.
 */
export default function FieldFilterControls({
  fields,
  filter,
  onChange,
}: {
  fields: FieldShape[];
  filter: FieldFilter | null;
  onChange: (next: FieldFilter | null) => void;
}) {
  if (fields.length === 0) {
    return <p className="text-xs text-clay">This project has no fields to filter by yet.</p>;
  }

  const pick = (name: string) => {
    const field = fields.find((f) => f.name === name);
    onChange(field ? { name: field.name, fieldType: field.fieldType } : null);
  };

  return (
    <div className="flex flex-col gap-2">
      <select
        value={filter?.name ?? ''}
        onChange={(e) => pick(e.target.value)}
        aria-label="Field"
        className={INPUT}
      >
        <option value="">Any field</option>
        {fields.map((field) => (
          <option key={field.name} value={field.name}>
            {field.name}
          </option>
        ))}
      </select>

      {filter?.fieldType === 'boolean' && (
        <div role="group" aria-label={filter.name} className="flex gap-2">
          {(['true', 'false'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter.value === option}
              onClick={() => onChange({ ...filter, value: option })}
              className={`min-h-11 flex-1 rounded-lg px-3 text-[13px] font-semibold md:min-h-10 ${
                filter.value === option
                  ? 'bg-gold text-espresso'
                  : 'border border-line text-espresso'
              }`}
            >
              {option === 'true' ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      )}

      {(filter?.fieldType === 'number' || filter?.fieldType === 'duration') && (
        <RangeInputs
          filter={filter}
          type="number"
          step="any"
          unit={filter.fieldType === 'duration' ? 'hours' : undefined}
          onChange={onChange}
        />
      )}

      {filter?.fieldType === 'date' && (
        <RangeInputs filter={filter} type="date" onChange={onChange} />
      )}

      {filter && !['boolean', 'number', 'duration', 'date'].includes(filter.fieldType) && (
        <input
          type="search"
          value={filter.value ?? ''}
          onChange={(e) => onChange({ ...filter, value: e.target.value })}
          placeholder={`Words in ${filter.name}`}
          aria-label={`${filter.name} contains`}
          className={INPUT}
        />
      )}
    </div>
  );
}
