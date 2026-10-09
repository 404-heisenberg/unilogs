import { parseDurationHours } from './time';
import type { FieldDefinition } from '@/types';

export type FieldValue = string | number | boolean;

export function defaultValueForType(fieldType: string): FieldValue {
  return fieldType === 'boolean' ? false : '';
}

export function toContentValue(fieldType: string, raw: FieldValue): unknown {
  if (fieldType === 'number') {
    if (raw === '') return raw;
    const num = Number(raw);
    return Number.isNaN(num) ? raw : num;
  }
  if (fieldType === 'duration') {
    // Durations are stored as hours; "2:30" must arrive as 2.5 for the
    // backend to sum them.
    if (raw === '') return raw;
    return parseDurationHours(String(raw)) ?? raw;
  }
  if (fieldType === 'boolean') return Boolean(raw);
  return raw;
}

export function buildContent(
  fields: FieldDefinition[],
  values: Record<string, FieldValue>,
): Record<string, unknown> {
  const content: Record<string, unknown> = {};
  for (const field of fields) {
    content[field.name] = toContentValue(field.fieldType, values[field.name] ?? '');
  }
  return content;
}
