import type { ErstatningsopgoerelseValues, StamdataValues, SvieSmertePeriodeRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { DeepReadonly } from '../../types/deepReadonly';
import { dateToISO, isISODateString, subtractOneDay } from '../../types/branded';
import { svieSmerteMax, svieSmertePrDag } from '../../data/regulationRates';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { detectOverlappingPeriods } from './periodOverlapDetection';
import { countInclusiveUtcDays } from '../../utils/utcDayMath';
import { isoDateToDate } from '../dates/isoDate';
import { addDays } from '../../utils/dateUtils';
import { isSvieSmerteRowEmpty } from './rowEmpty';
import { parseForligsgrad } from './forligsgrad';
import type { MoneyOre } from './eoPdfModelTypes';
import { clampMoneyOreToZero, ensureMoneyOre, fromOre, roundKroner, toOre } from './eoPdfMoneyUtils';

export type SvieSmerteConstrainedPeriod = Readonly<{
  fra: ISODateString;
  til: ISODateString;
  isDelvist: boolean;
}>;

export type SvieSmerteEngineOutput = Readonly<{
  constrainedPeriods: ReadonlyArray<SvieSmerteConstrainedPeriod>;
  harInputPerioder: boolean;
  harPerioder: boolean;
  opgjortFremTilPeriodeTil: boolean;
  satserAar: number | null;
  satserPerDagOre: MoneyOre | null;
  satserMaxOre: MoneyOre | null;
  forligLabel: string | null;
  forligSatserSuffix: string | null;
  forligFactor: number | null;
  satserPerDagFoerForligOre: MoneyOre | null;
  satserMaxFoerForligOre: MoneyOre | null;
  tidligereOre: MoneyOre | null;
  aktuelOre: MoneyOre | null;
  sygedage: number;
  delviseSygedage: number;
  delvisFaktor: 1 | 0.5;
  maxApplied: boolean;
  totalOre: MoneyOre;
}>;

export type SvieSmerteEngineInputSnapshot = Readonly<{
  erstatningsopgoerelse: DeepReadonly<ErstatningsopgoerelseValues>;
  stamdata?: DeepReadonly<Pick<StamdataValues, 'skadesdato' | 'skadestype'>> | null;
}>;

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

const perioderCoverDate = (perioder: Array<{ fra: Date; til: Date }>, target: ISODateString): boolean => {
  const targetDate = isoDateToDate(target);
  for (const periode of perioder) {
    if (periode.fra <= targetDate && periode.til >= targetDate) return true;
  }
  return false;
};

const validateSvieSmertePerioder = (
  values: DeepReadonly<ErstatningsopgoerelseValues>,
  _context: Readonly<{
    skadesdatoISO: ISODateString | undefined;
    erErhvervssygdom: boolean;
    menAfgoerelseDatoForTabel: ISODateString | undefined;
    verserendeKlageMen: boolean;
  }>
): SvieSmertePeriodeRow[] => {
  const perioder = values.svieSmertePerioder ?? [];
  const nonEmpty = perioder.filter((row) => !isSvieSmerteRowEmpty(row));
  if (nonEmpty.length === 0) return [];

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

    if (overlapIds.has(periode.id)) {
      throw new Error('Svie/smerte-perioder overlapper');
    }
  }

  return nonEmpty;
};

export const computeSvieSmerteEngine = (input: SvieSmerteEngineInputSnapshot): SvieSmerteEngineOutput => {
  const values = input.erstatningsopgoerelse;

  const periodeSynlig = values.beregnesSvieSmerteGodtgoerelse === 'Ja' && values.tidligereSsMax === 'Nej';
  const context = {
    skadesdatoISO: isISODateString(input.stamdata?.skadesdato) ? input.stamdata.skadesdato : undefined,
    erErhvervssygdom: input.stamdata?.skadestype === 'Erhvervssygdom',
    menAfgoerelseDatoForTabel:
      values.varigeMenAfgorelse === 'Ja' ? subtractOneDay(values.menAfgoerelseDato) : undefined,
    verserendeKlageMen: values.verserendeKlageMen === 'Ja',
  };

  const perioder = periodeSynlig ? validateSvieSmertePerioder(values, context) : [];
  const harInputPerioder = perioder.length > 0;

  const vedroererFra = values.vedroererPeriodeFra;
  const vedroererTil = values.vedroererPeriodeTil;
  if (harInputPerioder && (!vedroererFra || !vedroererTil)) {
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
        if (fra > til) continue;
        constrained.push({ fra, til, isDelvist });
      }
    };

    applyConstraint(sygemeldtPeriods, false);
    applyConstraint(delvistPeriods, true);
  }

  constrained.sort((a, b) => a.fra.getTime() - b.fra.getTime());

  const constrainedPeriods: SvieSmerteConstrainedPeriod[] = constrained.map((p) => {
    const fra = dateToISO(p.fra);
    const til = dateToISO(p.til);
    if (!fra || !til) throw new Error('Ugyldig periode for svie/smerte');
    return { fra, til, isDelvist: p.isDelvist };
  });

  const harPerioder = constrainedPeriods.length > 0;
  const opgjortFremTilPeriodeTil = harPerioder && vedroererTil ? perioderCoverDate(constrained, vedroererTil) : false;

  const sygedage = constrained
    .filter((p) => !p.isDelvist)
    .reduce((sum, p) => sum + (countInclusiveUtcDays(p.fra, p.til) ?? 0), 0);
  const delviseSygedage = constrained
    .filter((p) => p.isDelvist)
    .reduce((sum, p) => sum + (countInclusiveUtcDays(p.fra, p.til) ?? 0), 0);

  const satserAarValue = values.svieSmerteSatserAar;
  if (harInputPerioder && typeof satserAarValue !== 'number') {
    throw new Error('År for svie/smerte-sats mangler');
  }

  const delvisFaktor: 1 | 0.5 = values.svieSmerteDelvisSygemeldingSats === 'fuld' ? 1 : 0.5;
  if (harInputPerioder && !values.svieSmerteDelvisSygemeldingSats) {
    throw new Error('Sats ved delvis sygemelding mangler');
  }

  let satserPerDagOre: MoneyOre | null = null;
  let satserMaxOre: MoneyOre | null = null;
  const parsedForlig = parseForligsgrad(values);
  let forligLabel: string | null = parsedForlig?.label ?? null;
  let forligSatserSuffix: string | null = parsedForlig ? ` (forlig på ${parsedForlig.label})` : null;
  let forligFactor: number | null = parsedForlig?.factor ?? null;
  let satserPerDagFoerForligOre: MoneyOre | null = null;
  let satserMaxFoerForligOre: MoneyOre | null = null;

  if (harInputPerioder && typeof satserAarValue === 'number') {
    const satsPerDag = svieSmertePrDag[satserAarValue as keyof typeof svieSmertePrDag];
    const satsMax = svieSmerteMax[satserAarValue as keyof typeof svieSmerteMax];
    if (!satsPerDag || !satsMax) {
      throw new Error(`Ingen svie/smerte satser for år ${satserAarValue}`);
    }
    satserPerDagFoerForligOre = toOre(roundKroner(satsPerDag));
    satserMaxFoerForligOre = toOre(roundKroner(satsMax));
    const forlig = parsedForlig;
    const perDagKroner = forlig ? satsPerDag * forlig.factor : satsPerDag;
    const maxKroner = forlig ? satsMax * forlig.factor : satsMax;
    satserPerDagOre = toOre(roundKroner(perDagKroner));
    satserMaxOre = toOre(roundKroner(maxKroner));
  }

  const tidligereKroner = amountValueToNumber(values.svieSmerteTidligereTotal);
  const aktuelKroner = amountValueToNumber(values.svieSmerteAktuelPeriode);
  const tidligereOre = tidligereKroner !== undefined ? toOre(tidligereKroner) : null;
  const aktuelOre = aktuelKroner !== undefined ? toOre(aktuelKroner) : null;

  let totalOre = ensureMoneyOre(0);
  let maxApplied = false;

  if (harPerioder) {
    if (satserPerDagOre === null || satserMaxOre === null) {
      throw new Error('Satser mangler for svie/smerte');
    }
    const perDagKroner = fromOre(satserPerDagOre);
    const maxKroner = fromOre(satserMaxOre);
    const rawKroner = (sygedage * perDagKroner) + (delviseSygedage * delvisFaktor * perDagKroner);
    const tidligereValue = tidligereKroner ?? 0;
    const allerede = aktuelKroner ?? 0;
    const restPlads = maxKroner - tidligereValue;
    const beloebFoerFradrag = Math.min(rawKroner, Math.max(0, restPlads));
    maxApplied = rawKroner > Math.max(0, restPlads);
    const beloeb = Math.max(0, beloebFoerFradrag - allerede);
    totalOre = clampMoneyOreToZero(toOre(roundKroner(beloeb)));
  }

  return {
    constrainedPeriods,
    harInputPerioder,
    harPerioder,
    opgjortFremTilPeriodeTil,
    satserAar: typeof satserAarValue === 'number' ? satserAarValue : null,
    satserPerDagOre,
    satserMaxOre,
    forligLabel,
    forligSatserSuffix,
    forligFactor,
    satserPerDagFoerForligOre,
    satserMaxFoerForligOre,
    tidligereOre,
    aktuelOre,
    sygedage,
    delviseSygedage,
    delvisFaktor,
    maxApplied,
    totalOre: clampMoneyOreToZero(totalOre),
  };
};

export const getDayAfterIso = (isoDate: ISODateString): ISODateString => {
  const date = isoDateToDate(isoDate);
  const nextDate = addDays(date, 1);
  const iso = dateToISO(nextDate);
  if (!iso) {
    throw new Error('Kunne ikke formatere ISO-dato i getDayAfterIso.');
  }
  return iso;
};
