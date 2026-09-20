import { schedule } from 'node-cron';
import { prisma } from './auth.js';
import { ReminderFrequency } from './generated/prisma/client.js';
import { createReminderNotification } from './services/notification-service.js';
import {
  sendDueDigests,
  windowDaysFor,
  type ReminderRecipient,
} from './services/reminder-service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// One tick of the reminder sweep: find projects whose last entry is older than
// their reminder window (or that have no entries), notify them once per window,
// and send the digests. Exported so tests can run a single deterministic tick
// without starting a real cron loop.
export async function runSweep(now = new Date()): Promise<number> {
  const projects = await prisma.project.findMany({
    where: {
      archived: false,
      reminderFrequency: { not: ReminderFrequency.OFF },
      user: { remindersEnabled: true },
    },
    include: { user: { select: { email: true, remindersEnabled: true } } },
  });

  const recipients: ReminderRecipient[] = [];

  for (const project of projects) {
    const sinceDays = windowDaysFor(project.reminderFrequency);
    if (sinceDays === null) continue;

    const windowMs = sinceDays * DAY_MS;

    const lastEntry = await prisma.entry.findFirst({
      where: { projectId: project.id },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    const untouched = !lastEntry || now.getTime() - lastEntry.date.getTime() > windowMs;
    if (!untouched) continue;

    const recentlyNotified =
      project.lastDigestSentAt !== null &&
      now.getTime() - project.lastDigestSentAt.getTime() <= windowMs;
    if (recentlyNotified) continue;

    await createReminderNotification({
      userId: project.userId,
      projectId: project.id,
      title: `Don't forget to log ${project.name}`,
      body: `No entries in the last ${sinceDays} ${sinceDays === 1 ? 'day' : 'days'}.`,
    });

    await prisma.project.update({
      where: { id: project.id },
      data: { lastDigestSentAt: now },
    });

    recipients.push({
      email: project.user.email,
      project: { id: project.id, name: project.name },
      frequency: project.reminderFrequency,
      remindersEnabled: project.user.remindersEnabled,
    });
  }

  return sendDueDigests(recipients, now);
}

// Hourly sweep. Never started under test so the suite stays deterministic.
export function startScheduler() {
  schedule('0 * * * *', () => {
    runSweep().catch((err) => console.error('Reminder sweep failed:', err));
  });
}
