import type { ISODateString } from '../../types/branded';
import { danishToISO, dateToISO, isoToDanish, isISODateString, parseISODate, subtractOneDay } from '../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues, SvieSmertePeriodeRow, TafPeriodeRow, OevrigeKravRow } from '../../schemas/formSchemas';
import { erstatningsopgoerelseSchema, stamdataSchema } from '../../schemas/formSchemas';
import { svieSmerteMax, svieSmertePrDag, aarsloenMax } from '../../data/regulationRates';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { calculateAarsloenRowDerived, isAarsloenRowEffectivelyEmpty } from '../../utils/aarsloenTableCalculations';
import { formatPercent, parsePercentToDecimal, roundHalfAwayFromZero } from '../../utils/formatUtils';
import { buildIncomeForRanges, buildTafRanges, parseAarsloenRowInterval, type IsoRange } from './indtaegtPerioder';
import { calculateTafAntalMaaneder } from './tafCalculations';
import { calculateTafArbejdsdageBreakdown } from './tafCalculations';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from './tafBeregningsenhed';
import { beregnArbejdsdageOgMaaneder } from './arbejdsdageMaaneder';
import { computeSkadesdatoMinRule, dateRanges_erstatningsopgoerelse } from '../../config/dateRanges';
import { computeRowDateBounds } from './rowDateBounds';
import { validateISODateRange } from '../../utils/dateValidation';
import { detectOverlappingPeriods } from './periodOverlapDetection';
import { countInclusiveUtcDays } from '../../utils/utcDayMath';
import { isoDateToDate } from '../dates/isoDate';
import { createDate } from '../../utils/dateUtils';
import { isOevrigeKravRowEmpty, isSvieSmerteRowEmpty, isTafRowEmpty } from './rowEmpty';
import { beregnHelligdage } from '../../utils/shDageBeregning';
import { LOEN_PAA_HELLIGDAGE } from '../../types/common';
import { getEffektiveSatserForDato, getEffektiveSatserForPeriode, resolveOverenskomstRef, getOffentligOverenskomstTypeById } from '../../data/overenskomstRates';
import { getOffentligLoenForDato, getOffentligLoenForPeriode } from '../../data/offentligLoenLookup';
import {
  resolveOffentligLoenTypeFromLabel,
  toLoentrin,
  type OffentligOverenskomstType,
  type OffentligLoenType,
  type Loengruppe,
  type Loentrin,
} from '../../data/offentligLoenTypes';
import { getStatistiskLoenudvikling, type StatistiskLoenudviklingId } from '../../data/statistiskLoenudviklingRates';
import { getKRLSatstabel, type KRLSatstabelId } from '../../data/KRLrates';
import { clampTafRow, resolveTafConstraintBounds } from './tafPeriodConstraints';
import { erDetteFoersteErstatningsopgoerelse } from './eoNummerValidering';
import { getAarsloenErrorRowIdSet } from './indkomstRowValidation';
import { buildTafArbejdsstatusLinje } from './tafArbejdsstatusConfig';
import { getAngivetLoenBaseretPaa, getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde, type LoenudviklingSource } from './angivetLoenHelpers';
import {
  STORE_BEDEDAG_START,
  STORE_BEDEDAG_PCT,
  resolveReguleringsdato as resolveReguleringsdatoShared,
  resolveStatistikModelId,
  formatDateShort as formatDateShortShared,
  formatDateLong as formatDateLongShared,
  formatPercentFixed2 as formatPercentFixed2Shared,
} from './sharedPdfUtils';

export type MoneyOre = number;

type MoneyKroner = number;

export type Calculable<T> =
  | Readonly<{ status: 'ok'; value: T }>
  | Readonly<{ status: 'not_calculable'; reason: string }>;

export type PdfModel = Readonly<{
  titel: string;
  titelMetadata: string;
  periode: Readonly<{ fra: ISODateString; til: ISODateString }> | null;
  periodeDisplay: string | null;
  skadelidteNavn: string | null;
  skadestypeLinje: string | null;
  brevhoved: Readonly<{
    journalnr?: string;
    advokat?: string;
    sagsbehandler?: string;
    dagsDatoISO: ISODateString;
  }> | null;
  svieSmerte: SvieSmertePdfModel;
  tabtArbejdsfortjeneste: TabtArbejdsfortjenestePdfModel;
  oevrigeKrav: OevrigeKravPdfModel;
  samlet: Readonly<{
    svieSmerteOre: MoneyOre;
    tabtArbejdsfortjenesteOre: MoneyOre;
    oevrigeKravOre: MoneyOre;
    totalOre: MoneyOre;
  }>;
  saerligeKommentarer: string | null;
}>;

export type SvieSmertePdfModel = Readonly<{
  beregnes: boolean;
  statusLinjer: readonly string[];
  opgjortFremTilPeriodeTil: boolean;
  periodeHeading: string;
  periodeLinjer: readonly string[];
  harPerioder: boolean;
  satserAar: number | null;
  satserPerDag: Calculable<MoneyOre>;
  satserMax: Calculable<MoneyOre>;
  forligLabel: string | null;
  tidligere: Calculable<MoneyOre>;
  aktuel: Calculable<MoneyOre>;
  sygedage: number;
  delviseSygedage: number;
  delvisFaktor: 1 | 0.5;
  maxApplied: boolean;
  totalOre: MoneyOre;
}>;

export type TabtArbejdsfortjenestePdfModel = Readonly<{
  statusLinjer: readonly string[];
  eetLinjer: readonly string[];
  differencekravLinje: string | null;
  tafPerioderLinjer: readonly string[];
  harTafPerioder: boolean;
  tafBeregningsenhed: TafBeregningsenhed;
  skalKomprimereIndkomstBeregning: boolean;
  indkomstSkadestidspunkt: IndkomstSkadestidspunktPdfModel | null;
  loenudvikling: LoenudviklingPdfModel | null;
  tafIndtaegter: TafIndtaegterPdfModel | null;
  tabtArbejdsfortjenesteOre: MoneyOre;
}>;

export type IndkomstSkadestidspunktPdfModel = Readonly<{
  beregningsenhed: TafBeregningsenhed;
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'];
  loenBaseretPaa: string | null;
  skadesdato: ISODateString | null;
  periodeTilBeregning: Readonly<{ fra: ISODateString; til: ISODateString }> | null;
  ansaettelserNavne: readonly string[];
  arbejdssteder: readonly {
    navn: string;
    fpLabel: string;
    pensionLabel: string;
    breakdown: Readonly<{
      ferieberetOre: MoneyOre;
      fpFvShSoOre: MoneyOre;
      pensionOre: MoneyOre;
      atpOre: MoneyOre;
      samletOre: MoneyOre;
    }>;
  }[];
  totalBreakdown: Readonly<{
    ferieberetOre: MoneyOre;
    fpFvShSoOre: MoneyOre;
    pensionOre: MoneyOre;
    atpOre: MoneyOre;
    samletOre: MoneyOre;
  }> | null;
  arbejdsdage: number | null;
  maaneder: number | null;
  maanedsloen: Calculable<MoneyOre>;
  dagsloen: Calculable<MoneyOre>;
  beregningsperiodeLabel: string | null;
  beregningsgrundlagMellemregningLabel: string | null;
  beregningsgrundlagMellemregningResultat: string | null;
}>;

export type LoenudviklingSegment =
  | Readonly<{
    kind: 'maaneder';
    fra: ISODateString;
    til: ISODateString;
    maaneder: number;
    maanedsloenOre: MoneyOre;
    deltaPct: number;
    amountOre: MoneyOre;
  }>
  | Readonly<{
    kind: 'arbejdsdage';
    fra: ISODateString;
    til: ISODateString;
    arbejdsdage: number;
    dagsloenOre: MoneyOre;
    deltaPct: number;
    amountOre: MoneyOre;
  }>;

export type LoenudviklingPdfModel = Readonly<{
  loenudviklingLabel: string;
  loenudviklingTotal: Calculable<MoneyOre>;
  beregningsenhed: TafBeregningsenhed;
  beregnedeSegmenter: readonly LoenudviklingSegment[];
}>;

export type TafIndtaegterPdfModel = Readonly<{
  entries: readonly { label: string; amountOre: MoneyOre }[];
  total: Calculable<MoneyOre>;
}>;

export type OevrigeKravPdfModel = Readonly<{
  entries: readonly { dateText: string; udgiftTil: string; amountOre: MoneyOre }[];
  totalOre: MoneyOre;
}>;
export const ensureMoneyOre = (value: number): MoneyOre => {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error('MoneyOre skal være et heltal');
  }
  return value as MoneyOre;
};

// Afrunding til 2 decimaler med "half away from zero" (samme regel på tværs af hele PDF-modellen)
export const roundKroner = (value: number): number => roundHalfAwayFromZero(value, 2);

export const toOre = (value: MoneyKroner): MoneyOre => {
  if (!Number.isFinite(value)) {
    throw new Error('Ugyldigt beløb: ikke et endeligt tal');
  }
  const scaled = value * 100;
  const rounded = Math.round(scaled);
  // Epsilon 1e-4 for at undgå false positives fra floating-point afrunding ved store beløb
  if (Math.abs(scaled - rounded) > 1e-4) {
    throw new Error('Beløb har flere end 2 decimaler');
  }
  return ensureMoneyOre(rounded);
};

const formatPercentFixed2 = formatPercentFixed2Shared;

const asCalculable = <T>(value: T): Calculable<T> => ({ status: 'ok', value });

const notCalculable = <T>(reason: string): Calculable<T> => {
  return { status: 'not_calculable', reason };
};

const notCalculableMoney = (reason: string): Calculable<MoneyOre> => notCalculable<MoneyOre>(reason);

const fromOre = (value: MoneyOre): MoneyKroner => value / 100;

const formatDateShort = formatDateShortShared;

const formatDateLong = formatDateLongShared;

const isoDateToUtcDate = (isoDate: ISODateString): Date => {
  const [yearStr, monthStr, dayStr] = isoDate.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatUtcToIso = (date: Date): ISODateString => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as ISODateString;
};

const addUtcDays = (date: Date, days: number): Date => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const isWeekdayUtc = (date: Date): boolean => {
  const dayOfWeek = date.getUTCDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5;
};

const toNonNegativeInt = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
};

const formatLocalToIso = (date: Date): ISODateString => formatUtcToIso(date);

const buildFerieDageSet = (
  ferieperioder: readonly { fra?: ISODateString; til?: ISODateString }[],
  datoSet: ReadonlySet<ISODateString>
): Set<ISODateString> => {
  const ferieDageSet = new Set<ISODateString>();
  for (const periode of ferieperioder) {
    if (!periode.fra || !periode.til) continue;
    if (periode.fra > periode.til) continue;
    const ferieFra = isoDateToUtcDate(periode.fra);
    const ferieTil = isoDateToUtcDate(periode.til);
    let ferieCurrent = new Date(ferieFra);
    while (ferieCurrent <= ferieTil) {
      const isoStr = formatUtcToIso(ferieCurrent);
      if (datoSet.has(isoStr) && isWeekdayUtc(ferieCurrent)) {
        ferieDageSet.add(isoStr);
      }
      ferieCurrent = addUtcDays(ferieCurrent, 1);
    }
  }
  return ferieDageSet;
};

const buildShDageSet = (
  fraDate: Date,
  tilDate: Date,
  datoSet: ReadonlySet<ISODateString>
): Set<ISODateString> => {
  const shDageSet = new Set<ISODateString>();
  for (let year = fraDate.getUTCFullYear(); year <= tilDate.getUTCFullYear(); year += 1) {
    const helligdage = beregnHelligdage(year);
    for (const helligdag of helligdage) {
      const isoStr = formatLocalToIso(helligdag);
      const dow = helligdag.getUTCDay();
      const erHverdag = dow >= 1 && dow <= 5;
      if (erHverdag && datoSet.has(isoStr)) {
        shDageSet.add(isoStr);
      }
    }
  }
  return shDageSet;
};

const collectTafArbejdsdageForRange = (
  fra: ISODateString,
  til: ISODateString,
  ferieperioder: readonly { fra?: ISODateString; til?: ISODateString }[],
  loseFeriedage: number
): Set<ISODateString> => {
  const fraDate = isoDateToUtcDate(fra);
  const tilDate = isoDateToUtcDate(til);

  const datoSet = new Set<ISODateString>();
  let currentDate = new Date(fraDate);
  while (currentDate <= tilDate) {
    datoSet.add(formatUtcToIso(currentDate));
    currentDate = addUtcDays(currentDate, 1);
  }

  const ferieDageSet = buildFerieDageSet(ferieperioder, datoSet);
  const shDageSet = buildShDageSet(fraDate, tilDate, datoSet);
  const blockedLoseFerie = new Set<ISODateString>([...ferieDageSet, ...shDageSet]);

  const placedLoseFeriedage = new Set<ISODateString>();
  let remainingLoseFeriedage = toNonNegativeInt(loseFeriedage);
  if (remainingLoseFeriedage > 0) {
    let candidate = new Date(fraDate);
    while (candidate <= tilDate && remainingLoseFeriedage > 0) {
      const isoStr = formatUtcToIso(candidate);
      if (isWeekdayUtc(candidate) && !blockedLoseFerie.has(isoStr)) {
        placedLoseFeriedage.add(isoStr);
        remainingLoseFeriedage -= 1;
      }
      candidate = addUtcDays(candidate, 1);
    }
  }

  const arbejdsdage = new Set<ISODateString>();
  for (const isoStr of datoSet) {
    const date = isoDateToUtcDate(isoStr);
    if (!isWeekdayUtc(date)) continue;
    if (ferieDageSet.has(isoStr)) continue;
    if (shDageSet.has(isoStr)) continue;
    if (placedLoseFeriedage.has(isoStr)) continue;
    arbejdsdage.add(isoStr);
  }

  return arbejdsdage;
};

export const buildTafArbejdsdageSet = (values: ErstatningsopgoerelseValues): Set<ISODateString> => {
  const ferieperioder = values.ferieperioder ?? [];
  const rows = values.tafPerioder ?? [];
  const arbejdsdage = new Set<ISODateString>();
  const tafBounds = resolveTafConstraintBounds(values);

  for (const row of rows) {
    if (isTafRowEmpty(row)) continue;
    const clamped = clampTafRow(row, tafBounds);
    if (!clamped) {
      const fra = row.fra;
      const til = row.til;
      if (!fra || !til) {
        throw new Error('TAF-periode mangler fra/til'); // invariant: dækket af validator
      }
      if (!isISODateString(fra) || !isISODateString(til) || fra > til) {
        throw new Error('TAF-periode er ugyldig'); // invariant: dækket af validator
      }
      continue;
    }
    const { fra, til } = clamped;
    if (!fra || !til) {
      throw new Error('TAF-periode mangler fra/til'); // invariant: dækket af validator
    }
    if (!isISODateString(fra) || !isISODateString(til) || fra > til) {
      throw new Error('TAF-periode er ugyldig'); // invariant: dækket af validator
    }
    const loseFeriedage = typeof row.loseFeriedage === 'number' ? row.loseFeriedage : 0;
    const set = collectTafArbejdsdageForRange(fra, til, ferieperioder, loseFeriedage);
    set.forEach((dato) => arbejdsdage.add(dato));
  }

  return arbejdsdage;
};

export const countTafArbejdsdageInRange = (arbejdsdage: ReadonlySet<ISODateString>, fra: ISODateString, til: ISODateString): number => {
  const fraDate = isoDateToUtcDate(fra);
  const tilDate = isoDateToUtcDate(til);
  let count = 0;
  let currentDate = new Date(fraDate);
  while (currentDate <= tilDate) {
    const iso = formatUtcToIso(currentDate);
    if (arbejdsdage.has(iso)) {
      count += 1;
    }
    currentDate = addUtcDays(currentDate, 1);
  }
  return count;
};

const parseForligsgrad = (values: ErstatningsopgoerelseValues): { factor: number | null; label: string | null } => {
  const procentValue = values.forligAnsvarsgradProcent;
  if (typeof procentValue === 'number' && Number.isFinite(procentValue) && procentValue > 0 && procentValue <= 100) {
    return { factor: procentValue / 100, label: ` (forlig på ${procentValue}%)` };
  }

  const broekValue = values.forligAnsvarsgradBroek;
  if (typeof broekValue === 'string' && broekValue.trim() !== '') {
    const match = broekValue.trim().match(/^(\d+)\/(\d+)$/);
    if (match) {
      const taeller = Number.parseInt(match[1], 10);
      const naevner = Number.parseInt(match[2], 10);
      if (taeller > 0 && naevner > 0 && taeller <= naevner) {
        return { factor: taeller / naevner, label: ` (forlig på ${broekValue.trim()})` };
      }
    }
  }

  return { factor: null, label: null };
};

const mergePeriods = (periods: { fra: Date; til: Date }[]): { fra: Date; til: Date }[] => {
  if (periods.length === 0) return [];
  const sorted = [...periods].sort((a, b) => a.fra.getTime() - b.fra.getTime());
  const merged: { fra: Date; til: Date }[] = [];
  let current = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i];
    if (next.fra <= current.til) {
      current = { fra: current.fra, til: next.til > current.til ? next.til : current.til };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);
  return merged;
};

const validateSvieSmertePerioder = (
  values: ErstatningsopgoerelseValues,
  context: Readonly<{
    skadesdatoISO: ISODateString | undefined;
    erErhvervssygdom: boolean;
    menAfgoerelseDatoForTabel: ISODateString | undefined;
    verserendeKlageMen: boolean;
  }>
): SvieSmertePeriodeRow[] => {
  const perioder = values.svieSmertePerioder ?? [];
  const nonEmpty = perioder.filter((row) => !isSvieSmerteRowEmpty(row));
  if (nonEmpty.length === 0) return [];

  const skadesdatoMinRule = computeSkadesdatoMinRule({
    skadesdatoISO: context.skadesdatoISO,
    erErhvervssygdom: context.erErhvervssygdom,
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMin,
  });

  const overlapIds = detectOverlappingPeriods(nonEmpty);

  for (const periode of nonEmpty) {
    const hasFra = typeof periode.fra === 'string' && periode.fra.trim() !== '';
    const hasTil = typeof periode.til === 'string' && periode.til.trim() !== '';
    const hasTilstand = typeof periode.tilstand === 'string' && periode.tilstand.trim() !== '';
    const filledCount = [hasFra, hasTil, hasTilstand].filter(Boolean).length;
    if (filledCount !== 3) {
      throw new Error('Svie/smerte-periode er ikke fuldt udfyldt'); // invariant: dækket af validator
    }

    const fraISO = periode.fra;
    const tilISO = periode.til;
    if (!isISODateString(fraISO) || !isISODateString(tilISO)) {
      throw new Error('Svie/smerte-periode har ugyldig dato'); // invariant: dækket af validator
    }

    const bounds = computeRowDateBounds({
      skadesdatoMinDate: skadesdatoMinRule.minDate,
      rowFra: fraISO,
      rowTil: tilISO,
      fallbackMin: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMin,
      fallbackMax: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMax,
      tilFallbackMax: dateRanges_erstatningsopgoerelse.tabelSvieSmerteTil.max,
      tilExtraMaxDate: context.menAfgoerelseDatoForTabel,
      useTilExtraMaxDate: !context.verserendeKlageMen,
    });

    if (bounds.fra.min > bounds.fra.max || bounds.til.min > bounds.til.max) {
      throw new Error('Svie/smerte-periode har ingen gyldige datoer');
    }

    const fraRange = validateISODateRange(fraISO, bounds.fra.min, bounds.fra.max);
    if (!fraRange.isValid) {
      throw new Error(`Svie/smerte-periode: ${fraRange.errorMessage}`);
    }
    const tilRange = validateISODateRange(tilISO, bounds.til.min, bounds.til.max);
    if (!tilRange.isValid) {
      throw new Error(`Svie/smerte-periode: ${tilRange.errorMessage}`);
    }

    if (overlapIds.has(periode.id)) {
      throw new Error('Svie/smerte-perioder overlapper'); // invariant: dækket af validator
    }
  }

  return nonEmpty;
};
const buildSvieSmerteModel = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues
): SvieSmertePdfModel => {
  const beregnes = values.beregnesSvieSmerteGodtgoerelse === 'Ja';
  const statusLinjer: string[] = [];

  const periodeTilISO = values.vedroererPeriodeTil;

  const varigeMenAfgorelse = values.varigeMenAfgorelse;
  const opgLavetDen = values.opgørelseLavetDen;
  const menDato = values.menAfgoerelseDato;
  const verserendeKlageMen = values.verserendeKlageMen;

  const periodeSynlig = beregnes && values.tidligereSsMax === 'Nej';
  const context = {
    skadesdatoISO: stamdataValues.skadesdato,
    erErhvervssygdom: stamdataValues.skadestype === 'Erhvervssygdom',
    menAfgoerelseDatoForTabel:
      values.varigeMenAfgorelse === 'Ja' ? subtractOneDay(values.menAfgoerelseDato) : undefined,
    verserendeKlageMen: values.verserendeKlageMen === 'Ja',
  };

  const perioder = periodeSynlig ? validateSvieSmertePerioder(values, context) : [];
  const harInputPerioder = perioder.length > 0;

  const vedroererFra = values.vedroererPeriodeFra;
  const vedroererTil = values.vedroererPeriodeTil;
  if (harInputPerioder && (!vedroererFra || !vedroererTil)) {
    throw new Error('Vedrører perioden mangler for svie/smerte'); // invariant: dækket af validator
  }

  const shouldApplyMenCutoff = values.varigeMenAfgorelse === 'Ja' && values.verserendeKlageMen !== 'Ja';
  const menCutoff = shouldApplyMenCutoff ? values.menAfgoerelseDato : undefined;

  const sygemeldtPeriods: { fra: Date; til: Date }[] = [];
  const delvistPeriods: { fra: Date; til: Date }[] = [];

  for (const periode of perioder) {
    if (!periode.fra || !periode.til || !periode.tilstand) continue;
    const fraDate = isoDateToDate(periode.fra);
    const tilDate = isoDateToDate(periode.til);
    if (periode.tilstand === 'delvist-sygemeldt') {
      delvistPeriods.push({ fra: fraDate, til: tilDate });
    } else {
      sygemeldtPeriods.push({ fra: fraDate, til: tilDate });
    }
  }

  const constrained: Array<{ fra: Date; til: Date; isDelvist: boolean }> = [];
  if (harInputPerioder && vedroererFra && vedroererTil) {
    const vedroererFraDate = isoDateToDate(vedroererFra);
    const vedroererTilDate = isoDateToDate(vedroererTil);
    let maxDate = vedroererTilDate;
    const dayBeforeMen = subtractOneDay(menCutoff);
    if (dayBeforeMen) {
      const menDate = isoDateToDate(dayBeforeMen);
      if (menDate < maxDate) maxDate = menDate;
    }

    const applyConstraint = (periods: { fra: Date; til: Date }[], isDelvist: boolean) => {
      const merged = mergePeriods(periods);
      for (const p of merged) {
        const fra = p.fra < vedroererFraDate ? vedroererFraDate : p.fra;
        const til = p.til > maxDate ? maxDate : p.til;
        if (fra > maxDate || til < vedroererFraDate) continue;
        constrained.push({ fra, til, isDelvist });
      }
    };

    applyConstraint(sygemeldtPeriods, false);
    applyConstraint(delvistPeriods, true);
  }

  const harPerioder = constrained.length > 0;
  const periodeHeading =
    constrained.length > 1
      ? 'Sygeperioder, hvor der beregnes svie- og smertegodtgørelse'
      : 'Sygeperiode, hvor der beregnes svie- og smertegodtgørelse';

  constrained.sort((a, b) => a.fra.getTime() - b.fra.getTime());

  const opgjortFremTilPeriodeTil = harPerioder && vedroererTil ? perioderCoverDate(constrained, vedroererTil) : false;

  if (values.svieSmerteHelbredsstatus && periodeTilISO) {
    const dagenEfter = formatDateLong(getDayAfter(periodeTilISO));
    if (values.svieSmerteHelbredsstatus === 'Sygemeldt') {
      statusLinjer.push(`Den ${dagenEfter} var skadelidte fortsat sygemeldt.`);
    } else if (values.svieSmerteHelbredsstatus === 'Delvist Sygemeldt') {
      statusLinjer.push(`Den ${dagenEfter} var skadelidte fortsat delvist sygemeldt.`);
    } else if (values.svieSmerteHelbredsstatus === 'Raskmeldt') {
      statusLinjer.push(
        opgjortFremTilPeriodeTil
          ? `Den ${dagenEfter} blev skadelidte raskmeldt.`
          : `Den ${dagenEfter} var skadelidte raskmeldt.`
      );
    }
  }

  if (varigeMenAfgorelse === 'Nej' && opgLavetDen) {
    const dato = formatDateLong(opgLavetDen);
    const tekst = `Der er den ${dato} ikke truffet afgørelse om varige mén.`;
    statusLinjer.push(verserendeKlageMen === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
  } else if (varigeMenAfgorelse === 'Ja' && menDato) {
    const dato = formatDateLong(menDato);
    const tekst = `Der er den ${dato} truffet afgørelse om varige mén.`;
    statusLinjer.push(verserendeKlageMen === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
  }

  if (varigeMenAfgorelse === 'Ja' && menDato && isISODateString(menDato)) {
    const ophoerDato = subtractOneDay(menDato);
    if (ophoerDato && perioderCoverDate(constrained, ophoerDato)) {
      statusLinjer.push('Afgørelsen bringer retten til svie- og smertegodtgørelse til ophør.');
    }
  }

  const periodeLinjer = constrained.map((p) => {
    const fraISO = dateToISO(p.fra);
    const tilISO = dateToISO(p.til);
    if (!fraISO || !tilISO) throw new Error('Ugyldig periode for svie/smerte');
    const fraDisplay = isoToDanish(fraISO);
    const tilDisplay = isoToDanish(tilISO);
    if (!fraDisplay || !tilDisplay) throw new Error('Ugyldig periode for svie/smerte');
    const suffix = p.isDelvist ? ' (delvist syg)' : '';
    if (fraDisplay === tilDisplay) return `${fraDisplay}${suffix}`;
    return `${fraDisplay} - ${tilDisplay}${suffix}`;
  });

  const sygedage = constrained
    .filter((p) => !p.isDelvist)
    .reduce((sum, p) => sum + (countInclusiveUtcDays(p.fra, p.til) ?? 0), 0);
  const delviseSygedage = constrained
    .filter((p) => p.isDelvist)
    .reduce((sum, p) => sum + (countInclusiveUtcDays(p.fra, p.til) ?? 0), 0);

  const satserAarValue = values.svieSmerteSatserAar;
  if (harInputPerioder && typeof satserAarValue !== 'number') {
    throw new Error('År for svie/smerte-sats mangler'); // invariant: dækket af validator
  }

  const delvisFaktor: 1 | 0.5 = values.svieSmerteDelvisSygemeldingSats === 'fuld' ? 1 : 0.5;
  if (harInputPerioder && !values.svieSmerteDelvisSygemeldingSats) {
    throw new Error('Sats ved delvis sygemelding mangler'); // invariant: dækket af validator
  }

  let satserPerDag: Calculable<MoneyOre> = notCalculableMoney('Satser kan ikke beregnes');
  let satserMax: Calculable<MoneyOre> = notCalculableMoney('Satser kan ikke beregnes');
  let forligLabel: string | null = null;
  if (harInputPerioder && typeof satserAarValue === 'number') {
    const satsPerDag = svieSmertePrDag[satserAarValue as keyof typeof svieSmertePrDag];
    const satsMax = svieSmerteMax[satserAarValue as keyof typeof svieSmerteMax];
    if (!satsPerDag || !satsMax) {
      throw new Error(`Ingen svie/smerte satser for år ${satserAarValue}`); // invariant: dækket af validator
    }
    const forlig = parseForligsgrad(values);
    forligLabel = forlig.label;
    const perDagKroner = forlig.factor !== null ? satsPerDag * forlig.factor : satsPerDag;
    const maxKroner = forlig.factor !== null ? satsMax * forlig.factor : satsMax;
    satserPerDag = asCalculable(toOre(roundKroner(perDagKroner)));
    satserMax = asCalculable(toOre(roundKroner(maxKroner)));
  }

  const tidligereKroner = amountValueToNumber(values.svieSmerteTidligereTotal);
  const aktuelKroner = amountValueToNumber(values.svieSmerteAktuelPeriode);
  const tidligere = tidligereKroner !== undefined ? asCalculable(toOre(tidligereKroner)) : notCalculableMoney('Ikke angivet');
  const aktuel = aktuelKroner !== undefined ? asCalculable(toOre(aktuelKroner)) : notCalculableMoney('Ikke angivet');

  let totalOre = ensureMoneyOre(0);
  let maxApplied = false;

  if (harPerioder) {
    if (satserPerDag.status !== 'ok' || satserMax.status !== 'ok') {
      throw new Error('Satser mangler for svie/smerte');
    }
    const perDagKroner = fromOre(satserPerDag.value);
    const maxKroner = fromOre(satserMax.value);
    const rawKroner = (sygedage * perDagKroner) + (delviseSygedage * delvisFaktor * perDagKroner);
    const tidligereValue = tidligereKroner ?? 0;
    const allerede = aktuelKroner ?? 0;
    const restPlads = maxKroner - tidligereValue;
    const beloebFoerFradrag = Math.min(rawKroner, Math.max(0, restPlads));
    maxApplied = rawKroner > Math.max(0, restPlads);
    const beloeb = Math.max(0, beloebFoerFradrag - allerede);
    totalOre = toOre(roundKroner(beloeb));
  }

  return {
    beregnes,
    statusLinjer,
    opgjortFremTilPeriodeTil,
    periodeHeading,
    periodeLinjer,
    harPerioder,
    satserAar: typeof satserAarValue === 'number' ? satserAarValue : null,
    satserPerDag,
    satserMax,
    forligLabel,
    tidligere,
    aktuel,
    sygedage,
    delviseSygedage,
    delvisFaktor,
    maxApplied,
    totalOre,
  };
};

const perioderCoverDate = (perioder: Array<{ fra: Date; til: Date }>, target: ISODateString): boolean => {
  const targetDate = isoDateToDate(target);
  for (const periode of perioder) {
    if (periode.fra <= targetDate && periode.til >= targetDate) return true;
  }
  return false;
};

const buildTafPerioderLinjer = (values: ErstatningsopgoerelseValues): string[] => {
  const rows = values.tafPerioder ?? [];
  const nonEmpty = rows.filter((row) => !isTafRowEmpty(row));
  if (nonEmpty.length === 0) return [];

  for (const row of nonEmpty) {
    const fra = row.fra;
    const til = row.til;
    if (!fra || !til) {
      throw new Error('TAF-periode mangler fra/til'); // invariant: dækket af validator
    }
    if (!isISODateString(fra) || !isISODateString(til) || fra > til) {
      throw new Error('TAF-periode er ugyldig'); // invariant: dækket af validator
    }
  }

  const ranges = buildTafRanges(values);
  const lines: string[] = [];
  for (const range of ranges) {
    const fraText = formatDateShort(range.fra);
    const tilText = formatDateShort(range.til);
    if (!fraText || !tilText) {
      throw new Error('TAF-periode er ugyldig'); // invariant: dækket af validator
    }
    lines.push(`${fraText} - ${tilText}`);
  }
  return lines;
};
const buildIndkomstSkadestidspunkt = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues,
  tafBeregningsenhed: TafBeregningsenhed
): IndkomstSkadestidspunktPdfModel | null => {
  const beregnesUdFra = values.beregnesUdFra;
  const loenBaseretPaa = getAngivetLoenBaseretPaa(values)?.trim() ?? '';
  const skadesdato = isISODateString(stamdataValues.skadesdato) ? stamdataValues.skadesdato : null;

  const periodeTilBeregningFra = values.periodeTilBeregningFra;
  const periodeTilBeregningTil = values.periodeTilBeregningTil;
  const periodeTilBeregning =
    periodeTilBeregningFra && periodeTilBeregningTil
      ? { fra: periodeTilBeregningFra, til: periodeTilBeregningTil }
      : null;

  const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
  const loenErrorRowIdsByEmploymentId = new Map<string, ReadonlySet<string>>(
    ansaettelser.map((af) => [af.id, getAarsloenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode)])
  );
  const isValidLoenRowForCalculation = (
    af: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number],
    row: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]['indtaegtsoplysningerTableData'][number]
  ): boolean => {
    if (isAarsloenRowEffectivelyEmpty(row)) return false;
    const errorRowIds = loenErrorRowIdsByEmploymentId.get(af.id) ?? new Set<string>();
    if (errorRowIds.has(row.id)) return false;
    return parseAarsloenRowInterval(row, af.loenperiode) !== null;
  };
  const ansaettelserMedData = ansaettelser.filter((af) =>
    (af.indtaegtsoplysningerTableData ?? []).some((row) => isValidLoenRowForCalculation(af, row))
  );
  const ansaettelserNavne = ansaettelserMedData
    .map((af) => (af.navnPaaArbejdssted ?? '').trim())
    .filter((value, index, arr) => value !== '' && arr.indexOf(value) === index);

  const arbejdssteder: Array<IndkomstSkadestidspunktPdfModel['arbejdssteder'][number]> = [];
  let totalBreakdown: IndkomstSkadestidspunktPdfModel['totalBreakdown'] = null;
  let arbejdsdage: number | null = null;
  let maaneder: number | null = null;
  let maanedsloen: Calculable<MoneyOre> = notCalculableMoney('Ikke angivet');
  let dagsloen: Calculable<MoneyOre> = notCalculableMoney('Ikke angivet');
  let beregningsperiodeLabel: string | null = null;
  let beregningsgrundlagMellemregningLabel: string | null = null;
  let beregningsgrundlagMellemregningResultat: string | null = null;

  if (beregnesUdFra === 'Beregningsperiode') {
    if (periodeTilBeregning) {
      const fraText = formatDateShort(periodeTilBeregning.fra);
      const tilText = formatDateShort(periodeTilBeregning.til);
      if (fraText && tilText) {
        beregningsperiodeLabel = `Beregnes på baggrund af indkomsten i perioden ${fraText} - ${tilText}.`;
      }
    }

    const initial = { ferieberet: 0, fpFvShSo: 0, pension: 0, atp: 0, samlet: 0 };
    const sums = ansaettelserMedData.reduce((acc, af) => {
      const satser = {
        feriePct: af.feriePct,
        fritvalgPct: af.fritvalgPct,
        shSoPct: af.shSoPct,
        storeBededagPct: af.storeBededagPct,
        pensionPct: af.pensionPct,
      };
      const perEmployment = { ferieberet: 0, fpFvShSo: 0, pension: 0, atp: 0, samlet: 0 };
      for (const row of af.indtaegtsoplysningerTableData ?? []) {
        // NOTE: Fail-closed by design.
        // Kun rækker med gyldigt dato-interval og uden valideringsfejl må indgå i beregningen.
        if (!isValidLoenRowForCalculation(af, row)) continue;
        const derived = calculateAarsloenRowDerived(row, satser);
        const atp = amountValueToNumber(row.col5) ?? 0;

        let fraction = 1;
        const interval = parseAarsloenRowInterval(row, af.loenperiode);
        if (!interval) continue;
        if (periodeTilBeregning) {
          const totalDays = countInclusiveUtcDays(interval.start, interval.end);
          if (!totalDays || totalDays <= 0) continue;
          const beregStart = isoDateToDate(periodeTilBeregning.fra);
          const beregEnd = isoDateToDate(periodeTilBeregning.til);
          const overlapStart = interval.start > beregStart ? interval.start : beregStart;
          const overlapEnd = interval.end < beregEnd ? interval.end : beregEnd;
          if (overlapStart > overlapEnd) continue;
          const overlapDays = countInclusiveUtcDays(overlapStart, overlapEnd);
          if (!overlapDays || overlapDays <= 0) continue;
          fraction = overlapDays / totalDays;
        }

        const ferieberetContrib = derived.ferieberet * fraction;
        const fpFvShSoContrib = derived.fpFvShSo * fraction;
        const pensionContrib = derived.pension * fraction;
        const atpContrib = atp * fraction;
        const samletContrib = derived.samlet * fraction;
        // NOTE: Fail-closed by design.
        // Ikke-finite delbidrag eller ikke-positive samlede bidrag må aldrig indgå tavst i summer.
        if (
          !Number.isFinite(ferieberetContrib) ||
          !Number.isFinite(fpFvShSoContrib) ||
          !Number.isFinite(pensionContrib) ||
          !Number.isFinite(atpContrib) ||
          !Number.isFinite(samletContrib) ||
          samletContrib <= 0
        ) {
          continue;
        }

        acc.ferieberet += ferieberetContrib;
        acc.fpFvShSo += fpFvShSoContrib;
        acc.pension += pensionContrib;
        acc.atp += atpContrib;
        acc.samlet += samletContrib;

        perEmployment.ferieberet += ferieberetContrib;
        perEmployment.fpFvShSo += fpFvShSoContrib;
        perEmployment.pension += pensionContrib;
        perEmployment.atp += atpContrib;
        perEmployment.samlet += samletContrib;
      }
      if (perEmployment.samlet > 0) {
        const pctParts: string[] = [];
        if (satser.feriePct && satser.feriePct !== 0) pctParts.push(`Feriepenge (${formatPercent(satser.feriePct)})`);
        if (satser.fritvalgPct && satser.fritvalgPct !== 0) pctParts.push(`Fritvalg (${formatPercent(satser.fritvalgPct)})`);
        if (satser.shSoPct && satser.shSoPct !== 0) pctParts.push(`S/H (${formatPercent(satser.shSoPct)})`);
        if (satser.storeBededagPct && satser.storeBededagPct !== 0) {
          pctParts.push(`Store Bededag (${formatPercentFixed2(satser.storeBededagPct)})`);
        }
        const fpLabel = pctParts.length > 0 ? pctParts.join(' + ') : 'Feriepenge m.v.';
        const pensionLabel = satser.pensionPct && satser.pensionPct !== 0
          ? `Arbejdsgivers pensionsbidrag (${formatPercent(satser.pensionPct)} af løn + tillæg)`
          : 'Arbejdsgivers pensionsbidrag';
        const navn = (af.navnPaaArbejdssted ?? '').trim() || 'Arbejdssted';
        arbejdssteder.push({
          navn,
          fpLabel,
          pensionLabel,
          breakdown: {
            ferieberetOre: toOre(roundKroner(perEmployment.ferieberet)),
            fpFvShSoOre: toOre(roundKroner(perEmployment.fpFvShSo)),
            pensionOre: toOre(roundKroner(perEmployment.pension)),
            atpOre: toOre(roundKroner(perEmployment.atp)),
            samletOre: toOre(roundKroner(perEmployment.samlet)),
          },
        });
      }
      return acc;
    }, initial);

    if (ansaettelserMedData.length > 0) {
      totalBreakdown = {
        ferieberetOre: toOre(roundKroner(sums.ferieberet)),
        fpFvShSoOre: toOre(roundKroner(sums.fpFvShSo)),
        pensionOre: toOre(roundKroner(sums.pension)),
        atpOre: toOre(roundKroner(sums.atp)),
        samletOre: toOre(roundKroner(sums.samlet)),
      };
    }

    const oevrigeFravaersdage =
      values.oevrigtFravaerUdenLoen === 'Ja' && typeof values.oevrigeFravaersdage === 'number'
        ? values.oevrigeFravaersdage
        : 0;
    if (periodeTilBeregning) {
      const formatDaNumber = (value: number): string => value.toLocaleString('da-DK');
      const formatMaaneder = (value: number): string => {
        const rounded = Math.round(value * 100) / 100;
        return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      };
      const dagOrd = (value: number, singular: string, plural: string): string => (value === 1 ? singular : plural);

      const maanederResult = calculateTafAntalMaaneder(
        periodeTilBeregning.fra,
        periodeTilBeregning.til,
        values.fravaerPerioder ?? [],
        typeof values.uspecificeredeFerieFridage === 'number' ? values.uspecificeredeFerieFridage : 0,
        oevrigeFravaersdage
      );
      maaneder = maanederResult;
      if (maanederResult && totalBreakdown) {
        const base = fromOre(totalBreakdown.samletOre) / maanederResult;
        maanedsloen = asCalculable(toOre(roundKroner(base)));
      }

      if (tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER && maanederResult !== null) {
        const oevrigeFravaersdageValue = oevrigeFravaersdage;
        const periodeDage = new Set<ISODateString>();
        const fraDate = isoDateToDate(periodeTilBeregning.fra);
        const tilDate = isoDateToDate(periodeTilBeregning.til);
        const currentDate = new Date(fraDate);
        while (currentDate <= tilDate) {
          const iso = dateToISO(currentDate);
          if (iso) periodeDage.add(iso);
          currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }

        const beregnMaanederForDage = (dage: ReadonlySet<ISODateString>): number => {
          let total = 0;
          for (const isoStr of dage) {
            const year = Number.parseInt(isoStr.slice(0, 4), 10);
            const month = Number.parseInt(isoStr.slice(5, 7), 10);
            const dageIMaaned = new Date(Date.UTC(year, month, 0)).getUTCDate();
            total += 1 / dageIMaaned;
          }
          return total;
        };

        const totalMaaneder = beregnMaanederForDage(periodeDage);
        const fravaerMaaneder = oevrigeFravaersdageValue * 0.048;
        const roundedTotalMaaneder = Math.round(totalMaaneder * 100) / 100;
        const roundedFravaerMaaneder = Math.round(fravaerMaaneder * 100) / 100;
        const maanederEfterFradrag = Math.max(0, Math.round((roundedTotalMaaneder - roundedFravaerMaaneder) * 100) / 100);
        if (oevrigeFravaersdageValue === 0) {
          beregningsgrundlagMellemregningLabel =
            `I perioden var der ${formatMaaneder(totalMaaneder)} måneder (- 0 fraværsdage uden løn) =`;
        } else {
          const fravaerBeskrivelse = values.oevrigeFravaersdageBeskrivelse?.trim();
          const fravaersdagOrd = dagOrd(oevrigeFravaersdageValue, 'fraværsdag', 'fraværsdage');
          const fravaerLabelTekst = fravaerBeskrivelse && fravaerBeskrivelse !== ''
            ? `${fravaersdagOrd} pga. ${fravaerBeskrivelse}`
            : fravaersdagOrd;
          const fravaerLabel = `${formatDaNumber(oevrigeFravaersdageValue)} ${fravaerLabelTekst} uden løn x 4,8 % måned`;
          beregningsgrundlagMellemregningLabel =
            `I perioden var der ${formatMaaneder(totalMaaneder)} - ${formatMaaneder(fravaerMaaneder)} måneder (${fravaerLabel}) =`;
        }
        beregningsgrundlagMellemregningResultat = `${formatMaaneder(maanederEfterFradrag)} måneder`;
      }

      const loseFeriedage = typeof values.uspecificeredeFerieFridage === 'number' ? values.uspecificeredeFerieFridage : 0;
      const arbejdsdageBreakdown = calculateTafArbejdsdageBreakdown(
        periodeTilBeregning.fra,
        periodeTilBeregning.til,
        values.fravaerPerioder ?? [],
        loseFeriedage,
        { kind: 'beregningsgrundlag', oevrigeFravaersdage }
      );
      if (arbejdsdageBreakdown) {
        arbejdsdage = Math.max(0, arbejdsdageBreakdown.tafDage);
        if (arbejdsdage > 0 && totalBreakdown && tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE) {
          const base = fromOre(totalBreakdown.samletOre) / arbejdsdage;
          dagsloen = asCalculable(toOre(roundKroner(base)));
        }

        if (tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE) {
          const samletFeriedage = arbejdsdageBreakdown.feriedage + arbejdsdageBreakdown.loseFeriedage;
          const components: Array<{ value: number; label: string }> = [
            { value: arbejdsdageBreakdown.arbejdsdage, label: dagOrd(arbejdsdageBreakdown.arbejdsdage, 'hverdag', 'hverdage') },
            { value: arbejdsdageBreakdown.shDage, label: dagOrd(arbejdsdageBreakdown.shDage, 'SH-dag', 'SH-dage') },
            { value: samletFeriedage, label: dagOrd(samletFeriedage, 'feriedag', 'feriedage') },
            { value: arbejdsdageBreakdown.oevrigeFravaersdage, label: dagOrd(arbejdsdageBreakdown.oevrigeFravaersdage, 'øvrig fraværsdag', 'øvrige fraværsdage') },
          ];
          const parts = components.map((component) => `${formatDaNumber(component.value)} ${component.label}`);
          beregningsgrundlagMellemregningLabel = `I perioden var der ${parts.join(' - ')} =`;
          beregningsgrundlagMellemregningResultat = `${formatDaNumber(arbejdsdage)} arbejdsdage`;
        }
      }
    }
  } else if (beregnesUdFra === 'Angivet månedsløn') {
    const value = amountValueToNumber(values.maanedsloenenUdgoer);
    if (value !== undefined) {
      maanedsloen = asCalculable(toOre(value));
    } else {
      maanedsloen = notCalculableMoney('Månedsløn mangler');
    }
  } else if (beregnesUdFra === 'Angivet dagsløn') {
    const value = amountValueToNumber(values.dagsloenenUdgoer);
    if (value !== undefined) {
      dagsloen = asCalculable(toOre(value));
    } else {
      dagsloen = notCalculableMoney('Dagsløn mangler');
    }
  }

  return {
    beregningsenhed: tafBeregningsenhed,
    beregnesUdFra,
    loenBaseretPaa: loenBaseretPaa !== '' ? loenBaseretPaa : null,
    skadesdato,
    periodeTilBeregning,
    ansaettelserNavne,
    arbejdssteder,
    totalBreakdown,
    arbejdsdage,
    maaneder,
    maanedsloen,
    dagsloen,
    beregningsperiodeLabel,
    beregningsgrundlagMellemregningLabel,
    beregningsgrundlagMellemregningResultat,
  };
};

type LoenudviklingStrategiV3 = 'ingen' | 'statistik' | 'overenskomst' | 'manual' | 'krl';
type LoenreguleringsSegmentV3 = Readonly<IsoRange & { deltaPct: number }>;
type LoenudviklingRowsV3 = readonly LoenudviklingSource[];
type LoenudviklingAfV3 = LoenudviklingSource;
type LoenudviklingManualRowV3 = NonNullable<LoenudviklingAfV3['loenudviklingManuelTableData']>[number];
type OffentligLoenSelectionV3 = Readonly<{
  overenskomstType: OffentligOverenskomstType;
  loenType: OffentligLoenType;
  loentrin: Loentrin;
  loengruppe: Loengruppe;
}>;
type KonsolideretLoenudviklingV3 =
  | Readonly<{
    strategi: 'statistik';
    label: string;
    reguleringsdato: ISODateString | undefined;
    statistikModel: string;
    tafRanges: readonly IsoRange[];
  }>
  | Readonly<{
    strategi: 'overenskomst';
    label: string;
    reguleringsdato: ISODateString | undefined;
    overenskomstId: string;
    loenPaaHelligdage: string;
    feriePct: number;
    offentlig: OffentligLoenSelectionV3 | null;
    tafRanges: readonly IsoRange[];
  }>
  | Readonly<{
    strategi: 'manual';
    label: string;
    reguleringsdato: ISODateString | undefined;
    feriePct: number;
    manualRows: readonly LoenudviklingManualRowV3[];
    tafRanges: readonly IsoRange[];
  }>
  | Readonly<{
    strategi: 'krl';
    label: string;
    reguleringsdato: ISODateString | undefined;
    krlSatstabelId: KRLSatstabelId;
    tafRanges: readonly IsoRange[];
  }>;

const parseDanishToIso = (danishDate: string | undefined): ISODateString | undefined => {
  if (!danishDate || danishDate.trim() === '') return undefined;
  return danishToISO(danishDate);
};

const parseManualPercentToPct = (value: string | undefined): number => parsePercentToDecimal(value) * 100;

const resolveStatistikModelIdFromLabel = (label: string): StatistiskLoenudviklingId | undefined =>
  resolveStatistikModelId(label);

const computePackageValue = (args: {
  grundloen: number;
  feriePct: number;
  shSoPct: number;
  fritvalgPct: number;
  pensionPct: number;
  storeBededagPct: number;
}): number => {
  const tillaegPct = args.feriePct + args.shSoPct + args.fritvalgPct + args.storeBededagPct;
  return args.grundloen * (1 + tillaegPct / 100) * (1 + args.pensionPct / 100);
};

const normalizeManualRowsV3 = (rows: readonly LoenudviklingManualRowV3[]): string => {
  const normalized = rows.map((row) => ({
    dato: row.dato ?? '',
    grundloen: amountValueToNumber(row.grundloen) ?? null,
    feriepenge: row.feriepenge ?? '',
    shSoSats: row.shSoSats ?? '',
    fritvalg: row.fritvalg ?? '',
    agPension: row.agPension ?? '',
  }));
  return JSON.stringify(normalized);
};

type UniformPrimitiveV3 = string | number | boolean | null;
type ReguleringsdatoInputV3 = Readonly<{ saerligFraDatoRegulering?: string }>;

export const resolveLoenudviklingRowsV3 = (
  values: ErstatningsopgoerelseValues
): ReadonlyArray<LoenudviklingAfV3> => {
  return resolveLoenudviklingKilde(values);
};

const resolveOffentligLoenSelectionV3 = (
  af: LoenudviklingAfV3,
  offentligType: OffentligOverenskomstType
): OffentligLoenSelectionV3 => {
  const loenType = resolveOffentligLoenTypeFromLabel(af.offentligLoenType);
  if (!loenType) {
    throw new Error('Loenudvikling kan ikke beregnes: ansættelse er ikke valgt');
  }

  const trinValue = af.offentligLoenTrin;
  if (typeof trinValue !== 'number') {
    throw new Error('Loenudvikling kan ikke beregnes: løntrin mangler');
  }

  let loentrin: Loentrin;
  try {
    loentrin = toLoentrin(trinValue);
  } catch {
    throw new Error('Loenudvikling kan ikke beregnes: løntrin skal være mellem 1 og 55');
  }

  const gruppeValue = af.offentligLoenGruppe;
  if (typeof gruppeValue !== 'number') {
    throw new Error('Loenudvikling kan ikke beregnes: gruppe mangler');
  }
  if (gruppeValue < 0 || gruppeValue > 4) {
    throw new Error('Loenudvikling kan ikke beregnes: gruppe skal være mellem 0 og 4');
  }

  return {
    overenskomstType: offentligType,
    loenType,
    loentrin,
    loengruppe: gruppeValue as Loengruppe,
  };
};

const assertUniformV3 = (
  active: readonly LoenudviklingAfV3[],
  selector: (af: LoenudviklingAfV3) => UniformPrimitiveV3,
  fieldLabel: string
): void => {
  if (active.length <= 1) return;
  const first = selector(active[0]);
  for (let i = 1; i < active.length; i += 1) {
    const current = selector(active[i]);
    if (current !== first) {
      throw new Error(`Inkonsistente loenudviklingsindstillinger: ${fieldLabel}`); // invariant: dækket af validator
    }
  }
};

const buildSegmentsFromStartDatesV3 = (
  range: IsoRange,
  starts: ReadonlySet<ISODateString>
): ReadonlyArray<IsoRange> => {
  const segmentStarts = Array.from(starts)
    .filter((iso) => iso > range.fra && iso <= range.til)
    .sort((a, b) => a.localeCompare(b));
  segmentStarts.unshift(range.fra);

  const segments: IsoRange[] = [];
  for (let i = 0; i < segmentStarts.length; i += 1) {
    const fra = segmentStarts[i];
    const til = i < segmentStarts.length - 1 ? subtractOneDay(segmentStarts[i + 1]) : range.til;
    if (!fra || !til || fra > til) continue;
    segments.push({ fra, til });
  }
  return segments;
};

const assertSortedByStartIsoV3 = <T extends { startIso: ISODateString }>(
  items: readonly T[],
  context: string
): void => {
  for (let i = 1; i < items.length; i += 1) {
    if (items[i - 1].startIso > items[i].startIso) {
      throw new Error(`Intern fejl: usorteret startdato-liste (${context})`);
    }
  }
};

const findLatestByDateInSortedListV3 = <T extends { startIso: ISODateString }>(
  sortedItems: readonly T[],
  date: ISODateString,
  context: string
): T | undefined => {
  assertSortedByStartIsoV3(sortedItems, context);
  for (let i = sortedItems.length - 1; i >= 0; i -= 1) {
    if (sortedItems[i].startIso <= date) return sortedItems[i];
  }
  return undefined;
};

export const segmentAmountOreV3 = (baseLoenKronerRounded: number, quantity: number, deltaPct: number): MoneyOre => {
  const amountKroner = baseLoenKronerRounded * quantity * (1 + deltaPct / 100);
  return toOre(roundKroner(amountKroner));
};

const resolveReguleringsStrategiV3 = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues
): Readonly<{ strategi: LoenudviklingStrategiV3; label: string; konsolideret: KonsolideretLoenudviklingV3 | null }> => {
  // Strategikontrakt:
  // - ingen: ingen ekstra krav
  // - statistik: statistikmodel
  // - manual: feriepct + manuelle reguleringsraekker
  // - overenskomst: feriepct + overenskomstId + loen paa helligdage
  const ansaettelser = resolveLoenudviklingRowsV3(values);
  const alleIngen = ansaettelser.length > 0 && ansaettelser.every((af) => af.loenudviklingBeregningsgrundlag === 'Ingen');
  if (alleIngen) return { strategi: 'ingen', label: 'Ingen', konsolideret: null };

  const active = ansaettelser.filter((af) => af.loenudviklingBeregningsgrundlag && af.loenudviklingBeregningsgrundlag !== 'Ingen');
  if (active.length === 0) {
    throw new Error('Loenudviklingsstrategi er ikke valgt');
  }
  const angivetLoen =
    values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn';

  assertUniformV3(active, (af) => af.loenudviklingBeregningsgrundlag ?? '', 'beregningsgrundlag');
  assertUniformV3(
    active,
    (af) => (isISODateString(af.saerligFraDatoRegulering) ? af.saerligFraDatoRegulering : ''),
    'saerlig fra dato regulering'
  );
  const basis = active[0].loenudviklingBeregningsgrundlag;
  if (!basis) {
    throw new Error('Loenudviklingsstrategi er ikke valgt');
  }

  const strategi: LoenudviklingStrategiV3 =
    basis === 'Statistik' ? 'statistik'
      : basis === 'Overenskomst' ? 'overenskomst'
        : basis === 'Manuelt angivet' ? 'manual'
          : basis === 'KRL satstabel' ? 'krl'
            : 'ingen';

  if (strategi === 'statistik') {
    assertUniformV3(active, (af) => (af.loenudviklingStatistikModel ?? '').trim(), 'statistikmodel');
  } else if (strategi === 'overenskomst') {
    assertUniformV3(active, (af) => af.overenskomstId ?? '', 'overenskomst');
    assertUniformV3(active, (af) => af.loenPaaHelligdage ?? '', 'loen paa helligdage');
    if (!angivetLoen) {
      assertUniformV3(active, (af) => af.feriePct ?? null, 'feriepct');
    }

    const offentligType = active[0].overenskomstId
      ? getOffentligOverenskomstTypeById(active[0].overenskomstId)
      : undefined;
    if (offentligType) {
      assertUniformV3(active, (af) => af.offentligLoenType ?? '', 'offentlig løntype');
      assertUniformV3(active, (af) => af.offentligLoenTrin ?? null, 'offentlig løntrin');
      assertUniformV3(active, (af) => af.offentligLoenGruppe ?? null, 'offentlig løngruppe');
    }
  } else if (strategi === 'manual') {
    assertUniformV3(active, (af) => normalizeManualRowsV3(af.loenudviklingManuelTableData ?? []), 'manuelle reguleringsraekker');
    if (!angivetLoen) {
      assertUniformV3(active, (af) => af.feriePct ?? null, 'feriepct');
    }
  } else if (strategi === 'krl') {
    assertUniformV3(active, (af) => af.loenudviklingKRLSatstabel ?? '', 'KRL satstabel');
  }

  const skadesdato = isISODateString(stamdataValues.skadesdato) ? stamdataValues.skadesdato : undefined;
  const reguleringsdato = resolveReguleringsdato(
    values,
    { saerligFraDatoRegulering: active[0].saerligFraDatoRegulering },
    skadesdato
  );
  const tafRanges = buildTafRanges(values);
  const label =
    strategi === 'statistik'
      ? ((active[0].loenudviklingStatistikModel ?? '').trim() || '-')
      : strategi === 'manual'
        ? (active[0].loenudviklingManuelNavn?.trim() || 'Manuelt angivet')
        : strategi === 'krl'
          ? (active[0].loenudviklingKRLSatstabel ?? '-')
          : basis;

  if (strategi === 'statistik') {
    return {
      strategi,
      label,
      konsolideret: {
        strategi,
        label,
        reguleringsdato,
        statistikModel: active[0].loenudviklingStatistikModel ?? '',
        tafRanges,
      },
    };
  }

  if (strategi === 'overenskomst') {
    if (!active[0].overenskomstId) {
      throw new Error('Loenudvikling kan ikke beregnes: overenskomst mangler');
    }
    if (!angivetLoen && typeof active[0].feriePct !== 'number') {
      throw new Error('Loenudvikling kan ikke beregnes: feriepct mangler');
    }
    const loenPaaHelligdage = active[0].loenPaaHelligdage ?? '';
    const gyldigLoenPaaHelligdage =
      loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG
      || loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.SH_UDBETALING
      || loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.INGEN;
    if (!gyldigLoenPaaHelligdage) {
      throw new Error('Loenudvikling kan ikke beregnes: loen paa helligdage er ugyldig');
    }
    const offentligType = getOffentligOverenskomstTypeById(active[0].overenskomstId);
    const offentlig = offentligType
      ? resolveOffentligLoenSelectionV3(active[0], offentligType)
      : null;
    const feriePct = typeof active[0].feriePct === 'number' ? active[0].feriePct : 0;
    return {
      strategi,
      label,
      konsolideret: {
        strategi,
        label,
        reguleringsdato,
        overenskomstId: active[0].overenskomstId,
        loenPaaHelligdage,
        feriePct,
        offentlig,
        tafRanges,
      },
    };
  }

  if (strategi === 'manual') {
    if (!angivetLoen && typeof active[0].feriePct !== 'number') {
      throw new Error('Loenudvikling kan ikke beregnes: feriepct mangler');
    }
    const feriePct = typeof active[0].feriePct === 'number' ? active[0].feriePct : 0;
    return {
      strategi,
      label,
      konsolideret: {
        strategi,
        label,
        reguleringsdato,
        feriePct,
        manualRows: active[0].loenudviklingManuelTableData ?? [],
        tafRanges,
      },
    };
  }

  if (strategi === 'krl') {
    const krlId = active[0].loenudviklingKRLSatstabel;
    if (!krlId) {
      throw new Error('Loenudvikling kan ikke beregnes: KRL satstabel mangler');
    }
    return {
      strategi,
      label,
      konsolideret: {
        strategi,
        label,
        reguleringsdato,
        krlSatstabelId: krlId as KRLSatstabelId,
        tafRanges,
      },
    };
  }

  throw new Error('Loenudviklingsstrategi er ugyldig');
};

const buildLoenudviklingFromStatistikV3 = (
  konsolideret: KonsolideretLoenudviklingV3
): ReadonlyArray<LoenreguleringsSegmentV3> => {
  if (konsolideret.strategi !== 'statistik') {
    throw new Error('Loenudvikling kan ikke beregnes: statistikstrategi mangler');
  }
  const modelLabel = konsolideret.statistikModel.trim();
  if (modelLabel === '') {
    throw new Error('Loenudvikling kan ikke beregnes: statistikmodel mangler');
  }
  if (!konsolideret.reguleringsdato) {
    throw new Error('Loenudvikling kan ikke beregnes: reguleringsdato mangler');
  }

  if (modelLabel.startsWith('ASL-')) {
    const baseYear = Number(konsolideret.reguleringsdato.slice(0, 4));
    const baseIndex = Number.isFinite(baseYear) ? aarsloenMax[baseYear as keyof typeof aarsloenMax] : undefined;
    if (typeof baseIndex !== 'number' || baseIndex <= 0) {
      throw new Error('Loenudvikling kan ikke beregnes: mangler ASL basisindeks');
    }
    const aslSegments = buildAslReguleringsSegments(konsolideret.tafRanges)
      .map((segment) => {
        const idx = aarsloenMax[segment.year as keyof typeof aarsloenMax];
        if (typeof idx !== 'number' || idx <= 0) return null;
        return { fra: segment.fra, til: segment.til, deltaPct: roundHalfAwayFromZero((idx / baseIndex - 1) * 100, 2) };
      })
      .filter((segment): segment is LoenreguleringsSegmentV3 => Boolean(segment));
    if (aslSegments.length === 0) {
      throw new Error('Loenudvikling kan ikke beregnes: ingen ASL segmenter');
    }
    return aslSegments;
  }

  const modelId = resolveStatistikModelIdFromLabel(modelLabel);
  const statistikModel = modelId ? getStatistiskLoenudvikling(modelId) : undefined;
  if (!statistikModel) {
    throw new Error('Loenudvikling kan ikke beregnes: ukendt statistikmodel');
  }

  const periodStarts = statistikModel.indeksvaerdier
    .map((entry) => {
      const match = entry.kvartal.match(/^(\d{4})K([1-4])$/);
      if (!match) return null;
      const year = Number.parseInt(match[1], 10);
      const quarter = Number.parseInt(match[2], 10);
      const startIso = dateToISO(createDate(year, (quarter - 1) * 3, 1));
      if (!startIso) return null;
      return { startIso, indeks: entry.indeks };
    })
    .filter((entry): entry is Readonly<{ startIso: ISODateString; indeks: number }> => Boolean(entry))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  const baseEntry = findLatestByDateInSortedListV3(periodStarts, konsolideret.reguleringsdato, 'statistik:base');
  if (!baseEntry || baseEntry.indeks <= 0) {
    throw new Error('Loenudvikling kan ikke beregnes: mangler basisindeks');
  }

  const segments: LoenreguleringsSegmentV3[] = [];
  for (const range of konsolideret.tafRanges) {
    const starts = new Set<ISODateString>();
    for (const entry of periodStarts) {
      if (entry.startIso > range.fra && entry.startIso <= range.til) starts.add(entry.startIso);
    }
    for (const segment of buildSegmentsFromStartDatesV3(range, starts)) {
      const idxEntry = findLatestByDateInSortedListV3(periodStarts, segment.fra, 'statistik:segment');
      if (!idxEntry || idxEntry.indeks <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: mangler indeks for segment');
      }
      segments.push({
        ...segment,
        deltaPct: roundHalfAwayFromZero((idxEntry.indeks / baseEntry.indeks - 1) * 100, 2),
      });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen statistiksegmenter');
  }
  return segments;
};

const buildLoenudviklingFromKRLV3 = (
  konsolideret: KonsolideretLoenudviklingV3
): ReadonlyArray<LoenreguleringsSegmentV3> => {
  if (konsolideret.strategi !== 'krl') {
    throw new Error('Loenudvikling kan ikke beregnes: KRL-strategi mangler');
  }
  if (!konsolideret.reguleringsdato) {
    throw new Error('Loenudvikling kan ikke beregnes: reguleringsdato mangler');
  }
  const tabel = getKRLSatstabel(konsolideret.krlSatstabelId);
  if (!tabel || tabel.vaerdier.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: KRL satstabel mangler');
  }

  // Byg sorteret liste af periodestarter med ISO-datoer
  const periodStarts = tabel.vaerdier
    .map((v) => {
      const startIso = parseDanishToIso(v.fraDato);
      if (!startIso) return null;
      return { startIso, reguleringsPct: v.reguleringsPct };
    })
    .filter((entry): entry is Readonly<{ startIso: ISODateString; reguleringsPct: number }> => Boolean(entry))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  // Find basisindeks ved reguleringsdato
  const baseEntry = findLatestByDateInSortedListV3(periodStarts, konsolideret.reguleringsdato, 'krl:base');
  if (!baseEntry) {
    throw new Error('Loenudvikling kan ikke beregnes: mangler KRL basisindeks');
  }
  const basePct = baseEntry.reguleringsPct;

  // Byg segmenter for hvert taf-interval
  const segments: LoenreguleringsSegmentV3[] = [];
  for (const range of konsolideret.tafRanges) {
    const starts = new Set<ISODateString>();
    for (const entry of periodStarts) {
      if (entry.startIso > range.fra && entry.startIso <= range.til) starts.add(entry.startIso);
    }
    for (const segment of buildSegmentsFromStartDatesV3(range, starts)) {
      const idxEntry = findLatestByDateInSortedListV3(periodStarts, segment.fra, 'krl:segment');
      if (!idxEntry) {
        throw new Error('Loenudvikling kan ikke beregnes: mangler KRL indeks for segment');
      }
      // Indeksforhold: deltaPct = ((100 + periodePct) / (100 + basePct) - 1) * 100
      const deltaPct = roundHalfAwayFromZero(((100 + idxEntry.reguleringsPct) / (100 + basePct) - 1) * 100, 2);
      segments.push({ ...segment, deltaPct });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen KRL segmenter');
  }
  return segments;
};

const buildLoenudviklingFromOverenskomstV3 = (
  konsolideret: KonsolideretLoenudviklingV3
): ReadonlyArray<LoenreguleringsSegmentV3> => {
  if (konsolideret.strategi !== 'overenskomst') {
    throw new Error('Loenudvikling kan ikke beregnes: overenskomststrategi mangler');
  }
  if (!konsolideret.reguleringsdato) {
    throw new Error('Loenudvikling kan ikke beregnes: reguleringsdato mangler');
  }
  const overenskomstRef = konsolideret.overenskomstId ? resolveOverenskomstRef(konsolideret.overenskomstId) : undefined;
  const reguleringsdatoDa = isoToDanish(konsolideret.reguleringsdato);
  if (!overenskomstRef) {
    throw new Error('Loenudvikling kan ikke beregnes: overenskomst mangler');
  }
  if (!reguleringsdatoDa) {
    throw new Error('Loenudvikling kan ikke beregnes: ugyldig reguleringsdato');
  }

  const offentlig = konsolideret.offentlig;
  if (offentlig) {
    const feriePct = konsolideret.feriePct;
    const baseResult = getOffentligLoenForDato(
      offentlig.overenskomstType,
      reguleringsdatoDa,
      offentlig.loentrin,
      offentlig.loengruppe
    );
    if (!baseResult) {
      throw new Error('Loenudvikling kan ikke beregnes: basissats mangler');
    }
    const baseLoen = offentlig.loenType === 'maanedsLoen' ? baseResult.maanedsLoen : baseResult.timeLoen;
    const basePackage = computePackageValue({
      grundloen: baseLoen,
      feriePct,
      shSoPct: 0,
      fritvalgPct: 0,
      pensionPct: 0,
      storeBededagPct: 0,
    });
    if (!Number.isFinite(basePackage) || basePackage <= 0) {
      throw new Error('Loenudvikling kan ikke beregnes: basispakke er ugyldig');
    }

    const segments: LoenreguleringsSegmentV3[] = [];
    for (const range of konsolideret.tafRanges) {
      const fraDa = isoToDanish(range.fra);
      const tilDa = isoToDanish(range.til);
      if (!fraDa || !tilDa) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldigt segmentinterval');
      }

      const satser = getOffentligLoenForPeriode(
        offentlig.overenskomstType,
        fraDa,
        tilDa,
        offentlig.loentrin,
        offentlig.loengruppe
      );

      const starts = new Set<ISODateString>();
      for (const sats of satser) {
        const startIso = parseDanishToIso(sats.effectiveDate);
        if (startIso && startIso > range.fra && startIso <= range.til) starts.add(startIso);
      }

      for (const segment of buildSegmentsFromStartDatesV3(range, starts)) {
        const segmentDa = isoToDanish(segment.fra);
        if (!segmentDa) {
          throw new Error('Loenudvikling kan ikke beregnes: ugyldig segmentdato');
        }
        const segmentResult = getOffentligLoenForDato(
          offentlig.overenskomstType,
          segmentDa,
          offentlig.loentrin,
          offentlig.loengruppe
        );
        if (!segmentResult) {
          throw new Error('Loenudvikling kan ikke beregnes: mangler sats for segment');
        }
        const segmentLoen = offentlig.loenType === 'maanedsLoen'
          ? segmentResult.maanedsLoen
          : segmentResult.timeLoen;
        const packageValue = computePackageValue({
          grundloen: segmentLoen,
          feriePct,
          shSoPct: 0,
          fritvalgPct: 0,
          pensionPct: 0,
          storeBededagPct: 0,
        });
        if (!Number.isFinite(packageValue) || packageValue <= 0) {
          throw new Error('Loenudvikling kan ikke beregnes: ugyldig pakkevaerdi for segment');
        }
        segments.push({
          ...segment,
          deltaPct: roundHalfAwayFromZero((packageValue / basePackage - 1) * 100, 2),
        });
      }
    }
    if (segments.length === 0) {
      throw new Error('Loenudvikling kan ikke beregnes: ingen overenskomstsegmenter');
    }
    return segments;
  }

  const applyShRegel = konsolideret.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG;
  const feriePct = konsolideret.feriePct;
  const baseSats = getEffektiveSatserForDato({
    overenskomstId: overenskomstRef.baseId,
    dato: reguleringsdatoDa,
    applyAlmindeligLoenPaaShDageRegel: applyShRegel,
  });
  if (!baseSats || typeof baseSats.grundloen !== 'number') {
    throw new Error('Loenudvikling kan ikke beregnes: basissats mangler');
  }

  const basePackage = computePackageValue({
    grundloen: baseSats.grundloen,
    feriePct,
    shSoPct: typeof baseSats.shSoSats === 'number' ? baseSats.shSoSats * 100 : 0,
    fritvalgPct: typeof baseSats.fritvalg === 'number' ? baseSats.fritvalg * 100 : 0,
    pensionPct: typeof baseSats.agPension === 'number' ? baseSats.agPension * 100 : 0,
    storeBededagPct: applyShRegel && konsolideret.reguleringsdato >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0,
  });
  if (!Number.isFinite(basePackage) || basePackage <= 0) {
    throw new Error('Loenudvikling kan ikke beregnes: basispakke er ugyldig');
  }

  const segments: LoenreguleringsSegmentV3[] = [];
  for (const range of konsolideret.tafRanges) {
    const fraDa = isoToDanish(range.fra);
    const tilDa = isoToDanish(range.til);
    if (!fraDa || !tilDa) {
      throw new Error('Loenudvikling kan ikke beregnes: ugyldigt segmentinterval');
    }

    const satser = getEffektiveSatserForPeriode({
      overenskomstId: overenskomstRef.baseId,
      fraDato: fraDa,
      tilDato: tilDa,
      applyAlmindeligLoenPaaShDageRegel: applyShRegel,
    });

    const starts = new Set<ISODateString>();
    for (const sats of satser) {
      const startIso = parseDanishToIso(sats.fraDato);
      if (startIso && startIso > range.fra && startIso <= range.til) starts.add(startIso);
    }
    if (applyShRegel && range.fra < STORE_BEDEDAG_START && range.til >= STORE_BEDEDAG_START) {
      starts.add(STORE_BEDEDAG_START);
    }

    for (const segment of buildSegmentsFromStartDatesV3(range, starts)) {
      const segmentDa = isoToDanish(segment.fra);
      if (!segmentDa) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldig segmentdato');
      }
      const sats = getEffektiveSatserForDato({
        overenskomstId: overenskomstRef.baseId,
        dato: segmentDa,
        applyAlmindeligLoenPaaShDageRegel: applyShRegel,
      });
      if (!sats || typeof sats.grundloen !== 'number') {
        throw new Error('Loenudvikling kan ikke beregnes: mangler sats for segment');
      }
      const packageValue = computePackageValue({
        grundloen: sats.grundloen,
        feriePct,
        shSoPct: typeof sats.shSoSats === 'number' ? sats.shSoSats * 100 : 0,
        fritvalgPct: typeof sats.fritvalg === 'number' ? sats.fritvalg * 100 : 0,
        pensionPct: typeof sats.agPension === 'number' ? sats.agPension * 100 : 0,
        storeBededagPct: applyShRegel && segment.fra >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0,
      });
      if (!Number.isFinite(packageValue) || packageValue <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldig pakkevaerdi for segment');
      }
      segments.push({
        ...segment,
        deltaPct: roundHalfAwayFromZero((packageValue / basePackage - 1) * 100, 2),
      });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen overenskomstsegmenter');
  }
  return segments;
};

const buildLoenudviklingFromManualV3 = (
  konsolideret: KonsolideretLoenudviklingV3
): ReadonlyArray<LoenreguleringsSegmentV3> => {
  if (konsolideret.strategi !== 'manual') {
    throw new Error('Loenudvikling kan ikke beregnes: manuel strategi mangler');
  }
  const manualRows = konsolideret.manualRows;
  const baseRow = manualRows[0];
  if (!baseRow) {
    throw new Error('Loenudvikling kan ikke beregnes: manuelle reguleringsraekker mangler');
  }

  const feriePct = konsolideret.feriePct;
  const basePackage = computePackageValue({
    grundloen: amountValueToNumber(baseRow.grundloen) ?? 0,
    feriePct,
    shSoPct: parseManualPercentToPct(baseRow.shSoSats),
    fritvalgPct: parseManualPercentToPct(baseRow.fritvalg),
    pensionPct: parseManualPercentToPct(baseRow.agPension),
    storeBededagPct: 0,
  });
  if (!Number.isFinite(basePackage) || basePackage <= 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ugyldig manuel basispakke');
  }

  const datedRows = manualRows
    .slice(1)
    .map((row) => {
      const startIso = parseDanishToIso(row.dato);
      if (!startIso) return null;
      const packageValue = computePackageValue({
        grundloen: amountValueToNumber(row.grundloen) ?? 0,
        feriePct,
        shSoPct: parseManualPercentToPct(row.shSoSats),
        fritvalgPct: parseManualPercentToPct(row.fritvalg),
        pensionPct: parseManualPercentToPct(row.agPension),
        storeBededagPct: 0,
      });
      if (!Number.isFinite(packageValue) || packageValue <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldig manuel pakkevaerdi');
      }
      return { startIso, packageValue };
    })
    .filter((row): row is Readonly<{ startIso: ISODateString; packageValue: number }> => Boolean(row))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  const segments: LoenreguleringsSegmentV3[] = [];
  for (const range of konsolideret.tafRanges) {
    const starts = new Set<ISODateString>();
    for (const row of datedRows) {
      if (row.startIso > range.fra && row.startIso <= range.til) starts.add(row.startIso);
    }
    for (const segment of buildSegmentsFromStartDatesV3(range, starts)) {
      const segmentRow = findLatestByDateInSortedListV3(datedRows, segment.fra, 'manual:segment');
      const packageValue = segmentRow ? segmentRow.packageValue : basePackage;
      if (!Number.isFinite(packageValue) || packageValue <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldig manuel segmentvaerdi');
      }
      segments.push({
        ...segment,
        deltaPct: roundHalfAwayFromZero((packageValue / basePackage - 1) * 100, 2),
      });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen manuelle segmenter');
  }
  return segments;
};

const buildLoenudviklingModelV3 = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues,
  tafBeregningsenhed: TafBeregningsenhed,
  indkomstSkadestidspunkt: IndkomstSkadestidspunktPdfModel | null
): LoenudviklingPdfModel => {
  const strategiData = resolveReguleringsStrategiV3(values, stamdataValues);
  const loenudviklingLabel = strategiData.label;
  const tafRanges = buildTafRanges(values);
  const maanedsloenBase = tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? resolveMaanedsloenBase(values, indkomstSkadestidspunkt) : null;
  const dagsloenBase = tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
    ? resolveDagsloenBase(values, indkomstSkadestidspunkt)
    : null;
  const baseLoen = tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? maanedsloenBase : dagsloenBase;
  if (typeof baseLoen !== 'number' || baseLoen <= 0 || tafRanges.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
  }

  const baseLoenRounded = roundKroner(baseLoen);
  const baseLoenOre = toOre(baseLoenRounded);
  const tafArbejdageSet = tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE ? buildTafArbejdsdageSet(values) : null;

  const loenreguleringssegmenter: ReadonlyArray<LoenreguleringsSegmentV3> = (() => {
    if (strategiData.strategi === 'ingen') {
      return tafRanges.map((range) => ({ ...range, deltaPct: 0 }));
    }
    const konsolideret = strategiData.konsolideret;
    if (!konsolideret) {
      throw new Error('Loenudvikling kan ikke beregnes: strategi mangler');
    }
    if (konsolideret.strategi === 'statistik') return buildLoenudviklingFromStatistikV3(konsolideret);
    if (konsolideret.strategi === 'overenskomst') return buildLoenudviklingFromOverenskomstV3(konsolideret);
    if (konsolideret.strategi === 'manual') return buildLoenudviklingFromManualV3(konsolideret);
    if (konsolideret.strategi === 'krl') return buildLoenudviklingFromKRLV3(konsolideret);
    throw new Error('Loenudvikling kan ikke beregnes: ukendt strategi');
  })();

  if (loenreguleringssegmenter.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen reguleringssegmenter');
  }

  const beregnedeSegmenter: Array<LoenudviklingPdfModel['beregnedeSegmenter'][number]> = [];
  for (const segment of loenreguleringssegmenter) {
    const roundedDeltaPct = roundHalfAwayFromZero(segment.deltaPct, 2);
    if (tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER) {
      const maanederStats = beregnArbejdsdageOgMaaneder(
        segment.fra,
        segment.til,
        new Set<ISODateString>(),
        new Set<ISODateString>()
      );
      const maanederRaw = maanederStats.maaneder;
      if (!Number.isFinite(maanederRaw) || maanederRaw <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldigt maanedssegment');
      }
      const maaneder = Math.round(maanederRaw * 10_000) / 10_000;
      beregnedeSegmenter.push({
        kind: 'maaneder',
        fra: segment.fra,
        til: segment.til,
        maaneder,
        maanedsloenOre: baseLoenOre,
        deltaPct: roundedDeltaPct,
        amountOre: segmentAmountOreV3(baseLoenRounded, maaneder, roundedDeltaPct),
      });
    } else {
      if (!tafArbejdageSet) {
        throw new Error('Loenudvikling kan ikke beregnes: arbejdsdagegrundlag mangler');
      }
      const arbejdsdage = countTafArbejdsdageInRange(tafArbejdageSet, segment.fra, segment.til);
      if (!Number.isFinite(arbejdsdage) || arbejdsdage <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldigt arbejdsdagesegment');
      }
      beregnedeSegmenter.push({
        kind: 'arbejdsdage',
        fra: segment.fra,
        til: segment.til,
        arbejdsdage,
        dagsloenOre: baseLoenOre,
        deltaPct: roundedDeltaPct,
        amountOre: segmentAmountOreV3(baseLoenRounded, arbejdsdage, roundedDeltaPct),
      });
    }
  }

  if (beregnedeSegmenter.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen beregnede segmenter');
  }

  const totalOre = ensureMoneyOre(beregnedeSegmenter.reduce((sum, segment) => sum + segment.amountOre, 0));
  return { loenudviklingLabel, loenudviklingTotal: asCalculable(totalOre), beregningsenhed: tafBeregningsenhed, beregnedeSegmenter };
};

const buildTafIndtaegterModel = (values: ErstatningsopgoerelseValues, ranges: readonly IsoRange[]): TafIndtaegterPdfModel => {
  const indtaegter = buildIncomeForRanges(values, ranges);
  const entries: Array<{ label: string; amountOre: MoneyOre }> = [];
  indtaegter.employers.forEach((entry) => {
    const label = entry.name !== '' ? entry.name : 'Arbejdssted';
    entries.push({ label, amountOre: toOre(roundKroner(entry.amount)) });
  });
  indtaegter.benefits.forEach((entry) => {
    entries.push({ label: entry.label, amountOre: toOre(roundKroner(entry.amount)) });
  });

  // Ingen indtægter i TAF-perioden er gyldigt og opgøres som 0 kr.
  const totalOre = ensureMoneyOre(entries.reduce((acc, entry) => acc + entry.amountOre, 0));
  return {
    entries,
    total: asCalculable(totalOre),
  };
};
const buildTabtArbejdsfortjenesteModel = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues
): TabtArbejdsfortjenestePdfModel => {
  const statusLinjer: string[] = [];
  const periodeTilISO = values.vedroererPeriodeTil;
  if (values.tafArbejdsstatus && periodeTilISO) {
    const dagenEfter = formatDateLong(getDayAfter(periodeTilISO));
    statusLinjer.push(buildTafArbejdsstatusLinje(dagenEfter, values.tafArbejdsstatus));
  }

  const eetLinjer: string[] = [];
  if (values.endeligtEetAfgorelse === 'Ja') {
    if (values.endeligEETVirkningsdato) {
      const dato = formatDateLong(values.endeligEETVirkningsdato);
      const tekst = `Der er truffet endelig erhvervsevnetabsafgørelse med virkning fra ${dato}.`;
      eetLinjer.push(values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
    } else if (values.endeligEETAfgoerelseDato) {
      const dato = formatDateLong(values.endeligEETAfgoerelseDato);
      const tekst = `Der er den ${dato} truffet endelig erhvervsevnetabsafgørelse.`;
      eetLinjer.push(values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
    }
  } else if (values.midlertidigtEetAfgorelse === 'Ja') {
    if (values.midlertidigEETVirkningsdato) {
      const dato = formatDateLong(values.midlertidigEETVirkningsdato);
      const tekst = `Der er truffet midlertidig erhvervsevnetabsafgørelse med virkning fra ${dato}.`;
      eetLinjer.push(values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
    } else if (values.midlertidigEETAfgoerelseDato) {
      const dato = formatDateLong(values.midlertidigEETAfgoerelseDato);
      const tekst = `Der er den ${dato} truffet midlertidig erhvervsevnetabsafgørelse.`;
      eetLinjer.push(values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
    }
  } else if (values.opgørelseLavetDen) {
    const dato = formatDateLong(values.opgørelseLavetDen);
    const tekst = `Der er den ${dato} ikke truffet afgørelse om erhvervsevnetab med 15 % eller derover.`;
    eetLinjer.push(values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
  }

  const differencekravLinje = values.differencekravDato
    ? `Der er opgjort differencekrav i sagen den ${formatDateLong(values.differencekravDato)}.`
    : null;

  const tafPerioderLinjer = buildTafPerioderLinjer(values);
  const harTafPerioder = tafPerioderLinjer.length > 0;

  const tafBeregningsenhed = computeTafBeregningsenhed({
    beregnesUdFra: values.beregnesUdFra,
    loenindkomstAnsaettelsesforhold: values.loenindkomstAnsaettelsesforhold ?? [],
  });

  const erFoersteOpgoerelse = erDetteFoersteErstatningsopgoerelse(values.eoNummer);
  const skalKomprimereIndkomstBeregning =
    !erFoersteOpgoerelse && values.komprimerBeregningEfterFoersteOpgoerelse === 'Ja';

  const indkomstSkadestidspunkt = harTafPerioder
    ? buildIndkomstSkadestidspunkt(values, stamdataValues, tafBeregningsenhed)
    : null;
  const loenudvikling = harTafPerioder
    ? buildLoenudviklingModelV3(values, stamdataValues, tafBeregningsenhed, indkomstSkadestidspunkt)
    : null;

  const tafRanges = buildTafRanges(values);
  const tafIndtaegter = harTafPerioder ? buildTafIndtaegterModel(values, tafRanges) : null;

  let tabtArbejdsfortjenesteOre = ensureMoneyOre(0);
  if (harTafPerioder) {
    if (!loenudvikling) {
      throw new Error('Lønudvikling kunne ikke beregnes');
    }
    if (!tafIndtaegter) {
      throw new Error('Indtægter i TAF-perioden kunne ikke beregnes');
    }
    if (loenudvikling.loenudviklingTotal.status !== 'ok') {
      throw new Error('Loenudvikling kan ikke beregnes');
    }
    if (tafIndtaegter.total.status !== 'ok') {
      throw new Error('Indtaegter i TAF-perioden kan ikke beregnes');
    }
    tabtArbejdsfortjenesteOre = ensureMoneyOre(loenudvikling.loenudviklingTotal.value - tafIndtaegter.total.value);
  }

  return {
    statusLinjer,
    eetLinjer,
    differencekravLinje,
    tafPerioderLinjer,
    harTafPerioder,
    tafBeregningsenhed,
    skalKomprimereIndkomstBeregning,
    indkomstSkadestidspunkt,
    loenudvikling,
    tafIndtaegter,
    tabtArbejdsfortjenesteOre,
  };
};

const buildOevrigeKravModel = (rows: OevrigeKravRow[]): OevrigeKravPdfModel => {
  const entries: Array<{ dateText: string; udgiftTil: string; amountOre: MoneyOre }> = [];
  for (const row of rows) {
    if (isOevrigeKravRowEmpty(row)) continue;
    const dateText = row.dato ? formatDateShort(row.dato) : '';
    const udgiftTil = (row.udgiftTil ?? '').trim();
    const amountValue = amountValueToNumber(row.beloeb);
    if (dateText === '' || udgiftTil === '' || amountValue === undefined) {
      throw new Error('Øvrige krav er ikke fuldt udfyldt'); // invariant: dækket af validator
    }
    if (amountValue < 0) {
      throw new Error('Øvrige krav kan ikke være negativt'); // invariant: dækket af validator
    }
    const amountOre = toOre(amountValue);
    entries.push({ dateText, udgiftTil, amountOre });
  }

  const totalOre = ensureMoneyOre(entries.reduce((acc, entry) => acc + entry.amountOre, 0));
  return { entries, totalOre };
};

const buildAslReguleringsSegments = (ranges: readonly IsoRange[]): ReadonlyArray<IsoRange & { year: number }> => {
  const segments: Array<IsoRange & { year: number }> = [];
  for (const range of ranges) {
    let currentStart = range.fra;
    while (currentStart <= range.til) {
      const year = Number(currentStart.slice(0, 4));
      if (!Number.isFinite(year)) break;
      const yearEnd = `${year}-12-31` as ISODateString;
      const segmentEnd = range.til < yearEnd ? range.til : yearEnd;
      segments.push({ fra: currentStart, til: segmentEnd, year });
      const nextStartDate = getDayAfter(segmentEnd);
      if (nextStartDate <= currentStart) break;
      currentStart = nextStartDate;
    }
  }
  return segments;
};

const resolveReguleringsdato = (
  eoValues: ErstatningsopgoerelseValues,
  af: ReguleringsdatoInputV3 | undefined,
  skadesdato: ISODateString | undefined
): ISODateString | undefined => resolveReguleringsdatoShared({
  beregnesUdFra: eoValues.beregnesUdFra,
  angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(eoValues),
  saerligFraDatoRegulering: isISODateString(af?.saerligFraDatoRegulering) ? af.saerligFraDatoRegulering : undefined,
  skadesdato,
});

const resolveMaanedsloenBase = (
  eoValues: ErstatningsopgoerelseValues,
  indkomstSkadestidspunkt: IndkomstSkadestidspunktPdfModel | null
): number | null => {
  if (eoValues.beregnesUdFra === 'Angivet månedsløn') {
    const value = amountValueToNumber(eoValues.maanedsloenenUdgoer);
    return value !== undefined ? value : null;
  }
  if (eoValues.beregnesUdFra !== 'Beregningsperiode') return null;
  if (!indkomstSkadestidspunkt) return null;
  if (indkomstSkadestidspunkt.maanedsloen.status !== 'ok') return null;
  return fromOre(indkomstSkadestidspunkt.maanedsloen.value);
};

const resolveDagsloenBase = (
  eoValues: ErstatningsopgoerelseValues,
  indkomstSkadestidspunkt: IndkomstSkadestidspunktPdfModel | null
): number | null => {
  if (eoValues.beregnesUdFra === 'Angivet dagsløn') {
    const value = amountValueToNumber(eoValues.dagsloenenUdgoer);
    return value !== undefined ? value : null;
  }
  if (eoValues.beregnesUdFra !== 'Beregningsperiode') return null;
  if (!indkomstSkadestidspunkt) return null;
  if (indkomstSkadestidspunkt.dagsloen.status !== 'ok') return null;
  return fromOre(indkomstSkadestidspunkt.dagsloen.value);
};

const getDayAfter = (isoDate: ISODateString): ISODateString => {
  const date = parseISODate(isoDate);
  if (!date) return isoDate;
  const nextDate = addUtcDays(date, 1);
  return formatUtcToIso(nextDate);
};

export const buildErstatningsopgoerelsePdfModel = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  options: Readonly<{ dagsDatoISO: ISODateString }>
): PdfModel => {
  const stamdataParsed = stamdataSchema.safeParse(stamdataValues);
  const eoParsed = erstatningsopgoerelseSchema.safeParse(eoValues);
  if (!stamdataParsed.success || !eoParsed.success) {
    const errors = [
      ...(stamdataParsed.success ? [] : stamdataParsed.error.issues),
      ...(eoParsed.success ? [] : eoParsed.error.issues),
    ]
      .map((e) => e.message)
      .join('; ');
    throw new Error(`Ugyldigt input til PDF: ${errors}`);
  }

  const safeStamdata = stamdataParsed.data;
  const safeEo = eoParsed.data;

  const erRevideret = safeEo.revideretOpgoerelse === 'Ja';
  const revideretPrefix = erRevideret ? 'Revideret ' : '';
  const erstatningsord = erRevideret ? 'erstatningsopgørelse' : 'Erstatningsopgørelse';
  const nummer = safeEo.eoNummer || '';
  const ledsagetekst = safeEo.eoLedsagetekst ? ` (${safeEo.eoLedsagetekst})` : '';
  const titel = `${revideretPrefix}${erstatningsord} ${nummer}${ledsagetekst}`.trim();

  const periodeFra = safeEo.vedroererPeriodeFra;
  const periodeTil = safeEo.vedroererPeriodeTil;
  const periode = periodeFra && periodeTil ? { fra: periodeFra, til: periodeTil } : null;
  const periodeDisplay =
    periodeFra && periodeTil ? `${formatDateShort(periodeFra)} - ${formatDateShort(periodeTil)}` : null;

  const navn = (safeStamdata.skadelidte ?? '').trim();
  const skadestype = (safeStamdata.skadestype ?? '').trim();
  const skadesdato = formatDateLong(safeStamdata.skadesdato);
  const skadestypeLinje = skadestype && skadesdato
    ? `${skadestype} ${skadestype === 'Erhvervssygdom' ? 'anmeldt ' : ''}den ${skadesdato}`
    : null;

  const brevhoved = {
    journalnr: safeStamdata.journalnr,
    advokat: safeStamdata.advokat,
    sagsbehandler: safeStamdata.sagsbehandler,
    dagsDatoISO: safeEo.opgørelseLavetDen ?? options.dagsDatoISO,
  };

  const svieSmerte = buildSvieSmerteModel(safeEo, safeStamdata);
  const tabtArbejdsfortjeneste = buildTabtArbejdsfortjenesteModel(safeEo, safeStamdata);
  const oevrigeKrav = buildOevrigeKravModel(safeEo.oevrigeKravPerioder ?? []);

  const totalOre = ensureMoneyOre(
    svieSmerte.totalOre + tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre + oevrigeKrav.totalOre
  );
  const samlet = {
    svieSmerteOre: svieSmerte.totalOre,
    tabtArbejdsfortjenesteOre: tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre,
    oevrigeKravOre: oevrigeKrav.totalOre,
    totalOre,
  };

  return {
    titel,
    titelMetadata: titel,
    periode,
    periodeDisplay,
    skadelidteNavn: navn !== '' ? navn : null,
    skadestypeLinje,
    brevhoved,
    svieSmerte,
    tabtArbejdsfortjeneste,
    oevrigeKrav,
    samlet,
    saerligeKommentarer: (safeEo.saerligeKommentarer ?? '').trim() || null,
  };
};
