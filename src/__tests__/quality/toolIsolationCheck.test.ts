import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Kontrollen findes, fordi `@playwright/cli`/`@playwright/mcp` og `@playwright/test` begge
 * deklarerer kommandoen `playwright` i én og samme node_modules. npm gav slottet til CLI-familiens
 * alpha-runtime, og `npx playwright test` fejlede derefter på hver eneste E2E-fil med «did not
 * expect test.describe() to be called here». Testene her beviser tre ting: at reglen fanger
 * netop den situation, at den er generel (ethvert kolliderende kommandonavn, ikke kun Playwright),
 * og at den stadig er grøn mod det virkelige repo.
 */

type LockEntry = {
  version?: string;
  bin?: Record<string, string>;
  dev?: boolean;
};

type Fixture = {
  packageJson: Record<string, unknown>;
  packageLock: { lockfileVersion: number; requires: boolean; packages: Record<string, LockEntry> };
  toolManifest: Record<string, unknown> | null;
  toolLock: boolean;
  binShimTarget: string | null;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const checkScript = join(repoRoot, 'scripts', 'check-tool-isolation.mjs');

const makeFixture = (): Fixture => ({
  packageJson: {
    name: 'tool-isolation-test',
    version: '1.0.0',
    devDependencies: { '@playwright/test': '^1.62.1' },
  },
  packageLock: {
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': { version: '1.0.0' },
      'node_modules/@playwright/test': {
        version: '1.62.1',
        dev: true,
        bin: { playwright: 'cli.js' },
      },
      'node_modules/@playwright/test/node_modules/playwright': {
        version: '1.62.1',
        dev: true,
        bin: { playwright: 'cli.js' },
      },
      'node_modules/@playwright/test/node_modules/playwright-core': {
        version: '1.62.1',
        dev: true,
        bin: { 'playwright-core': 'cli.js' },
      },
    },
  },
  toolManifest: {
    name: 'fixture-agent-tools',
    private: true,
    dependencies: { '@playwright/cli': '^0.1.18', '@playwright/mcp': '^0.0.79' },
  },
  toolLock: true,
  binShimTarget: '@playwright/test',
});

const writeFixture = (fixture: Fixture): string => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'mineo-tool-isolation-'));
  writeFileSync(join(fixtureRoot, 'package.json'), `${JSON.stringify(fixture.packageJson, null, 2)}\n`);
  writeFileSync(join(fixtureRoot, 'package-lock.json'), `${JSON.stringify(fixture.packageLock, null, 2)}\n`);

  if (fixture.toolManifest !== null) {
    const toolRoot = join(fixtureRoot, '.agents', 'tools');
    mkdirSync(toolRoot, { recursive: true });
    writeFileSync(join(toolRoot, 'package.json'), `${JSON.stringify(fixture.toolManifest, null, 2)}\n`);
    if (fixture.toolLock) {
      writeFileSync(join(toolRoot, 'package-lock.json'), `${JSON.stringify({ lockfileVersion: 3 }, null, 2)}\n`);
    }
  }

  const binDirectory = join(fixtureRoot, 'node_modules', '.bin');
  mkdirSync(binDirectory, { recursive: true });
  if (fixture.binShimTarget !== null) {
    // Samme form som npm's egen sh-shim: kommandoen er kun så god som den sti, den peger på.
    writeFileSync(
      join(binDirectory, 'playwright'),
      `#!/bin/sh\nexec node  "$basedir/../${fixture.binShimTarget}/cli.js" "$@"\n`
    );
  }

  return fixtureRoot;
};

const runCheck = (fixtureRoot: string): ReturnType<typeof spawnSync> => spawnSync(
  process.execPath,
  [checkScript, '--repo', fixtureRoot],
  { encoding: 'utf8' }
);

const withFixture = (fixture: Fixture, assert: (result: ReturnType<typeof spawnSync>) => void): void => {
  const fixtureRoot = writeFixture(fixture);
  try {
    assert(runCheck(fixtureRoot));
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
};

const output = (result: ReturnType<typeof spawnSync>): string => `${result.stdout}${result.stderr}`;

describe('check-tool-isolation', () => {
  it('accepterer et træ hvor E2E-motoren alene ejer playwright-kommandoen', () => {
    withFixture(makeFixture(), (result) => {
      expect(output(result)).toContain('én ejer');
      expect(result.status).toBe(0);
    });
  });

  it('fanger netop den kollision, der brød npx playwright test', () => {
    const fixture = makeFixture();
    // CLI/MCP-familiens runtime hejst til top-level ved siden af E2E-motoren.
    fixture.packageLock.packages['node_modules/playwright'] = {
      version: '1.63.0-alpha-2026-08-05',
      dev: true,
      bin: { playwright: 'cli.js' },
    };
    withFixture(fixture, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain("kommandoen 'playwright' deklareres af flere top-level pakker");
      expect(output(result)).toContain('1.63.0-alpha-2026-08-05');
    });
  });

  it('er en generel regel om kommandonavne, ikke en Playwright-specifik undtagelse', () => {
    const fixture = makeFixture();
    fixture.packageLock.packages['node_modules/hurtig-vaerktoej'] = {
      version: '1.0.0',
      bin: { vaerktoej: 'cli.js' },
    };
    fixture.packageLock.packages['node_modules/@andet/vaerktoej'] = {
      version: '2.0.0',
      bin: { vaerktoej: 'bin/cli.js' },
    };
    withFixture(fixture, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain("kommandoen 'vaerktoej' deklareres af flere top-level pakker");
    });
  });

  it('lader en nestet pakke beholde sit kommandonavn, fordi kun top-level slås om .bin', () => {
    const fixture = makeFixture();
    fixture.packageLock.packages['node_modules/en-pakke/node_modules/playwright'] = {
      version: '1.63.0-alpha-2026-08-05',
      bin: { playwright: 'cli.js' },
    };
    withFixture(fixture, (result) => {
      // Nestet placering er npm's egen løsning på versionskonflikten og må ikke give falsk rødt …
      expect(output(result)).not.toContain('deklareres af flere top-level pakker');
      // … men familien skal stadig følges ad, og det gør den ikke her.
      expect(result.status).toBe(1);
      expect(output(result)).toContain('er låst i flere udgaver');
    });
  });

  it('afviser at agentværktøjerne flytter tilbage i projektets eget manifest', () => {
    const fixture = makeFixture();
    fixture.packageJson.devDependencies = {
      '@playwright/test': '^1.62.1',
      '@playwright/cli': '^0.1.18',
    };
    withFixture(fixture, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain('@playwright/cli er deklareret i package.json');
    });
  });

  it('kræver at agentværktøjerne har et eget, låst manifest', () => {
    const fixture = makeFixture();
    fixture.toolManifest = null;
    withFixture(fixture, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain(`${join('.agents', 'tools', 'package.json')} mangler`);
    });

    const withoutLock = makeFixture();
    withoutLock.toolLock = false;
    withFixture(withoutLock, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain('package-lock.json mangler');
    });
  });

  it('måler det installerede træ særskilt fra lockfilen', () => {
    // Lockfilen er ren; kun den faktiske .bin-shim er forkert. Fanger kontrollen det, måler den
    // installationen — ikke bare manifestet.
    const wrongOwner = makeFixture();
    wrongOwner.binShimTarget = 'playwright';
    withFixture(wrongOwner, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain('peger på playwright i stedet for @playwright/test');
    });

    const missingShim = makeFixture();
    missingShim.binShimTarget = null;
    withFixture(missingShim, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain('node_modules/.bin/playwright mangler');
    });
  });

  it('afviser en Playwright-familie der ikke følges ad i version', () => {
    const fixture = makeFixture();
    fixture.packageLock.packages['node_modules/@playwright/test/node_modules/playwright-core'] = {
      version: '1.61.0',
      dev: true,
      bin: { 'playwright-core': 'cli.js' },
    };
    withFixture(fixture, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain('Playwright-familien følges ikke ad');
    });
  });

  it('er grøn mod det virkelige repo', () => {
    const result = runCheck(repoRoot);
    expect(output(result)).toContain('én ejer');
    expect(result.status).toBe(0);
  });
});
