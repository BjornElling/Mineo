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
import {
  parseOffentligLoenSelection,
  type OffentligLoenSelection,
} from '../erstatningsopgoerelse/helpers/offentligLoenSelection';
import { resolveAslAarsloensmaksimumForAar } from '../satser/aslAarsloensmaksimum';
import { getReguleringsDatoIntervalForStatistikModel } from '../../data/statistiskeRates';
import { formatKRLSatstabelDisplay, getReguleringsDatoIntervalForKRL, isKRLSatstabelId } from '../../data/krlRates';
import { getReguleringsDatoIntervalForKlLoenaftaler, klLoenaftalerRaekker } from '../../data/klLoenaftaler';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { parsePercentToDecimal } from '../../utils/numberParsing';
import { STORE_BEDEDAG_START, STORE_BEDEDAG_PCT as STORE_BEDEDAG_PCT_PCT } from '../../config/indskudteLoentillaeg';
import { isoDateToDate } from '../dates/isoDate';
import { beregnArbejdsdageOgMaaneder } from '../erstatningsopgoerelse/engines/arbejdsdageMaaneder';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../erstatningsopgoerelse/helpers/tafBeregningsenhed';
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
import {
  resolveAnciennitetForIndex,
  type AnciennitetForIndex,
} from '../erstatningsopgoerelse/engines/overenskomstReguleringShared';
import { buildManuelProcentsatsEntries } from '../erstatningsopgoerelse/engines/manuelProcentsatsRegulering';
import { buildStatistikIndexEntries } from '../erstatningsopgoerelse/engines/statistikRegulering';
import { buildKrlIndexEntries } from '../erstatningsopgoerelse/engines/krlRegulering';
import { buildKlLoenaftalerIndexEntries } from '../erstatningsopgoerelse/engines/klLoenaftalerRegulering';
import { findLatestByDateInSortedList } from '../erstatningsopgoerelse/engines/reguleringSeriesLookup';
import { buildShDageSetFromIsoRange, buildFerieDageSetForPeriode } from '../erstatningsopgoerelse/engines/tafDaySets';

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

// Inspektions-/visnings-variant: enhver manglende/ugyldig indplacering giver `null`
// (modsat beregningsmotoren, der kaster). Deler den rene parsing via parseOffentligLoenSelection (U3).
const resolveOffentligLoenSelection = (
  af: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
): OffentligLoenSelection | null => {
  if (!af.overenskomstId) return null;
  const offentligType = getOffentligOverenskomstTypeById(af.overenskomstId);
  if (!offentligType) return null;

  const result = parseOffentligLoenSelection({
    offentligType,
    offentligLoenType: af.offentligLoenType,
    offentligLoenTrin: af.offentligLoenTrin,
    offentligLoenGruppe: af.offentligLoenGruppe,
  });
  return result.ok ? result.selection : null;
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
    const entry = findLatestByDateInSortedList(manualEntries, iso, 'manuelProcentsats:inspektion');
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
    // Samme delte kvartal→ISO-parsing + sortering som motor og præsentation
    // (buildStatistikIndexEntries), så kontrollagets periodeserie ikke kan drive fra den beregnede.
    // Parsing er ikke stedet et motorbug gemmer sig; index-beregningen nedenfor forbliver uafhængig
    // for krydstjekket (B9). Tom liste (manglende model) → referenceValue null → return null.
    for (const entry of buildStatistikIndexEntries(modelId)) {
      valuesByIso.set(entry.startIso, entry.indeksvaerdi);
      if (entry.startIso >= args.referenceIso && entry.startIso <= args.eoTil) dates.add(entry.startIso);
    }
  }

  // Carry-forward-opslag over indeks-/satsværdierne (samme delte primitiv som motor og
  // præsentation, regulering-redesign R3). Map-nøglerne er unikke, så én stigende sortering
  // ved konstruktion er nok til at opslaget kan reverse-scanne.
  const sortedValueEntries = Array.from(valuesByIso.entries())
    .map(([startIso, value]) => ({ startIso, value }))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
  const resolveValueAt = (iso: ISODateString): number | null =>
    findLatestByDateInSortedList(sortedValueEntries, iso, 'statistik:inspektion')?.value ?? null;

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
  // Samme delte periodeserie som motor og præsentation (buildKrlIndexEntries) + det delte
  // carry-forward-primitiv (findLatestByDateInSortedList, R3), så kontrollagets KRL-serie og opslag
  // ikke kan drive fra den beregnede. Index-beregningen nedenfor forbliver uafhængig (B9).
  const valuesByIso = buildKrlIndexEntries(krlId)
    .map((entry) => ({ startIso: entry.startIso, value: 100 + entry.reguleringsPct }));
  if (valuesByIso.length === 0) return null;

  const resolveValueAt = (iso: ISODateString): number | null =>
    findLatestByDateInSortedList(valuesByIso, iso, 'krl:inspektion')?.value ?? null;

  const referenceValue = resolveValueAt(args.referenceIso);
  if (referenceValue === null || !Number.isFinite(referenceValue) || referenceValue <= 0) return null;

  // Intentional parity med statistik-path og PDF-motor:
  // KRL-entries starter ved reference-/reguleringsdatoen, ikke eoFra.
  // Kontrollaget viser dermed basisindekset på reguleringsdatoen, mens tidsenhederne
  // fortsat afgrænses til EO-perioden via getTidsenhedsvaerdier.
  const dates = new Set<ISODateString>([args.referenceIso]);
  for (const entry of valuesByIso) {
    if (entry.startIso >= args.referenceIso && entry.startIso <= args.eoTil) dates.add(entry.startIso);
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

  // Samme delte periodeserie som motor og præsentation (buildKlLoenaftalerIndexEntries) + det delte
  // carry-forward-primitiv (findLatestByDateInSortedList, R3), så kontrollagets KL-serie og opslag
  // ikke kan drive fra den beregnede. Index-beregningen nedenfor forbliver uafhængig (B9).
  const valuesByIso = buildKlLoenaftalerIndexEntries()
    .map((entry) => ({ startIso: entry.startIso, value: entry.reguleringsPct }));
  if (valuesByIso.length === 0) return null;

  const resolveValueAt = (iso: ISODateString): number | null =>
    findLatestByDateInSortedList(valuesByIso, iso, 'klLoenaftaler:inspektion')?.value ?? null;

  const referenceValue = 100;

  // KL-lønaftaler-entries starter ved reference-/reguleringsdatoen, ikke eoFra.
  // Tidsenhederne afgrænses fortsat til EO-perioden via getTidsenhedsvaerdier.
  const dates = new Set<ISODateString>([args.referenceIso]);
  for (const entry of valuesByIso) {
    if (entry.startIso >= args.referenceIso && entry.startIso <= args.eoTil) dates.add(entry.startIso);
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
  // Anciennitetstillæg (kr.) der er aktivt på denne dato. Referenceværdien kalder med 0, fordi
  // tillægget først må ligge efter anvendt reguleringsdato og derfor ikke indgår i indeks 100.
  grundloenSupplement?: number;
}): IndeksEntry | null => {
  if (args.sats.grundloen === null) return null;
  const shSoPct = args.sats.shSoSats ?? 0;
  const fritvalgPct = args.sats.fritvalg ?? 0;
  const pensionPct = args.sats.agPension ?? 0;
  const feriePct = args.feriePct;
  const storeBededagPct = getStoreBededagPct(args.iso, args.loenPaaHelligdage);
  const grundloen = args.sats.grundloen + (args.grundloenSupplement ?? 0);

  const packageValue = computePackageValueDecimal({
    grundloen,
    feriePct,
    shSoPct,
    fritvalgPct,
    storeBededagPct,
    pensionPct,
  });

  const index = args.referenceValue > 0 ? (packageValue / args.referenceValue) * 100 : 0;

  return {
    effectiveFrom: args.iso,
    grundloen,
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

// Anciennitetstillæg for kontrol-indekset — samme delte resolver som motor og bilag. Kontrol-
// lagets timeline spænder EO-perioden (`eoRange`) frem for TAF-ranges.
const resolveInspektionAnciennitet = (args: Readonly<{
  af: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  overenskomstId: string;
  tafBeregningsenhed: TafBeregningsenhed;
  referenceIso: ISODateString;
  eoRange: Readonly<{ fra: ISODateString; til: ISODateString }>;
}>): AnciennitetForIndex | null =>
  resolveAnciennitetForIndex({
    harAnciennitetstillaeg: args.af.harAnciennitetstillaegEfterSkadedatoen,
    anciennitetstillaegDatoIso: isISODateString(args.af.anciennitetstillaegDato) ? args.af.anciennitetstillaegDato : undefined,
    satsValue: args.af.anciennitetstillaegSats?.value,
    satsAngivesPer: args.af.anciennitetstillaegSatsAngivesPer,
    overenskomstId: args.overenskomstId,
    tafBeregningsenhed: args.tafBeregningsenhed,
    anvendtReguleringsdatoIso: args.referenceIso,
    periodeStartIso: args.eoRange.fra,
    periodeEndIso: args.eoRange.til,
  });

const decrementDate = (iso: ISODateString): ISODateString => {
  const date = isoDateToDate(iso);
  date.setUTCDate(date.getUTCDate() - 1);
  return dateToISO(date)!;
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
    const shDageSet = buildShDageSetFromIsoRange(timelineStartIso, eoRange.til);
    const ferieDageSet = buildFerieDageSetForPeriode(input.eoValues, timelineStartIso, eoRange.til);
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
      const anciennitet = resolveInspektionAnciennitet({
        af,
        overenskomstId,
        tafBeregningsenhed,
        referenceIso,
        eoRange,
      });
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
      if (anciennitet) {
        dates.add(anciennitet.activeFromIso);
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

        const entryAnciennitet = anciennitet && iso >= anciennitet.activeFromIso
          ? anciennitet.supplementValue
          : 0;
        const grundloen =
          (offentligSelection.loenType === 'maanedsLoen' ? sats.maanedsLoen : sats.timeLoen) + offentligLoenEkstraGrundloen + entryAnciennitet;
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

      const anciennitet = af.overenskomstId
        ? resolveInspektionAnciennitet({ af, overenskomstId: af.overenskomstId, tafBeregningsenhed, referenceIso, eoRange })
        : null;

      const referenceEntry = buildEntryForDate({
        iso: referenceIso,
        sats: referenceSats,
        feriePct,
        loenPaaHelligdage,
        referenceValue: 1,
        grundloenSupplement: 0,
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
      if (anciennitet) {
        dates.add(anciennitet.activeFromIso);
      }

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

        const entryAnciennitet = anciennitet && iso >= anciennitet.activeFromIso
          ? anciennitet.supplementValue
          : 0;
        const entry = buildEntryForDate({
          iso,
          sats,
          feriePct,
          loenPaaHelligdage,
          referenceValue,
          grundloenSupplement: entryAnciennitet,
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
