// Better Auth appends `?error=<code>` (see OAUTH_CALLBACK_ERROR_CODES in the
// better-auth package) to errorCallbackURL when a Google sign-in/sign-up
// doesn't complete. This maps the codes we can give a specific, actionable
// message for; anything else falls back to a generic one.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  account_not_linked:
    "We couldn't link this Google account to your UniLogs account. Please try again or use your password to sign in.",
  email_does_not_match:
    "The Google account you used doesn't match the email on your signed-in account.",
  account_already_linked_to_different_user:
    'That Google account is already linked to a different UniLogs account.',
  email_not_found:
    "That Google account didn't share an email address with us, so we can't use it to sign in.",
};

const DEFAULT_MESSAGE = "Google sign-in didn't complete. Please try again.";

export function getGoogleOAuthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return OAUTH_ERROR_MESSAGES[code] ?? DEFAULT_MESSAGE;
}
