import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackageManifest {
  name: string;
  version: string;
  private?: boolean;
  build?: {
    appId?: string;
    productName?: string;
    mac?: { hardenedRuntime?: boolean; notarize?: boolean };
  };
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(root, '../..');
const tag = process.argv[2];
const fail = (message: string): never => {
  throw new Error(`Desktop release verification failed: ${message}`);
};

if (!tag) fail('pass a desktop@<version> tag');
const match = /^desktop@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u.exec(tag);
if (!match) fail(`tag ${tag} must use desktop@<semver>`);
const version = tag.slice('desktop@'.length);

const desktop = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as PackageManifest;
if (desktop.name !== '@monaddesign/client') fail(`unexpected package name ${desktop.name}`);
if (desktop.version !== version) fail(`tag version ${version} does not match package version ${desktop.version}`);
if (!desktop.private) fail('Desktop package must remain private');
if (desktop.build?.appId !== 'ai.monadix.design') fail('unexpected application identifier');
if (desktop.build.productName !== 'Monad Design') fail('unexpected product name');
if (!desktop.build.mac?.hardenedRuntime) fail('hardened runtime must be enabled');
if (!desktop.build.mac.notarize) fail('notarization must be enabled');

const lockfile = await readFile(join(repository, 'bun.lock'), 'utf8');
const escapedVersion = version.replaceAll('.', '\\.');
const desktopEntry = new RegExp(
  `"apps/desktop": \\{\\n\\s+"name": "@monaddesign/client",\\n\\s+"version": "${escapedVersion}"`,
  'u'
);
if (!desktopEntry.test(lockfile)) fail(`bun.lock does not contain Desktop version ${version}`);

process.stdout.write(`Verified Monad Design Desktop ${version} for release tag ${tag}.\n`);
