/**
 * Maskinlæsbart migrationsinventar fra greenfield-planens fase 0.
 *
 * Inventaret er ikke en runtime-router og må ikke blive en parallel autoritet for beregning eller dokumenter.
 * Det fastlåser kun den eksisterende, låste feature-flade, indtil de enkelte entrypoints erstattes af de typed
 * kataloger i fase 4–6. Coverage-testen verificerer symbolerne og holder dokumentoutputlisten udtømmende.
 */
export type InventoryEntry = Readonly<{
  id: string;
  module: `src/${string}`;
  symbol: string;
}>;

export type ConsumedInventoryEntry = InventoryEntry & Readonly<{
  consumers: readonly `src/${string}`[];
}>;

export const CONSUMER_CALCULATION_ENTRYPOINTS = [
  {
    id: 'satser',
    module: 'src/domain/satser/satserProjection.ts',
    symbol: 'projectSatser',
    consumers: ['src/components/pages/Satser.tsx'],
  },
  {
    id: 'aarsloen',
    module: 'src/domain/aarsloen/aarsloenProjection.ts',
    symbol: 'buildAarsloenReaderProjection',
    consumers: ['src/components/pages/Aarsloen.tsx'],
  },
  {
    id: 'renteberegning',
    module: 'src/domain/renteberegning/renteberegningReaderProjection.ts',
    symbol: 'buildRenteberegningReaderProjection',
    consumers: ['src/components/pages/renteberegning/RenteberegningTab.tsx'],
  },
  {
    id: 'varigemen',
    module: 'src/domain/varigemen/varigeMenReaderProjection.ts',
    symbol: 'buildVarigeMenReaderProjection',
    consumers: ['src/components/pages/varigemen/MenberegningTab.tsx'],
  },
  {
    id: 'forsoergertab',
    module: 'src/domain/forsoergertab/forsoergertabReaderProjection.ts',
    symbol: 'buildForsoergertabReaderProjection',
    consumers: ['src/components/pages/Forsoergertab.tsx'],
  },
  {
    id: 'erstatningsopgoerelse',
    module: 'src/domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection.ts',
    symbol: 'buildErstatningsopgoerelseReaderProjection',
    consumers: ['src/components/pages/Erstatningsopgoerelse.tsx'],
  },
  {
    id: 'erhvervsevnetab',
    module: 'src/domain/erhvervsevnetab/eetSnapshot.ts',
    symbol: 'computeEetSnapshot',
    consumers: ['src/domain/erhvervsevnetab/erhvervsevnetabReaderProjection.ts'],
  },
  {
    // Standalone-appen genbruger bevidst samme beregningsflade som hovedappen.
    id: 'minprocesrente',
    module: 'src/domain/renteberegning/renteberegningReaderProjection.ts',
    symbol: 'buildRenteberegningReaderProjection',
    consumers: ['src/components/pages/renteberegning/RenteberegningTab.tsx'],
  },
] as const satisfies readonly ConsumedInventoryEntry[];

export const CONSUMER_CASE_FILE_PATHS = [
  {
    id: 'save',
    module: 'src/utils/fileSave.ts',
    symbol: 'saveToFile',
    consumers: ['src/hooks/useFileSaveLoad.ts'],
  },
  {
    id: 'manual-load',
    module: 'src/utils/fileLoad.ts',
    symbol: 'loadFromFile',
    consumers: ['src/hooks/useFileSaveLoad.ts'],
  },
  {
    id: 'pwa-load',
    module: 'src/utils/fileLoad.ts',
    symbol: 'loadFromFileHandle',
    consumers: ['src/hooks/useFileSaveLoad.ts'],
  },
  // Load-apply er efter R4-F01 delt i to funktioner, men er fortsat ÉN sagsfil-vej. Inventaret peger på
  // den AUTORITATIVE halvdel — den, der erstatter sagen inde i replacement-barrieren. Den asynkrone
  // `synchronizeLoadMetadata` er ikke en sagsfil-vej men en efterfølgende metadata-synkronisering, og at
  // give den en femte post ville sige, at der findes fem veje til sagsfilen. Dens eneste consumer er
  // dækket af `useFileSaveLoad`s egne tests og af typegrænsen (den er ikke valgfri på load-stien).
  {
    id: 'load-apply',
    module: 'src/utils/persistenceLoadApply.ts',
    symbol: 'applyAuthoritativeLoadSnapshot',
    consumers: ['src/hooks/useFileSaveLoad.ts'],
  },
] as const satisfies readonly ConsumedInventoryEntry[];

/**
 * De 18 dokumentoutputs i hovedappen, med deres ejende DEFINITION (Fase 5).
 *
 * Før Fase 5 pegede hver post på en `download*Dokument`-funktion i `documentService.ts`. Det modul
 * findes ikke længere: dokument-livscyklussen er ét objekt pr. output, og definitionen bor ved sin
 * domænegrænse (`document-output-contract.md` §A1.2/§A7.1). Symbolet her er derfor definitionen —
 * det ene sted, hvor outputtets dependencies, gate og generatorkald er samlet.
 *
 * Standalone MinProcesrentes tre outputs står bevidst IKKE her: dette inventar dækker hovedappen.
 * Det fælles ID-inventar for BEGGE apps er `src/document/definition/documentOutputId.ts`, og
 * completeness-testen måler kataloget mod begge.
 */
export const CONSUMER_DOCUMENT_OUTPUTS = [
  { id: 'satser', module: 'src/domain/satser/satserDocumentDefinition.ts', symbol: 'satserDocumentDefinition' },
  { id: 'rente', module: 'src/domain/renteberegning/renteberegningDocumentDefinitions.ts', symbol: 'renteDocumentDefinition' },
  { id: 'rente-oversigt', module: 'src/domain/renteberegning/renteberegningDocumentDefinitions.ts', symbol: 'renteOversigtDocumentDefinition' },
  { id: 'regulering', module: 'src/domain/erstatningsopgoerelse/reguleringDocumentDefinitions.ts', symbol: 'reguleringDocumentDefinition' },
  { id: 'krl', module: 'src/domain/erstatningsopgoerelse/reguleringDocumentDefinitions.ts', symbol: 'krlDocumentDefinition' },
  { id: 'kl-loenaftaler', module: 'src/domain/erstatningsopgoerelse/reguleringDocumentDefinitions.ts', symbol: 'klLoenaftalerDocumentDefinition' },
  { id: 'erstatningsopgoerelse', module: 'src/domain/erstatningsopgoerelse/eoDocumentDefinitions.ts', symbol: 'erstatningsopgoerelseDocumentDefinition' },
  { id: 'taf-fordelt-paa-aar', module: 'src/domain/erstatningsopgoerelse/eoDocumentDefinitions.ts', symbol: 'tafFordeltPaaAarDocumentDefinition' },
  { id: 'taf-opreguleret-paa-aar', module: 'src/domain/erstatningsopgoerelse/eoDocumentDefinitions.ts', symbol: 'tafOpreguleretPaaAarDocumentDefinition' },
  { id: 'taf-krav-graf', module: 'src/domain/erstatningsopgoerelse/eoDocumentDefinitions.ts', symbol: 'tafKravGrafDocumentDefinition' },
  { id: 'varigemen', module: 'src/domain/varigemen/varigeMenDocumentDefinition.ts', symbol: 'varigeMenDocumentDefinition' },
  { id: 'aarsloen', module: 'src/domain/aarsloen/aarsloenDocumentDefinitions.ts', symbol: 'aarsloenDocumentDefinition' },
  { id: 'sh-dage', module: 'src/domain/aarsloen/aarsloenDocumentDefinitions.ts', symbol: 'shDageDocumentDefinition' },
  { id: 'kapitalisering', module: 'src/domain/erhvervsevnetab/eetDocumentDefinitions.ts', symbol: 'kapitaliseringDocumentDefinition' },
  { id: 'efter-eal', module: 'src/domain/erhvervsevnetab/eetDocumentDefinitions.ts', symbol: 'efterEalDocumentDefinition' },
  { id: 'differencekrav', module: 'src/domain/erhvervsevnetab/eetDocumentDefinitions.ts', symbol: 'differencekravDocumentDefinition' },
  { id: 'loebende-ydelser', module: 'src/domain/erhvervsevnetab/eetDocumentDefinitions.ts', symbol: 'loebendeYdelserDocumentDefinition' },
  { id: 'forsoergertab', module: 'src/domain/forsoergertab/forsoergertabDocumentDefinition.ts', symbol: 'forsoergertabDocumentDefinition' },
] as const satisfies readonly InventoryEntry[];
