import type { AgentType, InstallResult } from 'add-mcp';

import { installCoreExecutable } from '@monaddesign/core-installation';
import { detectGlobalAgents, detectProjectAgents, upsertServer } from 'add-mcp';

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
import { ensureCoreRunning } from './core-runtime';
import { writeError, writeLine } from './output';
import { findGitProjectRoot } from './project-root';
import { chooseFromList, chooseScope } from './prompt';
import { installSkillDirectory } from './skill-installer';

export interface InstallCommandOptions {
  yes?: boolean;
  cwd?: string;
  interactive?: boolean;
}

interface AgentDetection {
  project: SupportedAgent[];
  global: SupportedAgent[];
}

export interface InstallDefaults {
  agents: SupportedAgent[];
  scope: InstallScope;
}

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
  `${label}: ${agents.length > 0 ? agents.map(agentDisplayName).join(', ') : 'none'}`;

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
  return { mcpPath: mcp.path, skillPath };
};

export const runInstall = async (options: InstallCommandOptions = {}) => {
  const cwd = options.cwd ?? process.cwd();
  const interactive = options.interactive ?? (process.stdin.isTTY && process.stdout.isTTY);
  const projectRoot = findGitProjectRoot(cwd);
  const detection = await detectAgents(projectRoot);
  const defaults = resolveInstallDefaults(detection, Boolean(projectRoot));

  writeLine('Monad Design installer');
  writeLine(`Git project: ${projectRoot ?? 'not detected'}`);
  if (projectRoot) writeLine(detectedAgentLine('Project agents', detection.project));
  writeLine(detectedAgentLine('Global agents', detection.global));

  let selectedAgents = defaults.agents;
  if (!options.yes && interactive) {
    writeLine('Available agents:');
    for (const agent of supportedAgents) writeLine(`  ${agent} — ${agentDisplayName(agent)}`);
    selectedAgents = await chooseFromList(
      'Agents (comma-separated)',
      supportedAgents,
      defaults.agents.length > 0 ? defaults.agents : supportedAgents
    );
  }
  if (selectedAgents.length === 0) {
    throw new Error(
      'No supported coding agent was detected. Run interactively to choose one after installing Codex, Claude Code, Cursor, or Gemini CLI.'
    );
  }

  const projectUnsupported = selectedAgents.filter((agent) => !supportsProjectInstallation(agent));
  let scope: InstallScope = projectRoot && projectUnsupported.length === 0 ? 'project' : 'global';
  if (projectRoot && !options.yes && interactive && projectUnsupported.length === 0) {
    scope = await chooseScope(projectRoot, scope);
  } else if (projectRoot && projectUnsupported.length > 0) {
    writeLine(
      `Global scope required: ${projectUnsupported.map(agentDisplayName).join(', ')} do not support project MCP configuration.`
    );
  }

  writeLine(`Installing Skill + MCP: ${scope === 'project' ? projectRoot : 'global'}`);
  const assets = await resolveReleaseAssets();
  const core = await installCoreExecutable({
    sourcePath: assets.corePath,
    version: assets.manifest.version,
    source: 'cli',
    platform: assets.manifest.platform,
    arch: assets.manifest.arch
  });
  const runtime = await ensureCoreRunning(core.executablePath);
  writeLine(
    `Core ${core.manifest.version}: ${core.status}${runtime.started ? ', started' : ', running'} (${core.executablePath})`
  );

  const mcpUrl = `${runtime.bootstrap.localClient.origin}/mcp`;
  const failures: string[] = [];
  for (const agent of selectedAgents) {
    try {
      const installed = await installAgent(agent, scope, projectRoot, assets.skillPath, mcpUrl);
      writeLine(`✓ ${agentDisplayName(agent)} MCP: ${installed.mcpPath}`);
      writeLine(`✓ ${agentDisplayName(agent)} Skill: ${installed.skillPath}`);
    } catch (error) {
      const message = `${agentDisplayName(agent)}: ${(error as Error).message}`;
      failures.push(message);
      writeError(`✗ ${message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Skill + MCP installation was incomplete for ${failures.length} agent(s).`);
  }
  writeLine('Monad Design is ready. Restart open agent sessions to load the new Skill and MCP server.');
};
