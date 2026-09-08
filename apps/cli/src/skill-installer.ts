import { cp, mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

interface SkillInstallOptions {
  includeOpenAiMetadata?: boolean;
}

/** Install named companion skills beside the Live entrypoint so agents discover them normally. */
export const installSkillBundle = async (
  sourcePath: string,
  destinationPath: string,
  options: SkillInstallOptions = {}
) => {
  const names: unknown = JSON.parse(await readFile(join(sourcePath, 'companion-skills.json'), 'utf8'));
  if (
    !Array.isArray(names) ||
    !names.length ||
    names.some((name) => typeof name !== 'string' || !/^monad-design-[a-z]+$/u.test(name)) ||
    new Set(names).size !== names.length
  ) {
    throw new Error('Invalid Monad Design companion skill manifest.');
  }
  const companions = names.map((name: string) => ({
    name,
    source: join(sourcePath, '..', 'adjustment-skills', name),
    destination: join(dirname(destinationPath), name)
  }));
  // Check the entire pack before replacing any installed entrypoint.
  await readFile(join(sourcePath, 'SKILL.md'), 'utf8');
  for (const companion of companions) {
    const body = await readFile(join(companion.source, 'SKILL.md'), 'utf8');
    if (!body.includes(`name: ${companion.name}\n`)) throw new Error(`Invalid companion skill: ${companion.name}`);
  }
  for (const companion of companions) await installSkillDirectory(companion.source, companion.destination, options);
  await installSkillDirectory(sourcePath, destinationPath, options);
  return [destinationPath, ...companions.map(({ destination }) => destination)];
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
