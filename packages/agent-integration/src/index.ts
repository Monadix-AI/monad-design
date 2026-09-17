import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parse as parseToml } from '@iarna/toml';
import {
  type AgentConfig,
  type AgentType,
  agents,
  detectGlobalAgents,
  detectProjectAgents,
  listInstalledServers,
  upsertServer
} from 'add-mcp';
import { load as parseYaml } from 'js-yaml';
import { type ParseError, parse as parseJson } from 'jsonc-parser';

import {
  agentDisplayName,
  detectGlobalSkillAgents,
  detectProjectSkillAgents,
  type InstallScope,
  type SupportedAgent,
  skillInstallDirectory,
  supportedAgents,
  supportsInstallationScope
} from './agent-targets';
import { deepSeekHarnessHome, upsertDeepSeekHarnessServer } from './deepseek-harness';
import { installMonadDesignSkill, removeLegacyMonadDesignSkill } from './skill-installer';

export * from './agent-targets';
export { exportKimiWorkPlugin } from './kimi-work';

const validateMcpFile = async (agent: SupportedAgent, scope: InstallScope, projectRoot: string | null) => {
  if (agent === 'deepseek-harness') return;
  const config = (agents as Record<string, AgentConfig>)[agent];
  if (!config) throw new Error('Unknown agent configuration.');
  const options = { local: scope === 'project', cwd: projectRoot ?? process.cwd() };
  const path =
    config.resolveConfigPath?.(config, options) ??
    (options.local ? join(options.cwd, config.localConfigPath ?? '') : config.configPath);
  let content: string;
  try {
    content = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  let parsed: unknown;
  if (config.format === 'json') {
    const errors: ParseError[] = [];
    parsed = parseJson(content, errors, { allowTrailingComma: true });
    if (errors.length) throw new Error(`Invalid MCP configuration: ${path}`);
  } else parsed = config.format === 'toml' ? parseToml(content) : parseYaml(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error(`Invalid MCP configuration: ${path}`);
};

export const detectAgents = async (projectRoot: string | null) => {
  const detected = [...(await detectGlobalAgents()), ...detectGlobalSkillAgents()];
  const global = supportedAgents.filter((agent) => detected.includes(agent));
  const project = projectRoot
    ? supportedAgents.filter((agent) =>
        [...detectProjectAgents(projectRoot), ...detectProjectSkillAgents(projectRoot)].includes(agent)
      )
    : [];
  return { global, project };
};

const digest = async (root: string, includeMetadata = true): Promise<string | null> => {
  const hash = createHash('sha256');
  const visit = async (directory: string, prefix = '') => {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      const relative = prefix + entry.name;
      if (relative === '.monad-design-install.json' || (!includeMetadata && relative === 'agents/openai.yaml'))
        continue;
      if (entry.isSymbolicLink()) throw new Error(`Skill contains a symbolic link: ${relative}`);
      if (entry.isDirectory()) await visit(join(directory, entry.name), `${relative}/`);
      else {
        hash.update(`${relative}\0`);
        hash.update(await readFile(join(directory, entry.name)));
      }
    }
  };
  try {
    await visit(root);
    return hash.digest('hex');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

export interface IntegrationStatus {
  agent: SupportedAgent;
  name: string;
  detected: boolean;
  supported: boolean;
  skillPath: string | null;
  mcpPath: string | null;
  skill: 'missing' | 'current' | 'outdated' | 'modified';
  mcp: 'missing' | 'configured' | 'stale' | 'conflict';
  error?: string;
  instructions?: string;
}

export const inspectAgentIntegration = async (
  agent: SupportedAgent,
  scope: InstallScope,
  projectRoot: string | null,
  skillSourcePath: string,
  mcpUrl: string
): Promise<IntegrationStatus> => {
  const supported = supportsInstallationScope(agent, scope);
  const result: IntegrationStatus = {
    agent,
    name: agentDisplayName(agent),
    detected: false,
    supported,
    skillPath: null,
    mcpPath: null,
    skill: 'missing',
    mcp: 'missing'
  };
  if (!supported) {
    result.instructions = 'Select a project to configure this agent.';
    return result;
  }
  const path = skillInstallDirectory(agent, scope, projectRoot ?? undefined);
  result.skillPath = path;
  try {
    await validateMcpFile(agent, scope, projectRoot);
    const actual = await digest(path);
    const expected = await digest(skillSourcePath, agent === 'codex');
    if (actual) {
      let previous: { digest?: string } = {};
      try {
        previous = JSON.parse(await readFile(join(path, '.monad-design-install.json'), 'utf8'));
      } catch {}
      result.skill = actual === expected ? 'current' : actual === previous.digest ? 'outdated' : 'modified';
    }
    if (agent === 'deepseek-harness') {
      result.mcpPath = join(deepSeekHarnessHome(), 'cordis.patch.yml');
      const body = await readFile(result.mcpPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return '';
        throw error;
      });
      result.mcp = body.includes('mcp-monad-design') ? (body.includes(mcpUrl) ? 'configured' : 'stale') : 'missing';
      result.instructions = 'MCP is configured for this user; the skill follows the selected scope.';
    } else {
      const [config] = await listInstalledServers({
        agents: [agent as AgentType],
        global: scope === 'global',
        cwd: projectRoot ?? undefined
      });
      result.mcpPath = config?.configPath ?? null;
      if (config?.error) throw new Error(config.error);
      const server = config?.servers.find((server) => server.serverName === 'monad-design');
      if (server) {
        const url = server.config.url ?? server.config.httpUrl ?? server.config.uri ?? server.config.serverUrl;
        result.mcp = url === mcpUrl ? 'configured' : 'stale';
      }
    }
    if (agent === 'trae')
      result.instructions = 'Enable project-level MCP in TRAE Settings > MCP, then start a new agent session.';
  } catch (error) {
    result.mcp = 'conflict';
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
};

export const installAgent = async (
  agent: SupportedAgent,
  scope: InstallScope,
  projectRoot: string | null,
  skillSourcePath: string,
  mcpUrl: string
) => {
  if (!supportsInstallationScope(agent, scope)) throw new Error('This agent does not support the selected scope.');
  if (scope === 'project' && !projectRoot) throw new Error('Choose a project first.');
  await validateMcpFile(agent, scope, projectRoot);
  const skillPath = skillInstallDirectory(agent, scope, projectRoot ?? undefined);
  const mcpPath =
    agent === 'deepseek-harness'
      ? await upsertDeepSeekHarnessServer(mcpUrl)
      : (() => {
          const result = upsertServer(
            agent,
            'monad-design',
            { type: 'http', url: mcpUrl },
            { local: scope === 'project', cwd: projectRoot ?? process.cwd() }
          );
          if (!result.success) throw new Error(result.error ?? 'Could not configure MCP');
          return result.path;
        })();
  await installMonadDesignSkill(skillSourcePath, skillPath, { includeOpenAiMetadata: agent === 'codex' });
  await removeLegacyMonadDesignSkill(join(dirname(skillPath), 'monad-design-live'));
  const receipt = join(skillPath, '.monad-design-install.json');
  await mkdir(skillPath, { recursive: true });
  const temporary = `${receipt}.tmp`;
  await writeFile(
    temporary,
    JSON.stringify({ schemaVersion: 1, digest: await digest(skillPath), installedAt: new Date().toISOString() }),
    { mode: 0o600 }
  );
  await rename(temporary, receipt);
  return { mcpPath, skillPath };
};
