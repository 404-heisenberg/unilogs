import { formatDurationHours, formatShortDate } from '@/lib/project-workspace';
import type { FieldDefinition } from '@/types';

// Showing, searching and filtering entries by their field values (#314).

export type FieldShape = Pick<FieldDefinition, 'name' | 'fieldType'>;

/** A field value as a short label, or null when it's empty. */
export function formatFieldValue(value: unknown, fieldType: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  switch (fieldType) {
    case 'boolean':
      return value === true ? 'Yes' : 'No';
    case 'duration':
      return typeof value === 'number' ? formatDurationHours(value) : String(value);
    case 'date':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? formatShortDate(value)
        : String(value);
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    default:
      return String(value).trim() || null;
  }
}

/**
 * An entry's filled-in fields, in the project's field order. Without field
 * definitions (an older response) it falls back to the stored keys as text.
 */
export function entryFieldPairs(
  content: Record<string, unknown>,
  fields: FieldShape[] | undefined,
): { name: string; text: string }[] {
  const shapes = fields ?? Object.keys(content).map((name) => ({ name, fieldType: 'text' }));
  return shapes.flatMap(({ name, fieldType }) => {
    const text = formatFieldValue(content[name], fieldType);
    return text === null ? [] : [{ name, text }];
  });
}

/**
 * One field, matched by `value` or an inclusive `min`/`max` range. What
 * `value` means depends on the field's type: a toggle is 'true' or 'false',
 * text is "contains", the rest are exact.
 */
export type FieldFilter = {
  name: string;
  fieldType: string;
  value?: string;
  min?: string;
  max?: string;
};

/** Whether the filter has anything to match yet. */
export function isFieldFilterReady(filter: FieldFilter | null): filter is FieldFilter {
  return !!filter && [filter.value, filter.min, filter.max].some((part) => !!part?.trim());
}

/** The query parameters for GET /api/entries (which also needs projectId). */
export function fieldFilterParams(filter: FieldFilter | null): Record<string, string> {
  if (!isFieldFilterReady(filter)) return {};
  const params: Record<string, string> = { field: filter.name };
  for (const key of ['value', 'min', 'max'] as const) {
    const part = filter[key]?.trim();
    if (part) params[key] = part;
  }
  return params;
}

function bound(raw: string, fieldType: string): string {
  if (fieldType === 'duration') return formatDurationHours(Number(raw));
  if (fieldType === 'date') return formatShortDate(raw);
  return raw;
}

/** `Pages read is at least 20`, `Chapter contains "intro"`, `Done is Yes`. */
export function describeFieldFilter(filter: FieldFilter): string {
  const { name, fieldType } = filter;
  const value = filter.value?.trim();
  const min = filter.min?.trim();
  const max = filter.max?.trim();

  if (fieldType === 'boolean') return `${name} is ${value === 'true' ? 'Yes' : 'No'}`;
  if (value) {
    return fieldType === 'text'
      ? `${name} contains “${value}”`
      : `${name} is ${bound(value, fieldType)}`;
  }
  if (min && max) return `${name} is ${bound(min, fieldType)} to ${bound(max, fieldType)}`;
  if (min) return `${name} is at least ${bound(min, fieldType)}`;
  return `${name} is at most ${bound(max ?? '', fieldType)}`;
}

/**
 * Says the filters' AND semantics in plain words, as round 2 testing asked:
 * "Showing entries that match all of: Thesis, Pages read is at least 20 and
 * the last 7 days." Null when nothing is filtered.
 */
export function filterSummary(parts: string[]): string | null {
  if (parts.length === 0) return null;
  if (parts.length === 1) return `Showing entries that match: ${parts[0]}.`;
  const list = `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `Showing entries that match all of: ${list}.`;
}
