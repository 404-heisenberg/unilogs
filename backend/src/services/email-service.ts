import sgMail from '@sendgrid/mail';

const apiKey = process.env.SENDGRID_API_KEY;
const emailFrom = process.env.SENDGRID_FROM_EMAIL;

if (apiKey) {
  sgMail.setApiKey(apiKey);
}

export type EmailTemplate = {
  subject: string;
  html: string;
};

function layout(heading: string, body: string): string {
  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#1c0d06">',
    `<h1 style="font-size:20px">${heading}</h1>`,
    body,
    '<p style="margin-top:24px;font-size:12px;color:#7a5230">UniLogs — your digital logbook</p>',
    '</div>',
  ].join('');
}

export function resetPasswordEmail(url: string): EmailTemplate {
  return {
    subject: 'Reset your UniLogs password',
    html: layout(
      'Reset your password',
      `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${url}">${url}</a></p>`,
    ),
  };
}

export function verifyEmailTemplate(otp: string): EmailTemplate {
  return {
    subject: 'Verify your UniLogs email',
    html: layout(
      'Verify your email',
      `<p>Your verification code is:</p><h2 style="letter-spacing:6px">${otp}</h2><p>This code expires in 5 minutes.</p>`,
    ),
  };
}

export type ReminderDigest = {
  projectName: string;
  sinceDays: number;
  entryCount: number;
  appUrl: string;
};

export function reminderDigestEmail(digest: ReminderDigest): EmailTemplate {
  const { projectName, sinceDays, entryCount, appUrl } = digest;
  const period = sinceDays === 1 ? 'the last day' : `the last ${sinceDays} days`;
  const summary = entryCount === 1 ? 'You logged 1 entry' : `You logged ${entryCount} entries`;

  return {
    subject: `UniLogs reminder: ${projectName}`,
    html: layout(
      `Don't forget to log ${projectName}`,
      `<p>It has been a while since your last entry.</p><p><strong>${summary}</strong> in ${period}.</p><p><a href="${appUrl}">Open UniLogs</a> to add an entry.</p>`,
    ),
  };
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
