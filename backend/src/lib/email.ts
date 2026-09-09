import sgMail from '@sendgrid/mail';

const apiKey = process.env.SENDGRID_API_KEY;
const emailFrom = process.env.SENDGRID_FROM_EMAIL;

if (apiKey) {
  sgMail.setApiKey(apiKey);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!apiKey || !emailFrom) {
    console.log(`[email not sent - SendGrid not configured] To: ${to} | Subject: ${subject}`);
    return false;
  }

  try {
    await sgMail.send({ to, from: { email: emailFrom, name: 'UniLogs' }, subject, html });
    return true;
  } catch (error) {
    console.error('Failed to send email via SendGrid:', error);
    return false;
  }
}
