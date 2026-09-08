import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const emailFrom = process.env.RESEND_FROM_EMAIL ?? 'UniLogs <onboarding@resend.dev>';

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend) {
    console.log(`[email not sent - RESEND_API_KEY not set] To: ${to} | Subject: ${subject}`);
    return false;
  }

  const { error } = await resend.emails.send({ from: emailFrom, to, subject, html });
  if (error) {
    console.error('Failed to send email via Resend:', error);
    return false;
  }

  return true;
}
