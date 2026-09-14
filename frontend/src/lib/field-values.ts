import type { FieldDefinition } from '@/types';

export type FieldValue = string | number | boolean;

export function defaultValueForType(fieldType: string): FieldValue {
  return fieldType === 'boolean' ? false : '';
}

export function toContentValue(fieldType: string, raw: FieldValue): unknown {
  if (fieldType === 'number' || fieldType === 'duration') {
    if (raw === '') return raw;
    const num = Number(raw);
    return Number.isNaN(num) ? raw : num;
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
