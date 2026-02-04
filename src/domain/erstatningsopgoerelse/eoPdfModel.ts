import type { ISODateString } from '../../types/branded';
import { dateToISO, isoToDanish, isISODateString, subtractOneDay } from '../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues, SvieSmertePeriodeRow, TafPeriodeRow, OevrigeKravRow } from '../../schemas/formSchemas';
import { erstatningsopgoerelseSchema, stamdataSchema } from '../../schemas/formSchemas';
import { svieSmerteMax, svieSmertePrDag, aarsloenMax } from '../../data/regulationRates';
import { MONTH_NAMES_DA } from '../../utils/dateFormatting';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { calculateAarsloenRowDerived, isAarsloenRowEffectivelyEmpty } from '../../utils/aarsloenTableCalculations';
import { formatPercent, roundHalfAwayFromZero } from '../../utils/formatUtils';
import { buildIncomeForRanges, buildTafRanges, type IsoRange } from './indtaegtPerioder';
import { calculateTafAntalMaaneder } from './tafCalculations';
import { beregnArbejdsdageOgMaaneder } from './arbejdsdageMaaneder';
import { computeSkadesdatoMinRule, dateRanges_erstatningsopgoerelse } from '../../config/dateRanges';
import { computeRowDateBounds } from './rowDateBounds';
import { validateISODateRange } from '../../utils/dateValidation';
import { detectOverlappingPeriods } from './periodOverlapDetection';
import { countInclusiveUtcDays } from '../../utils/utcDayMath';
import { isoDateToDate } from '../dates/isoDate';
import { isOevrigeKravRowEmpty, isSvieSmerteRowEmpty, isTafRowEmpty } from './rowEmpty';

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
  indkomstSkadestidspunkt: IndkomstSkadestidspunktPdfModel | null;
  loenudvikling: LoenudviklingPdfModel | null;
  tafIndtaegter: TafIndtaegterPdfModel | null;
  tabtArbejdsfortjenesteOre: MoneyOre;
}>;

export type IndkomstSkadestidspunktPdfModel = Readonly<{
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
  maaneder: number | null;
  maanedsloen: Calculable<MoneyOre>;
  dagsloen: Calculable<MoneyOre>;
  beregningsperiodeLabel: string | null;
}>;

export type LoenudviklingPdfModel = Readonly<{
  loenudviklingLabel: string;
  loenudviklingTotal: Calculable<MoneyOre>;
  beregnedeSegmenter: readonly {
    fra: ISODateString;
    til: ISODateString;
    maaneder: number;
    maanedsloenOre: MoneyOre;
    deltaPct: number;
    amountOre: MoneyOre;
  }[];
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
const roundKroner = (value: number): number => roundHalfAwayFromZero(value, 2);

const toOre = (value: MoneyKroner): MoneyOre => {
  if (!Number.isFinite(value)) {
    throw new Error('Ugyldigt beløb: ikke et endeligt tal');
  }
  const scaled = value * 100;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-6) {
    throw new Error('Beløb har flere end 2 decimaler');
  }
  return ensureMoneyOre(rounded);
};

const formatPercentFixed2 = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  return `${value.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
};

const asCalculable = <T>(value: T): Calculable<T> => ({ status: 'ok', value });

const notCalculable = <T>(reason: string): Calculable<T> => {
  return { status: 'not_calculable', reason };
};

const notCalculableMoney = (reason: string): Calculable<MoneyOre> => notCalculable<MoneyOre>(reason);

const fromOre = (value: MoneyOre): MoneyKroner => value / 100;

const formatDateShort = (isoDate: ISODateString | undefined): string => {
  if (!isoDate) return '';
  const danish = isoToDanish(isoDate);
  return danish ?? '';
};

const formatDateLong = (isoDate: ISODateString | undefined): string => {
  if (!isoDate) return '';
  const danish = isoToDanish(isoDate);
  if (!danish) return '';
  const [day, month, year] = danish.split('-');
  const d = Number.parseInt(day, 10);
  const m = Number.parseInt(month, 10) - 1;
  if (!Number.isFinite(d) || !Number.isFinite(m) || !year) return '';
  return `${d}. ${MONTH_NAMES_DA[m]} ${year}`;
};

const parseForligsgrad = (values: ErstatningsopgoerelseValues): { factor: number | null; label: string | null } => {
  const procentValue = values.forligAnsvarsgradProcent;
  if (typeof procentValue === 'number' && Number.isFinite(procentValue)) {
    return { factor: procentValue / 100, label: ` (forlig på ${procentValue}%)` };
  }

  const broekValue = values.forligAnsvarsgradBroek;
  if (typeof broekValue === 'string' && broekValue.trim() !== '') {
    const parts = broekValue.trim().split('/');
    if (parts.length === 2) {
      const taeller = Number.parseFloat(parts[0]);
      const naevner = Number.parseFloat(parts[1]);
      if (Number.isFinite(taeller) && Number.isFinite(naevner) && naevner !== 0) {
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
      throw new Error('Svie/smerte-periode er ikke fuldt udfyldt');
    }

    const fraISO = periode.fra;
    const tilISO = periode.til;
    if (!isISODateString(fraISO) || !isISODateString(tilISO)) {
      throw new Error('Svie/smerte-periode har ugyldig dato');
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
      throw new Error('Svie/smerte-perioder overlapper');
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

  if (varigeMenAfgorelse === 'Nej' && opgLavetDen) {
    const dato = formatDateLong(opgLavetDen);
    const tekst = `Der er den ${dato} ikke truffet afgørelse om varige mén.`;
    statusLinjer.push(verserendeKlageMen === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
  } else if (varigeMenAfgorelse === 'Ja' && menDato) {
    const dato = formatDateLong(menDato);
    const tekst = `Der er den ${dato} truffet afgørelse om varige mén.`;
    statusLinjer.push(verserendeKlageMen === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
  }

  const periodeSynlig = beregnes && values.tidligereSsMax === 'Nej';
  const context = {
    skadesdatoISO: stamdataValues.skadesdato,
    erErhvervssygdom: stamdataValues.skadestype === 'Erhvervssygdom',
    menAfgoerelseDatoForTabel:
      values.varigeMenAfgorelse === 'Ja' ? subtractOneDay(values.menAfgoerelseDato) : undefined,
    verserendeKlageMen: values.verserendeKlageMen === 'Ja',
  };

  const perioder = periodeSynlig ? validateSvieSmertePerioder(values, context) : [];
  const harPerioder = perioder.length > 0;

  const periodeHeading =
    perioder.length > 1
      ? 'Sygeperioder, hvor der beregnes svie- og smertegodtgørelse'
      : 'Sygeperiode, hvor der beregnes svie- og smertegodtgørelse';

  const vedroererFra = values.vedroererPeriodeFra;
  const vedroererTil = values.vedroererPeriodeTil;
  if (harPerioder && (!vedroererFra || !vedroererTil)) {
    throw new Error('Vedrører perioden mangler for svie/smerte');
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
  if (harPerioder && vedroererFra && vedroererTil) {
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

  if (varigeMenAfgorelse === 'Ja' && menDato) {
    const ophoerDato = subtractOneDay(menDato as ISODateString);
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
  if (harPerioder && typeof satserAarValue !== 'number') {
    throw new Error('År for svie/smerte-sats mangler');
  }

  const delvisFaktor: 1 | 0.5 = values.svieSmerteDelvisSygemeldingSats === 'fuld' ? 1 : 0.5;
  if (harPerioder && !values.svieSmerteDelvisSygemeldingSats) {
    throw new Error('Sats ved delvis sygemelding mangler');
  }

  let satserPerDag: Calculable<MoneyOre> = notCalculableMoney('Satser kan ikke beregnes');
  let satserMax: Calculable<MoneyOre> = notCalculableMoney('Satser kan ikke beregnes');
  let forligLabel: string | null = null;
  if (harPerioder && typeof satserAarValue === 'number') {
    const satsPerDag = svieSmertePrDag[satserAarValue as keyof typeof svieSmertePrDag];
    const satsMax = svieSmerteMax[satserAarValue as keyof typeof svieSmerteMax];
    if (!satsPerDag || !satsMax) {
      throw new Error(`Ingen svie/smerte satser for år ${satserAarValue}`);
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

const buildTafPerioderLinjer = (rows: TafPeriodeRow[]): string[] => {
  const nonEmpty = rows.filter((row) => !isTafRowEmpty(row));
  if (nonEmpty.length === 0) return [];

  const lines: string[] = [];
  for (const row of nonEmpty) {
    const fra = row.fra;
    const til = row.til;
    if (!fra || !til) {
      throw new Error('TAF-periode mangler fra/til');
    }
    if (!isISODateString(fra) || !isISODateString(til) || fra > til) {
      throw new Error('TAF-periode er ugyldig');
    }
    const fraText = formatDateShort(fra);
    const tilText = formatDateShort(til);
    if (!fraText || !tilText) {
      throw new Error('TAF-periode er ugyldig');
    }
    lines.push(`${fraText} - ${tilText}`);
  }
  return lines;
};
const buildIndkomstSkadestidspunkt = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues
): IndkomstSkadestidspunktPdfModel | null => {
  const beregnesUdFra = values.beregnesUdFra;
  const loenBaseretPaa = values.loenBaseretPaa?.trim() ?? '';
  const skadesdato = isISODateString(stamdataValues.skadesdato) ? stamdataValues.skadesdato : null;

  const periodeTilBeregningFra = values.periodeTilBeregningFra;
  const periodeTilBeregningTil = values.periodeTilBeregningTil;
  const periodeTilBeregning =
    periodeTilBeregningFra && periodeTilBeregningTil
      ? { fra: periodeTilBeregningFra, til: periodeTilBeregningTil }
      : null;

  const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
  const ansaettelserMedData = ansaettelser.filter((af) =>
    (af.indtaegtsoplysningerTableData ?? []).some((row) => !isAarsloenRowEffectivelyEmpty(row))
  );
  const ansaettelserNavne = ansaettelserMedData
    .map((af) => (af.navnPaaArbejdssted ?? '').trim())
    .filter((value, index, arr) => value !== '' && arr.indexOf(value) === index);

  const arbejdssteder: Array<IndkomstSkadestidspunktPdfModel['arbejdssteder'][number]> = [];
  let totalBreakdown: IndkomstSkadestidspunktPdfModel['totalBreakdown'] = null;
  let maaneder: number | null = null;
  let maanedsloen: Calculable<MoneyOre> = notCalculableMoney('Ikke angivet');
  let dagsloen: Calculable<MoneyOre> = notCalculableMoney('Ikke angivet');
  let beregningsperiodeLabel: string | null = null;

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
        if (isAarsloenRowEffectivelyEmpty(row)) continue;
        const derived = calculateAarsloenRowDerived(row, satser);
        const atp = amountValueToNumber(row.col5) ?? 0;
        acc.ferieberet += derived.ferieberet;
        acc.fpFvShSo += derived.fpFvShSo;
        acc.pension += derived.pension;
        acc.atp += atp;
        acc.samlet += derived.samlet;

        perEmployment.ferieberet += derived.ferieberet;
        perEmployment.fpFvShSo += derived.fpFvShSo;
        perEmployment.pension += derived.pension;
        perEmployment.atp += atp;
        perEmployment.samlet += derived.samlet;
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
    beregnesUdFra,
    loenBaseretPaa: loenBaseretPaa !== '' ? loenBaseretPaa : null,
    skadesdato,
    periodeTilBeregning,
    ansaettelserNavne,
    arbejdssteder,
    totalBreakdown,
    maaneder,
    maanedsloen,
    dagsloen,
    beregningsperiodeLabel,
  };
};

const buildLoenudviklingModel = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues
): LoenudviklingPdfModel => {
  const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
  const aktiv = ansaettelser.filter((af) => af.loenudviklingBeregningsgrundlag && af.loenudviklingBeregningsgrundlag !== 'Ingen');
  const basis = aktiv[0]?.loenudviklingBeregningsgrundlag;
  const model = aktiv[0]?.loenudviklingStatistikModel ?? '';
  const ensartet = aktiv.every((af) =>
    af.loenudviklingBeregningsgrundlag === basis &&
    (af.loenudviklingStatistikModel ?? '') === model
  );

  const loenudviklingLabel = (() => {
    if (!basis) return '-';
    if (basis === 'Statistik' && model.trim() !== '') return model.trim();
    if (basis === 'Manuelt angivet') {
      const manuel = aktiv[0]?.loenudviklingManuelNavn?.trim();
      return manuel && manuel !== '' ? manuel : 'Manuelt angivet';
    }
    return basis;
  })();

  const skadesdato = isISODateString(stamdataValues.skadesdato) ? stamdataValues.skadesdato : undefined;
  const reguleringsdato = resolveReguleringsdato(values, aktiv[0], skadesdato);
  const reguleringsYear = reguleringsdato ? Number(reguleringsdato.slice(0, 4)) : NaN;
  const baseIndexValue = Number.isFinite(reguleringsYear)
    ? aarsloenMax[reguleringsYear as keyof typeof aarsloenMax]
    : undefined;
  const maanedsloenBase = resolveMaanedsloenBase(values);

  const tafRanges = buildTafRanges(values);
  const canBuildAsl =
    ensartet &&
    basis === 'Statistik' &&
    loenudviklingLabel.startsWith('ASL-') &&
    typeof baseIndexValue === 'number' &&
    baseIndexValue > 0 &&
    typeof maanedsloenBase === 'number' &&
    maanedsloenBase > 0 &&
    tafRanges.length > 0;

  if (!canBuildAsl) {
    return { loenudviklingLabel, loenudviklingTotal: notCalculableMoney('Kan ikke beregnes'), beregnedeSegmenter: [] };
  }

  if (typeof maanedsloenBase !== 'number') {
    throw new Error('Månedsløn kan ikke beregnes for lønudvikling');
  }

  const segments = buildAslReguleringsSegments(tafRanges);
  const beregnedeSegmenter: Array<LoenudviklingPdfModel['beregnedeSegmenter'][number]> = [];
  let total = 0;

  for (const segment of segments) {
    const indexValue = aarsloenMax[segment.year as keyof typeof aarsloenMax];
    if (typeof indexValue !== 'number' || indexValue <= 0) continue;

    const maanederStats = beregnArbejdsdageOgMaaneder(
      segment.fra,
      segment.til,
      new Set<ISODateString>(),
      new Set<ISODateString>()
    );
    const maaneder = maanederStats.maaneder;
    if (!Number.isFinite(maaneder) || maaneder <= 0) continue;

    const deltaPct = (indexValue / baseIndexValue - 1) * 100;
    const amount = maanedsloenBase * maaneder * (1 + deltaPct / 100);
    total += amount;

    beregnedeSegmenter.push({
      fra: segment.fra,
      til: segment.til,
      maaneder,
      maanedsloenOre: toOre(roundKroner(maanedsloenBase)),
      deltaPct,
      amountOre: toOre(roundKroner(amount)),
    });
  }

  return {
    loenudviklingLabel,
    loenudviklingTotal: asCalculable(toOre(roundKroner(total))),
    beregnedeSegmenter,
  };
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

  const totalOre = entries.length > 0
    ? ensureMoneyOre(entries.reduce((acc, entry) => acc + entry.amountOre, 0))
    : null;
  return {
    entries,
    total: totalOre !== null ? asCalculable(totalOre) : notCalculableMoney('Ingen indtægter'),
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
    switch (values.tafArbejdsstatus) {
      case 'Uarbejdsdygtig':
        statusLinjer.push(`Den ${dagenEfter} var skadelidte fortsat uarbejdsdygtig.`);
        break;
      case 'Delvist raskmeldt':
        statusLinjer.push(`Den ${dagenEfter} var skadelidte fortsat delvist uarbejdsdygtig.`);
        break;
      case 'Fuldt arbejdsdygtig':
        statusLinjer.push(`Den ${dagenEfter} var skadelidte fuldt arbejdsdygtig.`);
        break;
      case 'Fleksjob':
        statusLinjer.push(`Den ${dagenEfter} var skadelidte i fleksjob.`);
        break;
      case 'Revalidering':
        statusLinjer.push(`Den ${dagenEfter} var skadelidte i revalidering.`);
        break;
      case 'Uddannelse':
        statusLinjer.push(`Den ${dagenEfter} var skadelidte i uddannelse.`);
        break;
      case 'Førtidspension':
        statusLinjer.push(`Den ${dagenEfter} var skadelidte på førtidspension.`);
        break;
      case 'Seniorpension':
        statusLinjer.push(`Den ${dagenEfter} var skadelidte på seniorpension.`);
        break;
      case 'Folkepension':
        statusLinjer.push(`Den ${dagenEfter} var skadelidte på folkepension.`);
        break;
      default:
        break;
    }
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

  const tafPerioderLinjer = buildTafPerioderLinjer(values.tafPerioder ?? []);
  const harTafPerioder = tafPerioderLinjer.length > 0;

  const indkomstSkadestidspunkt = harTafPerioder ? buildIndkomstSkadestidspunkt(values, stamdataValues) : null;
  const loenudvikling = harTafPerioder ? buildLoenudviklingModel(values, stamdataValues) : null;

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
    if (loenudvikling.loenudviklingTotal.status !== 'ok' || tafIndtaegter.total.status !== 'ok') {
      throw new Error('TAF total kan ikke beregnes');
    }
    tabtArbejdsfortjenesteOre = ensureMoneyOre(loenudvikling.loenudviklingTotal.value - tafIndtaegter.total.value);
  }

  return {
    statusLinjer,
    eetLinjer,
    differencekravLinje,
    tafPerioderLinjer,
    harTafPerioder,
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
      throw new Error('Øvrige krav er ikke fuldt udfyldt');
    }
    if (amountValue < 0) {
      throw new Error('Øvrige krav kan ikke være negativt');
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
  af: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number] | undefined,
  skadesdato: ISODateString | undefined
): ISODateString | undefined => {
  const saerligDato = isISODateString(af?.saerligFraDatoRegulering)
    ? af?.saerligFraDatoRegulering
    : undefined;
  const angivetLoenDato = isISODateString(eoValues.angivetLoenOpreguleresFraDato)
    ? eoValues.angivetLoenOpreguleresFraDato
    : undefined;
  if (eoValues.beregnesUdFra !== 'Beregningsperiode') {
    return angivetLoenDato ?? skadesdato;
  }
  return saerligDato ?? skadesdato;
};

const resolveMaanedsloenBase = (eoValues: ErstatningsopgoerelseValues): number | null => {
  if (eoValues.beregnesUdFra === 'Angivet månedsløn') {
    const value = amountValueToNumber(eoValues.maanedsloenenUdgoer);
    return value !== undefined ? value : null;
  }
  if (eoValues.beregnesUdFra !== 'Beregningsperiode') return null;

  let total = 0;
  for (const af of eoValues.loenindkomstAnsaettelsesforhold ?? []) {
    const rows = af.indtaegtsoplysningerTableData ?? [];
    const satser = {
      feriePct: af.feriePct,
      fritvalgPct: af.fritvalgPct,
      shSoPct: af.shSoPct,
      storeBededagPct: af.storeBededagPct,
      pensionPct: af.pensionPct,
    };
    for (const row of rows) {
      if (isAarsloenRowEffectivelyEmpty(row)) continue;
      const derived = calculateAarsloenRowDerived(row, satser);
      total += derived.samlet;
    }
  }

  const periodeFra = eoValues.periodeTilBeregningFra;
  const periodeTil = eoValues.periodeTilBeregningTil;
  if (!periodeFra || !periodeTil || periodeFra > periodeTil) return null;
  const oevrigeFravaersdageValue =
    eoValues.oevrigtFravaerUdenLoen === 'Ja' && typeof eoValues.oevrigeFravaersdage === 'number'
      ? eoValues.oevrigeFravaersdage
      : 0;
  const maaneder = calculateTafAntalMaaneder(
    periodeFra,
    periodeTil,
    eoValues.fravaerPerioder ?? [],
    typeof eoValues.uspecificeredeFerieFridage === 'number' ? eoValues.uspecificeredeFerieFridage : 0,
    oevrigeFravaersdageValue
  );
  if (!maaneder || maaneder <= 0) return null;
  return total / maaneder;
};

const getDayAfter = (isoDate: ISODateString): ISODateString => {
  const danish = isoToDanish(isoDate);
  if (!danish) return isoDate;
  const [day, month, year] = danish.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}` as ISODateString;
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
