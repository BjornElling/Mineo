import fs from 'node:fs';
import path from 'node:path';

type CollectSourceFilesOptions = Readonly<{
  ignoredDirectories?: readonly string[];
}>;

const DEFAULT_IGNORED_DIRECTORIES = ['__tests__', 'test'] as const;

export const toRepoRelativePath = (absolutePath: string): string => {
  return path.relative(process.cwd(), absolutePath).replaceAll('\\', '/');
};

export const assertPathExists = (absolutePath: string, description: string): void => {
  expect(
    fs.existsSync(absolutePath),
    `${description} findes ikke: ${toRepoRelativePath(absolutePath)}`
  ).toBe(true);
};

export const collectSourceFiles = (
  root: string,
  options?: CollectSourceFilesOptions
): string[] => {
  if (!fs.existsSync(root)) {
    throw new Error(`Forventet test-root findes ikke: ${toRepoRelativePath(root)}`);
  }

  const ignoredDirectories = new Set(options?.ignoredDirectories ?? DEFAULT_IGNORED_DIRECTORIES);
  const stats = fs.statSync(root);
  if (stats.isFile()) return [root];

  const files: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name)) continue;
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }

  return files;
};
