import type { Entry, FieldDefinition } from '@/types';

function csvCell(value: unknown): string {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function entriesToCSV(entries: Entry[], fields: FieldDefinition[]): string {
  const headers = ['Date', 'Title', 'Notes', ...fields.map((f) => f.name), 'Tags'];
  const rows = entries.map((entry) => [
    entry.date.slice(0, 10),
    entry.title ?? '',
    entry.body ?? '',
    ...fields.map((f) => entry.content[f.name] ?? ''),
    (entry.tags ?? []).map((t) => t.tag.name).join('; '),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function entriesToMarkdown(
  entries: Entry[],
  fields: FieldDefinition[],
  projectName: string,
): string {
  const lines = [`# ${projectName}`, ''];
  for (const entry of entries) {
    lines.push(`## ${entry.title ?? entry.date.slice(0, 10)}`, '');
    lines.push(`*${entry.date.slice(0, 10)}*`, '');
    if (entry.body) lines.push(entry.body, '');
    for (const field of fields) {
      const value = entry.content[field.name];
      if (value !== undefined && value !== '') lines.push(`- **${field.name}:** ${value}`);
    }
    if (entry.tags && entry.tags.length > 0) {
      lines.push(`- **Tags:** ${entry.tags.map((t) => t.tag.name).join(', ')}`);
    }
    lines.push('', '---', '');
  }
  return lines.join('\n');
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
