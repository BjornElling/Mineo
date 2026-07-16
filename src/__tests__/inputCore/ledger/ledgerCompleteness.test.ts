import { PERSISTED_SECTION_KEYS } from '../../../config/persistenceRegistry';
import {
  GREENFIELD_PHASE_0_CALCULATION_ENTRYPOINTS,
  GREENFIELD_PHASE_0_CASE_FILE_PATHS,
  GREENFIELD_PHASE_0_DOCUMENT_OUTPUTS,
} from '../../../config/greenfieldPhase0Inventory';
import type { SectionKey } from '../../../inputCore/fieldAddress';
import {
  deriveSectionDataFieldPaths,
  deriveSectionCollectionPaths,
  countAllDataFields,
  countAllCollections,
} from '../../../inputCore/ledger/schemaFieldPaths';
import { TOP_LEVEL_FIELD_CODECS, EXPECTED_FIELD_REF_COUNT } from '../../../inputCore/ledger/fieldLedger';
import { INPUT_COLLECTION_LEDGER, EXPECTED_COLLECTION_COUNT } from '../../../inputCore/ledger/collectionLedger';
import {
  INPUT_CONSUMER_LEDGER,
  EXPECTED_CONSUMER_COUNT,
  EXPECTED_BEREGNING_COUNT,
  EXPECTED_CASEFILE_COUNT,
  EXPECTED_DOCUMENT_COUNT,
} from '../../../inputCore/ledger/consumerLedger';

const sections = PERSISTED_SECTION_KEYS as SectionKey[];
const sortSet = (values: Iterable<string>): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'da'));

const fullCollectionPath = (entry: (typeof INPUT_COLLECTION_LEDGER)[number]): string =>
  entry.path === '' ? entry.collection : `${entry.path}.${entry.collection}`;

describe('greenfield feltledger (§6.1)', () => {
  it('top-level codec-annotationer matcher nøjagtig de top-level datafelter i de levende schemas', () => {
    for (const section of sections) {
      const derivedTopLevel = sortSet(deriveSectionDataFieldPaths(section).filter((path) => !path.includes('[]')));
      const annotated = sortSet(Object.keys(TOP_LEVEL_FIELD_CODECS[section]));
      expect({ section, fields: annotated }).toEqual({ section, fields: derivedTopLevel });
    }
  });

  it('låser baseline feltantal (243) mod de levende schemas uden placeholder', () => {
    expect(countAllDataFields()).toBe(EXPECTED_FIELD_REF_COUNT);
  });
});

describe('greenfield collectionledger (§6.2)', () => {
  it('dækker nøjagtig de collections, de levende schemas producerer', () => {
    for (const section of sections) {
      const derived = sortSet(deriveSectionCollectionPaths(section));
      const ledger = sortSet(
        INPUT_COLLECTION_LEDGER.filter((entry) => entry.section === section).map(fullCollectionPath)
      );
      expect({ section, collections: ledger }).toEqual({ section, collections: derived });
    }
  });

  it('låser baseline collection-antal (17) og entydige id’er', () => {
    expect(countAllCollections()).toBe(EXPECTED_COLLECTION_COUNT);
    expect(INPUT_COLLECTION_LEDGER).toHaveLength(EXPECTED_COLLECTION_COUNT);
    expect(new Set(INPUT_COLLECTION_LEDGER.map((entry) => entry.id)).size).toBe(EXPECTED_COLLECTION_COUNT);
  });

  it('collectionernes childfields udgør nøjagtig de collection-interne datafelter i schemas', () => {
    const ledgerChildPaths = sortSet(
      INPUT_COLLECTION_LEDGER.flatMap((entry) =>
        entry.childFields.map((child) => `${fullCollectionPath(entry)}[].${child.name}`))
    );
    const derivedChildPaths = sortSet(
      sections.flatMap((section) => deriveSectionDataFieldPaths(section).filter((path) => path.includes('[]')))
    );
    expect(ledgerChildPaths).toEqual(derivedChildPaths);
  });

  it('nested collection-referencer peger på registrerede id’er', () => {
    const ids = new Set(INPUT_COLLECTION_LEDGER.map((entry) => entry.id));
    for (const entry of INPUT_COLLECTION_LEDGER) {
      for (const nestedId of entry.nestedCollectionIds) expect(ids.has(nestedId)).toBe(true);
    }
  });
});

describe('greenfield consumerledger (§6.3)', () => {
  it('afspejler nøjagtig det maskinlåste fase-0-inventar (8 beregninger / 4 sagsfiler / 18 dokumenter)', () => {
    const byType = (type: string) => INPUT_CONSUMER_LEDGER.filter((entry) => entry.type === type);
    expect(byType('beregning')).toHaveLength(EXPECTED_BEREGNING_COUNT);
    expect(byType('casefile')).toHaveLength(EXPECTED_CASEFILE_COUNT);
    expect(byType('document')).toHaveLength(EXPECTED_DOCUMENT_COUNT);
    expect(INPUT_CONSUMER_LEDGER).toHaveLength(EXPECTED_CONSUMER_COUNT);

    expect(byType('beregning').map((e) => e.id).sort()).toEqual(
      GREENFIELD_PHASE_0_CALCULATION_ENTRYPOINTS.map((e) => `beregning:${e.id}`).sort()
    );
    expect(byType('casefile').map((e) => e.id).sort()).toEqual(
      GREENFIELD_PHASE_0_CASE_FILE_PATHS.map((e) => `casefile:${e.id}`).sort()
    );
    expect(byType('document').map((e) => e.id).sort()).toEqual(
      GREENFIELD_PHASE_0_DOCUMENT_OUTPUTS.map((e) => `document:${e.id}`).sort()
    );
  });

  it('har entydige consumer-id’er og gyldig dokument→kilde-linkage', () => {
    expect(new Set(INPUT_CONSUMER_LEDGER.map((e) => e.id)).size).toBe(EXPECTED_CONSUMER_COUNT);
    for (const entry of INPUT_CONSUMER_LEDGER.filter((e) => e.type === 'document')) {
      expect(entry.projectsFrom).toBeDefined();
      expect(entry.projectsFrom).not.toBe('ukendt');
    }
  });
});
