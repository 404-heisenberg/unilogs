import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseExpression, evaluate, ExpressionError, type FieldValues } from '../lib/expression.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

export type Aggregation = 'sum' | 'average';

export interface PanelComputation {
  value: number;
  sampleCount: number;
  series: { date: string; value: number }[];
}

const NUMERIC_TYPES = new Set(['number', 'duration']);
const DAY_MS = 24 * 60 * 60 * 1000;

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

export async function computePanelValue(
  projectId: number,
  expression: string,
  aggregation: Aggregation,
  rangeDays: number,
): Promise<PanelComputation> {
  const fieldNames = await getNumericFieldNames(projectId);

  let ast;
  try {
    ast = parseExpression(expression, fieldNames);
  } catch (err) {
    if (err instanceof ExpressionError) {
      const wrapped = new Error(err.message);
      (wrapped as { status?: number }).status = 400;
      throw wrapped;
    }
    throw err;
  }

  const since = new Date(Date.now() - rangeDays * DAY_MS);

  const entries = await prisma.entry.findMany({
    where: {
      projectId,
      date: { gte: since },
      deletedAt: null,
    },
    select: { date: true, content: true },
    orderBy: { date: 'asc' },
  });

  const perDay = new Map<string, number[]>();
  for (const bucket of buildDayBuckets(rangeDays)) {
    perDay.set(bucket, []);
  }

  let total = 0;
  let sampleCount = 0;

  for (const entry of entries) {
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

  return Promise.all(
    panels.map(async (p) => {
      try {
        const computed = await computePanelValue(
          p.projectId,
          p.expression,
          p.aggregation as Aggregation,
          p.rangeDays,
        );
        return { ...p, ...computed };
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
    }),
  );
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
