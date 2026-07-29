import {
  CONSUMER_CALCULATION_ENTRYPOINTS,
  CONSUMER_CASE_FILE_PATHS,
  CONSUMER_DOCUMENT_OUTPUTS,
} from '../../config/consumerInventory';

// Midlertidigt fase-0-inventar (§6.3): én entry pr. makro-consumer — beregning, sagsfil eller dokumentoutput. Bygger PÅ det
// eksisterende maskinlåste `consumerInventory.ts` (som allerede peger på faktiske exports/callsites og
// er dækket af sin coverage-test) frem for at oprette en parallel autoritet. Her tilføjes consumer-klassen og
// — for dokumenter — hvilken beregning outputtet projekterer fra. De rene projektioner, missing-regler,
// output-invariants og prioriterede editorlokationer pr. navigerbart issue bor i dokumentdefinitionerne og i
// issue-kataloget — ikke her. Registret opregner consumere; det ejer ikke deres regler.

export type ConsumerType = 'beregning' | 'casefile' | 'document';

export type ConsumerLedgerEntry = Readonly<{
  id: string;
  type: ConsumerType;
  module: string;
  symbol: string;
  /** For dokumenter: den beregning/kilde outputtet projekterer fra (backstop-linkage). */
  projectsFrom?: string;
}>;

/** Dokument → kilde-beregning (eller statisk programdata). Bruges til at binde outputs til deres dependency. */
type DocumentId = (typeof CONSUMER_DOCUMENT_OUTPUTS)[number]['id'];

const DOCUMENT_SOURCE: Readonly<Record<DocumentId, string>> = {
  satser: 'satser',
  rente: 'renteberegning',
  'rente-oversigt': 'renteberegning',
  regulering: 'erstatningsopgoerelse',
  krl: 'static:krl',
  'kl-loenaftaler': 'static:kl',
  erstatningsopgoerelse: 'erstatningsopgoerelse',
  'taf-fordelt-paa-aar': 'erstatningsopgoerelse',
  'taf-opreguleret-paa-aar': 'erstatningsopgoerelse',
  'taf-krav-graf': 'erstatningsopgoerelse',
  varigemen: 'varigemen',
  aarsloen: 'aarsloen',
  'sh-dage': 'aarsloen',
  kapitalisering: 'erhvervsevnetab',
  'efter-eal': 'erhvervsevnetab',
  differencekrav: 'erhvervsevnetab',
  'loebende-ydelser': 'erhvervsevnetab',
  forsoergertab: 'forsoergertab',
};

export const INPUT_CONSUMER_LEDGER: readonly ConsumerLedgerEntry[] = [
  ...CONSUMER_CALCULATION_ENTRYPOINTS.map((entry): ConsumerLedgerEntry => ({
    id: `beregning:${entry.id}`, type: 'beregning', module: entry.module, symbol: entry.symbol,
  })),
  ...CONSUMER_CASE_FILE_PATHS.map((entry): ConsumerLedgerEntry => ({
    id: `casefile:${entry.id}`, type: 'casefile', module: entry.module, symbol: entry.symbol,
  })),
  ...CONSUMER_DOCUMENT_OUTPUTS.map((entry): ConsumerLedgerEntry => ({
    id: `document:${entry.id}`, type: 'document', module: entry.module, symbol: entry.symbol,
    projectsFrom: DOCUMENT_SOURCE[entry.id],
  })),
] as const;

export const EXPECTED_BEREGNING_COUNT = 8;
export const EXPECTED_CASEFILE_COUNT = 4;
export const EXPECTED_DOCUMENT_COUNT = 18;
export const EXPECTED_CONSUMER_COUNT =
  EXPECTED_BEREGNING_COUNT + EXPECTED_CASEFILE_COUNT + EXPECTED_DOCUMENT_COUNT;
