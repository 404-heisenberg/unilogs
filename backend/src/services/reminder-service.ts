import { prisma } from '../auth.js';
import type { ReminderFrequency } from '../generated/prisma/client.js';
import { reminderDigestEmail, sendEmail } from './email-service.js';

const WINDOW_DAYS: Record<ReminderFrequency, number | null> = {
  DAILY: 1,
  WEEKLY: 7,
  OFF: null,
};

const APP_URL = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

export function windowDaysFor(frequency: ReminderFrequency): number | null {
  return WINDOW_DAYS[frequency] ?? null;
}

export type DigestProject = {
  id: number;
  name: string;
};

export async function buildDigestFor(project: DigestProject, sinceDays: number, now = new Date()) {
  const since = new Date(now.getTime() - sinceDays * 24 * 60 * 60 * 1000);

  const entryCount = await prisma.entry.count({
    where: { projectId: project.id, date: { gte: since } },
  });

  return {
    entryCount,
    ...reminderDigestEmail({
      projectName: project.name,
      sinceDays,
      entryCount,
      appUrl: APP_URL,
    }),
  };
}

export type ReminderRecipient = {
  email: string;
  project: DigestProject;
  frequency: ReminderFrequency;
  remindersEnabled: boolean;
};

export async function sendDigestFor(
  recipient: ReminderRecipient,
  now = new Date(),
): Promise<boolean> {
  if (!recipient.remindersEnabled) return false;

  const sinceDays = windowDaysFor(recipient.frequency);
  if (sinceDays === null) return false;

  const { subject, html } = await buildDigestFor(recipient.project, sinceDays, now);
  return sendEmail(recipient.email, subject, html);
}

export async function sendDueDigests(
  recipients: ReminderRecipient[],
  now = new Date(),
): Promise<number> {
  let sent = 0;
  for (const recipient of recipients) {
    if (await sendDigestFor(recipient, now)) sent++;
  }
  return sent;
}
