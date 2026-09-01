#!/usr/bin/env node

import * as prompts from '@clack/prompts';
import colors from 'picocolors';

import { startInstalledCore } from './core-command';
import { runInstall } from './install';
import { writeLine } from './output';
import { InstallCancelledError } from './prompt';

const usage = `Monad Design

Usage:
  npx monad-design install [--yes]
  npx monad-design core start

Commands:
  install    Install machine Core, then Skill + MCP for detected agents
  core start Start the installed Core through its macOS launch agent

Options:
  -y, --yes  Accept detected agents (scope is still asked inside a Git project)
  -h, --help Show this help`;

const main = async () => {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    writeLine(usage);
    return;
  }

  const [command, ...flags] = args;
  if (command === 'core') {
    if (flags.length !== 1 || flags[0] !== 'start')
      throw new Error(`Unknown core command: ${flags.join(' ')}\n\n${usage}`);
    const runtime = await startInstalledCore();
    writeLine(
      `Monad Design Core ${runtime.started ? 'started' : 'is already running'} at ${runtime.bootstrap.localClient.origin}`
    );
    return;
  }
  if (command !== 'install') throw new Error(`Unknown command: ${command}\n\n${usage}`);
  const unknown = flags.filter((flag) => flag !== '--yes' && flag !== '-y');
  if (unknown.length > 0) throw new Error(`Unknown option: ${unknown.join(', ')}\n\n${usage}`);
  await runInstall({ yes: flags.includes('--yes') || flags.includes('-y') });
};

main().catch((error) => {
  if (error instanceof InstallCancelledError) return;
  prompts.log.error(colors.red((error as Error).message));
  process.exitCode = 1;
});
