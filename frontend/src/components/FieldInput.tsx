import type { FieldDefinition } from '@/types';
import type { FieldValue } from '@/lib/field-values';

export function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDefinition;
  value: FieldValue;
  error?: string;
  onChange: (value: FieldValue) => void;
}) {
  const inputId = `field-${field.id}`;
  const inputClassName = `min-h-11 w-full rounded-lg border px-3 py-2 text-sm text-espresso outline-none focus:ring-2 md:min-h-10 ${
    error ? 'border-error focus:ring-error' : 'border-caramel/60 focus:ring-espresso'
  }`;

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm text-cocoa">
        {field.name}
      </label>
      {field.fieldType === 'boolean' ? (
        <input
          id={inputId}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-caramel accent-espresso"
        />
      ) : field.fieldType === 'date' ? (
        <input
          id={inputId}
          type="date"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        />
      ) : field.fieldType === 'number' || field.fieldType === 'duration' ? (
        <input
          id={inputId}
          type="number"
          value={value as string | number}
          onChange={(e) => onChange(e.target.value)}
          // Durations are stored in hours (the backend sums them as hours).
          placeholder={field.fieldType === 'duration' ? 'Hours, e.g. 1.5' : undefined}
          className={inputClassName}
        />
      ) : (
        <input
          id={inputId}
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        />
      )}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}
