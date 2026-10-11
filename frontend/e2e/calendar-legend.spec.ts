import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { dismissWalkthrough, verifyEmail } from './helpers';

// The Calendar page's legend is a horizontal scroll row. On platforms that
// draw overlay scrollbars (zero layout space) the bar floats over the labels
// and clips them, and padding cannot reserve space for a bar that takes none,
// so the row suppresses its scrollbar instead while still scrolling.
//
// jsdom cannot evaluate the computed scrollbar style, so a real browser is the
// only place this can be guarded. The legend renders whenever the Calendar
// page does, connected or not, so this needs no calendar data.
test('the calendar legend suppresses its scrollbar so it cannot clip the labels', async ({
  page,
}) => {
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
  await dismissWalkthrough(page);

  await page.goto('/calendar');

  const legend = page.getByRole('list', { name: 'Legend' });
  await expect(legend).toBeVisible();

  // Still a horizontal scroll container...
  await expect(legend).toHaveCSS('overflow-x', 'auto');
  // ...but with no scrollbar to draw over the labels.
  await expect(legend).toHaveCSS('scrollbar-width', 'none');
});
