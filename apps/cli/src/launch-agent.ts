import { execFile } from 'node:child_process';
import { chmod, mkdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const coreLaunchAgentLabel = 'ai.monadix.monad-design.core';

interface LaunchAgentDependencies {
  exec: (path: string, arguments_: string[]) => Promise<void>;
  homeDirectory: string;
  uid: number;
}

const defaultDependencies = (): LaunchAgentDependencies => {
  const uid = process.getuid?.();
  if (!Number.isSafeInteger(uid) || (uid ?? -1) < 0) {
    throw new Error('Could not determine the current macOS user for Core auto-start.');
  }
  return {
    exec: async (path, arguments_) => {
      await execFileAsync(path, arguments_);
    },
    homeDirectory: homedir(),
    uid: uid as number
  };
};

const xml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export const resolveCoreLaunchAgent = (homeDirectory = homedir(), uid = process.getuid?.()) => {
  if (!Number.isSafeInteger(uid) || (uid ?? -1) < 0) {
    throw new Error('Could not determine the current macOS user for Core auto-start.');
  }
  return {
    domain: `gui/${uid}`,
    service: `gui/${uid}/${coreLaunchAgentLabel}`,
    path: join(homeDirectory, 'Library', 'LaunchAgents', `${coreLaunchAgentLabel}.plist`)
  };
};

export const coreLaunchAgentPlist = (
  executablePath: string,
  stateDirectory: string
) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${coreLaunchAgentLabel}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(executablePath)}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${xml(join(stateDirectory, 'core.stdout.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${xml(join(stateDirectory, 'core.stderr.log'))}</string>
</dict>
</plist>
`;

const isMissingService = (error: unknown) => {
  const value = error as Error & { code?: number | string; stderr?: string | Uint8Array };
  return (
    value.code === 3 ||
    value.code === '3' ||
    value.code === 'ESRCH' ||
    /could not find specified service|no such process/i.test(String(value.stderr ?? ''))
  );
};

export const unloadCoreLaunchAgent = async (overrides: Partial<LaunchAgentDependencies> = {}) => {
  const dependencies = { ...defaultDependencies(), ...overrides };
  const launchAgent = resolveCoreLaunchAgent(dependencies.homeDirectory, dependencies.uid);
  try {
    await dependencies.exec('/bin/launchctl', ['bootout', launchAgent.service]);
    return true;
  } catch (error) {
    if (isMissingService(error)) return false;
    throw error;
  }
};

export const installCoreLaunchAgent = async (
  executablePath: string,
  stateDirectory: string,
  overrides: Partial<LaunchAgentDependencies> = {}
) => {
  const dependencies = { ...defaultDependencies(), ...overrides };
  const launchAgent = resolveCoreLaunchAgent(dependencies.homeDirectory, dependencies.uid);
  await mkdir(dirname(launchAgent.path), { recursive: true });
  const temporaryPath = `${launchAgent.path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, coreLaunchAgentPlist(executablePath, stateDirectory), { mode: 0o644 });
  await chmod(temporaryPath, 0o644);
  await rename(temporaryPath, launchAgent.path);
  await dependencies.exec('/bin/launchctl', ['bootstrap', launchAgent.domain, launchAgent.path]);
  return launchAgent;
};

export const kickstartCoreLaunchAgent = async (overrides: Partial<LaunchAgentDependencies> = {}) => {
  const dependencies = { ...defaultDependencies(), ...overrides };
  const launchAgent = resolveCoreLaunchAgent(dependencies.homeDirectory, dependencies.uid);
  await dependencies.exec('/bin/launchctl', ['kickstart', '-k', launchAgent.service]);
  return launchAgent;
};
