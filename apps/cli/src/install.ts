import type { AgentType, InstallResult } from 'add-mcp';

import { dirname, join } from 'node:path';
import * as prompts from '@clack/prompts';
import { installCoreExecutable, stopLegacyCore } from '@monaddesign/core-installation';
import { detectGlobalAgents, detectProjectAgents, upsertServer } from 'add-mcp';
import colors from 'picocolors';

import {
  agentDisplayName,
  detectGlobalSkillAgents,
  detectProjectSkillAgents,
  type InstallScope,
  type SupportedAgent,
  skillInstallDirectory,
  supportedAgents,
  supportsProjectInstallation
} from './agent-targets';
import { resolveReleaseAssets } from './assets';
import { restartCore } from './core-runtime';
import { findGitProjectRoot } from './project-root';
import { chooseFromList, chooseScope } from './prompt';
import { installSkillDirectory, removeLegacyMonadDesignSkill } from './skill-installer';

export interface InstallCommandOptions {
  yes?: boolean;
  cwd?: string;
  interactive?: boolean;
}

export interface AgentDetection {
  project: SupportedAgent[];
  global: SupportedAgent[];
}

export interface InstallDefaults {
  agents: SupportedAgent[];
  scope: InstallScope;
}

export const installableAgentsForScope = (scope: InstallScope) =>
  scope === 'project' ? supportedAgents.filter(supportsProjectInstallation) : supportedAgents;

export const detectedAgentsForScope = (detection: AgentDetection, scope: InstallScope) => {
  const installable = installableAgentsForScope(scope);
  return detection[scope].filter((agent) => installable.includes(agent));
};

const uniqueSupportedAgents = (values: readonly (AgentType | string)[]) =>
  supportedAgents.filter((agent) => values.includes(agent));

export const resolveInstallDefaults = (detection: AgentDetection, hasGitProject: boolean): InstallDefaults => {
  const projectCapableGlobal = detection.global.filter(supportsProjectInstallation);
  const agents = hasGitProject
    ? detection.project.length > 0
      ? detection.project
      : projectCapableGlobal.length > 0
        ? projectCapableGlobal
        : detection.global
    : detection.global;
  return {
    agents,
    scope: hasGitProject && agents.every(supportsProjectInstallation) ? 'project' : 'global'
  };
};

const detectedAgentLine = (label: string, agents: SupportedAgent[]) =>
  `${colors.bold(label)}  ${agents.length > 0 ? agents.map(agentDisplayName).join(', ') : colors.dim('none')}`;

const agentHint = (agent: SupportedAgent, detection: AgentDetection, scope: InstallScope) => {
  const detected = detection[scope].includes(agent)
    ? scope === 'project'
      ? colors.green('detected in project')
      : colors.cyan('detected globally')
    : colors.dim(`not detected ${scope === 'project' ? 'in project' : 'globally'}`);
  const capability = supportsProjectInstallation(agent) ? 'Project + Global' : 'Global only';
  return `${detected} · ${capability}`;
};

const detectAgents = async (projectRoot: string | null): Promise<AgentDetection> => {
  const global = uniqueSupportedAgents([...(await detectGlobalAgents()), ...detectGlobalSkillAgents()]);
  const project = projectRoot
    ? uniqueSupportedAgents([
        ...detectProjectAgents(projectRoot),
        ...detectProjectSkillAgents(projectRoot).filter((agent) => global.includes(agent))
      ])
    : [];
  return { project, global };
};

const installAgent = async (
  agent: SupportedAgent,
  scope: InstallScope,
  projectRoot: string | null,
  skillSourcePath: string,
  mcpUrl: string
) => {
  const cwd = projectRoot ?? process.cwd();
  const mcp: InstallResult = upsertServer(
    agent,
    'monad-design',
    { type: 'http', url: mcpUrl },
    { local: scope === 'project', cwd }
  );
  if (!mcp.success) throw new Error(mcp.error ?? `Could not update ${mcp.path}`);

  const skillPath = skillInstallDirectory(agent, scope, projectRoot ?? undefined);
  await installSkillDirectory(skillSourcePath, skillPath);
  await removeLegacyMonadDesignSkill(join(dirname(skillPath), 'monad-design-live'));
  return { mcpPath: mcp.path, skillPath };
};

export const runInstall = async (options: InstallCommandOptions = {}) => {
  const cwd = options.cwd ?? process.cwd();
  const interactive = options.interactive ?? (process.stdin.isTTY && process.stdout.isTTY);
  const projectRoot = findGitProjectRoot(cwd);
  const detection = await detectAgents(projectRoot);
  const defaults = resolveInstallDefaults(detection, Boolean(projectRoot));

  prompts.intro(colors.bgCyan(colors.black(' Monad Design installer ')));
  prompts.note(
    [
      `${colors.bold('Git project')}  ${projectRoot ?? colors.dim('not detected')}`,
      ...(projectRoot ? [detectedAgentLine('Project agents', detection.project)] : []),
      detectedAgentLine('Global agents', detection.global)
    ].join('\n'),
    'Detected environment'
  );

  let scope = defaults.scope;
  if (projectRoot && interactive) {
    scope = await chooseScope(projectRoot, defaults.scope);
  }

  const installableAgents = installableAgentsForScope(scope);
  const defaultAgents = detectedAgentsForScope(detection, scope);
  let selectedAgents = defaultAgents;
  if (!options.yes && interactive) {
    selectedAgents = await chooseFromList(
      'Select coding agents',
      installableAgents.map((agent) => ({
        value: agent,
        label: agentDisplayName(agent),
        hint: agentHint(agent, detection, scope)
      })),
      defaultAgents
    );
  } else {
    prompts.log.info(`Using detected agents: ${colors.cyan(selectedAgents.map(agentDisplayName).join(', '))}`);
  }
  if (selectedAgents.length === 0) {
    throw new Error(
      'No supported coding agent was detected. Run interactively to choose one after installing Codex, Claude Code, Cursor, or Gemini CLI.'
    );
  }

  prompts.note(
    [
      `${colors.bold('Agents')}  ${selectedAgents.map(agentDisplayName).join(', ')}`,
      `${colors.bold('Integration')}  ${scope === 'project' ? projectRoot : 'Global'}`,
      `${colors.bold('Core')}  Machine-level shared runtime`
    ].join('\n'),
    'Installation plan'
  );

  const coreSpinner = prompts.spinner();
  coreSpinner.start('Installing Monad Design Core');
  let assets: Awaited<ReturnType<typeof resolveReleaseAssets>>;
  let core: Awaited<ReturnType<typeof installCoreExecutable>>;
  let runtime: Awaited<ReturnType<typeof restartCore>>;
  try {
    assets = await resolveReleaseAssets();
    core = await installCoreExecutable({
      sourcePath: assets.corePath,
      nativeAddonPath: assets.coreNativeAddonPath,
      version: assets.manifest.version,
      source: 'cli',
      platform: assets.manifest.platform,
      arch: assets.manifest.arch
    });
    await stopLegacyCore();
    runtime = await restartCore(core.executablePath);
    coreSpinner.stop(
      `Core ${core.manifest.version} ${colors.dim(`(${core.status}, ${runtime.restarted ? 'restarted' : 'started'})`)}`
    );
  } catch (error) {
    coreSpinner.error('Core installation failed');
    throw error;
  }

  const mcpUrl = `${runtime.bootstrap.localClient.origin}/mcp`;
  const failures: string[] = [];
  for (const agent of selectedAgents) {
    const name = agentDisplayName(agent);
    const agentSpinner = prompts.spinner();
    agentSpinner.start(`Installing ${name}`);
    try {
      const installed = await installAgent(agent, scope, projectRoot, assets.skillPath, mcpUrl);
      agentSpinner.stop(`${name} installed`);
      prompts.log.message([
        `${colors.dim('MCP')}    ${colors.cyan(installed.mcpPath)}`,
        `${colors.dim('Skill')}  ${colors.cyan(installed.skillPath)}`
      ]);
    } catch (error) {
      const message = `${name}: ${(error as Error).message}`;
      failures.push(message);
      agentSpinner.error(`${name} failed`);
      prompts.log.error((error as Error).message);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Skill + MCP installation was incomplete for ${failures.length} agent(s).`);
  }
  prompts.note(
    [
      `${colors.bold('Core')}  ${colors.cyan(core.executablePath)}`,
      `${colors.bold('MCP')}   ${colors.cyan(mcpUrl)}`,
      `${colors.bold('Scope')} ${scope === 'project' ? colors.cyan(projectRoot ?? cwd) : colors.cyan('Global')}`
    ].join('\n'),
    'Installed'
  );
  prompts.outro(colors.green('Monad Design is ready — restart open agent sessions to load it.'));
};
