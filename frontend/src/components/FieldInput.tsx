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
  const inputClassName = `w-full rounded-md border px-3 py-2 text-sm text-[#1c0d06] outline-none focus:ring-2 ${
    error ? 'border-red-500 focus:ring-red-500' : 'border-[#d4a373]/60 focus:ring-[#1c0d06]'
  }`;

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm text-[#4a3525]">
        {field.name}
      </label>
      {field.fieldType === 'boolean' ? (
        <input
          id={inputId}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-[#d4a373] accent-[#1c0d06]"
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
          placeholder={field.fieldType === 'duration' ? 'minutes' : undefined}
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
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
