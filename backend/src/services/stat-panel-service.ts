import { prisma } from '../lib/prisma.js';
import { parseExpression, evaluate, ExpressionError, type FieldValues } from '../lib/expression.js';

export type Aggregation = 'sum' | 'average';

export interface PanelComputation {
  value: number;
  sampleCount: number;
  series: { date: string; value: number }[];
}

const NUMERIC_TYPES = new Set(['number', 'duration']);
const DAY_MS = 24 * 60 * 60 * 1000;

/** One entry, as the panel evaluator needs it. */
type PanelEntry = { date: Date; content: unknown };

async function getNumericFieldNames(projectId: number): Promise<string[]> {
  const fields = await prisma.fieldDefinition.findMany({
    where: { projectId },
    select: { name: true, fieldType: true },
  });
  return fields.filter((f) => NUMERIC_TYPES.has(f.fieldType)).map((f) => f.name);
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDayBuckets(rangeDays: number): string[] {
  const buckets: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = rangeDays - 1; i >= 0; i--) {
    buckets.push(toDateKey(new Date(today.getTime() - i * DAY_MS)));
  }
  return buckets;
}

/**
 * Parses a panel expression into an AST, or throws the `status: 400` error the
 * routes already translate into a bad-request response.
 */
function parseOrThrow(expression: string, fieldNames: string[]) {
  try {
    return parseExpression(expression, fieldNames);
  } catch (err) {
    if (err instanceof ExpressionError) {
      const wrapped = new Error(err.message);
      (wrapped as { status?: number }).status = 400;
      throw wrapped;
    }
    throw err;
  }
}

/**
 * Evaluates one parsed expression over entries that have already been loaded.
 *
 * This is the shared core of both panel paths, and it deliberately does no
 * I/O: the single-panel path loads one range of entries for it, and the
 * batched list loads one range covering every panel. That is what stops the
 * query count growing with the number of panels - the N+1 the baseline
 * measured as `4 + 2 per panel`.
 */
function computeFromEntries(
  ast: ReturnType<typeof parseExpression>,
  aggregation: Aggregation,
  rangeDays: number,
  entries: PanelEntry[],
  now: number,
): PanelComputation {
  const since = now - rangeDays * DAY_MS;

  const perDay = new Map<string, number[]>();
  for (const bucket of buildDayBuckets(rangeDays)) {
    perDay.set(bucket, []);
  }

  let total = 0;
  let sampleCount = 0;

  for (const entry of entries) {
    // The batched list reads from the widest panel's range, so a panel with a
    // shorter range discards the extra days here rather than re-querying.
    if (entry.date.getTime() < since) continue;

    const values = (entry.content ?? {}) as FieldValues;
    const result = evaluate(ast, values);
    if (result === null) continue;

    total += result;
    sampleCount++;

    const key = toDateKey(entry.date);
    const bucket = perDay.get(key);
    if (bucket) bucket.push(result);
  }

  const value = aggregation === 'average' ? (sampleCount > 0 ? total / sampleCount : 0) : total;

  const series = Array.from(perDay.entries()).map(([date, vals]) => ({
    date,
    value: vals.reduce((a, b) => a + b, 0),
  }));

  return { value, sampleCount, series };
}

function entriesSince(projectId: number, since: Date) {
  return prisma.entry.findMany({
    where: { projectId, date: { gte: since }, deletedAt: null },
    select: { date: true, content: true },
    orderBy: { date: 'asc' },
  });
}

export async function computePanelValue(
  projectId: number,
  expression: string,
  aggregation: Aggregation,
  rangeDays: number,
): Promise<PanelComputation> {
  const now = Date.now();
  const fieldNames = await getNumericFieldNames(projectId);
  const ast = parseOrThrow(expression, fieldNames);
  const entries = await entriesSince(projectId, new Date(now - rangeDays * DAY_MS));
  return computeFromEntries(ast, aggregation, rangeDays, entries, now);
}

export async function listPanelsForProject(
  userId: string,
  projectId: number,
  opts: { includeHidden?: boolean } = {},
) {
  const panels = await prisma.statPanel.findMany({
    where: {
      userId,
      projectId,
      ...(opts.includeHidden ? {} : { hidden: false }),
    },
    orderBy: { position: 'asc' },
  });
  if (panels.length === 0) return [];

  // One lookup of the project's numeric fields and one read of its entries,
  // shared by every panel, instead of two queries per panel.
  const now = Date.now();
  const fieldNames = await getNumericFieldNames(projectId);
  const widestRange = Math.max(...panels.map((p) => p.rangeDays));
  const entries = await entriesSince(projectId, new Date(now - widestRange * DAY_MS));

  return panels.map((p) => {
    try {
      const ast = parseOrThrow(p.expression, fieldNames);
      return {
        ...p,
        ...computeFromEntries(ast, p.aggregation as Aggregation, p.rangeDays, entries, now),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Evaluation failed';
      return {
        ...p,
        value: null,
        sampleCount: 0,
        series: [],
        error: message,
      };
    }
  });
}

/**
 * Every panel the user has saved, across all their active projects, with its
 * value computed - for the global dashboard, which shows panels from any
 * project. Each panel carries its project's name and field types so the
 * dashboard can label and format it without a request per project.
 */
export async function listPanelsForUser(userId: string) {
  const panels = await prisma.statPanel.findMany({
    where: { userId, project: { userId, archived: false } },
    include: {
      project: {
        select: { id: true, name: true, fields: { select: { name: true, fieldType: true } } },
      },
    },
    orderBy: [{ projectId: 'asc' }, { position: 'asc' }],
  });

  return Promise.all(
    panels.map(async ({ project, ...panel }) => {
      const base = {
        ...panel,
        project: { id: project.id, name: project.name },
        fields: project.fields,
      };
      try {
        const computed = await computePanelValue(
          panel.projectId,
          panel.expression,
          panel.aggregation as Aggregation,
          panel.rangeDays,
        );
        return { ...base, ...computed };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Evaluation failed';
        return { ...base, value: null, sampleCount: 0, series: [], error: message };
      }
    }),
  );
}

export async function createPanel(
  userId: string,
  projectId: number,
  input: {
    name: string;
    expression: string;
    aggregation?: Aggregation;
    rangeDays?: number;
    hidden?: boolean;
  },
) {
  const aggregation: Aggregation = input.aggregation ?? 'sum';
  const rangeDays = input.rangeDays ?? 30;

  const computed = await computePanelValue(projectId, input.expression, aggregation, rangeDays);

  const maxPosition = await prisma.statPanel.aggregate({
    where: { userId, projectId },
    _max: { position: true },
  });

  const panel = await prisma.statPanel.create({
    data: {
      userId,
      projectId,
      name: input.name,
      expression: input.expression,
      aggregation,
      rangeDays,
      hidden: input.hidden ?? false,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });

  return { ...panel, ...computed };
}
