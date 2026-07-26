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
import { MINEO_DOCUMENT_OUTPUT_IDS } from '../../document/definition/documentOutputId';
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

  /**
   * Completeness for dokumentoutputs (Fase 5).
   *
   * Målestokken var før "alle `download*Dokument`-exports i `documentService.ts`" — en regex over ÉT
   * modul. Det modul findes ikke længere: hvert output ejes af en definition ved sin egen
   * domænegrænse, spredt over otte moduler. Den kanoniske kilde er derfor
   * `MINEO_DOCUMENT_OUTPUT_IDS`, som er uafhængig af hvor definitionerne bor, og som også
   * runtime-katalogerne måles imod.
   */
  it('dækker præcis hovedappens 18 dokumentoutputs, og hver post peger på sin definition', () => {
    for (const entry of CONSUMER_DOCUMENT_OUTPUTS) assertExportedSymbol(entry);

    const inventoried = CONSUMER_DOCUMENT_OUTPUTS.map((entry) => entry.id).sort();
    expect(inventoried).toEqual([...MINEO_DOCUMENT_OUTPUT_IDS].sort());

    // Ét id = ét output: ingen duplikerede id'er, og ingen duplikeret definition-symbol.
    expect(new Set(inventoried).size).toBe(inventoried.length);
    const symbols = CONSUMER_DOCUMENT_OUTPUTS.map((entry) => `${entry.module}#${entry.symbol}`);
    expect(new Set(symbols).size).toBe(symbols.length);
  });
});
