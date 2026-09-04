import type { AgentType } from 'add-mcp';

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { type AgentConfig, agents } from 'add-mcp';

export const supportedAgents = [
  'antigravity',
  'cline',
  'cline-cli',
  'claude-code',
  'codex',
  'cursor',
  'gemini-cli',
  'goose',
  'github-copilot-cli',
  'grok-build',
  'kilo-code',
  'kimi-code',
  'kiro-cli',
  'opencode',
  'qoder',
  'qwen-code',
  'trae',
  'codebuddy',
  'vscode',
  'windsurf',
  'zcode',
  'zed'
] as const;
export type SupportedAgent = (typeof supportedAgents)[number];
export type InstallScope = 'project' | 'global';

interface AgentTarget {
  displayName: string;
  projectHarnessDirectories: string[];
  globalHarnessDirectories: (home: string) => string[];
  projectSkillDirectory: (root: string) => string;
  globalSkillDirectory: (home: string) => string;
  installScopes?: InstallScope[];
}

const codexHome = (home: string) => process.env.CODEX_HOME?.trim() || join(home, '.codex');
const claudeHome = (home: string) => process.env.CLAUDE_CONFIG_DIR?.trim() || join(home, '.claude');
const qwenHome = (home: string) => process.env.QWEN_HOME?.trim() || join(home, '.qwen');
const projectSkill = (directory: string) => (root: string) => join(root, directory, 'monad-design');
const globalSkill = (directory: string) => (home: string) => join(home, directory, 'monad-design');

const standardMcpConfig = (_serverName: string, config: Parameters<AgentConfig['transformConfig']>[1]) => config;
const qwenMcpConfig: AgentConfig['transformConfig'] = (_serverName, config) =>
  config.type === 'http' ? { httpUrl: config.url, headers: config.headers } : config;

// add-mcp does not yet publish these targets. Register the documented config
// contracts locally so its JSONC-preserving updater remains the single writer.
Object.assign(agents as Record<string, AgentConfig>, {
  qoder: {
    name: 'qoder',
    displayName: 'Qoder',
    configPath: join(homedir(), '.qoder', 'settings.json'),
    localConfigPath: '.qoder/settings.json',
    projectDetectPaths: ['.qoder'],
    configKey: 'mcpServers',
    format: 'json',
    supportedTransports: ['stdio', 'http', 'sse'],
    supportedFields: ['timeout'],
    detectGlobalInstall: async () => existsSync(join(homedir(), '.qoder')),
    transformConfig: standardMcpConfig
  },
  'qwen-code': {
    name: 'qwen-code',
    displayName: 'Qwen Code',
    configPath: join(qwenHome(homedir()), 'settings.json'),
    localConfigPath: '.qwen/settings.json',
    projectDetectPaths: ['.qwen'],
    configKey: 'mcpServers',
    format: 'json',
    supportedTransports: ['stdio', 'http', 'sse'],
    supportedFields: ['timeout'],
    detectGlobalInstall: async () => existsSync(qwenHome(homedir())),
    transformConfig: qwenMcpConfig
  },
  trae: {
    name: 'trae',
    displayName: 'TRAE / TraeWork',
    // TRAE documents only the project-level file. Global installation is
    // intentionally disabled below rather than guessing a private app path.
    configPath: '',
    localConfigPath: '.trae/mcp.json',
    projectDetectPaths: ['.trae'],
    configKey: 'mcpServers',
    format: 'json',
    supportedTransports: ['stdio', 'http'],
    supportedFields: [],
    detectGlobalInstall: async () =>
      [join(homedir(), '.trae-cn'), join(homedir(), '.trae')].some((path) => existsSync(path)),
    transformConfig: standardMcpConfig
  },
  codebuddy: {
    name: 'codebuddy',
    displayName: 'CodeBuddy Code',
    configPath: join(homedir(), '.codebuddy', '.mcp.json'),
    localConfigPath: '.mcp.json',
    projectDetectPaths: ['.codebuddy'],
    configKey: 'mcpServers',
    format: 'json',
    supportedTransports: ['stdio', 'http', 'sse'],
    supportedFields: [],
    detectGlobalInstall: async () => existsSync(join(homedir(), '.codebuddy')),
    transformConfig: standardMcpConfig
  },
  zcode: {
    name: 'zcode',
    displayName: 'ZCode',
    configPath: join(homedir(), '.zcode', 'cli', 'config.json'),
    localConfigPath: '.zcode/config.json',
    projectDetectPaths: ['.zcode'],
    configKey: 'mcp.servers',
    format: 'json',
    supportedTransports: ['stdio', 'http', 'sse'],
    supportedFields: [],
    detectGlobalInstall: async () => existsSync(join(homedir(), '.zcode')),
    transformConfig: standardMcpConfig
  }
});

export const agentTargets: Record<SupportedAgent, AgentTarget> = {
  antigravity: {
    displayName: 'Antigravity',
    projectHarnessDirectories: [],
    globalHarnessDirectories: (home) => [join(home, '.gemini', 'antigravity')],
    projectSkillDirectory: projectSkill('.agents/skills'),
    globalSkillDirectory: globalSkill('.gemini/antigravity/skills')
  },
  cline: {
    displayName: 'Cline',
    projectHarnessDirectories: ['.cline'],
    globalHarnessDirectories: (home) => [join(home, '.cline')],
    projectSkillDirectory: projectSkill('.agents/skills'),
    globalSkillDirectory: globalSkill('.agents/skills')
  },
  'cline-cli': {
    displayName: 'Cline CLI',
    projectHarnessDirectories: ['.cline'],
    globalHarnessDirectories: (home) => [join(home, '.cline')],
    projectSkillDirectory: projectSkill('.agents/skills'),
    globalSkillDirectory: globalSkill('.agents/skills')
  },
  'claude-code': {
    displayName: 'Claude Code',
    projectHarnessDirectories: ['.claude'],
    globalHarnessDirectories: (home) => [claudeHome(home)],
    projectSkillDirectory: projectSkill('.claude/skills'),
    globalSkillDirectory: (home) => join(claudeHome(home), 'skills', 'monad-design')
  },
  codex: {
    displayName: 'Codex',
    projectHarnessDirectories: ['.codex'],
    globalHarnessDirectories: (home) => [codexHome(home)],
    projectSkillDirectory: projectSkill('.agents/skills'),
    globalSkillDirectory: (home) => join(codexHome(home), 'skills', 'monad-design')
  },
  cursor: {
    displayName: 'Cursor',
    projectHarnessDirectories: ['.cursor'],
    globalHarnessDirectories: (home) => [join(home, '.cursor')],
    projectSkillDirectory: projectSkill('.agents/skills'),
    globalSkillDirectory: globalSkill('.cursor/skills')
  },
  'gemini-cli': {
    displayName: 'Gemini CLI',
    projectHarnessDirectories: ['.gemini'],
    globalHarnessDirectories: (home) => [join(home, '.gemini')],
    projectSkillDirectory: projectSkill('.agents/skills'),
    globalSkillDirectory: globalSkill('.gemini/skills')
  },
  goose: {
    displayName: 'Goose',
    projectHarnessDirectories: ['.goose'],
    globalHarnessDirectories: (home) => [join(home, '.config', 'goose')],
    projectSkillDirectory: projectSkill('.goose/skills'),
    globalSkillDirectory: globalSkill('.config/goose/skills')
  },
  'github-copilot-cli': {
    displayName: 'GitHub Copilot',
    projectHarnessDirectories: ['.github', '.vscode'],
    globalHarnessDirectories: (home) => [join(home, '.copilot')],
    projectSkillDirectory: projectSkill('.agents/skills'),
    globalSkillDirectory: globalSkill('.copilot/skills')
  },
  'grok-build': {
    displayName: 'Grok Build',
    projectHarnessDirectories: ['.grok'],
    globalHarnessDirectories: (home) => [join(home, '.grok')],
    projectSkillDirectory: projectSkill('.grok/skills'),
    globalSkillDirectory: globalSkill('.grok/skills')
  },
  'kilo-code': {
    displayName: 'Kilo Code',
    projectHarnessDirectories: ['.kilocode', '.kilo'],
    globalHarnessDirectories: (home) => [join(home, '.kilocode'), join(home, '.config', 'kilo')],
    projectSkillDirectory: projectSkill('.kilocode/skills'),
    globalSkillDirectory: globalSkill('.kilocode/skills')
  },
  'kimi-code': {
    displayName: 'Kimi Code CLI',
    projectHarnessDirectories: ['.kimi-code', '.kimi'],
    globalHarnessDirectories: (home) => [join(home, '.kimi-code'), join(home, '.kimi')],
    projectSkillDirectory: projectSkill('.agents/skills'),
    globalSkillDirectory: globalSkill('.agents/skills')
  },
  'kiro-cli': {
    displayName: 'Kiro CLI',
    projectHarnessDirectories: ['.kiro'],
    globalHarnessDirectories: (home) => [join(home, '.kiro')],
    projectSkillDirectory: projectSkill('.kiro/skills'),
    globalSkillDirectory: globalSkill('.kiro/skills')
  },
  opencode: {
    displayName: 'OpenCode',
    projectHarnessDirectories: ['.opencode'],
    globalHarnessDirectories: (home) => [join(home, '.config', 'opencode')],
    projectSkillDirectory: projectSkill('.agents/skills'),
    globalSkillDirectory: globalSkill('.config/opencode/skills')
  },
  qoder: {
    displayName: 'Qoder',
    projectHarnessDirectories: ['.qoder'],
    globalHarnessDirectories: (home) => [join(home, '.qoder')],
    projectSkillDirectory: projectSkill('.qoder/skills'),
    globalSkillDirectory: globalSkill('.qoder/skills')
  },
  'qwen-code': {
    displayName: 'Qwen Code',
    projectHarnessDirectories: ['.qwen'],
    globalHarnessDirectories: (home) => [qwenHome(home)],
    projectSkillDirectory: projectSkill('.qwen/skills'),
    globalSkillDirectory: (home) => join(qwenHome(home), 'skills', 'monad-design')
  },
  trae: {
    displayName: 'TRAE / TraeWork',
    projectHarnessDirectories: ['.trae'],
    globalHarnessDirectories: (home) => [join(home, '.trae-cn'), join(home, '.trae')],
    projectSkillDirectory: projectSkill('.trae/skills'),
    globalSkillDirectory: globalSkill('.trae-cn/skills'),
    installScopes: ['project']
  },
  codebuddy: {
    displayName: 'CodeBuddy Code',
    projectHarnessDirectories: ['.codebuddy'],
    globalHarnessDirectories: (home) => [join(home, '.codebuddy')],
    projectSkillDirectory: projectSkill('.codebuddy/skills'),
    globalSkillDirectory: globalSkill('.codebuddy/skills')
  },
  vscode: {
    displayName: 'VS Code (GitHub Copilot)',
    projectHarnessDirectories: ['.github', '.vscode'],
    globalHarnessDirectories: (home) => [
      join(home, '.copilot'),
      join(home, 'Library', 'Application Support', 'Code', 'User')
    ],
    projectSkillDirectory: projectSkill('.agents/skills'),
    globalSkillDirectory: globalSkill('.copilot/skills')
  },
  windsurf: {
    displayName: 'Windsurf',
    projectHarnessDirectories: ['.windsurf'],
    globalHarnessDirectories: (home) => [join(home, '.codeium', 'windsurf')],
    projectSkillDirectory: projectSkill('.windsurf/skills'),
    globalSkillDirectory: globalSkill('.codeium/windsurf/skills')
  },
  zcode: {
    displayName: 'ZCode',
    projectHarnessDirectories: ['.zcode'],
    globalHarnessDirectories: (home) => [join(home, '.zcode')],
    projectSkillDirectory: projectSkill('.zcode/skills'),
    globalSkillDirectory: globalSkill('.zcode/skills')
  },
  zed: {
    displayName: 'Zed',
    projectHarnessDirectories: ['.zed'],
    globalHarnessDirectories: (home) => [
      join(home, '.config', 'zed'),
      join(home, 'Library', 'Application Support', 'Zed')
    ],
    projectSkillDirectory: projectSkill('.agents/skills'),
    globalSkillDirectory: globalSkill('.agents/skills')
  }
};

export const agentDisplayName = (agent: SupportedAgent) => agentTargets[agent].displayName;

export const supportsInstallationScope = (agent: SupportedAgent, scope: InstallScope) =>
  agentTargets[agent].installScopes?.includes(scope) ??
  (scope === 'global' || Boolean((agents as Record<string, AgentConfig>)[agent]?.localConfigPath));

export const supportsProjectInstallation = (agent: SupportedAgent) => supportsInstallationScope(agent, 'project');

export const isSupportedAgent = (agent: AgentType | string): agent is SupportedAgent =>
  supportedAgents.includes(agent as SupportedAgent);

export const detectProjectSkillAgents = (root: string): SupportedAgent[] =>
  supportedAgents.filter((agent) =>
    agentTargets[agent].projectHarnessDirectories.some((directory) => existsSync(join(root, directory)))
  );

export const detectGlobalSkillAgents = (home = homedir()): SupportedAgent[] =>
  supportedAgents.filter((agent) =>
    agentTargets[agent].globalHarnessDirectories(home).some((directory) => existsSync(directory))
  );

export const skillInstallDirectory = (
  agent: SupportedAgent,
  scope: InstallScope,
  projectRoot?: string,
  home = homedir()
) => {
  if (scope === 'project') {
    if (!projectRoot) throw new Error('A Git project is required for project-scoped skill installation.');
    return agentTargets[agent].projectSkillDirectory(projectRoot);
  }
  return agentTargets[agent].globalSkillDirectory(home);
};
