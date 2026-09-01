import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { resolveCorePaths } from '@monaddesign/core-installation';

import { currentHealthyCore, waitForCoreRunning } from './core-runtime';
import { kickstartCoreLaunchAgent } from './launch-agent';

export const startInstalledCore = async () => {
  const paths = resolveCorePaths();
  await access(paths.executablePath, constants.X_OK).catch(() => {
    throw new Error('Monad Design Core is not installed. Run `npx monad-design install` first.');
  });
  const existing = await currentHealthyCore();
  if (existing) return { bootstrap: existing, started: false };
  try {
    await kickstartCoreLaunchAgent();
  } catch (error) {
    throw new Error(
      `Could not start the Monad Design Core launch agent. Run \`npx monad-design install\` to repair it. ${(error as Error).message}`
    );
  }
  return { bootstrap: await waitForCoreRunning(), started: true };
};
