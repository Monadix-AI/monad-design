import type { SupportedAgent } from '@monaddesign/agent-integration';

const icons: Record<SupportedAgent, string> = {
  antigravity: 'antigravity-color.svg',
  cline: 'cline-official.png',
  'cline-cli': 'cline-official.png',
  'claude-code': 'claudecode-color.svg',
  codex: 'codex-color.svg',
  cursor: 'cursor-official.svg',
  'deepseek-harness': 'deepseek-color.svg',
  'gemini-cli': 'geminicli-color.svg',
  goose: 'goose.svg',
  'github-copilot-cli': 'githubcopilot.svg',
  'grok-build': 'grok.svg',
  'kilo-code': 'kilo-official.svg',
  'kimi-code': 'kimi-color.svg',
  'kiro-cli': 'kiro-color.svg',
  opencode: 'opencode.svg',
  qoder: 'qoder-color.svg',
  'qwen-code': 'qwen-color.svg',
  trae: 'trae-color.svg',
  codebuddy: 'codebuddy-color.svg',
  vscode: 'vscode.png',
  windsurf: 'windsurf.svg',
  zcode: 'zcode.png',
  zed: 'zed.png'
};

export function AgentIcon({ agent }: { agent: SupportedAgent }) {
  return (
    <span
      aria-hidden="true"
      className="setup-agent-logo"
      data-agent={agent}
    >
      <img
        alt=""
        className="setup-agent-image"
        draggable={false}
        height={28}
        src={`./agent-icons/${icons[agent]}`}
        width={28}
      />
    </span>
  );
}
