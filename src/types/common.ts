/**
 * Centrale type definitions for MINEO
 *
 * Denne fil indeholder alle genbrugte TypeScript types og interfaces
 * der bruges på tværs af applikationen.
 */

import type { z } from 'zod';
import type { AmountValue } from '../schemas/amountExpressionSchema';
import {
  loenperiodeSchema,
  loenPaaHelligdageSchema,
  type LoenindkomstAnsaettelsesforhold,
} from '../schemas/formSchemas';
import type { ISODateString } from './branded';

// =============================================================================
// FORM VALUES TYPES
// =============================================================================

/**
 * Stamdata form values
 */
export interface StamdataValues extends Record<string, unknown> {
  journalnr: string;
  advokat: string;
  sagsbehandler: string;
  skadelidte: string;
  skadestype: '' | 'Arbejdsulykke' | 'Erhvervssygdom' | undefined;
  skadesdato: ISODateString | undefined;
}

/**
 * Satser form values
 */
export interface SatserValues {
  aargang: number | undefined;
}

/**
 * Lønperiode type (bruges i årsløn og tabeller)
 * Inferret fra Zod schema
 */
export type Loenperiode = z.infer<typeof loenperiodeSchema>;

/**
 * Constants for Lønperiode
 */
export const LOENPERIODE = {
  MAANED: 'maaned' as const,
  UGE: 'uge' as const,
  DAG: 'dag' as const,
} satisfies Record<string, Loenperiode>;

/**
 * Løn på helligdage type
 * Inferret fra Zod schema
 */
export type LoenPaaHelligdage = z.infer<typeof loenPaaHelligdageSchema>;

/**
 * Constants for Løn på helligdage
 */
export const LOEN_PAA_HELLIGDAGE = {
  ALMINDELIG: 'Almindelig løn' as const,
  SH_UDBETALING: 'SH-udbetaling' as const,
  INGEN: 'Ingen' as const,
} satisfies Record<string, LoenPaaHelligdage>;

/**
 * Årsløn tabelrække
 */
export interface AarsloenTableRow {
  id: string;           // Unik ID for rækken (kræves af AG Grid)

  // Månedsdata
  col0_maaned?: string; // Måned (fx "Januar 2024")
  col1_maaned?: string; // År (fx "2024")

  // Ugedata
  col0_uge?: string;    // Uge (fx "52/2024")
  col1_uge?: string;    // År (fx "2024")

  // Dagdata
  col0_dag?: string;    // Fra dato (dd-mm-åååå)
  col1_dag?: string;    // Til dato (dd-mm-åååå)

  // Fælles kolonner (bruges af alle periodetyper)
  col2?: AmountValue;   // Grundloen
  col3?: AmountValue;   // Tillaeg
  col4?: AmountValue;   // Ikke-pensionsgivende loen
  col5?: AmountValue;   // ATP og anden ikke-FB loen
}

/**
 * Årsløn form values
 */
export interface AarsloenValues {
  feriePct: number | undefined;
  fritvalgPct: number | undefined;
  shSoPct: number | undefined;
  storeBededagPct: number | undefined;
  pensionPct: number | undefined;
  loenperiode: Loenperiode;
  tableData: AarsloenTableRow[];
  omregningTilFuldtAar: boolean;
  fuldLoenUnderFerie: boolean;
  retTilSjetteFerieuge: boolean;
  antalFeriedage: number | undefined;
  loenPaaHelligdage: LoenPaaHelligdage;
  [key: string]: unknown;
}

/**
 * Renteberegning periode
 */
export interface RenteberegningPeriode {
  startDato: string;
  slutDato: string;
  beloeb: string;
}

/**
 * Renteberegning form values
 */
export interface RenteberegningValues {
  kravType: string;
  perioder: RenteberegningPeriode[];
}

/**
 * Varige mén values
 */
export type VarigeMenValues = Record<string, never>;

/**
 * Svie/smerte periode row (dynamisk tabel)
 */
export interface SvieSmertePeriodeRow {
  id: string;
  fra: string;
  til: string;
  tilstand: '' | 'sygemeldt' | 'delvist-sygemeldt';
}

/**
 * TAF periode row (dynamisk tabel)
 */
export interface TafPeriodeRow {
  id: string;
  fra: string;
  til: string;
  loseFeriedage: string;
}

/**
 * Ferieperiode row (dynamisk tabel)
 */
export interface FerieperiodeRow {
  id: string;
  fra: string;
  til: string;
  feriedage: string;
}

/**
 * Øvrige krav row (dynamisk tabel)
 */
export interface OevrigeKravRow {
  id: string;
  dato: string;
  udgiftTil: string;
  beloeb: AmountValue | undefined;
}

/**
 * Offentlige ydelser row (dynamisk tabel)
 */
export interface OffentligeYdelserRow {
  id: string;
  fraDato?: string;
  tilDato?: string;
  ydelse?: AmountValue | undefined;
  tillaeg?: AmountValue | undefined;
  ydelsestype?: string;
}

/**
 * Erstatningsopgørelse form values
 */
export interface ErstatningsopgoerelseValues {
  // Erstatningsopgørelse info
  eoNummer: string;
  eoLedsagetekst: string;
  opgørelseLavetDen: string;
  vedroererPeriodeFra: string;
  vedroererPeriodeTil: string;
  revideretOpgoerelse: 'Ja' | 'Nej';

  // Forlig
  forligAnsvarsgradProcent: string;
  forligAnsvarsgradBroek: string;
  forligDato: string;

  // AES-afgørelser - Varige mén
  varigeMenAfgorelse: 'Ja' | 'Nej';
  menAfgoerelseDato: string;

  // AES-afgørelser - Midlertidigt EET
  midlertidigtEetAfgorelse: 'Ja' | 'Nej';
  midlertidigEETAfgoerelseDato: string;
  midlertidigEETVirkningsdato: string;

  // AES-afgørelser - Endeligt EET
  endeligtEetAfgorelse: 'Ja' | 'Nej';
  endeligEETAfgoerelseDato: string;
  endeligEETVirkningsdato: string;

  // AES-afgørelser - Øvrigt
  verserendeKlageEet: 'Ja' | 'Nej';
  differencekravDato: string;

  // Svie/smerte godtgørelse
  svieSmerteHelbredsstatus: '' | 'Sygemeldt' | 'Delvist Sygemeldt' | 'Raskmeldt';
  tidligereSsMax: 'Ja' | 'Nej';
  svieSmertePerioder: SvieSmertePeriodeRow[];
  svieSmerteSatserAar: number | undefined;
  svieSmerteDelvisSygemeldingSats: 'fuld' | 'halv';
  svieSmerteTidligereTotal: AmountValue | undefined;
  svieSmerteAktuelPeriode: AmountValue | undefined;

  // Tabt arbejdsfortjeneste
  tafArbejdsstatus: '' | 'Uarbejdsdygtig' | 'Delvist raskmeldt' | 'Fuldt arbejdsdygtig' | 'Fleksjob' | 'Revalidering' | 'Førtidspension' | 'Seniorpension';
  tafPerioder: TafPeriodeRow[];
  ferieperioder: FerieperiodeRow[];
  medlemmetOpsagt: 'Ja' | 'Nej';

  // Øvrige erstatningskrav
  oevrigeKravPerioder: OevrigeKravRow[];

  // Offentlige ydelser
  offentligeYdelserRows: OffentligeYdelserRow[];

  // Indtægt før skaden
  beregnesUdFra: 'Beregningsperiode' | 'Angivet månedsløn' | 'Angivet dagsløn';
  fravaerPerioder: FerieperiodeRow[];
  uspecificeredeFerieFridage: string;
  oevrigeFravaersdage: string;
  oevrigeFravaersdageBeskrivelse: string;

  // Sygeferiegodtgørelse
  ferieMedLon: 'Ja' | 'Nej';
  maanedsloennetMedFerielon: 'Ja' | 'Nej';
  forstSfgEfterSygelon: 'Ja' | 'Nej';

  // Løn-udvikling (til fremtidig brug)
  loenudviklingPaaGrundlagAf: string;

  loenindkomstAnsaettelsesforhold: LoenindkomstAnsaettelsesforhold[];

  // Dynamisk index for fremtidige felter
  [key: string]: unknown;
}

// =============================================================================
// BEREGNINGS-RESULTATER
// =============================================================================

/**
 * Dato-set (interval) brugt i beregninger
 */
export interface DateInterval {
  start: Date;
  end: Date;
}

/**
 * Beregningsmetode for årsløn
 */
export type AarsloenMetode = 'A' | 'B' | 'C' | 'ingen';

/**
 * Resultat fra årsløn-beregning
 */
export interface AarsloenBeregningResult {
  metode: AarsloenMetode;
  erEtAar: boolean;
  hverdageIPeriode?: number;
  feriedageFraInput?: number;
  arbejdsdageIPeriode?: number;
  feriedagePaaAar?: number;
  arbejdsdagePaaAar?: number;
  hverdagePaaAar?: number;
  omregnetAarsloen?: number;
  antalMaaneder?: number;
}

// =============================================================================
// VALIDERINGS-RESULTATER
// =============================================================================

/**
 * Validerings-resultat
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Formel-evaluerings-resultat
 */
export interface FormulaEvaluationResult {
  success: boolean;
  result: number | null;
  error: string | null;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Event type for form field changes
 */
export interface FormFieldChangeEvent {
  target: {
    value: unknown;
  };
}

/**
 * Generic change handler type
 */
export type ChangeHandler = (event: FormFieldChangeEvent) => void;

/**
 * Generic form values type
 */
export type FormValues = Record<string, unknown>;

export type AarsloenTableColumnKey =
  | `col0_${'maaned' | 'uge' | 'dag'}`
  | `col1_${'maaned' | 'uge' | 'dag'}`
  | 'col2'
  | 'col3'
  | 'col4'
  | 'col5';

/**
 * Tabel-fejl type (trust-critical):
 * - Cellefejl bindes til `rowId` (ikke row-index), så sortering ikke kan forveksle rækker.
 * - Tabel-fejl har ingen celle-position.
 */
export type TableError =
  | {
      kind: 'cell';
      issue: 'invalid' | 'partial_period';
      rowId: string;
      colKey: AarsloenTableColumnKey;
    }
  | {
      kind: 'table';
      reason: 'no_valid_rows';
    };

// =============================================================================
// COMPONENT REF HANDLES
// =============================================================================

/**
 * Imperative handle for AarsloenTable component
 */
export interface AarsloenTableHandle {
  getErrors: () => TableError[];
  flashError: (error: Extract<TableError, { kind: 'cell' }>) => void;
}

/**
 * Imperative handle for StyledToggleSwitch component
 */
export interface StyledToggleSwitchHandle {
  shake: () => void;
}

// =============================================================================
// PERSISTENCE TYPES
// =============================================================================

/**
 * Versioneret persisted data wrapper
 *
 * Al data gemt i sessionStorage wrappes i denne struktur
 * for at understøtte fremtidig versionering og migration.
 */
export interface PersistedData<T = unknown> {
  /** Data format version (semantic versioning) */
  version: string;
  /** Tidspunkt for gemning (Unix timestamp) */
  timestamp: number;
  /** Faktisk data fra formularen */
  data: T;
}

// =============================================================================
// FILE SYSTEM TYPES
// =============================================================================

/**
 * .eo fil data-struktur
 */
export interface EoFileData {
  stamdata?: StamdataValues;
  satser?: SatserValues;
  aarsloen?: AarsloenValues;
  renteberegning?: RenteberegningValues;
  varigemen?: VarigeMenValues;
  erstatningsopgoerelse?: ErstatningsopgoerelseValues;
}

/**
 * File handle med metadata
 */
export interface FileHandleWithMetadata {
  handle: FileSystemFileHandle;
  name: string;
  lastModified: number;
}





