import type { ISODateString } from '../../../../../types/branded';
import { isoToDanish, isISODateString } from '../../../../../types/branded';
import { amountValueToNumber } from '../../../../../utils/expressionAmount';
import { roundByMethod } from '../../../../../utils/rounding';
import { round2 as roundToTwoDecimals } from '../../../../../utils/roundingShortcuts';
import { LOEN_PAA_HELLIGDAGE } from '../../../../../types/loen';
import { STORE_BEDEDAG_START, STORE_BEDEDAG_PCT } from '../../../../../config/indskudteLoentillaeg';
import {
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
  getGrundloenAngivetPerForOverenskomst,
  getOffentligTillaegsSatserForDato,
  getOffentligTillaegsSatserForPeriode,
  getReguleringsDatoIntervalForOverenskomst,
  resolveOverenskomstRef,
  getOffentligOverenskomstTypeById,
} from '../../../../../data/overenskomstRates';
import { getOffentligLoenForDato, getOffentligLoenForPeriode } from '../../../../../data/offentligLoenLookup';
import { TAF_BEREGNES_SOM } from '../../../helpers/tafBeregningsenhed';
import { hasIndtastetLoenoplysninger } from '../../../helpers/loenoplysningerInput';
import {
  convertAnciennitetSats,
  parseDanishToIso,
  resolvePctPointFromSatsOrInput,
  resolveOffentligLoenEkstraGrundloen,
} from '../../../helpers/eoSharedUtils';
import {
  buildPrivateOverenskomstFormulaComponents,
  resolvePrivateOverenskomstBaseContext,
} from '../../overenskomstReguleringShared';
import { computeFormulaValue, computePackageValuePct } from '../../reguleringFormulaUtils';
import { resolveOverenskomstEffectiveStartIso } from '../../reguleringCoverage';
import {
  assertUniform,
  buildSegmentsFromStartDates,
  buildZeroDeltaSegment,
  ensurePositiveFiniteNumber,
  resolveOffentligLoenSelection,
  toKildeReguleringsIntervalIso,
} from '../reguleringFormPrimitives';
import type {
  FormKonsoliderContext,
  KildeReguleringsInterval,
  KonsolideretLoenudvikling,
  LoenreguleringsSegment,
  LoenudviklingAf,
  ReguleringForm,
  ResolvedStrategi,
} from '../reguleringForm';

const konsolider = (ctx: FormKonsoliderContext): ResolvedStrategi => {
  const {
    active,
    angivetLoen,
    anvendtReguleringsdato,
    tafRanges,
    tafBeregningsenhed,
    kraeverFeriePctVedBeregningsperiode,
    activeMedSynligeSatserOgLoenoplysninger,
  } = ctx;

  assertUniform(active, (af) => af.overenskomstId ?? '', 'overenskomst');
  assertUniform(active, (af) => af.loenPaaHelligdage ?? '', 'loen paa helligdage');
  assertUniform(active, (af) => af.harAnciennitetstillaegEfterSkadedatoen ?? false, 'anciennitetstillæg');
  assertUniform(
    active,
    (af) => (isISODateString(af.anciennitetstillaegDato) ? af.anciennitetstillaegDato : ''),
    'dato for anciennitetstillæg'
  );
  assertUniform(active, (af) => af.anciennitetstillaegSatsAngivesPer ?? 'Måned', 'satsen angives per');
  assertUniform(
    active,
    (af) => (typeof af.anciennitetstillaegSats?.value === 'number' ? af.anciennitetstillaegSats.value : null),
    'sats for anciennitetstillæg'
  );
  if (!angivetLoen) {
    if (activeMedSynligeSatserOgLoenoplysninger.length > 1) {
      assertUniform(
        activeMedSynligeSatserOgLoenoplysninger,
        (af) => (typeof af.feriePct === 'number' ? af.feriePct : null),
        'feriepct'
      );
    }
  }

  const offentligTypeForUniform = active[0].overenskomstId
    ? getOffentligOverenskomstTypeById(active[0].overenskomstId)
    : undefined;
  if (offentligTypeForUniform) {
    assertUniform(active, (af) => af.offentligLoenType ?? '', 'offentlig løntype');
    assertUniform(active, (af) => af.offentligLoenTrin ?? null, 'offentlig løntrin');
    assertUniform(active, (af) => af.offentligLoenGruppe ?? null, 'offentlig løngruppe');
    assertUniform(
      active,
      (af) => {
        const value = amountValueToNumber(af.offentligLoenEkstraGrundloen);
        return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
      },
      'offentlig løn ekstra grundløn'
    );
  }

  const label = 'Overenskomst';

  if (!active[0].overenskomstId) {
    throw new Error('Loenudvikling kan ikke beregnes: overenskomst mangler');
  }
  if (kraeverFeriePctVedBeregningsperiode && active.some((af) =>
    af.tillaegAngivesSom !== 'beloeb' && hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []) && typeof af.feriePct !== 'number'
  )) {
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
    ? resolveOffentligLoenSelection(active[0], offentligType)
    : null;
  const feriePct = typeof active[0].feriePct === 'number' ? active[0].feriePct : 0;
  const fritvalgPct = typeof active[0].fritvalgPct === 'number' ? active[0].fritvalgPct : 0;
  const shSoPct = typeof active[0].shSoPct === 'number' ? active[0].shSoPct : 0;
  const pensionPct = typeof active[0].pensionPct === 'number' ? active[0].pensionPct : 0;
  const offentligLoenEkstraGrundloenRaw = amountValueToNumber(active[0].offentligLoenEkstraGrundloen);
  return {
    strategi: 'overenskomst',
    label,
    konsolideret: {
      strategi: 'overenskomst',
      label,
      reguleringsdato: anvendtReguleringsdato,
      overenskomstId: active[0].overenskomstId,
      loenPaaHelligdage,
      feriePct,
      fritvalgPct,
      shSoPct,
      pensionPct,
      tafBeregningsenhed,
      harAnciennitetstillaegEfterSkadedatoen: active[0].harAnciennitetstillaegEfterSkadedatoen,
      anciennitetstillaegDato: isISODateString(active[0].anciennitetstillaegDato) ? active[0].anciennitetstillaegDato : undefined,
      anciennitetstillaegSatsAngivesPer: active[0].anciennitetstillaegSatsAngivesPer ?? 'Måned',
      anciennitetstillaegSatsValue: active[0].anciennitetstillaegSats?.value,
      offentligLoenEkstraGrundloen:
        typeof offentligLoenEkstraGrundloenRaw === 'number' && Number.isFinite(offentligLoenEkstraGrundloenRaw)
          ? Math.max(0, offentligLoenEkstraGrundloenRaw)
          : 0,
      offentlig,
      tafRanges,
    },
  };
};

const byggSegmenter = (
  konsolideret: KonsolideretLoenudvikling
): ReadonlyArray<LoenreguleringsSegment> => {
  if (konsolideret.strategi !== 'overenskomst') {
    throw new Error('Loenudvikling kan ikke beregnes: overenskomststrategi mangler');
  }
  if (!konsolideret.reguleringsdato) {
    throw new Error('Loenudvikling kan ikke beregnes: reguleringsdato mangler');
  }
  const reguleringsdatoIso = konsolideret.reguleringsdato;
  const overenskomstRef = konsolideret.overenskomstId ? resolveOverenskomstRef(konsolideret.overenskomstId) : undefined;
  const reguleringsdatoDa = isoToDanish(reguleringsdatoIso);
  if (!overenskomstRef) {
    throw new Error('Loenudvikling kan ikke beregnes: overenskomst mangler');
  }
  if (!reguleringsdatoDa) {
    throw new Error('Loenudvikling kan ikke beregnes: ugyldig reguleringsdato');
  }

  const tafStartIso = konsolideret.tafRanges.reduce<ISODateString | undefined>(
    (min, range) => (!min || range.fra < min ? range.fra : min),
    undefined
  );
  const tafEndIso = konsolideret.tafRanges.reduce<ISODateString | undefined>(
    (max, range) => (!max || range.til > max ? range.til : max),
    undefined
  );

  const anciennitetForIndex = (() => {
    if (!konsolideret.harAnciennitetstillaegEfterSkadedatoen) return null;
    const anciennitetDato = konsolideret.anciennitetstillaegDato;
    const satsValue = konsolideret.anciennitetstillaegSatsValue;
    if (!anciennitetDato || typeof satsValue !== 'number' || !Number.isFinite(satsValue) || satsValue <= 0) {
      return null;
    }
    if (!tafStartIso || !tafEndIso) return null;
    if (anciennitetDato > tafEndIso) return null;

    const tafBeregnesSom = konsolideret.tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? 'Måneder' : 'Arbejdsdage';
    const grundloenAngivetPer = getGrundloenAngivetPerForOverenskomst(konsolideret.overenskomstId, tafBeregnesSom);
    if (!grundloenAngivetPer) return null;

    const supplementValue = convertAnciennitetSats(
      satsValue,
      konsolideret.anciennitetstillaegSatsAngivesPer,
      grundloenAngivetPer
    );

    const roundedSupplement = roundToTwoDecimals(supplementValue);
    if (!Number.isFinite(roundedSupplement) || roundedSupplement <= 0) return null;
    return {
      activeFromIso: anciennitetDato < tafStartIso ? tafStartIso : anciennitetDato,
      supplementValue: roundedSupplement,
    };
  })();

  const offentlig = konsolideret.offentlig;
  if (offentlig) {
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
    const basePackage = computePackageValuePct({
      grundloen: baseLoen,
      feriePct,
      shSoPct: resolvePctPointFromSatsOrInput(baseTillaegsSatser?.shSoSats, konsolideret.shSoPct),
      fritvalgPct: resolvePctPointFromSatsOrInput(baseTillaegsSatser?.fritvalg, konsolideret.fritvalgPct),
      pensionPct: resolvePctPointFromSatsOrInput(baseTillaegsSatser?.agPension, konsolideret.pensionPct),
      storeBededagPct: applyShRegel && reguleringsdatoIso >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0,
    });
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
        const packageValue = computePackageValuePct({
          grundloen: grundloenForSegment,
          feriePct,
          shSoPct: resolvePctPointFromSatsOrInput(segmentTillaegsSatser?.shSoSats, konsolideret.shSoPct),
          fritvalgPct: resolvePctPointFromSatsOrInput(segmentTillaegsSatser?.fritvalg, konsolideret.fritvalgPct),
          pensionPct: resolvePctPointFromSatsOrInput(segmentTillaegsSatser?.agPension, konsolideret.pensionPct),
          storeBededagPct: applyShRegel && segment.fra >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0,
        });
        if (!Number.isFinite(packageValue) || packageValue <= 0) {
          throw new Error('Loenudvikling kan ikke beregnes: ugyldig pakkevaerdi for segment');
        }
        segments.push({
          ...segment,
          deltaPct: roundByMethod((packageValue / basePackage - 1) * 100, 2, 'halfAwayFromZero'),
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

  // Privat overenskomst clamper basen til dækningsstart via max(reguleringsdato, dækningsstart).
  // Bevidst adskilt fra den offentlige grens clamp (resolveOffentligEffectiveBase, ovenfor), der
  // har sin egen base-fallback til første dækkede interval (proxy-sats før dækning for Store
  // Bededag). To forskellige clamp-mekanismer for hver sin datamodel — foren dem ikke (jf. U4).
  // Beregnes her (ikke øverst) så den offentlige gren ikke betaler for et ubrugt opslag.
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
        deltaPct: roundByMethod((packageValue / basePackage - 1) * 100, 2, 'halfAwayFromZero'),
      });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen overenskomstsegmenter');
  }
  return segments;
};

const coverageInterval = (af: LoenudviklingAf): KildeReguleringsInterval | undefined =>
  toKildeReguleringsIntervalIso(getReguleringsDatoIntervalForOverenskomst(af.overenskomstId ?? ''));

export const overenskomstForm: ReguleringForm = {
  id: 'Overenskomst',
  strategi: 'overenskomst',
  konsolider,
  byggSegmenter,
  coverageInterval,
};
