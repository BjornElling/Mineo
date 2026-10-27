import { isEffectivelyZero } from '../../../../../utils/numberComparison';
import type { IsoRange } from '../../../helpers/indtaegtPerioder';
import { buildReguleringsbevis, type Reguleringsbevis } from '../reguleringsbevis';
import type { ISODateString } from '../../../../../types/branded';
import { isoToDanish } from '../../../../../types/branded';
import { LOEN_PAA_HELLIGDAGE } from '../../../../../types/loen';
import { STORE_BEDEDAG_START } from '../../../../../data/indskudteLoentillaeg';
import { harValgtStoreBededagstillaeg } from '../../../../loen/storeBededagstillaeg';
import {
  getOverenskomst,
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
  getGrundloenAngivetPerForOverenskomst,
} from '../../../../../data/overenskomstRates';
import { hasAnyPctSourceOrInput, parseDanishToIso } from '../../../helpers/eoSharedUtils';
import { buildPrivateOverenskomstFormulaComponents } from '../../overenskomstReguleringShared';
import { computeFormulaValue } from '../../reguleringFormulaUtils';
import {
  buildSegmentsFromStartDates,
  ensurePositiveFiniteNumber,
} from '../reguleringFormPrimitives';
import type { LoenreguleringsSegment } from '../reguleringForm';
import type { KonsolideretOverenskomst, OverenskomstSegmentContext } from './overenskomstSegmentContext';

/**
 * Privat overenskomst (pakke-indeks). Bygger relative deltaPct-segmenter mod basispakken via
 * de effektive satser på overenskomstens baseId.
 */
export const buildPrivatOverenskomstSegmenter = (
  konsolideret: KonsolideretOverenskomst,
  ctx: OverenskomstSegmentContext,
  segmentRanges: readonly IsoRange[] = konsolideret.tafRanges
): ReadonlyArray<LoenreguleringsSegment> => {
  const { reguleringsdatoIso, reguleringsdatoDa, overenskomstRef, anciennitetForIndex } = ctx;

  const applyShRegel = konsolideret.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG;
  const applyStoreBededagstillaeg = harValgtStoreBededagstillaeg(konsolideret);
  const feriePct = konsolideret.feriePct;
  // Privat overenskomst angiver selv sin grundløns enhed; «Ansættelse» findes kun ved offentlig.
  const wageUnit = getGrundloenAngivetPerForOverenskomst(konsolideret.overenskomstId, undefined);

  const baseSats = getEffektiveSatserForDato({
    overenskomstId: overenskomstRef.baseId,
    dato: reguleringsdatoDa,
    applyAlmindeligLoenPaaShDageRegel: applyShRegel,
  });
  if (!baseSats || typeof baseSats.grundloen !== 'number') {
    throw new Error('Loenudvikling kan ikke beregnes: basissats mangler');
  }
  ensurePositiveFiniteNumber(baseSats.grundloen, 'Loenudvikling kan ikke beregnes: ugyldig basisgrundloen');

  const basePackageComponents = buildPrivateOverenskomstFormulaComponents({
    sats: baseSats,
    feriePct,
    shSoPctInput: konsolideret.shSoPct,
    fritvalgPctInput: konsolideret.fritvalgPct,
    pensionPctInput: konsolideret.pensionPct,
    dateIso: reguleringsdatoIso,
    baseValueSupplement: 0,
    applyStoreBededagstillaeg,
  });
  // Kildekolonner følger hele overenskomsten, også når en effektiv sats i TAF-perioden er nul.
  const allSatser = getOverenskomst(overenskomstRef.baseId)?.satser ?? [baseSats];
  const tafEnd = konsolideret.tafRanges.map((range) => range.til).sort().at(-1);
  const sourceColumns: NonNullable<Reguleringsbevis['sourceColumns']> = [
    ...(!isEffectivelyZero(feriePct) ? ['feriePct' as const] : []),
    ...(hasAnyPctSourceOrInput(allSatser, (sats) => sats.shSoSats, konsolideret.shSoPct) ? ['shSoPct' as const] : []),
    ...(hasAnyPctSourceOrInput(allSatser, (sats) => sats.fritvalg, konsolideret.fritvalgPct) ? ['fritvalgPct' as const] : []),
    ...(applyStoreBededagstillaeg && tafEnd && tafEnd >= STORE_BEDEDAG_START ? ['storeBededagPct' as const] : []),
    ...(hasAnyPctSourceOrInput(allSatser, (sats) => sats.agPension, konsolideret.pensionPct) ? ['pensionPct' as const] : []),
  ];
  const basePackage = computeFormulaValue(basePackageComponents);
  if (!Number.isFinite(basePackage) || basePackage <= 0) {
    throw new Error('Loenudvikling kan ikke beregnes: basispakke er ugyldig');
  }

  const segments: LoenreguleringsSegment[] = [];
  for (const range of segmentRanges) {
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
    if (applyStoreBededagstillaeg && range.fra < STORE_BEDEDAG_START && range.til >= STORE_BEDEDAG_START) {
      starts.add(STORE_BEDEDAG_START);
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
      if (!sats) throw new Error('Loenudvikling kan ikke beregnes: mangler sats for segment');
      if (typeof sats.grundloen !== 'number') {
        throw new Error('Loenudvikling kan ikke beregnes: mangler sats for segment');
      }
      ensurePositiveFiniteNumber(sats.grundloen, 'Loenudvikling kan ikke beregnes: ugyldig segmentgrundloen');
      const anciennitetAktiv = Boolean(anciennitetForIndex && segment.fra >= anciennitetForIndex.activeFromIso);
      const segmentComponents = buildPrivateOverenskomstFormulaComponents({
        sats: sats,
        feriePct,
        shSoPctInput: konsolideret.shSoPct,
        fritvalgPctInput: konsolideret.fritvalgPct,
        pensionPctInput: konsolideret.pensionPct,
        dateIso: segment.fra,
        baseValueSupplement: anciennitetAktiv && anciennitetForIndex ? anciennitetForIndex.supplementValue : 0,
        applyStoreBededagstillaeg,
      });
      const packageValue = computeFormulaValue(segmentComponents);
      if (!Number.isFinite(packageValue) || packageValue <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldig pakkevaerdi for segment');
      }
      const regulering = buildReguleringsbevis(basePackage, packageValue, {
        kind: 'pakke', sourceColumns, wageUnit,
        // Pakken må ikke mærkes med en gammel satsdato, hvis Store Bededag først gælder fra 2024.
        referenceDate: [parseDanishToIso(baseSats.fraDato) ?? reguleringsdatoIso,
          basePackageComponents.storeBededagPct !== 0 ? STORE_BEDEDAG_START : undefined,
        ].filter((date): date is ISODateString => date !== undefined).sort().at(-1),
        periodRateDate: [parseDanishToIso(sats.fraDato),
          applyStoreBededagstillaeg && segment.fra >= STORE_BEDEDAG_START ? STORE_BEDEDAG_START : undefined,
          anciennitetAktiv ? anciennitetForIndex?.activeFromIso : undefined,
        ].filter((date): date is ISODateString => date !== undefined).sort().at(-1),
        referenceComponents: basePackageComponents, periodComponents: segmentComponents,
        wageBaseValue: sats.grundloen,
        wageSupplement: anciennitetAktiv && anciennitetForIndex ? anciennitetForIndex.supplementValue : 0,
      });
      segments.push({ ...segment, deltaPct: regulering.appliedDeltaPct, regulering });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen overenskomstsegmenter');
  }
  return segments;
};
