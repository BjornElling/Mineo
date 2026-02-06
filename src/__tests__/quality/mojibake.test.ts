import { execFileSync } from 'node:child_process';

describe('mojibake guard', () => {
  it('fails if tracked files contain mojibake or invalid UTF-8', () => {
    let stderr = '';

    try {
      execFileSync('node', ['scripts/check-mojibake.mjs', '--quiet'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'ignore', 'pipe'],
      });
    } catch (error) {
      if (error instanceof Error && 'stderr' in error) {
        const maybeStderr = (error as { stderr?: Buffer }).stderr;
        stderr = maybeStderr ? maybeStderr.toString('utf8') : '';
      }
      expect.fail(stderr || 'Mojibake-check fejlede uden fejltekst.');
    }
  });
});
