import type { ErstatningsopgoerelseValues, OffentligeYdelserRow, SvieSmertePeriodeRow } from '../../schemas/formSchemas';
import type { SvieSmerteConstrainedPeriod } from '../erstatningsopgoerelse/engines/svieSmerteEngine';
import type { ISODateString } from '../../types/branded';
import { dateToISO, isoToDanish } from '../../types/branded';
import type { IsoRange } from '../erstatningsopgoerelse/validation/tafPeriodConstraints';
import { formatCurrency } from '../../utils/formatUtils';
import { isStandardLoenRowEffectivelyEmpty } from '../aarsloen/standardLoenRowCalculations';
import { buildOffentligeYdelserColumns, parseOffentligDato } from './eoDebugOffentligeYdelserColumns';
import { buildLoenindkomstColumns, buildTafDayStatusValues } from './eoDebugLoenColumns';
import { debugTabelColumnId, type DebugTabelWageColumnKey } from './eoDebugLoenTypes';
import { isoDateToDate } from '../dates/isoDate';
import { getStandardLoenErrorRowIdSet, getOffentligeYdelserErrorRowIdSet } from './eoDebugRowValidation';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from '../erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { buildTafRanges, parseAarsloenRowInterval } from '../erstatningsopgoerelse/helpers/indtaegtPerioder';
import { SYGEDAGPENGE_SH_CUTOFF } from '../erstatningsopgoerelse/engines/periodiseringsMotor';
import { buildShDageSetFromIsoRange } from '../erstatningsopgoerelse/engines/tafDaySets';
import { iterateDatesInclusive, maxISO, minISO, validateIsoRange } from '../../utils/isoDateHelpers';
import type { DebugDay } from './eoDebugTypes';
import { getDayBeforeIso } from '../../utils/isoDateHelpers';

export type DebugTabelDateSource = Readonly<{
  label: string;
  fra: ISODateString | undefined;
  til: ISODateString | undefined;
}>;

export type DebugTabelColumnId =
  | (typeof DEBUG_TABEL_COLUMN_IDS)[keyof typeof DEBUG_TABEL_COLUMN_IDS]
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
  tafDay: 'base:taf_day',
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
  weekdayIndexByRow: readonly DebugDay['weekday'][];
  isSognehelligdagByIndex: readonly boolean[];
  isWorkdayByIndex: readonly boolean[];
  ssStatusByIndex: readonly string[];
  svieSmerteByIndex: readonly DebugDay['svieSmerte'][];
  tafDayStatusByIndex: readonly string[];
  tafColumnIds: readonly DebugTabelColumnId[];
  tafFlagsByIndex: readonly ReadonlySet<string>[];
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
    const year = fraDate.getUTCFullYear();
    const month = fraDate.getUTCMonth() + 1;
    tableFra = `${year}-${String(month).padStart(2, '0')}-01` as ISODateString;
  }

  if (combinedMaxTil) {
    const tilDate = isoDateToDate(combinedMaxTil);
    const year = tilDate.getUTCFullYear();
    const month = tilDate.getUTCMonth() + 1;
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    tableTil = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}` as ISODateString;
  }

  return { fra: tableFra, til: tableTil };
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

const addWeekdayNonShDatesFromIsoRange = (
  set: Set<ISODateString>,
  fra: ISODateString,
  til: ISODateString,
  shDays: ReadonlySet<ISODateString>
): void => {
  const start = isoDateToDate(fra);
  const end = isoDateToDate(til);
  iterateDatesInclusive(start, end, (d) => {
    const dow = d.getUTCDay();
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
    const range = validateIsoRange(row.fra, row.til);
    if (!range) continue;
    addWeekdayNonShDatesFromIsoRange(set, range.fra, range.til, shDays);
  }

  return set;
};

const buildTafDatesFromRanges = (tafRanges: readonly IsoRange[]): ReadonlySet<ISODateString> => {
  const set = new Set<ISODateString>();
  for (const range of tafRanges) {
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
    const range = validateIsoRange(fraISO, tilISO);
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
      if (isStandardLoenRowEffectivelyEmpty(row, af.loenperiode)) {
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

const collectMinMaxSvieSmerte = (
  values: ErstatningsopgoerelseValues,
  erstatningsFra: ISODateString | undefined,
  erstatningsTil: ISODateString | undefined,
  menStopDato: ISODateString | undefined,
  constrainedPeriods?: readonly SvieSmerteConstrainedPeriod[]
): { min: ISODateString | undefined; max: ISODateString | undefined } => {
  let min: ISODateString | undefined;
  let max: ISODateString | undefined;

  if (constrainedPeriods) {
    for (const periode of constrainedPeriods) {
      min = minISO(min, periode.fra);
      max = maxISO(max, periode.til);
    }
    return { min, max };
  }

  const erstatningsRange = validateIsoRange(erstatningsFra, erstatningsTil);
  if (!erstatningsRange) {
    return { min: undefined, max: undefined };
  }

  const maxSsDato = menStopDato ? getDayBeforeIso(menStopDato) : erstatningsRange.til;
  const perioder: readonly SvieSmertePeriodeRow[] = values.svieSmertePerioder ?? [];

  for (const periode of perioder) {
    const tilstand = periode.tilstand;
    if (tilstand !== 'sygemeldt' && tilstand !== 'delvist-sygemeldt') continue;
    const periodeRange = validateIsoRange(periode.fra, periode.til);
    if (!periodeRange) continue;

    const clampedFra = maxISO(periodeRange.fra, erstatningsRange.fra);
    const clampedTil = minISO(periodeRange.til, maxSsDato);
    const clampedRange = validateIsoRange(clampedFra, clampedTil);
    if (!clampedRange) continue;

    min = minISO(min, clampedRange.fra);
    max = maxISO(max, clampedRange.til);
  }

  return { min, max };
};

const buildSsCoverage = (
  dates: readonly ISODateString[],
  isoIndex: ReadonlyMap<ISODateString, number>,
  values: ErstatningsopgoerelseValues,
  erstatningsFra: ISODateString | undefined,
  erstatningsTil: ISODateString | undefined,
  menStopDato: ISODateString | undefined,
  /** Clampede svie/smerte-perioder fra engine. Når leveret bruges disse direkte
   *  i stedet for at genimplementere clamping fra values — sikrer at tabellen
   *  afspejler præcis de perioder der indgik i beregningen. */
  constrainedPeriods?: readonly SvieSmerteConstrainedPeriod[]
): { statusByIndex: readonly string[]; stopAfterMenByIndex: readonly boolean[] } => {
  const dayCount = dates.length;
  const statusByIndex: string[] = Array.from({ length: dayCount }, () => '-');
  const stopAfterMenByIndex: boolean[] = Array.from({ length: dayCount }, () => false);

  const erstatningsRange = validateIsoRange(erstatningsFra, erstatningsTil);
  if (!erstatningsRange) {
    return { statusByIndex, stopAfterMenByIndex };
  }

  const maxSsDato = menStopDato ? getDayBeforeIso(menStopDato) : erstatningsRange.til;

  const sygemeldt = new Uint8Array(dayCount);
  const delvist = new Uint8Array(dayCount);

  if (constrainedPeriods) {
    // Autoritativ sti: brug engine-outputtets clampede perioder direkte.
    // constrainedPeriods er allerede clamped mod alle bounds (vedroerer, ménafgørelse osv.).
    for (const periode of constrainedPeriods) {
      const start = isoDateToDate(periode.fra);
      const end = isoDateToDate(periode.til);
      iterateDatesInclusive(start, end, (d) => {
        const iso = dateToISO(d);
        if (!iso) return;
        const idx = isoIndex.get(iso);
        if (idx === undefined) return;
        if (periode.isDelvist) delvist[idx] = 1;
        else sygemeldt[idx] = 1;
      });
    }
  } else {
    // Fallback: validerings-fejl-sti og standalone/test-brug.
    // Genimplementerer clamping fra values — samme logik som engine, men selvstændig.
    const hasSsMax = maxSsDato !== undefined;
    const perioder: readonly SvieSmertePeriodeRow[] = values.svieSmertePerioder ?? [];
    for (const periode of perioder) {
      const tilstand = periode.tilstand;
      if (tilstand !== 'sygemeldt' && tilstand !== 'delvist-sygemeldt') continue;
      const periodeRange = validateIsoRange(periode.fra, periode.til);
      if (!periodeRange) continue;

      const clampedFra = maxISO(periodeRange.fra, erstatningsRange.fra);
      const clampedTil = hasSsMax ? minISO(periodeRange.til, maxSsDato) : periodeRange.til;
      const clampedRange = validateIsoRange(clampedFra, clampedTil);
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

export const buildEODebugModel = (
  values: ErstatningsopgoerelseValues,
  options: Readonly<{
    tafRanges?: readonly IsoRange[];
    skadedatoISO?: ISODateString;
    /** Clampede svie/smerte-perioder fra engine. Når leveret afspejler debug-tabellen
     *  præcist de perioder der indgik i beregningen — ikke de rå committede datoer. */
    svieSmerteConstrainedPeriods?: readonly SvieSmerteConstrainedPeriod[];
  }> = {}
): EODebugModel => {
  const erstatningsFra = values.vedroererPeriodeFra;
  const erstatningsTil = values.vedroererPeriodeTil;
  const beregningsFra = values.tafBeregningsperiodeFra;
  const beregningsTil = values.tafBeregningsperiodeTil;
  const isBeregningsperiode = values.beregnesUdFra === 'Beregningsperiode';
  const menStopDato =
    values.varigeMenAfgorelse === 'Ja' && values.verserendeKlageMen === 'Nej' ? values.menAfgoerelseDato : undefined;

  const loenErrorRowIdsByIndex = (values.loenindkomstAnsaettelsesforhold ?? []).map((af) =>
    getStandardLoenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode)
  );
  const offentligeErrorRowIds = getOffentligeYdelserErrorRowIdSet(values.offentligeYdelserRows ?? []);

  const loenBounds = collectMinMaxLoenindkomst(values.loenindkomstAnsaettelsesforhold ?? [], loenErrorRowIdsByIndex);
  const ydelserBounds = collectMinMaxOffentligeYdelser(values.offentligeYdelserRows ?? [], offentligeErrorRowIds);
  const svieSmerteBounds = collectMinMaxSvieSmerte(
    values,
    erstatningsFra,
    erstatningsTil,
    menStopDato,
    options.svieSmerteConstrainedPeriods
  );

  const sources: DebugTabelDateSource[] = [
    { label: 'Erstatningsperiode', fra: erstatningsFra, til: erstatningsTil },
    {
      label: 'Beregningsperiode',
      fra: isBeregningsperiode ? beregningsFra : undefined,
      til: isBeregningsperiode ? beregningsTil : undefined,
    },
    { label: 'Lønindkomst', fra: loenBounds.min, til: loenBounds.max },
    { label: 'Offentlige ydelser', fra: ydelserBounds.min, til: ydelserBounds.max },
    { label: 'Svie/smerte', fra: svieSmerteBounds.min, til: svieSmerteBounds.max },
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
        weekdayIndexByRow: [],
        isSognehelligdagByIndex: [],
        isWorkdayByIndex: [],
        ssStatusByIndex: [],
        svieSmerteByIndex: [],
        tafDayStatusByIndex: [],
        tafColumnIds: [],
        tafFlagsByIndex: [],
      },
      columnRawValues: new Map(),
    };
  }

  const dates = buildDateList(tableFra, tableTil);
  const isoIndex = buildIsoIndex(dates);
  const beregningsenhed = computeTafBeregningsenhed(values);
  const erMaaneder = beregningsenhed === TAF_BEREGNES_SOM.MAANEDER;
  const shDays = buildShDageSetFromIsoRange(tableFra, tableTil);
  const explicitFerie = buildExplicitFerieSet(values, shDays);
  // Brug clampede tafRanges hvis de er leveret (fra engines — altid præfereret).
  // Fallback bruger den kanoniske buildTafRanges-sti til standalone/test-brug.
  // Snapshot-pipelinen skal fortsat levere tafRanges for fuld parity med den konkrete beregning.
  const resolvedTafRanges: readonly IsoRange[] = options.tafRanges
    ?? buildTafRanges(values, { skadedatoISO: options.skadedatoISO });
  const tafDates = buildTafDatesFromRanges(resolvedTafRanges);

  const beregningsRange = validateIsoRange(beregningsFra, beregningsTil);
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
    const dow = d.getUTCDay();
    weekdayByIndex[i] = weekdayNamesDa[dow] ?? '';
    danishDateByIndex[i] = isoToDanish(iso) ?? '';
    const weekday = dow >= 1 && dow <= 5;
    isWeekdayByIndex[i] = weekday;
    const sh = shDays.has(iso);
    isShByIndex[i] = sh;
    // "Feriedag" i debug-tabellen er kun daterede ferieperioder.
    // Arbejdsdag i tabellen følger beregningsenheden:
    // - Måneder: alle hverdage markeres også som arbejdsdag (inkl. SH/ferie).
    // - Arbejdsdage: hverdage ekskl. SH/feriedage markeres som arbejdsdag.
    const ferie = explicitFerie.has(iso);
    isFerieByIndex[i] = ferie;
    isWorkdayByIndex[i] = erMaaneder ? weekday : weekday && !sh && !ferie;
    const withinBeregnings = beregningsRange ? iso >= beregningsRange.fra && iso <= beregningsRange.til : false;
    isWithinBeregningsByIndex[i] = withinBeregnings;
  }

  const { statusByIndex: ssStatusByIndex } = buildSsCoverage(
    dates,
    isoIndex,
    values,
    erstatningsFra,
    erstatningsTil,
    menStopDato,
    options.svieSmerteConstrainedPeriods
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
      values: dates.map((iso) => (explicitFerie.has(iso) ? 'x' : '')),
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
    isWorkdayByIndex,
    isWithinBeregningsByIndex,
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
  const tafDayStatusByIndex = buildTafDayStatusValues({
    dates,
    erstatningsFra,
    erstatningsTil,
    differencekravDato: values.differencekravDato,
    endeligEetDato:
      values.endeligtEETAfgorelse === 'Ja' && values.verserendeKlageEet === 'Nej'
        ? values.endeligEETVirkningsdato || values.endeligEETAfgoerelseDato
        : undefined,
    tafDates,
    isWorkdayByIndex,
    isWithinBeregningsByIndex,
  });
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

  // Summary-tabellen bruger samme interval som debug-tabellen (månedsgrænser).
  const tafColumnIds = columnData
    .filter((col) => col.id === DEBUG_TABEL_COLUMN_IDS.tafDay)
    .map((col) => col.id);
  const tafFlagsByIndex = dates.map((_, rowIndex) => {
    const activeColumns = tafDayStatusByIndex[rowIndex] === 'Ja' ? tafColumnIds : [];
    return new Set<string>(activeColumns);
  });
  const weekdayIndexByRow = dates.map((iso) => isoDateToDate(iso).getUTCDay() as DebugDay['weekday']);
  const isSognehelligdagByIndex = dates.map((iso) => shDays.has(iso));
  const svieSmerteByIndex = ssStatusByIndex.map((value): DebugDay['svieSmerte'] => {
    if (value === 'Ja') return 'Fuld';
    if (value === 'Delvis') return 'Delvis';
    return 'Ingen';
  });

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
      weekdayIndexByRow,
      isSognehelligdagByIndex,
      isWorkdayByIndex,
      ssStatusByIndex,
      svieSmerteByIndex,
      tafDayStatusByIndex,
      tafColumnIds,
      tafFlagsByIndex,
    },
    columnRawValues,
  };
};
