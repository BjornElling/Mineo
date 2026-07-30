import { endOfYearIso, isoYear, maxISO, startOfYearIso } from '../utils/isoDateHelpers';
/**
 * Central konfiguration af dato-afgrænsninger for Mineo
 *
 * ÅRLIG OPDATERING:
 * Opdater DATE_2005_01_01 hvis der tilføjes ældre arbejdsskadesatser — MIN_YEAR udledes automatisk
 */

import type { ISODateString } from '../types/branded';
import { toISODateString } from '../types/branded';
import { getTodayLocalISO } from '../utils/dateUtils';
import { svieSmerteMaxYearBounds, eetYearBounds, foersoergertabYearBounds, varigeMenPrGradYearBounds } from '../data/lovbestemteRates';
import { MIN_INTEREST_DATE } from '../data/interestRates';
import { SYGEDAGPENGE_INSERT_MAX_DATE, SYGEDAGPENGE_INSERT_MIN_DATE } from '../data/sygedagpengeRates';

// ============================================================================
// KONSTANTER (VALIDEREDE ISO-DATOER)
// ============================================================================

// Hjælpefunktion til at skabe validerede konstante datoer
const iso = (date: string): ISODateString => toISODateString(date);

// Statiske datoer
const DATE_1900_01_01 = iso('1900-01-01'); // Min for fødselsdato-felter
const DATE_2005_01_01 = iso('2005-01-01'); // Systemets nedre grænse — bruges som min/fallbackMin for alle dynamiske dato-felter
// STORE_BEDEDAG_START og øvrige indskudte lønregulerings-tillæg bor i `src/data/indskudteLoentillaeg.ts`.

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Bemærk: intervallerne bærer IKKE en `placeholder`. Feltets formvejledning (`dd-mm-åååå`) ejes af
// dato-feltfamilien (`fieldFormatPlaceholders.ts`), og grænserne her hører i feltets issue/tooltip.
// De 33 `placeholder: 'dd-mm-åååå'`-felter, der tidligere stod her, blev læst af INGEN kode — kun af to
// `toBeTruthy()`-tests — og gav indtryk af, at intervallet var placeholderens kilde.

/**
 * Statisk dato-range med kendte værdier
 */
interface StaticDateRange {
  readonly type: 'static';
  readonly min: ISODateString;
  readonly max: ISODateString;
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
  readonly notes: string;
}

interface DynamicMaxDateRange {
  readonly type: 'dynamic-max';
  readonly min: ISODateString;
  readonly max: 'DYNAMIC';
  readonly fallbackMax: ISODateString;
  readonly notes: string;
}

interface DynamicBothDateRange {
  readonly type: 'dynamic-both';
  readonly min: 'DYNAMIC';
  readonly fallbackMin: ISODateString;
  readonly max: 'DYNAMIC';
  readonly fallbackMax: ISODateString;
  readonly notes: string;
}

/**
 * Ingen dato-afgrænsning (bruges til visse tabel-kolonner)
 */
interface UnconstrainedDateRange {
  readonly type: 'unconstrained';
  readonly min: null;
  readonly max: null;
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
export const TODAY: ISODateString = getTodayLocalISO();

// ============================================================================
// GLOBALE VÆRDIER
// ============================================================================

// Minimums-år — udledt af DATE_2005_01_01 (systemets nedre datogrænse)
export const MIN_YEAR: number = isoYear(DATE_2005_01_01);

// Aktuelt år (udledt af dags dato)
export const CURRENT_YEAR: number = isoYear(TODAY);

// 31. december i aktuelt år (udledt af dags dato)
const DATE_CURRENT_YEAR_END = endOfYearIso(CURRENT_YEAR);

// 31. december 1 år frem fra aktuelt år (udledt af dags dato)
const DATE_PLUS_1_YEAR_END = endOfYearIso(CURRENT_YEAR + 1);

// 31. december 5 år frem fra aktuelt år (udledt af dags dato)
const DATE_PLUS_5_YEARS_END = endOfYearIso(CURRENT_YEAR + 5);

// Seneste år med komplet EET-datadækning — sats-intersection capped af
// kapitaliseringsbekendtgørelses-oversigtens seneste fælles gyldighedsår.
const DATE_EET_MAX = endOfYearIso(eetYearBounds.maxYear);

// Seneste år med komplet forsørgertab-datadækning — inkluderer foersoergertabEalMin
// ud over EET-satserne, capped af kapitaliseringsbekendtgørelsesoversigtens seneste år.
const DATE_FORSOERGERTAB_MAX = endOfYearIso(foersoergertabYearBounds.maxYear);

// Tidligste år med svie/smerte-sats til UI-årsvælgeren i EO.
// Autoritativ kilde er svieSmerteMaxYearBounds (samme minYear som svieSmertePrDag i aktuelle datasæt).
// Validatoren håndhæver datadækning via satserAngivAarYearBounds.
export const MIN_SVIESMERTE_YEAR: number = svieSmerteMaxYearBounds.minYear;

const subtractYearsISO = (isoDate: ISODateString, years: number): ISODateString => {
  const [yearStr, monthStr, dayStr] = isoDate.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);

  const targetYear = year - years;

  const maxDayInTargetMonth = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  const targetDay = Math.min(day, maxDayInTargetMonth);

  const result = `${String(targetYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
  return toISODateString(result);
};

export type SkadedatoMinBoundKind = 'skadedato' | 'anmeldedatoMinus5Aar';

export type SkadedatoMinRule = Readonly<{
  minDate: ISODateString;
  minBoundKind?: SkadedatoMinBoundKind;
  minBoundReferenceISO?: ISODateString;
}>;

export const computeSkadedatoMinRule = (args: Readonly<{
  skadedatoISO: ISODateString | undefined;
  erErhvervssygdom: boolean;
  fallbackMin: ISODateString;
}>): SkadedatoMinRule => {
  if (!args.skadedatoISO) {
    return { minDate: args.fallbackMin };
  }

  if (!args.erErhvervssygdom) {
    return {
      minDate: maxISO(args.skadedatoISO, args.fallbackMin),
      minBoundKind: 'skadedato',
      minBoundReferenceISO: args.skadedatoISO,
    };
  }

  const minus5Years = subtractYearsISO(args.skadedatoISO, 5);
  const bounded = maxISO(maxISO(minus5Years, DATE_2005_01_01), args.fallbackMin);
  return {
    minDate: bounded,
    minBoundKind: 'anmeldedatoMinus5Aar',
    minBoundReferenceISO: args.skadedatoISO,
  };
};

// ============================================================================
// STAMDATA-SIDEN
// ============================================================================

/**
 * Dato-intervaller for Stamdata-siden
 */
export interface DateRanges_Stamdata {
  readonly skadedato: StaticDateRange;
}

export const dateRanges_stamdata: DateRanges_Stamdata = {
  // Skadedato / Anmeldelsesdato
  // (Label er dynamisk: "Skadedato" hvis type er 'Arbejdsulykke', "Anmeldelsesdato" hvis 'Erhvervssygdom')
  skadedato: {
    type: 'static',
    min: DATE_2005_01_01,
    max: TODAY,
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
  readonly opgoerelse: DynamicMinDateRange;
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
    fallbackMax: DATE_PLUS_1_YEAR_END,
    notes: 'Valideres mod både fast min-værdi (1-1-2005) OG dynamisk max-værdi (indtastet "til og med" dato)'
  },

  // til og med (til-felt)
  periodeTil: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: values.vedroererPeriodeFra (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: DATE_PLUS_1_YEAR_END,
    notes: 'Valideres mod både dynamisk min-værdi (indtastet fra-dato) OG fast max-værdi (31-12 ét år frem)'
  },

  // Opgørelse lavet den
  opgoerelse: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadedato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    notes: 'Valideres mod dynamisk min-værdi (skadedato) OG fast max-værdi (i dag)'
  },

  // Evt. dato for forlig
  forligDato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadedato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    notes: 'Valideres mod både dynamisk min-værdi (indtastet skadedato fra Stamdata) OG fast max-værdi (i dag)'
  },

  // Dato for første ménafgørelse
  menAfgoerelseDato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadedato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    notes: 'Valideres mod både dynamisk min-værdi (indtastet skadedato fra Stamdata) OG fast max-værdi (i dag)'
  },

  // Dato for første midlertidige erhvervsevnetabsafgørelse
  midlertidigEETAfgoerelseDato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadedato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    notes: 'Valideres mod både dynamisk min-værdi (indtastet skadedato fra Stamdata) OG fast max-værdi (i dag)'
  },

  // Virkningsdato for midlertidig EET (hvis forskellig fra afgørelsesdatoen)
  midlertidigEETVirkningsdato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadedato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: DATE_PLUS_1_YEAR_END,
    notes: 'Valideres mod både dynamisk min-værdi (indtastet skadedato fra Stamdata) OG fast max-værdi (31-12 ét år frem)'
  },

  // Dato for endelig erhvervsevnetabsafgørelse
  endeligEETAfgoerelseDato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadedato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    notes: 'Valideres mod både dynamisk min-værdi (indtastet skadedato fra Stamdata) OG fast max-værdi (i dag)'
  },

  // Virkningsdato for endelig EET (hvis forskellig fra afgørelsesdatoen)
  endeligEETVirkningsdato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadedato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: DATE_PLUS_1_YEAR_END,
    notes: 'Valideres mod både dynamisk min-værdi (indtastet skadedato fra Stamdata) OG fast max-værdi (31-12 ét år frem)'
  },

  // Evt. differencekrav opgjort per
  differencekravDato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadedato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    notes: 'Valideres mod både dynamisk min-værdi (indtastet skadedato fra Stamdata) OG fast max-værdi (i dag)'
  },

  // Tabel: Svie og smerte - kolonne "Fra o.m."
  tabelSvieSmerteFra: {
    type: 'dynamic-both',
    min: 'DYNAMIC', // Den højeste værdi af: skadedato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: 'DYNAMIC', // Den laveste værdi af: tilhørende til-dato (hvis udfyldt) eller TODAY
    fallbackMax: TODAY,
    notes: 'Valideres mod både dynamisk min-værdi (skadedato) OG dynamisk max-værdi (til-dato eller i dag)'
  },

  // Tabel: Svie og smerte - kolonne "Til o.m."
  tabelSvieSmerteTil: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: tilhørende fra-dato (hvis udfyldt) eller skadedato eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    notes: 'Valideres mod både dynamisk min-værdi (fra-dato eller skadedato) OG fast max-værdi (i dag)'
  },

  // Tabel: TAF - kolonne "Fra"
  tabelTAFFra: {
    type: 'dynamic-both',
    min: 'DYNAMIC', // Den højeste værdi af: skadedato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: 'DYNAMIC', // Den laveste værdi af: tilhørende til-dato i samme række (hvis udfyldt), vedroererPeriodeTil (hvis udfyldt) eller fallbackMax
    fallbackMax: DATE_PLUS_1_YEAR_END,
    notes: 'Valideres mod både dynamisk min-værdi (skadedato) OG dynamisk max-værdi (til-dato i samme række eller vedroererPeriodeTil)'
  },

  // Tabel: TAF - kolonne "Til og med"
  tabelTAFTil: {
    type: 'dynamic-both',
    min: 'DYNAMIC', // Den højeste værdi af: tilhørende fra-dato i samme række (hvis udfyldt), skadedato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: 'DYNAMIC', // Den laveste værdi af: vedroererPeriodeTil (hvis udfyldt) eller fallbackMax
    fallbackMax: DATE_PLUS_1_YEAR_END,
    notes: 'Valideres mod både dynamisk min-værdi (fra-dato i samme række eller skadedato) OG dynamisk max-værdi (vedroererPeriodeTil)'
  },

  // Tabel: Ferie - kolonne "Optjeningsår fra"
  tabelFerieFra: {
    type: 'unconstrained',
    min: null,
    max: null,
    notes: 'Ingen afgrænsninger'
  },

  // Tabel: Ferie - kolonne "Optjeningsår til"
  tabelFerieTil: {
    type: 'unconstrained',
    min: null,
    max: null,
    notes: 'Ingen afgrænsninger'
  },

  // Tabel: Øvrige krav - kolonne "Dato"
  tabelOevrigeKravDato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: skadedato (hvis skadestype ikke er erhvervssygdom og skadedato udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: TODAY,
    notes: 'Valideres mod både dynamisk min-værdi (skadedato hvis ikke erhvervssygdom) OG fast max-værdi (i dag)'
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
    min: SYGEDAGPENGE_INSERT_MIN_DATE,
    max: 'DYNAMIC', // Den laveste værdi af: tilDato (hvis udfyldt) eller fallbackMax
    fallbackMax: SYGEDAGPENGE_INSERT_MAX_DATE,
    notes: 'Fra den seneste af de tidligste fra-datoer for sygedagpenge og ATP til tilDato (eller den tidligste fælles slutdato). Disse tabelgrænser gælder hele Offentlige ydelser-tabellen, fordi sygedagpenge-hjælperen kræver fælles satsdækning i hele intervallet.',
  },
  tilDato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: fraDato (hvis udfyldt) eller fallbackMin
    fallbackMin: SYGEDAGPENGE_INSERT_MIN_DATE,
    max: SYGEDAGPENGE_INSERT_MAX_DATE,
    notes: 'Fra fraDato (eller den seneste af de tidligste fra-datoer for sygedagpenge og ATP) til den tidligste fælles slutdato. Valget er bevidst fælles for hele tabellen og ikke kun sygedagpenge-hjælperen.',
  },
};


// ============================================================================
// FORSØRGERTAB-SIDEN
// ============================================================================

export interface DateRanges_Forsoergertab {
  readonly efterladteFodselsdato: StaticDateRange;
  readonly beregningsdato: DynamicMinDateRange;
  readonly virkningsdato: DynamicMinDateRange;
}

export const dateRanges_forsoergertab: DateRanges_Forsoergertab = {
  efterladteFodselsdato: {
    type: 'static',
    min: DATE_1900_01_01,
    max: TODAY,
    notes: 'Fra 1. januar 1900 til i dag.',
  },
  beregningsdato: {
    type: 'dynamic-min',
    min: 'DYNAMIC',
    fallbackMin: DATE_2005_01_01,
    max: DATE_FORSOERGERTAB_MAX,
    notes: 'Valideres mod dynamisk min-værdi (højeste af skadedato og virkningsdato) og fast max-værdi (31-12 i seneste år med komplet forsørgertab-datadækning).',
  },
  virkningsdato: {
    type: 'dynamic-min',
    min: 'DYNAMIC',
    fallbackMin: DATE_2005_01_01,
    max: DATE_FORSOERGERTAB_MAX,
    notes: 'Valideres mod dynamisk min-værdi (skadedato) og dynamisk max-værdi (laveste af forsørgertab-max og beregningsdato).',
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
    fallbackMax: DATE_CURRENT_YEAR_END,
    notes: 'Valideres mod både fast min-værdi (1-1-2005) OG dynamisk max-værdi (indtastet til-dato i samme række)'
  },

  // Tabel: Årsløn - kolonne "Til"
  tabelAarsloenTil: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Den højeste værdi af: tilhørende fra-dato-celle (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: DATE_CURRENT_YEAR_END,
    notes: 'Valideres mod både dynamisk min-værdi (indtastet fra-dato i samme række) OG fast max-værdi (31-12 i aktuelt år)'
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
  // Beregningsdato for renteberegning
  renteTil: {
    type: 'static',
    min: MIN_INTEREST_DATE,
    max: DATE_PLUS_5_YEARS_END,
    notes: 'Fra tidligste referencesats-dato til 31. december 5 år frem fra aktuelt år'
  },
};

// ============================================================================
// VARIGE MÉN-SIDEN
// ============================================================================

/**
 * Dato-intervaller for Varige mén-siden
 */
export interface DateRanges_VarigeMen {
  readonly beregningsdato: StaticDateRange;
}

export const dateRanges_varigemen: DateRanges_VarigeMen = {
  // Beregningsdato for méngodtgørelse — afgrænset af det år-interval, der har
  // varige-mén-sats-dækning (varigeMenPrGradYearBounds). Statisk, fordi grænserne
  // kun afhænger af satsdatasættet og ikke af andet brugerinput.
  beregningsdato: {
    type: 'static',
    min: startOfYearIso(varigeMenPrGradYearBounds.minYear),
    max: endOfYearIso(varigeMenPrGradYearBounds.maxYear),
    notes: 'Fra 1. januar i tidligste år med méngrad-sats til 31. december i seneste år med méngrad-sats.',
  },
};

// ============================================================================
// DELT DATOINTERVAL — SKADELIDTES FØDSELSDATO
// Bruges på alle sider der viser dette felt (EET, Forsørgertab, Varige mén).
// ============================================================================

export const dateRanges_skadelidteFodselsdato: StaticDateRange = {
  type: 'static',
  min: DATE_1900_01_01,
  max: TODAY,
  notes: 'Fra 1. januar 1900 til i dag.',
};

// ============================================================================
// ERHVERVSEVNETAB-SIDEN
// ============================================================================

export interface DateRanges_Erhvervsevnetab {
  readonly skadelidteFodselsdato: StaticDateRange;
  readonly beregningsdato: DynamicMinDateRange;
  readonly tabelAfgoerelsesdato: DynamicMinDateRange;
  readonly tabelVirkningsdato: DynamicMinDateRange;
  readonly tabelKapitaliseringsdato: DynamicMinDateRange;
  readonly tabelTidlKapitaliseringsdato: DynamicBothDateRange;
}

export const dateRanges_erhvervsevnetab: DateRanges_Erhvervsevnetab = {
  skadelidteFodselsdato: dateRanges_skadelidteFodselsdato,
  // Beregningsdato (fane 1 stamdata-boks)
  beregningsdato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Højeste af: skadedato fra Stamdata eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: DATE_EET_MAX,
    notes: 'Valideres mod dynamisk min-værdi (skadedato) og fast max-værdi (31-12 i seneste år med komplet EET-datadækning)',
  },
  // ASL afgørelser tabel – kolonne 1: Afgørelsesdato
  tabelAfgoerelsesdato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Højeste af: skadedato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: DATE_EET_MAX,
    notes: 'Valideres mod dynamisk min-værdi (skadedato) og fast max-værdi (DATE_EET_MAX). Beregningsdato kan sænke max yderligere i tabelkomponenten.',
  },
  // ASL afgørelser tabel – kolonne 2: Virkningsdato
  tabelVirkningsdato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Højeste af: skadedato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: DATE_EET_MAX,
    notes: 'Valideres mod dynamisk min-værdi (skadedato) og fast max-værdi (DATE_EET_MAX). Beregningsdato kan sænke max yderligere i tabelkomponenten.',
  },
  // ASL afgørelser tabel – kolonne 4: Kapitaliseringsdato
  tabelKapitaliseringsdato: {
    type: 'dynamic-min',
    min: 'DYNAMIC', // Højeste af: skadedato (hvis udfyldt) eller fallbackMin
    fallbackMin: DATE_2005_01_01,
    max: DATE_EET_MAX,
    notes: 'Valideres mod dynamisk min-værdi (skadedato) og fast max-værdi (31-12 i seneste år med komplet EET-datadækning). Beregningsdato kan sænke max yderligere i tabelkomponenten.',
  },
  // ASL afgørelser tabel – kolonne 7: Evt. tidl. kap.dato
  tabelTidlKapitaliseringsdato: {
    type: 'dynamic-both',
    min: 'DYNAMIC',
    fallbackMin: DATE_2005_01_01,
    max: 'DYNAMIC',
    fallbackMax: DATE_EET_MAX,
    notes: 'Min styres dynamisk af skadedato. Max styres dynamisk af dagen før afgørelsesdato i den konkrete tabelrække.',
  },
};
