import { PERSISTED_SECTION_KEYS } from '../../../config/persistenceRegistry';
import {
  buildProductionInputCatalog,
  productionInputCollections,
  productionInputFields,
} from '../../../inputCore/catalog/productionCatalog';
import type { SectionKey } from '../../../inputCore/fieldAddress';
import type { FieldAddressTemplate } from '../../../inputCore/fieldDescriptor';
import type { CollectionTemplate } from '../../../inputCore/fieldCatalog';
import {
  deriveSectionCollectionPaths,
  deriveSectionDataFieldPaths,
} from '../../../inputCore/ledger/schemaFieldPaths';
import { EXPECTED_FIELD_REF_COUNT } from '../../../inputCore/ledger/fieldLedger';
import { EXPECTED_COLLECTION_COUNT } from '../../../inputCore/ledger/collectionLedger';
import { createEmptySettledInput, persistedInputSectionsSchema } from '../../../inputCore/settledInput';
import { deepEqual } from '../../../utils/deepEqual';

// Det ene produkt-descriptor-katalog dækker NØJAGTIG de persisterede datafelter og
// collections, som de levende Zod-schemas producerer (samme autoritet som ledger-baselinen 239/16). Testen
// reconcilerer descriptor-templates mod schemas — ikke mod de (snart slettede) legacy-bindings.

const sections = PERSISTED_SECTION_KEYS as SectionKey[];
const sortSet = (values: Iterable<string>): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'da'));

// De to collectioner er ejer-/strukturdata, ikke tabeller med en trailing indtastningsrække. Alle øvrige
// collectioner renderes gennem `useCollectionTable` og skal derfor erklære den fælles tomrække-livscyklus.
const STRUCTURAL_NON_TABLE_COLLECTION_IDS = new Set([
  'eo.loenindkomstAnsaettelsesforhold',
  'eo.sfggAnsaettelsesforhold',
]);

const templateParentPath = (path: FieldAddressTemplate['path'] | CollectionTemplate['path']): string =>
  path.map((segment) => segment.kind === 'property' ? segment.name : `${segment.collection}[]`).join('.');

const fieldTemplatePath = (template: FieldAddressTemplate): string => {
  const parent = templateParentPath(template.path);
  return parent === '' ? template.field : `${parent}.${template.field}`;
};

const collectionTemplatePath = (template: CollectionTemplate): string => {
  const parent = templateParentPath(template.path);
  return parent === '' ? template.collection : `${parent}.${template.collection}`;
};

describe('produkt-descriptor-kataloget (§3.2)', () => {
  it('bygger og valideres uden fejl (statisk katalog, valideret én gang)', () => {
    expect(() => buildProductionInputCatalog()).not.toThrow();
  });

  it('dækker nøjagtig de persisterede datafelter i de levende schemas', () => {
    for (const section of sections) {
      const schemaPaths = sortSet(deriveSectionDataFieldPaths(section));
      const descriptorPaths = sortSet(
        productionInputFields
          .filter((field) => field.template.section === section)
          .map((field) => fieldTemplatePath(field.template))
      );
      expect({ section, descriptorPaths }).toEqual({ section, descriptorPaths: schemaPaths });
    }
  });

  it('dækker nøjagtig de collections, de levende schemas producerer', () => {
    for (const section of sections) {
      const schemaPaths = sortSet(deriveSectionCollectionPaths(section));
      const descriptorPaths = sortSet(
        productionInputCollections
          .filter((collection) => collection.template.section === section)
          .map((collection) => collectionTemplatePath(collection.template))
      );
      expect({ section, descriptorPaths }).toEqual({ section, descriptorPaths: schemaPaths });
    }
  });

  it('låser baseline-antal mod ledger (239 felter / 16 collections) uden dubletter', () => {
    expect(productionInputFields).toHaveLength(EXPECTED_FIELD_REF_COUNT);
    expect(productionInputCollections).toHaveLength(EXPECTED_COLLECTION_COUNT);
  });

  it('har entydige felt-id’er og collection-id’er', () => {
    const fieldIds = productionInputFields.map((field) => field.id);
    const collectionIds = productionInputCollections.map((collection) => collection.id);
    expect(new Set(fieldIds).size).toBe(fieldIds.length);
    expect(new Set(collectionIds).size).toBe(collectionIds.length);
  });

  it('lader alle trailing-tabeller erklære deres semantiske tomhed centralt', () => {
    const missing = productionInputCollections
      .filter((collection) => !STRUCTURAL_NON_TABLE_COLLECTION_IDS.has(collection.id))
      .filter((collection) => collection.isEntityEmpty === undefined)
      .map((collection) => collection.id);

    expect(missing).toEqual([]);
  });

  it('hvert felts codec resolver semantisk tom tekst til feltets tomværdi (XOR-forudsætning)', () => {
    // defineField håndhæver dette ved konstruktion; her bekræftes det eksplicit for hele produktkataloget.
    for (const field of productionInputFields) {
      const resolution = field.codec.parseForSettle('');
      expect(resolution.status).toBe('valid');
    }
  });

  it('statiske descriptors har samme tomværdi som schemaets canonical round-trip', () => {
    const mismatches: string[] = [];
    for (const descriptor of productionInputFields.filter(
      (field) => field.template.path.every((segment) => segment.kind !== 'entity')
    )) {
      const field = descriptor.bind();
      const written = descriptor.writeCanonical(
        structuredClone(createEmptySettledInput().sections),
        field.address,
        descriptor.emptyValue
      );
      const parsed = persistedInputSectionsSchema.parse(written);
      const roundTripped = descriptor.readCanonical(parsed, field.address);
      if (!deepEqual(roundTripped, descriptor.emptyValue)) {
        mismatches.push(
          `${descriptor.id}: descriptor=${JSON.stringify(descriptor.emptyValue)}, schema=${JSON.stringify(roundTripped)}`
        );
      }
    }

    expect(mismatches).toEqual([]);
  });
});
