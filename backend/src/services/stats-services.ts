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

export async function buildFieldInsights(projectId: number, userId: string) {
  const fields = await prisma.fieldDefinition.findMany({
    where: {
      projectId,
      project: {
        userId,
        archived: false,
      },
    },
    select: {
      name: true,
      fieldType: true,
      aggregationOverride: true,
    },
  });

  const entries = await prisma.entry.findMany({
    where: {
      projectId,
    },
    select: {
      date: true,
      content: true,
    },
  });

  const insights: FieldInsight[] = [];

  for (const field of fields) {
    let family = field.fieldType;

    if (field.fieldType === 'number' && field.aggregationOverride) {
      family = field.aggregationOverride;
    }

    const values: number[] = [];

    const durationValues: number[] = [];

    const textValues: string[] = [];

    const booleanValues: boolean[] = [];

    const dateValues: string[] = [];

    for (const entry of entries) {
      const content = entry.content as Record<string, unknown>;
      const value = content[field.name];

      if (field.fieldType === 'number' && typeof value === 'number') {
        values.push(value);
      }

      if (field.fieldType === 'duration' && typeof value === 'number') {
        durationValues.push(value);
      }

      if (field.fieldType === 'text' && typeof value === 'string') {
        textValues.push(value);
      }

      if (field.fieldType == 'boolean' && typeof value === 'boolean') {
        booleanValues.push(value);
      }

      if (field.fieldType == 'date' && typeof value === 'string') {
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
      let total = 0;
      for (const value of values) {
        total += value;
      }
      const average = total / values.length;

      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family,
        value: {
          sum: total,
          average: average,
        },
        sampleCount: values.length,
        trend: {
          deltaPct: null,
          direction: null,
        },
      });
    }

    if (family === 'sum') {
      let total = 0;

      for (const value of values) {
        total += value;
      }

      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family,
        value: total,
        sampleCount: values.length,
        trend: {
          deltaPct: null,
          direction: null,
        },
      });
    }

    if (family === 'average') {
      let total = 0;

      for (const value of values) {
        total += value;
      }

      const average = total / values.length;

      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family,
        value: average,
        sampleCount: values.length,
        trend: {
          deltaPct: null,
          direction: null,
        },
      });
    }

    if (family == 'max') {
      let max = values[0];
      for (const value of values) {
        if (value > max) {
          max = value;
        }
      }

      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family,
        value: max,
        sampleCount: values.length,
        trend: {
          deltaPct: null,
          direction: null,
        },
      });
    }

    if (family === 'min') {
      let min = values[0];
      for (const value of values) {
        if (value < min) {
          min = value;
        }
      }

      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family,
        value: min,
        sampleCount: values.length,
        trend: {
          deltaPct: null,
          direction: null,
        },
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
      let totalHours = 0;
      for (const value of durationValues) {
        totalHours += value;
      }
      const totalMinutes = totalHours * 60;

      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family: 'sum',
        valueMinutes: totalMinutes,
        sampleCount: durationValues.length,
        trend: {
          deltaPct: null,
          direction: null,
        },
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

      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family: 'frequency',
        value: {
          top,
        },
        sampleCount: textValues.length,
        trend: {
          deltaPct: null,
          direction: null,
        },
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

      let trueCount = 0;

      for (const value of booleanValues) {
        if (value === true) {
          trueCount++;
        }
      }

      const pctTrue = (trueCount / booleanValues.length) * 100;

      insights.push({
        name: field.name,
        fieldType: field.fieldType,
        family: 'percentage',
        value: {
          pctTrue,
        },
        sampleCount: booleanValues.length,
        trend: {
          deltaPct: null,
          direction: null,
        },
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
