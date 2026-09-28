// Keep in sync with backend/src/types/field-types.ts — the backend is the
// source of truth and rejects any fieldType outside this list.
export const FIELD_TYPES = ['text', 'number', 'date', 'duration', 'boolean'] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

// What each type is called in the UI (Figma's Fields tab). 'boolean' is a
// yes/no switch, shown to users as Toggle.
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  duration: 'Duration',
  boolean: 'Toggle',
};
