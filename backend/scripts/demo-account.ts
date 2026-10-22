// Shared bits for the two demo scripts: getting the account credentials in a
// way that works in PowerShell as well as in bash.
//
// Why this file exists: the first version of these scripts took the
// credentials from environment variables only, and the documented invocation
// was `DEMO_EMAIL=… DEMO_PASSWORD=… npm run seed:demo`. That is bash syntax.
// PowerShell does not support it - it tries to run `DEMO_EMAIL=…` as a
// command and fails - so on a Windows shell the script looked broken even
// though nothing was wrong with it.
//
// Three ways in now, and they all work in every shell:
//
//   npm run seed:demo -- --email you@example.com --password …    (flags)
//   npm run seed:demo -- --email you@example.com                (prompts)
//   $env:DEMO_EMAIL = "you@example.com"; npm run seed:demo       (PowerShell)
//
// The prompt is the one to prefer. A password typed on the command line ends
// up in the shell's history file and in the process list, where anything else
// on the machine can read it.

/** Reads `--name value` or `--name=value` off the command line. */
export function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1) {
    const next = process.argv[index + 1];
    if (next && !next.startsWith('--')) return next;
  }

  return undefined;
}

/**
 * Asks for the password without echoing it. Raw mode on the terminal means
 * the keystrokes never reach the screen.
 */
export async function promptPassword(question: string): Promise<string> {
  const stdin = process.stdin;

  if (!stdin.isTTY) {
    throw new Error(
      'No terminal to prompt on. Set DEMO_PASSWORD, or pass --password on the command line.',
    );
  }

  process.stdout.write(question);

  const wasRaw = Boolean(stdin.isRaw);
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise<string>((resolve, reject) => {
    let value = '';

    const finish = (result: { ok: true; value: string } | { ok: false; error: Error }) => {
      stdin.off('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      process.stdout.write('\n');

      if (result.ok) resolve(result.value);
      else reject(result.error);
    };

    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          finish({ ok: true, value });
          return;
        }
        if (char === '\u0003') {
          finish({ ok: false, error: new Error('Cancelled.') });
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        if (char >= ' ') value += char;
      }
    };

    stdin.on('data', onData);
  });
}

/**
 * The demo account's credentials, from a flag, the environment, or a prompt.
 * The password is only prompted for when it is not already known.
 */
export async function credentials(): Promise<{ email: string; password: string }> {
  const email = flag('email') ?? process.env.DEMO_EMAIL;

  if (!email) {
    throw new Error(
      [
        'No demo account email.',
        '',
        '  any shell:   npm run seed:demo -- --email you@example.com',
        '  PowerShell:  $env:DEMO_EMAIL = "you@example.com"',
        '  bash:        DEMO_EMAIL=you@example.com npm run seed:demo',
      ].join('\n'),
    );
  }

  const fromFlag = flag('password') ?? process.env.DEMO_PASSWORD;
  const password = fromFlag ?? (await promptPassword(`Password for ${email}: `));

  if (!password) {
    throw new Error('No demo account password.');
  }

  return { email, password };
}
