/**
 * Regulation Core Model - Indeks ud fra overenskomstperioder (rettet)
 */

import type { ISODateString, DanishDateString } from '../../types/branded';
import { isoToDanish, toISODateString, dateToISO, isISODateString } from '../../types/branded';
import type { DebugDay } from './eoDebugTypes';
import type { ErstatningsopgoerelseValues, StamdataValues, LoenPaaHelligdage } from '../../types/common';
import { LOEN_PAA_HELLIGDAGE } from '../../types/common';
import type { RegulationIndexTimeline, IndeksEntry, AnsaettelsesforholdIndeks } from './eoDebugRegulationTypes';
import { getEffektiveSatserForDato, getEffektiveSatserForPeriode, resolveOverenskomstRef, type OverenskomstPeriodeSats, getOffentligOverenskomstTypeById } from '../../data/overenskomstRates';
import { getOffentligLoenForDato, getOffentligLoenForPeriode } from '../../data/offentligLoenLookup';
import { resolveOffentligLoenTypeFromLabel, toLoentrin, type Loengruppe } from '../../data/offentligLoenTypes';
import { parsePercentToDecimal } from '../../utils/formatUtils';
import { beregnHelligdage } from '../../utils/shDageBeregning';
import { isoDateToDate } from '../dates/isoDate';
import { beregnArbejdsdageOgMaaneder } from '../erstatningsopgoerelse/arbejdsdageMaaneder';

const STORE_BEDEDAG_PCT = 0.0045;
const STORE_BEDEDAG_START = '2024-01-01';

export type RegulationCoreInput = {
  readonly debugDays: readonly DebugDay[];
  readonly eoValues: ErstatningsopgoerelseValues;
  readonly stamdataValues: StamdataValues;
};

const parseOptionalIso = (value: unknown): ISODateString | undefined => {
  if (!value || typeof value !== 'string' || value.trim() === '') return undefined;
  try {
    return toISODateString(value);
  } catch {
    return undefined;
  }
};

const toDanishOrUndefined = (iso: ISODateString): DanishDateString | undefined => {
  return isoToDanish(iso) ?? undefined;
};

type OffentligLoenSelection = Readonly<{
  overenskomstType: NonNullable<ReturnType<typeof getOffentligOverenskomstTypeById>>;
  loenType: NonNullable<ReturnType<typeof resolveOffentligLoenTypeFromLabel>>;
  loentrin: ReturnType<typeof toLoentrin>;
  loengruppe: Loengruppe;
}>;

const resolveOffentligLoenSelection = (
  af: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
): OffentligLoenSelection | null => {
  if (!af.overenskomstId) return null;
  const offentligType = getOffentligOverenskomstTypeById(af.overenskomstId);
  if (!offentligType) return null;

  const loenType = resolveOffentligLoenTypeFromLabel(af.offentligLoenType);
  if (!loenType) return null;

  const trinValue = af.offentligLoenTrin;
  const gruppeValue = af.offentligLoenGruppe;
  if (typeof trinValue !== 'number' || typeof gruppeValue !== 'number') return null;
  if (gruppeValue < 0 || gruppeValue > 4) return null;

  try {
    const loentrin = toLoentrin(trinValue);
    const loengruppe = gruppeValue as Loengruppe;
    return {
      overenskomstType: offentligType,
      loenType,
      loentrin,
      loengruppe,
    };
  } catch {
    return null;
  }
};

const getEoRange = (
  values: ErstatningsopgoerelseValues
): { fra: ISODateString; til: ISODateString } | undefined => {
  const fra = parseOptionalIso(values.vedroererPeriodeFra);
  const til = parseOptionalIso(values.vedroererPeriodeTil);
  if (!fra || !til) return undefined;
  if (fra > til) return undefined;
  return { fra, til };
};

const getStoreBededagPct = (iso: ISODateString, loenPaaHelligdage: LoenPaaHelligdage | undefined): number => {
  if (loenPaaHelligdage !== LOEN_PAA_HELLIGDAGE.ALMINDELIG) return 0;
  return iso >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0;
};

const computePackageValue = (args: {
  grundloen: number;
  feriePct: number;
  shSoPct: number;
  fritvalgPct: number;
  storeBededagPct: number;
  pensionPct: number;
}): number => {
  const totalPct = args.feriePct + args.shSoPct + args.fritvalgPct + args.storeBededagPct;
  return args.grundloen * (1 + totalPct) * (1 + args.pensionPct);
};

const buildEntryForDate = (args: {
  iso: ISODateString;
  sats: OverenskomstPeriodeSats;
  feriePct: number;
  loenPaaHelligdage: LoenPaaHelligdage | undefined;
  referenceValue: number;
}): IndeksEntry | null => {
  if (args.sats.grundloen === null) return null;
  const shSoPct = args.sats.shSoSats ?? 0;
  const fritvalgPct = args.sats.fritvalg ?? 0;
  const pensionPct = args.sats.agPension ?? 0;
  const storeBededagPct = getStoreBededagPct(args.iso, args.loenPaaHelligdage);

  const packageValue = computePackageValue({
    grundloen: args.sats.grundloen,
    feriePct: args.feriePct,
    shSoPct,
    fritvalgPct,
    storeBededagPct,
    pensionPct,
  });

  const index = args.referenceValue > 0 ? (packageValue / args.referenceValue) * 100 : 0;

  return {
    effectiveFrom: args.iso,
    grundloen: args.sats.grundloen,
    feriePct: args.feriePct,
    shSoPct,
    fritvalgPct,
    storeBededagPct,
    pensionPct,
    packageValue,
    index,
    arbejdsdage: null,
    maaneder: null,
  };
};

const decrementDate = (iso: ISODateString): ISODateString => {
  const date = isoDateToDate(iso);
  date.setUTCDate(date.getUTCDate() - 1);
  return dateToISO(date)!;
};

export const buildSHDageSet = (fra: ISODateString, til: ISODateString): Set<ISODateString> => {
  const set = new Set<ISODateString>();
  const fraDate = isoDateToDate(fra);
  const tilDate = isoDateToDate(til);

  for (let year = fraDate.getUTCFullYear(); year <= tilDate.getUTCFullYear(); year++) {
    const helligdage = beregnHelligdage(year);
    for (const helligdag of helligdage) {
      const iso = dateToISO(helligdag);
      if (!iso) continue;
      if (iso < fra || iso > til) continue;

      const dow = helligdag.getUTCDay();
      if (dow >= 1 && dow <= 5) {
        set.add(iso);
      }
    }
  }

  return set;
};

type FerieDageInput = Readonly<{
  ferieperioder?: ReadonlyArray<{
    fra?: string;
    til?: string;
  }>;
  tafPerioder?: ReadonlyArray<{
    fra?: string;
    til?: string;
    loseFeriedage?: number | string;
  }>;
}>;

export const buildFerieDageSet = (
  eoValues: FerieDageInput,
  shDage: Set<ISODateString>,
  periodeFra: ISODateString,
  periodeTil: ISODateString
): Set<ISODateString> => {
  const allFerie = new Set<ISODateString>();

  // 1. Eksplicit ferie fra ferieperioder
  const ferieperioder = eoValues.ferieperioder ?? [];
  for (const feriePeriode of ferieperioder) {
    const ferieFraRaw = feriePeriode.fra;
    const ferieTilRaw = feriePeriode.til;
    if (!ferieFraRaw || !ferieTilRaw) continue;
    if (!isISODateString(ferieFraRaw) || !isISODateString(ferieTilRaw)) continue;
    if (ferieFraRaw > ferieTilRaw) continue;

    const ferieFra = isoDateToDate(ferieFraRaw);
    const ferieTil = isoDateToDate(ferieTilRaw);

    const current = new Date(ferieFra);
    while (current <= ferieTil) {
      const iso = dateToISO(current);
      if (iso && iso >= periodeFra && iso <= periodeTil) {
        const dow = current.getUTCDay();
        if (dow >= 1 && dow <= 5 && !shDage.has(iso)) {
          allFerie.add(iso);
        }
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  // 2. Løse feriedage fra TAF-perioder (placeres som første dage)
  const tafRows = eoValues.tafPerioder ?? [];
  for (const row of tafRows) {
    const tafFraRaw = row.fra;
    const tafTilRaw = row.til;
    if (!tafFraRaw || !tafTilRaw) continue;
    if (!isISODateString(tafFraRaw) || !isISODateString(tafTilRaw)) continue;
    if (tafFraRaw > tafTilRaw) continue;

    const loseCount = typeof row.loseFeriedage === 'number' ? Math.max(0, Math.trunc(row.loseFeriedage)) : 0;
    if (loseCount <= 0) continue;

    let remaining = loseCount;
    const tafFra = isoDateToDate(tafFraRaw);
    const tafTil = isoDateToDate(tafTilRaw);

    const current = new Date(tafFra);
    while (current <= tafTil && remaining > 0) {
      const iso = dateToISO(current);
      if (iso && iso >= periodeFra && iso <= periodeTil) {
        const dow = current.getUTCDay();
        if (dow >= 1 && dow <= 5 && !shDage.has(iso) && !allFerie.has(iso)) {
          allFerie.add(iso);
          remaining--;
        }
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  return allFerie;
};

 

export function buildRegulationTimeline(input: RegulationCoreInput): RegulationIndexTimeline {
  const eoRange = getEoRange(input.eoValues);
  if (!eoRange) return { ansaettelser: [] };

  const referenceIso = parseOptionalIso(input.stamdataValues.skadesdato);
  if (!referenceIso) return { ansaettelser: [] };

  const ansaettelser: AnsaettelsesforholdIndeks[] = [];

  for (const af of input.eoValues.loenindkomstAnsaettelsesforhold ?? []) {
    if (!af.overenskomstId) continue;
    const feriePct = parsePercentToDecimal(af.feriePct);
    const loenPaaHelligdage = af.loenPaaHelligdage;

    const referenceDanish = toDanishOrUndefined(referenceIso);
    if (!referenceDanish) continue;

    const offentligSelection = resolveOffentligLoenSelection(af);
    if (offentligSelection) {
      const referenceResult = getOffentligLoenForDato(
        offentligSelection.overenskomstType,
        referenceDanish,
        offentligSelection.loentrin,
        offentligSelection.loengruppe
      );
      if (!referenceResult) continue;
      const referenceBase =
        offentligSelection.loenType === 'maanedsLoen'
          ? referenceResult.maanedsLoen
          : referenceResult.timeLoen;
      const referenceValue = computePackageValue({
        grundloen: referenceBase,
        feriePct,
        shSoPct: 0,
        fritvalgPct: 0,
        storeBededagPct: 0,
        pensionPct: 0,
      });
      if (!Number.isFinite(referenceValue) || referenceValue <= 0) continue;

      const eoFraDanish = toDanishOrUndefined(eoRange.fra);
      const eoTilDanish = toDanishOrUndefined(eoRange.til);
      if (!eoFraDanish || !eoTilDanish) continue;

      const satser = getOffentligLoenForPeriode(
        offentligSelection.overenskomstType,
        eoFraDanish,
        eoTilDanish,
        offentligSelection.loentrin,
        offentligSelection.loengruppe
      );

      const dates = new Set<ISODateString>();
      for (const sats of satser) {
        const iso = toISODateString(sats.effectiveDate.split('-').reverse().join('-'));
        if (iso >= eoRange.fra && iso <= eoRange.til) {
          dates.add(iso);
        }
      }

      const sortedDates = Array.from(dates).sort((a, b) => a.localeCompare(b));
      const shDageSet = buildSHDageSet(eoRange.fra, eoRange.til);
      const ferieDageSet = buildFerieDageSet(input.eoValues, shDageSet, eoRange.fra, eoRange.til);

      const entries: IndeksEntry[] = [];
      for (let i = 0; i < sortedDates.length; i++) {
        const iso = sortedDates[i];
        const danishDate = toDanishOrUndefined(iso);
        if (!danishDate) continue;
        const sats = getOffentligLoenForDato(
          offentligSelection.overenskomstType,
          danishDate,
          offentligSelection.loentrin,
          offentligSelection.loengruppe
        );
        if (!sats) continue;

        const grundloen =
          offentligSelection.loenType === 'maanedsLoen' ? sats.maanedsLoen : sats.timeLoen;
        const packageValue = computePackageValue({
          grundloen,
          feriePct,
          shSoPct: 0,
          fritvalgPct: 0,
          storeBededagPct: 0,
          pensionPct: 0,
        });
        const index = referenceValue > 0 ? (packageValue / referenceValue) * 100 : 0;

        let arbejdsdage: number | null = null;
        let maaneder: number | null = null;
        const periodeFra = iso;
        const periodeTil = i < sortedDates.length - 1
          ? decrementDate(sortedDates[i + 1])
          : eoRange.til;

        if (periodeTil && periodeFra <= periodeTil) {
          const result = beregnArbejdsdageOgMaaneder(
            periodeFra,
            periodeTil,
            shDageSet,
            ferieDageSet
          );
          arbejdsdage = result.arbejdsdage;
          maaneder = result.maaneder;
        }

        entries.push({
          effectiveFrom: iso,
          grundloen,
          feriePct,
          shSoPct: 0,
          fritvalgPct: 0,
          storeBededagPct: 0,
          pensionPct: 0,
          packageValue,
          index,
          arbejdsdage,
          maaneder,
        });
      }

      if (entries.length === 0) continue;

      ansaettelser.push({
        ansaettelsesforholdId: af.id,
        navn: af.navnPaaArbejdssted,
        overenskomstId: af.overenskomstId,
        referenceIso,
        referenceValue,
        entries,
      });
      continue;
    }

    const ref = resolveOverenskomstRef(af.overenskomstId);
    if (!ref) continue;

    const referenceSats = getEffektiveSatserForDato({
      overenskomstId: ref.baseId,
      dato: referenceDanish,
      applyAlmindeligLoenPaaShDageRegel: loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG,
    });
    if (!referenceSats || referenceSats.grundloen === null) continue;

    const referenceEntry = buildEntryForDate({
      iso: referenceIso,
      sats: referenceSats,
      feriePct,
      loenPaaHelligdage,
      referenceValue: 1,
    });
    if (!referenceEntry) continue;
    const referenceValue = referenceEntry.packageValue;

    const eoFraDanish = toDanishOrUndefined(eoRange.fra);
    const eoTilDanish = toDanishOrUndefined(eoRange.til);
    if (!eoFraDanish || !eoTilDanish) continue;

    const satser = getEffektiveSatserForPeriode({
      overenskomstId: ref.baseId,
      fraDato: eoFraDanish,
      tilDato: eoTilDanish,
      applyAlmindeligLoenPaaShDageRegel: loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG,
    });

    const dates = new Set<ISODateString>();
    for (const sats of satser) {
      const iso = toISODateString(sats.fraDato.split('-').reverse().join('-'));
      if (iso >= eoRange.fra && iso <= eoRange.til) {
        dates.add(iso);
      }
    }

    if (eoRange.fra <= STORE_BEDEDAG_START && eoRange.til >= STORE_BEDEDAG_START) {
      if (loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG) {
        dates.add(STORE_BEDEDAG_START as ISODateString);
      }
    }

    const sortedDates = Array.from(dates).sort((a, b) => a.localeCompare(b));

    // Byg SH-dage og feriedage set for hele EO-perioden
    const shDageSet = buildSHDageSet(eoRange.fra, eoRange.til);
    const ferieDageSet = buildFerieDageSet(input.eoValues, shDageSet, eoRange.fra, eoRange.til);

    const entries: IndeksEntry[] = [];

    for (let i = 0; i < sortedDates.length; i++) {
      const iso = sortedDates[i];
      const danishDate = toDanishOrUndefined(iso);
      if (!danishDate) continue;
      const sats = getEffektiveSatserForDato({
        overenskomstId: ref.baseId,
        dato: danishDate,
        applyAlmindeligLoenPaaShDageRegel: loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG,
      });
      if (!sats) continue;

      const entry = buildEntryForDate({
        iso,
        sats,
        feriePct,
        loenPaaHelligdage,
        referenceValue,
      });
      if (!entry) continue;

      // Beregn arbejdsdage og måneder for denne periode
      let arbejdsdage: number | null = null;
      let maaneder: number | null = null;

      const periodeFra = iso;
      const periodeTil = i < sortedDates.length - 1
        ? decrementDate(sortedDates[i + 1]) // Dagen før næste regulering
        : eoRange.til; // Sidste regulering går til slutdato

      if (periodeTil && periodeFra <= periodeTil) {
        const result = beregnArbejdsdageOgMaaneder(
          periodeFra,
          periodeTil,
          shDageSet,
          ferieDageSet
        );
        arbejdsdage = result.arbejdsdage;
        maaneder = result.maaneder;
      }

      entries.push({
        ...entry,
        arbejdsdage,
        maaneder
      });
    }

    if (entries.length === 0) continue;

    ansaettelser.push({
      ansaettelsesforholdId: af.id,
      navn: af.navnPaaArbejdssted,
      overenskomstId: af.overenskomstId,
      referenceIso,
      referenceValue,
      entries,
    });
  }

  return { ansaettelser };
}
