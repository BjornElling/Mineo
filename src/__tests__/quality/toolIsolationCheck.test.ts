import { spawnSync } from 'node:child_process';
import {
  lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// @ts-expect-error — kontrollen er et .mjs-script uden typedeklarationer.
import { packageNameFromBinTarget, resolveInstalledCommandOwner } from '../../../scripts/check-tool-isolation.mjs';

/**
 * Kontrollen findes, fordi `@playwright/cli`/`@playwright/mcp` og `@playwright/test` begge
 * deklarerer kommandoen `playwright` i én og samme node_modules. npm gav slottet til CLI-familiens
 * alpha-runtime, og `npx playwright test` fejlede derefter på hver eneste E2E-fil med «did not
 * expect test.describe() to be called here». Testene her beviser tre ting: at reglen fanger
 * netop den situation, at den er generel (ethvert kolliderende kommandonavn, ikke kun Playwright),
 * og at den stadig er grøn mod det virkelige repo.
 *
 * Fixturen skriver `.bin`-slottet med BEGGE de mekanismer, npm bruger, fordi valget er
 * platformbestemt og usynligt i koden: en shim-FIL på Windows, hvis indhold nævner pakkestien,
 * og et SYMLINK på POSIX (herunder CI's ubuntu-runner), hvis mål er pakkestien. Kontrollen læste
 * oprindeligt kun filindholdet; på Linux fulgte `readFileSync` symlinket og læste Playwrights egen
 * `cli.js`, hvor regexen intet fandt — så CI meldte «peger på et ukendt sted», selv om
 * afhængighedsgrafen var i orden. Testene var grønne, fordi fixturen kun kunne skrive shim-filer.
 * Derfor er linkformen nu en eksplicit dimension: enhver ny påstand om `.bin` skal holde i begge.
 */

type LockEntry = {
  version?: string;
  bin?: Record<string, string>;
  dev?: boolean;
};

/**
 * De to måder npm kan besætte `node_modules/.bin/<kommando>` på. Formen er platformbestemt,
 * så kontrollen skal kunne læse dem begge — uanset hvilken platform testen selv kører på.
 */
type BinLinkStyle = 'shim-fil' | 'symlink';

type Fixture = {
  packageJson: Record<string, unknown>;
  packageLock: { lockfileVersion: number; requires: boolean; packages: Record<string, LockEntry> };
  toolManifest: Record<string, unknown> | null;
  toolLock: boolean;
  binShimTarget: string | null;
  binLinkStyle: BinLinkStyle;
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
  binLinkStyle: 'shim-fil',
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
    // Målpakken skal findes på disk, så et symlink peger på en rigtig fil. Indholdet nævner
    // bevidst IKKE pakkestien: følger kontrollen symlinket i stedet for at læse dets mål,
    // finder den intet — præcis som mod Playwrights egen cli.js i CI.
    const targetDirectory = join(fixtureRoot, 'node_modules', ...fixture.binShimTarget.split('/'));
    mkdirSync(targetDirectory, { recursive: true });
    writeFileSync(join(targetDirectory, 'cli.js'), '#!/usr/bin/env node\n// ingen pakkesti i indholdet\n');

    const commandPath = join(binDirectory, 'playwright');
    if (fixture.binLinkStyle === 'symlink') {
      // Præcis som npm på POSIX: et relativt symlink fra .bin ind i pakken.
      symlinkSync(`../${fixture.binShimTarget}/cli.js`, commandPath);
    } else {
      // Samme form som npm's egen sh-shim: kommandoen er kun så god som den sti, den peger på.
      writeFileSync(commandPath, `#!/bin/sh\nexec node  "$basedir/../${fixture.binShimTarget}/cli.js" "$@"\n`);
    }
  }

  return fixtureRoot;
};

/**
 * Windows kræver Developer Mode eller administrator for at lave fil-symlinks. Kan maskinen det
 * ikke, kan symlink-fixturen ikke skrives — og så må testen ikke bare være «grøn af tomhed».
 * Derfor er dette en KAPACITETS-test, ikke en platform-test: CI (ubuntu) kan altid, og der
 * håndhæves fuld dækning nedenfor. Lokalt uden rettigheden falder kun filsystem-varianten bort;
 * selve udledningen af ejeren dækkes stadig af enhedstestene, som ikke rører filsystemet.
 */
const canCreateFileSymlinks = ((): boolean => {
  const probeRoot = mkdtempSync(join(tmpdir(), 'mineo-symlink-probe-'));
  try {
    writeFileSync(join(probeRoot, 'maal.js'), 'x');
    symlinkSync('maal.js', join(probeRoot, 'link.js'));
    return true;
  } catch {
    return false;
  } finally {
    rmSync(probeRoot, { recursive: true, force: true });
  }
})();

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

  // Begge npm-mekanismer måles ens: en påstand om .bin skal holde uanset hvordan slottet er sat.
  // Symlink-varianten springes kun over, hvis maskinen ikke må lave fil-symlinks; testen
  // «symlink-dækningen må ikke forsvinde i CI» nedenfor sikrer, at det aldrig sker der.
  describe.each<BinLinkStyle>(['shim-fil', 'symlink'])('med .bin som %s', (binLinkStyle) => {
    const itUnlessSkipped = binLinkStyle === 'symlink' && !canCreateFileSymlinks ? it.skip : it;

    itUnlessSkipped('måler det installerede træ særskilt fra lockfilen', () => {
      // Lockfilen er ren; kun den faktiske .bin-indgang er forkert. Fanger kontrollen det, måler
      // den installationen — ikke bare manifestet.
      const wrongOwner = { ...makeFixture(), binLinkStyle, binShimTarget: 'playwright' };
      withFixture(wrongOwner, (result) => {
        expect(result.status).toBe(1);
        expect(output(result)).toContain('peger på playwright i stedet for @playwright/test');
      });

      const missingShim = { ...makeFixture(), binLinkStyle, binShimTarget: null };
      withFixture(missingShim, (result) => {
        expect(result.status).toBe(1);
        expect(output(result)).toContain('node_modules/.bin/playwright mangler');
      });
    });

    itUnlessSkipped('accepterer det rette ejerskab uden at forveksle det med en ukendt ejer', () => {
      // Regressionen fra CI: her var slottet korrekt besat, men kontrollen kunne ikke læse
      // symlinket og meldte alligevel rødt.
      withFixture({ ...makeFixture(), binLinkStyle }, (result) => {
        expect(output(result)).not.toContain('ukendt');
        expect(output(result)).toContain('én ejer');
        expect(result.status).toBe(0);
      });
    });
  });

  it.runIf(canCreateFileSymlinks)('skriver symlink-fixturen som et ægte symlink, ikke som en kopieret fil', () => {
    // Uden denne kontrol kunne symlink-varianten stille og roligt degenerere til en filkopi —
    // og så ville testene ovenfor være grønne af tomhed, ikke af dækning.
    const fixtureRoot = writeFixture({ ...makeFixture(), binLinkStyle: 'symlink' });
    try {
      const linkPath = join(fixtureRoot, 'node_modules', '.bin', 'playwright');
      expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
      expect(readlinkSync(linkPath).replace(/\\/g, '/')).toBe('../@playwright/test/cli.js');
      // Og målet indeholder ikke pakkestien, så «følg linket»-fejlen ikke kan passere ved et tilfælde.
      expect(readFileSync(linkPath, 'utf8')).not.toContain('@playwright/test');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('lader ikke symlink-dækningen forsvinde i CI', () => {
    // Fejlen slap netop igennem, fordi CI's platform var udækket. At springe symlink-varianten
    // over er en lokal Windows-indrømmelse — sker det i CI, er dækningen tavst væk igen.
    if (process.env.CI !== undefined) {
      expect(canCreateFileSymlinks).toBe(true);
      return;
    }
    expect(typeof canCreateFileSymlinks).toBe('boolean');
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

/**
 * Udledningen af pakkenavnet er den del, der svigtede i CI, og den kan prøves uden filsystem.
 * Derfor dækker disse tests symlink-formen på ENHVER platform — også der hvor fixturen ovenfor
 * ikke må skrive et rigtigt symlink.
 */
describe('packageNameFromBinTarget', () => {
  it('udleder pakkenavnet af begge de målformer npm skriver', () => {
    // POSIX-symlinkets mål, som det ser ud fra .bin.
    expect(packageNameFromBinTarget('../@playwright/test/cli.js')).toBe('@playwright/test');
    // Uden scope er pakkenavnet ét segment.
    expect(packageNameFromBinTarget('../playwright/cli.js')).toBe('playwright');
    // Windows-shims nævner stien med omvendte skråstreger.
    expect(packageNameFromBinTarget('..\\@playwright\\test\\cli.js')).toBe('@playwright/test');
    // Dybere mål ændrer ikke ejeren.
    expect(packageNameFromBinTarget('../@andet/vaerktoej/bin/cli.js')).toBe('@andet/vaerktoej');
  });

  it('skelner de to Playwright-familier, så en forkert ejer ikke ligner den rigtige', () => {
    expect(packageNameFromBinTarget('../@playwright/cli/index.js')).toBe('@playwright/cli');
    expect(packageNameFromBinTarget('../@playwright/mcp/index.js')).toBe('@playwright/mcp');
  });

  it('svarer null frem for at gætte, når målet ikke rummer et pakkenavn', () => {
    // Et scope uden pakkenavn er ikke en ejer.
    expect(packageNameFromBinTarget('../@playwright')).toBeNull();
    expect(packageNameFromBinTarget('..')).toBeNull();
    expect(packageNameFromBinTarget('')).toBeNull();
  });
});

describe('resolveInstalledCommandOwner', () => {
  it('melder undetermined frem for at udpege en forkert ejer, når slottet ikke kan tydes', () => {
    // Præcis CI-symptomet: kunne ejeren ikke udledes, meldte kontrollen «et ukendt sted» og
    // beskyldte afhængighedsgrafen. Nu skal den skelne «kan ikke tyde» fra «forkert ejer».
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'mineo-utydelig-shim-'));
    try {
      const binDirectory = join(fixtureRoot, 'node_modules', '.bin');
      mkdirSync(binDirectory, { recursive: true });
      writeFileSync(join(binDirectory, 'playwright'), '#!/usr/bin/env node\n// ingen pakkesti\n');

      const resolved = resolveInstalledCommandOwner(fixtureRoot, 'playwright');
      expect(resolved.present).toBe(true);
      expect(resolved.undetermined).toBe(true);
      expect(resolved.owner).toBeNull();
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('læser den rigtige ejer ud af en Windows-shim', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'mineo-shim-ejer-'));
    try {
      const binDirectory = join(fixtureRoot, 'node_modules', '.bin');
      mkdirSync(binDirectory, { recursive: true });
      writeFileSync(
        join(binDirectory, 'playwright'),
        '#!/bin/sh\nexec node  "$basedir/../@playwright/test/cli.js" "$@"\n'
      );

      expect(resolveInstalledCommandOwner(fixtureRoot, 'playwright'))
        .toEqual({ present: true, owner: '@playwright/test', undetermined: false });
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
