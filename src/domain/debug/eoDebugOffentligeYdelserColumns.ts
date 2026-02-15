import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { dateToISO } from '../../types/branded';
import { parseAmount, formatCurrency } from '../../utils/formatUtils';
import { parseDanishDate } from '../../utils/shDageBeregning';
import { ydelsestyper, type Periodisering } from '../../data/ydelsestyper';
import { isoDateToDate } from '../dates/isoDate';
import type { DebugTabelIntegrityIssue } from './eoDebugModel';
import { isOffentligYdelseDatoMedregnet as isOffentligYdelseDatoMedregnetCentral } from '../erstatningsopgoerelse/periodiseringsMotor';
import { iterateDatesInclusive, validateIsoRange } from '../../utils/isoDateHelpers';

export type OffentligYdelseCoreColumn = Readonly<{
  typeKey: string;
  header: string;
  amountsByIndex: Float64Array;
}>;

// LOCKED: Offentlige ydelser debug-clusteret er færdig‑porteret.
// Ændr kun ved parity‑brud og dokumentér årsag.
export const parseOffentligDato = (value: string | undefined): ISODateString | undefined => {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') return undefined;
  const parsed = parseDanishDate(trimmed);
  if (!parsed) return undefined;
  return dateToISO(parsed);
};

const isWithinIntegrityTolerance = (actual: number, expected: number, tolerance: number): boolean => {
  return Math.abs(actual - expected) <= tolerance + Number.EPSILON;
};

const sumFloat64Array = (arr: Float64Array): number => {
  let sum = 0;
  let compensation = 0;
  for (let i = 0; i < arr.length; i += 1) {
    const value = arr[i] ?? 0;
    const y = value - compensation;
    const t = sum + y;
    compensation = (t - sum) - y;
    sum = t;
  }
  return sum;
};

const isOffentligYdelseDatoMedregnet = (
  iso: ISODateString,
  dateObj: Date,
  shDays: ReadonlySet<ISODateString>,
  periodisering: Periodisering,
  ydelsestypeKey: string,
  rowTilISO: ISODateString,
  sygedagpengeShCutoff: ISODateString
): boolean => {
  return isOffentligYdelseDatoMedregnetCentral({
    iso,
    dateObj,
    shDays,
    periodisering,
    ydelsestypeKey,
    rowTilISO,
    sygedagpengeShCutoff,
  });
};

export const buildOffentligeYdelserColumns = (args: {
  dates: readonly ISODateString[];
  isoIndex: ReadonlyMap<ISODateString, number>;
  values: ErstatningsopgoerelseValues;
  shDays: ReadonlySet<ISODateString>;
  sygedagpengeShCutoff: ISODateString;
  integrityTolerance: number;
  errorRowIds: ReadonlySet<string>;
}): Readonly<{
  columns: ReadonlyArray<OffentligYdelseCoreColumn>;
  integrityIssues: ReadonlyArray<DebugTabelIntegrityIssue>;
}> => {
  const { dates, isoIndex, values, shDays, sygedagpengeShCutoff, integrityTolerance, errorRowIds } = args;

  const byType = new Map<string, Float64Array>();
  const typeOrder: string[] = [];
  const expectedTotalsByType = new Map<string, number>();
  const issues: DebugTabelIntegrityIssue[] = [];
  const parsedRowsByType = new Map<
    string,
    Array<Readonly<{ id: string; label: string; range: Readonly<{ fra: ISODateString; til: ISODateString }>; total: number; config: Readonly<{ periodisering: Periodisering; periodiseringLabel: string }> }>>
  >();

  for (const row of values.offentligeYdelserRows ?? []) {
    if (errorRowIds.has(row.id)) continue;
    const typeKey = row.ydelsestype?.trim() ?? '';
    if (typeKey === '') {
      // Fejl hvis beløb er angivet uden ydelsestype
      const hasAnyValue = parseAmount(row.ydelse) + parseAmount(row.tillaeg) !== 0;
      if (hasAnyValue) {
        issues.push({
          severity: 'error',
          area: 'offentlige ydelser',
          message: `Offentlig ydelse (række ${row.id}): Beløb er angivet uden ydelsestype – vælg en ydelsestype.`,
        });
      }
      continue;
    }
    const config = ydelsestyper[typeKey];
    if (!config) {
      const hasAnyValue = parseAmount(row.ydelse) + parseAmount(row.tillaeg) !== 0;
      if (hasAnyValue) {
        issues.push({
          severity: 'warning',
          area: 'offentlige ydelser',
          message: `Offentlig ydelse (række ${row.id}): Ukendt ydelsestype "${typeKey}" – kan ikke vises i debug tabellen.`,
        });
      }
      continue;
    }

    const fraISO = parseOffentligDato(row.fraDato);
    const tilISO = parseOffentligDato(row.tilDato);
    const range = validateIsoRange(fraISO, tilISO);
    if (!range) {
      const hasAnyValue = parseAmount(row.ydelse) + parseAmount(row.tillaeg) !== 0;
      if (hasAnyValue) {
        issues.push({
          severity: 'warning',
          area: 'offentlige ydelser',
          message: `Offentlig ydelse (række ${row.id}, ${config.label}): Ugyldigt dato-interval (${row.fraDato || '-'} → ${row.tilDato || '-'}) – kan ikke periodiseres/vises.`,
        });
      }
      continue;
    }

    const total = parseAmount(row.ydelse) + parseAmount(row.tillaeg);
    if (total === 0) continue;

    let dayCount = 0;
    const start = isoDateToDate(range.fra);
    const end = isoDateToDate(range.til);
    iterateDatesInclusive(start, end, (d) => {
      const iso = dateToISO(d);
      if (!iso) return;
      if (isOffentligYdelseDatoMedregnet(iso, d, shDays, config.periodisering, typeKey, range.til, sygedagpengeShCutoff)) {
        dayCount += 1;
      }
    });
    if (dayCount <= 0) {
      issues.push({
        severity: 'warning',
        area: 'offentlige ydelser',
        message: `Offentlig ydelse (række ${row.id}, ${config.label}): Perioden indeholder ingen periodiseringsdage (${config.periodiseringLabel}) – beløbet vises ikke i debug tabellen.`,
      });
      continue;
    }

    expectedTotalsByType.set(typeKey, (expectedTotalsByType.get(typeKey) ?? 0) + total);

    let amounts = byType.get(typeKey);
    if (!amounts) {
      // NOTE: Float64Array is intentional for deterministic summation and legacy parity.
      amounts = new Float64Array(dates.length);
      byType.set(typeKey, amounts);
      typeOrder.push(typeKey);
    }

    const parsedForType = parsedRowsByType.get(typeKey) ?? [];
    parsedForType.push({ id: row.id, label: config.label, range, total, config });
    parsedRowsByType.set(typeKey, parsedForType);

    const perDay = total / dayCount;
    iterateDatesInclusive(start, end, (d) => {
      const iso = dateToISO(d);
      if (!iso) return;
      const idx = isoIndex.get(iso);
      if (idx === undefined) return;
      if (!isOffentligYdelseDatoMedregnet(iso, d, shDays, config.periodisering, typeKey, range.til, sygedagpengeShCutoff)) return;
      amounts[idx] += perDay;
    });
  }

  for (const [typeKey, rowsForType] of parsedRowsByType) {
    const amounts = byType.get(typeKey);
    if (!amounts) continue;

    const hasOverlapById = new Map<string, boolean>();
    for (let i = 0; i < rowsForType.length; i += 1) {
      for (let j = i + 1; j < rowsForType.length; j += 1) {
        const a = rowsForType[i];
        const b = rowsForType[j];
        const overlaps = !(a.range.til < b.range.fra || b.range.til < a.range.fra);
        if (!overlaps) continue;
        hasOverlapById.set(a.id, true);
        hasOverlapById.set(b.id, true);
      }
    }

    for (const row of rowsForType) {
      if (hasOverlapById.get(row.id) === true) continue;

      let actual = 0;
      const start = isoDateToDate(row.range.fra);
      const end = isoDateToDate(row.range.til);
      iterateDatesInclusive(start, end, (d) => {
        const iso = dateToISO(d);
        if (!iso) return;
        const idx = isoIndex.get(iso);
        if (idx === undefined) return;
        if (!isOffentligYdelseDatoMedregnet(iso, d, shDays, row.config.periodisering, typeKey, row.range.til, sygedagpengeShCutoff)) return;
        actual += amounts[idx] ?? 0;
      });

      if (!isWithinIntegrityTolerance(actual, row.total, integrityTolerance)) {
        issues.push({
          severity: 'error',
          area: 'offentlige ydelser',
          message: `Offentlig ydelse (række ${row.id}, ${row.label}): Sammentælling i debug tabellen (${formatCurrency(actual)}) matcher ikke indtastet total (${formatCurrency(row.total)}) (afvigelse ${formatCurrency(Math.abs(actual - row.total))}, tolerance ${formatCurrency(integrityTolerance)}).`,
        });
      }
    }
  }

  for (const [typeKey, expected] of expectedTotalsByType) {
    const amounts = byType.get(typeKey);
    if (!amounts) {
      const label = ydelsestyper[typeKey]?.label ?? typeKey;
      issues.push({
        severity: 'error',
        area: 'offentlige ydelser',
        message: `Offentlige ydelser (${label}): Beløbet er indtastet, men ydelsen fremgår ikke af debug tabellen.`,
      });
      continue;
    }

    const actual = sumFloat64Array(amounts);
    if (!isWithinIntegrityTolerance(actual, expected, integrityTolerance)) {
      const label = ydelsestyper[typeKey]?.label ?? typeKey;
      issues.push({
        severity: 'error',
        area: 'offentlige ydelser',
        message: `Offentlige ydelser (${label}): Sammentælling i debug tabellen (${formatCurrency(actual)}) matcher ikke indtastet total (${formatCurrency(expected)}) (afvigelse ${formatCurrency(Math.abs(actual - expected))}, tolerance ${formatCurrency(integrityTolerance)}).`,
      });
    }
  }

  const columns = typeOrder.map((typeKey) => {
    const config = ydelsestyper[typeKey];
    const header = config?.debugLabel ?? config?.label ?? typeKey;
    const amountsByIndex = byType.get(typeKey) ?? new Float64Array(dates.length);
    return { typeKey, header, amountsByIndex };
  });

  return { columns, integrityIssues: issues };
};
