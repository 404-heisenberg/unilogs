import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { TERMS } from '../config/terms.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

export async function getUserDateRange(userId: string): Promise<{ start: Date; end: Date }> {
  const firstEntry = await prisma.entry.findFirst({
    where: { project: { userId } },
    orderBy: { date: 'asc' },
    select: { date: true },
  });

  const start = firstEntry ? new Date(firstEntry.date) : new Date();
  const startOfWeek = new Date(start);
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay() + 1);
  startOfWeek.setUTCHours(0, 0, 0, 0);

  const end = new Date();
  const endOfWeek = new Date(end);
  endOfWeek.setUTCDate(endOfWeek.getUTCDate() + (7 - endOfWeek.getUTCDay()));
  endOfWeek.setUTCHours(23, 59, 59, 999);

  return { start: startOfWeek, end: endOfWeek };
}

export async function getWeeklyEntryCounts(
  userId: string,
): Promise<{ weekStart: string; count: number }[]> {
  const { start, end } = await getUserDateRange(userId);
  const weeks: { weekStart: string; count: number }[] = [];

  const entries = await prisma.entry.findMany({
    where: {
      project: { userId },
      date: {
        gte: start,
        lte: end,
      },
    },
    select: { date: true },
  });

  const dateCountMap = new Map<string, number>();
  for (const entry of entries) {
    const dateStr = entry.date.toISOString().split('T')[0];
    dateCountMap.set(dateStr, (dateCountMap.get(dateStr) || 0) + 1);
  }

  let current = new Date(start);
  while (current <= end) {
    const weekStart = new Date(current);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    let weekCount = 0;

    for (let i = 0; i < 7; i++) {
      const day = new Date(current);
      day.setUTCDate(day.getUTCDate() + i);
      const dayStr = day.toISOString().split('T')[0];
      weekCount += dateCountMap.get(dayStr) || 0;
    }

    weeks.push({ weekStart: weekStartStr, count: weekCount });

    current.setUTCDate(current.getUTCDate() + 7);
  }

  return weeks;
}

export function getTermTotals(
  weeklyCounts: { weekStart: string; count: number }[],
): { termName: string; total: number }[] {
  return TERMS.map((term) => {
    let total = 0;
    for (const week of weeklyCounts) {
      const weekDate = new Date(week.weekStart);
      if (weekDate >= term.startDate && weekDate <= term.endDate) {
        total += week.count;
      }
    }
    return { termName: term.name, total };
  });
}
