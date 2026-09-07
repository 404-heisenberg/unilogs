import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export default async function globalSetup() {
  const result =
    process.platform === 'win32'
      ? await execAsync('npx prisma migrate deploy', { env: process.env })
      : await execFileAsync('npx', ['prisma', 'migrate', 'deploy'], { env: process.env });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}
