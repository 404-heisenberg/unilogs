import { describe, expect, it } from 'vitest';
import { validateEntryContent } from '../src/lib/validateEntry.js';

const fields = [
  { name: 'title', fieldType: 'text' },
  { name: 'hours', fieldType: 'number' },
];

describe('validateEntryContent', () => {
  it('accepts content that matches every field definition', () => {
    expect(validateEntryContent({ title: 'Lecture notes', hours: 2 }, fields)).toEqual([]);
  });

  it('accepts any content when a project has no field definitions', () => {
    expect(validateEntryContent({ extra: true }, [])).toEqual([]);
  });

  it('rejects content that is not an object', () => {
    expect(validateEntryContent('lecture notes', fields)).toEqual(['Content must be an object']);
  });

  it('reports each missing required field', () => {
    expect(validateEntryContent({ hours: 2 }, fields)).toEqual(["Field 'title' is required"]);
  });

  it('reports values with the wrong field type', () => {
    expect(validateEntryContent({ title: 'Lecture notes', hours: 'two' }, fields)).toEqual([
      "Field 'hours' must be a number",
    ]);
  });

  it('reports unknown content keys', () => {
    expect(validateEntryContent({ title: 'Lecture notes', hours: 2, extra: true }, fields)).toEqual(
      ["Unknown field 'extra'"],
    );
  });
});
