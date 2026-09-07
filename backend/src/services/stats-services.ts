import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function getDistinctEntryDates(userId: string): Promise<string[]> {
  const entries = await prisma.entry.findMany({
    where: {
      project: {
        userId: userId,
      },
    },
    select: {
      date: true,
    },
    orderBy: {
      date: 'desc',
    },
  });

  const dateSet = new Set<string>();
  for (const entry of entries) {
    const dateStr = entry.date.toISOString().split('T')[0];
    dateSet.add(dateStr);
  }

  return Array.from(dateSet);
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
