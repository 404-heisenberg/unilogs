function csvEscaping(value: unknown): string {
  const stringValue = String(value ?? '');

  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    let escapedValue = stringValue;
    escapedValue = escapedValue.replace(/"/g, '""');
    return `"${escapedValue}"`;
  }

  return stringValue;
}

type ExportEntry = {
  date: Date;
  title: string | null;
  body: string | null;
  content: unknown;
};

type ExportField = {
  name: string;
};

export function buildCsv(entries: ExportEntry[], fields: ExportField[]): string {
  const headers = ['date', 'title'];
  for (const field of fields) {
    headers.push(field.name);
  }

  const escapedHeaders = headers.map(csvEscaping);
  const headerRow = escapedHeaders.join(',');
  const rows: string[] = [];

  for (const entry of entries) {
    const date = csvEscaping(entry.date);
    const title = csvEscaping(entry.title);

    const content = entry.content as Record<string, unknown>;

    const values = [date, title];

    for (const field of fields) {
      values.push(csvEscaping(content[field.name]));
    }

    const row = values.join(',');

    rows.push(row);
  }

  return [headerRow, ...rows].join('\n');
}
