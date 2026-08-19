import type { ISODateString } from '../../../../../types/branded';
import { isoToDanish } from '../../../../../types/branded';
import { LOEN_PAA_HELLIGDAGE } from '../../../../../types/loen';
import { STORE_BEDEDAG_START } from '../../../../../data/indskudteLoentillaeg';
import {
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
} from '../../../../../data/overenskomstRates';
import { parseDanishToIso } from '../../../helpers/eoSharedUtils';
import {
  buildPrivateOverenskomstFormulaComponents,
  resolvePrivateOverenskomstBaseContext,
} from '../../overenskomstReguleringShared';
import { computeFormulaValue, roundReguleringDeltaPct } from '../../reguleringFormulaUtils';
import { resolveOverenskomstEffectiveStartIso } from '../../reguleringCoverage';
import {
  buildSegmentsFromStartDates,
  buildZeroDeltaSegment,
  ensurePositiveFiniteNumber,
} from '../reguleringFormPrimitives';
import type { LoenreguleringsSegment } from '../reguleringForm';
import type { KonsolideretOverenskomst, OverenskomstSegmentContext } from './overenskomstSegmentContext';

/**
 * Privat overenskomst (pakke-indeks). Bygger relative deltaPct-segmenter mod basispakken via
 * de effektive satser på overenskomstens baseId.
 *
 * U4-clamp: basen clampes til dækningsstart via `max(reguleringsdato, dækningsstart)`
 * (`resolveOverenskomstEffectiveStartIso`). Bevidst adskilt fra den offentlige grens base-
 * fallback – foren dem ikke. Kun Store Bededag må give regulering før første dækkede satsdato.
 */
export const buildPrivatOverenskomstSegmenter = (
  konsolideret: KonsolideretOverenskomst,
  ctx: OverenskomstSegmentContext
): ReadonlyArray<LoenreguleringsSegment> => {
  const { reguleringsdatoIso, overenskomstRef, anciennitetForIndex } = ctx;

  const applyShRegel = konsolideret.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG;
  const feriePct = konsolideret.feriePct;

  // Privat overenskomst clamper basen til dækningsstart via max(reguleringsdato, dækningsstart).
  // Bevidst adskilt fra den offentlige grens clamp (resolveOffentligEffectiveBase), der har sin
  // egen base-fallback til første dækkede interval (proxy-sats før dækning for Store Bededag).
  // To forskellige clamp-mekanismer for hver sin datamodel – foren dem ikke (jf. U4).
  const effectiveReguleringsdatoIso = resolveOverenskomstEffectiveStartIso(
    konsolideret.overenskomstId,
    reguleringsdatoIso
  );

  const privateBaseContext = resolvePrivateOverenskomstBaseContext({
    overenskomstId: overenskomstRef.baseId,
    anvendtReguleringsdato: reguleringsdatoIso,
    effectiveReguleringsdato: effectiveReguleringsdatoIso,
    applyAlmindeligLoenPaaShDageRegel: applyShRegel,
    shSoPctInput: konsolideret.shSoPct,
    fritvalgPctInput: konsolideret.fritvalgPct,
    pensionPctInput: konsolideret.pensionPct,
  });
  if (!privateBaseContext || typeof privateBaseContext.effectiveBase.sats.grundloen !== 'number') {
    throw new Error('Loenudvikling kan ikke beregnes: basissats mangler');
  }
  ensurePositiveFiniteNumber(privateBaseContext.effectiveBase.sats.grundloen, 'Loenudvikling kan ikke beregnes: ugyldig basisgrundloen');

  const basePackageComponents = buildPrivateOverenskomstFormulaComponents({
    sats: privateBaseContext.effectiveBase.sats,
    context: privateBaseContext,
    feriePct,
    shSoPctInput: konsolideret.shSoPct,
    fritvalgPctInput: konsolideret.fritvalgPct,
    pensionPctInput: konsolideret.pensionPct,
    pctBasisRole: 'reference',
    dateIso: reguleringsdatoIso,
    baseValueSupplement: 0,
    applyAlmindeligLoenPaaShDageRegel: applyShRegel,
  });
  const basePackage = computeFormulaValue(basePackageComponents);
  if (!Number.isFinite(basePackage) || basePackage <= 0) {
    throw new Error('Loenudvikling kan ikke beregnes: basispakke er ugyldig');
  }

  // Bevidst adskilt fra eoInspektionRegulationCore:
  // denne motor bygger relative deltaPct-segmenter til TAF-beregning,
  // mens kontrolmotoren bygger absolutte indeks-entries til visning.
  const segments: LoenreguleringsSegment[] = [];
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
    // Reguleringsdatoen er allerede segmentets reference-start; gentagelse her
    // kan skjule, at effectiveBase kun er en afledt sats for samme dato.
    if (
      privateBaseContext.effectiveBase.startIso !== reguleringsdatoIso &&
      privateBaseContext.effectiveBase.startIso > range.fra &&
      privateBaseContext.effectiveBase.startIso <= range.til
    ) {
      starts.add(privateBaseContext.effectiveBase.startIso);
    }
    if (anciennitetForIndex && anciennitetForIndex.activeFromIso > range.fra && anciennitetForIndex.activeFromIso <= range.til) {
      starts.add(anciennitetForIndex.activeFromIso);
    }

    for (const segment of buildSegmentsFromStartDates(range, starts)) {
      const segmentDa = isoToDanish(segment.fra);
      if (!segmentDa) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldig segmentdato');
      }
      const sats = getEffektiveSatserForDato({
        overenskomstId: overenskomstRef.baseId,
        dato: segmentDa,
        applyAlmindeligLoenPaaShDageRegel: applyShRegel,
      });
      // Før første private overenskomstdækning må kun Store Bededag give regulering.
      // Øvrige overenskomstbestemte satser må først slå igennem fra første faktiske satsdato.
      const useStoreBededagOnlyBeforeCoverage =
        applyShRegel &&
        segment.fra >= STORE_BEDEDAG_START &&
        segment.fra < privateBaseContext.effectiveBase.startIso;
      if (!sats && !useStoreBededagOnlyBeforeCoverage) {
        segments.push(buildZeroDeltaSegment(segment));
        continue;
      }
      const effectiveSats = sats ?? privateBaseContext.effectiveBase.sats;
      if (segment.fra < privateBaseContext.effectiveBase.startIso && !useStoreBededagOnlyBeforeCoverage) {
        segments.push(buildZeroDeltaSegment(segment));
        continue;
      }
      if (typeof effectiveSats.grundloen !== 'number') {
        throw new Error('Loenudvikling kan ikke beregnes: mangler sats for segment');
      }
      ensurePositiveFiniteNumber(effectiveSats.grundloen, 'Loenudvikling kan ikke beregnes: ugyldig segmentgrundloen');
      const anciennitetAktiv = Boolean(anciennitetForIndex && segment.fra >= anciennitetForIndex.activeFromIso);
      const segmentComponents = buildPrivateOverenskomstFormulaComponents({
        sats: effectiveSats,
        context: privateBaseContext,
        feriePct,
        shSoPctInput: konsolideret.shSoPct,
        fritvalgPctInput: konsolideret.fritvalgPct,
        pensionPctInput: konsolideret.pensionPct,
        pctBasisRole: useStoreBededagOnlyBeforeCoverage ? 'reference' : 'segment',
        dateIso: segment.fra,
        baseValueSupplement: anciennitetAktiv && anciennitetForIndex ? anciennitetForIndex.supplementValue : 0,
        applyAlmindeligLoenPaaShDageRegel: applyShRegel,
      });
      const packageValue = computeFormulaValue(segmentComponents);
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
