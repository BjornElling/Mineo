import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  GREENFIELD_PHASE_0_CALCULATION_ENTRYPOINTS,
  GREENFIELD_PHASE_0_CASE_FILE_PATHS,
  GREENFIELD_PHASE_0_DOCUMENT_OUTPUTS,
  type GreenfieldConsumedInventoryEntry,
  type GreenfieldInventoryEntry,
} from '../../config/greenfieldPhase0Inventory';
import { PERSISTED_SECTION_KEYS, persistenceSchemas } from '../../config/persistenceRegistry';

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

const collectSchemaPaths = (schema: JsonObject): Readonly<{
  fields: readonly string[];
  collections: readonly string[];
}> => {
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

    const alternatives = [
      ...asObjectArray(node.anyOf),
      ...asObjectArray(node.oneOf),
      ...asObjectArray(node.allOf),
    ];
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
      if (isObject(node.additionalProperties)) {
        visit(node.additionalProperties, path === '' ? '*' : `${path}.*`);
      }
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

const readInventoryModule = (entry: GreenfieldInventoryEntry): string =>
  readFileSync(resolve(process.cwd(), entry.module), 'utf8');

const assertExportedSymbol = (entry: GreenfieldInventoryEntry): void => {
  const source = readInventoryModule(entry);
  const escaped = entry.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  expect(source).toMatch(new RegExp(`export\\s+(?:const|function|class)\\s+${escaped}\\b`));
};

const assertConsumedSymbol = (entry: GreenfieldConsumedInventoryEntry): void => {
  assertExportedSymbol(entry);
  const escaped = entry.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const consumer of entry.consumers) {
    expect(readFileSync(resolve(process.cwd(), consumer), 'utf8')).toMatch(new RegExp(`\\b${escaped}\\b`));
  }
};

describe('greenfield fase-0-inventar', () => {
  it('fastholder alle persisted felt- og collection-stier maskinelt fra Zod-schemas', async () => {
    const inventory = Object.fromEntries(PERSISTED_SECTION_KEYS.map((section) => [
      section,
      collectSchemaPaths(z.toJSONSchema(persistenceSchemas[section], {
        reused: 'inline',
        unrepresentable: 'any',
      }) as JsonObject),
    ]));

    await expect(`${JSON.stringify(inventory, null, 2)}\n`).toMatchFileSnapshot(
      '../../../docs/architecture/greenfield-phase-0-persisted-input-inventory.json'
    );
  });

  it('peger beregnings- og sagsfilinventaret på eksisterende exports og callsites', () => {
    for (const entry of [
      ...GREENFIELD_PHASE_0_CALCULATION_ENTRYPOINTS,
      ...GREENFIELD_PHASE_0_CASE_FILE_PATHS,
    ]) assertConsumedSymbol(entry);
  });

  it('dækker samtlige dokumentservice-entrypoints udtømmende', () => {
    for (const entry of GREENFIELD_PHASE_0_DOCUMENT_OUTPUTS) assertExportedSymbol(entry);
    const source = readInventoryModule(GREENFIELD_PHASE_0_DOCUMENT_OUTPUTS[0]);
    const actual = [...source.matchAll(/export const (download[A-ZÆØÅ][A-Za-zÆØÅæøå]*Dokument)\s*=/g)]
      .map((match) => match[1])
      .sort();
    const inventoried = GREENFIELD_PHASE_0_DOCUMENT_OUTPUTS.map((entry) => entry.symbol).sort();
    expect(inventoried).toEqual(actual);
  });
});
