import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

// Error paths that only exist once a real backend is in the loop — a
// duplicate email rejected by the database, a login rejected by the real
// password hash check. The component tests mock these responses; this
// confirms the real ones actually happen.
test('signing up twice with the same email is rejected', async ({ page }) => {
  const email = `e2e-${randomUUID()}@example.test`;
  const password = 'Sup3r!Secret';

  async function signUp() {
    await page.goto('/signup');
    await page.getByLabel(/^name/i).fill('E2E Tester');
    await page.getByLabel(/^email/i).fill(email);
    await page.getByLabel(/^password/i).fill(password);
    await page.getByLabel(/confirm password/i).fill(password);
    await page.getByLabel(/i agree to the/i).check();
    await page.getByRole('button', { name: 'Sign Up' }).click();
  }

  await signUp();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await signUp();
  await expect(page).toHaveURL(/\/signup$/);
  // Exact text Better Auth returns for USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL,
  // given this project's config (no requireEmailVerification, autoSignIn not
  // disabled) — see @better-auth/core/dist/error/codes.mjs. A generic
  // synthetic-user response is only returned when one of those is set, which
  // would make a duplicate email look like a success instead of an error.
  await expect(page.getByText('User already exists. Use another email.')).toBeVisible();
});

test('logging in with the wrong password is rejected', async ({ page }) => {
  const email = `e2e-${randomUUID()}@example.test`;

  await page.goto('/signup');
  await page.getByLabel(/^name/i).fill('E2E Tester');
  await page.getByLabel(/^email/i).fill(email);
  await page.getByLabel(/^password/i).fill('Correct1!Horse');
  await page.getByLabel(/confirm password/i).fill('Correct1!Horse');
  await page.getByLabel(/i agree to the/i).check();
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel(/^email/i).fill(email);
  // Anchored: an unanchored /password/i also matches the "Show password"
  // toggle button, whose aria-label contains the substring "password".
  await page.getByLabel(/^password/i).fill('Wrong1!Password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/login$/);
  // Exact text for BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD.
  await expect(page.getByText('Invalid email or password')).toBeVisible();
});
