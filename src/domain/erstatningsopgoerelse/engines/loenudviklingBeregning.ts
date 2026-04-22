import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { dateToISO, isoToDanish, isISODateString, subtractOneDay } from '../../../types/branded';
import { aarsloenAslMax } from '../../../data/lovbestemteRates';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { parsePercentToDecimal } from '../../../utils/numberParsing';
import { roundByMethod } from '../../../utils/rounding';
import { buildBeregningsperiodeRange, buildIncomeForRanges, type IncomePeriodResult, type IsoRange } from '../helpers/indtaegtPerioder';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { beregnArbejdsdageOgMaaneder } from './arbejdsdageMaaneder';
import { isoDateToDate } from '../../dates/isoDate';
import { addDays, createDate } from '../../../utils/dateUtils';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import {
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
  getGrundloenAngivetPerForOverenskomst,
  getOffentligTillaegsSatserForDato,
  getOffentligTillaegsSatserForPeriode,
  getReguleringsDatoIntervalForOverenskomst,
  resolveOverenskomstRef,
  getOffentligOverenskomstTypeById,
} from '../../../data/overenskomstRates';
import { getOffentligLoenForDato, getOffentligLoenForPeriode } from '../../../data/offentligLoenLookup';
import {
  resolveOffentligLoenTypeFromLabel,
  toLoentrin,
  type OffentligOverenskomstType,
  type OffentligLoenType,
  type Loengruppe,
  type Loentrin,
} from '../../../data/offentligLoenTypes';
import { getStatistiskLoenudvikling, type StatistiskLoenudviklingId } from '../../../data/statistiskeRates';
import { getKRLSatstabel, type KRLSatstabelId } from '../../../data/krlRates';
import { STORE_BEDEDAG_START } from '../../../config/dateRanges';
import { STORE_BEDEDAG_PCT } from '../../../config/regulatoryRates';
import { getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde, type LoenudviklingSource } from '../helpers/angivetLoenHelpers';
import { buildTafArbejdsdageSetFromRows } from './tafDaySets';
import { hasIndtastetLoenoplysninger } from '../helpers/loenoplysningerInput';
import { isTafRowEmpty } from '../helpers/rowEmpty';
import type { Calculable, IndkomstSkadestidspunktModel, LoenudviklingModel, LoenudviklingSegment, MoneyOre } from '../shared/eoTypes';
import { clampMoneyOreToZero, ensureMoneyOre, fromOre, roundKroner, toOre } from '../shared/eoMoney';
import {
  convertAnciennitetSats,
  isAslStatistikModel,
  parseDanishToIso,
  resolvePctPointFromSatsOrInput,
  resolveOffentligLoenEkstraGrundloen,
  resolveAnvendtReguleringsdato as resolveAnvendtReguleringsdatoShared,
  resolveStatistikModelId,
} from '../helpers/eoSharedUtils';
import { round2 as roundToTwoDecimals } from '../../../utils/roundingShortcuts';

// =============================================================================
// INVARIANT-NOTE: Alle throw new Error() i denne fil er defensive invarianter.
// De kan kun nås hvis erstatningsopgoerelseValidator har fejlet i at afvise
// input, der burde have blokeret beregningen. Under normal udførelse er samtlige
// throw-stier dækket af validator-/preflight-checks i snapshot-orchestreringen.
// Uventede throws fanges af computeEoSnapshot og resulterer i fail_closed med
// failClosedReason: 'runtime_exception'. Se eo-snapshot-contract.md §3.3.
// =============================================================================

const asCalculable = <T>(value: T): Calculable<T> => ({ status: 'ok', value });

export const resolveLoenudviklingRows = (
  values: ErstatningsopgoerelseValues
): ReadonlyArray<LoenudviklingSource> => {
  return resolveLoenudviklingKilde(values);
};

export const segmentAmountOre = (baseLoenKronerRounded: number, quantity: number, deltaPct: number): MoneyOre => {
  const amountKroner = baseLoenKronerRounded * quantity * (1 + deltaPct / 100);
  return toOre(roundKroner(amountKroner));
};

export const buildTafArbejdsdageSet = (
  values: ErstatningsopgoerelseValues,
  tafRanges: readonly IsoRange[]
): ReadonlySet<ISODateString> => {
  for (const row of values.tafPerioder ?? []) {
    if (isTafRowEmpty(row)) continue;
    const fra = row.fra;
    const til = row.til;
    if (!fra || !til) {
      throw new Error('TAF-periode mangler fra/til'); // invariant: dækket af validator
    }
    if (!isISODateString(fra) || !isISODateString(til) || fra > til) {
      throw new Error('TAF-periode er ugyldig'); // invariant: dækket af validator
    }
  }

  return buildTafArbejdsdageSetFromRows(values.tafPerioder ?? [], values.ferieperioder ?? [], {
    authoritativeRanges: tafRanges,
  });
};

export const countTafArbejdsdageInRange = (arbejdsdage: ReadonlySet<ISODateString>, fra: ISODateString, til: ISODateString): number => {
  let count = 0;
  for (const iso of arbejdsdage) {
    if (iso >= fra && iso <= til) {
      count += 1;
    }
  }
  return count;
};

type LoenudviklingStrategi = 'ingen' | 'statistik' | 'overenskomst' | 'manual' | 'krl';
type LoenreguleringsSegment = Readonly<IsoRange & { deltaPct: number }>;
type LoenudviklingAf = LoenudviklingSource;
type LoenudviklingManualRow = NonNullable<LoenudviklingAf['loenudviklingManuelTableData']>[number];
type OffentligLoenSelection = Readonly<{
  overenskomstType: OffentligOverenskomstType;
  loenType: OffentligLoenType;
  loentrin: Loentrin;
  loengruppe: Loengruppe;
}>;
type KonsolideretLoenudvikling =
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
    fritvalgPct: number;
    shSoPct: number;
    pensionPct: number;
    tafBeregningsenhed: TafBeregningsenhed;
    harAnciennitetstillaegEfterSkadedatoen: boolean;
    anciennitetstillaegDato: ISODateString | undefined;
    anciennitetstillaegSatsAngivesPer: 'Time' | 'Måned';
    anciennitetstillaegSatsValue: number | undefined;
    offentligLoenEkstraGrundloen: number;
    offentlig: OffentligLoenSelection | null;
    tafRanges: readonly IsoRange[];
  }>
  | Readonly<{
    strategi: 'manual';
    label: string;
    reguleringsdato: ISODateString | undefined;
    loenPaaHelligdage: string;
    feriePct: number;
    manualRows: readonly LoenudviklingManualRow[];
    tafRanges: readonly IsoRange[];
  }>
  | Readonly<{
    strategi: 'krl';
    label: string;
    reguleringsdato: ISODateString | undefined;
    krlSatstabelId: KRLSatstabelId;
    tafRanges: readonly IsoRange[];
  }>;

const parseManualPercentToPct = (value: string | undefined): number => parsePercentToDecimal(value) * 100;

/**
 * Manuel ferieprocent i PDF-sporet returneres i pct-point-konvention
 * (fx `15` for 15 %), fordi computePackageValuePct arbejder i pct-point.
 */
const resolveManualFeriePctPct = (rowFeriepenge: string | undefined, defaultFeriePct: number | undefined): number => {
  if (typeof rowFeriepenge === 'string' && rowFeriepenge.trim() !== '') {
    return parsePercentToDecimal(rowFeriepenge) * 100;
  }
  return defaultFeriePct ?? 0;
};

const resolveStatistikModelIdFromLabel = (label: string): StatistiskLoenudviklingId | undefined =>
  resolveStatistikModelId(label);

/**
 * Beregner samlet lønpakkeværdi for reguleringsindeks i PDF-modellen.
 *
 * Procent-konvention i denne funktion:
 * - Alle procentsatser angives som hele pct-tal (fx `17.3` for 17,3 %).
 * - Funktionen dividerer derfor procentsatser med 100 internt.
 */
const computePackageValuePct = (args: {
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

const normalizeManualRows = (rows: readonly LoenudviklingManualRow[]): string => {
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

type UniformPrimitive = string | number | boolean | null;
type AnvendtReguleringsdatoInput = Readonly<{ saerligFraDatoRegulering?: string }>;

const resolveOffentligLoenSelection = (
  af: LoenudviklingAf,
  offentligType: OffentligOverenskomstType
): OffentligLoenSelection => {
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

const assertUniform = (
  active: readonly LoenudviklingAf[],
  selector: (af: LoenudviklingAf) => UniformPrimitive,
  fieldLabel: string
): void => {
  if (active.length <= 1) return;
  const first = selector(active[0]);
  for (let i = 1; i < active.length; i += 1) {
    const current = selector(active[i]);
    if (current !== first) {
      throw new InkonsistenteLoenudviklingsIndstillingerError(fieldLabel); // invariant: dækket af validator
    }
  }
};

class InkonsistenteLoenudviklingsIndstillingerError extends Error {
  readonly fieldLabel: string;

  constructor(fieldLabel: string) {
    super(`Inkonsistente loenudviklingsindstillinger: ${fieldLabel}`);
    this.name = 'InkonsistenteLoenudviklingsIndstillingerError';
    this.fieldLabel = fieldLabel;
  }
}

const buildSegmentsFromStartDates = (
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

const assertSortedByStartIso = <T extends { startIso: ISODateString }>(
  items: readonly T[],
  context: string
): void => {
  for (let i = 1; i < items.length; i += 1) {
    if (items[i - 1].startIso > items[i].startIso) {
      throw new Error(`Intern fejl: usorteret startdato-liste (${context})`);
    }
  }
};

const findLatestByDateInSortedList = <T extends { startIso: ISODateString }>(
  sortedItems: readonly T[],
  date: ISODateString,
  context: string
): T | undefined => {
  assertSortedByStartIso(sortedItems, context);
  for (let i = sortedItems.length - 1; i >= 0; i -= 1) {
    if (sortedItems[i].startIso <= date) return sortedItems[i];
  }
  return undefined;
};

const buildZeroDeltaSegment = (segment: IsoRange): LoenreguleringsSegment => ({
  ...segment,
  deltaPct: 0,
});

const ensurePositiveFiniteNumber = (
  value: number,
  errorMessage: string
): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(errorMessage);
  }
  return value;
};

const resolveEffectiveBaseEntry = <T extends { startIso: ISODateString }>(
  sortedItems: readonly T[],
  date: ISODateString,
  context: string,
  missingMessage: string
): Readonly<{ entry: T; usedFallback: boolean }> => {
  const baseEntry = findLatestByDateInSortedList(sortedItems, date, `${context}:base`);
  if (baseEntry) return { entry: baseEntry, usedFallback: false };
  const firstEntry = sortedItems[0];
  if (!firstEntry) {
    throw new Error(missingMessage);
  }
  return { entry: firstEntry, usedFallback: true };
};

const resolveReguleringsStrategi = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues,
  tafBeregningsenhed: TafBeregningsenhed,
  options: Readonly<{ tafRanges: readonly IsoRange[] }>
): Readonly<{ strategi: LoenudviklingStrategi; label: string; konsolideret: KonsolideretLoenudvikling | null }> => {
  // Strategikontrakt:
  // - ingen: ingen ekstra krav
  // - statistik: statistikmodel
  // - manual: manuelle reguleringsraekker
  // - overenskomst: overenskomstId + loen paa helligdage
  const ansaettelser = resolveLoenudviklingRows(values);
  const alleIngen = ansaettelser.length > 0 && ansaettelser.every((af) => af.loenudviklingBeregningsgrundlag === 'Ingen');
  if (alleIngen) return { strategi: 'ingen', label: 'Ingen', konsolideret: null };

  const active = ansaettelser.filter((af) => af.loenudviklingBeregningsgrundlag && af.loenudviklingBeregningsgrundlag !== 'Ingen');
  if (active.length === 0) {
    throw new Error('Loenudviklingsstrategi er ikke valgt');
  }
  const angivetLoen =
    values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn';

  assertUniform(active, (af) => af.loenudviklingBeregningsgrundlag ?? '', 'beregningsgrundlag');
  assertUniform(
    active,
    (af) => (isISODateString(af.saerligFraDatoRegulering) ? af.saerligFraDatoRegulering : ''),
    'saerlig fra dato regulering'
  );
  const basis = active[0].loenudviklingBeregningsgrundlag;
  if (!basis) {
    throw new Error('Loenudviklingsstrategi er ikke valgt');
  }

  const strategi: LoenudviklingStrategi =
    basis === 'Statistik' ? 'statistik'
      : basis === 'Overenskomst' ? 'overenskomst'
        : basis === 'Manuelt angivet' ? 'manual'
          : basis === 'KRL satstabel' ? 'krl'
            : 'ingen';

  const kræverFeriePctVedBeregningsperiode =
    values.beregnesUdFra === 'Beregningsperiode' && active.some((af) => hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []));

  const activeMedLoenoplysninger = active.filter((af) => hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []));

  if (strategi === 'statistik') {
    assertUniform(active, (af) => (af.loenudviklingStatistikModel ?? '').trim(), 'statistikmodel');
  } else if (strategi === 'overenskomst') {
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
      if (activeMedLoenoplysninger.length > 1) {
        assertUniform(
          activeMedLoenoplysninger,
          (af) => (typeof af.feriePct === 'number' ? af.feriePct : null),
          'feriepct'
        );
      }
    }

    const offentligType = active[0].overenskomstId
      ? getOffentligOverenskomstTypeById(active[0].overenskomstId)
      : undefined;
    if (offentligType) {
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
  } else if (strategi === 'manual') {
    assertUniform(active, (af) => normalizeManualRows(af.loenudviklingManuelTableData ?? []), 'manuelle reguleringsraekker');
    if (!angivetLoen) {
      if (activeMedLoenoplysninger.length > 1) {
        assertUniform(
          activeMedLoenoplysninger,
          (af) => (typeof af.feriePct === 'number' ? af.feriePct : null),
          'feriepct'
        );
      }
    }
  } else if (strategi === 'krl') {
    assertUniform(active, (af) => af.loenudviklingKRLSatstabel ?? '', 'KRL satstabel');
  }

  const skadedato = isISODateString(stamdataValues.skadedato) ? stamdataValues.skadedato : undefined;
  const anvendtReguleringsdato = resolveAnvendtReguleringsdato(
    values,
    { saerligFraDatoRegulering: active[0].saerligFraDatoRegulering },
    skadedato
  );
  const tafRanges = options.tafRanges;
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
        reguleringsdato: anvendtReguleringsdato,
        statistikModel: active[0].loenudviklingStatistikModel ?? '',
        tafRanges,
      },
    };
  }

  if (strategi === 'overenskomst') {
    if (!active[0].overenskomstId) {
      throw new Error('Loenudvikling kan ikke beregnes: overenskomst mangler');
    }
    if (kræverFeriePctVedBeregningsperiode && active.some((af) =>
      hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []) && typeof af.feriePct !== 'number'
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
      strategi,
      label,
      konsolideret: {
        strategi,
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
  }

  if (strategi === 'manual') {
    if (kræverFeriePctVedBeregningsperiode && active.some((af) =>
      hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []) && typeof af.feriePct !== 'number'
    )) {
      throw new Error('Loenudvikling kan ikke beregnes: feriepct mangler');
    }
    const feriePct = typeof active[0].feriePct === 'number' ? active[0].feriePct : 0;
    return {
      strategi,
      label,
      konsolideret: {
        strategi,
        label,
        reguleringsdato: anvendtReguleringsdato,
        loenPaaHelligdage: active[0].loenPaaHelligdage ?? '',
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
        reguleringsdato: anvendtReguleringsdato,
        krlSatstabelId: krlId as KRLSatstabelId,
        tafRanges,
      },
    };
  }

  throw new Error('Loenudviklingsstrategi er ugyldig');
};

const buildLoenudviklingFromStatistik = (
  konsolideret: KonsolideretLoenudvikling
): ReadonlyArray<LoenreguleringsSegment> => {
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

  if (isAslStatistikModel(modelLabel)) {
    const baseYear = Number(konsolideret.reguleringsdato.slice(0, 4));
    const directBaseIndex = Number.isFinite(baseYear) ? aarsloenAslMax[baseYear as keyof typeof aarsloenAslMax] : undefined;
    if (directBaseIndex !== undefined) {
      ensurePositiveFiniteNumber(directBaseIndex, 'Loenudvikling kan ikke beregnes: ugyldigt ASL basisindeks');
    }

    const availableAslYears = Object.entries(aarsloenAslMax)
      .map(([yearRaw, idxRaw]) => ({ year: Number(yearRaw), idx: idxRaw }))
      .filter((entry) => Number.isFinite(entry.year))
      .sort((a, b) => a.year - b.year);
    const availableAslEntries = availableAslYears.filter(
      (entry): entry is Readonly<{ year: number; idx: number }> => typeof entry.idx === 'number'
    );
    const firstAvailable = availableAslEntries[0];
    if (!firstAvailable) {
      throw new Error('Loenudvikling kan ikke beregnes: mangler ASL basisindeks');
    }
    const firstAvailableIndex = ensurePositiveFiniteNumber(
      firstAvailable.idx,
      'Loenudvikling kan ikke beregnes: ugyldigt ASL basisindeks'
    );
    const baseIndex = typeof directBaseIndex === 'number' ? directBaseIndex : firstAvailableIndex;
    const effectiveBaseYear = typeof directBaseIndex === 'number' ? baseYear : firstAvailable.year;

    const aslSegments = buildAslReguleringsSegments(konsolideret.tafRanges)
      .map<LoenreguleringsSegment>((segment) => {
        if (segment.year < effectiveBaseYear) {
          return buildZeroDeltaSegment(segment);
        }
        const idx = aarsloenAslMax[segment.year as keyof typeof aarsloenAslMax];
        if (idx === undefined) {
          return buildZeroDeltaSegment(segment);
        }
        ensurePositiveFiniteNumber(idx, 'Loenudvikling kan ikke beregnes: ugyldigt ASL indeks');
        return { fra: segment.fra, til: segment.til, deltaPct: roundByMethod((idx / baseIndex - 1) * 100, 2, 'halfAwayFromZero') };
      })
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
      return { startIso, indeksvaerdi: entry.indeksvaerdi };
    })
    .filter((entry): entry is Readonly<{ startIso: ISODateString; indeksvaerdi: number }> => Boolean(entry))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  const effectiveBase = resolveEffectiveBaseEntry(
    periodStarts,
    konsolideret.reguleringsdato,
    'statistik',
    'Loenudvikling kan ikke beregnes: mangler basisindeks'
  );
  ensurePositiveFiniteNumber(effectiveBase.entry.indeksvaerdi, 'Loenudvikling kan ikke beregnes: ugyldigt basisindeks');
  const effectiveBaseStartIso = effectiveBase.entry.startIso;

  const segments: LoenreguleringsSegment[] = [];
  for (const range of konsolideret.tafRanges) {
    const starts = new Set<ISODateString>();
    for (const entry of periodStarts) {
      if (entry.startIso > range.fra && entry.startIso <= range.til) starts.add(entry.startIso);
    }
    for (const segment of buildSegmentsFromStartDates(range, starts)) {
      if (segment.fra < effectiveBaseStartIso) {
        segments.push(buildZeroDeltaSegment(segment));
        continue;
      }
      const idxEntry = findLatestByDateInSortedList(periodStarts, segment.fra, 'statistik:segment');
      if (!idxEntry) {
        throw new Error('Intern fejl: mangler statistikindeks efter effective base');
      }
      ensurePositiveFiniteNumber(idxEntry.indeksvaerdi, 'Loenudvikling kan ikke beregnes: ugyldigt indeks for segment');
      segments.push({
        ...segment,
        deltaPct: roundByMethod((idxEntry.indeksvaerdi / effectiveBase.entry.indeksvaerdi - 1) * 100, 2, 'halfAwayFromZero'),
      });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen statistiksegmenter');
  }
  return segments;
};

const buildLoenudviklingFromKRL = (
  konsolideret: KonsolideretLoenudvikling
): ReadonlyArray<LoenreguleringsSegment> => {
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
  // Bevidst parity med eoDebugRegulationCore:
  // KRL strategien modellerer kun selve KRL-indeksserien.
  // Store Bededag indgår derfor ikke som separat breakpoint i denne strategi.

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
  const effectiveBase = resolveEffectiveBaseEntry(
    periodStarts,
    konsolideret.reguleringsdato,
    'krl',
    'Loenudvikling kan ikke beregnes: mangler KRL basisindeks'
  );
  const basePct = effectiveBase.entry.reguleringsPct;
  if (!Number.isFinite(basePct) || (100 + basePct) <= 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ugyldigt KRL basisindeks');
  }
  const effectiveBaseStartIso = effectiveBase.entry.startIso;

  // Byg segmenter for hvert taf-interval
  const segments: LoenreguleringsSegment[] = [];
  for (const range of konsolideret.tafRanges) {
    const starts = new Set<ISODateString>();
    for (const entry of periodStarts) {
      if (entry.startIso > range.fra && entry.startIso <= range.til) starts.add(entry.startIso);
    }
    for (const segment of buildSegmentsFromStartDates(range, starts)) {
      if (segment.fra < effectiveBaseStartIso) {
        segments.push(buildZeroDeltaSegment(segment));
        continue;
      }
      const idxEntry = findLatestByDateInSortedList(periodStarts, segment.fra, 'krl:segment');
      if (!idxEntry) {
        throw new Error('Intern fejl: mangler KRL-indeks efter effective base');
      }
      if (!Number.isFinite(idxEntry.reguleringsPct) || (100 + idxEntry.reguleringsPct) <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldigt KRL indeks for segment');
      }
      // Indeksforhold: deltaPct = ((100 + periodePct) / (100 + basePct) - 1) * 100
      const deltaPct = roundByMethod(((100 + idxEntry.reguleringsPct) / (100 + basePct) - 1) * 100, 2, 'halfAwayFromZero');
      segments.push({ ...segment, deltaPct });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen KRL segmenter');
  }
  return segments;
};

const buildLoenudviklingFromOverenskomst = (
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
      if (offentligEffectiveBase.startIso > range.fra && offentligEffectiveBase.startIso <= range.til) {
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

  const baseSatsAtReguleringsdato = getEffektiveSatserForDato({
    overenskomstId: overenskomstRef.baseId,
    dato: reguleringsdatoDa,
    applyAlmindeligLoenPaaShDageRegel: applyShRegel,
  });
  const resolvePrivateEffectiveBase = (): Readonly<{ startIso: ISODateString; sats: NonNullable<typeof baseSatsAtReguleringsdato> }> => {
    if (baseSatsAtReguleringsdato) {
      return { startIso: reguleringsdatoIso, sats: baseSatsAtReguleringsdato };
    }
    const interval = getReguleringsDatoIntervalForOverenskomst(konsolideret.overenskomstId);
    if (!interval) {
      throw new Error('Loenudvikling kan ikke beregnes: basissats mangler');
    }
    const firstStartIso = parseDanishToIso(interval.fraDato);
    if (!firstStartIso) {
      throw new Error('Loenudvikling kan ikke beregnes: basissats mangler');
    }
    const firstSats = getEffektiveSatserForDato({
      overenskomstId: overenskomstRef.baseId,
      dato: interval.fraDato,
      applyAlmindeligLoenPaaShDageRegel: applyShRegel,
    });
    if (!firstSats) {
      throw new Error('Loenudvikling kan ikke beregnes: basissats mangler');
    }
    return { startIso: firstStartIso, sats: firstSats };
  };
  const privateEffectiveBase = resolvePrivateEffectiveBase();
  if (typeof privateEffectiveBase.sats.grundloen !== 'number') {
    throw new Error('Loenudvikling kan ikke beregnes: basissats mangler');
  }
  ensurePositiveFiniteNumber(privateEffectiveBase.sats.grundloen, 'Loenudvikling kan ikke beregnes: ugyldig basisgrundloen');

  const basePackage = computePackageValuePct({
    grundloen: privateEffectiveBase.sats.grundloen,
    feriePct,
    shSoPct: typeof privateEffectiveBase.sats.shSoSats === 'number' ? privateEffectiveBase.sats.shSoSats * 100 : 0,
    fritvalgPct: typeof privateEffectiveBase.sats.fritvalg === 'number' ? privateEffectiveBase.sats.fritvalg * 100 : 0,
    pensionPct: typeof privateEffectiveBase.sats.agPension === 'number' ? privateEffectiveBase.sats.agPension * 100 : 0,
    storeBededagPct: applyShRegel && reguleringsdatoIso >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0,
  });
  if (!Number.isFinite(basePackage) || basePackage <= 0) {
    throw new Error('Loenudvikling kan ikke beregnes: basispakke er ugyldig');
  }

  // Bevidst adskilt fra eoDebugRegulationCore:
  // denne motor bygger relative deltaPct-segmenter til TAF-beregning,
  // mens debug-motoren bygger absolutte indeks-entries til visning.
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
    if (privateEffectiveBase.startIso > range.fra && privateEffectiveBase.startIso <= range.til) {
      starts.add(privateEffectiveBase.startIso);
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
      // Decision note: Samme proxy-regel som i offentlig sti.
      // Re-evalueres hvis domænet kræver streng 0-delta for hele ude-dækningsintervallet.
      const useFallbackBaseBeforeCoverage =
        applyShRegel &&
        segment.fra >= STORE_BEDEDAG_START &&
        segment.fra < privateEffectiveBase.startIso;
      const effectiveSats = sats ?? (useFallbackBaseBeforeCoverage ? privateEffectiveBase.sats : undefined);
      if (!effectiveSats || (segment.fra < privateEffectiveBase.startIso && !useFallbackBaseBeforeCoverage)) {
        segments.push(buildZeroDeltaSegment(segment));
        continue;
      }
      if (typeof effectiveSats.grundloen !== 'number') {
        throw new Error('Loenudvikling kan ikke beregnes: mangler sats for segment');
      }
      ensurePositiveFiniteNumber(effectiveSats.grundloen, 'Loenudvikling kan ikke beregnes: ugyldig segmentgrundloen');
      const packageValue = computePackageValuePct({
        grundloen: (() => {
          const anciennitetAktiv = Boolean(anciennitetForIndex && segment.fra >= anciennitetForIndex.activeFromIso);
          return anciennitetAktiv && anciennitetForIndex
            ? effectiveSats.grundloen + anciennitetForIndex.supplementValue
            : effectiveSats.grundloen;
        })(),
        feriePct,
        shSoPct: typeof effectiveSats.shSoSats === 'number' ? effectiveSats.shSoSats * 100 : 0,
        fritvalgPct: typeof effectiveSats.fritvalg === 'number' ? effectiveSats.fritvalg * 100 : 0,
        pensionPct: typeof effectiveSats.agPension === 'number' ? effectiveSats.agPension * 100 : 0,
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
};

const buildLoenudviklingFromManual = (
  konsolideret: KonsolideretLoenudvikling
): ReadonlyArray<LoenreguleringsSegment> => {
  if (konsolideret.strategi !== 'manual') {
    throw new Error('Loenudvikling kan ikke beregnes: manuel strategi mangler');
  }
  const manualRows = konsolideret.manualRows;
  const baseRow = manualRows[0];
  if (!baseRow) {
    throw new Error('Loenudvikling kan ikke beregnes: manuelle reguleringsraekker mangler');
  }
  const resolveStoreBededagPctForManualDate = (iso: ISODateString | undefined): number =>
    konsolideret.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG && iso && iso >= STORE_BEDEDAG_START
      ? STORE_BEDEDAG_PCT
      : 0;

  const basePackage = computePackageValuePct({
    grundloen: amountValueToNumber(baseRow.grundloen) ?? 0,
    feriePct: resolveManualFeriePctPct(baseRow.feriepenge, konsolideret.feriePct),
    shSoPct: parseManualPercentToPct(baseRow.shSoSats),
    fritvalgPct: parseManualPercentToPct(baseRow.fritvalg),
    pensionPct: parseManualPercentToPct(baseRow.agPension),
    storeBededagPct: resolveStoreBededagPctForManualDate(konsolideret.reguleringsdato),
  });
  if (!Number.isFinite(basePackage) || basePackage <= 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ugyldig manuel basispakke');
  }

  const datedRows = manualRows
    .slice(1)
    .map((row) => {
      const startIso = parseDanishToIso(row.dato);
      if (!startIso) return null;
      const components = {
        grundloen: amountValueToNumber(row.grundloen) ?? 0,
        feriePct: resolveManualFeriePctPct(row.feriepenge, konsolideret.feriePct),
        shSoPct: parseManualPercentToPct(row.shSoSats),
        fritvalgPct: parseManualPercentToPct(row.fritvalg),
        pensionPct: parseManualPercentToPct(row.agPension),
      };
      const packageValue = computePackageValuePct({
        ...components,
        storeBededagPct: 0,
      });
      if (!Number.isFinite(packageValue) || packageValue <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldig manuel pakkevaerdi');
      }
      return { startIso, packageValue, components };
    })
    .filter((row): row is Readonly<{
      startIso: ISODateString;
      packageValue: number;
      components: Readonly<{ grundloen: number; feriePct: number; shSoPct: number; fritvalgPct: number; pensionPct: number }>;
    }> => Boolean(row))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  const hasStoreBededagSegmenter =
    konsolideret.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG &&
    konsolideret.tafRanges.some((range) => range.til >= STORE_BEDEDAG_START);

  const segments: LoenreguleringsSegment[] = [];
  for (const range of konsolideret.tafRanges) {
    const starts = new Set<ISODateString>();
    for (const row of datedRows) {
      if (row.startIso > range.fra && row.startIso <= range.til) starts.add(row.startIso);
    }
    if (hasStoreBededagSegmenter && range.fra < STORE_BEDEDAG_START && range.til >= STORE_BEDEDAG_START) {
      starts.add(STORE_BEDEDAG_START);
    }
    for (const segment of buildSegmentsFromStartDates(range, starts)) {
      const segmentRow = findLatestByDateInSortedList(datedRows, segment.fra, 'manual:segment');
      const packageValueBase = segmentRow ? segmentRow.packageValue : basePackage;
      const packageValue = hasStoreBededagSegmenter && segment.fra >= STORE_BEDEDAG_START
        ? computePackageValuePct({
            ...(segmentRow
              ? segmentRow.components
              : {
                  grundloen: amountValueToNumber(baseRow.grundloen) ?? 0,
                  feriePct: resolveManualFeriePctPct(baseRow.feriepenge, konsolideret.feriePct),
                  shSoPct: parseManualPercentToPct(baseRow.shSoSats),
                  fritvalgPct: parseManualPercentToPct(baseRow.fritvalg),
                  pensionPct: parseManualPercentToPct(baseRow.agPension),
                }),
            storeBededagPct: resolveStoreBededagPctForManualDate(segment.fra),
          })
        : packageValueBase;
      if (!Number.isFinite(packageValue) || packageValue <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldig manuel segmentvaerdi');
      }
      segments.push({
        ...segment,
        deltaPct: roundByMethod((packageValue / basePackage - 1) * 100, 2, 'halfAwayFromZero'),
      });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen manuelle segmenter');
  }
  return segments;
};

export const buildLoenudviklingModel = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues,
  tafBeregningsenhed: TafBeregningsenhed,
  indkomstSkadestidspunkt: IndkomstSkadestidspunktModel | null,
  options: Readonly<{
    tafRanges: readonly IsoRange[];
    incomeForBeregningsperiode?: IncomePeriodResult | null;
  }>
): LoenudviklingModel => {
  const tafRanges = options.tafRanges;
  const buildFromStrategiAndBase = (
    strategiData: Readonly<{ strategi: LoenudviklingStrategi; label: string; konsolideret: KonsolideretLoenudvikling | null }>,
    baseLoen: number
  ): Readonly<{
    loenudviklingLabel: string;
    beregnedeSegmenter: readonly LoenudviklingSegment[];
    loenudviklingTotal: Calculable<MoneyOre>;
  }> => {
    if (!Number.isFinite(baseLoen) || baseLoen <= 0 || tafRanges.length === 0) {
      throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
    }

    const baseLoenRounded = roundKroner(baseLoen);
    const baseLoenOre = toOre(baseLoenRounded);
    const tafArbejdageSet = tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
      ? buildTafArbejdsdageSet(values, tafRanges)
      : null;
    const loenudviklingLabel = strategiData.label;

    const loenreguleringssegmenter: ReadonlyArray<LoenreguleringsSegment> = (() => {
      if (strategiData.strategi === 'ingen') {
        return tafRanges.map((range) => ({ ...range, deltaPct: 0 }));
      }
      const konsolideret = strategiData.konsolideret;
      if (!konsolideret) {
        throw new Error('Loenudvikling kan ikke beregnes: strategi mangler');
      }
      if (konsolideret.strategi === 'statistik') return buildLoenudviklingFromStatistik(konsolideret);
      if (konsolideret.strategi === 'overenskomst') return buildLoenudviklingFromOverenskomst(konsolideret);
      if (konsolideret.strategi === 'manual') return buildLoenudviklingFromManual(konsolideret);
      if (konsolideret.strategi === 'krl') return buildLoenudviklingFromKRL(konsolideret);
      throw new Error('Loenudvikling kan ikke beregnes: ukendt strategi');
    })();

    if (loenreguleringssegmenter.length === 0) {
      throw new Error('Loenudvikling kan ikke beregnes: ingen reguleringssegmenter');
    }

    const beregnedeSegmenter: Array<LoenudviklingModel['beregnedeSegmenter'][number]> = [];
    for (const segment of loenreguleringssegmenter) {
      const roundedDeltaPct = roundByMethod(segment.deltaPct, 2, 'halfAwayFromZero');
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
        const maaneder = roundByMethod(maanederRaw, 4, 'halfAwayFromZero');
        beregnedeSegmenter.push({
          kind: 'maaneder',
          fra: segment.fra,
          til: segment.til,
          maaneder,
          maanedsloenOre: baseLoenOre,
          deltaPct: roundedDeltaPct,
          amountOre: segmentAmountOre(baseLoenRounded, maaneder, roundedDeltaPct),
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
          amountOre: segmentAmountOre(baseLoenRounded, arbejdsdage, roundedDeltaPct),
        });
      }
    }

    if (beregnedeSegmenter.length === 0) {
      throw new Error('Loenudvikling kan ikke beregnes: ingen beregnede segmenter');
    }

    const totalOre = clampMoneyOreToZero(
      ensureMoneyOre(beregnedeSegmenter.reduce((sum, segment) => sum + segment.amountOre, 0))
    );
    return { loenudviklingLabel, loenudviklingTotal: asCalculable(totalOre), beregnedeSegmenter };
  };

  const buildPerAnsaettelseModel = (): LoenudviklingModel => {
    const beregningsperiodeRange = buildBeregningsperiodeRange(values);
    if (!beregningsperiodeRange) {
      throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
    }
    const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
    const strategiDataByIndex = ansaettelser.map((ansaettelsesforhold) => resolveReguleringsStrategi({
      ...values,
      loenindkomstAnsaettelsesforhold: [ansaettelsesforhold],
    }, stamdataValues, tafBeregningsenhed, { tafRanges }));
    const income =
      options.incomeForBeregningsperiode
      ?? buildIncomeForRanges(values, [beregningsperiodeRange], undefined, stamdataValues.skadedato);
    if (income.employers.length === 0) {
      const alleIngen = strategiDataByIndex.every((strategiData) => strategiData.strategi === 'ingen');
      if (alleIngen) {
        const beregnedeSegmenter = tafRanges.map<LoenudviklingSegment>((range) => (
          tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER
            ? {
              kind: 'maaneder',
              fra: range.fra,
              til: range.til,
              maaneder: roundByMethod(
                beregnArbejdsdageOgMaaneder(range.fra, range.til, new Set<ISODateString>(), new Set<ISODateString>()).maaneder,
                4,
                'halfAwayFromZero'
              ),
              maanedsloenOre: 0,
              deltaPct: 0,
              amountOre: 0,
            }
            : {
              kind: 'arbejdsdage',
              fra: range.fra,
              til: range.til,
              arbejdsdage: countTafArbejdsdageInRange(
                buildTafArbejdsdageSet(values, tafRanges),
                range.fra,
                range.til
              ),
              dagsloenOre: 0,
              deltaPct: 0,
              amountOre: 0,
            }
        ));
        return {
          loenudviklingLabel: 'Ingen',
          loenudviklingTotal: asCalculable(0),
          beregningsenhed: tafBeregningsenhed,
          beregnedeSegmenter,
          perAnsaettelse: [],
        };
      }
      throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
    }

    const divisor = tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER
      ? indkomstSkadestidspunkt?.maaneder
      : indkomstSkadestidspunkt?.arbejdsdage;
    if (!Number.isFinite(divisor) || !divisor || divisor <= 0) {
      throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
    }

    const perAnsaettelse: Array<LoenudviklingModel['perAnsaettelse'][number]> = [];

    for (const employer of income.employers) {
      const ansaettelsesforhold = ansaettelser[employer.index];
      if (!ansaettelsesforhold) continue;
      const baseLoen = employer.amount / divisor;
      const strategiData = strategiDataByIndex[employer.index];
      if (!strategiData) continue;
      const modelForAf = buildFromStrategiAndBase(strategiData, baseLoen);
      const ansaettelsesforholdNavn = employer.name !== ''
        ? employer.name
        : (ansaettelsesforhold.navnPaaArbejdssted?.trim() || 'Arbejdssted');

      perAnsaettelse.push({
        ansaettelsesforholdId: ansaettelsesforhold.id,
        ansaettelsesforholdNavn,
        loenudviklingLabel: modelForAf.loenudviklingLabel,
        loenudviklingTotal: modelForAf.loenudviklingTotal,
        beregnedeSegmenter: modelForAf.beregnedeSegmenter,
      });
    }

    if (perAnsaettelse.length === 0) {
      throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
    }

    const beregnedeSegmenter = perAnsaettelse
      .flatMap((entry) => entry.beregnedeSegmenter)
      .slice()
      .sort((a, b) => (a.fra < b.fra ? -1 : a.fra > b.fra ? 1 : 0));
    const totalOre = clampMoneyOreToZero(
      ensureMoneyOre(
        perAnsaettelse.reduce((sum, entry) => {
          if (entry.loenudviklingTotal.status !== 'ok') {
            throw new Error('Loenudvikling kan ikke beregnes for den valgte opsætning.');
          }
          return sum + entry.loenudviklingTotal.value;
        }, 0)
      )
    );
    const labels = Array.from(new Set(perAnsaettelse.map((entry) => entry.loenudviklingLabel)));
    const loenudviklingLabel = labels.length === 1 ? labels[0] : 'Flere reguleringstyper';

    return {
      loenudviklingLabel,
      loenudviklingTotal: asCalculable(totalOre),
      beregningsenhed: tafBeregningsenhed,
      beregnedeSegmenter,
      perAnsaettelse,
    };
  };

  if (values.beregnesUdFra === 'Beregningsperiode') {
    return buildPerAnsaettelseModel();
  }

  const strategiData = resolveReguleringsStrategi(values, stamdataValues, tafBeregningsenhed, { tafRanges });
  const maanedsloenBase = tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER
    ? resolveMaanedsloenBase(values, indkomstSkadestidspunkt)
    : null;
  const dagsloenBase = tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
    ? resolveDagsloenBase(values, indkomstSkadestidspunkt)
    : null;
  const baseLoen = tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? maanedsloenBase : dagsloenBase;
  if (typeof baseLoen !== 'number') {
    throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
  }
  const model = buildFromStrategiAndBase(strategiData, baseLoen);
  return {
    loenudviklingLabel: model.loenudviklingLabel,
    loenudviklingTotal: model.loenudviklingTotal,
    beregningsenhed: tafBeregningsenhed,
    beregnedeSegmenter: model.beregnedeSegmenter,
    perAnsaettelse: [],
  };
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

const resolveAnvendtReguleringsdato = (
  eoValues: ErstatningsopgoerelseValues,
  af: AnvendtReguleringsdatoInput | undefined,
  skadedato: ISODateString | undefined
): ISODateString | undefined => resolveAnvendtReguleringsdatoShared({
  beregnesUdFra: eoValues.beregnesUdFra,
  angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(eoValues),
  saerligFraDatoRegulering: isISODateString(af?.saerligFraDatoRegulering) ? af.saerligFraDatoRegulering : undefined,
  beregningsperiodeTil: eoValues.tafBeregningsperiodeTil,
  skadedato,
});

const resolveMaanedsloenBase = (
  eoValues: ErstatningsopgoerelseValues,
  indkomstSkadestidspunkt: IndkomstSkadestidspunktModel | null
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
  indkomstSkadestidspunkt: IndkomstSkadestidspunktModel | null
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
  const date = isoDateToDate(isoDate);
  const nextDate = addDays(date, 1);
  // invariant: dateToISO returnerer aldrig null på en gyldig dato fra addDays
  return (dateToISO(nextDate) ?? isoDate) as ISODateString;
};
