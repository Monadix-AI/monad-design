import { cp, mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

interface SkillInstallOptions {
  includeOpenAiMetadata?: boolean;
}

interface AdjustmentGuide {
  name: string;
  version: string;
  relativePath: string;
}

const readAdjustmentGuides = async (sourcePath: string) => {
  const guides: unknown = JSON.parse(await readFile(join(sourcePath, 'adjustments.json'), 'utf8'));
  if (
    !Array.isArray(guides) ||
    guides.length === 0 ||
    guides.some(
      (guide) =>
        typeof guide?.name !== 'string' ||
        !/^monad-design-[a-z]+$/u.test(guide.name) ||
        typeof guide.version !== 'string' ||
        !/^references\/adjustments\/[a-z]+\.md$/u.test(guide.relativePath)
    ) ||
    new Set(guides.map(({ name }: AdjustmentGuide) => name)).size !== guides.length ||
    new Set(guides.map(({ relativePath }: AdjustmentGuide) => relativePath)).size !== guides.length
  ) {
    throw new Error('Invalid Monad Design adjustment guide manifest.');
  }
  return guides as AdjustmentGuide[];
};

export const installSkillDirectory = async (
  sourcePath: string,
  destinationPath: string,
  options: SkillInstallOptions = {}
) => {
  const parent = dirname(destinationPath);
  await mkdir(parent, { recursive: true });
  const nonce = `${process.pid}.${Date.now()}`;
  const temporaryPath = `${destinationPath}.${nonce}.tmp`;
  const backupPath = `${destinationPath}.${nonce}.bak`;
  await rm(temporaryPath, { recursive: true, force: true });
  await cp(sourcePath, temporaryPath, { recursive: true });
  if (options.includeOpenAiMetadata === false) {
    const agentsPath = join(temporaryPath, 'agents');
    await rm(join(agentsPath, 'openai.yaml'), { force: true });
    const remainingAgentMetadata = await readdir(agentsPath).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    });
    if (remainingAgentMetadata.length === 0) {
      await rm(agentsPath, { recursive: true });
    }
  }

  let backedUp = false;
  try {
    await rename(destinationPath, backupPath);
    backedUp = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  try {
    await rename(temporaryPath, destinationPath);
    if (backedUp) await rm(backupPath, { recursive: true, force: true });
  } catch (error) {
    if (backedUp) await rename(backupPath, destinationPath).catch(() => undefined);
    throw error;
  } finally {
    await rm(temporaryPath, { recursive: true, force: true });
  }
};

export const removeLegacyAdjustmentSkills = async (sourcePath: string, destinationPath: string) => {
  const guides = await readAdjustmentGuides(sourcePath);
  const removed: string[] = [];
  for (const guide of guides) {
    const legacyPath = join(dirname(destinationPath), guide.name);
    let body: string;
    try {
      body = await readFile(join(legacyPath, 'SKILL.md'), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    if (!new RegExp(`^name:\\s*${guide.name}\\s*$`, 'mu').test(body)) continue;
    await rm(legacyPath, { recursive: true });
    removed.push(legacyPath);
  }
  return removed;
};

export const installMonadDesignSkill = async (
  sourcePath: string,
  destinationPath: string,
  options: SkillInstallOptions = {}
) => {
  await readFile(join(sourcePath, 'SKILL.md'), 'utf8');
  const guides = await readAdjustmentGuides(sourcePath);
  for (const guide of guides) {
    const body = await readFile(join(sourcePath, guide.relativePath), 'utf8');
    if (!body.includes(`name: ${guide.name}\n`) || !body.includes(`version: "${guide.version}"\n`)) {
      throw new Error(`Invalid Monad Design adjustment guide: ${guide.name}`);
    }
  }
  await installSkillDirectory(sourcePath, destinationPath, options);
  await removeLegacyAdjustmentSkills(sourcePath, destinationPath);
  return destinationPath;
};

export const removeLegacyMonadDesignSkill = async (legacyPath: string) => {
  let skill: string;
  try {
    skill = await readFile(`${legacyPath}/SKILL.md`, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
  if (!/^name:\s*monad-design-live\s*$/m.test(skill)) return false;
  await rm(legacyPath, { recursive: true });
  return true;
};
