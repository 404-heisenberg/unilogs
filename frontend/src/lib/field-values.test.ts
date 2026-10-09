import { describe, expect, it } from 'vitest';
import { buildContent, toContentValue } from './field-values';

describe('toContentValue', () => {
  it('turns plain numbers into numbers', () => {
    expect(toContentValue('number', '12')).toBe(12);
    expect(toContentValue('number', '')).toBe('');
  });

  it('parses duration strings into hours', () => {
    expect(toContentValue('duration', '2:30')).toBe(2.5);
    expect(toContentValue('duration', '1h 30m')).toBe(1.5);
    expect(toContentValue('duration', '45')).toBe(45);
    expect(toContentValue('duration', '')).toBe('');
  });

  it('leaves text and booleans untouched', () => {
    expect(toContentValue('text', 'Chest day')).toBe('Chest day');
    expect(toContentValue('boolean', false)).toBe(false);
  });
});

describe('buildContent', () => {
  it('converts every field value through toContentValue', () => {
    const fields = [
      { id: 1, projectId: 1, name: 'Notes', fieldType: 'text' },
      { id: 2, projectId: 1, name: 'Length', fieldType: 'duration' },
    ];
    expect(buildContent(fields, { Notes: 'Chest day', Length: '2:30' })).toEqual({
      Notes: 'Chest day',
      Length: 2.5,
    });
  });
});
