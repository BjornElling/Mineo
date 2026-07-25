import { z } from 'zod';
import { PERSISTED_SECTION_KEYS, persistenceSchemas } from '../../config/persistenceRegistry';
import type { SectionKey } from '../fieldAddress';
import { leafToDataFieldPath } from './fieldLedger';

// Maskinel udledning af de persisterede felt- og collection-stier direkte fra de LEVENDE Zod-schemas. Dette
// er ledgerens ene sandhedskilde for coverage (§6): feltledgeren annoterer, den udleder ikke. Samme traversal
// som `consumerInventory.test.ts`, nu delt så ledger, completeness-test og validator ser samme paths.

type JsonObject = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asObjectRecord = (value: unknown): Readonly<Record<string, JsonObject>> => {
  if (!isObject(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, JsonObject] => isObject(entry[1])));
};

const asObjectArray = (value: unknown): readonly JsonObject[] =>
  Array.isArray(value) ? value.filter(isObject) : [];

const resolveJsonPointer = (root: JsonObject, pointer: string): JsonObject | null => {
  if (!pointer.startsWith('#/')) return null;
  let current: unknown = root;
  for (const rawPart of pointer.slice(2).split('/')) {
    if (!isObject(current)) return null;
    const part = rawPart.replaceAll('~1', '/').replaceAll('~0', '~');
    current = current[part];
  }
  return isObject(current) ? current : null;
};

const collectSchemaPaths = (schema: JsonObject): Readonly<{ fields: readonly string[]; collections: readonly string[] }> => {
  const fields = new Set<string>();
  const collections = new Set<string>();
  const activeRefs = new Set<string>();

  const visit = (node: JsonObject, path: string): void => {
    const reference = typeof node.$ref === 'string' ? node.$ref : null;
    if (reference !== null) {
      if (activeRefs.has(reference)) throw new Error(`Cirkulær JSON-schema-reference: ${reference}`);
      const target = resolveJsonPointer(schema, reference);
      if (target === null) throw new Error(`Ukendt JSON-schema-reference: ${reference}`);
      activeRefs.add(reference);
      visit(target, path);
      activeRefs.delete(reference);
      return;
    }
    const alternatives = [...asObjectArray(node.anyOf), ...asObjectArray(node.oneOf), ...asObjectArray(node.allOf)];
    if (alternatives.length > 0) {
      for (const alternative of alternatives) visit(alternative, path);
      return;
    }
    const type = typeof node.type === 'string' ? node.type : null;
    if (type === 'null') return;
    const properties = asObjectRecord(node.properties);
    if (type === 'object' || Object.keys(properties).length > 0) {
      for (const [name, child] of Object.entries(properties)) {
        visit(child, path === '' ? name : `${path}.${name}`);
      }
      if (isObject(node.additionalProperties)) visit(node.additionalProperties, path === '' ? '*' : `${path}.*`);
      return;
    }
    if (type === 'array' || isObject(node.items)) {
      if (path === '') throw new Error('En persisted sektionsrod må ikke være en array');
      collections.add(path);
      if (isObject(node.items)) visit(node.items, `${path}[]`);
      return;
    }
    if (path !== '') fields.add(path);
  };

  visit(schema, '');
  return {
    fields: [...fields].sort((left, right) => left.localeCompare(right, 'da')),
    collections: [...collections].sort((left, right) => left.localeCompare(right, 'da')),
  };
};

const sectionJsonSchema = (section: SectionKey): JsonObject =>
  z.toJSONSchema(persistenceSchemas[section], { reused: 'inline', unrepresentable: 'any' }) as JsonObject;

/** Rå Zod-leaves + collection-stier pr. sektion (én AmountValue = 3 leaves; entity-id er et leaf). */
export const collectSectionSchemaPaths = (section: SectionKey) => collectSchemaPaths(sectionJsonSchema(section));

/** Canonicalt datafelt-sæt pr. sektion: amount-triples samlet, entity-id-leaves droppet. */
export const deriveSectionDataFieldPaths = (section: SectionKey): readonly string[] => {
  const { fields } = collectSectionSchemaPaths(section);
  const dataFields = new Set<string>();
  for (const leaf of fields) {
    const path = leafToDataFieldPath(leaf);
    if (path !== null) dataFields.add(path);
  }
  return [...dataFields].sort((a, b) => a.localeCompare(b, 'da'));
};

export const deriveAllSectionDataFieldPaths = (): Readonly<Record<SectionKey, readonly string[]>> =>
  Object.fromEntries(PERSISTED_SECTION_KEYS.map((section) => [section, deriveSectionDataFieldPaths(section as SectionKey)])) as Record<SectionKey, readonly string[]>;

export const deriveSectionCollectionPaths = (section: SectionKey): readonly string[] =>
  [...collectSectionSchemaPaths(section).collections].sort((a, b) => a.localeCompare(b, 'da'));

export const countAllDataFields = (): number =>
  PERSISTED_SECTION_KEYS.reduce((total, section) => total + deriveSectionDataFieldPaths(section as SectionKey).length, 0);

export const countAllCollections = (): number =>
  PERSISTED_SECTION_KEYS.reduce((total, section) => total + deriveSectionCollectionPaths(section as SectionKey).length, 0);
