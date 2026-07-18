/**
 * Maskinlæsbart migrationsinventar fra greenfield-planens fase 0.
 *
 * Inventaret er ikke en runtime-router og må ikke blive en parallel autoritet for beregning eller dokumenter.
 * Det fastlåser kun den eksisterende, låste feature-flade, indtil de enkelte entrypoints erstattes af de typed
 * kataloger i fase 4–6. Coverage-testen verificerer symbolerne og holder dokumentoutputlisten udtømmende.
 */
export type GreenfieldInventoryEntry = Readonly<{
  id: string;
  module: `src/${string}`;
  symbol: string;
}>;

export type GreenfieldConsumedInventoryEntry = GreenfieldInventoryEntry & Readonly<{
  consumers: readonly `src/${string}`[];
}>;

export const GREENFIELD_PHASE_0_CALCULATION_ENTRYPOINTS = [
  {
    id: 'satser',
    module: 'src/domain/satser/satserProjection.ts',
    symbol: 'projectSatser',
    consumers: ['src/components/pages/Satser.tsx'],
  },
  {
    id: 'aarsloen',
    module: 'src/hooks/useAarsloenBeregning.ts',
    symbol: 'useAarsloenBeregning',
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
    module: 'src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts',
    symbol: 'computeEoSnapshot',
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
] as const satisfies readonly GreenfieldConsumedInventoryEntry[];

export const GREENFIELD_PHASE_0_CASE_FILE_PATHS = [
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
  {
    id: 'load-apply',
    module: 'src/utils/persistenceLoadApply.ts',
    symbol: 'executePersistenceLoadApply',
    consumers: ['src/hooks/useFileSaveLoad.ts'],
  },
] as const satisfies readonly GreenfieldConsumedInventoryEntry[];

export const GREENFIELD_PHASE_0_DOCUMENT_OUTPUTS = [
  { id: 'satser', module: 'src/document/service/documentService.ts', symbol: 'downloadSatserDokument' },
  { id: 'rente', module: 'src/document/service/documentService.ts', symbol: 'downloadRenteDokument' },
  { id: 'rente-oversigt', module: 'src/document/service/documentService.ts', symbol: 'downloadRenteOversigtDokument' },
  { id: 'regulering', module: 'src/document/service/documentService.ts', symbol: 'downloadReguleringDokument' },
  { id: 'krl', module: 'src/document/service/documentService.ts', symbol: 'downloadKrlDokument' },
  { id: 'kl-loenaftaler', module: 'src/document/service/documentService.ts', symbol: 'downloadKlLoenaftalerDokument' },
  { id: 'erstatningsopgoerelse', module: 'src/document/service/documentService.ts', symbol: 'downloadErstatningsopgoerelseDokument' },
  { id: 'taf-fordelt-paa-aar', module: 'src/document/service/documentService.ts', symbol: 'downloadTafFordeltPaaAarDokument' },
  { id: 'taf-opreguleret-paa-aar', module: 'src/document/service/documentService.ts', symbol: 'downloadTafOpreguleretPaaAarDokument' },
  { id: 'taf-krav-graf', module: 'src/document/service/documentService.ts', symbol: 'downloadTafKravGrafDokument' },
  { id: 'varigemen', module: 'src/document/service/documentService.ts', symbol: 'downloadVarigeMenDokument' },
  { id: 'aarsloen', module: 'src/document/service/documentService.ts', symbol: 'downloadAarsloenDokument' },
  { id: 'sh-dage', module: 'src/document/service/documentService.ts', symbol: 'downloadSHDageDokument' },
  { id: 'kapitalisering', module: 'src/document/service/documentService.ts', symbol: 'downloadKapitaliseringDokument' },
  { id: 'efter-eal', module: 'src/document/service/documentService.ts', symbol: 'downloadEfterEalDokument' },
  { id: 'differencekrav', module: 'src/document/service/documentService.ts', symbol: 'downloadDifferencekravDokument' },
  { id: 'loebende-ydelser', module: 'src/document/service/documentService.ts', symbol: 'downloadLoebendeYdelserDokument' },
  { id: 'forsoergertab', module: 'src/document/service/documentService.ts', symbol: 'downloadForsoergertabDokument' },
] as const satisfies readonly GreenfieldInventoryEntry[];
