import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

const processIsRunning = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

export const acquireCoreInstance = async (lockPath: string) => {
  await mkdir(dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, 'wx', 0o600);
      await handle.writeFile(`${process.pid}\n`, 'utf8');
      await handle.close();
      let released = false;
      return {
        acquired: true as const,
        async release() {
          if (released) return;
          released = true;
          const owner = Number.parseInt(await readFile(lockPath, 'utf8').catch(() => ''), 10);
          if (owner !== process.pid) return;
          await unlink(lockPath).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          });
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const owner = Number.parseInt(await readFile(lockPath, 'utf8').catch(() => ''), 10);
      if (Number.isInteger(owner) && owner > 0 && processIsRunning(owner)) {
        return { acquired: false as const, owner };
      }
      await unlink(lockPath).catch((unlinkError: NodeJS.ErrnoException) => {
        if (unlinkError.code !== 'ENOENT') throw unlinkError;
      });
    }
  }
  throw new Error('Could not acquire the Monad Design Core instance lock.');
};
