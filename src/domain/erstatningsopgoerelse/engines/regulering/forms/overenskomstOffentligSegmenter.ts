import type { ISODateString } from '../../../../../types/branded';
import { isoToDanish } from '../../../../../types/branded';
import { LOEN_PAA_HELLIGDAGE } from '../../../../../types/loen';
import { STORE_BEDEDAG_START } from '../../../../../data/indskudteLoentillaeg';
import {
  getOffentligTillaegsSatserForDato,
  getOffentligTillaegsSatserForPeriode,
  getReguleringsDatoIntervalForOverenskomst,
} from '../../../../../data/overenskomstRates';
import { getOffentligLoenForDato, getOffentligLoenForPeriode } from '../../../../../data/offentligLoenLookup';
import { TAF_BEREGNES_SOM } from '../../../helpers/tafBeregningsenhed';
import {
  parseDanishToIso,
  resolveOffentligLoenEkstraGrundloen,
} from '../../../helpers/eoSharedUtils';
import { computeFormulaValue, roundReguleringDeltaPct } from '../../reguleringFormulaUtils';
import { buildOffentligOverenskomstFormulaComponents } from '../../overenskomstReguleringShared';
import {
  buildSegmentsFromStartDates,
  buildZeroDeltaSegment,
  ensurePositiveFiniteNumber,
} from '../reguleringFormPrimitives';
import type { LoenreguleringsSegment } from '../reguleringForm';
import type { KonsolideretOverenskomst, OverenskomstSegmentContext } from './overenskomstSegmentContext';

type OffentligLoenSelection = NonNullable<KonsolideretOverenskomst['offentlig']>;

/**
 * Offentlig overenskomst (KL/RLTN løntrin). Slår grundløn op i løntrins-tabellerne og bygger
 * relative deltaPct-segmenter mod basispakken på reguleringsdatoen.
 *
 * U4-clamp: base-fallback til overenskomstens første dækkede interval (`resolveOffentligEffective-
 * Base`), med proxy-sats før dækning for Store Bededag. Bevidst adskilt fra den private grens
 * `max(reguleringsdato, dækningsstart)`-clamp — foren dem ikke.
 */
export const buildOffentligOverenskomstSegmenter = (
  konsolideret: KonsolideretOverenskomst,
  offentlig: OffentligLoenSelection,
  ctx: OverenskomstSegmentContext
): ReadonlyArray<LoenreguleringsSegment> => {
  const { reguleringsdatoIso, reguleringsdatoDa, anciennitetForIndex } = ctx;

  const applyShRegel = konsolideret.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG;
  const offentligLoenEkstraGrundloen = resolveOffentligLoenEkstraGrundloen(
    konsolideret.offentligLoenEkstraGrundloen,
    konsolideret.tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? 'Måned' : 'Time',
    offentlig.loenType === 'maanedsLoen' ? 'Måned' : 'Time'
  );
  const feriePct = konsolideret.feriePct;
  const baseResult = getOffentligLoenForDato(
    offentlig.overenskomstType,
    reguleringsdatoDa,
    offentlig.loentrin,
    offentlig.loengruppe
  );

  const resolveOffentligEffectiveBase = (): Readonly<{ startIso: ISODateString; result: NonNullable<typeof baseResult> }> => {
    if (baseResult) {
      return { startIso: reguleringsdatoIso, result: baseResult };
    }
    const interval = getReguleringsDatoIntervalForOverenskomst(konsolideret.overenskomstId);
    if (!interval) {
      throw new Error('Loenudvikling kan ikke beregnes: basissats mangler');
    }
    const firstStartIso = parseDanishToIso(interval.fraDato);
    if (!firstStartIso) {
      throw new Error('Loenudvikling kan ikke beregnes: basissats mangler');
    }
    const firstResult = getOffentligLoenForDato(
      offentlig.overenskomstType,
      interval.fraDato,
      offentlig.loentrin,
      offentlig.loengruppe
    );
    if (!firstResult) {
      throw new Error('Loenudvikling kan ikke beregnes: basissats mangler');
    }
    return { startIso: firstStartIso, result: firstResult };
  };

  const offentligEffectiveBase = resolveOffentligEffectiveBase();
  const offentligEffectiveBaseDa = isoToDanish(offentligEffectiveBase.startIso);
  if (!offentligEffectiveBaseDa) {
    throw new Error('Intern fejl: ugyldig basisdato');
  }
  const baseTillaegsSatser = getOffentligTillaegsSatserForDato(
    konsolideret.overenskomstId,
    offentligEffectiveBaseDa,
    applyShRegel
  );
  const baseLoenRaw = (offentlig.loenType === 'maanedsLoen'
    ? offentligEffectiveBase.result.maanedsLoen
    : offentligEffectiveBase.result.timeLoen) + offentligLoenEkstraGrundloen;
  const baseLoen = ensurePositiveFiniteNumber(baseLoenRaw, 'Loenudvikling kan ikke beregnes: ugyldig basisgrundloen');
  const basePackage = computeFormulaValue(buildOffentligOverenskomstFormulaComponents({
    grundloen: baseLoen,
    feriePct,
    tillaegsSatser: baseTillaegsSatser,
    shSoPctInput: konsolideret.shSoPct,
    fritvalgPctInput: konsolideret.fritvalgPct,
    pensionPctInput: konsolideret.pensionPct,
    applyAlmindeligLoenPaaShDageRegel: applyShRegel,
    dateIso: reguleringsdatoIso,
  }));
  if (!Number.isFinite(basePackage) || basePackage <= 0) {
    throw new Error('Loenudvikling kan ikke beregnes: basispakke er ugyldig');
  }

  const segments: LoenreguleringsSegment[] = [];
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
    const tillaegsSatser = getOffentligTillaegsSatserForPeriode(
      konsolideret.overenskomstId,
      fraDa,
      tilDa,
      applyShRegel
    );

    const starts = new Set<ISODateString>();
    for (const sats of satser) {
      const startIso = parseDanishToIso(sats.effectiveDate);
      if (startIso && startIso > range.fra && startIso <= range.til) starts.add(startIso);
    }
    for (const sats of tillaegsSatser) {
      const startIso = parseDanishToIso(sats.fraDato);
      if (startIso && startIso > range.fra && startIso <= range.til) starts.add(startIso);
    }
    if (applyShRegel && range.fra < STORE_BEDEDAG_START && range.til >= STORE_BEDEDAG_START) {
      starts.add(STORE_BEDEDAG_START);
    }
    // Reguleringsdatoen er allerede segmentets reference-start; gentagelse her
    // kan skjule, at effectiveBase kun er en afledt sats for samme dato.
    if (
      offentligEffectiveBase.startIso !== reguleringsdatoIso &&
      offentligEffectiveBase.startIso > range.fra &&
      offentligEffectiveBase.startIso <= range.til
    ) {
      starts.add(offentligEffectiveBase.startIso);
    }
    if (anciennitetForIndex && anciennitetForIndex.activeFromIso > range.fra && anciennitetForIndex.activeFromIso <= range.til) {
      starts.add(anciennitetForIndex.activeFromIso);
    }

    for (const segment of buildSegmentsFromStartDates(range, starts)) {
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
      // Decision note: Vi bruger første tilgængelige sats som proxy i intervallet
      // [STORE_BEDEDAG_START, effectiveBase.startIso) for at kunne materialisere
      // den særskilte Store Bededag-regulering fra 01-01-2024 uden at antage
      // øvrige lønstigninger før første dækkede satsdato.
      const useFallbackBaseBeforeCoverage =
        applyShRegel &&
        segment.fra >= STORE_BEDEDAG_START &&
        segment.fra < offentligEffectiveBase.startIso;
      const effectiveSegmentResult = segmentResult ?? (useFallbackBaseBeforeCoverage ? offentligEffectiveBase.result : undefined);
      if (!effectiveSegmentResult || (segment.fra < offentligEffectiveBase.startIso && !useFallbackBaseBeforeCoverage)) {
        segments.push(buildZeroDeltaSegment(segment));
        continue;
      }
      const segmentTillaegsSatser = getOffentligTillaegsSatserForDato(
        konsolideret.overenskomstId,
        segmentDa,
        applyShRegel
      );
      const segmentLoenRaw = offentlig.loenType === 'maanedsLoen'
        ? effectiveSegmentResult.maanedsLoen
        : effectiveSegmentResult.timeLoen;
      const segmentLoen = ensurePositiveFiniteNumber(segmentLoenRaw, 'Loenudvikling kan ikke beregnes: ugyldig segmentgrundloen');
      const anciennitetAktiv = Boolean(anciennitetForIndex && segment.fra >= anciennitetForIndex.activeFromIso);
      const grundloenForSegmentBase = segmentLoen + offentligLoenEkstraGrundloen;
      const grundloenForSegment = anciennitetAktiv && anciennitetForIndex
        ? grundloenForSegmentBase + anciennitetForIndex.supplementValue
        : grundloenForSegmentBase;
      const packageValue = computeFormulaValue(buildOffentligOverenskomstFormulaComponents({
        grundloen: grundloenForSegment,
        feriePct,
        tillaegsSatser: segmentTillaegsSatser,
        shSoPctInput: konsolideret.shSoPct,
        fritvalgPctInput: konsolideret.fritvalgPct,
        pensionPctInput: konsolideret.pensionPct,
        applyAlmindeligLoenPaaShDageRegel: applyShRegel,
        dateIso: segment.fra,
      }));
      if (!Number.isFinite(packageValue) || packageValue <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldig pakkevaerdi for segment');
      }
      segments.push({
        ...segment,
        deltaPct: roundReguleringDeltaPct((packageValue / basePackage - 1) * 100),
      });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen overenskomstsegmenter');
  }
  return segments;
};
