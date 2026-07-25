import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CONSUMER_CALCULATION_ENTRYPOINTS,
  CONSUMER_CASE_FILE_PATHS,
  CONSUMER_DOCUMENT_OUTPUTS,
  type ConsumedInventoryEntry,
  type InventoryEntry,
} from '../../config/consumerInventory';
import { PERSISTED_SECTION_KEYS } from '../../config/persistenceRegistry';
import { collectSectionSchemaPaths } from '../../inputCore/ledger/schemaFieldPaths';

const readInventoryModule = (entry: InventoryEntry): string =>
  readFileSync(resolve(process.cwd(), entry.module), 'utf8');

const assertExportedSymbol = (entry: InventoryEntry): void => {
  const source = readInventoryModule(entry);
  const escaped = entry.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  expect(source).toMatch(new RegExp(`export\\s+(?:const|function|class)\\s+${escaped}\\b`));
};

const assertConsumedSymbol = (entry: ConsumedInventoryEntry): void => {
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
      collectSectionSchemaPaths(section),
    ]));

    await expect(`${JSON.stringify(inventory, null, 2)}\n`).toMatchFileSnapshot(
      '../../../docs/architecture/greenfield-phase-0-persisted-input-inventory.json'
    );
  });

  it('peger beregnings- og sagsfilinventaret på eksisterende exports og callsites', () => {
    for (const entry of [
      ...CONSUMER_CALCULATION_ENTRYPOINTS,
      ...CONSUMER_CASE_FILE_PATHS,
    ]) assertConsumedSymbol(entry);
  });

  it('dækker samtlige dokumentservice-entrypoints udtømmende', () => {
    for (const entry of CONSUMER_DOCUMENT_OUTPUTS) assertExportedSymbol(entry);
    const source = readInventoryModule(CONSUMER_DOCUMENT_OUTPUTS[0]);
    const actual = [...source.matchAll(/export const (download[A-ZÆØÅ][A-Za-zÆØÅæøå]*Dokument)\s*=/g)]
      .map((match) => match[1])
      .sort();
    const inventoried = CONSUMER_DOCUMENT_OUTPUTS.map((entry) => entry.symbol).sort();
    expect(inventoried).toEqual(actual);
  });
});
