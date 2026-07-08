import fs from 'node:fs';
import path from 'node:path';

/**
 * Arkitektur-værn (regulering-redesign R9): det FAIL-OPEN display-opslag `getSatserForYear`
 * (`src/data/lovbestemteRates.ts`) må kun importeres af display-/dokument-lag — aldrig af en
 * beregningssti.
 *
 * Baggrund: `getSatserForYear` returnerer `null`/`''` ved manglende år (fail-open), så satssiden og
 * satsdokumentet kan vise "-" frem for at fejle. En reguleringsberegning skal derimod fail-close på
 * manglende sats (kaste/blokere), ikke stille regne videre med `null` → tavs under-regulering.
 * Reviewet bekræftede (S7), at funktionen i dag KUN bruges i display/dokument; men adskillelsen var
 * ikke strukturelt håndhævet. Dette værn gør den strukturel: importeres symbolet fra en fil uden for
 * allowlisten, fejler testen, og en utilsigtet beregnings-kobling fanges ved konstruktion.
 *
 * Beregningslaget bruger i stedet de fail-closed per-sats-opslag (fx `resolveAslAarsloensmaksimumForAar`).
 */

const SRC_ROOT = path.resolve(process.cwd(), 'src');

/** Det fail-open display-symbol værnet beskytter. */
const GUARDED_SYMBOL = 'getSatserForYear';

/**
 * De ENESTE moduler der må importere `getSatserForYear`: satssidens visning + satsdokument-
 * generatoren (PDF/Word) + dokument-servicen der udleder dokumentets satsmodel-type fra den.
 * Alle rene display/dokument-stier — ingen beregning.
 */
const SANCTIONED_IMPORTERS: ReadonlyArray<string> = [
  path.resolve(SRC_ROOT, 'components/pages/Satser.tsx'),
  path.resolve(SRC_ROOT, 'document/generators/satser/satserDocument.ts'),
  path.resolve(SRC_ROOT, 'document/service/documentService.ts'),
];

const collectSourceFiles = (root: string): string[] => {
  const files: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'test') continue;
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

const IMPORT_STATEMENT = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;

/**
 * Sandt hvis `source` importerer `getSatserForYear` som en værdi (ikke blot nævner navnet i en
 * kommentar eller streng). Matcher en named import hvor specifieren peger på lovbestemteRates.
 */
const importsGuardedSymbol = (source: string): boolean => {
  for (const match of source.matchAll(IMPORT_STATEMENT)) {
    const named = match[1];
    const specifier = match[2];
    if (!specifier.includes('lovbestemteRates')) continue;
    const names = named.split(',').map((n) => n.trim().split(/\s+as\s+/)[0].trim());
    if (names.includes(GUARDED_SYMBOL)) return true;
  }
  return false;
};

describe('failOpenDisplayLookupIsolation', () => {
  it('kun display-/dokument-moduler importerer det fail-open getSatserForYear', () => {
    const sanctioned = new Set(SANCTIONED_IMPORTERS);
    const violations: string[] = [];

    for (const absolutePath of collectSourceFiles(SRC_ROOT)) {
      if (sanctioned.has(absolutePath)) continue;
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (importsGuardedSymbol(source)) {
        violations.push(path.relative(process.cwd(), absolutePath));
      }
    }

    expect(violations).toEqual([]);
  });

  it('anti-rot: hver allowlist-fil findes og importerer faktisk getSatserForYear', () => {
    // En forældet allowlist-post (fil der ikke længere importerer symbolet) skal fjernes, ikke
    // efterlades som stiltiende undtagelse.
    for (const importer of SANCTIONED_IMPORTERS) {
      expect(fs.existsSync(importer), `allowlist-fil mangler: ${importer}`).toBe(true);
      const source = fs.readFileSync(importer, 'utf8');
      expect(
        importsGuardedSymbol(source),
        `allowlist-fil importerer ikke længere getSatserForYear (fjern fra allowlist): ${importer}`
      ).toBe(true);
    }
  });

  it('selvtest: scanneren fanger faktisk et forbudt import (ikke vacuous-pass)', () => {
    const offending = "import { getSatserForYear } from '../../data/lovbestemteRates';";
    const offendingAlias = "import { getSatserForYear as x } from '../data/lovbestemteRates';";
    const cleanOtherSymbol = "import { resolveAslAarsloensmaksimumForAar } from '../satser/aslAarsloensmaksimum';";
    const cleanOtherModule = "import { getSatserForYear } from './someOtherModule';";

    expect(importsGuardedSymbol(offending)).toBe(true);
    expect(importsGuardedSymbol(offendingAlias)).toBe(true);
    expect(importsGuardedSymbol(cleanOtherSymbol)).toBe(false);
    // Symbolnavnet fra et ANDET modul rører ikke værnet (kun lovbestemteRates-kilden er fail-open).
    expect(importsGuardedSymbol(cleanOtherModule)).toBe(false);
  });
});
