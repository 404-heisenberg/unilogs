import { Prisma } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';
import type { FieldFilter } from './entryFilters.js';

// Searching and filtering inside an entry's field values (`Entry.content`,
// a jsonb object keyed by field name). Prisma's JSON filters handle numbers
// and booleans, but can't match text case-insensitively or compare dates, so
// those go through a small parameterised query that returns matching ids.
// Every query here is scoped to the caller and skips soft-deleted entries.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `%` and `_` in what the user typed are literal, not wildcards. */
function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

async function matchingIds(condition: Prisma.Sql, scope: Prisma.Sql): Promise<number[]> {
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT e.id
    FROM entries e
    JOIN projects p ON p.id = e."projectId"
    WHERE ${scope}
      AND e."deletedAt" IS NULL
      AND jsonb_typeof(e.content) = 'object'
      AND ${condition}
  `;
  return rows.map((row) => row.id);
}

/** Ids of the user's entries with any field value containing `term`. */
export function contentSearchIds(userId: string, term: string): Promise<number[]> {
  return matchingIds(
    Prisma.sql`EXISTS (
      SELECT 1 FROM jsonb_each_text(e.content) AS kv(key, value)
      WHERE kv.value ILIKE ${containsPattern(term)} ESCAPE '\\'
    )`,
    Prisma.sql`p."userId" = ${userId}`,
  );
}

function toNumber(raw: string | undefined, label: string): number | undefined | string {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : `${label} must be a number`;
}

/**
 * The condition a field filter adds, worked out from the field's type:
 *
 *  - text     `value` matches as a case-insensitive "contains"
 *  - number,  `value` is exact; `min` / `max` are inclusive bounds
 *    duration   (durations are stored in hours)
 *  - date     `value` is one day; `min` / `max` are inclusive YYYY-MM-DD bounds
 *  - boolean  `value` is `true` or `false`
 *
 * Returns an error message for a 400 when the field isn't the project's or
 * the value doesn't fit its type.
 */
export async function fieldFilterWhere(
  userId: string,
  filter: FieldFilter,
): Promise<Prisma.EntryWhereInput | string> {
  const field = await prisma.fieldDefinition.findFirst({
    where: { projectId: filter.projectId, name: filter.name, project: { userId } },
    select: { name: true, fieldType: true },
  });
  if (!field) return `This project has no field named "${filter.name}"`;

  const path = [field.name];
  const scope = Prisma.sql`e."projectId" = ${filter.projectId} AND p."userId" = ${userId}`;

  switch (field.fieldType) {
    case 'number':
    case 'duration': {
      const value = toNumber(filter.value, 'value');
      const min = toNumber(filter.min, 'min');
      const max = toNumber(filter.max, 'max');
      for (const parsed of [value, min, max]) {
        if (typeof parsed === 'string') return parsed;
      }
      const conditions: Prisma.EntryWhereInput[] = [];
      if (value !== undefined) conditions.push({ content: { path, equals: value as number } });
      if (min !== undefined) conditions.push({ content: { path, gte: min as number } });
      if (max !== undefined) conditions.push({ content: { path, lte: max as number } });
      return { AND: conditions };
    }

    case 'boolean': {
      if (filter.min !== undefined || filter.max !== undefined) {
        return 'A toggle field takes value=true or value=false';
      }
      if (filter.value !== 'true' && filter.value !== 'false') {
        return 'A toggle field takes value=true or value=false';
      }
      return { content: { path, equals: filter.value === 'true' } };
    }

    case 'date': {
      for (const bound of [filter.value, filter.min, filter.max]) {
        if (bound !== undefined && !ISO_DAY.test(bound)) return 'Dates must be YYYY-MM-DD';
      }
      // Stored as YYYY-MM-DD strings, which sort the same as the dates.
      const day = Prisma.sql`e.content ->> ${field.name}`;
      const parts: Prisma.Sql[] = [];
      if (filter.value !== undefined) parts.push(Prisma.sql`${day} = ${filter.value}`);
      if (filter.min !== undefined) parts.push(Prisma.sql`${day} >= ${filter.min}`);
      if (filter.max !== undefined) parts.push(Prisma.sql`${day} <= ${filter.max}`);
      return { id: { in: await matchingIds(Prisma.join(parts, ' AND '), scope) } };
    }

    default: {
      // Text, and any type added later: a case-insensitive "contains".
      if (filter.value === undefined) return 'A text field takes a value to search for';
      const text = Prisma.sql`e.content ->> ${field.name}`;
      return {
        id: {
          in: await matchingIds(
            Prisma.sql`${text} ILIKE ${containsPattern(filter.value)} ESCAPE '\\'`,
            scope,
          ),
        },
      };
    }
  }
}
