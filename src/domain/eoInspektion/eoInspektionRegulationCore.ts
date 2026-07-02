import { minISO, startOfYearIso } from '../../utils/isoDateHelpers';
/**
 * Regulation Core Model - Indeksvisning for reguleringskilder
 */

import type { ISODateString, DanishDateString } from '../../types/branded';
import { isoToDanish, toISODateString, dateToISO, isISODateString } from '../../types/branded';
import type { RowDay } from '../eoRowEvaluation/eoRowTypes';
import type { ErstatningsopgoerelseValues, StamdataValues, LoenPaaHelligdage } from '../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE } from '../../types/loen';
import type { RegulationIndexTimeline, IndeksEntry, AnsaettelsesforholdIndeks } from './eoInspektionRegulationTypes';
import {
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
  getReguleringsDatoIntervalForOverenskomst,
  resolveOverenskomstRef,
  type OverenskomstPeriodeSats,
  getOffentligOverenskomstTypeById,
  getOffentligTillaegsSatserForDato,
  getOffentligTillaegsSatserForPeriode,
} from '../../data/overenskomstRates';
import { getOffentligLoenForDato, getOffentligLoenForPeriode } from '../../data/offentligLoenLookup';
import { resolveOffentligLoenTypeFromLabel, toLoentrin, type Loengruppe } from '../../data/offentligLoenTypes';
import { resolveAslAarsloensmaksimumForAar } from '../satser/aslAarsloensmaksimum';
import { getStatistiskLoenudvikling, getReguleringsDatoIntervalForStatistikModel } from '../../data/statistiskeRates';
import { getKRLSatstabel, formatKRLSatstabelDisplay, getReguleringsDatoIntervalForKRL, isKRLSatstabelId } from '../../data/krlRates';
import { getReguleringsDatoIntervalForKlLoenaftaler, klLoenaftalerRaekker } from '../../data/klLoenaftaler';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { parsePercentToDecimal } from '../../utils/numberParsing';
import { iterateDatesInclusive } from '../../utils/isoDateHelpers';
import { buildSHDageSetForIsoRange } from '../dates/shDageBeregning';
import { STORE_BEDEDAG_START, STORE_BEDEDAG_PCT as STORE_BEDEDAG_PCT_PCT } from '../../config/indskudteLoentillaeg';
import { isoDateToDate } from '../dates/isoDate';
import { beregnArbejdsdageOgMaaneder } from '../erstatningsopgoerelse/engines/arbejdsdageMaaneder';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from '../erstatningsopgoerelse/helpers/tafBeregningsenhed';
import {
  isAslStatistikModel,
  parseDanishToIso,
  resolveStatistikModelId,
  resolveOffentligLoenEkstraGrundloen,
  resolvePctDecimalFromSatsOrInput,
  resolveAnvendtReguleringsdato,
} from '../erstatningsopgoerelse/helpers/eoSharedUtils';
import { getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde } from '../erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { resolveValgtReguleringDisplay } from '../erstatningsopgoerelse/helpers/loenudviklingDisplay';
import { buildManuelProcentsatsEntries } from '../erstatningsopgoerelse/engines/manuelProcentsatsRegulering';

const STORE_BEDEDAG_PCT = STORE_BEDEDAG_PCT_PCT / 100;

export type RegulationCoreInput = {
  readonly inspektionDays: readonly RowDay[];
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

const resolveIntervalStartIso = (
  interval: Readonly<{ fraDato: DanishDateString }>
): ISODateString | undefined => parseDanishToIso(interval.fraDato);

const isReferenceBeforeIntervalStart = (
  referenceIso: ISODateString,
  interval: Readonly<{ fraDato: DanishDateString }> | undefined
): boolean => {
  const intervalStartIso = interval ? resolveIntervalStartIso(interval) : undefined;
  return Boolean(intervalStartIso && referenceIso < intervalStartIso);
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

const getTidsenhedsvaerdier = (
  index: number,
  sortedDates: readonly ISODateString[],
  eoTil: ISODateString,
  shDageSet: ReadonlySet<ISODateString>,
  ferieDageSet: ReadonlySet<ISODateString>
): Readonly<{ arbejdsdage: number | null; maaneder: number | null }> => {
  const periodeFra = sortedDates[index];
  const periodeTil = index < sortedDates.length - 1
    ? decrementDate(sortedDates[index + 1])
    : eoTil;

  if (!periodeTil || periodeFra > periodeTil) {
    return { arbejdsdage: null, maaneder: null };
  }

  const result = beregnArbejdsdageOgMaaneder(
    periodeFra,
    periodeTil,
    new Set(shDageSet),
    new Set(ferieDageSet)
  );
  return {
    arbejdsdage: result.arbejdsdage,
    maaneder: result.maaneder,
  };
};

const resolveManualFeriePctDecimal = (
  rowFeriepenge: string | number | undefined,
  defaultFeriePct: number | undefined
): number => {
  if (typeof rowFeriepenge === 'number' && Number.isFinite(rowFeriepenge)) return rowFeriepenge / 100;
  if (typeof rowFeriepenge === 'string' && rowFeriepenge.trim() !== '') return parsePercentToDecimal(rowFeriepenge);
  return parsePercentToDecimal(defaultFeriePct);
};

const buildManualEntries = (args: Readonly<{
  af: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  eoFra: ISODateString;
  eoTil: ISODateString;
  referenceIso: ISODateString;
  shDageSet: ReadonlySet<ISODateString>;
  ferieDageSet: ReadonlySet<ISODateString>;
}>): Readonly<{ referenceValue: number; entries: readonly IndeksEntry[] }> | null => {
  const rows = args.af.loenudviklingManuelTableData ?? [];
  const baseRow = rows[0];
  const baseGrundloen = amountValueToNumber(baseRow?.grundloen);
  if (typeof baseGrundloen !== 'number' || !Number.isFinite(baseGrundloen) || baseGrundloen <= 0) return null;

  const buildPackageValueDecimal = (iso: ISODateString, grundloen: number, row: typeof baseRow): number => computePackageValueDecimal({
    grundloen,
    feriePct: resolveManualFeriePctDecimal(row?.feriepenge, args.af.feriePct),
    shSoPct: parsePercentToDecimal(row?.shSoSats),
    fritvalgPct: parsePercentToDecimal(row?.fritvalg),
    storeBededagPct: getStoreBededagPct(iso, args.af.loenPaaHelligdage),
    pensionPct: parsePercentToDecimal(row?.agPension),
  });

  const referenceValue = buildPackageValueDecimal(args.referenceIso, baseGrundloen, baseRow);
  if (!Number.isFinite(referenceValue) || referenceValue <= 0) return null;

  const dates = new Set<ISODateString>([args.referenceIso]);
  for (const row of rows.slice(1)) {
    const iso = row.dato;
    if (!iso) continue;
    if (iso >= args.eoFra && iso <= args.eoTil) dates.add(iso);
  }
  if (
    args.af.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG &&
    args.eoFra <= STORE_BEDEDAG_START &&
    args.eoTil >= STORE_BEDEDAG_START
  ) {
    dates.add(STORE_BEDEDAG_START);
  }

  const sortedDates = Array.from(dates).sort((a, b) => a.localeCompare(b));
  const entries = sortedDates.map((iso, index) => {
    const matchingRow = rows
      .slice(1)
      .map((row) => ({ row, iso: row.dato }))
      .filter((entry): entry is Readonly<{ row: typeof baseRow; iso: ISODateString }> => Boolean(entry.iso))
      .filter((entry) => entry.iso <= iso)
      .sort((a, b) => b.iso.localeCompare(a.iso))[0]?.row ?? baseRow;
    const grundloen = amountValueToNumber(matchingRow?.grundloen) ?? 0;
    const packageValue = buildPackageValueDecimal(iso, grundloen, matchingRow);
    const tidsenhed = getTidsenhedsvaerdier(index, sortedDates, args.eoTil, args.shDageSet, args.ferieDageSet);

    return {
      effectiveFrom: iso,
      grundloen,
      feriePct: resolveManualFeriePctDecimal(matchingRow?.feriepenge, args.af.feriePct),
      shSoPct: parsePercentToDecimal(matchingRow?.shSoSats),
      fritvalgPct: parsePercentToDecimal(matchingRow?.fritvalg),
      storeBededagPct: getStoreBededagPct(iso, args.af.loenPaaHelligdage),
      pensionPct: parsePercentToDecimal(matchingRow?.agPension),
      packageValue,
      index: referenceValue > 0 ? (packageValue / referenceValue) * 100 : 0,
      arbejdsdage: tidsenhed.arbejdsdage,
      maaneder: tidsenhed.maaneder,
    } satisfies IndeksEntry;
  });

  return { referenceValue, entries };
};

const buildManualProcentsatsEntries = (args: Readonly<{
  af: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  eoFra: ISODateString;
  eoTil: ISODateString;
  referenceIso: ISODateString;
  shDageSet: ReadonlySet<ISODateString>;
  ferieDageSet: ReadonlySet<ISODateString>;
}>): Readonly<{ referenceValue: number; entries: readonly IndeksEntry[] }> | null => {
  const manualEntries = buildManuelProcentsatsEntries({
    anvendtReguleringsdato: args.referenceIso,
    rows: args.af.loenudviklingManuelProcentsatsTableData ?? [],
  });
  if (manualEntries.length === 0) return null;

  const dates = new Set<ISODateString>([args.referenceIso]);
  for (const entry of manualEntries) {
    if (entry.startIso >= args.eoFra && entry.startIso <= args.eoTil) dates.add(entry.startIso);
  }

  const sortedDates = Array.from(dates).sort((a, b) => a.localeCompare(b));
  const entries = sortedDates.flatMap((iso, index) => {
    const entry = manualEntries
      .filter((candidate) => candidate.startIso <= iso)
      .sort((a, b) => b.startIso.localeCompare(a.startIso))[0];
    if (!entry) return [];
    const tidsenhed = getTidsenhedsvaerdier(index, sortedDates, args.eoTil, args.shDageSet, args.ferieDageSet);
    return [{
      effectiveFrom: iso,
      grundloen: entry.indeks,
      feriePct: 0,
      shSoPct: 0,
      fritvalgPct: 0,
      storeBededagPct: 0,
      pensionPct: 0,
      packageValue: entry.indeks,
      index: entry.indeks,
      arbejdsdage: tidsenhed.arbejdsdage,
      maaneder: tidsenhed.maaneder,
    } satisfies IndeksEntry];
  });

  return { referenceValue: 100, entries };
};

const buildStatistikEntries = (args: Readonly<{
  af: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  eoFra: ISODateString;
  eoTil: ISODateString;
  referenceIso: ISODateString;
  shDageSet: ReadonlySet<ISODateString>;
  ferieDageSet: ReadonlySet<ISODateString>;
}>): Readonly<{ referenceValue: number; entries: readonly IndeksEntry[] }> | null => {
  const modelLabel = (args.af.loenudviklingStatistikModel ?? '').trim();
  if (modelLabel === '') return null;

  // Intentional: kontrollaget viser basis-/reguleringsdatoen som første entry,
  // også når den ligger før EO-periodens første data-start.
  // Arbejdsdage og måneder afgrænses stadig til EO-perioden via getTidsenhedsvaerdier.
  const dates = new Set<ISODateString>([args.referenceIso]);
  const valuesByIso = new Map<ISODateString, number>();

  if (isAslStatistikModel(modelLabel)) {
    const startYear = Number(args.referenceIso.slice(0, 4));
    const endYear = Number(args.eoTil.slice(0, 4));
    for (let year = startYear; year <= endYear; year += 1) {
      const value = resolveAslAarsloensmaksimumForAar(year);
      if (value === undefined) return null;
      const iso = startOfYearIso(year);
      if (iso >= args.referenceIso && iso <= args.eoTil) dates.add(iso);
      valuesByIso.set(iso, value);
    }
  } else {
    const modelId = resolveStatistikModelId(modelLabel);
    if (!modelId) return null;
    const model = getStatistiskLoenudvikling(modelId);
    if (!model) return null;
    for (const value of model.indeksvaerdier) {
      const match = value.kvartal.match(/^(\d{4})K([1-4])$/);
      if (!match) continue;
      const year = Number(match[1]);
      const quarter = Number(match[2]);
      const month = (quarter - 1) * 3 + 1;
      const iso = parseOptionalIso(`${year}-${String(month).padStart(2, '0')}-01`);
      if (!iso) continue;
      valuesByIso.set(iso, value.indeksvaerdi);
      if (iso >= args.referenceIso && iso <= args.eoTil) dates.add(iso);
    }
  }

  const resolveValueAt = (iso: ISODateString): number | null => {
    const candidates = Array.from(valuesByIso.entries())
      .filter(([startIso]) => startIso <= iso)
      .sort((a, b) => b[0].localeCompare(a[0]));
    return candidates[0]?.[1] ?? null;
  };

  const referenceValue = resolveValueAt(args.referenceIso);
  if (referenceValue === null || !Number.isFinite(referenceValue) || referenceValue <= 0) return null;

  const sortedDates = Array.from(dates).sort((a, b) => a.localeCompare(b));
  const entries = sortedDates.map((iso, index) => {
    const value = resolveValueAt(iso) ?? referenceValue;
    const tidsenhed = getTidsenhedsvaerdier(index, sortedDates, args.eoTil, args.shDageSet, args.ferieDageSet);
    return {
      effectiveFrom: iso,
      grundloen: value,
      feriePct: 0,
      shSoPct: 0,
      fritvalgPct: 0,
      storeBededagPct: 0,
      pensionPct: 0,
      packageValue: value,
      index: (value / referenceValue) * 100,
      arbejdsdage: tidsenhed.arbejdsdage,
      maaneder: tidsenhed.maaneder,
    } satisfies IndeksEntry;
  });

  return { referenceValue, entries };
};

const buildKrlEntries = (args: Readonly<{
  af: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  eoFra: ISODateString;
  eoTil: ISODateString;
  referenceIso: ISODateString;
  shDageSet: ReadonlySet<ISODateString>;
  ferieDageSet: ReadonlySet<ISODateString>;
}>): Readonly<{ referenceValue: number; entries: readonly IndeksEntry[] }> | null => {
  const krlId = args.af.loenudviklingKRLSatstabel;
  if (!krlId || !isKRLSatstabelId(krlId)) return null;
  const tabel = getKRLSatstabel(krlId);
  if (!tabel || tabel.vaerdier.length === 0) return null;

  const valuesByIso = tabel.vaerdier
    .map((entry) => {
      const iso = parseDanishToIso(entry.fraDato);
      if (!iso) return null;
      return { iso, value: 100 + entry.reguleringsPct };
    })
    .filter((entry): entry is Readonly<{ iso: ISODateString; value: number }> => Boolean(entry))
    .sort((a, b) => a.iso.localeCompare(b.iso));
  if (valuesByIso.length === 0) return null;

  const resolveValueAt = (iso: ISODateString): number | null => {
    const candidate = valuesByIso.filter((entry) => entry.iso <= iso).sort((a, b) => b.iso.localeCompare(a.iso))[0];
    return candidate?.value ?? null;
  };

  const referenceValue = resolveValueAt(args.referenceIso);
  if (referenceValue === null || !Number.isFinite(referenceValue) || referenceValue <= 0) return null;

  // Intentional parity med statistik-path og PDF-motor:
  // KRL-entries starter ved reference-/reguleringsdatoen, ikke eoFra.
  // Kontrollaget viser dermed basisindekset på reguleringsdatoen, mens tidsenhederne
  // fortsat afgrænses til EO-perioden via getTidsenhedsvaerdier.
  const dates = new Set<ISODateString>([args.referenceIso]);
  for (const entry of valuesByIso) {
    if (entry.iso >= args.referenceIso && entry.iso <= args.eoTil) dates.add(entry.iso);
  }
  const sortedDates = Array.from(dates).sort((a, b) => a.localeCompare(b));
  const entries = sortedDates.map((iso, index) => {
    const value = resolveValueAt(iso) ?? referenceValue;
    const tidsenhed = getTidsenhedsvaerdier(index, sortedDates, args.eoTil, args.shDageSet, args.ferieDageSet);
    return {
      effectiveFrom: iso,
      grundloen: value,
      feriePct: 0,
      shSoPct: 0,
      fritvalgPct: 0,
      // Bevidst parity med eoPdfLoenudvikling: Statistik/KRL modellerer kun indeksserien.
      // Store Bededag indgår ikke som særskilt breakpoint i disse strategier.
      storeBededagPct: 0,
      pensionPct: 0,
      packageValue: value,
      index: (value / referenceValue) * 100,
      arbejdsdage: tidsenhed.arbejdsdage,
      maaneder: tidsenhed.maaneder,
    } satisfies IndeksEntry;
  });

  return { referenceValue, entries };
};

const buildKlLoenaftalerEntries = (args: Readonly<{
  af: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  eoFra: ISODateString;
  eoTil: ISODateString;
  referenceIso: ISODateString;
  shDageSet: ReadonlySet<ISODateString>;
  ferieDageSet: ReadonlySet<ISODateString>;
}>): Readonly<{ referenceValue: number; entries: readonly IndeksEntry[] }> | null => {
  if (klLoenaftalerRaekker.length === 0) return null;

  const valuesByIso = klLoenaftalerRaekker
    .map((entry) => {
      const iso = parseDanishToIso(entry.fraDato);
      if (!iso) return null;
      return { iso, value: entry.reguleringPct };
    })
    .filter((entry): entry is Readonly<{ iso: ISODateString; value: number }> => Boolean(entry))
    .sort((a, b) => a.iso.localeCompare(b.iso));
  if (valuesByIso.length === 0) return null;

  const resolveValueAt = (iso: ISODateString): number | null => {
    const candidate = valuesByIso.filter((entry) => entry.iso <= iso).sort((a, b) => b.iso.localeCompare(a.iso))[0];
    return candidate?.value ?? null;
  };

  const referenceValue = 100;

  // KL-lønaftaler-entries starter ved reference-/reguleringsdatoen, ikke eoFra.
  // Tidsenhederne afgrænses fortsat til EO-perioden via getTidsenhedsvaerdier.
  const dates = new Set<ISODateString>([args.referenceIso]);
  for (const entry of valuesByIso) {
    if (entry.iso >= args.referenceIso && entry.iso <= args.eoTil) dates.add(entry.iso);
  }
  const sortedDates = Array.from(dates).sort((a, b) => a.localeCompare(b));
  const entries = sortedDates.map((iso, index) => {
    const value = resolveValueAt(iso) ?? 0;
    const tidsenhed = getTidsenhedsvaerdier(index, sortedDates, args.eoTil, args.shDageSet, args.ferieDageSet);
    return {
      effectiveFrom: iso,
      grundloen: value,
      feriePct: 0,
      shSoPct: 0,
      fritvalgPct: 0,
      // KL-lønaftaler-kontrol bruger kun periodesatsen til "Reguleringsværdier". Den beregnede
      // reguleringstabel kommer fra canonical KL-lønaftaler-segmenter, så kontrollaget må ikke genindføre
      // en akkumuleret indeksmodel her.
      storeBededagPct: 0,
      pensionPct: 0,
      packageValue: value,
      index: referenceValue,
      arbejdsdage: tidsenhed.arbejdsdage,
      maaneder: tidsenhed.maaneder,
    } satisfies IndeksEntry;
  });

  return { referenceValue, entries };
};

/**
 * Beregner samlet lønpakkeværdi for reguleringsindeks i kontrol-kernen.
 *
 * Procent-konvention i denne funktion:
 * - Alle procentsatser angives som decimaler (fx `0.173` for 17,3 %).
 * - Funktionen anvender derfor procentsatserne direkte uden division med 100.
 */
const computePackageValueDecimal = (args: {
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
  const feriePct = args.feriePct;
  const storeBededagPct = getStoreBededagPct(args.iso, args.loenPaaHelligdage);

  const packageValue = computePackageValueDecimal({
    grundloen: args.sats.grundloen,
    feriePct,
    shSoPct,
    fritvalgPct,
    storeBededagPct,
    pensionPct,
  });

  const index = args.referenceValue > 0 ? (packageValue / args.referenceValue) * 100 : 0;

  return {
    effectiveFrom: args.iso,
    grundloen: args.sats.grundloen,
    feriePct,
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
  return new Set(buildSHDageSetForIsoRange(fra, til));
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
  shDage: ReadonlySet<ISODateString>,
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

    const constrainedFra = ferieFraRaw > periodeFra ? ferieFraRaw : periodeFra;
    const constrainedTil = ferieTilRaw < periodeTil ? ferieTilRaw : periodeTil;
    if (constrainedFra > constrainedTil) continue;

    iterateDatesInclusive(isoDateToDate(constrainedFra), isoDateToDate(constrainedTil), (current) => {
      const iso = dateToISO(current);
      if (iso) {
        const dow = current.getUTCDay();
        if (dow >= 1 && dow <= 5 && !shDage.has(iso)) {
          allFerie.add(iso);
        }
      }
    });
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
    const constrainedFra = tafFraRaw > periodeFra ? tafFraRaw : periodeFra;
    const constrainedTil = tafTilRaw < periodeTil ? tafTilRaw : periodeTil;
    if (constrainedFra > constrainedTil) continue;

    iterateDatesInclusive(isoDateToDate(constrainedFra), isoDateToDate(constrainedTil), (current) => {
      const iso = dateToISO(current);
      if (iso) {
        const dow = current.getUTCDay();
        if (dow >= 1 && dow <= 5 && !shDage.has(iso) && !allFerie.has(iso)) {
          allFerie.add(iso);
          remaining--;
        }
      }
      return remaining > 0 ? undefined : false;
    });
  }

  return allFerie;
};

 

export function buildRegulationTimeline(input: RegulationCoreInput): RegulationIndexTimeline {
  const eoRange = getEoRange(input.eoValues);
  const tafBeregningsenhed = computeTafBeregningsenhed(input.eoValues);
  if (!eoRange) return { tafBeregningsenhed, ansaettelser: [] };

  const skadedatoIso = parseOptionalIso(input.stamdataValues.skadedato);
  if (!skadedatoIso) return { tafBeregningsenhed, ansaettelser: [] };
  const angivetLoenOpreguleresFraDato = getAngivetLoenOpreguleresFraDato(input.eoValues);

  const ansaettelser: AnsaettelsesforholdIndeks[] = [];
  const pushPlaceholderAnsaettelse = (params: Readonly<{
    af: Pick<AnsaettelsesforholdIndeks, 'ansaettelsesforholdId' | 'navn' | 'kildeLabel' | 'kildeVaerdi' | 'referenceIso' | 'referenceLabel'> & {
      overenskomstId?: string;
    };
  }>) => {
    ansaettelser.push({
      ...params.af,
      referenceValue: 0,
      entries: [],
    });
  };

  for (const af of resolveLoenudviklingKilde(input.eoValues)) {
    const feriePct = parsePercentToDecimal(af.feriePct);
    const loenPaaHelligdage = af.loenPaaHelligdage;
    const grundlag = af.loenudviklingBeregningsgrundlag;
    if (!grundlag || grundlag === 'Ingen') continue;
    const saerligFraDatoRegulering = parseOptionalIso(af.saerligFraDatoRegulering);
    const referenceIso = resolveAnvendtReguleringsdato({
      beregnesUdFra: input.eoValues.beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato: angivetLoenOpreguleresFraDato,
      saerligFraDatoRegulering,
      beregningsperiodeTil: input.eoValues.tafBeregningsperiodeTil,
      skadedato: skadedatoIso,
    });
    if (!referenceIso) continue;
    // Ved Beregningsperiode kan hvert ansættelsesforhold have egen særlig fra-dato.
    // Ved Angivet månedsløn/dagsløn er resolveLoenudviklingKilde ét syntetisk EO-element,
    // så den fælles angivetLoenOpreguleresFraDato gælder for hele løkken.
    const referenceLabel =
      referenceIso === skadedatoIso
        ? (input.stamdataValues.skadestype === 'Erhvervssygdom' ? 'Anmeldelsesdato' : 'Skadedato') // 'Skadedato' uden s, jf. kanonisk betegnelse
        : (
            input.eoValues.beregnesUdFra === 'Beregningsperiode'
            && !saerligFraDatoRegulering
            && input.eoValues.tafBeregningsperiodeTil
            && referenceIso === input.eoValues.tafBeregningsperiodeTil
          )
          ? 'Beregningsperiode slutdato'
          : undefined;
    const kildeLabel =
      grundlag === 'Overenskomst'
        ? 'Overenskomst'
        : grundlag === 'Statistik'
          ? 'Statistikmodel'
          : grundlag === 'KRL satstabel'
            ? 'KRL satstabel'
            : grundlag === 'KL-lønaftaler'
              ? 'KL-lønaftaler'
              : 'Navn på reguleringsform';
    const kildeVaerdi =
      grundlag === 'KRL satstabel'
        ? formatKRLSatstabelDisplay(af.loenudviklingKRLSatstabel ?? '')
        : resolveValgtReguleringDisplay(af);

    const referenceDanish = toDanishOrUndefined(referenceIso);
    if (!referenceDanish) continue;
    const timelineStartIso = minISO(referenceIso, eoRange.fra);
    const shDageSet = buildSHDageSet(timelineStartIso, eoRange.til);
    const ferieDageSet = buildFerieDageSet(input.eoValues, shDageSet, timelineStartIso, eoRange.til);
    const offentligSelection = grundlag === 'Overenskomst' ? resolveOffentligLoenSelection(af) : null;
    if (grundlag === 'Overenskomst' && offentligSelection) {
      const overenskomstId = af.overenskomstId;
      if (!overenskomstId) continue;
      const overenskomstInterval = getReguleringsDatoIntervalForOverenskomst(overenskomstId);
      const applyAlmindeligLoenPaaShDageRegel = loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG;
      const offentligLoenEkstraGrundloen = resolveOffentligLoenEkstraGrundloen(
        amountValueToNumber(af.offentligLoenEkstraGrundloen),
        tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? 'Måned' : 'Time',
        offentligSelection.loenType === 'maanedsLoen' ? 'Måned' : 'Time'
      );
      const referenceTillaegsSatser = getOffentligTillaegsSatserForDato(
        overenskomstId,
        referenceDanish,
        applyAlmindeligLoenPaaShDageRegel
      );
      const referenceResult = getOffentligLoenForDato(
        offentligSelection.overenskomstType,
        referenceDanish,
        offentligSelection.loentrin,
        offentligSelection.loengruppe
      );
      if (!referenceResult) {
        if (isReferenceBeforeIntervalStart(referenceIso, overenskomstInterval)) {
          pushPlaceholderAnsaettelse({
            af: {
              ansaettelsesforholdId: af.id,
              navn: af.navnPaaArbejdssted,
              kildeLabel,
              kildeVaerdi,
              overenskomstId: af.overenskomstId,
              referenceIso,
              referenceLabel,
            },
          });
        }
        continue;
      }
      const referenceBase =
        offentligSelection.loenType === 'maanedsLoen'
          ? referenceResult.maanedsLoen
          : referenceResult.timeLoen;
      const referenceValue = computePackageValueDecimal({
        grundloen: referenceBase + offentligLoenEkstraGrundloen,
        feriePct,
        shSoPct: resolvePctDecimalFromSatsOrInput(referenceTillaegsSatser?.shSoSats, af.shSoPct),
        fritvalgPct: resolvePctDecimalFromSatsOrInput(referenceTillaegsSatser?.fritvalg, af.fritvalgPct),
        storeBededagPct: getStoreBededagPct(referenceIso, loenPaaHelligdage),
        pensionPct: resolvePctDecimalFromSatsOrInput(referenceTillaegsSatser?.agPension, af.pensionPct),
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
      const tillaegsSatser = getOffentligTillaegsSatserForPeriode(
        overenskomstId,
        eoFraDanish,
        eoTilDanish,
        applyAlmindeligLoenPaaShDageRegel
      );

      const dates = new Set<ISODateString>();
      for (const sats of satser) {
        const iso = parseDanishToIso(sats.effectiveDate);
        if (!iso) continue;
        if (iso >= eoRange.fra && iso <= eoRange.til) {
          dates.add(iso);
        }
      }
      for (const sats of tillaegsSatser) {
        const iso = parseDanishToIso(sats.fraDato);
        if (!iso) continue;
        if (iso >= eoRange.fra && iso <= eoRange.til) {
          dates.add(iso);
        }
      }
      if (
        applyAlmindeligLoenPaaShDageRegel &&
        timelineStartIso < STORE_BEDEDAG_START &&
        eoRange.til >= STORE_BEDEDAG_START
      ) {
        dates.add(STORE_BEDEDAG_START);
      }
      dates.add(referenceIso);

      const sortedDates = Array.from(dates).sort((a, b) => a.localeCompare(b));

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
        const tillaegSats = getOffentligTillaegsSatserForDato(
          overenskomstId,
          danishDate,
          applyAlmindeligLoenPaaShDageRegel
        );

        const grundloen =
          (offentligSelection.loenType === 'maanedsLoen' ? sats.maanedsLoen : sats.timeLoen) + offentligLoenEkstraGrundloen;
        const packageValue = computePackageValueDecimal({
          grundloen,
          feriePct,
          shSoPct: resolvePctDecimalFromSatsOrInput(tillaegSats?.shSoSats, af.shSoPct),
          fritvalgPct: resolvePctDecimalFromSatsOrInput(tillaegSats?.fritvalg, af.fritvalgPct),
          storeBededagPct: getStoreBededagPct(iso, loenPaaHelligdage),
          pensionPct: resolvePctDecimalFromSatsOrInput(tillaegSats?.agPension, af.pensionPct),
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
          shSoPct: resolvePctDecimalFromSatsOrInput(tillaegSats?.shSoSats, af.shSoPct),
          fritvalgPct: resolvePctDecimalFromSatsOrInput(tillaegSats?.fritvalg, af.fritvalgPct),
          storeBededagPct: getStoreBededagPct(iso, loenPaaHelligdage),
          pensionPct: resolvePctDecimalFromSatsOrInput(tillaegSats?.agPension, af.pensionPct),
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
        kildeLabel,
        kildeVaerdi,
        overenskomstId: af.overenskomstId,
        referenceIso,
        referenceLabel,
        referenceValue,
        entries,
      });
      continue;
    }

    if (grundlag === 'Overenskomst') {
      const ref = af.overenskomstId ? resolveOverenskomstRef(af.overenskomstId) : null;
      if (!ref) continue;
      const overenskomstInterval = af.overenskomstId
        ? getReguleringsDatoIntervalForOverenskomst(af.overenskomstId)
        : undefined;

      const referenceSats = getEffektiveSatserForDato({
        overenskomstId: ref.baseId,
        dato: referenceDanish,
        applyAlmindeligLoenPaaShDageRegel: loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG,
      });
      if (!referenceSats || referenceSats.grundloen === null) {
        if (isReferenceBeforeIntervalStart(referenceIso, overenskomstInterval)) {
          pushPlaceholderAnsaettelse({
            af: {
              ansaettelsesforholdId: af.id,
              navn: af.navnPaaArbejdssted,
              kildeLabel,
              kildeVaerdi,
              overenskomstId: af.overenskomstId,
              referenceIso,
              referenceLabel,
            },
          });
        }
        continue;
      }

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
        // Brug den guardede danske→ISO-parser (som de øvrige fraDato-konverteringer her),
        // så en malformet sats-dato giver et spring frem for at kaste i kontrol-pipelinen.
        const iso = parseDanishToIso(sats.fraDato);
        if (iso && iso >= eoRange.fra && iso <= eoRange.til) {
          dates.add(iso);
        }
      }
      dates.add(referenceIso);

      if (eoRange.fra <= STORE_BEDEDAG_START && eoRange.til >= STORE_BEDEDAG_START) {
        if (loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG) {
          dates.add(STORE_BEDEDAG_START as ISODateString);
        }
      }

      const sortedDates = Array.from(dates).sort((a, b) => a.localeCompare(b));
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
        const tidsenhed = getTidsenhedsvaerdier(i, sortedDates, eoRange.til, shDageSet, ferieDageSet);

        entries.push({
          ...entry,
          arbejdsdage: tidsenhed.arbejdsdage,
          maaneder: tidsenhed.maaneder
        });
      }

      if (entries.length === 0) continue;

      ansaettelser.push({
        ansaettelsesforholdId: af.id,
        navn: af.navnPaaArbejdssted,
        kildeLabel,
        kildeVaerdi,
        overenskomstId: af.overenskomstId,
        referenceIso,
        referenceLabel,
        referenceValue,
        entries,
      });
      continue;
    }

    const built =
      grundlag === 'Manuelt angivet'
        ? buildManualEntries({ af, eoFra: eoRange.fra, eoTil: eoRange.til, referenceIso, shDageSet, ferieDageSet })
        : grundlag === 'Manuel procentsats'
          ? buildManualProcentsatsEntries({ af, eoFra: eoRange.fra, eoTil: eoRange.til, referenceIso, shDageSet, ferieDageSet })
          : grundlag === 'Statistik'
            ? buildStatistikEntries({ af, eoFra: eoRange.fra, eoTil: eoRange.til, referenceIso, shDageSet, ferieDageSet })
            : grundlag === 'KRL satstabel'
              ? buildKrlEntries({ af, eoFra: eoRange.fra, eoTil: eoRange.til, referenceIso, shDageSet, ferieDageSet })
              : grundlag === 'KL-lønaftaler'
                ? buildKlLoenaftalerEntries({ af, eoFra: eoRange.fra, eoTil: eoRange.til, referenceIso, shDageSet, ferieDageSet })
                : null;
    if (!built || built.entries.length === 0) {
      const shouldKeepPlaceholder =
        (grundlag === 'Statistik'
          && isReferenceBeforeIntervalStart(referenceIso, getReguleringsDatoIntervalForStatistikModel(af.loenudviklingStatistikModel ?? '')))
        || (grundlag === 'KRL satstabel'
          && af.loenudviklingKRLSatstabel
          && isKRLSatstabelId(af.loenudviklingKRLSatstabel)
          && isReferenceBeforeIntervalStart(referenceIso, getReguleringsDatoIntervalForKRL(af.loenudviklingKRLSatstabel)))
        || (grundlag === 'KL-lønaftaler'
          && isReferenceBeforeIntervalStart(referenceIso, getReguleringsDatoIntervalForKlLoenaftaler()));

      if (shouldKeepPlaceholder) {
        pushPlaceholderAnsaettelse({
          af: {
            ansaettelsesforholdId: af.id,
            navn: af.navnPaaArbejdssted,
            kildeLabel,
            kildeVaerdi,
            referenceIso,
            referenceLabel,
          },
        });
      }
      continue;
    }

    ansaettelser.push({
      ansaettelsesforholdId: af.id,
      navn: af.navnPaaArbejdssted,
      kildeLabel,
      kildeVaerdi,
      referenceIso,
      referenceLabel,
      referenceValue: built.referenceValue,
      entries: built.entries,
    });
  }

  return { tafBeregningsenhed, ansaettelser };
}
