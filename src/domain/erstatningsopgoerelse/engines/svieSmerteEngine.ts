import type { ErstatningsopgoerelseValues, StamdataValues, SvieSmertePeriodeRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import type { DeepReadonly } from '../../../types/deepReadonly';
import { dateToISO, isISODateString } from '../../../types/branded';
import {
  clampSvieSmerteRange,
  resolveSvieSmerteEoPeriodeBounds,
  resolveSvieSmerteFejlgivendeBounds,
} from '../validation/svieSmerteConstraints';
import { svieSmerteMax, svieSmertePrDag } from '../../../data/lovbestemteRates';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { detectOverlappingPeriods } from './periodOverlapDetection';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';
import { clampToNonNegative } from '../../../utils/numberComparison';
import { isoDateToDate } from '../../dates/isoDate';
import { perioderCoverDate } from '../helpers/eoSharedUtils';
import { isSvieSmerteRowEmpty } from '../helpers/rowEmpty';
import { parseForligsgrad } from './forligsgrad';
import type { MoneyOre } from '../../money/money';
import {
  clampMoneyOreToZero,
  fromKroner,
  roundKroner,
  scaleMoneyOre,
  toKroner,
  zeroMoneyOre,
} from '../../money/money';
import { mergeDateRanges } from './isoRangeAlgebra';

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
  erstatningsopgoerelse: DeepReadonly<SvieSmerteCalculationValues>;
  stamdata?: DeepReadonly<Pick<StamdataValues, 'skadedato' | 'skadestype'>> | null;
}>;

export type SvieSmerteCalculationValues = Pick<
  ErstatningsopgoerelseValues,
  | 'kravPaaSvieSmerteGodtgoerelse'
  | 'tidligereSsMax'
  | 'svieSmertePerioder'
  | 'vedroererPeriodeFra'
  | 'vedroererPeriodeTil'
  | 'menAfgoerelseDato'
  | 'varigeMenAfgorelse'
  | 'verserendeKlageMen'
  | 'svieSmerteSatserAar'
  | 'svieSmerteDelvisSygemeldingSats'
  | 'svieSmerteTidligereTotal'
  | 'svieSmerteAktuelPeriode'
  | 'forligAnsvarsgradProcent'
  | 'forligAnsvarsgradBroek'
>;

/**
 * Filtrerer svie/smerte-perioder til gyldige, komplete og ikke-overlappende rækker.
 * Returnerer null hvis input er ugyldigt på en måde der forhindrer beregning
 * (overlap, ufuldstændige rækker, ugyldige datoer). Kaster ikke — fejl rapporteres
 * via validator/invariants.
 */
const filterValidSvieSmertePerioder = (
  values: DeepReadonly<SvieSmerteCalculationValues>,
): SvieSmertePeriodeRow[] | null => {
  const perioder = values.svieSmertePerioder ?? [];
  const nonEmpty = perioder.filter((row) => !isSvieSmerteRowEmpty(row));
  if (nonEmpty.length === 0) return [];

  // Tjek for ufuldstændige rækker eller ugyldige datoer
  for (const periode of nonEmpty) {
    const hasFra = typeof periode.fra === 'string' && periode.fra.trim() !== '' && isISODateString(periode.fra);
    const hasTil = typeof periode.til === 'string' && periode.til.trim() !== '' && isISODateString(periode.til);
    const hasTilstand = typeof periode.tilstand === 'string' && periode.tilstand.trim() !== '';
    if (!hasFra || !hasTil || !hasTilstand) return null;
  }

  // Tjek for overlap — ved overlap kan perioder ikke aggregeres korrekt
  const overlapIds = detectOverlappingPeriods(nonEmpty);
  if (overlapIds.size > 0) return null;

  return nonEmpty;
};

/**
 * Returnerer en nul-output for svie/smerte-engine.
 * Bruges når perioder er ugyldige/ufuldstændige/overlappende eller satser mangler.
 * Fejl rapporteres via validator/invariants — engineen kaster ikke.
 */
const buildZeroOutput = (values: DeepReadonly<SvieSmerteCalculationValues>): SvieSmerteEngineOutput => {
  const parsedForlig = parseForligsgrad(values);
  const tidligereKroner = amountValueToNumber(values.svieSmerteTidligereTotal);
  const aktuelKroner = amountValueToNumber(values.svieSmerteAktuelPeriode);
  return {
    constrainedPeriods: [],
    harInputPerioder: false,
    harPerioder: false,
    opgjortFremTilPeriodeTil: false,
    satserAar: typeof values.svieSmerteSatserAar === 'number' ? values.svieSmerteSatserAar : null,
    satserPerDagOre: null,
    satserMaxOre: null,
    forligLabel: parsedForlig?.label ?? null,
    forligSatserSuffix: parsedForlig ? ` (forlig på ${parsedForlig.label})` : null,
    forligFactor: parsedForlig?.factor ?? null,
    satserPerDagFoerForligOre: null,
    satserMaxFoerForligOre: null,
    tidligereOre: tidligereKroner !== undefined ? fromKroner(tidligereKroner) : null,
    aktuelOre: aktuelKroner !== undefined ? fromKroner(aktuelKroner) : null,
    sygedage: 0,
    delviseSygedage: 0,
    delvisFaktor: values.svieSmerteDelvisSygemeldingSats === 'fuld' ? 1 : 0.5,
    maxApplied: false,
    totalOre: zeroMoneyOre(),
  };
};

export const computeSvieSmerteEngine = (input: SvieSmerteEngineInputSnapshot): SvieSmerteEngineOutput => {
  const values = input.erstatningsopgoerelse;

  const periodeSynlig = values.kravPaaSvieSmerteGodtgoerelse === 'Ja' && values.tidligereSsMax === 'Nej';

  // filterValidSvieSmertePerioder returnerer null ved overlap/ufuldstændige rækker/ugyldige datoer.
  // I disse tilfælde er perioderne ikke brugbare til beregning — vi behandler det som ingen perioder.
  // Fejl rapporteres via validator/invariants, ikke via throws.
  const filteredPerioder = periodeSynlig ? filterValidSvieSmertePerioder(values) : [];
  const perioder = filteredPerioder ?? [];
  const harInputPerioder = perioder.length > 0;

  const vedroererFra = values.vedroererPeriodeFra;
  const vedroererTil = values.vedroererPeriodeTil;
  // Manglende vedrører-periode med gyldige perioder → ingen beregning (fejl dækkes af validator)
  if (harInputPerioder && (!vedroererFra || !vedroererTil)) {
    return buildZeroOutput(values);
  }

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

  // Tre-trins clamping (jf. eo-snapshot-contract.md §2.3):
  // 1. Clamp mod fejlgivende øvre grænse (menAfgoerelseDato) — validator rapporterer violation
  // 2. Merge overlappende og tilstødende ranges via den kanoniske EO-helper
  //    i isoRangeAlgebra.ts. Type-split mellem sygemeldt og delvist-sygemeldt
  //    sker før kaldet, så merge fortsat kun sker inden for samme type.
  // 3. Stille clamping mod EO-perioden (ingen fejlindikation)
  //
  // Rationale for rækkefølge: fejlgivende clamping sker FØR EO-periode-clamping, så feltfejlen
  // vises for den overskridende dato og ikke skjules af EO-periode-clampen.
  const fejlgivendeBounds = resolveSvieSmerteFejlgivendeBounds(values);
  const eoPeriodeBounds = resolveSvieSmerteEoPeriodeBounds(values);

  const constrained: Array<{ fra: Date; til: Date; isDelvist: boolean }> = [];
  if (harInputPerioder && vedroererFra && vedroererTil) {
    const applyConstraint = (periods: { fra: Date; til: Date }[], isDelvist: boolean) => {
      // Trin 1: fejlgivende clamping per periode (via ISO-konvertering)
      const afterFejlgivende: { fra: Date; til: Date }[] = [];
      for (const p of periods) {
        const fra = dateToISO(p.fra);
        const til = dateToISO(p.til);
        if (!fra || !til) continue;
        const clamped = clampSvieSmerteRange({ fra, til }, fejlgivendeBounds);
        if (!clamped) continue;
        afterFejlgivende.push({ fra: isoDateToDate(clamped.fra), til: isoDateToDate(clamped.til) });
      }
      // Trin 2: merge
      const merged = mergeDateRanges(afterFejlgivende, { mergeAdjacent: true });
      // Trin 3: stille clamping mod EO-perioden
      for (const p of merged) {
        const fra = dateToISO(p.fra);
        const til = dateToISO(p.til);
        if (!fra || !til) continue;
        const clamped = clampSvieSmerteRange({ fra, til }, eoPeriodeBounds);
        if (!clamped) continue;
        constrained.push({ fra: isoDateToDate(clamped.fra), til: isoDateToDate(clamped.til), isDelvist });
      }
    };

    applyConstraint(sygemeldtPeriods, false);
    applyConstraint(delvistPeriods, true);
  }

  constrained.sort((a, b) => a.fra.getTime() - b.fra.getTime());

  const constrainedPeriods: SvieSmerteConstrainedPeriod[] = [];
  for (const p of constrained) {
    const fra = dateToISO(p.fra);
    const til = dateToISO(p.til);
    // Kan ikke ske i praksis da isoDateToDate + Date-aritmetik altid producerer gyldig dato,
    // men guards mod uventet null fra dateToISO
    if (!fra || !til) continue;
    constrainedPeriods.push({ fra, til, isDelvist: p.isDelvist });
  }

  const harPerioder = constrainedPeriods.length > 0;
  const opgjortFremTilPeriodeTil = harPerioder && vedroererTil ? perioderCoverDate(constrained, vedroererTil) : false;

  const sygedage = constrained
    .filter((p) => !p.isDelvist)
    .reduce((sum, p) => sum + (countInclusiveUtcDays(p.fra, p.til) ?? 0), 0);
  const delviseSygedage = constrained
    .filter((p) => p.isDelvist)
    .reduce((sum, p) => sum + (countInclusiveUtcDays(p.fra, p.til) ?? 0), 0);

  const satserAarValue = values.svieSmerteSatserAar;
  // Manglende sats-år med gyldige perioder → ingen beregning (fejl dækkes af validator)
  if (harInputPerioder && typeof satserAarValue !== 'number') {
    return buildZeroOutput(values);
  }

  const delvisFaktor: 1 | 0.5 = values.svieSmerteDelvisSygemeldingSats === 'fuld' ? 1 : 0.5;
  // Manglende delvis-sats med gyldige perioder → ingen beregning (fejl dækkes af validator)
  if (harInputPerioder && !values.svieSmerteDelvisSygemeldingSats) {
    return buildZeroOutput(values);
  }

  let satserPerDagOre: MoneyOre | null = null;
  let satserMaxOre: MoneyOre | null = null;
  const parsedForlig = parseForligsgrad(values);
  const forligLabel: string | null = parsedForlig?.label ?? null;
  const forligSatserSuffix: string | null = parsedForlig ? ` (forlig på ${parsedForlig.label})` : null;
  const forligFactor: number | null = parsedForlig?.factor ?? null;
  let satserPerDagFoerForligOre: MoneyOre | null = null;
  let satserMaxFoerForligOre: MoneyOre | null = null;

  if (harInputPerioder && typeof satserAarValue === 'number') {
    const satsPerDag = svieSmertePrDag[satserAarValue as keyof typeof svieSmertePrDag];
    const satsMax = svieSmerteMax[satserAarValue as keyof typeof svieSmerteMax];
    // Manglende satser for det valgte år → ingen beregning (fejl dækkes af validator)
    if (!satsPerDag || !satsMax) {
      return buildZeroOutput(values);
    }
    satserPerDagFoerForligOre = fromKroner(roundKroner(satsPerDag));
    satserMaxFoerForligOre = fromKroner(roundKroner(satsMax));
    const forlig = parsedForlig;
    const perDagKroner = forlig ? satsPerDag * forlig.factor : satsPerDag;
    const maxKroner = forlig ? satsMax * forlig.factor : satsMax;
    satserPerDagOre = fromKroner(roundKroner(perDagKroner));
    satserMaxOre = fromKroner(roundKroner(maxKroner));
  }

  const tidligereKroner = amountValueToNumber(values.svieSmerteTidligereTotal);
  const aktuelKroner = amountValueToNumber(values.svieSmerteAktuelPeriode);
  const tidligereOre = tidligereKroner !== undefined ? fromKroner(tidligereKroner) : null;
  const aktuelOre = aktuelKroner !== undefined ? fromKroner(aktuelKroner) : null;

  let totalOre = zeroMoneyOre();
  let maxApplied = false;

  if (harPerioder) {
    // Satser er garanteret tilstede her: harPerioder kræver harInputPerioder,
    // og vi har allerede returneret buildZeroOutput hvis satser manglede.
    if (satserPerDagOre === null || satserMaxOre === null) {
      return buildZeroOutput(values);
    }
    const perDagKroner = toKroner(satserPerDagOre);
    const maxKroner = toKroner(satserMaxOre);
    // Delvis-dagssatsen afrundes til hel øre PR. DAG (samme afrunding som den viste delvis-sats i
    // eoPresentationSectionBuilders.roundDelvisSatsOre), så totalen kan efterregnes fra det viste
    // "N delvise sygedage á [delvis-sats]". Ellers bruger totalen den uafrundede perDag × faktor
    // (typisk en halv øre efter forlig), som afviger fra den viste sats.
    const delvisSatsKroner = toKroner(scaleMoneyOre(satserPerDagOre, delvisFaktor));
    const rawKroner = (sygedage * perDagKroner) + (delviseSygedage * delvisSatsKroner);
    const tidligereValue = tidligereKroner ?? 0;
    const allerede = aktuelKroner ?? 0;
    const restPlads = maxKroner - tidligereValue;
    const restPladsEfterTidligere = clampToNonNegative(restPlads);
    const beloebFoerFradrag = Math.min(rawKroner, restPladsEfterTidligere);
    maxApplied = rawKroner > restPladsEfterTidligere;
    const beloeb = clampToNonNegative(beloebFoerFradrag - allerede);
    totalOre = clampMoneyOreToZero(fromKroner(roundKroner(beloeb)));
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
