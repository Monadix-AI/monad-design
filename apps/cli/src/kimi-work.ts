import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { installSkillBundle } from './skill-installer';

interface KimiWorkPluginOptions {
  outputDirectory: string;
  skillSourcePath: string;
  version: string;
  mcpUrl: string;
}

// Export a self-contained native plugin. Kimi Work owns importing and enabling it;
// its private app configuration is deliberately not used as an installation API.
export const exportKimiWorkPlugin = async (options: KimiWorkPluginOptions) => {
  const endpoint = new URL(options.mcpUrl);
  if (
    endpoint.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname) ||
    endpoint.pathname !== '/mcp' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error('Kimi Work requires the local Monad Design Core HTTP /mcp endpoint.');
  }
  await mkdir(options.outputDirectory, { recursive: true });
  const directory = await mkdtemp(join(options.outputDirectory, 'monad-design-'));
  try {
    await installSkillBundle(options.skillSourcePath, join(directory, 'skills', 'monad-design'), {
      includeOpenAiMetadata: false
    });
    const manifest = {
      name: 'monad-design',
      version: options.version,
      description: 'Refine native mobile UI in a running Simulator with source edits, rebuilds, and comparison.',
      license: 'Apache-2.0',
      homepage: 'https://github.com/Monadix-AI/monad-design',
      skills: './skills/',
      interface: {
        displayName: 'Monad Design',
        shortDescription: 'The app is the canvas.'
      },
      mcpServers: { 'monad-design': { url: endpoint.href } }
    };
    await writeFile(join(directory, 'kimi.plugin.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(
      join(directory, 'README.md'),
      `# Monad Design for Kimi Work

This plugin is prepared for the Mac where the installer ran. Core must run on
the same Mac as Kimi Work. Requires Apple silicon, Xcode, and an iOS Simulator.

In Kimi Work, open Custom plugin / Plugin Builder and ask it to import this
local plugin directory, preserving kimi.plugin.json, the Skill references, and
the local MCP URL. Install Monad Design from Plugins > Personal, then open a
task with your native app repository and ask to use Monad Design.

Preparing this directory does not install or enable the plugin in Kimi Work.
Verify that the task exposes the monad-design Skill and MCP tools before use.
If the app has not refreshed its tools, start a new task.

If Core has stopped, run: npx monad-design core start
If the Core endpoint changes, regenerate and reimport the plugin.
Keep this directory as the plugin source for future imports and updates.

Desktop end-to-end compatibility still requires verification in Kimi Work.
`
    );
    return directory;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
};
