import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import type { StandardLoenTableRow, Loenperiode } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { dateToISO, isoToDanish } from '../../types/branded';
import { formatCurrency } from '../../utils/formatUtils';
import { calculateStandardLoenProjectedAmounts, isStandardLoenRowEffectivelyEmpty } from '../aarsloen/standardLoenRowCalculations';
import {
  resolveOverenskomstRef,
  getEffektiveSatserForPeriode,
  getOffentligOverenskomstTypeById,
  getOffentligTillaegsSatserForPeriode,
} from '../../data/overenskomstRates';
import { getReguleringsDatoer } from '../../data/offentligLoenLookup';
import { parseOffentligDato } from './eoInspektionOffentligeYdelserColumns';
import type { KontrolTabelColumnId } from './eoInspektionKontrolModel';
import { kontrolTabelColumnId, WAGE_COLUMNS } from './eoInspektionLoenTypes';
import type { resolveTafCutoffDates } from '../erstatningsopgoerelse/validation/tafPeriodConstraints';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from '../erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { parseAarsloenRowInterval } from '../erstatningsopgoerelse/helpers/indtaegtPerioder';
import { buildFallbackAllocationDaysForInterval } from '../erstatningsopgoerelse/engines/periodiseringsMotor';
import { buildLoenindkomstRateSegments } from '../erstatningsopgoerelse/helpers/loenindkomstSatser';
import { type DateInterval, iterateDatesInclusive, validateIsoRange } from '../../utils/isoDateHelpers';

// LOCKED: Løn/TAF kontrol-clusteret er færdig‑porteret.
// Ændr kun ved parity‑brud og dokumentér årsag.
export type KontrolTabelColumnData = Readonly<{
  id: KontrolTabelColumnId;
  header: string;
  name?: string;
  align: 'left' | 'center' | 'right';
  width: number;
  borderLeft?: boolean;
  values: readonly string[];
  rawValues?: readonly number[];
}>;

type WageSatsInput = Readonly<{
  feriePct: number | undefined;
  fritvalgPct: number | undefined;
  shSoPct: number | undefined;
  storeBededagPct: number | undefined;
  pensionPct: number | undefined;
}>;

const buildAllocationDates = (
  interval: DateInterval,
  isoIndex: ReadonlyMap<ISODateString, number>,
  isPeriodiseringsdag: (index: number) => boolean
): readonly ISODateString[] => {
  const allocationDates: ISODateString[] = [];
  iterateDatesInclusive(interval.start, interval.end, (date) => {
    const iso = dateToISO(date);
    if (!iso) return;
    const idx = isoIndex.get(iso);
    if (idx === undefined) return;
    if (!isPeriodiseringsdag(idx)) return;
    allocationDates.push(iso);
  });
  if (allocationDates.length === 0) {
    // Fald-tilbage (jf. periodisering-contract.md §3A): en lønperiode uden periodiseringsdage
    // (fx hel ferie) fordeles på fald-tilbage-dage, så beløbet fanges i kontroltabellen PRÆCIS
    // som i beregningen (buildIncomeForRanges bruger samme motor-helper). Dag-kolonnerne
    // (arbejdsdag/TAF-dag) markerer dem stadig som ikke-arbejdsdage – kun beløbet fordeles her.
    const fraISO = dateToISO(interval.start);
    const tilISO = dateToISO(interval.end);
    if (fraISO && tilISO) {
      for (const iso of buildFallbackAllocationDaysForInterval({ fra: fraISO, til: tilISO })) {
        if (isoIndex.has(iso)) allocationDates.push(iso);
      }
      allocationDates.sort();
    }
  }
  return allocationDates;
};

export type TafAfskaeringKilde = 'differencekrav' | 'endeligEet' | 'midlertidigEet';

/** Markøren i TAF-dagskolonnen på den dag, TAF ophører, og kildens navn i oversigten. */
export const TAF_AFSKAERING_MARKOER: Readonly<Record<TafAfskaeringKilde, string>> = {
  endeligEet: 'Endeligt EET',
  midlertidigEet: 'Midlertidigt EET',
  differencekrav: 'Differencekrav',
};

/**
 * Den dag, TAF ophører fra og med: den tidligste af de AKTIVE afskæringer. Afskæringerne kommer fra
 * `resolveTafCutoffDates` – samme opslag som motorens clamping og valideringens feltfejl – så tabellen anvender
 * præcis samme regel: differencekravets dato, det endelige EET's dato og, kun for skader før 16-06-2011, det
 * midlertidige EET's dato; ingen af EET-datoerne under en verserende klage.
 */
export const resolveTafAfskaering = (
  cutoffs: ReturnType<typeof resolveTafCutoffDates>
): Readonly<{ dato: ISODateString; kilde: TafAfskaeringKilde }> | undefined => {
  // Rækkefølgen afgør markøren, når to afskæringer falder på samme dag.
  const kandidater: ReadonlyArray<Readonly<{ dato: ISODateString | undefined; kilde: TafAfskaeringKilde }>> = [
    { dato: cutoffs.endeligEETDato, kilde: 'endeligEet' },
    { dato: cutoffs.midlertidigEETDato, kilde: 'midlertidigEet' },
    { dato: cutoffs.differencekravDato, kilde: 'differencekrav' },
  ];
  let tidligste: Readonly<{ dato: ISODateString; kilde: TafAfskaeringKilde }> | undefined;
  for (const kandidat of kandidater) {
    if (kandidat.dato === undefined) continue;
    if (tidligste === undefined || kandidat.dato < tidligste.dato) tidligste = { dato: kandidat.dato, kilde: kandidat.kilde };
  }
  return tidligste;
};

/**
 * TAF-dagskolonnen: «Ja» for en TAF-dag, `-` for en dag i scope uden TAF, tom uden for scope, og kildens
 * markør (fx «Midlertidigt EET») på den dag, TAF ophører.
 *
 * Kontroltabellen er en selvstændig kontrol af beregningen og anvender derfor selv afskæringerne – også
 * selvom `tafDates` fra motoren allerede er afgrænset. Skulle en TAF-dag nogensinde slippe igennem motoren efter
 * en afskæring, tæller tabellen den ikke, og sammentællingen melder uoverensstemmelsen. Før kendte tabellen kun
 * det endelige EET og differencekravet, ikke den midlertidige EET-afskæring for skader før 16-06-2011.
 */
export const buildTafDayStatusValues = (args: Readonly<{
  dates: readonly ISODateString[];
  erstatningsFra: ISODateString | undefined;
  erstatningsTil: ISODateString | undefined;
  cutoffs: ReturnType<typeof resolveTafCutoffDates>;
  tafDates: ReadonlySet<ISODateString>;
  isWorkdayByIndex: readonly boolean[];
  isWithinBeregningsByIndex: readonly boolean[];
}>): readonly string[] => {
  const {
    dates,
    erstatningsFra,
    erstatningsTil,
    cutoffs,
    tafDates,
    isWorkdayByIndex,
    isWithinBeregningsByIndex,
  } = args;

  const afskaering = resolveTafAfskaering(cutoffs);
  const erstatningsRange = validateIsoRange(erstatningsFra, erstatningsTil);
  const hasErstatningsRange = erstatningsRange != null;
  const isWithinErstatningsByIndex: ReadonlyArray<boolean> = dates.map((iso) =>
    erstatningsRange ? iso >= erstatningsRange.fra && iso <= erstatningsRange.til : false
  );

  const tafStatus = new Uint8Array(dates.length);
  for (let i = 0; i < dates.length; i += 1) {
    const iso = dates[i];
    // EO-perioden (vedroererPeriode) er en *valgfri* stille clamp (jf. eo-snapshot-contract.md §2.1):
    // når den ikke er angivet, afgrænses TAF-dage alene af de autoritative `tafDates` – præcis
    // som beregnings-engine'n (computeTafArbejdsdageAggregation/buildTafRanges) gør. Uden dette
    // fald-tilbage ville tabellen vise 0 TAF-dage mens snapshot beregner et reelt TAF-tal, hvilket
    // udløser en falsk control:sammentaelling_mismatch. `tafDates` er allerede clampet mod EO-perioden, når
    // den findes, så fald-tilbaget ændrer intet i det tilfælde.
    const within = hasErstatningsRange ? isWithinErstatningsByIndex[i] : true;

    if (!within) {
      tafStatus[i] = 0;
      continue;
    }
    // Afskæringsdagen selv er ikke en TAF-dag (motorens grænse er dagen før).
    if (afskaering && iso === afskaering.dato) {
      tafStatus[i] = 2;
      continue;
    }
    if (afskaering && iso > afskaering.dato) {
      tafStatus[i] = 0;
      continue;
    }
    if (!tafDates.has(iso)) {
      tafStatus[i] = 0;
      continue;
    }

    tafStatus[i] = isWorkdayByIndex[i] ? 1 : 0;
  }

  return dates.map((iso, rowIndex) => {
    const code = tafStatus[rowIndex];
    // En dag i TAF-perioden (tafDates), en TAF-dag/afskæringsmarkør (code !== 0) eller en dag
    // i beregningsperioden er altid i scope og skal vises – også når der ikke er angivet en
    // erstatningsperiode. Når EO-perioden findes, gælder `tafDates ⊆ erstatningsRange`, så de
    // ekstra led medfører `isWithinErstatningsByIndex` og ændrer derfor intet i det tilfælde.
    const isVisibleScope =
      isWithinErstatningsByIndex[rowIndex] ||
      isWithinBeregningsByIndex[rowIndex] ||
      code !== 0 ||
      tafDates.has(iso);
    if (!isVisibleScope) return '';
    if (code === 2 && afskaering) return TAF_AFSKAERING_MARKOER[afskaering.kilde];
    if (code === 1) return 'Ja';
    return isWithinErstatningsByIndex[rowIndex] || tafDates.has(iso) ? '-' : '';
  });
};

const getWageAmountsForRow = (
  af: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number],
  row: StandardLoenTableRow,
  satser: WageSatsInput,
  loenperiode: Loenperiode,
  allocationDates: readonly ISODateString[],
  selectedDates?: readonly ISODateString[]
): Readonly<Record<(typeof WAGE_COLUMNS)[number]['key'], number>> => {
  const interval = parseAarsloenRowInterval(row, loenperiode);
  const fra = interval ? dateToISO(interval.start) : undefined;
  const til = interval ? dateToISO(interval.end) : undefined;
  const projected = calculateStandardLoenProjectedAmounts(row, satser, {
    loenperiode,
    allocationDates,
    selectedDates,
    mode: af.tillaegAngivesSom,
    rateSegments: fra && til
      ? buildLoenindkomstRateSegments({
        ansaettelsesforhold: af,
        skadedato: undefined,
        fra,
        til,
      })
      : undefined,
  });

  return {
    grundloen: projected.grundloen,
    tillaeg: projected.tillaeg,
    ikkePensionsgivende: projected.ikkePensionsgivende,
    atp: projected.atp,
    fpFvShSoStb: projected.fpFvShSo,
    pension: projected.pension,
    samlet: projected.samlet,
  };
};

const shouldIncludeWageColumn = (
  af: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number],
  rows: readonly StandardLoenTableRow[],
  loenperiode: Loenperiode,
  satser: WageSatsInput,
  key: (typeof WAGE_COLUMNS)[number]['key'],
  errorRowIds: ReadonlySet<string>,
  isoIndex: ReadonlyMap<ISODateString, number>,
  isPeriodiseringsdag: (index: number) => boolean
): boolean => {
  for (const row of rows) {
    if (errorRowIds.has(row.id)) continue;
    if (isStandardLoenRowEffectivelyEmpty(row, loenperiode, af.tillaegAngivesSom)) continue;
    const interval = parseAarsloenRowInterval(row, loenperiode);
    if (!interval) continue;
    const allocationDates = buildAllocationDates(interval, isoIndex, isPeriodiseringsdag);
    const amounts = getWageAmountsForRow(af, row, satser, loenperiode, allocationDates);
    if (amounts[key] !== 0) return true;
  }
  return false;
};

const buildOverenskomstRegulering = (
  dates: readonly ISODateString[],
  isoIndex: ReadonlyMap<ISODateString, number>,
  tableFra: ISODateString,
  tableTil: ISODateString,
  overenskomstIdRaw: string | undefined,
  applyAlmindeligLoenPaaShDageRegel: boolean
): Uint8Array => {
  const flags = new Uint8Array(dates.length);
  if (!overenskomstIdRaw) return flags;

  const offentligType = getOffentligOverenskomstTypeById(overenskomstIdRaw);
  if (offentligType) {
    const reguleringsDatoer = getReguleringsDatoer(offentligType);
    for (const dato of reguleringsDatoer) {
      const iso = parseOffentligDato(dato);
      if (!iso) continue;
      if (iso < tableFra || iso > tableTil) continue;
      const idx = isoIndex.get(iso);
      if (idx === undefined) continue;
      flags[idx] = 1;
    }

    const fraDanish = isoToDanish(tableFra);
    const tilDanish = isoToDanish(tableTil);
    if (fraDanish && tilDanish) {
      const tillaegsSatser = getOffentligTillaegsSatserForPeriode(
        overenskomstIdRaw,
        fraDanish,
        tilDanish,
        applyAlmindeligLoenPaaShDageRegel
      );
      for (const sats of tillaegsSatser) {
        const iso = parseOffentligDato(sats.fraDato);
        if (!iso) continue;
        if (iso < tableFra || iso > tableTil) continue;
        const idx = isoIndex.get(iso);
        if (idx === undefined) continue;
        flags[idx] = 1;
      }
    }
    return flags;
  }

  const ref = resolveOverenskomstRef(overenskomstIdRaw);
  if (!ref) return flags;

  const fraDanish = isoToDanish(tableFra);
  const tilDanish = isoToDanish(tableTil);
  if (!fraDanish || !tilDanish) return flags;

  const satser = getEffektiveSatserForPeriode({
    overenskomstId: ref.baseId,
    fraDato: fraDanish,
    tilDato: tilDanish,
    applyAlmindeligLoenPaaShDageRegel,
  });

  for (const sats of satser) {
    const iso = parseOffentligDato(sats.fraDato);
    if (!iso) continue;
    const idx = isoIndex.get(iso);
    if (idx === undefined) continue;
    flags[idx] = 1;
  }

  return flags;
};

export const buildLoenindkomstColumns = (args: {
  dates: readonly ISODateString[];
  isoIndex: ReadonlyMap<ISODateString, number>;
  values: ErstatningsopgoerelseValues;
  isWorkdayByIndex: readonly boolean[];
  tableFra: ISODateString;
  tableTil: ISODateString;
  columnWidthPx: number;
  errorRowIdsByIndex: ReadonlyArray<ReadonlySet<string>>;
  /** Se `harKontrolTabelAnsaettelsesforholdKolonner`. TAF-dagskolonnen er ikke omfattet. */
  medAnsaettelsesforholdKolonner: boolean;
}): Readonly<{ columns: ReadonlyArray<KontrolTabelColumnData> }> => {
  const {
    dates,
    isoIndex,
    values,
    isWorkdayByIndex,
    tableFra,
    tableTil,
    columnWidthPx,
    errorRowIdsByIndex,
    medAnsaettelsesforholdKolonner,
  } = args;

  const columns: KontrolTabelColumnData[] = [];
  const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
  const globalPeriodiseringErKalenderdage = computeTafBeregningsenhed(values) === TAF_BEREGNES_SOM.MAANEDER;

  // Ændret 2026-10-30 (BB-388, udviklerafgørelse): uden TAF-krav ingen ansættelsesforholdskolonner. Det er
  // præsentation, ikke parity: sammentællingens ansættelsesforholdsrækker følger samme gate.
  const kolonneAnsaettelser = medAnsaettelsesforholdKolonner ? ansaettelser : [];
  for (let afIndex = 0; afIndex < kolonneAnsaettelser.length; afIndex += 1) {
    const af = kolonneAnsaettelser[afIndex];
    const errorRowIds = errorRowIdsByIndex[afIndex] ?? new Set<string>();

    const reguleringFlags = buildOverenskomstRegulering(
      dates,
      isoIndex,
      tableFra,
      tableTil,
      af.overenskomstId,
      af.loenPaaHelligdage === 'Almindelig løn'
    );

    const reguleringValues: string[] = Array.from({ length: dates.length }, (_, rowIndex) =>
      reguleringFlags[rowIndex] === 1 ? 'x' : ''
    );
    columns.push({
      id: kontrolTabelColumnId.tafRegulering(afIndex),
      header: 'TAF-regulering',
      align: 'center',
      width: columnWidthPx,
      borderLeft: true,
      values: reguleringValues,
    });

    const satser = {
      feriePct: af.feriePct,
      fritvalgPct: af.fritvalgPct,
      shSoPct: af.shSoPct,
      storeBededagPct: af.storeBededagPct,
      pensionPct: af.pensionPct,
    } as const;
    const isPeriodiseringsdag = (index: number): boolean => {
      if (globalPeriodiseringErKalenderdage) return true;
      return isWorkdayByIndex[index];
    };

    const includeKeys = WAGE_COLUMNS.filter((col) =>
      shouldIncludeWageColumn(
        af,
        af.indtaegtsoplysningerTableData ?? [],
        af.loenperiode,
        satser,
        col.key,
        errorRowIds,
        isoIndex,
        isPeriodiseringsdag
      )
    );

    // NOTE: Float64Array er bevidst valgt for deterministisk summation.
    const arraysByKey = new Map<(typeof WAGE_COLUMNS)[number]['key'], Float64Array>();
    for (const col of includeKeys) {
      arraysByKey.set(col.key, new Float64Array(dates.length));
    }

    const rows = af.indtaegtsoplysningerTableData ?? [];
    for (const row of rows) {
      if (errorRowIds.has(row.id)) continue;
      if (isStandardLoenRowEffectivelyEmpty(row, af.loenperiode, af.tillaegAngivesSom)) continue;
      const interval = parseAarsloenRowInterval(row, af.loenperiode);
      if (!interval) continue;

      const startISO = dateToISO(interval.start);
      const endISO = dateToISO(interval.end);
      if (!startISO || !endISO) continue;

      const allocationDates = buildAllocationDates(interval, isoIndex, isPeriodiseringsdag);
      if (allocationDates.length <= 0) continue;

      const amounts = getWageAmountsForRow(af, row, satser, af.loenperiode, allocationDates);
      const hasAny = includeKeys.some((k) => amounts[k.key] !== 0);
      if (!hasAny) continue;

      for (const iso of allocationDates) {
        const idx = isoIndex.get(iso);
        if (idx === undefined) continue;
        const projectedForDay = getWageAmountsForRow(af, row, satser, af.loenperiode, allocationDates, [iso]);
        for (const col of includeKeys) {
          const array = arraysByKey.get(col.key);
          if (!array) continue;
          array[idx] += projectedForDay[col.key];
        }
      }
    }

    for (const col of includeKeys) {
      const header = col.header;
      const amountsByIndex = arraysByKey.get(col.key) ?? new Float64Array(dates.length);
      const valuesByIndex: string[] = Array.from({ length: dates.length }, (_, rowIndex) => {
        const value = amountsByIndex[rowIndex];
        return value === 0 ? '' : formatCurrency(value);
      });
      columns.push({
        id: kontrolTabelColumnId.loenWage(afIndex, col.key),
        header,
        name: col.name,
        align: 'right',
        width: columnWidthPx,
        rawValues: Array.from(amountsByIndex),
        values: valuesByIndex,
      });
    }
  }

  return { columns };
};
