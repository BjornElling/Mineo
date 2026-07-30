/**
 * Det kanoniske ID-inventar for dokumentoutputs.
 *
 * Ligger i sit eget modul UDEN afhængigheder, fordi det er completeness-kilden: både Mineos og
 * standalone-appens runtime-kataloger måles mod dette sæt, og en test kræver præcis én definition
 * pr. id på tværs af de to kataloger. Lå inventaret i `documentCatalog.ts`, ville completeness-testen
 * skulle importere hele kompositionen — og dermed hele domænegrafen — for at læse en liste af
 * strenge.
 *
 * Opdelingen mellem `MINEO_*` og `STANDALONE_*` er ikke kosmetik: de to apps har hver sit
 * `DocumentExecutionEnvironment` (formatpolitik, brevhoved, failure-sink), og et output hører til
 * præcis én af dem.
 */

/** De 18 outputs i hovedappen. Holdes identisk med `CONSUMER_DOCUMENT_OUTPUTS`. */
export const MINEO_DOCUMENT_OUTPUT_IDS = [
  'satser',
  'rente',
  'rente-oversigt',
  'regulering',
  'krl',
  'kl-loenaftaler',
  'erstatningsopgoerelse',
  'taf-fordelt-paa-aar',
  'taf-opreguleret-paa-aar',
  'taf-krav-graf',
  'varigemen',
  'aarsloen',
  'sh-dage',
  'kapitalisering',
  'efter-eal',
  'differencekrav',
  'loebende-ydelser',
  'forsoergertab',
] as const;

/**
 * Standalone MinProcesrente. Kontraktens §A2a kræver udtrykkeligt, at også standalone er
 * katalogiseret — den har historisk stået helt uden gate.
 */
export const STANDALONE_DOCUMENT_OUTPUT_IDS = [
  'standalone-rente',
  'standalone-rente-alle',
  'standalone-rente-oversigt',
] as const;

export type MineoDocumentOutputId = (typeof MINEO_DOCUMENT_OUTPUT_IDS)[number];
export type StandaloneDocumentOutputId = (typeof STANDALONE_DOCUMENT_OUTPUT_IDS)[number];
export type DocumentOutputId = MineoDocumentOutputId | StandaloneDocumentOutputId;

export const ALL_DOCUMENT_OUTPUT_IDS: readonly DocumentOutputId[] = [
  ...MINEO_DOCUMENT_OUTPUT_IDS,
  ...STANDALONE_DOCUMENT_OUTPUT_IDS,
];
