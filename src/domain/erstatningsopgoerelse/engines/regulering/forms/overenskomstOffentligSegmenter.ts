import { isEffectivelyZero } from '../../../../../utils/numberComparison';
import type { IsoRange } from '../../../helpers/indtaegtPerioder';
import { buildReguleringsbevis, type Reguleringsbevis } from '../reguleringsbevis';
import type { ISODateString } from '../../../../../types/branded';
import { isoToDanish } from '../../../../../types/branded';
import { LOEN_PAA_HELLIGDAGE } from '../../../../../types/loen';
import { STORE_BEDEDAG_START } from '../../../../../data/indskudteLoentillaeg';
import { harValgtStoreBededagstillaeg } from '../../../../loen/storeBededagstillaeg';
import {
  getOffentligTillaegsSatserForDato,
  getOffentligTillaegsSatserForPeriode,
  getReguleringsDatoIntervalForOverenskomst,
} from '../../../../../data/overenskomstRates';
import { getOffentligLoenForDato, getOffentligLoenForPeriode } from '../../../../../data/offentligLoenLookup';
import { resolveOffentligLoenEnhed } from '../../../../../data/offentligLoenTypes';
import {
  hasAnyPctSourceOrInput,
  parseDanishToIso,
  resolveOffentligLoenEkstraGrundloen,
} from '../../../helpers/eoSharedUtils';
import { computeFormulaValue } from '../../reguleringFormulaUtils';
import { buildOffentligOverenskomstFormulaComponents } from '../../overenskomstReguleringShared';
import {
  buildSegmentsFromStartDates,
  ensurePositiveFiniteNumber,
} from '../reguleringFormPrimitives';
import type { LoenreguleringsSegment } from '../reguleringForm';
import type { KonsolideretOverenskomst, OverenskomstSegmentContext } from './overenskomstSegmentContext';

type OffentligLoenSelection = NonNullable<KonsolideretOverenskomst['offentlig']>;

/**
 * Offentlig overenskomst (KL/RLTN løntrin). Slår grundløn op i løntrins-tabellerne og bygger
 * relative deltaPct-segmenter mod basispakken på reguleringsdatoen.
 *
 */
export const buildOffentligOverenskomstSegmenter = (
  konsolideret: KonsolideretOverenskomst,
  offentlig: OffentligLoenSelection,
  ctx: OverenskomstSegmentContext,
  segmentRanges: readonly IsoRange[] = konsolideret.tafRanges
): ReadonlyArray<LoenreguleringsSegment> => {
  const { reguleringsdatoIso, reguleringsdatoDa, anciennitetForIndex } = ctx;

  const applyShRegel = konsolideret.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG;
  const applyStoreBededagstillaeg = harValgtStoreBededagstillaeg(konsolideret);
  // Pakkens enhed er løntrinssatsens enhed («Ansættelse»). Beløbet regnes om fra den enhed, brugeren har
  // angivet det i – aldrig fra TAF-enheden, som intet siger om beløbets enhed (fund A1, afklaringslog 10a).
  const wageUnit = resolveOffentligLoenEnhed(offentlig.loenType);
  const offentligLoenEkstraGrundloen = resolveOffentligLoenEkstraGrundloen(
    konsolideret.offentligLoenEkstraGrundloen,
    konsolideret.offentligLoenEkstraGrundloenAngivesPer,
    wageUnit
  );
  const feriePct = konsolideret.feriePct;
  const baseResult = getOffentligLoenForDato(
    offentlig.overenskomstType,
    reguleringsdatoDa,
    offentlig.loentrin,
    offentlig.loengruppe
  );

  if (!baseResult) throw new Error('Loenudvikling kan ikke beregnes: basissats mangler');
  const offentligEffectiveBase = { startIso: reguleringsdatoIso, result: baseResult };
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
  const basePackageComponents = buildOffentligOverenskomstFormulaComponents({
    grundloen: baseLoen,
    feriePct,
    tillaegsSatser: baseTillaegsSatser,
    shSoPctInput: konsolideret.shSoPct,
    fritvalgPctInput: konsolideret.fritvalgPct,
    pensionPctInput: konsolideret.pensionPct,
    applyStoreBededagstillaeg,
    dateIso: reguleringsdatoIso,
  });
  const tafEnd = konsolideret.tafRanges.map((range) => range.til).sort().at(-1);
  const sourceStart = getReguleringsDatoIntervalForOverenskomst(konsolideret.overenskomstId)?.fraDato;
  const sourceEnd = tafEnd ? isoToDanish(tafEnd) : undefined;
  // Kolonnerne følger alle dækkede tillægskilder frem til TAF-periodens afslutning, ikke kun valgte segmenter.
  const sourceSatser = sourceStart && sourceEnd
    ? getOffentligTillaegsSatserForPeriode(konsolideret.overenskomstId, sourceStart, sourceEnd, applyShRegel)
    : [];
  const sourceColumns: NonNullable<Reguleringsbevis['sourceColumns']> = [
    ...(!isEffectivelyZero(feriePct) ? ['feriePct' as const] : []),
    ...(hasAnyPctSourceOrInput(sourceSatser, (sats) => sats.shSoSats, konsolideret.shSoPct) ? ['shSoPct' as const] : []),
    ...(hasAnyPctSourceOrInput(sourceSatser, (sats) => sats.fritvalg, konsolideret.fritvalgPct) ? ['fritvalgPct' as const] : []),
    ...(applyStoreBededagstillaeg && tafEnd && tafEnd >= STORE_BEDEDAG_START ? ['storeBededagPct' as const] : []),
    ...(hasAnyPctSourceOrInput(sourceSatser, (sats) => sats.agPension, konsolideret.pensionPct) ? ['pensionPct' as const] : []),
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
    if (applyStoreBededagstillaeg && range.fra < STORE_BEDEDAG_START && range.til >= STORE_BEDEDAG_START) {
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
      if (!segmentResult) throw new Error('Loenudvikling kan ikke beregnes: mangler sats for segment');
      const effectiveSegmentResult = segmentResult;
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
      const segmentComponents = buildOffentligOverenskomstFormulaComponents({
        grundloen: grundloenForSegment,
        feriePct,
        tillaegsSatser: segmentTillaegsSatser,
        shSoPctInput: konsolideret.shSoPct,
        fritvalgPctInput: konsolideret.fritvalgPct,
        pensionPctInput: konsolideret.pensionPct,
        applyStoreBededagstillaeg,
        dateIso: segment.fra,
      });
      const packageValue = computeFormulaValue(segmentComponents);
      if (!Number.isFinite(packageValue) || packageValue <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldig pakkevaerdi for segment');
      }
      const regulering = buildReguleringsbevis(basePackage, packageValue, {
        kind: 'pakke', sourceColumns, wageUnit,
        // Den samlede pakkes dato følger også tillæg, der først træder i kraft efter grundlønnens satsdato.
        referenceDate: [parseDanishToIso(offentligEffectiveBase.result.effectiveDate) ?? reguleringsdatoIso,
          baseTillaegsSatser ? parseDanishToIso(baseTillaegsSatser.fraDato) : undefined,
          basePackageComponents.storeBededagPct !== 0 ? STORE_BEDEDAG_START : undefined,
        ].filter((date): date is ISODateString => date !== undefined).sort().at(-1),
        periodRateDate: [parseDanishToIso(effectiveSegmentResult.effectiveDate),
          segmentTillaegsSatser ? parseDanishToIso(segmentTillaegsSatser.fraDato) : undefined,
          applyStoreBededagstillaeg && segment.fra >= STORE_BEDEDAG_START ? STORE_BEDEDAG_START : undefined,
          anciennitetAktiv ? anciennitetForIndex?.activeFromIso : undefined,
        ].filter((date): date is ISODateString => date !== undefined).sort().at(-1),
        referenceComponents: basePackageComponents, periodComponents: segmentComponents,
        referenceWageBaseValue: baseLoenRaw - offentligLoenEkstraGrundloen,
        referenceWageSupplement: offentligLoenEkstraGrundloen,
        wageBaseValue: segmentLoen,
        wageSupplement: grundloenForSegment - segmentLoen,
      });
      segments.push({ ...segment, deltaPct: regulering.appliedDeltaPct, regulering });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen overenskomstsegmenter');
  }
  return segments;
};
