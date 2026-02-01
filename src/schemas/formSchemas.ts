/**
 * Zod schemas for alle form values
 *
 * Disse schemas definerer:
 * - Runtime validering
 * - Type inference
 * - Serialization/deserialization regler
 */

import { z } from 'zod';
import type { ISODateString } from '../types/branded';
import { optionalAmountValueSchema } from './amountExpressionSchema';

// =============================================================================
// BASE SCHEMAS - Genbrugelige building blocks
// =============================================================================

// Dato-bounds (centraliserede konstanter)
const DATE_MIN_YEAR = 1900;
const DATE_MAX_YEAR = 2100;

const normalizeEmptyToUndefined = (value: unknown): unknown => {
  if (value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
};

/**
 * Valideringsfunktion for ISO-datoer
 *
 * Ekstraeret som separat funktion for at dokumentere og genbruge logik.
 */
const validateISODateFormat = (val: string): boolean => {
  // Parse manuelt uden timezone-konvertering
  const parts = val.split('-');
  if (parts.length !== 3) return false;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  // Valider år-range
  if (year < DATE_MIN_YEAR || year > DATE_MAX_YEAR) return false;

  // Valider måned/dag ranges
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Opret dato og tjek gyldighed (fx 31. februar)
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

/**
 * ISO-formateret dato string (åååå-mm-dd) med branded type
 *
 * Bruger samme brand-mekanisme som branded.ts for konsistens.
 * Accepterer kun datoer mellem 1900-2100.
 */
const isoDateString = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Skal være ISO-format: åååå-mm-dd')
  .refine(validateISODateFormat, 'Ikke en gyldig dato')
  .transform(val => val as ISODateString);

const optionalIsoDateString = z.preprocess(normalizeEmptyToUndefined, isoDateString.optional());

const coerceToNumberOrUndefined = (value: unknown): unknown => {
  if (value === undefined || value === null) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;

    const cleaned = trimmed.replace(/\\./g, '').replace(',', '.');
    const num = Number.parseFloat(cleaned);
    return Number.isFinite(num) ? num : value;
  }

  return value;
};

const coerceToIntegerOrUndefined = (value: unknown): unknown => {
  const coerced = coerceToNumberOrUndefined(value);
  if (typeof coerced === 'number') {
    return Number.isFinite(coerced) ? Math.trunc(coerced) : coerced;
  }
  return coerced;
};

/**
 * Non-negative decimal number (0 eller større)
 *
 * Bruges til beløb, procenter, osv. hvor 0 er tilladt.
 * Afviser -0 for at undgå edge cases.
 */
const _nonNegativeNumber = z.preprocess(coerceToNumberOrUndefined, z.number()
  .min(0, 'Kan ikke være negativ')
  .refine(Number.isFinite, 'Skal være et endeligt tal')
  .refine((v) => !Object.is(v, -0), 'Kan ikke være -0')
  .optional());

/**
 * Non-negative amount (expression-aware)
 */
const nonNegativeAmountValue = optionalAmountValueSchema
  .refine((v) => v === undefined || v.value >= 0, 'Kan ikke være negativ')
  .refine((v) => v === undefined || !Object.is(v.value, -0), 'Kan ikke være -0');

/**
 * Positive decimal number (større end 0)
 *
 * Bruges hvor 0 IKKE er tilladt (fx divisorer, multiplikatorer).
 */
const _positiveNumber = z.preprocess(coerceToNumberOrUndefined, z.number()
  .gt(0, 'Skal være større end 0')
  .refine(Number.isFinite, 'Skal være et endeligt tal')
  .refine((v) => !Object.is(v, -0), 'Kan ikke være -0')
  .optional());

/**
 * Positive amount (expression-aware)
 */
const positiveAmountValue = optionalAmountValueSchema
  .refine((v) => v === undefined || v.value > 0, 'Skal være større end 0')
  .refine((v) => v === undefined || !Object.is(v.value, -0), 'Kan ikke være -0');

/**
 * Non-negative integer (0 eller større)
 *
 * Generisk integer - brug domæne-specifikke varianter når muligt.
 */
const nonNegativeInteger = z.preprocess(coerceToIntegerOrUndefined, z.number()
  .int()
  .min(0, 'Kan ikke være negativ')
  .refine(Number.isFinite, 'Skal være et endeligt heltal')
  .optional());

/**
 * År (integer mellem 1900-2100)
 */
const yearInteger = z.preprocess(coerceToIntegerOrUndefined, z.number()
  .int()
  .min(DATE_MIN_YEAR, `Skal være mindst ${DATE_MIN_YEAR}`)
  .max(DATE_MAX_YEAR, `Må højst være ${DATE_MAX_YEAR}`)
  .optional());

/**
 * Antal dage (integer 0-366)
 */
const dayCount = z.preprocess(coerceToIntegerOrUndefined, z.number()
  .int()
  .min(0, 'Kan ikke være negativ')
  .max(366, 'Må højst være 366 dage')
  .optional());

const loseFeriedageCount = z.preprocess(coerceToIntegerOrUndefined, z.number()
  .int()
  .min(0, 'Kan ikke være negativ')
  .max(999, 'Må højst være 999 dage')
  .optional());

/**
 * Procent som heltal (0-100)
 */
const _percentageInteger = z.preprocess(coerceToIntegerOrUndefined, z.number()
  .int()
  .min(0, 'Kan ikke være negativ')
  .max(100, 'Må højst være 100%')
  .optional());

/**
 * Optional string med normalisering af tom værdi
 *
 * Konverterer tomme strings ("") til undefined for konsistent håndtering.
 * Brug denne når UI kan producere "" men du vil have undefined i modellen.
 */
/**
 * Procent som decimal (0-100)
 */
const percentageDecimal = z.preprocess(coerceToNumberOrUndefined, z.number()
  .min(0, 'Kan ikke være negativ')
  .max(100, 'Må højst være 100%')
  .refine(Number.isFinite, 'Skal være et endeligt tal')
  .optional());

const optionalString = z.string()
  .transform(v => v.trim() === '' ? undefined : v)
  .optional();

/**
 * Optional string der tillader tomme strings og null
 *
 * Brug denne når "" er en gyldig værdi (fx fritekst-felter, tabel-celler).
 * Konverterer null til undefined for konsistent håndtering.
 */
const allowEmptyString = z.preprocess(
  (val) => (val === null ? undefined : val),
  z.string().optional()
);

/**
 * Table cell string (B1 model): persisted as display strings, never parsed in table components.
 *
 * Migration support:
 * - undefined/null -> ''
 * - number -> String(number)
 * - ISO date string -> converted to dd-mm-yyyy for date-cells (see `tableDateCellString`)
 */
const tableCellString = z.preprocess((val) => {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  return '';
}, z.string().optional());

const isoToDanishDateString = (iso: string): string => {
  // Format: YYYY-MM-DD -> DD-MM-YYYY
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
};

const tableDateCellString = z.preprocess((val) => {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') {
    // Migration: previously persisted as ISODateString.
    return validateISODateFormat(val) ? isoToDanishDateString(val) : val;
  }
  return '';
}, z.string().optional());

const tableAmountCellValue = optionalAmountValueSchema;

// =============================================================================
// CENTRALISEREDE ENUM DEFINITIONER
// =============================================================================

/**
 * Ja/Nej enum (bruges mange steder)
 */
export const jaNejEnum = z.enum(['Ja', 'Nej']);
export type JaNej = z.infer<typeof jaNejEnum>;

/**
 * Skadestype enum
 */
export const skadestypeEnum = z.enum(['Arbejdsulykke', 'Erhvervssygdom']);
export type Skadestype = z.infer<typeof skadestypeEnum>;

/**
 * Helbredsstatus enum
 */
export const helbredsstatusEnum = z.enum(['Sygemeldt', 'Delvist Sygemeldt', 'Raskmeldt']);
export type Helbredsstatus = z.infer<typeof helbredsstatusEnum>;

/**
 * Tilstand enum (for svie/smerte perioder)
 */
export const tilstandEnum = z.enum(['sygemeldt', 'delvist-sygemeldt']);
export type Tilstand = z.infer<typeof tilstandEnum>;

/**
 * Arbejdsstatus enum (for TAF)
 */
export const arbejdsstatusEnum = z.enum([
  'Uarbejdsdygtig',
  'Delvist raskmeldt',
  'Fuldt arbejdsdygtig',
  'Fleksjob',
  'Revalidering',
  'Uddannelse',
  'Førtidspension',
  'Seniorpension',
  'Folkepension'
]);
export type Arbejdsstatus = z.infer<typeof arbejdsstatusEnum>;

/**
 * Beregningsmetode enum
 */
export const beregningsmetodeEnum = z.enum(['Beregningsperiode', 'Angivet månedsløn', 'Angivet dagsløn']);
export type Beregningsmetode = z.infer<typeof beregningsmetodeEnum>;

// =============================================================================
// STAMDATA SCHEMA
// =============================================================================

export const stamdataSchema = z.object({
  journalnr: optionalString,
  advokat: optionalString,
  sagsbehandler: optionalString,
  skadelidte: optionalString,
  skadestype: z.preprocess(normalizeEmptyToUndefined, skadestypeEnum.optional()),
  skadesdato: optionalIsoDateString,
}).strict();

export type StamdataValues = z.infer<typeof stamdataSchema>;

// =============================================================================
// SATSER SCHEMA
// =============================================================================

export const satserSchema = z.object({
  aargang: yearInteger,
}).strict();

export type SatserValues = z.infer<typeof satserSchema>;

// =============================================================================
// ÅRSLØN SCHEMAS
// =============================================================================

/**
 * Lønperiode type
 */
export const loenperiodeSchema = z.enum(['maaned', 'uge', 'dag']);
export type Loenperiode = z.infer<typeof loenperiodeSchema>;

/**
 * Løn på helligdage
 */
export const loenPaaHelligdageSchema = z.enum(['Almindelig løn', 'SH-udbetaling', 'Ingen']);
export type LoenPaaHelligdage = z.infer<typeof loenPaaHelligdageSchema>;

/**
 * Lønudvikling beregningsgrundlag
 */
export const loenudviklingBeregningsgrundlagEnum = z.enum(['Overenskomst', 'Statistik', 'Manuelt angivet', 'Ingen']);
export type LoenudviklingBeregningsgrundlag = z.infer<typeof loenudviklingBeregningsgrundlagEnum>;

/**
 * Statistik-model for lønudvikling
 */
export const loenudviklingStatistikModelEnum = z.enum([
  'ASL-Årslønsmaksimum',
  'ILON12 (Danmarks Statistik)',
  'SBLON2 (Danmarks Statistik)',
]);
export type LoenudviklingStatistikModel = z.infer<typeof loenudviklingStatistikModelEnum>;

/**
 * Årsløn tabelrække
 *
 * VIGTIGT: Beloebskolonnerne er expression-aware AmountValues.
 * Parsing og evaluering sker i input/deriverede beregninger.
 */
export const aarsloenTableRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),

  // Månedsdata
  col0_maaned: allowEmptyString,
  col1_maaned: allowEmptyString,

  // Ugedata
  col0_uge: allowEmptyString, // Format: "uu/åååå"
  col1_uge: allowEmptyString,

  // Dagdata
  col0_dag: allowEmptyString,
  col1_dag: allowEmptyString,

  // Fælles kolonner (beløb)
  col2: tableAmountCellValue,  // Grundløn
  col3: tableAmountCellValue,  // Tillæg
  col4: tableAmountCellValue,  // Ikke-pensionsgivende løn
  col5: tableAmountCellValue,  // ATP og anden ikke FB-løn
}).strict();

export type AarsloenTableRow = z.infer<typeof aarsloenTableRowSchema>;

/**
 * Årsløn form values
 *
 * VIGTIGT: Procent-felter er string | undefined fordi:
 * - StyledPercentField forventer value?: string
 * - Parsing til decimal sker ved beregninger (via parsePercentToDecimal)
 */
export const aarsloenSchema = z.object({
  feriePct: percentageDecimal,
  fritvalgPct: percentageDecimal,
  shSoPct: percentageDecimal,
  storeBededagPct: percentageDecimal,
  pensionPct: percentageDecimal,
  loenperiode: loenperiodeSchema,
  tableData: z.array(aarsloenTableRowSchema),
  omregningTilFuldtAar: z.boolean(),
  fuldLoenUnderFerie: z.boolean(),
  retTilSjetteFerieuge: z.boolean(),
  antalFeriedage: dayCount,
  loenPaaHelligdage: loenPaaHelligdageSchema,
}).strict();

export type AarsloenValues = z.infer<typeof aarsloenSchema>;

// =============================================================================
// RENTEBEREGNING SCHEMAS
// =============================================================================

/**
 * Enhed for tillægstid (dage, uger, måneder)
 */
export const tillaegstidEnhedEnum = z.enum(['dage', 'uger', 'maaneder']);
export type TillaegstidEnhed = z.infer<typeof tillaegstidEnhedEnum>;

/**
 * Rentekrav række (beregnet rente tabel)
 *
 * VIGTIGT:
 * - enhedSelected er IKKE del af modellen - det er deriveret state.
 *   Beregnes altid som: tillaegstid !== undefined && tillaegstid > 0
 * - renterFra bruger optionalIsoDateString (UDEN range-validering)
 *   fordi StyledDateField håndterer visuel range-feedback. Range-validering
 *   sker først ved domain-laget (renteberegning).
 */
export const rentekravRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  belob: nonNegativeAmountValue,
  renterFra: optionalIsoDateString,
  tillaegstid: nonNegativeInteger,
  enhed: tillaegstidEnhedEnum,
}).strict();

export type RentekravRow = z.infer<typeof rentekravRowSchema>;

/**
 * Renteberegning form values
 *
 * VIGTIGT: beregningsdato bruger optionalIsoDateString (UDEN range-validering)
 * fordi StyledDateField håndterer visuel range-feedback. Range-validering
 * sker først ved domain-laget (renteberegning).
 */
const stripTopLevelKey = (value: unknown, keyToStrip: string): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  const record = value as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, keyToStrip)) return value;

  const out: Record<string, unknown> = { ...record };
  delete out[keyToStrip];
  return out;
};

const renteberegningInnerSchema = z.object({
  beregningsdato: optionalIsoDateString,
  rentekravRows: z.array(rentekravRowSchema),
}).strict();

export const renteberegningSchema = z.preprocess(
  (value) => stripTopLevelKey(value, 'activeTab'),
  renteberegningInnerSchema
);

export type RenteberegningValues = z.infer<typeof renteberegningSchema>;

// =============================================================================
// VARIGE MÉN SCHEMAS
// =============================================================================

const varigeMenInnerSchema = z.object({
  fodselsdato: optionalIsoDateString,
  mengrad: percentageDecimal,
  beregningsdato: optionalIsoDateString,
}).strict();

export const varigeMenSchema = z.preprocess((value) => stripTopLevelKey(value, 'activeTab'), varigeMenInnerSchema);

export type VarigeMenValues = z.infer<typeof varigeMenSchema>;

// =============================================================================
// ERSTATNINGSOPGØRELSE SCHEMAS
// =============================================================================

/**
 * Svie/smerte periode
 */
export const svieSmertePeriodeRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  fra: optionalIsoDateString,
  til: optionalIsoDateString,
  tilstand: z.preprocess(normalizeEmptyToUndefined, tilstandEnum.optional()),
}).strict();

export type SvieSmertePeriodeRow = z.infer<typeof svieSmertePeriodeRowSchema>;

/**
 * TAF periode
 */
export const tafPeriodeRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  fra: optionalIsoDateString,
  til: optionalIsoDateString,
  loseFeriedage: loseFeriedageCount,
}).strict();

export type TafPeriodeRow = z.infer<typeof tafPeriodeRowSchema>;

/**
 * Ferieperiode
 */
export const ferieperiodeRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  fra: optionalIsoDateString,
  til: optionalIsoDateString,
}).strict();

export type FerieperiodeRow = z.infer<typeof ferieperiodeRowSchema>;

/**
 * Øvrige krav
 */
export const oevrigeKravRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  dato: optionalIsoDateString,
  udgiftTil: optionalString,
  beloeb: positiveAmountValue,
}).strict();

export type OevrigeKravRow = z.infer<typeof oevrigeKravRowSchema>;

/**
 * Offentlige ydelser
 */
export const offentligeYdelserRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  fraDato: tableDateCellString,
  tilDato: tableDateCellString,
  ydelse: tableAmountCellValue,
  tillaeg: tableAmountCellValue,
  ydelsestype: tableCellString,
}).strict();

export type OffentligeYdelserRow = z.infer<typeof offentligeYdelserRowSchema>;

/**
 * Lønudvikling (manuel) tabelrække
 */
export const loenudviklingManuelRowSchema = z.object({
  id: z.string().min(1, 'Række-ID må ikke være tomt'),
  dato: tableDateCellString,
  grundloen: tableAmountCellValue,
  feriepenge: tableCellString,
  shSoSats: tableCellString,
  fritvalg: tableCellString,
  agPension: tableCellString,
}).strict();

export type LoenudviklingManuelRow = z.infer<typeof loenudviklingManuelRowSchema>;

/**
 * AES-afgørelser sub-schema
 *
 * Grupperer alle afgørelser fra Arbejdsmarkedets Erhvervssikring.
 */
const aesAfgoerelserSchema = z.object({
  // Varige mén
  varigeMenAfgorelse: jaNejEnum,
  menAfgoerelseDato: optionalIsoDateString,
  verserendeKlageMen: jaNejEnum,

  // Midlertidigt EET
  midlertidigtEetAfgorelse: jaNejEnum,
  midlertidigEETAfgoerelseDato: optionalIsoDateString,
  midlertidigEETVirkningsdato: optionalIsoDateString,

  // Endeligt EET
  endeligtEetAfgorelse: jaNejEnum,
  endeligEETAfgoerelseDato: optionalIsoDateString,
  endeligEETVirkningsdato: optionalIsoDateString,
  verserendeKlageEet: jaNejEnum,

  // Øvrigt
  differencekravDato: optionalIsoDateString,
}).strict()
  .refine((data) => {
    // Cross-field validering: Hvis afgørelse = 'Ja', skal der være en dato
    if (data.varigeMenAfgorelse === 'Ja' && !data.menAfgoerelseDato) {
      return false;
    }
    return true;
  }, {
    message: 'Afgørelsesdato skal udfyldes når afgørelse er "Ja"',
    path: ['menAfgoerelseDato'],
  })
  .refine((data) => {
    if (data.midlertidigtEetAfgorelse === 'Ja' && !data.midlertidigEETAfgoerelseDato && !data.midlertidigEETVirkningsdato) {
      return false;
    }
    return true;
  }, {
    message: 'Afgørelsesdato eller virkningsdato skal udfyldes når afgørelse er "Ja"',
    path: ['midlertidigEETAfgoerelseDato'],
  })
  .refine((data) => {
    if (data.endeligtEetAfgorelse === 'Ja' && !data.endeligEETAfgoerelseDato && !data.endeligEETVirkningsdato) {
      return false;
    }
    return true;
  }, {
    message: 'Afgørelsesdato eller virkningsdato skal udfyldes når afgørelse er "Ja"',
    path: ['endeligEETAfgoerelseDato'],
  });

/**
 * Svie/smerte godtgørelse sub-schema
 */
const svieSmerteSchema = z.object({
  svieSmerteHelbredsstatus: z.preprocess(normalizeEmptyToUndefined, helbredsstatusEnum.optional()),
  tidligereSsMax: jaNejEnum,
  svieSmertePerioder: z.array(svieSmertePeriodeRowSchema),
  svieSmerteSatserAar: yearInteger,
  svieSmerteDelvisSygemeldingSats: z.enum(['fuld', 'halv']),
  svieSmerteTidligereTotal: nonNegativeAmountValue,
  svieSmerteAktuelPeriode: nonNegativeAmountValue,
}).strict();


/**
 * Tabt arbejdsfortjeneste (TAF) sub-schema
 */
const tafSchema = z.object({
  tafArbejdsstatus: z.preprocess(normalizeEmptyToUndefined, arbejdsstatusEnum.optional()),
  tafPerioder: z.array(tafPeriodeRowSchema),
  ferieperioder: z.array(ferieperiodeRowSchema),
  medlemmetOpsagt: jaNejEnum,
  sidsteDagAnsaettelsesforhold: optionalIsoDateString,
  tidligereModtagetTaf: nonNegativeAmountValue,
}).strict();

/**
 * Indtægt før skaden sub-schema
 */
const indtaegtFoerSkadenSchema = z.object({
  komprimerBeregningEfterFoersteOpgoerelse: jaNejEnum.default('Ja'),
  beregnesUdFra: beregningsmetodeEnum,
  periodeTilBeregningFra: optionalIsoDateString,
  periodeTilBeregningTil: optionalIsoDateString,
  fravaerPerioder: z.array(ferieperiodeRowSchema),
  uspecificeredeFerieFridage: dayCount,
  oevrigtFravaerUdenLoen: jaNejEnum,
  oevrigeFravaersdage: dayCount,
  oevrigeFravaersdageBeskrivelse: optionalString,
  maanedsloenenUdgoer: nonNegativeAmountValue,
  dagsloenenUdgoer: nonNegativeAmountValue,
  loenBaseretPaa: optionalString,
}).strict();

/**
 * Sygeferiegodtgørelse sub-schema
 */
const sygeferiegodtgoerelseSchema = z.object({
  ferieMedLon: jaNejEnum,
  maanedsloennetMedFerielon: jaNejEnum,
  forstSfgEfterSygelon: jaNejEnum,
  andelSfggILoenen: nonNegativeAmountValue,
}).strict();

/**
 * Erstatningsopgørelse form values
 *
 * VIGTIGT: Bruger string | undefined for nogle felter der faktisk er numbers,
 * fordi komponenten bruger StyledPercentField (string) og manuel parsing.
 * Datoer forbliver ISO-format.
 *
 * Struktureret i sub-schemas for bedre overskuelighed og type-safety.
 */
const erstatningsopgoerelseBaseSchema = z.object({
  // Erstatningsopgørelse info
  eoNummer: optionalString,
  eoLedsagetekst: optionalString,
  opgørelseLavetDen: optionalIsoDateString,
  vedroererPeriodeFra: optionalIsoDateString,
  vedroererPeriodeTil: optionalIsoDateString,
  revideretOpgoerelse: jaNejEnum,

  // Forlig
  forligAnsvarsgradProcent: percentageDecimal,
  forligAnsvarsgradBroek: optionalString,
  forligDato: optionalIsoDateString,

  // AES-afgørelser (struktureret sub-schema med validering)

  // Svie/smerte godtgørelse

  // Tabt arbejdsfortjeneste

  // Øvrige erstatningskrav
  oevrigeKravPerioder: z.array(oevrigeKravRowSchema),

  // Offentlige ydelser
  offentligeYdelserRows: z.array(offentligeYdelserRowSchema),

  // Indtægt før skaden

  // Sygeferiegodtgørelse

  // Løn-udvikling
  loenudviklingPaaGrundlagAf: optionalString,

  // Kommentarer
  saerligeKommentarer: optionalString,
}).strict();
// VIGTIGT: Cross-field validering (fx forlig procent vs brøk) håndteres KUN i UI-laget
// .refine() validering må ALDRIG blokere deserialisering - alt gemt data skal kunne indlæses

/**
 * Lønindkomst sub-schema
 *
 * VIGTIGT:
 * - Felter må være schema-defineret og persisted (save/load coverage).
 * - Ingen derived/UI state må gemmes.
 */
export const loenindkomstAnsaettelsesforholdSchema = z.object({
  id: z.string().min(1, 'ID må ikke være tomt'),

  navnPaaArbejdssted: optionalString,

  // Ansættelse
  harOverenskomst: z.boolean(),
  overenskomstId: optionalString, // Valgt overenskomst-ID (fx 'bygge-anlaeg')

  ansatPaaSkadestidspunktet: z.boolean(),
  ansaettelsesforholdOphoert: z.boolean(),
  sidsteArbejdsdag: optionalIsoDateString,

  // Satser
  feriePct: percentageDecimal,
  fritvalgPct: percentageDecimal,
  shSoPct: percentageDecimal,
  storeBededagPct: percentageDecimal,
  pensionPct: percentageDecimal,
  loenperiode: loenperiodeSchema,

  // Indtægtsoplysninger (samme tabel-format som i Årsløn)
  indtaegtsoplysningerTableData: z.array(aarsloenTableRowSchema),
  fuldLoenUnderFerie: jaNejEnum,
  loenPaaHelligdage: loenPaaHelligdageSchema,
  saerligFraDatoRegulering: optionalIsoDateString,

  // Lønudvikling
  loenudviklingBeregningsgrundlag: z.preprocess(normalizeEmptyToUndefined, loenudviklingBeregningsgrundlagEnum.optional()),
  loenudviklingStatistikModel: z.preprocess(normalizeEmptyToUndefined, loenudviklingStatistikModelEnum.optional()),
  loenudviklingManuelNavn: optionalString,
  loenudviklingManuelTableData: z.array(loenudviklingManuelRowSchema).default([]),

  // Overenskomst-filter (persisteres for at bevare brugerens valg)
  // Initialiseres fra settings ved oprettelse af ansættelsesforhold, ændres ikke af efterfølgende settings-ændringer
  // Ikke-optional: Alle ansættelsesforhold har altid et filter-objekt
  overenskomstFilter: z.object({
    loenmodtager: optionalString,
    arbejdsgiver: optionalString,
  }),
}).strict();

export type LoenindkomstAnsaettelsesforhold = z.infer<typeof loenindkomstAnsaettelsesforholdSchema>;

const loenindkomstSchema = z.object({
  loenindkomstAnsaettelsesforhold: z.array(loenindkomstAnsaettelsesforholdSchema),
}).strict();

export const erstatningsopgoerelseSchema = erstatningsopgoerelseBaseSchema
  .merge(aesAfgoerelserSchema)
  .merge(svieSmerteSchema)
  .merge(tafSchema)
  .merge(indtaegtFoerSkadenSchema)
  .merge(sygeferiegodtgoerelseSchema)
  .merge(loenindkomstSchema)
  .strict();

export type ErstatningsopgoerelseValues = z.infer<typeof erstatningsopgoerelseSchema>;

// =============================================================================
// BEREGNINGS-RESULTATER (ingen ændring - allerede type-safe)
// =============================================================================

export type AarsloenMetode = 'A' | 'B' | 'C' | 'ingen';

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
// DATO INTERVAL (bruges i beregninger - Date objekter)
// =============================================================================

export interface DateInterval {
  start: Date;
  end: Date;
}

// =============================================================================
// VALIDATION RESULT
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface FormulaEvaluationResult {
  success: boolean;
  result: number | null;
  error: string | null;
}

