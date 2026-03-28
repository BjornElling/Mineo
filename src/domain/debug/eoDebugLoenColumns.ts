import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import type { StandardLoenTableRow, Loenperiode } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { dateToISO, isoToDanish } from '../../types/branded';
import { formatCurrency } from '../../utils/formatUtils';
import { parseAmount } from '../../utils/numberParsing';
import { calculateStandardLoenRowDerived, isStandardLoenRowEffectivelyEmpty } from '../aarsloen/standardLoenRowCalculations';
import {
  resolveOverenskomstRef,
  getEffektiveSatserForPeriode,
  getOffentligOverenskomstTypeById,
  getOffentligTillaegsSatserForPeriode,
} from '../../data/overenskomstRates';
import { getReguleringsDatoer } from '../../data/offentligLoenLookup';
import { parseOffentligDato } from './eoDebugOffentligeYdelserColumns';
import type { DebugTabelColumnId, DebugTabelIntegrityIssue } from './eoDebugModel';
import { debugTabelColumnId, WAGE_COLUMNS } from './eoDebugLoenTypes';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from '../erstatningsopgoerelse/tafBeregningsenhed';
import { parseAarsloenRowInterval } from '../erstatningsopgoerelse/indtaegtPerioder';
import { type DateInterval, iterateDatesInclusive, validateIsoRange } from '../../utils/isoDateHelpers';
import { sumFloat64Array, isWithinIntegrityTolerance } from './eoDebugMathUtils';

// LOCKED: Løn/TAF debug-clusteret er færdig‑porteret.
// Ændr kun ved parity‑brud og dokumentér årsag.
export type DebugTabelColumnData = Readonly<{
  id: DebugTabelColumnId;
  header: string;
  align: 'left' | 'center' | 'right';
  width: number;
  borderLeft?: boolean;
  values: readonly string[];
  rawValues?: readonly number[];
}>;

export const buildTafDayStatusValues = (args: Readonly<{
  dates: readonly ISODateString[];
  erstatningsFra: ISODateString | undefined;
  erstatningsTil: ISODateString | undefined;
  differencekravDato: ISODateString | undefined;
  endeligEetDato: ISODateString | undefined;
  tafDates: ReadonlySet<ISODateString>;
  isWorkdayByIndex: readonly boolean[];
  isWithinBeregningsByIndex: readonly boolean[];
}>): readonly string[] => {
  const {
    dates,
    erstatningsFra,
    erstatningsTil,
    differencekravDato,
    endeligEetDato,
    tafDates,
    isWorkdayByIndex,
    isWithinBeregningsByIndex,
  } = args;

  const erstatningsRange = validateIsoRange(erstatningsFra, erstatningsTil);
  const isWithinErstatningsByIndex: ReadonlyArray<boolean> = dates.map((iso) =>
    erstatningsRange ? iso >= erstatningsRange.fra && iso <= erstatningsRange.til : false
  );

  const tafStatus = new Uint8Array(dates.length);
  for (let i = 0; i < dates.length; i += 1) {
    const iso = dates[i];
    const within = isWithinErstatningsByIndex[i];
    const isWork = isWorkdayByIndex[i];

    if (!within) {
      tafStatus[i] = 0;
      continue;
    }

    if (endeligEetDato && iso === endeligEetDato) {
      tafStatus[i] = 2;
      continue;
    }
    if (endeligEetDato && iso > endeligEetDato) {
      tafStatus[i] = 0;
      continue;
    }

    if (differencekravDato && iso >= differencekravDato) {
      tafStatus[i] = 0;
      continue;
    }

    if (!tafDates.has(iso)) {
      tafStatus[i] = 0;
      continue;
    }

    tafStatus[i] = isWork ? 1 : 0;
  }

  return dates.map((_iso, rowIndex) => {
    if (!isWithinErstatningsByIndex[rowIndex] && !isWithinBeregningsByIndex[rowIndex]) return '';
    const code = tafStatus[rowIndex];
    if (code === 2) return 'Endeligt EET';
    if (code === 1) return 'Ja';
    return isWithinErstatningsByIndex[rowIndex] ? '-' : '';
  });
};

const getWageAmountsForRow = (
  row: StandardLoenTableRow,
  satser: Readonly<{
    feriePct: number | undefined;
    fritvalgPct: number | undefined;
    shSoPct: number | undefined;
    storeBededagPct: number | undefined;
    pensionPct: number | undefined;
  }>
): Readonly<Record<(typeof WAGE_COLUMNS)[number]['key'], number>> => {
  const derived = calculateStandardLoenRowDerived(row, satser);

  return {
    grundloen: parseAmount(row.col2),
    tillaeg: parseAmount(row.col3),
    ikkePensionsgivende: parseAmount(row.col4),
    atp: parseAmount(row.col5),
    ferieberettiget: derived.ferieberet,
    fpFvShSoStb: derived.fpFvShSo,
    pension: derived.pension,
    samlet: derived.samlet,
  };
};

const shouldIncludeWageColumn = (
  rows: readonly StandardLoenTableRow[],
  loenperiode: Loenperiode,
  satser: Parameters<typeof getWageAmountsForRow>[1],
  key: (typeof WAGE_COLUMNS)[number]['key'],
  errorRowIds: ReadonlySet<string>
): boolean => {
  for (const row of rows) {
    if (errorRowIds.has(row.id)) continue;
    if (isStandardLoenRowEffectivelyEmpty(row)) continue;
    const interval = parseAarsloenRowInterval(row, loenperiode);
    if (!interval) continue;
    const amounts = getWageAmountsForRow(row, satser);
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
  erstatningsFra: ISODateString | undefined;
  erstatningsTil: ISODateString | undefined;
  tafDates: ReadonlySet<ISODateString>;
  shDays: ReadonlySet<ISODateString>;
  isWorkdayByIndex: readonly boolean[];
  isWithinBeregningsByIndex: readonly boolean[];
  tableFra: ISODateString;
  tableTil: ISODateString;
  columnWidthPx: number;
  integrityTolerance: number;
  errorRowIdsByIndex: ReadonlyArray<ReadonlySet<string>>;
}): Readonly<{ columns: ReadonlyArray<DebugTabelColumnData>; integrityIssues: ReadonlyArray<DebugTabelIntegrityIssue> }> => {
  const {
    dates,
    isoIndex,
    values,
    erstatningsFra,
    erstatningsTil,
    tafDates,
    shDays: _shDays,
    isWorkdayByIndex,
    isWithinBeregningsByIndex,
    tableFra,
    tableTil,
    columnWidthPx,
    integrityTolerance,
    errorRowIdsByIndex,
  } = args;

  const columns: DebugTabelColumnData[] = [];
  const issues: DebugTabelIntegrityIssue[] = [];
  const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
  const globalPeriodiseringErKalenderdage = computeTafBeregningsenhed(values) === TAF_BEREGNES_SOM.MAANEDER;

  const endeligEetDato =
    values.endeligtEetAfgorelse === 'Ja' && values.verserendeKlageEet === 'Nej'
      ? values.endeligEETVirkningsdato || values.endeligEETAfgoerelseDato
      : undefined;
  const differencekravDato = values.differencekravDato;

  const hasMultiple = ansaettelser.length > 1;
  const tafValues = buildTafDayStatusValues({
    dates,
    erstatningsFra,
    erstatningsTil,
    differencekravDato,
    endeligEetDato,
    tafDates,
    isWorkdayByIndex,
    isWithinBeregningsByIndex,
  });

  if (ansaettelser.length > 0) {
    columns.push({
      id: debugTabelColumnId.taf,
      header: 'TAF dag',
      align: 'center',
      width: columnWidthPx,
      borderLeft: true,
      values: tafValues,
    });
  }

  for (let afIndex = 0; afIndex < ansaettelser.length; afIndex += 1) {
    const af = ansaettelser[afIndex];
    const suffix = hasMultiple ? ` (${afIndex + 1})` : '';
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
      id: debugTabelColumnId.tafRegulering(afIndex),
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
      shouldIncludeWageColumn(af.indtaegtsoplysningerTableData ?? [], af.loenperiode, satser, col.key, errorRowIds)
    );

    // NOTE: Float64Array is intentional for deterministic summation.
    const arraysByKey = new Map<(typeof WAGE_COLUMNS)[number]['key'], Float64Array>();
    for (const col of includeKeys) {
      arraysByKey.set(col.key, new Float64Array(dates.length));
    }

    const expectedTotalsByKey = new Map<(typeof WAGE_COLUMNS)[number]['key'], number>();
    for (const col of includeKeys) expectedTotalsByKey.set(col.key, 0);

    const parsedRows: Array<
      Readonly<{
        interval: DateInterval;
        amounts: Readonly<Record<(typeof WAGE_COLUMNS)[number]['key'], number>>;
        periodiseringsdage: number;
      }>
    > = [];

    const rows = af.indtaegtsoplysningerTableData ?? [];
    for (const row of rows) {
      if (errorRowIds.has(row.id)) continue;
      if (isStandardLoenRowEffectivelyEmpty(row)) continue;
      const interval = parseAarsloenRowInterval(row, af.loenperiode);
      if (!interval) {
        const amounts = getWageAmountsForRow(row, satser);
        const hasAny = includeKeys.some((k) => amounts[k.key] !== 0);
        if (hasAny) {
          issues.push({
            severity: 'warning',
            area: 'lønindkomst',
            message: `Lønindkomst${suffix}: En lønrække kan ikke periodiseres pga. ugyldigt/løst dato-interval – beløb kan mangle i debug tabellen.`,
          });
        }
        continue;
      }

      const startISO = dateToISO(interval.start);
      const endISO = dateToISO(interval.end);
      if (!startISO || !endISO) continue;

      const amounts = getWageAmountsForRow(row, satser);
      const hasAny = includeKeys.some((k) => amounts[k.key] !== 0);
      if (!hasAny) continue;

      let periodiseringsdage = 0;
      iterateDatesInclusive(interval.start, interval.end, (d) => {
        const iso = dateToISO(d);
        if (!iso) return;
        const idx = isoIndex.get(iso);
        if (idx === undefined) return;
        if (isPeriodiseringsdag(idx)) periodiseringsdage += 1;
      });
      if (periodiseringsdage <= 0) {
        issues.push({
          severity: 'warning',
          area: 'lønindkomst',
          message: `Lønindkomst${suffix}: Ingen periodiseringsdage i en lønperiode – beløb kan ikke fordeles og vil mangle i debug tabellen.`,
        });
        continue;
      }

      for (const col of includeKeys) {
        expectedTotalsByKey.set(col.key, (expectedTotalsByKey.get(col.key) ?? 0) + amounts[col.key]);
      }
      parsedRows.push({ interval, amounts, periodiseringsdage });

      iterateDatesInclusive(interval.start, interval.end, (d) => {
        const iso = dateToISO(d);
        if (!iso) return;
        const idx = isoIndex.get(iso);
        if (idx === undefined) return;
        if (!isPeriodiseringsdag(idx)) return;

        for (const col of includeKeys) {
          const array = arraysByKey.get(col.key);
          if (!array) continue;
          array[idx] += amounts[col.key] / periodiseringsdage;
        }
      });
    }

    for (let i = 0; i < parsedRows.length; i += 1) {
      const a = parsedRows[i];
      const aStartISO = dateToISO(a.interval.start);
      const aEndISO = dateToISO(a.interval.end);
      if (!aStartISO || !aEndISO) continue;

      let overlaps = false;
      for (let j = 0; j < parsedRows.length; j += 1) {
        if (i === j) continue;
        const b = parsedRows[j];
        const bStartISO = dateToISO(b.interval.start);
        const bEndISO = dateToISO(b.interval.end);
        if (!bStartISO || !bEndISO) continue;
        if (!(aEndISO < bStartISO || bEndISO < aStartISO)) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      for (const col of includeKeys) {
        const expected = a.amounts[col.key] ?? 0;
        if (expected === 0) continue;
        const arr = arraysByKey.get(col.key);
        if (!arr) continue;

        let actual = 0;
        for (let idx = 0; idx < dates.length; idx += 1) {
          const isoDate = dates[idx];
          if (isoDate < aStartISO || isoDate > aEndISO) continue;
          if (!isPeriodiseringsdag(idx)) continue;
          actual += arr[idx] ?? 0;
        }

        if (!isWithinIntegrityTolerance(actual, expected, integrityTolerance)) {
          issues.push({
            severity: 'error',
            area: 'lønindkomst',
            message: `Lønindkomst${suffix} (${col.header}): En lønperiode summerer forkert i debug tabellen (${formatCurrency(actual)} vs ${formatCurrency(expected)}) (afvigelse ${formatCurrency(Math.abs(actual - expected))}, tolerance ${formatCurrency(integrityTolerance)}).`,
          });
        }
      }
    }

    for (const col of includeKeys) {
      const expected = expectedTotalsByKey.get(col.key) ?? 0;
      const actual = sumFloat64Array(arraysByKey.get(col.key) ?? new Float64Array(dates.length));
      if (!isWithinIntegrityTolerance(actual, expected, integrityTolerance)) {
        issues.push({
          severity: 'error',
          area: 'lønindkomst',
          message: `Lønindkomst${suffix} (${col.header}): Sammentælling i debug tabellen (${formatCurrency(actual)}) matcher ikke indtastet/beregnet total (${formatCurrency(expected)}) (afvigelse ${formatCurrency(Math.abs(actual - expected))}, tolerance ${formatCurrency(integrityTolerance)}).`,
        });
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
        id: debugTabelColumnId.loenWage(afIndex, col.key),
        header,
        align: 'right',
        width: columnWidthPx,
        rawValues: Array.from(amountsByIndex),
        values: valuesByIndex,
      });
    }
  }

  return { columns, integrityIssues: issues };
};
