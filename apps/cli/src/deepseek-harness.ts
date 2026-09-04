import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const blockStart = '# monad-design:mcp:start';
const blockEnd = '# monad-design:mcp:end';

const quoteYaml = (value: string) => `'${value.replaceAll("'", "''")}'`;

const renderMcpPatch = (mcpUrl: string) =>
  [
    blockStart,
    '- insert:',
    '    - id: mcp-monad-design',
    "      name: '@deepseek-ai/dsh-mcp-client'",
    '      config:',
    '        serverName: monad-design',
    '        transport: streamable-http',
    `        url: ${quoteYaml(mcpUrl)}`,
    blockEnd
  ].join('\n');

export const deepSeekHarnessHome = (home?: string) =>
  home ? join(home, '.dsh') : process.env.DSH_HOME?.trim() || join(homedir(), '.dsh');

export const upsertDeepSeekHarnessServer = async (mcpUrl: string, home?: string) => {
  const path = join(deepSeekHarnessHome(home), 'cordis.patch.yml');
  let current = '';
  try {
    current = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const managedStart = current.indexOf(blockStart);
  const managedEnd = current.indexOf(blockEnd);
  if (managedStart >= 0 !== managedEnd >= 0 || (managedStart >= 0 && managedEnd < managedStart)) {
    throw new Error(`Could not safely update the incomplete Monad Design block in ${path}`);
  }

  const block = renderMcpPatch(mcpUrl);
  let next: string;
  if (managedStart >= 0) {
    next = `${current.slice(0, managedStart)}${block}${current.slice(managedEnd + blockEnd.length)}`;
  } else {
    if (/\bid:\s*['"]?mcp-monad-design['"]?\b/.test(current)) {
      throw new Error(`Remove or rename the existing mcp-monad-design row in ${path}, then retry.`);
    }
    const base = current.trim() === '[]' ? '' : current.trimEnd();
    next = base ? `${base}\n${block}\n` : `${block}\n`;
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, next, 'utf8');
  return path;
};
