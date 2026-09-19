import { FIELD_TYPES, FIELD_VALIDATOR } from '../types/field-types.js';

interface FieldDef {
  name: string;
  fieldType: string;
}

export function validateEntryContent(content: unknown, fields: FieldDef[]): string[] {
  if (fields.length === 0) return [];

  if (typeof content !== 'object' || content === null || Array.isArray(content)) {
    return ['Content must be an object'];
  }

  const errors: string[] = [];
  const record = content as Record<string, unknown>;
  const contentKeys = Object.keys(record);
  const fieldNames = fields.map((f) => f.name);

  for (const name of fieldNames) {
    if (!contentKeys.includes(name)) {
      errors.push(`Field '${name}' is required`);
    }
  }

  for (const key of contentKeys) {
    if (!fieldNames.includes(key)) {
      errors.push(`Unknown field '${key}'`);
    }
  }

  for (const field of fields) {
    const value = record[field.name];
    if (value === undefined) continue;

    const validator = FIELD_VALIDATOR[field.fieldType as keyof typeof FIELD_VALIDATOR];
    if (validator && !validator(value)) {
      const label = FIELD_TYPES.includes(field.fieldType as (typeof FIELD_TYPES)[number])
        ? field.fieldType
        : 'unknown type';
      errors.push(`Field '${field.name}' must be a ${label}`);
    }
  }

  return errors;
}
export function isWhollyEmpty(
  title: string | null | undefined,
  body: string | null | undefined,
  content: Record<string, unknown> | null | undefined,
): boolean {
  const hasTitle = (title ?? '').trim().length > 0;
  const hasBody = (body ?? '').trim().length > 0;
  const hasContent =
    content != null &&
    Object.values(content).some((v) => {
      if (v === null || v === undefined) return false;
      if (typeof v === 'string') return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    });

  return !hasTitle && !hasBody && !hasContent;
}
