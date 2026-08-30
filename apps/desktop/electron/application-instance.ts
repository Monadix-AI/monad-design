import { execFile } from 'node:child_process';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { app } from 'electron';

interface InstanceRecord {
  executable: string;
  pid: number;
}

const execFileAsync = promisify(execFile);
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const readInstanceRecord = async (path: string) => {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as Partial<InstanceRecord>;
    if (typeof value.pid !== 'number' || typeof value.executable !== 'string') {
      return undefined;
    }
    return value as InstanceRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    return undefined;
  }
};

const isRunningInstance = async ({ executable, pid }: InstanceRecord) => {
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid) return false;

  try {
    const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', 'command=']);
    const command = stdout.trim();
    return command === executable || command.startsWith(`${executable} `);
  } catch {
    return false;
  }
};

const waitForInstanceExit = async (record: InstanceRecord, timeout: number) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (!(await isRunningInstance(record))) return true;
    await wait(50);
  }
  return !(await isRunningInstance(record));
};

const terminateInstance = async (record: InstanceRecord) => {
  if (!(await isRunningInstance(record))) return;

  process.kill(record.pid, 'SIGTERM');
  if (await waitForInstanceExit(record, 1_500)) return;

  process.kill(record.pid, 'SIGKILL');
  if (!(await waitForInstanceExit(record, 1_000))) {
    throw new Error(`Could not terminate the existing instance (${record.pid}).`);
  }
};

export const replacePreviousDevelopmentInstance = async () => {
  if (!process.env.VITE_DEV_SERVER_URL) return;

  const userDataDirectory = app.getPath('userData');
  const instancePath = join(userDataDirectory, 'monaddesign-dev-instance.json');
  await mkdir(userDataDirectory, { recursive: true });

  const previousInstance = await readInstanceRecord(instancePath);
  if (previousInstance) await terminateInstance(previousInstance);

  await unlink(instancePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
  await writeFile(instancePath, JSON.stringify({ executable: process.execPath, pid: process.pid }), {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600
  });
};
