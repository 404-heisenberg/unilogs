import type { Page } from '@playwright/test';

const BACKEND_URL = 'http://localhost:3000';

// Signup now requires email verification before a session is issued (see
// backend/src/auth.ts's requireEmailVerification), so a real signup no
// longer lands straight on the dashboard - it redirects to /verify-email
// first. There's no inbox to read in CI, so this reads the OTP back through
// the test-only route in backend/src/routes/auth.ts (never available in
// production) and completes the verification form, the same step a real
// user would do by hand after checking their email.
export async function verifyEmail(page: Page, email: string) {
  const response = await page.request.get(
    `${BACKEND_URL}/api/auth/test/verification-otp?email=${encodeURIComponent(email)}`,
  );
  const { otp } = (await response.json()) as { otp: string | null };
  if (!otp) {
    throw new Error(`No verification OTP found for ${email}`);
  }

  await page.getByLabel(/verification code/i).fill(otp);
  await page.getByRole('button', { name: 'Verify' }).click();
}
