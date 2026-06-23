import fs from 'node:fs';
import path from 'node:path';

/**
 * Arkitektur-værn for EO-debug-laget (`src/domain/debug/`).
 *
 * Baggrund (jf. arkitektur-genopbygning-kandidater.md B9): EO-debug-laget blev længe omtalt som
 * en "DEV-only projektion". Det er kun halvt sandt. Laget har to roller:
 *
 *   1. DEV-inspektion  — EODebug-siden viser snapshot'et som tabeller til divergens-eftersyn.
 *   2. PRODUKTIONS-VALIDERING — `collectAllDebugRows` (→ `executeAllEODebugBuilders`, dvs. de samme
 *      `buildEODebug…Rows`-buildere) producerer `error`-rækker, der i `useEoBeregningViewModel`
 *      bliver til `hasBlockingDebugErrors` og **blokerer produktions-PDF-download**.
 *
 * Laget er altså trust-kritisk, ikke "bare debug". Og debug er IKKE strengt nedstrøms: den
 * kanoniske `eoSnapshot` *indlejrer* bevidst debug-output (`debugSnapshot`-feltet + control-mismatch-
 * beskeder), og `eoSnapshotToDebugView` bygger DEV-sidens view. Dette værn pinner de tre invarianter,
 * der gør rollefordelingen forsvarlig:
 *
 *   A. Domæne→debug-koblingen er INDESLUTTET til de to navngivne bro-filer i snapshot-laget
 *      (`eoSnapshot.ts`, `eoSnapshotToDebugView.ts`). Ingen engine, validator, helper eller andet
 *      domæne-modul må importere `src/domain/debug/`. Koblingen må ikke sprede sig.
 *   B. De AUTORITATIVE totaler (`eoCanonicalOutput.ts`) er debug-frie. Debug er en projektion af
 *      beregningens output — aldrig en kilde til det autoritative tal (jf. B8/4.14: ikke en parallel
 *      beregning der fødes tilbage).
 *   C. Builderne ER produktions-load-bearing: PDF-gaten i `useEoBeregningViewModel` afhænger af
 *      `collectAllDebugRows`. Værnet dokumenterer dette, så laget ikke fejlagtigt nedlægges som
 *      dødt DEV-only-kode.
 */

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const DOMAIN_ROOT = path.resolve(SRC_ROOT, 'domain');
const DEBUG_ROOT = path.resolve(DOMAIN_ROOT, 'debug');

const CANONICAL_OUTPUT_PATH = path.resolve(DOMAIN_ROOT, 'erstatningsopgoerelse/snapshot/eoCanonicalOutput.ts');
const BEREGNING_VM_PATH = path.resolve(
  SRC_ROOT,
  'components/pages/erstatningsopgoerelse/eoBeregning/useEoBeregningViewModel.ts'
);

/**
 * De ENESTE domæne-filer der må importere debug-laget: snapshot-assembly-broerne.
 * `eoSnapshot.ts` indlejrer debug-snapshotten; `eoSnapshotToDebugView.ts` bygger DEV-sidens view.
 */
const SANCTIONED_BRIDGE_FILES: ReadonlyArray<string> = [
  path.resolve(DOMAIN_ROOT, 'erstatningsopgoerelse/snapshot/eoSnapshot.ts'),
  path.resolve(DOMAIN_ROOT, 'erstatningsopgoerelse/snapshot/eoSnapshotToDebugView.ts'),
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

const IMPORT_SPECIFIER = /(?:from|import)\s+['"]([^'"]+)['"]/g;

/**
 * Returnerer de import-specifiers i `source`, der (relativt opløst fra `fromDir`) peger ind i
 * `src/domain/debug/`. Tom liste = ingen debug-import.
 */
const findDebugImports = (source: string, fromDir: string): string[] => {
  const hits: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue; // kun relative imports kan ramme domain/debug
    const resolved = path.resolve(fromDir, specifier);
    const rel = path.relative(DEBUG_ROOT, resolved);
    const pointsIntoDebug = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
    if (pointsIntoDebug) hits.push(specifier);
  }
  return hits;
};

describe('debugLayerIsolation', () => {
  it('A: kun de to sanktionerede bro-filer i domænet importerer src/domain/debug', () => {
    const violations: string[] = [];

    for (const absolutePath of collectSourceFiles(DOMAIN_ROOT)) {
      if (absolutePath.startsWith(DEBUG_ROOT + path.sep)) continue; // debug må importere sig selv
      if (SANCTIONED_BRIDGE_FILES.includes(absolutePath)) continue; // de tilladte broer
      const source = fs.readFileSync(absolutePath, 'utf8');
      for (const specifier of findDebugImports(source, path.dirname(absolutePath))) {
        violations.push(`${path.relative(process.cwd(), absolutePath)}: ${specifier}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('A (anti-rot): hver sanktioneret bro-fil findes og importerer faktisk debug', () => {
    // En forældet allowlist-post (fil der ikke længere kobler til debug) skal fjernes, ikke
    // efterlades som stiltiende undtagelse.
    for (const bridge of SANCTIONED_BRIDGE_FILES) {
      expect(fs.existsSync(bridge), `bro-fil mangler: ${bridge}`).toBe(true);
      const source = fs.readFileSync(bridge, 'utf8');
      expect(
        findDebugImports(source, path.dirname(bridge)).length,
        `bro-fil importerer ikke længere debug (fjern fra allowlist): ${bridge}`
      ).toBeGreaterThan(0);
    }
  });

  it('B: de autoritative totaler (eoCanonicalOutput) er debug-frie', () => {
    const source = fs.readFileSync(CANONICAL_OUTPUT_PATH, 'utf8');
    expect(findDebugImports(source, path.dirname(CANONICAL_OUTPUT_PATH))).toEqual([]);
  });

  it('selvtest: scanneren fanger faktisk et forbudt debug-import (ikke vacuous-pass)', () => {
    const fromDir = path.resolve(DOMAIN_ROOT, 'erstatningsopgoerelse/engines');
    const offendingSource = "import { collectAllDebugRows } from '../../debug/eoDebugRowAggregator';";
    const cleanSource = "import { sumMaanedsbroekForInterval } from './periodiseringsMotor';";

    expect(findDebugImports(offendingSource, fromDir)).toEqual(['../../debug/eoDebugRowAggregator']);
    expect(findDebugImports(cleanSource, fromDir)).toEqual([]);
  });

  it('C: EO-debug-builderne er produktions-load-bearing — de gater PDF-download (ikke kun DEV)', () => {
    const source = fs.readFileSync(BEREGNING_VM_PATH, 'utf8');

    // Produktions-stien forbruger de samme buildere som EODebug-siden, via aggregatoren.
    expect(source).toContain("import { collectAllDebugRows } from '../../../../domain/debug/eoDebugRowAggregator'");

    // …og deres fejl-rækker driver download-gaten. Hvis denne kobling fjernes, skal det være
    // et bevidst valg — ikke et utilsigtet resultat af at behandle laget som "bare debug".
    expect(source).toContain('hasBlockingDebugErrors');
    expect(source).toContain("eoPdfProjection?.kind === 'ok' && !hasBlockingDebugErrors");
  });
});
