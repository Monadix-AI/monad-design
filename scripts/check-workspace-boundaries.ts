import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

type Manifest = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type Workspace = {
  directory: string;
  manifest: Manifest;
  manifestPath: string;
  name: string;
  type: 'app' | 'package';
};

const repositoryRoot = process.cwd();
const dependencyFields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const;
const sourcePattern = '**/*.{ts,tsx,js,jsx,mjs,cjs}';
const importPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g;

const posixPath = (path: string) => path.split(sep).join('/');
const displayPath = (path: string) => posixPath(relative(repositoryRoot, path));
const dependencyEntries = (manifest: Manifest) =>
  dependencyFields.flatMap((field) =>
    Object.entries(manifest[field] ?? {}).map(([name, version]) => ({ field, name, version }))
  );

const manifestPaths: string[] = [];
for (const parent of ['apps', 'packages']) {
  const glob = new Bun.Glob('*/package.json');
  for await (const path of glob.scan({ cwd: resolve(repositoryRoot, parent), onlyFiles: true })) {
    manifestPaths.push(resolve(repositoryRoot, parent, path));
  }
}

const workspaces: Workspace[] = [];
const errors: string[] = [];
for (const manifestPath of manifestPaths.sort()) {
  const manifest = (await Bun.file(manifestPath).json()) as Manifest;
  if (!manifest.name) {
    errors.push(`${displayPath(manifestPath)} must declare a package name`);
    continue;
  }
  const directory = dirname(manifestPath);
  workspaces.push({
    directory,
    manifest,
    manifestPath,
    name: manifest.name,
    type: displayPath(directory).startsWith('apps/') ? 'app' : 'package'
  });
}

const workspacesByName = new Map<string, Workspace>();
for (const workspace of workspaces) {
  const duplicate = workspacesByName.get(workspace.name);
  if (duplicate) {
    errors.push(
      `${displayPath(workspace.manifestPath)} duplicates workspace name ${workspace.name} from ${displayPath(duplicate.manifestPath)}`
    );
  } else {
    workspacesByName.set(workspace.name, workspace);
  }
}

const workspaceForPath = (path: string) => {
  const absolutePath = isAbsolute(path) ? path : resolve(repositoryRoot, path);
  return workspaces.find(
    ({ directory }) => absolutePath === directory || absolutePath.startsWith(`${directory}${sep}`)
  );
};

const dependencyGraph = new Map<string, Set<string>>();
for (const workspace of workspaces) {
  const dependencies = new Set<string>();
  dependencyGraph.set(workspace.name, dependencies);

  for (const { field, name, version } of dependencyEntries(workspace.manifest)) {
    if (!name.startsWith('@monaddesign/')) continue;
    const target = workspacesByName.get(name);
    if (!target) {
      errors.push(`${displayPath(workspace.manifestPath)} declares unknown internal dependency ${name}`);
      continue;
    }
    if (version !== 'workspace:*') {
      errors.push(
        `${displayPath(workspace.manifestPath)} must use workspace:* for ${name} in ${field}, found ${version}`
      );
    }
    dependencies.add(name);

    if (workspace.type === 'package' && target.type === 'app') {
      errors.push(`${workspace.name} is a shared package and must not depend on application ${target.name}`);
    }
    if (workspace.name === '@monaddesign/core' && target.type === 'app') {
      errors.push(`${workspace.name} is the runtime boundary and must not depend on application ${target.name}`);
    }
    if (workspace.name === '@monaddesign/mobile' && target.type === 'app') {
      errors.push(`${workspace.name} must communicate through shared contracts instead of depending on ${target.name}`);
    }
    if (workspace.name === '@monaddesign/client' && target.type === 'app' && target.name !== '@monaddesign/core') {
      errors.push(`${workspace.name} may depend on Core but not on application ${target.name}`);
    }
  }
}

const visited = new Set<string>();
const active = new Set<string>();
const stack: string[] = [];
const visit = (name: string) => {
  if (visited.has(name)) return;
  if (active.has(name)) {
    const start = stack.indexOf(name);
    errors.push(`workspace dependency cycle: ${[...stack.slice(start), name].join(' -> ')}`);
    return;
  }
  active.add(name);
  stack.push(name);
  for (const dependency of dependencyGraph.get(name) ?? []) visit(dependency);
  stack.pop();
  active.delete(name);
  visited.add(name);
};
for (const name of dependencyGraph.keys()) visit(name);

for (const workspace of workspaces) {
  const declaredDependencies = new Set(dependencyEntries(workspace.manifest).map(({ name }) => name));
  const glob = new Bun.Glob(sourcePattern);
  for await (const sourcePath of glob.scan({ cwd: workspace.directory, onlyFiles: true })) {
    const absoluteSourcePath = resolve(workspace.directory, sourcePath);
    const source = await Bun.file(absoluteSourcePath).text();
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier) continue;

      if (specifier.startsWith('.')) {
        const target = workspaceForPath(resolve(dirname(absoluteSourcePath), specifier));
        if (target && target.name !== workspace.name) {
          errors.push(
            `${displayPath(absoluteSourcePath)} crosses into ${target.name} with relative import ${specifier}; use its public package export`
          );
        }
        continue;
      }

      if (!specifier.startsWith('@monaddesign/')) continue;
      const target = [...workspacesByName.keys()]
        .sort((left, right) => right.length - left.length)
        .find((name) => specifier === name || specifier.startsWith(`${name}/`));
      if (!target) {
        errors.push(`${displayPath(absoluteSourcePath)} imports unknown internal package ${specifier}`);
      } else if (target !== workspace.name && !declaredDependencies.has(target)) {
        errors.push(
          `${displayPath(absoluteSourcePath)} imports ${target}, but ${displayPath(workspace.manifestPath)} does not declare it`
        );
      }
    }
  }
}

if (errors.length) {
  const uniqueErrors = [...new Set(errors)].sort();
  process.stderr.write(`${uniqueErrors.map((error) => `- ${error}`).join('\n')}\n`);
  process.stderr.write(`\nWorkspace boundary check failed with ${uniqueErrors.length} error(s).\n`);
  process.exit(1);
}

process.stdout.write(`Workspace boundaries valid across ${workspaces.length} workspaces.\n`);
