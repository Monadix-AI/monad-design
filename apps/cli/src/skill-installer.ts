import { cp, mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

interface SkillInstallOptions {
  includeOpenAiMetadata?: boolean;
}

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
