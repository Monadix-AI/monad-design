const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

// Sign the nested payload before sealing hashes and signing the outer .app.
// electron-builder must not re-sign these files after release.json is written.
module.exports = async (context) => {
  const root = join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
    'Contents/Resources/installer'
  );
  const manifest = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));
  const architecture = ['ia32', 'x64', 'armv7l', 'arm64'][context.arch];
  if (architecture !== manifest.arch) throw new Error('Desktop and bundled Core architectures differ.');
  const identity = process.env.MONAD_DESIGN_DESKTOP_SIGNING_IDENTITY ?? process.env.CSC_NAME;
  if (!identity && process.env.CSC_IDENTITY_AUTO_DISCOVERY !== 'false') {
    throw new Error(
      'Set MONAD_DESIGN_DESKTOP_SIGNING_IDENTITY or CSC_NAME to sign the Core payload, or CSC_IDENTITY_AUTO_DISCOVERY=false for a local unsigned build.'
    );
  }
  for (const file of ['core/monad-design', 'core/native/serve-sim-native.node']) {
    const path = join(root, file);
    if (identity) {
      // Ad-hoc signatures have no Team ID, so hardened library validation
      // rejects even our own addon. Local builds must not enable runtime;
      // Developer ID builds keep it and sign both files with the same team.
      const signingOptions =
        identity === '-' ? ['--timestamp=none', '--options', '0'] : ['--timestamp', '--options', 'runtime'];
      execFileSync('/usr/bin/codesign', [
        '--force',
        '--sign',
        identity,
        ...signingOptions,
        '--entitlements',
        join(__dirname, '../build/core-entitlements.plist'),
        path
      ]);
    }
    manifest.hashes[file] = createHash('sha256').update(readFileSync(path)).digest('hex');
  }
  writeFileSync(join(root, 'release.json'), `${JSON.stringify(manifest, null, 2)}\n`);
};
