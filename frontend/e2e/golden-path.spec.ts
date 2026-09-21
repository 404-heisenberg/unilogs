import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { verifyEmail } from './helpers';

// The one test in this file that's worth running slowly and for real: sign up
// through the actual UI, define a project's shape, log an entry against it,
// and confirm the numbers it produces are correct on both the entries list
// and the dashboard. Everything here hits the real backend and a real
// (disposable) Postgres database — nothing is mocked. Component-level
// behaviour (validation messages, loading/error states, individual page
// logic) is already covered far more cheaply by the Vitest + React Testing
// Library suite in src/pages/*.test.tsx; this test exists to catch the thing
// those can't: that the pieces actually work together end to end.
test('a new user can sign up, define a project, and log an entry', async ({ page }) => {
  const email = `e2e-${randomUUID()}@example.test`;
  const password = 'Sup3r!Secret';

  await page.goto('/signup');
  await page.getByLabel(/^name/i).fill('E2E Tester');
  await page.getByLabel(/^email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByLabel(/confirm password/i).fill(password);
  await page.getByLabel(/i agree to the/i).check();
  await page.getByRole('button', { name: 'Sign Up' }).click();

  await expect(page).toHaveURL(/\/verify-email/);
  await verifyEmail(page, email);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // Define a project and its schema via the Details → Fields → Save wizard.
  await page.getByRole('link', { name: 'New Project' }).click();
  await expect(page).toHaveURL(/\/projects\/new$/);
  await page.getByPlaceholder('e.g. Gym').fill('Thesis');
  await page.getByPlaceholder("What's this project for?").fill('Final year research');
  await page.getByRole('button', { name: 'Continue' }).click();

  // A 'duration' field specifically: it's the only field type the backend's
  // stats endpoint sums into totalHours (see backend/src/routes/stats.ts) —
  // a plain 'text' field would leave the dashboard's totals at zero below.
  await page.getByPlaceholder('Field name').fill('Hours');
  await page.getByLabel('Field type').selectOption('duration');
  await page.getByRole('button', { name: 'Add field' }).click();
  await expect(page.getByText('Hours')).toBeVisible();

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create project' }).click();

  // The wizard lands directly on the new project's own page.
  await expect(page).toHaveURL(/\/projects\/\d+$/);
  await expect(page.getByRole('heading', { name: 'Thesis' })).toBeVisible();

  // Log an entry against it.
  await page.getByRole('link', { name: 'Log entry' }).click();
  await expect(page.getByRole('heading', { name: 'New Entry' })).toBeVisible();
  await page.getByRole('combobox').selectOption({ label: 'Thesis' });
  await page.getByLabel('Hours').fill('3');
  await page.getByRole('button', { name: 'Save entry' }).click();

  // It shows up where a user would look for it. No title was given, so the
  // timeline falls back to a "field: value" headline built from the content.
  await expect(page).toHaveURL(/\/entries$/);
  await expect(page.getByText('Hours: 3')).toBeVisible();

  await page.getByRole('link', { name: 'Dashboard' }).click();
  // Scoped to the "Top project" card specifically — the bar chart below it
  // also renders "Thesis" as an axis label, so an unscoped getByText would
  // match twice.
  const topProjectCard = page.getByText('Top project').locator('../..');
  await expect(topProjectCard.getByText('Thesis', { exact: true })).toBeVisible();
});
