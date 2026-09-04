// Keep in sync with backend/src/types/field-types.ts — the backend is the
// source of truth and rejects any fieldType outside this list.
export const FIELD_TYPES = ['text', 'number', 'date', 'duration', 'boolean'] as const;

export type FieldType = (typeof FIELD_TYPES)[number];
