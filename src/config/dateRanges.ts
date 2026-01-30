/**
 * Central konfiguration af dato-afgrænsninger for MINEO
 *
 * ÅRLIG OPDATERING:
 * Opdater MIN_YEAR hvis der tilføjes ældre arbejdsskadesatser
 */

import type { ISODateString } from '../types/branded';
import { dateToISO, toISODateString } from '../types/branded';

// ============================================================================
// KONSTANTER (VALIDEREDE ISO-DATOER)
// ============================================================================

// Hjælpefunktion til at skabe validerede konstante datoer
const iso = (date: string): ISODateString => toISODateString(date);

// Centrale datoer
const DATE_1900_01_01 = iso('1900-01-01');
const DATE_2005_01_01 = iso('2005-01-01');
const DATE_2025_01_01 = iso('2025-01-01');
const DATE_2025_12_31 = iso('2025-12-31');
const DATE_2026_12_31 = iso('2026-12-31');
const DATE_2030_12_31 = iso('2030-12-31');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Statisk dato-range med kendte værdier
 */
interface StaticDateRange {
  readonly type: 'static';
  readonly min: ISODateString;
  readonly max: ISODateString;
  readonly placeholder: string;
  readonly notes: string;
}

/**
 * Dynamisk dato-range med runtime-beregning
 * KRÆVER fallback-værdier når 'DYNAMIC' bruges
 */
interface DynamicMinDateRange {
  readonly type: 'dynamic-min';
  readonly min: 'DYNAMIC';
  readonly fallbackMin: ISODateString;
  readonly max: ISODateString;
  readonly placeholder: string;
  readonly notes: string;
}

interface DynamicMaxDateRange {
  readonly type: 'dynamic-max';
  readonly min: ISODateString;
  readonly max: 'DYNAMIC';
  readonly fallbackMax: ISODateString;
  readonly placeholder: string;
  readonly notes: string;
}

interface DynamicBothDateRange {
  readonly type: 'dynamic-both';
  readonly min: 'DYNAMIC';
  readonly fallbackMin: ISODateString;
  readonly max: 'DYNAMIC';
  readonly fallbackMax: ISODateString;
  readonly placeholder: string;
  readonly notes: string;
}

/**
 * Ingen dato-afgrænsning (bruges til visse tabel-kolonner)
 */
interface UnconstrainedDateRange {
  readonly type: 'unconstrained';
  readonly min: null;
  readonly max: null;
  readonly placeholder: string;
  readonly notes: string;
}

/**
 * Union af alle dato-range typer
 *
 * Type-systemet sikrer nu at:
 * - 'DYNAMIC' altid har tilhørende fallback
 * - Statiske ranges ikke har unødvendige fallbacks
 * - Ingen afgrænsning er eksplicit modelleret
 */
export type DateRangeConfig =
  | StaticDateRange
  | DynamicMinDateRange
  | DynamicMaxDateRange
  | DynamicBothDateRange
  | UnconstrainedDateRange;

export const TODAY: ISODateString = (() => {
  const result = dateToISO(new Date());
  if (!result) {
    throw new Error('CRITICAL: Could not generate valid TODAY date');
  }
  return result;
})();

// ============================================================================
// GLOBALE VÆRDIER
// ============================================================================

// Minimums-år for arbejdsskadesatser
export const MIN_YEAR: number = 2005;


// Aktuelt år (udledt af dags dato)
export const MAX_YEAR: number = new Date().getFullYear();

const maxIso = (a: ISODateString, b: ISODateString): ISODateString => (a > b ? a : b);

const subtractYearsISO = (isoDate: ISODateString, years: number): ISODateString => {
  const [yearStr, monthStr, dayStr] = isoDate.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);

  const targetYear = year - years;

  const maxDayInTargetMonth = new Date(targetYear, month, 0).getDate();
  const targetDay = Math.min(day, maxDayInTargetMonth);

  const result = `${String(targetYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
  return toISODateString(result);
};

export type SkadesdatoMinBoundKind = 'skadesdato' | 'anmeldedatoMinus5Aar';

export type SkadesdatoMinRule = Readonly<{
  minDate: ISODateString;
  minBoundKind?: SkadesdatoMinBoundKind;
  minBoundReferenceISO?: ISODateString;
}>;

export const computeSkadesdatoMinRule = (args: Readonly<{
  skadesdatoISO: ISODateString | undefined;
  erErhvervssygdom: boolean;
  fallbackMin: ISODateString;
}>): SkadesdatoMinRule => {
  if (!args.skadesdatoISO) {
    return { minDate: args.fallbackMin };
  }

  if (!args.erErhvervssygdom) {
    return {
      minDate: maxIso(args.skadesdatoISO, args.fallbackMin),
      minBoundKind: 'skadesdato',
      minBoundReferenceISO: args.skadesdatoISO,
    };
  }

  const minus5Years = subtractYearsISO(args.skadesdatoISO, 5);
  const bounded = maxIso(maxIso(minus5Years, DATE_2005_01_01), args.fallbackMin);
  return {
    minDate: bounded,
    minBoundKind: 'anmeldedatoMinus5Aar',
    minBoundReferenceISO: args.skadesdatoISO,
  };
};

// ============================================================================
// HJÆLPEFUNKTIONER
// ============================================================================

/**
 * Formaterer en ISO-dato (åååå-mm-dd) til dansk format (dd-mm-åååå)
 *
 * DEPRECATED: Brug isoToDanish fra branded.ts i stedet.
 * Denne funktion bevares kun for bagudkompatibilitet.
 *
 * @deprecated Brug isoToDanish fra '../types/branded' i stedet
 */
export const formatToDanish = (isoDate: string): string => {
  if (!isoDate) return '';

  // Forvent format: åååå-mm-dd
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return '';

  const [, year, month, day] = match;

  // Valider datoen ved hjælp af JavaScript Date
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  const isValid =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);

  if (!isValid) return '';

  return `${day}-${month}-${year}`;
};

/**
 * Formaterer en dansk dato (dd-mm-åååå) til ISO-format (åååå-mm-dd)
 *
 * DEPRECATED: Brug danishToISO fra branded.ts i stedet.
 * Denne funktion bevares kun for bagudkompatibilitet.
 *
 * @deprecated Brug danishToISO fra '../types/branded' i stedet
 */
export const formatToISO = (danishDate: string): string => {
  if (!danishDate) return '';

  // Forvent format: dd-mm-åååå
  const match = danishDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (!match) return '';

  const [, day, month, year] = match;

  // Valider datoen ved hjælp af JavaScript Date
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  const isValid =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);

  if (!isValid) return '';

  return `${year}-${month}-${day}`;
};

// ============================================================================
// STAMDATA-SIDEN
// ============================================================================

/**
 * Dato-intervaller for Stamdata-siden
 */
export interface DateRanges_Stamdata {
  readonly skadesdato: StaticDateRange;
}

export const dateRanges_stamdata: DateRanges_Stamdata = {
  // Skadesdato / Anmeldelsesdato
  // (Label er dynamisk: "Skadesdato" hvis type er 'Arbejdsulykke', "Anmeldelsesdato" hvis 'Erhvervssygdom')
  skadesdato: {
    type: 'static',
    min: DATE_2005_01_01,
    max: TODAY,
    placeholder: 'dd-mm-åååå',
    notes: 'Fra 1. januar 2005 til i dag'
  },
};

// ============================================================================
// ERSTATNINGSOPGØRELSE-SIDEN
// ============================================================================

/**
 * Dato-intervaller for Erstatningsopgørelse-siden
 */
export interface DateRanges_Erstatningsopgoerelse {
  readonly periodeFra: DynamicMaxDateRange;
  readonly periodeTil: DynamicMinDateRange;
  readonly opgoerelse: StaticDateRange;
  readonly forligDato: DynamicMinDateRange;
  readonly menAfgoerelseDato: DynamicMinDateRange;
  readonly midlertidigEETAfgoerelseDato: DynamicMinDateRange;
  readonly midlertidigEETVirkningsdato: DynamicMinDateRange;
  readonly endeligEETAfgoerelseDato: DynamicMinDateRange;
  readonly endeligEETVirkningsdato: DynamicMinDateRange;
  readonly differencekravDato: DynamicMinDateRange;
  readonly tabelSvieSmerteFra: DynamicBothDateRange;
  readonly tabelSvieSmerteTil: DynamicMinDateRange;
  readonly tabelTAFFra: DynamicBothDateRange;
  readonly tabelTAFTil: DynamicBothDateRange;
  readonly tabelFerieFra: UnconstrainedDateRange;
  readonly tabelFerieTil: UnconstrainedDateRange;
  readonly tabelOevrigeKravDato: DynamicMinDateRange;
}

export const dateRanges_erstatningsopgoerelse: DateRanges_Erstatningsopgoerelse = {
  // Vedrører perioden (fra-felt)
  periodeFra: {
    type: 'dynamic-max',
    min: DATE_2005_01_01,
    max: 'DYNAMIC', // Den laveste værdi af: values.vedroererPeriodeTil (hvis udfyldt) eller fallbackMax
    fallbackMax: DATE_2030_12_31,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både fast min-værdi (1-1-2005) OG dynamisk max-værdi (indtastet "til og med" dato)'
  },

  // til og med (til-felt)
  periodeTil: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: values.vedroererPeriodeFra (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: DATE_2030_12_31,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både dynamisk min-værdi (indtastet fra-dato) OG fast max-værdi (31-12-2030)'
  },

  // Opgørelse lavet den
  opgoerelse: {
    type: 'static',
    min: DATE_2025_01_01,
    max: TODAY,
    placeholder: 'dd-mm-åååå',
    notes: 'Fra 1. januar 2025 til i dag'
  },

  // Evt. dato for forlig
  forligDato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadesdato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både dynamisk min-værdi (indtastet skadesdato fra Stamdata) OG fast max-værdi (i dag)'
  },

  // Dato for første ménafgørelse
  menAfgoerelseDato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadesdato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både dynamisk min-værdi (indtastet skadesdato fra Stamdata) OG fast max-værdi (i dag)'
  },

  // Dato for første midlertidige erhvervsevnetabsafgørelse
  midlertidigEETAfgoerelseDato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadesdato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både dynamisk min-værdi (indtastet skadesdato fra Stamdata) OG fast max-værdi (i dag)'
  },

  // Virkningsdato for midlertidig EET (hvis forskellig fra afgørelsesdatoen)
  midlertidigEETVirkningsdato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadesdato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: DATE_2030_12_31,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både dynamisk min-værdi (indtastet skadesdato fra Stamdata) OG fast max-værdi (31-12-2030)'
  },

  // Dato for endelig erhvervsevnetabsafgørelse
  endeligEETAfgoerelseDato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadesdato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både dynamisk min-værdi (indtastet skadesdato fra Stamdata) OG fast max-værdi (i dag)'
  },

  // Virkningsdato for endelig EET (hvis forskellig fra afgørelsesdatoen)
  endeligEETVirkningsdato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadesdato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: DATE_2030_12_31,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både dynamisk min-værdi (indtastet skadesdato fra Stamdata) OG fast max-værdi (31-12-2030)'
  },

  // Evt. differencekrav opgjort per
  differencekravDato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadesdato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både dynamisk min-værdi (indtastet skadesdato fra Stamdata) OG fast max-værdi (i dag)'
  },

  // Tabel: Svie og smerte - kolonne "Fra o.m."
  tabelSvieSmerteFra: {
    type: 'dynamic-both',
    min: 'DYNAMIC', // Den højeste værdi af: skadesdato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: 'DYNAMIC', // Den laveste værdi af: tilhørende til-dato (hvis udfyldt) eller TODAY
    fallbackMax: TODAY,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både dynamisk min-værdi (skadesdato) OG dynamisk max-værdi (til-dato eller i dag)'
  },

  // Tabel: Svie og smerte - kolonne "Til o.m."
  tabelSvieSmerteTil: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: tilhørende fra-dato (hvis udfyldt) eller skadesdato eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både dynamisk min-værdi (fra-dato eller skadesdato) OG fast max-værdi (i dag)'
  },

  // Tabel: TAF - kolonne "Fra"
  tabelTAFFra: {
    type: 'dynamic-both',
    min: 'DYNAMIC', // Den højeste værdi af: skadesdato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: 'DYNAMIC', // Den laveste værdi af: tilhørende til-dato i samme række (hvis udfyldt), vedroererPeriodeTil (hvis udfyldt) eller fallbackMax
    fallbackMax: DATE_2030_12_31,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både dynamisk min-værdi (skadesdato) OG dynamisk max-værdi (til-dato i samme række eller vedroererPeriodeTil)'
  },

  // Tabel: TAF - kolonne "Til og med"
  tabelTAFTil: {
    type: 'dynamic-both',
    min: 'DYNAMIC', // Den højeste værdi af: tilhørende fra-dato i samme række (hvis udfyldt), skadesdato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: 'DYNAMIC', // Den laveste værdi af: vedroererPeriodeTil (hvis udfyldt) eller fallbackMax
    fallbackMax: DATE_2030_12_31,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både dynamisk min-værdi (fra-dato i samme række eller skadesdato) OG dynamisk max-værdi (vedroererPeriodeTil)'
  },

  // Tabel: Ferie - kolonne "Optjeningsår fra"
  tabelFerieFra: {
    type: 'unconstrained',
    min: null,
    max: null,
    placeholder: 'dd-mm-åååå',
    notes: 'Ingen afgrænsninger'
  },

  // Tabel: Ferie - kolonne "Optjeningsår til"
  tabelFerieTil: {
    type: 'unconstrained',
    min: null,
    max: null,
    placeholder: 'dd-mm-åååå',
    notes: 'Ingen afgrænsninger'
  },

  // Tabel: Øvrige krav - kolonne "Dato"
  tabelOevrigeKravDato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadesdato (hvis skadestype ikke er erhvervssygdom og skadesdato udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både dynamisk min-værdi (skadesdato hvis ikke erhvervssygdom) OG fast max-værdi (i dag)'
  },
};

// ============================================================================
// OFFENTLIGE YDELSER (ERSTATNINGSOPGØRELSE)
// ============================================================================

/**
 * Dato-intervaller for Offentlige ydelser-tabel
 */
export interface DateRanges_OffentligeYdelser {
  readonly fraDato: DynamicMaxDateRange;
  readonly tilDato: DynamicMinDateRange;
}

export const dateRanges_offentligeYdelser: DateRanges_OffentligeYdelser = {
  fraDato: {
    type: 'dynamic-max',
    min: DATE_2005_01_01,
    max: 'DYNAMIC', // Den laveste værdi af: tilDato (hvis udfyldt) eller fallbackMax
    fallbackMax: TODAY,
    placeholder: 'dd-mm-åååå',
    notes: 'Fra 1. januar 2005 til tilDato (eller i dag)',
  },
  tilDato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: fraDato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: DATE_2030_12_31,
    placeholder: 'dd-mm-åååå',
    notes: 'Fra fraDato (eller 1. januar 2005) til 31. december 2030',
  },
};

// ============================================================================
// VARIGE MÉN-SIDEN
// ============================================================================
// Dags dato (beregnes dynamisk, valideret som ISODateString)


export interface DateRanges_VarigeMen {
  readonly fodselsdato: StaticDateRange;
  readonly beregningsdato: DynamicMinDateRange;
}

export const dateRanges_varigemen: DateRanges_VarigeMen = {
  fodselsdato: {
    type: 'static',
    min: DATE_1900_01_01,
    max: TODAY,
    placeholder: 'dd-mm-åååå',
    notes: 'Fra 1. januar 1900 til i dag',
  },
  beregningsdato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Højeste af: skadesdato fra Stamdata eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: DATE_2026_12_31,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod dynamisk min-værdi (skadesdato) og fast max-værdi (31-12-2025)',
  },
};

// ============================================================================
// ÅRSLØN-SIDEN
// ============================================================================

/**
 * Dato-intervaller for Årsløn-siden
 */
export interface DateRanges_Aarsloen {
  readonly tabelAarsloenFra: DynamicMaxDateRange;
  readonly tabelAarsloenTil: DynamicMinDateRange;
}

export const dateRanges_aarsloen: DateRanges_Aarsloen = {
  // Tabel: Årsløn - kolonne "Fra"
  tabelAarsloenFra: {
    type: 'dynamic-max',
    min: DATE_2005_01_01,
    max: 'DYNAMIC', // Den laveste værdi af: tilhørende til-dato-celle (hvis udfyldt) eller fallbackMax
    fallbackMax: DATE_2025_12_31,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både fast min-værdi (1-1-2005) OG dynamisk max-værdi (indtastet til-dato i samme række)'
  },

  // Tabel: Årsløn - kolonne "Til"
  tabelAarsloenTil: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: tilhørende fra-dato-celle (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: DATE_2025_12_31,
    placeholder: 'dd-mm-åååå',
    notes: 'Valideres mod både dynamisk min-værdi (indtastet fra-dato i samme række) OG fast max-værdi (31-12-2025)'
  },
};

// ============================================================================
// RENTEBEREGNING-SIDEN
// ============================================================================

/**
 * Dato-intervaller for Renteberegning-siden
 */
export interface DateRanges_Renteberegning {
  readonly renteTil: StaticDateRange;
}

export const dateRanges_renteberegning: DateRanges_Renteberegning = {
  // Rente beregnes til og med
  renteTil: {
    type: 'static',
    min: DATE_2005_01_01,
    max: DATE_2030_12_31,
    placeholder: 'dd-mm-åååå',
    notes: 'Fra 1. januar 2005 til 31. december 2030'
  },
};

// ============================================================================
// SAMLET DATERANGES OBJEKT (til bagudkompatibilitet)
// ============================================================================

/**
 * Dato-intervaller organiseret efter sider
 *
 * VIGTIGT: Dette objekt dokumenterer ALLE datofelter i MINEO.
 * - Alle felter er type-safe med kendte keys
 * - 'DYNAMIC' ranges har altid påkrævet fallback
 * - Statiske ranges er validerede ISODateString
 */
export interface DateRanges {
  readonly stamdata: DateRanges_Stamdata;
  readonly erstatningsopgoerelse: DateRanges_Erstatningsopgoerelse;
  readonly varigemen: DateRanges_VarigeMen;
  readonly aarsloen: DateRanges_Aarsloen;
  readonly renteberegning: DateRanges_Renteberegning;
}

export const dateRanges: DateRanges = {
  stamdata: dateRanges_stamdata,
  erstatningsopgoerelse: dateRanges_erstatningsopgoerelse,
  varigemen: dateRanges_varigemen,
  aarsloen: dateRanges_aarsloen,
  renteberegning: dateRanges_renteberegning,
};
