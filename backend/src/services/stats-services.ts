import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function getDistinctEntryDates(userId: string): Promise<string[]> {
  // Only the distinct days matter for the streak, so let Postgres collapse the
  // rows instead of shipping every entry date to the app and de-duplicating in
  // JS. `date` is TIMESTAMP(3), so to_char returns the same calendar day that
  // the previous `toISOString().split('T')[0]` produced.
  const rows = await prisma.$queryRaw<{ day: string }[]>`
    SELECT DISTINCT to_char(e.date, 'YYYY-MM-DD') AS day
    FROM entries e
    JOIN projects p ON p.id = e."projectId"
    WHERE p."userId" = ${userId} AND p.archived = false
  `;

  return rows.map((row) => row.day);
}

export async function computeCurrentStreak(userId: string): Promise<number> {
  const dateSet = await getDistinctEntryDates(userId);

  if (dateSet.length === 0) {
    return 0;
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let endDateStr: string;
  if (dateSet.includes(todayStr)) {
    endDateStr = todayStr;
  } else if (dateSet.includes(yesterdayStr)) {
    endDateStr = yesterdayStr;
  } else {
    return 0;
  }

  let streak = 0;
  const currentDate = new Date(endDateStr);

  while (true) {
    const dateStr = currentDate.toISOString().split('T')[0];
    if (dateSet.includes(dateStr)) {
      streak++;
      currentDate.setUTCDate(currentDate.getUTCDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

type FieldInsight = {
  name: string;
  fieldType: string;
  family: string;
  value?: unknown;
  valueMinutes?: number;
  trend: {
    deltaPct: number | null;
    direction: 'up' | 'down' | 'flat' | null;
  };
  sampleCount: number;
  hasData?: boolean;
};

function calculateSum(values: number[]): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }

  return total;
}

function calculateMax(values: number[]): number {
  let max = values[0];
  for (const value of values) {
    if (value > max) {
      max = value;
    }
  }
  return max;
}

function getWeekStart(date: Date): Date {
  const weekStart = new Date(date);
  const day = weekStart.getUTCDay();

  const daysSinceMonday = day === 0 ? 6 : day - 1;

  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);
  weekStart.setUTCHours(0, 0, 0, 0);

  return weekStart;
}

function getPreviousWeekStart(currentWeekStart: Date): Date {
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);

  return previousWeekStart;
}

function calculateMin(values: number[]): number {
  let min = values[0];
  for (const value of values) {
    if (value < min) {
      min = value;
    }
  }

  return min;
}

function calculateTrend(
  currentValue: number | null,
  previousValue: number | null,
): { deltaPct: number | null; direction: 'up' | 'down' | 'flat' | null } {
  if (currentValue === null || previousValue === null) {
    return {
      deltaPct: null,
      direction: null,
    };
  }

  const deltaPct =
    previousValue !== 0 ? ((currentValue - previousValue) / previousValue) * 100 : null;

  let direction: 'up' | 'down' | 'flat';

  if (currentValue > previousValue) {
    direction = 'up';
  } else if (currentValue < previousValue) {
    direction = 'down';
  } else {
    direction = 'flat';
  }

  return { deltaPct, direction };
}
export async function buildFieldInsights(projectId: number, userId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
      archived: false,
    },
    include: {
      fields: {
        select: {
          name: true,
          fieldType: true,
          aggregationOverride: true,
        },
      },
    },
  });

  if (!project) {
    return null;
  }

  const fields = project.fields;

  const entries = await prisma.entry.findMany({
    where: {
      projectId,
    },
    select: {
      date: true,
      content: true,
    },
  });

  const currentWeekStart = getWeekStart(new Date());
  const previousWeekStart = getPreviousWeekStart(currentWeekStart);

  const insights: FieldInsight[] = [];

  for (const field of fields) {
    let family = field.fieldType;

    if (field.fieldType === 'number' && field.aggregationOverride) {
      family = field.aggregationOverride;
    }

    const values: number[] = [];
    const currentWeekValues: number[] = [];
    const previousWeekValues: number[] = [];

    const currentWeekDurationValues: number[] = [];
    const previousWeekDurationValues: number[] = [];
    const durationValues: number[] = [];

    const currentWeekTextValues: string[] = [];
    const previousWeekTextValues: string[] = [];
    const textValues: string[] = [];

    const booleanValues: boolean[] = [];
    const currentWeekBooleanValues: boolean[] = [];
    const previousWeekBooleanValues: boolean[] = [];

    const dateValues: string[] = [];

    for (const entry of entries) {
      const content = entry.content as Record<string, unknown>;
      const value = content[field.name];

      if (field.fieldType === 'number' && typeof value === 'number') {
        values.push(value);

        if (entry.date >= currentWeekStart) {
          currentWeekValues.push(value);
        } else if (entry.date >= previousWeekStart) {
          previousWeekValues.push(value);
        }
      }

      if (field.fieldType === 'duration' && typeof value === 'number') {
        durationValues.push(value);

        if (entry.date >= currentWeekStart) {
          currentWeekDurationValues.push(value);
        } else if (entry.date >= previousWeekStart) {
          previousWeekDurationValues.push(value);
        }
      }

      if (field.fieldType === 'text' && typeof value === 'string') {
        textValues.push(value);

        if (entry.date >= currentWeekStart) {
          currentWeekTextValues.push(value);
        } else if (entry.date >= previousWeekStart) {
          previousWeekTextValues.push(value);
        }
      }

      if (field.fieldType === 'boolean' && typeof value === 'boolean') {
        booleanValues.push(value);

        if (entry.date >= currentWeekStart) {
          currentWeekBooleanValues.push(value);
        } else if (entry.date >= previousWeekStart) {
          previousWeekBooleanValues.push(value);
        }
      }

      if (field.fieldType === 'date' && typeof value === 'string') {
        dateValues.push(value);
      }
    }

    if (field.fieldType === 'number' && values.length === 0) {
      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family,
        hasData: false,
        sampleCount: 0,
        trend: {
          deltaPct: null,
          direction: null,
        },
      });

      continue;
    }
    if (family === 'number') {
      const total = calculateSum(values);
      const average = total / values.length;

      const currentWeekTotal = calculateSum(currentWeekValues);
      const previousWeekTotal = calculateSum(previousWeekValues);

      const trend = calculateTrend(
        currentWeekValues.length > 0 ? currentWeekTotal : null,
        previousWeekValues.length > 0 ? previousWeekTotal : null,
      );
      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family,
        value: {
          average,
          total,
        },
        sampleCount: values.length,
        trend,
      });
    }

    if (family === 'sum') {
      const total = calculateSum(values);

      const currentWeekTotal = calculateSum(currentWeekValues);
      const previousWeekTotal = calculateSum(previousWeekValues);

      const trend = calculateTrend(
        currentWeekValues.length > 0 ? currentWeekTotal : null,
        previousWeekValues.length > 0 ? previousWeekTotal : null,
      );

      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family,
        value: total,
        sampleCount: values.length,
        trend,
      });
    }

    if (family === 'average') {
      const total = calculateSum(values);
      const average = total / values.length;

      const currentWeekTotal = calculateSum(currentWeekValues);
      const previousWeekTotal = calculateSum(previousWeekValues);

      const currentWeekAverage =
        currentWeekValues.length > 0 ? currentWeekTotal / currentWeekValues.length : null;
      const previousWeekAverage =
        previousWeekValues.length > 0 ? previousWeekTotal / previousWeekValues.length : null;

      const trend = calculateTrend(currentWeekAverage, previousWeekAverage);

      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family,
        value: average,
        sampleCount: values.length,
        trend,
      });
    }

    if (family === 'max') {
      const max = calculateMax(values);

      const currentWeekMax = currentWeekValues.length > 0 ? calculateMax(currentWeekValues) : null;
      const previousWeekMax =
        previousWeekValues.length > 0 ? calculateMax(previousWeekValues) : null;

      const trend = calculateTrend(currentWeekMax, previousWeekMax);
      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family,
        value: max,
        sampleCount: values.length,
        trend,
      });
    }

    if (family === 'min') {
      const min = calculateMin(values);

      const currentWeekMin = currentWeekValues.length > 0 ? calculateMin(currentWeekValues) : null;
      const previousWeekMin =
        previousWeekValues.length > 0 ? calculateMin(previousWeekValues) : null;

      const trend = calculateTrend(currentWeekMin, previousWeekMin);

      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family,
        value: min,
        sampleCount: values.length,
        trend,
      });
    }

    if (field.fieldType === 'duration') {
      if (durationValues.length === 0) {
        insights.push({
          name: field.name,
          fieldType: field.fieldType,
          family: 'sum',
          hasData: false,
          sampleCount: 0,
          trend: {
            deltaPct: null,
            direction: null,
          },
        });
        continue;
      }
      const totalHours = calculateSum(durationValues);
      const totalMinutes = totalHours * 60;

      const currentWeekMinutes = calculateSum(currentWeekDurationValues) * 60;
      const previousWeekMinutes = calculateSum(previousWeekDurationValues) * 60;

      const trend = calculateTrend(
        currentWeekDurationValues.length > 0 ? currentWeekMinutes : null,
        previousWeekDurationValues.length > 0 ? previousWeekMinutes : null,
      );
      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family: 'sum',
        valueMinutes: totalMinutes,
        sampleCount: durationValues.length,
        trend,
      });
    }

    if (field.fieldType === 'text') {
      if (textValues.length === 0) {
        insights.push({
          name: field.name,
          fieldType: field.fieldType,
          family: 'frequency',
          hasData: false,
          sampleCount: 0,
          trend: {
            deltaPct: null,
            direction: null,
          },
        });

        continue;
      }

      const counts = new Map<string, number>();

      for (const value of textValues) {
        const currentCount = counts.get(value) || 0;
        counts.set(value, currentCount + 1);
      }

      const sortedCounts = Array.from(counts.entries());
      sortedCounts.sort((a, b) => b[1] - a[1]);

      const topThree = sortedCounts.slice(0, 3);

      const top = topThree.map((item) => ({
        value: item[0],
        count: item[1],
      }));

      const currentWeekCount = currentWeekTextValues.length;
      const previousWeekCount = previousWeekTextValues.length;

      const trend = calculateTrend(
        currentWeekCount > 0 ? currentWeekCount : null,
        previousWeekCount > 0 ? previousWeekCount : null,
      );

      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family: 'frequency',
        value: {
          top,
        },
        sampleCount: textValues.length,
        trend,
      });
    }

    if (field.fieldType === 'boolean') {
      if (booleanValues.length === 0) {
        insights.push({
          name: field.name,
          fieldType: field.fieldType,
          family: 'percentage',
          hasData: false,
          sampleCount: 0,
          trend: {
            deltaPct: null,
            direction: null,
          },
        });

        continue;
      }

      const trueCount = booleanValues.filter((value) => value === true).length;

      const pctTrue = (trueCount / booleanValues.length) * 100;

      const currentWeekTrueCount = currentWeekBooleanValues.filter(
        (value) => value === true,
      ).length;
      const previousWeekTrueCount = previousWeekBooleanValues.filter(
        (value) => value === true,
      ).length;

      const currentWeekPctTrue =
        currentWeekBooleanValues.length > 0
          ? (currentWeekTrueCount / currentWeekBooleanValues.length) * 100
          : null;
      const previousWeekPctTrue =
        previousWeekBooleanValues.length > 0
          ? (previousWeekTrueCount / previousWeekBooleanValues.length) * 100
          : null;

      const trend = calculateTrend(currentWeekPctTrue, previousWeekPctTrue);

      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family: 'percentage',
        value: {
          pctTrue,
        },
        sampleCount: booleanValues.length,
        trend,
      });
    }

    if (field.fieldType === 'date') {
      if (dateValues.length === 0) {
        insights.push({
          name: field.name,
          fieldType: field.fieldType,
          family: 'recency',
          hasData: false,
          sampleCount: 0,
          trend: {
            deltaPct: null,
            direction: null,
          },
        });

        continue;
      }

      let mostRecent = dateValues[0];

      for (const value of dateValues) {
        if (new Date(value) > new Date(mostRecent)) {
          mostRecent = value;
        }
      }

      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family: 'recency',
        value: {
          mostRecent,
        },
        sampleCount: dateValues.length,
        trend: {
          deltaPct: null,
          direction: null,
        },
      });
    }
  }

  return insights;
}
