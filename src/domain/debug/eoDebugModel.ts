import type { ErstatningsopgoerelseValues, OffentligeYdelserRow, SvieSmertePeriodeRow, TafPeriodeRow } from '../../schemas/formSchemas';
import type { AarsloenTableRow, Loenperiode } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { dateToISO, isoToDanish, subtractOneDay, toISODateString } from '../../types/branded';
import { formatCurrency } from '../../utils/formatUtils';
import { isAarsloenRowEffectivelyEmpty } from '../../utils/aarsloenTableCalculations';
import { parseDanishDate, parseWeekString, beregnHelligdage } from '../../utils/shDageBeregning';
import { buildOffentligeYdelserColumns, parseOffentligDato } from './eoDebugOffentligeYdelserColumns';
import { buildLoenindkomstColumns } from './eoDebugLoenColumns';
import { debugTabelColumnId, type DebugTabelWageColumnKey } from './eoDebugLoenTypes';
import { isoDateToDate } from '../dates/isoDate';
import { getAarsloenErrorRowIdSet, getOffentligeYdelserErrorRowIdSet } from './eoDebugRowValidation';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from '../erstatningsopgoerelse/tafBeregningsenhed';

export type DebugTabelDateSource = Readonly<{
  label: string;
  fra: ISODateString | undefined;
  til: ISODateString | undefined;
}>;

export type DebugTabelColumnId =
  | (typeof DEBUG_TABEL_COLUMN_IDS)[keyof typeof DEBUG_TABEL_COLUMN_IDS]
  | `loen:${number}:taf`
  | `loen:${number}:taf_regulering`
  | `loen:${number}:wage:${DebugTabelWageColumnKey}`
  | `offentlig:${string}`;

export type DebugTabelColumn = Readonly<{
  id: DebugTabelColumnId;
  header: string;
  align: 'left' | 'center' | 'right';
  width: number;
  borderLeft?: boolean;
  getCell: (rowIndex: number) => string;
}>;

export const DEBUG_TABEL_COLUMN_IDS = {
  weekday: 'base:weekday',
  date: 'base:date',
  hverdag: 'base:hverdag',
  shDay: 'base:sh_day',
  ferieDay: 'base:ferie_day',
  arbejdsdag: 'base:arbejdsdag',
  ssDay: 'base:ss_day',
} as const;

export type DebugTabelIntegrityIssue = Readonly<{
  severity: 'warning' | 'error';
  area: 'debug tabel' | 'lønindkomst' | 'offentlige ydelser';
  message: string;
}>;

export { debugTabelColumnId };
export type { DebugTabelWageColumnKey };

export type DebugTabelRow = Readonly<{
  key: ISODateString;
  cells: Readonly<Record<DebugTabelColumnId, string>>;
}>;

export type DebugTabelColumnData = Readonly<{
  id: DebugTabelColumnId;
  header: string;
  align: 'left' | 'center' | 'right';
  width: number;
  borderLeft?: boolean;
  values: readonly string[];
  rawValues?: readonly number[];
}>;

type EODebugTableData = Readonly<{
  dates: readonly ISODateString[];
  isWorkdayByIndex: readonly boolean[];
  ssStatusByIndex: readonly string[];
  tafColumnIds: readonly DebugTabelColumnId[];
}>;

export type EODebugModel = Readonly<{
  sources: readonly DebugTabelDateSource[];
  combinedMinFra: ISODateString | undefined;
  combinedMaxTil: ISODateString | undefined;
  tableFra: ISODateString | undefined;
  tableTil: ISODateString | undefined;
  summaryTableFra: ISODateString | undefined;
  summaryTableTil: ISODateString | undefined;
  rowCount: number;
  getRowKey: (rowIndex: number) => string;
  getCell: (rowIndex: number, colId: DebugTabelColumnId) => string;
  columns: readonly DebugTabelColumn[];
  rows: readonly DebugTabelRow[];
  tableWidthPx: number;
  integrityIssues: readonly DebugTabelIntegrityIssue[];
  tableData: EODebugTableData;
  columnRawValues: ReadonlyMap<DebugTabelColumnId, readonly number[]>;
}>;

const DEFAULT_TABLE_WIDTH_PX = 1200;
const DEFAULT_COLUMN_WIDTH_PX = 120;

const SYGEDAGPENGE_SH_CUTOFF = toISODateString('2012-07-02');

const INTEGRITY_TOLERANCE_KR = 0.05;

const weekdayNamesDa: ReadonlyArray<string> = [
  'Søndag',
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
];

const getIsoRange = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined
): Readonly<{ fra: ISODateString; til: ISODateString }> | undefined => {
  if (!fra || !til) return undefined;
  if (fra > til) return undefined;
  return { fra, til };
};

const minISO = (a: ISODateString | undefined, b: ISODateString | undefined): ISODateString | undefined => {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
};

const maxISO = (a: ISODateString | undefined, b: ISODateString | undefined): ISODateString | undefined => {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
};

const iterateDatesInclusive = (start: Date, end: Date, onDate: (date: Date) => void): void => {
  const current = new Date(start.getTime());
  while (current <= end) {
    onDate(current);
    current.setDate(current.getDate() + 1);
  }
};

const _isWithinIntegrityTolerance = (actual: number, expected: number): boolean => {
  return Math.abs(actual - expected) <= INTEGRITY_TOLERANCE_KR + Number.EPSILON;
};

const validateColumnIds = (columns: readonly DebugTabelColumnData[]): ReadonlyArray<DebugTabelIntegrityIssue> => {
  const emptyIds: string[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const col of columns) {
    const id = col.id;
    if (id.trim() === '') emptyIds.push(id);
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }

  const issues: DebugTabelIntegrityIssue[] = [];
  if (emptyIds.length > 0) {
    issues.push({
      severity: 'error',
      area: 'debug tabel',
      message: 'Debug tabel: En eller flere kolonner har tomt kolonne-ID (programfejl).',
    });
  }
  if (duplicates.size > 0) {
    const list = Array.from(duplicates).slice(0, 8).join(', ');
    issues.push({
      severity: 'error',
      area: 'debug tabel',
      message: `Debug tabel: Dobbelt kolonne-ID fundet (programfejl): ${list}${duplicates.size > 8 ? ' …' : ''}.`,
    });
  }

  return issues;
};

const computeSummaryTableRange = (
  combinedMinFra: ISODateString | undefined,
  combinedMaxTil: ISODateString | undefined
): { fra: ISODateString | undefined; til: ISODateString | undefined } => {
  let tableFra: ISODateString | undefined = undefined;
  let tableTil: ISODateString | undefined = undefined;

  if (combinedMinFra) {
    const fraDate = isoDateToDate(combinedMinFra);
    const year = fraDate.getFullYear();
    const month = fraDate.getMonth() + 1;
    tableFra = `${year}-${String(month).padStart(2, '0')}-01` as ISODateString;
  }

  if (combinedMaxTil) {
    const tilDate = isoDateToDate(combinedMaxTil);
    const year = tilDate.getFullYear();
    const month = tilDate.getMonth() + 1;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    tableTil = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}` as ISODateString;
  }

  return { fra: tableFra, til: tableTil };
};

type ParsedInterval = Readonly<{ start: Date; end: Date }>;

const parseAarsloenRowInterval = (row: AarsloenTableRow, loenperiode: Loenperiode): ParsedInterval | null => {
  if (loenperiode === 'maaned') {
    const monthRaw = row.col0_maaned?.trim() ?? '';
    const yearRaw = row.col1_maaned?.trim() ?? '';
    if (monthRaw === '' || yearRaw === '') return null;

    const month = Number.parseInt(monthRaw, 10);
    const year = Number.parseInt(yearRaw, 10);
    if (!Number.isFinite(month) || !Number.isFinite(year)) return null;
    if (month < 1 || month > 12) return null;
    if (year < 1900 || year > 2100) return null;

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return { start, end };
  }

  if (loenperiode === 'uge') {
    const fraUge = row.col0_uge?.trim() ?? '';
    const tilUge = row.col1_uge?.trim() ?? '';
    if (fraUge === '' || tilUge === '') return null;

    const fra = parseWeekString(fraUge);
    const til = parseWeekString(tilUge);
    if (!fra || !til) return null;
    if (fra.start > til.end) return null;
    return { start: fra.start, end: til.end };
  }

  const fraDato = row.col0_dag?.trim() ?? '';
  const tilDato = row.col1_dag?.trim() ?? '';
  if (fraDato === '' || tilDato === '') return null;

  const fra = parseDanishDate(fraDato);
  const til = parseDanishDate(tilDato);
  if (!fra || !til) return null;
  if (fra > til) return null;
  return { start: fra, end: til };
};


const buildIsoIndex = (dates: readonly ISODateString[]): ReadonlyMap<ISODateString, number> => {
  const map = new Map<ISODateString, number>();
  dates.forEach((d, idx) => map.set(d, idx));
  return map;
};

const buildDateList = (fra: ISODateString, til: ISODateString): readonly ISODateString[] => {
  const start = isoDateToDate(fra);
  const end = isoDateToDate(til);
  const out: ISODateString[] = [];
  iterateDatesInclusive(start, end, (d) => {
    const iso = dateToISO(d);
    if (iso) out.push(iso);
  });
  return out;
};

const buildSHSet = (fra: ISODateString, til: ISODateString): ReadonlySet<ISODateString> => {
  const start = isoDateToDate(fra);
  const end = isoDateToDate(til);
  const years: number[] = [];
  for (let y = start.getFullYear(); y <= end.getFullYear(); y += 1) years.push(y);

  const set = new Set<ISODateString>();
  for (const year of years) {
    const helligdage = beregnHelligdage(year);
    for (const helligdag of helligdage) {
      const dow = helligdag.getDay();
      const erHverdag = dow >= 1 && dow <= 5;
      if (!erHverdag) continue;
      const iso = dateToISO(helligdag);
      if (!iso) continue;
      if (iso >= fra && iso <= til) set.add(iso);
    }
  }
  return set;
};

const addWeekdayNonShDatesFromIsoRange = (
  set: Set<ISODateString>,
  fra: ISODateString,
  til: ISODateString,
  shDays: ReadonlySet<ISODateString>
): void => {
  const start = isoDateToDate(fra);
  const end = isoDateToDate(til);
  iterateDatesInclusive(start, end, (d) => {
    const dow = d.getDay();
    const erHverdag = dow >= 1 && dow <= 5;
    if (!erHverdag) return;
    const iso = dateToISO(d);
    if (!iso) return;
    if (shDays.has(iso)) return;
    set.add(iso);
  });
};

const buildExplicitFerieSet = (values: ErstatningsopgoerelseValues, shDays: ReadonlySet<ISODateString>): ReadonlySet<ISODateString> => {
  const set = new Set<ISODateString>();

  const ferieRows = [...(values.ferieperioder ?? []), ...(values.fravaerPerioder ?? [])];
  for (const row of ferieRows) {
    const range = getIsoRange(row.fra, row.til);
    if (!range) continue;
    addWeekdayNonShDatesFromIsoRange(set, range.fra, range.til, shDays);
  }

  return set;
};

const buildLoseFeriedageSet = (
  values: ErstatningsopgoerelseValues,
  shDays: ReadonlySet<ISODateString>,
  explicitFerie: ReadonlySet<ISODateString>
): ReadonlySet<ISODateString> => {
  const set = new Set<ISODateString>();
  const tafRows: readonly TafPeriodeRow[] = values.tafPerioder ?? [];

  for (const row of tafRows) {
    const range = getIsoRange(row.fra, row.til);
    if (!range) continue;
    const loseCount = typeof row.loseFeriedage === 'number' ? Math.max(0, Math.trunc(row.loseFeriedage)) : 0;
    if (loseCount <= 0) continue;

    let remaining = loseCount;
    const start = isoDateToDate(range.fra);
    const end = isoDateToDate(range.til);

    iterateDatesInclusive(start, end, (d) => {
      if (remaining <= 0) return;

      const dow = d.getDay();
      const erHverdag = dow >= 1 && dow <= 5;
      if (!erHverdag) return;

      const iso = dateToISO(d);
      if (!iso) return;
      if (explicitFerie.has(iso)) return;
      if (shDays.has(iso)) return;
      if (set.has(iso)) return;

      set.add(iso);
      remaining -= 1;
    });
  }

  return set;
};

const allocateWeekdayDates = (args: {
  range: Readonly<{ fra: ISODateString; til: ISODateString }> | undefined;
  count: number;
  shDays: ReadonlySet<ISODateString>;
  reserved: Set<ISODateString>;
}): ReadonlySet<ISODateString> => {
  const { range, count, shDays, reserved } = args;
  if (!range || count <= 0) return new Set<ISODateString>();

  const selected = new Set<ISODateString>();
  let remaining = Math.max(0, Math.trunc(count));
  if (remaining === 0) return selected;

  const start = isoDateToDate(range.fra);
  const end = isoDateToDate(range.til);

  iterateDatesInclusive(start, end, (d) => {
    if (remaining <= 0) return;
    const dow = d.getDay();
    const erHverdag = dow >= 1 && dow <= 5;
    if (!erHverdag) return;
    const iso = dateToISO(d);
    if (!iso) return;
    if (shDays.has(iso)) return;
    if (reserved.has(iso)) return;

    selected.add(iso);
    reserved.add(iso);
    remaining -= 1;
  });

  return selected;
};

const buildTafRangeSet = (values: ErstatningsopgoerelseValues): ReadonlySet<ISODateString> => {
  const set = new Set<ISODateString>();
  const tafRows: readonly TafPeriodeRow[] = values.tafPerioder ?? [];

  for (const row of tafRows) {
    const range = getIsoRange(row.fra, row.til);
    if (!range) continue;
    const start = isoDateToDate(range.fra);
    const end = isoDateToDate(range.til);
    iterateDatesInclusive(start, end, (d) => {
      const iso = dateToISO(d);
      if (iso) set.add(iso);
    });
  }

  return set;
};

const collectMinMaxOffentligeYdelser = (
  rows: readonly OffentligeYdelserRow[],
  errorRowIds: ReadonlySet<string>
): { min: ISODateString | undefined; max: ISODateString | undefined } => {
  let min: ISODateString | undefined;
  let max: ISODateString | undefined;

  for (const row of rows) {
    if (errorRowIds.has(row.id)) continue;
    const ydelsestype = row.ydelsestype?.trim() ?? '';
    if (ydelsestype === '') continue;

    const fraISO = parseOffentligDato(row.fraDato);
    const tilISO = parseOffentligDato(row.tilDato);
    const range = getIsoRange(fraISO, tilISO);
    if (!range) continue;
    min = minISO(min, range.fra);
    max = maxISO(max, range.til);
  }

  return { min, max };
};

const collectMinMaxLoenindkomst = (
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'],
  errorRowIdsByIndex: ReadonlyArray<ReadonlySet<string>>
): { min: ISODateString | undefined; max: ISODateString | undefined } => {
  let min: ISODateString | undefined;
  let max: ISODateString | undefined;

  for (let index = 0; index < ansaettelsesforhold.length; index += 1) {
    const af = ansaettelsesforhold[index];
    const errorRowIds = errorRowIdsByIndex[index] ?? new Set<string>();
    const rows = af.indtaegtsoplysningerTableData ?? [];

    for (const row of rows) {
      if (errorRowIds.has(row.id)) continue;
      if (isAarsloenRowEffectivelyEmpty(row)) {
        continue;
      }
      const interval = parseAarsloenRowInterval(row, af.loenperiode);
      if (!interval) continue;
      const startISO = dateToISO(interval.start);
      const endISO = dateToISO(interval.end);
      if (!startISO || !endISO) continue;
      min = minISO(min, startISO);
      max = maxISO(max, endISO);
    }
  }

  return { min, max };
};

const buildSsCoverage = (
  dates: readonly ISODateString[],
  isoIndex: ReadonlyMap<ISODateString, number>,
  values: ErstatningsopgoerelseValues,
  erstatningsFra: ISODateString | undefined,
  erstatningsTil: ISODateString | undefined,
  menStopDato: ISODateString | undefined
): { statusByIndex: readonly string[]; stopAfterMenByIndex: readonly boolean[] } => {
  const dayCount = dates.length;
  const statusByIndex: string[] = Array.from({ length: dayCount }, () => '-');
  const stopAfterMenByIndex: boolean[] = Array.from({ length: dayCount }, () => false);

  const erstatningsRange = getIsoRange(erstatningsFra, erstatningsTil);
  if (!erstatningsRange) {
    return { statusByIndex, stopAfterMenByIndex };
  }

  const maxSsDato = menStopDato ? subtractOneDay(menStopDato) : erstatningsRange.til;
  const hasSsMax = maxSsDato !== undefined;

  const sygemeldt = new Uint8Array(dayCount);
  const delvist = new Uint8Array(dayCount);

  const perioder: readonly SvieSmertePeriodeRow[] = values.svieSmertePerioder ?? [];
  for (const periode of perioder) {
    const tilstand = periode.tilstand;
    if (tilstand !== 'sygemeldt' && tilstand !== 'delvist-sygemeldt') continue;
    const periodeRange = getIsoRange(periode.fra, periode.til);
    if (!periodeRange) continue;

    const clampedFra = maxISO(periodeRange.fra, erstatningsRange.fra);
    const clampedTil = hasSsMax ? minISO(periodeRange.til, maxSsDato) : periodeRange.til;
    const clampedRange = getIsoRange(clampedFra, clampedTil);
    if (!clampedRange) continue;

    const start = isoDateToDate(clampedRange.fra);
    const end = isoDateToDate(clampedRange.til);
    iterateDatesInclusive(start, end, (d) => {
      const iso = dateToISO(d);
      if (!iso) return;
      const idx = isoIndex.get(iso);
      if (idx === undefined) return;
      if (tilstand === 'sygemeldt') sygemeldt[idx] = 1;
      else delvist[idx] = 1;
    });
  }

  for (let i = 0; i < dayCount; i += 1) {
    const iso = dates[i];
    const withinErstatning = iso >= erstatningsRange.fra && iso <= erstatningsRange.til;
    if (!withinErstatning) {
      statusByIndex[i] = '';
      stopAfterMenByIndex[i] = false;
      continue;
    }

    if (menStopDato && iso === menStopDato) {
      statusByIndex[i] = 'Varige Mén';
      stopAfterMenByIndex[i] = false;
      continue;
    }

    if (menStopDato && iso > menStopDato) {
      statusByIndex[i] = '-';
      stopAfterMenByIndex[i] = true;
      continue;
    }

    if (sygemeldt[i] === 1) statusByIndex[i] = 'Ja';
    else if (delvist[i] === 1) statusByIndex[i] = 'Delvis';
    else statusByIndex[i] = '-';

    stopAfterMenByIndex[i] = false;
  }

  return { statusByIndex, stopAfterMenByIndex };
};

export const buildEODebugModel = (values: ErstatningsopgoerelseValues): EODebugModel => {
  const erstatningsFra = values.vedroererPeriodeFra;
  const erstatningsTil = values.vedroererPeriodeTil;
  const beregningsFra = values.periodeTilBeregningFra;
  const beregningsTil = values.periodeTilBeregningTil;

  const loenErrorRowIdsByIndex = (values.loenindkomstAnsaettelsesforhold ?? []).map((af) =>
    getAarsloenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode)
  );
  const offentligeErrorRowIds = getOffentligeYdelserErrorRowIdSet(values.offentligeYdelserRows ?? []);

  const loenBounds = collectMinMaxLoenindkomst(values.loenindkomstAnsaettelsesforhold ?? [], loenErrorRowIdsByIndex);
  const ydelserBounds = collectMinMaxOffentligeYdelser(values.offentligeYdelserRows ?? [], offentligeErrorRowIds);

  const sources: DebugTabelDateSource[] = [
    { label: 'Erstatningsperiode', fra: erstatningsFra, til: erstatningsTil },
    { label: 'Beregningsperiode', fra: beregningsFra, til: beregningsTil },
    { label: 'Lønindkomst', fra: loenBounds.min, til: loenBounds.max },
    { label: 'Offentlige ydelser', fra: ydelserBounds.min, til: ydelserBounds.max },
  ];

  const combinedMinFra = sources.reduce<ISODateString | undefined>((acc, s) => minISO(acc, s.fra), undefined);
  const combinedMaxTil = sources.reduce<ISODateString | undefined>((acc, s) => maxISO(acc, s.til), undefined);

  const { fra: summaryTableFra, til: summaryTableTil } = computeSummaryTableRange(combinedMinFra, combinedMaxTil);
  const tableFra = summaryTableFra;
  const tableTil = summaryTableTil;

  if (!tableFra || !tableTil || tableFra > tableTil) {
    return {
      sources,
      combinedMinFra,
      combinedMaxTil,
      tableFra,
      tableTil,
      summaryTableFra,
      summaryTableTil,
      rowCount: 0,
      getRowKey: (rowIndex) => String(rowIndex),
      getCell: () => '',
      columns: [],
      rows: [],
      tableWidthPx: DEFAULT_TABLE_WIDTH_PX,
      integrityIssues: [],
      tableData: {
        dates: [],
        isWorkdayByIndex: [],
        ssStatusByIndex: [],
        tafColumnIds: [],
      },
      columnRawValues: new Map(),
    };
  }

  const dates = buildDateList(tableFra, tableTil);
  const isoIndex = buildIsoIndex(dates);
  const beregningsenhed = computeTafBeregningsenhed(values);
  const shDays = buildSHSet(tableFra, tableTil);
  const explicitFerie = buildExplicitFerieSet(values, shDays);
  const loseFerie = buildLoseFeriedageSet(values, shDays, explicitFerie);
  const tafDates = buildTafRangeSet(values);

  const beregningsRange = getIsoRange(beregningsFra, beregningsTil);
  const reservedBeregningsperiodeDates = new Set<ISODateString>([...explicitFerie, ...loseFerie]);
  const oevrigeFravaersdageCount =
    values.oevrigtFravaerUdenLoen === 'Ja' && typeof values.oevrigeFravaersdage === 'number'
      ? values.oevrigeFravaersdage
      : 0;
  const oevrigtFravaerDates = allocateWeekdayDates({
    range: beregningsRange,
    count: oevrigeFravaersdageCount,
    shDays,
    reserved: reservedBeregningsperiodeDates,
  });
  const allFerieDates = new Set<ISODateString>([...explicitFerie, ...loseFerie, ...oevrigtFravaerDates]);

  const weekdayByIndex: string[] = new Array(dates.length);
  const danishDateByIndex: string[] = new Array(dates.length);
  const isWeekdayByIndex: boolean[] = new Array(dates.length);
  const isShByIndex: boolean[] = new Array(dates.length);
  const isFerieByIndex: boolean[] = new Array(dates.length);
  const isWithinBeregningsByIndex: boolean[] = new Array(dates.length);
  const isWorkdayByIndex: boolean[] = new Array(dates.length);

  for (let i = 0; i < dates.length; i += 1) {
    const iso = dates[i];
    const d = isoDateToDate(iso);
    const dow = d.getDay();
    weekdayByIndex[i] = weekdayNamesDa[dow] ?? '';
    danishDateByIndex[i] = isoToDanish(iso) ?? '';
    const weekday = dow >= 1 && dow <= 5;
    isWeekdayByIndex[i] = weekday;
    const sh = shDays.has(iso);
    isShByIndex[i] = sh;
    const ferie = allFerieDates.has(iso);
    isFerieByIndex[i] = ferie;
    isWorkdayByIndex[i] = beregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? weekday : (weekday && !sh && !ferie);
    const withinBeregnings = beregningsRange ? iso >= beregningsRange.fra && iso <= beregningsRange.til : false;
    isWithinBeregningsByIndex[i] = withinBeregnings;
  }

  const menStopDato =
    values.varigeMenAfgorelse === 'Ja' && values.verserendeKlageMen === 'Nej' ? values.menAfgoerelseDato : undefined;

  const { statusByIndex: ssStatusByIndex } = buildSsCoverage(
    dates,
    isoIndex,
    values,
    erstatningsFra,
    erstatningsTil,
    menStopDato
  );

  const baseColumns: DebugTabelColumnData[] = [
    {
      id: DEBUG_TABEL_COLUMN_IDS.weekday,
      header: 'Ugedag',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      values: weekdayByIndex,
    },
    {
      id: DEBUG_TABEL_COLUMN_IDS.date,
      header: 'Dato',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      values: danishDateByIndex,
    },
    {
      id: DEBUG_TABEL_COLUMN_IDS.hverdag,
      header: 'Hverdag',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      values: isWeekdayByIndex.map((value) => (value ? 'x' : '')),
    },
    {
      id: DEBUG_TABEL_COLUMN_IDS.shDay,
      header: 'S/H dag',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      values: isShByIndex.map((value) => (value ? 'x' : '')),
    },
    {
      id: DEBUG_TABEL_COLUMN_IDS.ferieDay,
      header: 'Feriedag',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      values: isFerieByIndex.map((value) => (value ? 'x' : '')),
    },
    {
      id: DEBUG_TABEL_COLUMN_IDS.arbejdsdag,
      header: 'Arbejdsdag',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      values: isWorkdayByIndex.map((value) => (value ? 'x' : '')),
    },
    {
      id: DEBUG_TABEL_COLUMN_IDS.ssDay,
      header: 'S/S dag',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      borderLeft: true,
      values: ssStatusByIndex.map((value) => value ?? '-'),
    },
  ];

  const { columns: loenColumns, integrityIssues: loenIssues } = buildLoenindkomstColumns({
    dates,
    isoIndex,
    values,
    erstatningsFra,
    erstatningsTil,
    tafDates,
    shDays,
    isWorkdayByIndex,
    isWithinBeregningsByIndex,
    loseFerieDates: loseFerie,
    oevrigtFravaerDates,
    tableFra,
    tableTil,
    columnWidthPx: DEFAULT_COLUMN_WIDTH_PX,
    integrityTolerance: INTEGRITY_TOLERANCE_KR,
    errorRowIdsByIndex: loenErrorRowIdsByIndex,
  });

  const { columns: offentlige, integrityIssues: offentligeIssues } = buildOffentligeYdelserColumns({
    dates,
    isoIndex,
    values,
    shDays,
    sygedagpengeShCutoff: SYGEDAGPENGE_SH_CUTOFF,
    integrityTolerance: INTEGRITY_TOLERANCE_KR,
    errorRowIds: offentligeErrorRowIds,
  });
  const offentligeColumns: DebugTabelColumnData[] = offentlige.map((c, idx) => ({
    id: debugTabelColumnId.offentlig(c.typeKey),
    header: c.header,
    align: 'right',
    width: DEFAULT_COLUMN_WIDTH_PX,
    borderLeft: idx === 0,
    rawValues: Array.from(c.amountsByIndex),
    values: Array.from({ length: dates.length }, (_, rowIndex) => {
      const value = c.amountsByIndex[rowIndex];
      return value === 0 ? '' : formatCurrency(value);
    }),
  }));

  const columnData: DebugTabelColumnData[] = [...baseColumns, ...loenColumns, ...offentligeColumns];
  const columnRawValues = new Map<DebugTabelColumnId, readonly number[]>();
  for (const col of columnData) {
    if (col.rawValues) {
      columnRawValues.set(col.id, col.rawValues);
    }
  }
  const columns: DebugTabelColumn[] = columnData.map((col) => ({
    id: col.id,
    header: col.header,
    align: col.align,
    width: col.width,
    borderLeft: col.borderLeft,
    getCell: (rowIndex) => col.values[rowIndex] ?? '',
  }));
  const rows: DebugTabelRow[] = dates.map((iso, rowIndex) => {
    const cells: Record<DebugTabelColumnId, string> = {} as Record<DebugTabelColumnId, string>;
    for (const col of columnData) {
      cells[col.id] = col.values[rowIndex] ?? '';
    }
    return { key: iso, cells };
  });
  const tableWidthPx = Math.max(DEFAULT_TABLE_WIDTH_PX, columnData.length * DEFAULT_COLUMN_WIDTH_PX + 40);
  const integrityIssues: DebugTabelIntegrityIssue[] = [
    ...validateColumnIds(columnData),
    ...loenIssues,
    ...offentligeIssues,
  ];

  // Summary table uses the same range as the debug table (month boundaries).
  const tafColumnIds = columnData
    .filter((col) => col.id.startsWith('loen:') && col.id.endsWith(':taf'))
    .map((col) => col.id);

  return {
    sources,
    combinedMinFra,
    combinedMaxTil,
    tableFra,
    tableTil,
    summaryTableFra,
    summaryTableTil,
    rowCount: dates.length,
    getRowKey: (rowIndex) => dates[rowIndex] ?? String(rowIndex),
    getCell: (rowIndex, colId) => rows[rowIndex]?.cells[colId] ?? '',
    columns,
    rows,
    tableWidthPx,
    integrityIssues,
    tableData: {
      dates,
      isWorkdayByIndex,
      ssStatusByIndex,
      tafColumnIds,
    },
    columnRawValues,
  };
};
