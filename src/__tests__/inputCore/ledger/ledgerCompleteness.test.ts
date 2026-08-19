import { PERSISTED_SECTION_KEYS } from '../../../config/persistenceRegistry';
import {
  productionInputFields,
  productionInputCollections,
} from '../../../inputCore/catalog/productionCatalog';
import {
  CONSUMER_CALCULATION_ENTRYPOINTS,
  CONSUMER_CASE_FILE_PATHS,
  CONSUMER_DOCUMENT_OUTPUTS,
} from '../../../config/consumerInventory';
import type { SectionKey } from '../../../inputCore/fieldAddress';
import {
  deriveSectionDataFieldPaths,
  deriveSectionCollectionPaths,
  collectSectionSchemaPaths,
  countAllDataFields,
  countAllCollections,
} from '../../../inputCore/ledger/schemaFieldPaths';
import {
  AMOUNT_LEAF_SUFFIX,
  ENTITY_ID_LEAF,
  TOP_LEVEL_FIELD_CODECS,
  EXPECTED_FIELD_REF_COUNT,
  leafToDataFieldPath,
} from '../../../inputCore/ledger/fieldLedger';
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

// Reconciliationen sker mod det LEVENDE inputCore-produktionskatalog – det katalog produktionen faktisk kører
// på. (Tidligere blev der reconcileret mod de gamle `src/input`-manifester; de er slettet med legacy-klyngen,
// og en ledger, der kun stemte med en død kilde, ville ikke bevise noget om produktionen.)
type TemplatePath = readonly Readonly<
  { kind: 'property'; name: string } | { kind: 'entity'; collection: string; entityId?: string }
>[];

const templateParentPath = (path: TemplatePath): string =>
  path.map((segment) => (segment.kind === 'property' ? segment.name : `${segment.collection}[]`)).join('.');

const joinTemplatePath = (path: TemplatePath, leaf: string): string => {
  const parent = templateParentPath(path);
  return parent === '' ? leaf : `${parent}.${leaf}`;
};

const productionFieldTemplates = productionInputFields.map((descriptor) => descriptor.template);

const productionFieldControls = productionInputFields.map((descriptor) => ({
  template: descriptor.template,
  control: descriptor.controlKind,
}));

const productionCollectionTemplates = productionInputCollections.map((descriptor) => descriptor.template);

const fieldTemplatePath = (template: (typeof productionFieldTemplates)[number]): string =>
  joinTemplatePath(template.path as TemplatePath, template.field);

const collectionTemplatePath = (template: (typeof productionCollectionTemplates)[number]): string =>
  joinTemplatePath(template.path as TemplatePath, template.collection);

describe('de persisterede schemas er gennemsigtige for den maskinelle udledning', () => {
  /**
   * Hele ledger-coveragen, consumerinventaret OG schema-fingerprintet udledes gennem `z.toJSONSchema`.
   * Den udledning kan BLINDES: sætter man en `.transform()`/`.pipe()` på et objekt- eller array-schema,
   * udsender Zod et uigennemsigtigt output-schema – i praksis `items: {}` for et array – og hvert felt
   * bag den grænse forsvinder lydløst ud af samtlige værn.
   *
   * Optællings-testene nedenfor kan IKKE fange det alene: de sammenligner to tal, og en blinding, der
   * fulgtes af en tilsvarende nedjustering af baseline, ville stå grøn. Dette værn måler derfor
   * gennemsigtigheden DIREKTE: hver collection, ledgeren kender, skal have synlige properties i det
   * udledte JSON-schema.
   */
  it('udsender ingen tom collection-node – en transform må ikke skjule et nested felttræ', () => {
    const opaque: string[] = [];
    for (const section of sections) {
      const { collections } = collectSectionSchemaPaths(section);
      for (const collectionPath of collections) {
        const childPaths = deriveSectionDataFieldPaths(section)
          .filter((path) => path.startsWith(`${collectionPath}[].`));
        if (childPaths.length === 0) opaque.push(`${section}.${collectionPath}`);
      }
    }
    expect(opaque).toEqual([]);
  });

  it('kender mindst én collection pr. sektion, der har en – ellers måler værnet ingenting', () => {
    // Selv-test mod grøn-af-tomhed: findes der slet ingen collections at måle, beviser testen ovenfor intet.
    expect(countAllCollections()).toBeGreaterThan(0);
  });
});

describe('feltledgerens coverage-register (§6.1)', () => {
  it('top-level codec-annotationer matcher nøjagtig de top-level datafelter i de levende schemas', () => {
    for (const section of sections) {
      const derivedTopLevel = sortSet(deriveSectionDataFieldPaths(section).filter((path) => !path.includes('[]')));
      const annotated = sortSet(Object.keys(TOP_LEVEL_FIELD_CODECS[section]));
      expect({ section, fields: annotated }).toEqual({ section, fields: derivedTopLevel });
    }
  });

  // Titlen udleder tallet af konstanten: en hardkodet prosa-optælling ville kunne stå tilbage som forældet,
  // når baseline flyttes, og en læser ville da tro, at værnet målte et andet tal end det gør.
  it(`låser baseline feltantal (${EXPECTED_FIELD_REF_COUNT}) mod de levende schemas uden placeholder`, () => {
    expect(countAllDataFields()).toBe(EXPECTED_FIELD_REF_COUNT);
  });

  it('matcher nøjagtig de eksisterende typed produktionsbindings', () => {
    for (const section of sections) {
      const schemaPaths = sortSet(deriveSectionDataFieldPaths(section));
      const bindingPaths = sortSet(
        productionFieldTemplates
          .filter((template) => template.section === section)
          .map(fieldTemplatePath)
      );
      expect({ section, bindingPaths }).toEqual({ section, bindingPaths: schemaPaths });
    }
  });

  it('kontroltype-annotationer matcher de levende typed produktionsbindings', () => {
    const annotated = new Map<string, string>();
    for (const section of sections) {
      for (const [path, annotation] of Object.entries(TOP_LEVEL_FIELD_CODECS[section])) {
        annotated.set(`${section}:${path}`, annotation.control);
      }
    }
    for (const entry of INPUT_COLLECTION_LEDGER) {
      for (const child of entry.childFields) {
        annotated.set(`${entry.section}:${fullCollectionPath(entry)}[].${child.name}`, child.control);
      }
    }
    const actual = new Map(productionFieldControls.map(({ template, control }) => [
      `${template.section}:${fieldTemplatePath(template)}`,
      control,
    ]));
    expect(Object.fromEntries([...annotated].sort())).toEqual(Object.fromEntries([...actual].sort()));
  });

  it('udelader kun entity-id-leaves, som en registreret collection faktisk ejer', () => {
    const excluded = sortSet(sections.flatMap((section) =>
      collectSectionSchemaPaths(section).fields
        .filter((path) => ENTITY_ID_LEAF.test(path))
        .map((path) => `${section}:${path}`)
    ));
    const registered = sortSet(INPUT_COLLECTION_LEDGER.map((entry) =>
      `${entry.section}:${fullCollectionPath(entry)}[].${entry.entityIdProperty}`
    ));
    expect(excluded).toEqual(registered);
  });

  it('samler kun komplette AmountValue-triples til ét datafelt', () => {
    for (const section of sections) {
      const leaves = collectSectionSchemaPaths(section).fields;
      const amountBases = sortSet(
        leaves.filter((leaf) => AMOUNT_LEAF_SUFFIX.test(leaf)).map((leaf) => leafToDataFieldPath(leaf) ?? '')
      );
      for (const base of amountBases) {
        expect(leaves.filter((leaf) => leaf.startsWith(`${base}.`)).sort()).toEqual([
          `${base}.expression`,
          `${base}.kind`,
          `${base}.value`,
        ]);
      }
    }
  });
});

describe('collectionledgerens coverage-register (§6.2)', () => {
  it('dækker nøjagtig de collections, de levende schemas producerer', () => {
    for (const section of sections) {
      const derived = sortSet(deriveSectionCollectionPaths(section));
      const ledger = sortSet(
        INPUT_COLLECTION_LEDGER.filter((entry) => entry.section === section).map(fullCollectionPath)
      );
      expect({ section, collections: ledger }).toEqual({ section, collections: derived });
    }
  });

  it(`låser baseline collection-antal (${EXPECTED_COLLECTION_COUNT}) og entydige id’er`, () => {
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

  it('matcher nøjagtig de eksisterende typed collectionbindings', () => {
    for (const section of sections) {
      const schemaPaths = sortSet(deriveSectionCollectionPaths(section));
      const bindingPaths = sortSet(
        productionCollectionTemplates
          .filter((template) => template.section === section)
          .map(collectionTemplatePath)
      );
      expect({ section, bindingPaths }).toEqual({ section, bindingPaths: schemaPaths });
    }
  });
});

describe('consumerledgerens coverage-register (§6.3)', () => {
  it('afspejler nøjagtig det maskinlåste fase-0-inventar (8 beregninger / 4 sagsfiler / 18 dokumenter)', () => {
    const byType = (type: string) => INPUT_CONSUMER_LEDGER.filter((entry) => entry.type === type);
    expect(byType('beregning')).toHaveLength(EXPECTED_BEREGNING_COUNT);
    expect(byType('casefile')).toHaveLength(EXPECTED_CASEFILE_COUNT);
    expect(byType('document')).toHaveLength(EXPECTED_DOCUMENT_COUNT);
    expect(INPUT_CONSUMER_LEDGER).toHaveLength(EXPECTED_CONSUMER_COUNT);

    expect(byType('beregning').map((e) => e.id).sort()).toEqual(
      CONSUMER_CALCULATION_ENTRYPOINTS.map((e) => `beregning:${e.id}`).sort()
    );
    expect(byType('casefile').map((e) => e.id).sort()).toEqual(
      CONSUMER_CASE_FILE_PATHS.map((e) => `casefile:${e.id}`).sort()
    );
    expect(byType('document').map((e) => e.id).sort()).toEqual(
      CONSUMER_DOCUMENT_OUTPUTS.map((e) => `document:${e.id}`).sort()
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
