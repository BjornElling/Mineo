import fs from 'node:fs';
import path from 'node:path';

/**
 * Wiring-assertioner for grænsen mellem den AUTORITATIVE EO-række-evaluerings-motor og
 * inspektions-/kontrollaget (arkitektur-kandidat B9).
 *
 * De GENERELLE import-forbud — "ingen domæne-fil uden for de to sanktionerede broer må
 * importere `src/domain/eoInspektion`" (dækker også `eoRowEvaluation`, `eoCanonicalOutput`
 * og `eoControlMismatch`) — er migreret til det AST-baserede arkitektur-harness som reglen
 * `layer/inspektion-import-boundary` (se `architecture/architectureRules.ts`), inkl. anti-rot
 * på bro-filerne.
 *
 * Tilbage her: de POSITIVE, fil-specifikke wiring-checks, som en generel lag-scan ikke udtrykker —
 * (1) at snapshot-invarianten henter kontrol-mismatch fra den produktions-ejede kontrol-kerne, og
 * (2) at download-gaten i view-modellen (components-laget, uden for domæne-scopet) konsumerer den
 * autoritative motor og er inspektionsfri.
 */

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const DOMAIN_ROOT = path.resolve(SRC_ROOT, 'domain');
const INSPEKTION_ROOT = path.resolve(DOMAIN_ROOT, 'eoInspektion');
const EO_SNAPSHOT_PATH = path.resolve(DOMAIN_ROOT, 'erstatningsopgoerelse/snapshot/eoSnapshot.ts');
const BEREGNING_VM_PATH = path.resolve(
  SRC_ROOT,
  'components/pages/erstatningsopgoerelse/eoBeregning/useEoBeregningViewModel.ts'
);
/** Fase 5: dokument-gatens nye ejer — definitionen ved EO's domænegrænse. */
const EO_DOCUMENT_DEFINITIONS_PATH = path.resolve(
  DOMAIN_ROOT,
  'erstatningsopgoerelse/eoDocumentDefinitions.ts'
);

const IMPORT_SPECIFIER = /(?:from|import)\s+['"]([^'"]+)['"]/g;
const INSPEKTION_SPECIFIER_SEGMENT = 'domain/eoInspektion';

/** Import-specifiers i `source`, der peger ind i `src/domain/eoInspektion/` (relative opløses mod `fromDir`). */
const findInspektionImports = (source: string, fromDir: string): string[] => {
  const hits: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1];
    if (specifier.startsWith('.')) {
      const resolved = path.resolve(fromDir, specifier);
      const rel = path.relative(INSPEKTION_ROOT, resolved);
      if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) hits.push(specifier);
      continue;
    }
    if (specifier.includes(INSPEKTION_SPECIFIER_SEGMENT)) hits.push(specifier);
  }
  return hits;
};

describe('inspektionLayerIsolation — wiring', () => {
  it('snapshot-invarianten henter kontrol-mismatch fra produktion — ikke fra inspektionslaget', () => {
    const source = fs.readFileSync(EO_SNAPSHOT_PATH, 'utf8');
    expect(source).toContain(
      "import { collectSammentaellingControlMismatchMessages } from '../control/eoControlMismatch'"
    );
    expect(source).not.toContain("collectSammentaellingControlMismatchMessages } from '../../eoInspektion");
  });

  /**
   * Efter Fase 5 ejer DEFINITIONEN download-gaten, ikke view-modellen: preflighten (projektion,
   * gate, midlertidigt-EET-kilden) er flyttet fra `useEoBeregningViewModel` til
   * `eoDocumentDefinitions.ts`. Guarden er derfor flyttet med til det nye ejerskab — den måler
   * fortsat præcis det samme: at gaten konsumerer den autoritative motor og er inspektionsfri.
   */
  it('C: download-gaten konsumerer den AUTORITATIVE motor — ikke inspektions-/kontrollaget', () => {
    const source = fs.readFileSync(EO_DOCUMENT_DEFINITIONS_PATH, 'utf8');

    expect(findInspektionImports(source, path.dirname(EO_DOCUMENT_DEFINITIONS_PATH))).toEqual([]);
    expect(source).toContain('evaluateErstatningsopgoerelseDownloadGates');
    expect(source).toContain('buildMidlertidigtEetInsertSource(context.evaluation)');
  });

  /**
   * View-modellen må efter Fase 5 hverken bygge EO-projektionen eller evaluere gaten selv — så var
   * den to sandheder igen. Den konsumerer stadig den autoritative rækkemotor til issue-listerne,
   * og den skal fortsat være inspektionsfri.
   */
  it('C2: view-modellen har afgivet gate-ejerskabet, men bruger fortsat den autoritative rækkemotor', () => {
    const source = fs.readFileSync(BEREGNING_VM_PATH, 'utf8');

    expect(source).toContain(
      "import { collectAllEoRows } from '../../../../domain/eoRowEvaluation/eoRowAggregator'"
    );
    expect(findInspektionImports(source, path.dirname(BEREGNING_VM_PATH))).toEqual([]);
    expect(source).toContain('hasBlockingEoRowErrors');
    expect(source).not.toContain('evaluateErstatningsopgoerelseDownloadGates');
    expect(source).not.toContain('buildErstatningsopgoerelseReaderProjection');
  });
});
