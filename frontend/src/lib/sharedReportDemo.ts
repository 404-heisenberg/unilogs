import type { SharedReport } from '@/lib/sharedReport';

// Dev-only sample data so the public page can be checked without a backend:
// open /r/demo while running `npm run dev`. Never bundled into production.
function daysAgo(offset: number, hour = 12): string {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString();
}

export function demoReport(): SharedReport {
  const now = new Date();
  return {
    project: {
      id: 1,
      name: 'Thesis Research',
      description: 'MA research log — literature, experiments and supervision',
    },
    includeBodies: true,
    rangeDays: 30,
    dateFrom: daysAgo(30),
    dateTo: now.toISOString(),
    fields: [
      { name: 'Time spent', fieldType: 'duration' },
      { name: 'Pages read', fieldType: 'number' },
    ],
    summary: {
      entryCount: 5,
      trackedTimeMinutes: 930,
      lastLoggedAt: daysAgo(0),
      entriesThisWeek: 3,
    },
    insights: [
      {
        name: 'Time spent',
        fieldType: 'duration',
        family: 'duration',
        valueMinutes: 930,
        sampleCount: 5,
        trend: { deltaPct: 12, direction: 'up' },
      },
      {
        name: 'Pages read',
        fieldType: 'number',
        family: 'number',
        value: { total: 160, average: 32 },
        sampleCount: 5,
        trend: { deltaPct: 8, direction: 'up' },
      },
      {
        name: 'Mood',
        fieldType: 'text',
        family: 'text',
        value: 'Mostly focused',
        sampleCount: 5,
        trend: { deltaPct: null, direction: null },
      },
      {
        name: 'Supervisor reviewed',
        fieldType: 'boolean',
        family: 'boolean',
        value: { trueCount: 4, total: 5 },
        sampleCount: 5,
        trend: { deltaPct: null, direction: null },
      },
      {
        name: 'Next session',
        fieldType: 'date',
        family: 'date',
        value: daysAgo(-6).slice(0, 10),
        sampleCount: 1,
        trend: { deltaPct: null, direction: null },
      },
    ],
    entries: [
      {
        id: 1,
        date: daysAgo(0),
        title: 'Literature review notes',
        content: { 'Time spent': 2.5, 'Pages read': 38 },
        tags: ['deep-work', 'reading'],
        body: 'Cross-referenced the four pipeline papers and tightened the related-work section.',
      },
      {
        id: 2,
        date: daysAgo(1),
        title: 'Draft intro pipeline',
        content: { 'Time spent': 3, 'Pages read': 42 },
        tags: ['deep-work'],
        body: 'First full pass at the intro; the contribution paragraph still needs work.',
      },
      {
        id: 3,
        date: daysAgo(2),
        title: 'Experiment run 3',
        content: { 'Time spent': 5 },
        tags: ['deep-work'],
        body: 'Third configuration, interference counts down 12% versus baseline.',
      },
      {
        id: 4,
        date: daysAgo(4),
        title: 'Supervisor meeting notes',
        content: { 'Time spent': 1, 'Pages read': 12 },
        tags: ['supervisor'],
        body: 'Agreed to narrow scope to two architectures; next draft due in two weeks.',
      },
      {
        id: 5,
        date: daysAgo(7),
        title: 'Reading: chapter 4',
        content: { 'Time spent': 4, 'Pages read': 68 },
        tags: ['reading'],
        body: 'Worked through the cache coherence chapter and summarised the key trade-offs.',
      },
    ],
  };
}
