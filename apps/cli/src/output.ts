export const writeLine = (message = '') => process.stdout.write(`${message}\n`);

export const writeError = (message: string) => process.stderr.write(`${message}\n`);
