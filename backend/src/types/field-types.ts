export const FIELD_TYPES = ['text', 'number', 'date', 'duration', 'boolean'] as const;

export const FIELD_VALIDATOR = {
  text: (value: unknown) => {
    return typeof value === 'string';
  },

  number: (value: unknown) => {
    return typeof value === 'number' && Number.isFinite(value);
  },

  boolean: (value: unknown) => {
    return typeof value === 'boolean';
  },

  date: (value: unknown) => {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
  },

  duration: (value: unknown) => {
    return typeof value === 'number' && Number.isFinite(value);
  },
};
