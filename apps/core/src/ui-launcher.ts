import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const desktopBundleIdentifier = 'design.mona.client';

export type OpenUi = (arguments_: string[]) => Promise<void>;

const openUi: OpenUi = async (arguments_) => {
  await execFileAsync('/usr/bin/open', arguments_);
};

export const launchPreferredUi = async (
  url: string,
  options: {
    open?: OpenUi;
    reportError?: (message: string, error: unknown) => void;
  } = {}
) => {
  const open = options.open ?? openUi;
  try {
    await open(['-b', desktopBundleIdentifier]);
    return 'desktop' as const;
  } catch {
    try {
      await open([url]);
      return 'browser' as const;
    } catch (error) {
      options.reportError?.('Could not open the Monad Design desktop or browser UI.', error);
      return 'unavailable' as const;
    }
  }
};
