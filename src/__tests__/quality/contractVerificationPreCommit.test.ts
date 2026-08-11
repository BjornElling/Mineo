import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = resolve(process.cwd());
const contractPath = 'src/contracts/error-contract.md';
const scriptPath = join(repoRoot, 'scripts/check-contract-verification.mjs');

const gitIndexPath = (): string => {
  const gitPath = execFileSync('git', ['rev-parse', '--git-path', 'index'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  return resolve(repoRoot, gitPath);
};

const stageInTemporaryIndex = (indexPath: string, content: string): void => {
  const env = { ...process.env, GIT_INDEX_FILE: indexPath };
  const blobSha = execFileSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    input: content,
  }).trim();
  execFileSync('git', ['update-index', '--add', '--cacheinfo', `100644,${blobSha},${contractPath}`], {
    cwd: repoRoot,
    env,
  });
};

describe('check-contract-verification --staged', () => {
  it('afviser en staged kontrakt med et forældet verifikationsstempel', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'mineo-contract-verification-'));
    const temporaryIndex = join(temporaryDirectory, 'index');

    try {
      copyFileSync(gitIndexPath(), temporaryIndex);
      const staleContract = readFileSync(join(repoRoot, contractPath), 'utf8').replace(
        /\*\*Senest verificeret mod kode:\*\*\s*\d{4}-\d{2}-\d{2}/,
        '**Senest verificeret mod kode:** 2000-01-01'
      );
      stageInTemporaryIndex(temporaryIndex, staleContract);

      const result = spawnSync(process.execPath, [scriptPath, '--staged'], {
        cwd: repoRoot,
        env: { ...process.env, GIT_INDEX_FILE: temporaryIndex },
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`${contractPath}: stemplet er 2000-01-01`);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
