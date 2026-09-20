import { prisma } from '../auth.js';

export async function buildProjectSummary(userId: string, projectId: number) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: userId,
    },
    select: {
      id: true,
      name: true,
      archived: true,
      fields: {
        where: {
          fieldType: 'duration',
        },
        select: {
          name: true,
        },
      },
      entries: {
        select: {
          date: true,
          content: true,
        },
      },
    },
  });

  if (!project) {
    return null;
  }

  const entryCount = project.entries.length;

  const durationFieldNames = project.fields.map((field) => field.name);

  let totalHours = 0;

  let lastLoggedAt: Date | null = null;

  const now = new Date();
  const day = now.getDay();

  let daysSinceMonday;
  if (day === 0) {
    daysSinceMonday = 6;
  } else {
    daysSinceMonday = day - 1;
  }

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  let entriesThisWeek = 0;

  for (const entry of project.entries) {
    const content = entry.content as Record<string, unknown>;

    if (lastLoggedAt == null || entry.date > lastLoggedAt) {
      lastLoggedAt = entry.date;
    }

    if (entry.date >= startOfWeek) {
      entriesThisWeek++;
    }

    for (const fieldName of durationFieldNames) {
      const value = content[fieldName];

      if (typeof value === 'number') {
        totalHours += value;
      }
    }
  }

  const trackedTimeMinutes = durationFieldNames.length === 0 ? null : totalHours * 60;

  return {
    projectId: project.id,
    name: project.name,
    entryCount: entryCount,
    trackedTimeMinutes: trackedTimeMinutes,
    lastLoggedAt: lastLoggedAt,
    entriesThisWeek: entriesThisWeek,
  };
}
