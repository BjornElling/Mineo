import fs from 'node:fs';
import path from 'node:path';

/**
 * Arkitektur-værn for grænsen mellem den AUTORITATIVE EO-række-evaluerings-motor og inspektions-/kontrollaget.
 *
 * Baggrund (arkitektur-kandidat B9, afsluttet 2026-06-25): Motoren der producerer EO-status-/fejl-
 * rækker (`collectAllEoRows` → `executeAllEoRowBuilders` → `buildEo…Rows`) er
 * trust-kritisk: dens `error`-rækker driver produktions-PDF-download-gaten i
 * `useEoBeregningViewModel`. Tidligere lå den i `src/domain/eoInspektion/` og blev fejlagtigt omtalt som
 * "DEV-only". Den er nu flyttet til en autoritativ placering, `src/domain/eoRowEvaluation/`, så den
 * trust-kritiske gate ikke længere afhænger af et lag der nominelt er inspektion/kontrol.
 *
 * Rollefordeling efter relokeringen:
 *   - `src/domain/eoRowEvaluation/` — AUTORITATIV motor (`eoRow…`-filer, `collectAllEoRows` mv.).
 *     Inspektionsfri. Driver download-gaten OG fødes ind i DEV-visningen.
 *   - `src/domain/eoInspektion/` — rent inspektions-/kontrollag (DEV-synligt) (tabeller, CSV, sammentælling, view-model, snapshot). Den
 *     er NEDSTRØMS: den må importere motoren, aldrig omvendt.
 *
 * Dette værn pinner de invarianter, der holder rollefordelingen forsvarlig:
 *   A. Domæne→inspektion/kontrol-koblingen er INDESLUTTET til de to navngivne snapshot-bro-filer. Ingen
 *      anden domæne-fil må importere `src/domain/eoInspektion/`.
 *   ENGINE. Den autoritative motor (`src/domain/eoRowEvaluation/`) er inspektionsfri — gatens kilde kan
 *      ikke forurenes af DEV-visnings-formattering.
 *   B. De AUTORITATIVE totaler (`eoCanonicalOutput.ts`) er inspektionsfrie.
 *   C. Gaten (`useEoBeregningViewModel`) konsumerer den AUTORITATIVE motor — IKKE inspektions-/kontrollaget.
 *      Det er kernen i B9: download-gating hænger på autoritativ validering, ikke på et DEV-lag.
 */

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const DOMAIN_ROOT = path.resolve(SRC_ROOT, 'domain');
const INSPEKTION_ROOT = path.resolve(DOMAIN_ROOT, 'eoInspektion');
const ENGINE_ROOT = path.resolve(DOMAIN_ROOT, 'eoRowEvaluation');

const CANONICAL_OUTPUT_PATH = path.resolve(DOMAIN_ROOT, 'erstatningsopgoerelse/snapshot/eoCanonicalOutput.ts');
const CONTROL_MISMATCH_PATH = path.resolve(DOMAIN_ROOT, 'erstatningsopgoerelse/control/eoControlMismatch.ts');
const EO_SNAPSHOT_PATH = path.resolve(DOMAIN_ROOT, 'erstatningsopgoerelse/snapshot/eoSnapshot.ts');
const BEREGNING_VM_PATH = path.resolve(
  SRC_ROOT,
  'components/pages/erstatningsopgoerelse/eoBeregning/useEoBeregningViewModel.ts'
);

/**
 * De ENESTE domæne-filer der må importere inspektions-/kontrollaget: snapshot-assembly-broerne.
 * `eoSnapshot.ts` indlejrer inspektions-snapshotten; `eoSnapshotToInspektionView.ts` bygger DEV-sidens view.
 */
const SANCTIONED_BRIDGE_FILES: ReadonlyArray<string> = [
  path.resolve(DOMAIN_ROOT, 'erstatningsopgoerelse/snapshot/eoSnapshot.ts'),
  path.resolve(DOMAIN_ROOT, 'erstatningsopgoerelse/snapshot/eoSnapshotToInspektionView.ts'),
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
 * Tekstuelt sti-segment for inspektions-/kontrollaget i et import-specifier. Import-stier skrives altid med
 * forward-slash uanset OS, så vi matcher mod den form (ikke `path.sep`).
 */
const INSPEKTION_SPECIFIER_SEGMENT = 'domain/eoInspektion';

/**
 * Returnerer de import-specifiers i `source`, der peger ind i `src/domain/eoInspektion/`. Tom liste = ingen
 * inspektions-import.
 *
 * To former dækkes, så værnet ikke bliver blindt hvis projektet senere indfører en path-alias:
 *  - **relative** specifiers opløses mod `fromDir` og tjekkes mod `INSPEKTION_ROOT`.
 *  - **ikke-relative** specifiers (alias som `@/domain/eoInspektion/…`, absolut `src/domain/eoInspektion/…`, eller
 *    et bart modul) flagges hvis de indeholder `domain/eoInspektion`-segmentet.
 *
 * Bemærk: `src/domain/eoRowEvaluation/` (den autoritative motor) matcher IKKE — den er en lovlig
 * import for både gate, snapshot og DEV-visning.
 */
const findInspektionImports = (source: string, fromDir: string): string[] => {
  const hits: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1];
    if (specifier.startsWith('.')) {
      const resolved = path.resolve(fromDir, specifier);
      const rel = path.relative(INSPEKTION_ROOT, resolved);
      const pointsIntoInspektion = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
      if (pointsIntoInspektion) hits.push(specifier);
      continue;
    }
    if (specifier.includes(INSPEKTION_SPECIFIER_SEGMENT)) hits.push(specifier);
  }
  return hits;
};

describe('inspektionLayerIsolation', () => {
  it('A: kun de to sanktionerede bro-filer i domænet importerer src/domain/eoInspektion', () => {
    const violations: string[] = [];

    for (const absolutePath of collectSourceFiles(DOMAIN_ROOT)) {
      if (absolutePath.startsWith(INSPEKTION_ROOT + path.sep)) continue; // inspektionslaget må importere sig selv
      if (SANCTIONED_BRIDGE_FILES.includes(absolutePath)) continue; // de tilladte broer
      const source = fs.readFileSync(absolutePath, 'utf8');
      for (const specifier of findInspektionImports(source, path.dirname(absolutePath))) {
        violations.push(`${path.relative(process.cwd(), absolutePath)}: ${specifier}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('A (anti-rot): hver sanktioneret bro-fil findes og importerer faktisk inspektionslaget', () => {
    // En forældet allowlist-post (fil der ikke længere kobler til inspektionslaget) skal fjernes, ikke
    // efterlades som stiltiende undtagelse.
    for (const bridge of SANCTIONED_BRIDGE_FILES) {
      expect(fs.existsSync(bridge), `bro-fil mangler: ${bridge}`).toBe(true);
      const source = fs.readFileSync(bridge, 'utf8');
      expect(
        findInspektionImports(source, path.dirname(bridge)).length,
        `bro-fil importerer ikke længere inspektionslaget (fjern fra allowlist): ${bridge}`
      ).toBeGreaterThan(0);
    }
  });

  it('ENGINE: den autoritative række-evaluerings-motor (src/domain/eoRowEvaluation) er inspektionsfri', () => {
    // Motoren driver den trust-kritiske download-gate. Importerede den inspektions-/kontrollaget, ville
    // gatens kilde kunne forurenes af display-formattering — netop koblingen B9 brød.
    const violations: string[] = [];
    for (const absolutePath of collectSourceFiles(ENGINE_ROOT)) {
      const source = fs.readFileSync(absolutePath, 'utf8');
      for (const specifier of findInspektionImports(source, path.dirname(absolutePath))) {
        violations.push(`${path.relative(process.cwd(), absolutePath)}: ${specifier}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('B: de autoritative totaler (eoCanonicalOutput) er inspektionsfrie', () => {
    const source = fs.readFileSync(CANONICAL_OUTPUT_PATH, 'utf8');
    expect(findInspektionImports(source, path.dirname(CANONICAL_OUTPUT_PATH))).toEqual([]);
  });

  it('CONTROL: kontrol-/audit-kernen (eoControlMismatch) er produktions-ejet og inspektionsfri', () => {
    // Den trust-kritiske sammenlignings-semantik bag snapshot-invarianten `control:sammentaelling_mismatch`
    // ejes af produktionslaget, IKKE af domain/eoInspektion. Hvis denne fil begyndte at importere inspektionslaget,
    // ville gate-logikken igen være bundet til et nominelt DEV-lag.
    expect(fs.existsSync(CONTROL_MISMATCH_PATH), `kontrol-fil mangler: ${CONTROL_MISMATCH_PATH}`).toBe(true);
    const source = fs.readFileSync(CONTROL_MISMATCH_PATH, 'utf8');
    expect(findInspektionImports(source, path.dirname(CONTROL_MISMATCH_PATH))).toEqual([]);
  });

  it('CONTROL: snapshot-invarianten henter kontrol-mismatch fra produktion — ikke fra inspektionslaget', () => {
    const source = fs.readFileSync(EO_SNAPSHOT_PATH, 'utf8');
    // Gate-logikken importeres fra den produktions-ejede kontrol-kerne …
    expect(source).toContain(
      "import { collectSammentaellingControlMismatchMessages } from '../control/eoControlMismatch'"
    );
    // … og må ikke (gen)importeres fra sammentællings-filen i inspektionslaget.
    expect(source).not.toContain("collectSammentaellingControlMismatchMessages } from '../../eoInspektion");
  });

  it('selvtest: scanneren fanger faktisk et forbudt inspektions-import (ikke vacuous-pass)', () => {
    const fromDir = path.resolve(DOMAIN_ROOT, 'erstatningsopgoerelse/engines');
    const offendingSource = "import { buildEOInspektionSnapshot } from '../../eoInspektion/eoInspektionSnapshot';";
    const cleanSource = "import { collectAllEoRows } from '../../eoRowEvaluation/eoRowAggregator';";

    expect(findInspektionImports(offendingSource, fromDir)).toEqual(['../../eoInspektion/eoInspektionSnapshot']);
    // Import af den autoritative motor er lovlig og må IKKE flagges.
    expect(findInspektionImports(cleanSource, fromDir)).toEqual([]);
  });

  it('selvtest: scanneren fanger også ikke-relative inspektions-imports (alias/absolut) — ikke kun relative', () => {
    const fromDir = path.resolve(DOMAIN_ROOT, 'erstatningsopgoerelse/engines');
    // Disse former findes ikke i projektet i dag (ingen path-aliaser), men værnet skal fange dem
    // hvis en alias senere indføres — ellers ville koblingen kunne snige sig ind usynligt.
    expect(findInspektionImports("import { x } from '@/domain/eoInspektion/eoInspektionSnapshot';", fromDir)).toEqual([
      '@/domain/eoInspektion/eoInspektionSnapshot',
    ]);
    expect(findInspektionImports("import { x } from 'src/domain/eoInspektion/eoInspektionSnapshot';", fromDir)).toEqual([
      'src/domain/eoInspektion/eoInspektionSnapshot',
    ]);
    // Ikke-relativt modul uden for inspektionslaget rører ikke værnet.
    expect(findInspektionImports("import { z } from '@mui/material';", fromDir)).toEqual([]);
  });

  it('C: download-gaten konsumerer den AUTORITATIVE motor — ikke inspektions-/kontrollaget', () => {
    const source = fs.readFileSync(BEREGNING_VM_PATH, 'utf8');

    // Produktions-gaten henter sine fejl-rækker fra den autoritative motor i eoRowEvaluation …
    expect(source).toContain(
      "import { collectAllEoRows } from '../../../../domain/eoRowEvaluation/eoRowAggregator'"
    );

    // … og må IKKE længere afhænge af inspektions-/kontrollaget. Dette er kernen i B9: hvis denne kobling
    // genopstår, er den trust-kritiske gate igen bundet til et nominelt DEV-lag.
    expect(findInspektionImports(source, path.dirname(BEREGNING_VM_PATH))).toEqual([]);

    // …og motorens fejl-rækker driver fortsat download-gaten via det fælles, autoritative
    // output-gate (arkitektur-kandidat A5): række-blokeringen fødes ind som `hasBlockingRows`.
    expect(source).toContain('hasBlockingEoRowErrors');
    expect(source).toContain('evaluateEoDocumentDownloadGate');
    expect(source).toContain('hasBlockingRows: hasBlockingEoRowErrors');
  });
});
