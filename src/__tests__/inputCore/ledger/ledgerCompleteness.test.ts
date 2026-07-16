import { PERSISTED_SECTION_KEYS } from '../../../config/persistenceRegistry';
import { productionInputManifests } from '../../../input/catalog/productionInputCatalog';
import {
  collectionRefTemplateSchema,
  fieldAddressTemplateSchema,
  type FieldAddressTemplate,
  type CollectionRefTemplate,
} from '../../../input/fieldCatalog';
import {
  GREENFIELD_PHASE_0_CALCULATION_ENTRYPOINTS,
  GREENFIELD_PHASE_0_CASE_FILE_PATHS,
  GREENFIELD_PHASE_0_DOCUMENT_OUTPUTS,
} from '../../../config/greenfieldPhase0Inventory';
import type { SectionKey } from '../../../inputCore/fieldAddress';
import type { FieldControlKind } from '../../../input/fieldDefinition';
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

const templateParentPath = (
  path: FieldAddressTemplate['path'] | CollectionRefTemplate['path']
): string => path.map((segment) => segment.kind === 'property'
  ? segment.name
  : `${segment.collection}[]`).join('.');

const fieldTemplatePath = (template: FieldAddressTemplate): string => {
  const parent = templateParentPath(template.path);
  return parent === '' ? template.field : `${parent}.${template.field}`;
};

const collectionTemplatePath = (template: CollectionRefTemplate): string => {
  const parent = templateParentPath(template.path);
  return parent === '' ? template.collection : `${parent}.${template.collection}`;
};

const productionFieldTemplates = productionInputManifests.flatMap((manifest) =>
  manifest.fields.map((field) => fieldAddressTemplateSchema.parse(
    typeof field === 'object' && field !== null && 'template' in field ? field.template : undefined
  ))
);

const readProductionFieldControl = (field: unknown): Readonly<{
  template: FieldAddressTemplate;
  control: FieldControlKind;
}> => {
  if (typeof field !== 'object' || field === null || !('template' in field) || !('definition' in field)) {
    throw new Error('Produktionsmanifestet indeholder en ugyldig feltbinding');
  }
  const definition = field.definition;
  if (typeof definition !== 'object' || definition === null || !('controlKind' in definition)) {
    throw new Error('Produktionsfeltet mangler kontroltype');
  }
  const control = definition.controlKind;
  if (control !== 'text' && control !== 'choice' && control !== 'toggle') {
    throw new Error('Produktionsfeltet har en ukendt kontroltype');
  }
  return { template: fieldAddressTemplateSchema.parse(field.template), control };
};

const productionFieldControls = productionInputManifests.flatMap((manifest) =>
  manifest.fields.map(readProductionFieldControl)
);

const productionCollectionTemplates = productionInputManifests.flatMap((manifest) =>
  manifest.collections.map((collection) => collectionRefTemplateSchema.parse(
    typeof collection === 'object' && collection !== null && 'template' in collection
      ? collection.template
      : undefined
  ))
);

describe('greenfield feltledger (§6.1)', () => {
  it('top-level codec-annotationer matcher nøjagtig de top-level datafelter i de levende schemas', () => {
    for (const section of sections) {
      const derivedTopLevel = sortSet(deriveSectionDataFieldPaths(section).filter((path) => !path.includes('[]')));
      const annotated = sortSet(Object.keys(TOP_LEVEL_FIELD_CODECS[section]));
      expect({ section, fields: annotated }).toEqual({ section, fields: derivedTopLevel });
    }
  });

  it('låser baseline feltantal (239) mod de levende schemas uden placeholder', () => {
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

  it('låser baseline collection-antal (16) og entydige id’er', () => {
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
