import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
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

const parseSourceFile = (fileName: string, source: string): ts.SourceFile =>
  ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

const readSourceFile = (fileName: `src/${string}`): ts.SourceFile => {
  const absolutePath = resolve(process.cwd(), fileName);
  return parseSourceFile(fileName, readFileSync(absolutePath, 'utf8'));
};

const isExported = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node)
  && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true;

const hasExportedSymbol = (sourceFile: ts.SourceFile, symbol: string): boolean =>
  sourceFile.statements.some((statement) => {
    if (!isExported(statement)) return false;

    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.some(
        (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === symbol
      );
    }

    return (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))
      && statement.name !== undefined
      && statement.name.text === symbol
    );
  });

const hasDirectCallsite = (sourceFile: ts.SourceFile, symbol: string): boolean => {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === symbol) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
};

const assertExportedSymbol = (entry: InventoryEntry): void => {
  expect(hasExportedSymbol(readSourceFile(entry.module), entry.symbol)).toBe(true);
};

const assertConsumedSymbol = (entry: ConsumedInventoryEntry): void => {
  assertExportedSymbol(entry);
  for (const consumer of entry.consumers) {
    expect(hasDirectCallsite(readSourceFile(consumer), entry.symbol)).toBe(true);
  }
};

describe('konsument- og schema-registre', () => {
  /**
   * Schema-drift-detektor.
   *
   * Snapshottet hed før `greenfield-phase-0-persisted-input-inventory.json` og lå i
   * `docs/architecture/`, hvor det lignede et engangsartefakt – hvilket
   * bad derfor om at FJERNE det, "når slutkatalogerne selv giver udtømmende coverage".
   *
   * Præmissen er vendt om: filen er ikke et frosset inventar. Den GENERERES ved hver kørsel af
   * `collectSectionSchemaPaths` over de levende Zod-schemas, så den er en detektor, ikke en liste.
   * Tilføjer eller fjerner nogen et persisteret felt uden at ville det, ændrer snapshottet sig, og
   * testen fejler. At slette den ville altså fjerne LEVENDE dækning i legacy-oprydningens navn.
   *
   * Den er derfor flyttet til `__snapshots__/` og omdøbt efter sin FUNKTION frem for sin oprindelse.
   * Indholdet er byte-identisk med den flyttede fil – flytningen skjuler ingen drift.
   */
  it('fastholder alle persisted felt- og collection-stier maskinelt fra Zod-schemas', async () => {
    const inventory = Object.fromEntries(PERSISTED_SECTION_KEYS.map((section) => [
      section,
      collectSectionSchemaPaths(section),
    ]));

    await expect(`${JSON.stringify(inventory, null, 2)}\n`).toMatchFileSnapshot(
      './__snapshots__/persistedInputSchemaPaths.json'
    );
  });

  it('peger beregnings- og sagsfilinventaret på eksisterende exports og callsites', () => {
    for (const entry of [
      ...CONSUMER_CALCULATION_ENTRYPOINTS,
      ...CONSUMER_CASE_FILE_PATHS,
    ]) assertConsumedSymbol(entry);
  });

  it('kræver syntaktiske exports og callsites frem for symbolnavne i tekst', () => {
    const source = parseSourceFile(
      'fixture.ts',
      `
        // export const projectSatser = ...;
        const omtale = 'projectSatser(reader)';
      `
    );

    expect(hasExportedSymbol(source, 'projectSatser')).toBe(false);
    expect(hasDirectCallsite(source, 'projectSatser')).toBe(false);
  });

  /**
   * Completeness for dokumentoutputs.
   *
   * Målestokken var før "alle `download*Dokument`-exports i `documentService.ts`" – en regex over ÉT
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
