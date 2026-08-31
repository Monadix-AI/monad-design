#!/usr/bin/env node

import * as prompts from '@clack/prompts';
import colors from 'picocolors';

import { runInstall } from './install';
import { writeLine } from './output';
import { InstallCancelledError } from './prompt';

const usage = `Monad Design

Usage:
  npx monad-design install [--yes]

Commands:
  install    Install machine Core, then Skill + MCP for detected agents

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
