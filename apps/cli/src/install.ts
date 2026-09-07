import type { AgentType, InstallResult } from 'add-mcp';

import { dirname, join } from 'node:path';
import * as prompts from '@clack/prompts';
import { installCoreExecutable, resolveCorePaths, stopLegacyCore } from '@monaddesign/core-installation';
import { detectGlobalAgents, detectProjectAgents, upsertServer } from 'add-mcp';
import colors from 'picocolors';

import {
  agentDisplayName,
  agentInstallationCapability,
  detectGlobalSkillAgents,
  detectProjectSkillAgents,
  type InstallScope,
  type SupportedAgent,
  skillInstallDirectory,
  supportedAgents,
  supportsInstallationScope,
  supportsProjectInstallation
} from './agent-targets';
import { resolveReleaseAssets } from './assets';
import { stopCore, waitForCoreRunning } from './core-runtime';
import { upsertDeepSeekHarnessServer } from './deepseek-harness';
import { exportKimiWorkPlugin } from './kimi-work';
import { installCoreLaunchAgent, unloadCoreLaunchAgent } from './launch-agent';
import { findGitProjectRoot } from './project-root';
import { chooseFromList, chooseScope } from './prompt';
import { installSkillDirectory, removeLegacyMonadDesignSkill } from './skill-installer';

export interface InstallCommandOptions {
  kimiWork?: boolean;
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
  supportedAgents.filter((agent) => supportsInstallationScope(agent, scope));

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
  const capability = agentInstallationCapability(agent);
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
  const mcpPath =
    agent === 'deepseek-harness'
      ? await upsertDeepSeekHarnessServer(mcpUrl)
      : (() => {
          const mcp: InstallResult = upsertServer(
            agent,
            'monad-design',
            { type: 'http', url: mcpUrl },
            { local: scope === 'project', cwd }
          );
          if (!mcp.success) throw new Error(mcp.error ?? `Could not update ${mcp.path}`);
          return mcp.path;
        })();

  const skillPath = skillInstallDirectory(agent, scope, projectRoot ?? undefined);
  await installSkillDirectory(skillSourcePath, skillPath, { includeOpenAiMetadata: agent === 'codex' });
  await removeLegacyMonadDesignSkill(join(dirname(skillPath), 'monad-design-live'));
  return { mcpPath, skillPath };
};

export const runInstall = async (options: InstallCommandOptions = {}) => {
  const cwd = options.cwd ?? process.cwd();
  const interactive = options.interactive ?? (process.stdin.isTTY && process.stdout.isTTY);
  const projectRoot = findGitProjectRoot(cwd);
  if (options.kimiWork && (process.platform !== 'darwin' || process.arch !== 'arm64')) {
    throw new Error('Kimi Work integration requires an Apple silicon Mac.');
  }
  const detection = options.kimiWork ? { project: [], global: [] } : await detectAgents(projectRoot);
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
  if (!options.kimiWork && projectRoot && interactive) {
    scope = await chooseScope(projectRoot, defaults.scope);
  }

  const installableAgents = installableAgentsForScope(scope);
  const defaultAgents =
    scope === defaults.scope
      ? defaults.agents.filter((agent) => installableAgents.includes(agent))
      : detectedAgentsForScope(detection, scope);
  let selectedAgents = defaultAgents;
  if (options.kimiWork) {
    selectedAgents = [];
  } else if (!options.yes && interactive) {
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
  if (!options.kimiWork && selectedAgents.length === 0) {
    if (!projectRoot && detection.global.some((agent) => !supportsInstallationScope(agent, 'global'))) {
      throw new Error(
        'Detected agents require project installation. Run monad-design install inside your Git project and choose Project scope (TRAE requires this).'
      );
    }
    throw new Error(
      'No supported coding agent was detected. Run interactively to choose one after installing a supported coding agent.'
    );
  }

  prompts.note(
    [
      `${colors.bold('Agents')}  ${options.kimiWork ? 'Kimi Work (plugin export)' : selectedAgents.map(agentDisplayName).join(', ')}`,
      `${colors.bold('Integration')}  ${options.kimiWork ? 'Import in Kimi Work after preparation' : scope === 'project' ? projectRoot : 'Global'}`,
      `${colors.bold('Core')}  Machine-level shared runtime`
    ].join('\n'),
    'Installation plan'
  );

  const coreSpinner = prompts.spinner();
  coreSpinner.start('Installing Monad Design Core');
  let assets: Awaited<ReturnType<typeof resolveReleaseAssets>>;
  let core: Awaited<ReturnType<typeof installCoreExecutable>>;
  let runtime: { bootstrap: Awaited<ReturnType<typeof waitForCoreRunning>>; restarted: boolean };
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
    const unloaded = await unloadCoreLaunchAgent();
    const stopped = await stopCore();
    const paths = resolveCorePaths();
    await installCoreLaunchAgent(core.executablePath, paths.stateDirectory);
    runtime = { bootstrap: await waitForCoreRunning(), restarted: unloaded || stopped };
    coreSpinner.stop(
      `Core ${core.manifest.version} ${colors.dim(`(${core.status}, ${runtime.restarted ? 'restarted' : 'started'}, auto-start enabled)`)}`
    );
  } catch (error) {
    coreSpinner.error('Core installation failed');
    throw error;
  }

  const mcpUrl = `${runtime.bootstrap.localClient.origin}/mcp`;
  if (options.kimiWork) {
    const directory = await exportKimiWorkPlugin({
      outputDirectory: join(resolveCorePaths().stateDirectory, 'plugins', 'kimi-work'),
      skillSourcePath: assets.skillPath,
      version: assets.manifest.version,
      mcpUrl
    });
    prompts.note(directory, 'Kimi Work plugin source');
    prompts.log.info(
      'In Kimi Work, use Custom plugin / Plugin Builder to import this local directory. Then install Monad Design from Plugins > Personal and open your app repository in a task.'
    );
    prompts.outro('Core is running. Plugin prepared; import and activation in Kimi Work are still required.');
    return;
  }
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
      if (agent === 'trae') {
        prompts.log.info(
          'TRAE: open Settings > MCP and enable project-level MCP (启用项目级 MCP), then confirm. Open this project in TRAE and start a new agent session to load the Monad Design Skill.'
        );
      }
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
      `${colors.bold('Auto-start')} ${colors.cyan('enabled for this macOS user')}`,
      `${colors.bold('Scope')} ${scope === 'project' ? colors.cyan(projectRoot ?? cwd) : colors.cyan('Global')}`
    ].join('\n'),
    'Installed'
  );
  prompts.outro(colors.green('Monad Design is ready — restart open agent sessions to load it.'));
};
