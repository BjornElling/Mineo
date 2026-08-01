import type {
  LoenudviklingManuelProcentsatsRow,
  LoenudviklingManuelRow,
} from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';

/** Alle brugeroprettede reguleringsrækker skal ligge strengt efter den programstyrede basisdato. */
export const isManualRegulationDateOnOrBeforeBasis = (
  dato: ISODateString | undefined,
  anvendtReguleringsdato: ISODateString | undefined
): boolean => dato !== undefined
  && anvendtReguleringsdato !== undefined
  && dato <= anvendtReguleringsdato;

/**
 * Ét sandt sted for "aktiv række + begge-felter-krævet"-prædikaterne for de to manuelle
 * reguleringsformer (Manuel procentsats + Manuelt angivet).
 *
 * Motorens compute-drop (`manuelProcentsatsRegulering`/`buildLoenudviklingFromManual`), den
 * pre-compute-validator (`erstatningsopgoerelseValidator`) og row-evaluerings-gaten
 * (`eoRowIndkomstRows`) SKAL dele disse prædikater, så en "aktiv" men ufuldstændig række altid
 * gates blokerende samme sted som motoren stille dropper den — ellers opstår tavs
 * underregulering. En fælles prædikatdefinition hindrer, at gate og motor driver fra hinanden.
 *
 * Note om dato-checket: committed `dato` er (via `tableIsoDateCellString`) altid enten en gyldig
 * ISO-streng eller `undefined` (tom/whitespace → `undefined`, ugyldigt ikke-tomt input fejler
 * schemaet). `row.dato !== undefined` er derfor tal-/adfærds-identisk med de tidligere varianter
 * (`(row.dato ?? '').trim() !== ''` og `isISODateString(row.dato)`) på hele det committed domæne.
 */

/** Finit tal-check delt af begge manuelle former (procent/tillægssats). */
export const hasFinitePct = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

// ---- Manuel procentsats ----

type ProcentsatsRowFelter = Pick<LoenudviklingManuelProcentsatsRow, 'dato' | 'procent'>;

/** En procentsats-række er "aktiv" hvis brugeren har udfyldt dato ELLER procent. */
export const isManuelProcentsatsRowAktiv = (row: ProcentsatsRowFelter): boolean =>
  row.dato !== undefined || hasFinitePct(row.procent);

/**
 * En procentsats-række er "komplet" (indgår i akkumuleringen) hvis BEGGE felter er udfyldt.
 * En aktiv men ikke-komplet række er netop den tavse-under-regulerings-tilstand, gaten fanger.
 */
export const isManuelProcentsatsRowKomplet = (row: ProcentsatsRowFelter): boolean =>
  row.dato !== undefined && hasFinitePct(row.procent);

// ---- Manuelt angivet ----

/** Tillægssats-felterne på en manuel angivet-række (grundløn/dato behandles særskilt). */
export const MANUEL_ANGIVET_SUPPLEMENT_FELTER = [
  'feriepenge',
  'shSoSats',
  'fritvalg',
  'agPension',
] as const;

export type ManuelAngivetSupplementFelt = (typeof MANUEL_ANGIVET_SUPPLEMENT_FELTER)[number];

type ManuelAngivetRowFelter = Pick<
  LoenudviklingManuelRow,
  'dato' | 'grundloen' | ManuelAngivetSupplementFelt
>;

/** Sand hvis dato-cellen på en manuel angivet-række faktisk bærer en værdi. */
export const isManuelAngivetRowDatoUdfyldt = (
  row: Pick<LoenudviklingManuelRow, 'dato'>
): boolean => row.dato !== undefined;

/** En manuel angivet-række er "aktiv" hvis brugeren har udfyldt dato, grundløn eller et tillæg. */
export const isManuelAngivetRowAktiv = (row: ManuelAngivetRowFelter): boolean =>
  isManuelAngivetRowDatoUdfyldt(row)
  || row.grundloen !== undefined
  || MANUEL_ANGIVET_SUPPLEMENT_FELTER.some((felt) => hasFinitePct(row[felt]));
