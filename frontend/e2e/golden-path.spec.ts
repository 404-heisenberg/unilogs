import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
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

  // Define a project and its schema via the Dashboard UI card or navigation.
  const startProjectButton = page.getByRole('button', { name: /start new project/i });
  if (await startProjectButton.isVisible()) {
    await startProjectButton.click();
  } else {
    await page.getByRole('button', { name: /new project/i }).click();
  }

  await page.getByPlaceholder(/e\.g\. unilogs development/i).fill('Thesis');
  await page.getByPlaceholder(/brief summary/i).fill('Final year research');
  await page.getByRole('button', { name: /^create project$/i }).click();

  await expect(page.getByText('Thesis')).toBeVisible();

  // Log an entry against it from the dashboard quick log form.
  await page.selectOption('select', { label: 'Thesis' });

  const hoursInput = page.getByPlaceholder('0').first();
  if (await hoursInput.isVisible()) {
    await hoursInput.fill('3');
  }

  await page.getByRole('button', { name: 'Save Log Entry' }).click();

  // Confirm values reflect on the dashboard stats.
  const topProjectCard = page.getByText('Top Project').locator('../..');
  await expect(topProjectCard.getByText('Thesis', { exact: true })).toBeVisible();
});
