// Seeds the UniLogs presentation demo account. Run with `npm run seed:demo`.
//
// Why this goes through the API instead of straight into the database:
// `POST /api/entries` writes the audit row a real create writes, and both the
// as-at view and the entry history replay those audit rows. Entries inserted
// with raw SQL would have no history, so the two features that read it would
// look broken in the demo. The API also validates the field definitions, so
// a typo in the seed data fails loudly here instead of half way through the
// presentation.
//
// What it creates:
//   * 4 projects with custom field types (number, duration, boolean, text)
//   * 51 entries spread over the last six weeks, dated relative to *today*, so
//     the dashboard's "this week", "streak" and "last 14 days" widgets all
//     have something to say on whichever day you present
//   * every entry has a body - the prose a reader reads, rendered as Markdown
//   * four entries that were edited after they were created, so the version
//     history has something to show on more than one entry
//   * one entry left in the trash and one deleted then restored
//   * 3 saved stat panels, two of them with computed expressions
//   * a dashboard layout with the panels pinned to it
//
// Usage:
//   npm run seed:demo -- --email you@example.com
//   npm run seed:demo -- --email you@example.com --password ...
//   npm run seed:demo -- --email you@example.com --api http://localhost:3000
//
// Flags:
//   --signup     create the account first (it still needs the email OTP)
//   --reset      delete the demo projects before seeding, so you can re-run
//                this after changing the seed data
//   --email      the demo account's email
//   --password   the demo account's password (asked for, not echoed, if omitted)
//   --api        the API to seed (default https://unilogs.onrender.com)
//
// The credentials can also come from the DEMO_EMAIL and DEMO_PASSWORD
// environment variables.

import { credentials, flag } from './demo-account.js';

const API = (flag('api') ?? process.env.DEMO_API_URL ?? 'https://unilogs.onrender.com').replace(
  /\/+$/,
  '',
);

let EMAIL = '';
let PASSWORD = '';

const wantsSignup = process.argv.includes('--signup');
const wantsReset = process.argv.includes('--reset');

// ---------------------------------------------------------------------------
// A tiny cookie jar. Better Auth answers with a session cookie and every data
// route needs it, so the script has to remember it between calls.
// ---------------------------------------------------------------------------

const jar = new Map<string, string>();

/**
 * Splits a `Set-Cookie` header into its separate cookies. `headers.get()`
 * joins multiple cookies with ", ", which also appears inside an `Expires=`
 * date, so split on a comma only when what follows looks like a new cookie.
 */
function splitSetCookie(header: string): string[] {
  const cookies: string[] = [];
  let current = '';

  for (let i = 0; i < header.length; i++) {
    if (header[i] === ',' && /^\s*[^=;,\s]+=/.test(header.slice(i + 1))) {
      cookies.push(current);
      current = '';
      continue;
    }
    current += header[i];
  }
  if (current.trim()) cookies.push(current);

  return cookies;
}

function captureCookies(res: Response): void {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw = headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];

  for (const cookie of raw) {
    for (const part of splitSetCookie(cookie)) {
      const [pair] = part.split(';');
      const eq = pair.indexOf('=');
      if (eq < 1) continue;
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
}

function cookieHeader(): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  captureCookies(res);

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---------------------------------------------------------------------------
// Dates. Relative to the day the script runs, never hard-coded: the stat
// widgets count entries against *now*, so a seed file with September dates
// would show an empty dashboard in October.
// ---------------------------------------------------------------------------

/**
 * An ISO timestamp `daysAgo` days back, spread through the working day so the
 * timeline order is stable. A time in the future is pulled back to now, which
 * only happens for today's entries when the script runs late in the day.
 */
function entryDate(daysAgo: number, slot: number): string {
  const when = new Date();
  when.setDate(when.getDate() - daysAgo);
  when.setHours(8 + (slot % 9), (slot * 13) % 60, 0, 0);
  if (when.getTime() > Date.now()) when.setTime(Date.now() - 60_000);
  return when.toISOString();
}

// ---------------------------------------------------------------------------
// The seed data
// ---------------------------------------------------------------------------

type FieldSpec = {
  name: string;
  fieldType: 'text' | 'number' | 'date' | 'duration' | 'boolean';
};

/**
 * A later version of an entry. Each one is an edit, so the entry's history
 * has something to show.
 */
type VersionSpec = {
  title?: string;
  body?: string;
  content?: Record<string, number | string | boolean>;
  tags?: string[];
};

type SeedEntry = {
  daysAgo: number;
  title: string;
  /**
   * The prose. It goes in the entry's *body*, which renders as Markdown and
   * is what a reader actually reads. The fields on an entry are for the
   * numbers you want to compute over - a logbook entry is a note first and
   * a data point second.
   */
  body?: string;
  content: Record<string, number | string | boolean>;
  tags?: string[];
  /** Later versions of this entry, applied as edits after it is created. */
  versions?: VersionSpec[];
};

type ProjectSpec = {
  name: string;
  description: string;
  fields: FieldSpec[];
  entries: SeedEntry[];
};

// The titles the seed relies on. The lifecycle entries are not in the seed
// data above, because they exist only to demonstrate delete and restore, so
// their titles are kept here instead.

/** Left in the trash, so the trash is not empty on the day of the demo. */
const TRASH_TITLE = 'Notes from the cancelled workshop';
/** Deleted and then restored, so the restore path is exercised in the data. */
const RESTORED_TITLE = 'Tidy up the reference list';

/**
 * The title an entry ends up with. An entry the seed renames is stored under
 * its last name, so that is the name it has to be matched by.
 */
function finalTitle(entry: SeedEntry): string {
  const versions = entry.versions ?? [];
  return versions[versions.length - 1]?.title ?? entry.title;
}

/**
 * Which of the seed's entries the project does not have yet.
 *
 * A title is not a unique key: a gym log has four sessions all called
 * "Lower body". So the entries are matched in order - the first "Lower body"
 * in the seed matches the first one in the project, and so on - and the
 * surplus is what gets created. Counting rather than testing for membership
 * is what keeps a second run from doubling a project whose titles repeat.
 */
function missingEntries(spec: ProjectSpec, existing: Entry[]): SeedEntry[] {
  const counts = new Map<string, number>();
  for (const entry of existing) {
    // A title can be null in the type, never in the data the seed writes.
    const title = entry.title ?? '';
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }

  const matched = new Map<string, number>();
  const missing: SeedEntry[] = [];

  for (const entry of spec.entries) {
    const key = finalTitle(entry);
    const index = (matched.get(key) ?? 0) + 1;
    matched.set(key, index);

    if (index > (counts.get(key) ?? 0)) missing.push(entry);
  }

  return missing;
}

const THESIS: ProjectSpec = {
  name: 'Thesis Research',
  description: 'Dissertation log: hours, words and the section worked on for each writing session.',
  fields: [
    { name: 'hours', fieldType: 'number' },
    { name: 'words', fieldType: 'number' },
    { name: 'section', fieldType: 'text' },
  ],
  entries: [
    {
      daysAgo: 41,
      title: 'Set up the literature tracker',
      body: 'Created the reference library and imported the 12 core papers.',
      content: { hours: 2.5, words: 380, section: 'Planning' },
      tags: ['admin'],
    },
    {
      daysAgo: 39,
      title: 'Read the chunking paper',
      body: 'Took notes on the chunk-size argument. Need to check the appendix figures.',
      content: { hours: 3, words: 210, section: 'Literature' },
      tags: ['analysis'],
    },
    {
      daysAgo: 37,
      title: 'Literature review outline',
      body: 'Outlined six sections. The gap statement in section 3 is still vague.',
      content: { hours: 2, words: 640, section: 'Chapter 2' },
      tags: ['writing'],
    },
    {
      daysAgo: 35,
      title: 'Wrote the introduction',
      body: 'Drafted the introduction and the research questions.',
      content: { hours: 4, words: 1200, section: 'Chapter 1' },
      tags: ['writing'],
    },
    {
      daysAgo: 34,
      title: 'Supervisor check-in',
      body: 'Told the supervisor the timeline. She suggested narrowing to one case study.',
      content: { hours: 1.5, words: 90, section: 'Planning' },
      tags: ['meeting'],
    },
    {
      daysAgo: 32,
      title: 'Rewrote the problem statement',
      body: 'Tightened the problem statement after the feedback.',
      content: { hours: 3.5, words: 850, section: 'Chapter 1' },
      tags: ['writing'],
    },
    {
      daysAgo: 31,
      title: 'Read the evaluation framework paper',
      body: 'Notes on the rubric. Might reuse the scoring categories.',
      content: { hours: 2, words: 260, section: 'Literature' },
      tags: ['analysis'],
    },
    {
      daysAgo: 29,
      title: 'Chapter two outline',
      body: 'Chapter two now has five sections instead of seven.',
      content: { hours: 3, words: 540, section: 'Chapter 2' },
      tags: ['writing'],
    },
    {
      daysAgo: 28,
      title: 'Coding the first prototype',
      body: 'The prototype runs end to end. Still slow on the larger corpus.',
      content: { hours: 5, words: 120, section: 'Methodology' },
      tags: ['urgent'],
    },
    {
      daysAgo: 27,
      title: 'Literature review draft',
      body: 'First full draft of chapter two. Feels thin in places.',
      content: { hours: 4.5, words: 1500, section: 'Chapter 2' },
      tags: ['writing'],
    },
    {
      daysAgo: 25,
      title: 'Fixed the citation formatting',
      body: 'All references now match the department template.',
      content: { hours: 1, words: 40, section: 'Admin' },
      tags: ['admin'],
    },
    {
      daysAgo: 23,
      title: 'Wrote the methodology section',
      body: 'Methodology is now a numbered step list. Much easier to follow.',
      content: { hours: 4, words: 1100, section: 'Chapter 3' },
      tags: ['writing'],
      // An edit, so this entry has a history of two versions.
      versions: [
        {
          title: 'Rewrote the methodology section',
          body: 'Split the evaluation into two stages so the numbers are not lost.',
          content: { hours: 4.5, words: 1250, section: 'Chapter 3' },
        },
      ],
    },
    {
      daysAgo: 22,
      title: 'Ran the first user test',
      body: 'Two colleagues tried it. Both got stuck on the upload step.',
      content: { hours: 2, words: 300, section: 'Methodology' },
      tags: ['review'],
    },
    {
      daysAgo: 19,
      title: 'Reworked the results table',
      body: 'The results table now shows the median, not the mean.',
      content: { hours: 3, words: 700, section: 'Chapter 4' },
      tags: ['writing'],
    },
    {
      daysAgo: 17,
      title: 'Edited the conclusion',
      body: 'The conclusion now states the contribution in one sentence.',
      content: { hours: 2.5, words: 480, section: 'Chapter 5' },
      tags: ['writing'],
    },
    {
      daysAgo: 15,
      title: 'Full read-through',
      body: 'Read the whole thing out loud. Two paragraphs do not earn their place.',
      content: { hours: 3, words: 600, section: 'Full draft' },
      tags: ['review'],
    },
    {
      daysAgo: 12,
      title: 'Built the results chart',
      body: 'Interactive chart renders. The tooltips need a contrast pass.',
      content: { hours: 2, words: 260, section: 'Chapter 4' },
      tags: ['urgent'],
    },
    {
      daysAgo: 10,
      title: "Addressed the reviewer's comments",
      body: 'Nine of the eleven comments are addressed.',
      content: { hours: 3.5, words: 950, section: 'Chapter 5' },
      tags: ['review'],
    },
    {
      daysAgo: 8,
      title: 'Cleaned up the code',
      body: 'Removed the dead branches. The tests still pass.',
      content: { hours: 2.5, words: 80, section: 'Methodology' },
      tags: ['admin'],
    },
    {
      daysAgo: 7,
      title: 'Formatted the document',
      body: 'Margins, spacing, page numbers. Ready for a supervisor read.',
      content: { hours: 1.5, words: 120, section: 'Admin' },
      tags: ['admin'],
    },
    {
      daysAgo: 5,
      title: 'Added the appendices',
      body: 'Appendix A has the raw data. Appendix B has the screening log.',
      content: { hours: 2, words: 340, section: 'Appendix' },
      tags: ['writing'],
    },
    {
      daysAgo: 3,
      title: 'First full supervisor read',
      body: 'The supervisor left 14 comments. Mostly about the discussion.',
      content: { hours: 3, words: 500, section: 'Full draft' },
      tags: ['meeting', 'review'],
    },
    {
      daysAgo: 2,
      title: 'Rewrote the discussion',
      body: 'The discussion now answers each research question in order.',
      content: { hours: 3.5, words: 1400, section: 'Chapter 5' },
      tags: ['writing'],
      // Two edits, so this entry has a history of three versions and its
      // title changes along the way - the history demo.
      versions: [
        {
          content: { hours: 4, words: 1650, section: 'Chapter 5' },
          body: 'The discussion now answers each research question in order. Added a paragraph on limitations.',
        },
        {
          title: 'Rewrote the discussion and limitations',
          content: { hours: 4, words: 1720, section: 'Chapter 5' },
          body: 'The discussion now answers each research question in order. Added a paragraph on limitations and future work.',
        },
      ],
    },
    {
      daysAgo: 1,
      title: 'Tightened the abstract',
      body: 'Abstract is down from 300 words.',
      content: { hours: 1, words: 300, section: 'Abstract' },
      tags: ['writing'],
      versions: [
        {
          content: { hours: 1, words: 180, section: 'Abstract' },
          body: 'Abstract is down to 180 words. Every one of them earns its place now.',
        },
      ],
    },
    {
      daysAgo: 0,
      title: 'Final consistency check',
      body: 'Cross-references fixed. Ready to submit after a proofread.',
      content: { hours: 2, words: 220, section: 'Full draft' },
      tags: ['review'],
    },
  ],
};

const COMS: ProjectSpec = {
  name: 'COMS3011A Project',
  description: 'Course project time and cost, with a saved panel for the average session cost.',
  fields: [
    { name: 'hours', fieldType: 'duration' },
    { name: 'rate', fieldType: 'number' },
  ],
  entries: [
    {
      daysAgo: 18,
      title: 'Requirement gathering',
      body: 'Went through the brief with the group and wrote down what we are actually being asked for.',
      content: { hours: 4, rate: 450 },
      tags: ['admin'],
    },
    {
      daysAgo: 16,
      title: 'Data model design',
      body: 'Drew the entity relationships and checked them against the audit log the app already keeps.',
      content: { hours: 5.5, rate: 450 },
      tags: ['analysis'],
    },
    {
      daysAgo: 13,
      title: 'Set up the CI pipeline',
      body: 'Lint, typecheck and tests run on every push now. It caught a broken migration on day one.',
      content: { hours: 2, rate: 500 },
      tags: ['urgent'],
    },
    {
      daysAgo: 11,
      title: 'Wrote the API docs',
      body: 'Every route is documented with a request and a response. The OpenAPI spec generates from the same source.',
      content: { hours: 3, rate: 500 },
      tags: ['writing'],
    },
    {
      daysAgo: 9,
      title: 'Pair programming session',
      body: 'Rebuilt the expression parser with a teammate. Much cleaner than the version I had alone.',
      content: { hours: 4.5, rate: 550 },
      tags: ['meeting'],
    },
    {
      daysAgo: 6,
      title: 'Integration testing',
      body: 'The end-to-end path works. Offline sync still needs a real test with the network off.',
      content: { hours: 6, rate: 550 },
      tags: ['review'],
      // An edit, so this entry has a history of two versions.
      versions: [
        {
          body: 'The end-to-end path works. Offline sync still needs a real test with the network off, so I booked the lab for Thursday.',
          content: { hours: 7, rate: 550 },
        },
      ],
    },
    {
      daysAgo: 3,
      title: 'Prepared the sprint demo',
      body: 'Walked the whole demo twice and cut the part where I explained the folder structure.',
      content: { hours: 3.5, rate: 600 },
      tags: ['writing'],
    },
    {
      daysAgo: 1,
      title: 'Fixed the failing CI job',
      body: 'The migration test was running against the wrong database. It was my environment variable.',
      content: { hours: 1.5, rate: 600 },
      tags: ['urgent'],
    },
  ],
};

const FITNESS: ProjectSpec = {
  name: 'Fitness Log',
  description: 'Bodyweight and reps per session, with a training volume panel.',
  fields: [
    { name: 'weight', fieldType: 'number' },
    { name: 'reps', fieldType: 'number' },
  ],
  entries: [
    {
      daysAgo: 26,
      title: 'Lower body',
      body: 'Squats and deadlifts. Added 5 kg to the bar and the form held.',
      content: { weight: 71.8, reps: 10 },
      tags: ['analysis'],
    },
    {
      daysAgo: 24,
      title: 'Upper body',
      body: 'Bench and rows. Shoulder still tight from the desk, kept the weight down.',
      content: { weight: 71.9, reps: 8 },
      tags: ['analysis'],
    },
    {
      daysAgo: 21,
      title: 'Lower body',
      body: 'Lunges and leg press. Reps went up without the weight.',
      content: { weight: 72.1, reps: 12 },
      tags: ['analysis'],
    },
    {
      daysAgo: 19,
      title: 'Cardio',
      body: 'Five kilometres along the river. Slower than last week but it did not hurt.',
      content: { weight: 72.2, reps: 9 },
      tags: ['analysis'],
    },
    {
      daysAgo: 16,
      title: 'Upper body',
      body: 'Overhead press and pull-ups. First session with the new grip.',
      content: { weight: 72.6, reps: 11 },
      tags: ['analysis'],
    },
    {
      daysAgo: 14,
      title: 'Lower body',
      body: 'Squats, lunges, calf raises. Focused on control rather than load.',
      content: { weight: 72.8, reps: 10 },
      tags: ['analysis'],
    },
    {
      daysAgo: 11,
      title: 'Upper body',
      body: 'Bench, rows and dips. Beat last week by two reps on every set.',
      content: { weight: 73.1, reps: 12 },
      tags: ['analysis'],
    },
    {
      daysAgo: 9,
      title: 'Cardio',
      body: 'Interval session on the treadmill. Six thirty-second efforts.',
      content: { weight: 73.4, reps: 9 },
      tags: ['analysis'],
    },
    {
      daysAgo: 5,
      title: 'Lower body',
      body: 'Deadlifts felt heavy. Dropped the weight for the last two sets.',
      content: { weight: 73.9, reps: 11 },
      tags: ['analysis'],
    },
    {
      daysAgo: 2,
      title: 'Upper body',
      body: 'Pull-ups and rows. The shoulder is finally loosening up.',
      content: { weight: 74.2, reps: 12 },
      tags: ['analysis'],
    },
  ],
};

const READING: ProjectSpec = {
  name: 'Reading List',
  description: 'Books in progress, with a finished flag so the list shows what is left.',
  fields: [
    { name: 'pages', fieldType: 'number' },
    { name: 'finished', fieldType: 'boolean' },
  ],
  entries: [
    {
      daysAgo: 20,
      title: 'The Clean Coder',
      body: 'Finished it on the train. The chapter on timing is the one I will keep going back to.',
      content: { pages: 320, finished: true },
    },
    {
      daysAgo: 17,
      title: 'Thinking in Systems',
      body: 'Read the first four chapters. The feedback loops chapter changed how I think about the dashboard.',
      content: { pages: 240, finished: true },
    },
    {
      daysAgo: 12,
      title: 'Designing Data-Intensive Applications',
      body: 'On the replication chapter. The consistency trade-offs are exactly what the audit log has to answer.',
      content: { pages: 480, finished: false },
    },
    {
      daysAgo: 9,
      title: 'The Pragmatic Programmer',
      body: 'Finished on a Sunday. The section on orthogonality is going straight into our next sprint.',
      content: { pages: 352, finished: true },
    },
    {
      daysAgo: 6,
      title: 'Domain-Driven Design',
      body: 'Started the strategic design part. Every example is about a company with a messy domain.',
      content: { pages: 560, finished: false },
    },
    {
      daysAgo: 4,
      title: 'Refactoring',
      body: 'Halfway. Already renamed two methods in the entry service because of it.',
      content: { pages: 448, finished: false },
    },
  ],
};

const PROJECTS = [THESIS, COMS, FITNESS, READING];

const TAGS = ['writing', 'analysis', 'admin', 'meeting', 'review', 'urgent'];

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

type Project = { id: number; name: string };
type FieldDefinition = { id: number; name: string; fieldType: string };
type Entry = { id: number; title: string | null };
type EntryList = { entries: Entry[]; total: number };
type StatPanel = { id: number; name: string; expression: string };

async function signIn(): Promise<void> {
  if (wantsSignup) {
    const res = await fetch(`${API}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'UniLogs Demo' }),
    });
    const text = await res.text();
    console.log(
      res.ok
        ? `Account created. Verify it with the OTP sent to ${EMAIL}, then run the script again.`
        : `Signup did not succeed (${res.status} ${text}). The account may already exist - verify it and run again.`,
    );
    if (res.ok) {
      console.log('The script stops here on purpose: an unverified account cannot sign in.');
      process.exit(0);
    }
  }

  try {
    await api('POST', '/api/auth/signin', { email: EMAIL, password: PASSWORD });
  } catch (err) {
    const message = (err as Error).message;
    console.error(`Sign-in failed: ${message}`);
    console.error('');

    if (message.includes('-> 401') || message.includes('-> 400')) {
      console.error('The demo account has to exist and be email-verified - the server has');
      console.error('requireEmailVerification on, so an unverified account is refused.');
      console.error('Create it in the app, or run this script with --signup and verify the OTP.');
    } else {
      console.error(`The API at ${API} could not be reached. Check DEMO_API_URL.`);
    }
    process.exit(1);
  }

  console.log(`Signed in as ${EMAIL}`);
}

async function ensureTags(): Promise<Map<string, number>> {
  const existing = await api<Array<{ id: number; name: string }>>('GET', '/api/tags');
  const ids = new Map(existing.map((tag) => [tag.name.toLowerCase(), tag.id]));

  for (const name of TAGS) {
    if (ids.has(name.toLowerCase())) continue;
    const created = await api<{ id: number; name: string }>('POST', '/api/tags', { name });
    ids.set(created.name.toLowerCase(), created.id);
  }

  console.log(`Tags: ${ids.size}`);
  return ids;
}

async function ensureProject(spec: ProjectSpec): Promise<Project> {
  const existing = await api<Project[]>('GET', '/api/projects');
  const found = existing.find((project) => project.name === spec.name);

  if (found) {
    if (wantsReset) {
      await api('DELETE', `/api/projects/${found.id}`);
      console.log(`Reset: deleted "${spec.name}"`);
    } else {
      console.log(`Reusing the existing project "${spec.name}" (id ${found.id})`);
      // A project that was seeded from an older version of this data may be
      // missing a field the entries now use. Adding it is better than
      // failing on every entry that carries it.
      await ensureFields(found, spec);
      return found;
    }
  }

  const project = await api<Project>('POST', '/api/projects', {
    name: spec.name,
    description: spec.description,
  });

  await ensureFields(project, spec);

  console.log(
    `Project "${spec.name}" (id ${project.id}) with fields: ${spec.fields.map((f) => f.name).join(', ')}`,
  );
  return project;
}

/** Adds any field definition the project does not have yet. */
async function ensureFields(project: Project, spec: ProjectSpec): Promise<void> {
  const existingFields = await api<FieldDefinition[]>(
    'GET',
    `/api/field-definitions?projectId=${project.id}`,
  );
  const have = new Set(existingFields.map((field) => field.name));

  for (const field of spec.fields) {
    if (have.has(field.name)) continue;
    await api('POST', '/api/field-definitions', {
      projectId: project.id,
      name: field.name,
      fieldType: field.fieldType,
    });
  }
}

async function seedEntries(
  project: Project,
  spec: ProjectSpec,
  tagIds: Map<string, number>,
): Promise<Map<string, number>> {
  const created = new Map<string, number>();

  for (const [index, entry] of spec.entries.entries()) {
    const body: Record<string, unknown> = {
      projectId: project.id,
      title: entry.title,
      content: entry.content,
      date: entryDate(entry.daysAgo, index),
    };
    if (entry.body) body.body = entry.body;
    if (entry.tags?.length) {
      body.tagIds = entry.tags.map((tag) => tagIds.get(tag.toLowerCase())!).filter(Boolean);
    }

    const result = await api<Entry>('POST', '/api/entries', body);
    created.set(entry.title, result.id);

    // The later versions of this entry, applied as edits. Each one is a real
    // PUT, so the audit log records it and the history page has something to
    // show - which is the whole point of the history demo. A version only
    // changes what it names: a title, a body, the fields or the tags. Anything
    // it leaves out keeps the value the entry already had.
    for (const version of entry.versions ?? []) {
      const edit: Record<string, unknown> = {
        title: version.title ?? entry.title,
        content: version.content ?? entry.content,
      };
      if (version.body !== undefined) edit.body = version.body;
      if (version.tags !== undefined) {
        edit.tagIds = version.tags.map((tag) => tagIds.get(tag.toLowerCase())!).filter(Boolean);
      }
      await api('PUT', `/api/entries/${result.id}`, edit);
    }
  }

  console.log(`  ${spec.entries.length} entries`);
  return created;
}

/** Two extra entries that exist only to demonstrate delete and restore. */
async function seedLifecycleEntries(
  project: Project,
  tagIds: Map<string, number>,
): Promise<{ trashId: number; restoredId: number }> {
  const trash = await api<Entry>('POST', '/api/entries', {
    projectId: project.id,
    title: TRASH_TITLE,
    body: 'Notes from a workshop that was cancelled. Not going back in.',
    content: { hours: 1.5, words: 120, section: 'Admin' },
    date: entryDate(4, 2),
    tagIds: [tagIds.get('admin')!].filter(Boolean),
  });

  const restored = await api<Entry>('POST', '/api/entries', {
    projectId: project.id,
    title: RESTORED_TITLE,
    body: 'Reformatted the reference list so the numbering matches the template.',
    content: { hours: 1, words: 80, section: 'Admin' },
    date: entryDate(6, 4),
    tagIds: [tagIds.get('admin')!].filter(Boolean),
  });

  return { trashId: trash.id, restoredId: restored.id };
}

async function seedStatPanels(projects: Map<string, Project>): Promise<StatPanel[]> {
  // Averages, not totals. A total like "15,550" is a big number with nothing
  // to compare it to; "1,944 per session" says what the work actually costs.
  // The panel name has to carry that meaning, because the number on the card
  // is shown on its own.
  const specs = [
    {
      project: 'Thesis Research',
      name: 'Average words per session',
      expression: 'words',
      aggregation: 'average',
      rangeDays: 30,
    },
    {
      project: 'Fitness Log',
      name: 'Average volume per workout',
      expression: 'weight * reps',
      aggregation: 'average',
      rangeDays: 30,
    },
    {
      project: 'COMS3011A Project',
      name: 'Average cost per session',
      expression: 'hours * rate',
      aggregation: 'average',
      rangeDays: 60,
    },
  ];

  const panels: StatPanel[] = [];

  for (const spec of specs) {
    const project = projects.get(spec.project);
    if (!project) continue;

    try {
      // Reuse a panel with the same name instead of creating a second one.
      // Two panels with the same name would both appear in the panel list,
      // and the dashboard layout can only pin one of them, so the demo would
      // show the same number twice. Hidden panels count too - a hidden panel
      // is still a panel.
      const existing = await api<StatPanel[]>(
        'GET',
        `/api/projects/${project.id}/stat-panels?includeHidden=true`,
      );
      const match = existing.find((panel) => panel.name === spec.name);

      if (match) {
        // Update it, so the seed data stays the single source of truth for
        // the expression even if the panel was edited by hand.
        const panel = await api<StatPanel>(
          'PATCH',
          `/api/projects/${project.id}/stat-panels/${match.id}`,
          {
            name: spec.name,
            expression: spec.expression,
            aggregation: spec.aggregation,
            rangeDays: spec.rangeDays,
            hidden: false,
          },
        );
        panels.push(panel);
        console.log(`Stat panel "${panel.name}" (id ${panel.id}) = ${spec.expression} (reused)`);
        continue;
      }

      const panel = await api<StatPanel>('POST', `/api/projects/${project.id}/stat-panels`, {
        name: spec.name,
        expression: spec.expression,
        aggregation: spec.aggregation,
        rangeDays: spec.rangeDays,
        hidden: false,
      });
      panels.push(panel);
      console.log(`Stat panel "${panel.name}" (id ${panel.id}) = ${spec.expression}`);
    } catch (err) {
      // A rejected expression must not take the rest of the seed down with it.
      console.warn(`Stat panel "${spec.name}" was not created: ${(err as Error).message}`);
    }
  }

  return panels;
}

async function seedLayout(panels: StatPanel[]): Promise<void> {
  const layout = [
    { id: 'summary', visible: true, size: 'wide' },
    { id: 'heatmap', visible: true, size: 'wide' },
    { id: 'whatsLeft', visible: true, size: 'standard' },
    { id: 'recent', visible: true, size: 'standard' },
    { id: 'continue', visible: true, size: 'standard' },
    { id: 'upcoming', visible: true, size: 'standard' },
    { id: 'insight', visible: true, size: 'standard' },
    { id: 'timeByProject', visible: true, size: 'standard' },
    { id: 'frequency', visible: true, size: 'standard' },
    ...panels.map((panel) => ({ id: `statPanel:${panel.id}`, visible: true, size: 'wide' })),
  ];

  await api('PUT', '/api/dashboard/layout', { layout });
  console.log(`Dashboard layout pinned with ${panels.length} saved panels`);
}

async function main(): Promise<void> {
  const creds = await credentials();
  EMAIL = creds.email;
  PASSWORD = creds.password;

  console.log(`Seeding ${API} as ${EMAIL}\n`);

  await signIn();
  const tagIds = await ensureTags();

  const projects = new Map<string, Project>();

  for (const spec of PROJECTS) {
    const project = await ensureProject(spec);
    projects.set(spec.name, project);

    if (wantsReset) {
      await seedEntries(project, spec, tagIds);
      continue;
    }

    // Only seed the entries the project does not have yet. Re-running without
    // --reset must not double the entries. A title is not a unique key - a gym
    // log has four sessions called "Lower body" - so the entries are matched
    // in order and only the surplus is created.
    const already = await api<EntryList>('GET', `/api/entries?projectId=${project.id}&limit=200`);
    const missing = missingEntries(spec, already.entries);

    if (missing.length === 0) {
      console.log(`  ${spec.entries.length} entries already there`);
      continue;
    }

    await seedEntries(project, { ...spec, entries: missing }, tagIds);
  }

  const thesis = projects.get(THESIS.name)!;

  // The lifecycle entries, only on a fresh seed. The deleted one is in the
  // trash rather than in the live list, so both lists have to be checked -
  // looking at the live list alone would create a second entry in the trash.
  const liveTitles = new Set(
    (await api<EntryList>('GET', `/api/entries?projectId=${thesis.id}&limit=100`)).entries.map(
      (entry) => entry.title,
    ),
  );
  const trashTitles = new Set(
    (await api<EntryList>('GET', `/api/projects/${thesis.id}/trash`)).entries.map(
      (entry) => entry.title,
    ),
  );

  if (!trashTitles.has(TRASH_TITLE) && !liveTitles.has(RESTORED_TITLE)) {
    const { trashId, restoredId } = await seedLifecycleEntries(thesis, tagIds);

    await api('DELETE', `/api/entries/${trashId}`);
    console.log('Left one entry in the trash');

    await api('DELETE', `/api/entries/${restoredId}`);
    await api('POST', `/api/entries/${restoredId}/restore`);
    console.log('Deleted one entry and restored it');
  }

  const panels = await seedStatPanels(projects);
  await seedLayout(panels);

  const entryCount = await api<EntryList>('GET', '/api/entries?limit=1');
  console.log(`\nDone. The account now has ${entryCount.total} live entries.`);

  console.log('');
  console.log('Two things left to do by hand:');
  console.log('  1. Connect a Google Calendar in Settings, so the calendar demo has a source.');
  console.log('  2. Backdate the seeded rows, so the as-at view has a past to show.');
  console.log('     See scripts/backdate-demo-entries.ts.');
}

main().catch((err) => {
  console.error(`\nSeeding failed: ${(err as Error).message}`);
  process.exit(1);
});
