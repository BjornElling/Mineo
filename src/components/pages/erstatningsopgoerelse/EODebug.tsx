import React from 'react';
import { Box, Typography } from '@mui/material';
import { Check, ErrorOutline, WarningAmber } from '@mui/icons-material';
import ContentBox from '../../layout/ContentBox';

import type { DebugRowModel, DebugStatus } from '../../../domain/debug/eoDebugTypes';
import type { SectionId } from '../../../domain/erstatningsopgoerelse/eoDebugNavigationMap';
import type { EODebugExecutionContext } from '../../../domain/erstatningsopgoerelse/eoDebugExecutionContext';
import { EO_DEBUG_BUILDERS } from '../../../domain/erstatningsopgoerelse/eoDebugBuilderRegistry';
import { aarsloenMax } from '../../../data/regulationRates';
import {
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
  getOverenskomst,
  getOverenskomstMetaById,
  getOffentligOverenskomstTypeById,
  getReguleringsDatoIntervalForOverenskomst,
  resolveOverenskomstRef,
  type OverenskomstId,
} from '../../../data/overenskomstRates';
import { getOffentligLoenForDato, getOffentligLoenForPeriode } from '../../../data/offentligLoenLookup';
import { resolveOffentligLoenTypeFromLabel, toLoentrin, type Loengruppe } from '../../../data/offentligLoenTypes';
import {
  getReguleringsDatoIntervalForStatistikModel,
  getStatistiskLoenudvikling,
  type Kvartal,
  type StatistiskLoenudviklingId,
} from '../../../data/statistiskLoenudviklingRates';
import { formatKRLSatstabelDisplay, getKRLSatstabel, getReguleringsDatoIntervalForKRL, type KRLSatstabelId } from '../../../data/KRLrates';
import { loenPaaHelligdageSchema } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { useFormFieldErrorsBySource } from '../../../hooks/useFormFieldErrors';
import { useFormPersistence } from '../../../contexts/FormPersistenceContext';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import type { ISODateString } from '../../../types/branded';
import { dateToISO, isoToDanish, isISODateString, parseISODate, subtractOneDay, toISODateString } from '../../../types/branded';
import { addDays, addMonths, createDate, formatDanishDate, formatToISO, parseDanishDate, parseWeekString } from '../../../utils/dateUtils';
import { formatCurrency, formatPercent, parseAmount } from '../../../utils/formatUtils';
import { amountValueToDisplayString } from '../../../utils/expressionAmount';
import { formatDecimal } from '../../../domain/debug/eoDebugFormat';
import { buildSHDageSet, buildFerieDageSet } from '../../../domain/debug/eoDebugRegulationCore';
import { beregnArbejdsdageOgMaaneder } from '../../../domain/erstatningsopgoerelse/arbejdsdageMaaneder';
import StandardDisplayTable, {
  type StandardDisplayTableColumn,
  type StandardDisplayTableRow,
} from '../../tables/StandardDisplayTable';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { AarsloenTableRow, ErstatningsopgoerelseValues, Loenperiode, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { calculateAarsloenRowDerived, isAarsloenRowEffectivelyEmpty } from '../../../utils/aarsloenTableCalculations';
import { buildIndkomstSectionStatuses, buildOffentligeYdelserDebugRows } from '../../../domain/erstatningsopgoerelse/eoDebugIndkomstModel';
import { isoDateToDate } from '../../../domain/dates/isoDate';
import { ydelsestyper, type Periodisering } from '../../../data/ydelsestyper';
import { calculateTafAntalMaanederPraecis, calculateTafArbejdsdageBreakdown } from '../../../domain/erstatningsopgoerelse/tafCalculations';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/tafBeregningsenhed';
import { computeTafOverlapWithBeregningsperiode } from '../../../domain/erstatningsopgoerelse/beregningsperiodeTafOverlap';
import { getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde } from '../../../domain/erstatningsopgoerelse/angivetLoenHelpers';
import { buildIncomeForRanges } from '../../../domain/erstatningsopgoerelse/indtaegtPerioder';
import { isOffentligYdelseDatoMedregnet as isOffentligYdelseDatoMedregnetCentral } from '../../../domain/erstatningsopgoerelse/periodiseringsMotor';

// Debug strategy:
// - We intentionally read errors by source (input/schema/rule) to expose diagnostics.
// - For UI parity (single active error per field), use the resolved view via `useFormFieldErrors`.
//
// TODO: Når alle debug-elementer er oprettet, skal der laves en komplet gennemgang af alt indhold
// for at sikre, at skjulte elementer (baseret på toggle-værdier) konsekvent behandles som
// ikke-udfyldte/tomme i alle beregninger og valideringer.
const LABEL_WIDTH = '250px';
const STORE_BEDEDAG_START = toISODateString('2024-01-01');
const STORE_BEDEDAG_PCT = 0.45;

type ReguleringsRange = Readonly<{
  min?: ISODateString;
  max?: ISODateString;
}>;

type OffentligLoenSelection = Readonly<{
  overenskomstType: NonNullable<ReturnType<typeof getOffentligOverenskomstTypeById>>;
  loenType: NonNullable<ReturnType<typeof resolveOffentligLoenTypeFromLabel>>;
  loentrin: ReturnType<typeof toLoentrin>;
  loengruppe: Loengruppe;
}>;

const parseDanishToISO = (value: string | undefined): ISODateString | undefined => {
  if (!value || value.trim() === '') return undefined;
  const parsed = parseDanishDate(value.trim());
  if (!parsed) return undefined;
  return formatToISO(parsed);
};

const resolveReguleringTableStartIso = (
  reguleringsdato: ISODateString | undefined,
  tafStartIso: ISODateString
): ISODateString => {
  if (!reguleringsdato) return tafStartIso;
  return reguleringsdato < tafStartIso ? reguleringsdato : tafStartIso;
};

const formatIsoValue = (iso: ISODateString | undefined): string => {
  if (!iso) return '-';
  return isoToDanish(iso) ?? '-';
};

const resolveOffentligLoenSelection = (
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
): OffentligLoenSelection | null => {
  if (!ansaettelsesforhold.overenskomstId) return null;
  const offentligType = getOffentligOverenskomstTypeById(ansaettelsesforhold.overenskomstId);
  if (!offentligType) return null;

  const loenType = resolveOffentligLoenTypeFromLabel(ansaettelsesforhold.offentligLoenType);
  if (!loenType) return null;

  const trinValue = ansaettelsesforhold.offentligLoenTrin;
  const gruppeValue = ansaettelsesforhold.offentligLoenGruppe;
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

const normalizeTableValue = (value: string | AmountValue | undefined): string => {
  if (!value) return '-';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? '-' : trimmed;
  }
  const formatted = amountValueToDisplayString(value, 2).trim();
  return formatted === '' ? '-' : formatted;
};

const resolveStatistikModelIdFromLabel = (
  label: string | undefined
): StatistiskLoenudviklingId | undefined => {
  if (!label) return undefined;
  const trimmed = label.trim();
  if (trimmed.startsWith('ILON12')) return 'ILON12' as StatistiskLoenudviklingId;
  if (trimmed.startsWith('SBLON2')) return 'SBLON2' as StatistiskLoenudviklingId;
  return undefined;
};

const getRangeForManualRegulering = (
  baseIso: ISODateString | undefined,
  rows: ReadonlyArray<{ dato?: string | undefined }>
): ReguleringsRange => {
  const dates: ISODateString[] = [];
  if (baseIso) dates.push(baseIso);

  rows.forEach((row) => {
    const iso = parseDanishToISO(row.dato);
    if (iso) dates.push(iso);
  });

  if (dates.length === 0) return {};

  let min = dates[0];
  let max = dates[0];
  for (const iso of dates) {
    if (iso < min) min = iso;
    if (iso > max) max = iso;
  }

  const maxDate = parseISODate(max);
  if (!maxDate) {
    return { min };
  }

  const adjustedMax = formatToISO(addDays(addMonths(maxDate, 12), -1));
  return { min, max: adjustedMax };
};

const formatOverenskomstPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  const pct = Math.round(value * 10000) / 100;
  return formatPercent(pct);
};

const formatOverenskomstAmount = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return formatCurrency(value);
};

const formatInputPercent = (value: number | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return formatPercent(value);
};

const formatPercentFixed2 = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  return `${value.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
};

const formatIndexValue = (value: number): string => {
  return value.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatMaanederTrimmed = (value: number): string => {
  const rounded = Math.round(value * 10000) / 10000;
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};

const detectDecimalPlaces = (values: readonly number[], maxPlaces = 4): number => {
  let max = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    let places = 0;
    for (; places < maxPlaces; places += 1) {
      const scaled = value * 10 ** places;
      if (Math.abs(scaled - Math.round(scaled)) < 1e-9) break;
    }
    if (places > max) max = places;
  }
  return max;
};

const col = (header: string, align: 'left' | 'right' | 'center', width: number): StandardDisplayTableColumn => ({
  header,
  align,
  width,
});

const centeredCol = (header: string, width: number): StandardDisplayTableColumn => col(header, 'center', width);

type FormulaComponents = Readonly<{
  baseValue: number;
  feriePct: number;
  fritvalgPct: number;
  shSoPct: number;
  pensionPct: number;
  storeBededagPct: number;
}>;

type FormulaVisibility = Readonly<{
  showFritvalg: boolean;
  showShSo: boolean;
  showPension: boolean;
  showStoreBededag: boolean;
}>;

type ReguleringsPeriode = Readonly<{
  startIso: ISODateString;
  endIso?: ISODateString;
  components: FormulaComponents;
  visibility?: FormulaVisibility;
}>;

const parsePercentInput = (raw: string | undefined): number => {
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.replace('%', '').trim();
  if (trimmed === '') return 0;
  const cleaned = trimmed.replace(/\./g, '').replace(',', '.');
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

const percentFromDecimal = (value: number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 100;
};

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

const buildFormulaText = (components: FormulaComponents, visibility: FormulaVisibility): string => {
  const baseValue = Number.isFinite(components.baseValue) ? components.baseValue : 0;
  const feriePct = Number.isFinite(components.feriePct) ? components.feriePct : 0;
  const fritvalgPct = Number.isFinite(components.fritvalgPct) ? components.fritvalgPct : 0;
  const shSoPct = Number.isFinite(components.shSoPct) ? components.shSoPct : 0;
  const pensionPct = Number.isFinite(components.pensionPct) ? components.pensionPct : 0;
  const storeBededagPct = Number.isFinite(components.storeBededagPct) ? components.storeBededagPct : 0;

  const baseStr = formatCurrency(baseValue);
  const extraParts = [
    ...(feriePct !== 0 ? [formatPercent(feriePct)] : []),
    ...(visibility.showFritvalg && fritvalgPct !== 0 ? [formatPercent(fritvalgPct)] : []),
    ...(visibility.showShSo && shSoPct !== 0 ? [formatPercent(shSoPct)] : []),
    ...(visibility.showStoreBededag && storeBededagPct !== 0 ? [formatPercentFixed2(storeBededagPct)] : []),
  ];
  const hasMiddle = extraParts.length > 0;
  const middleParts = [formatPercent(100), ...extraParts];
  const middle = middleParts.join(' + ');
  if (visibility.showPension) {
    const pensionParts = [
      formatPercent(100),
      ...(pensionPct !== 0 ? [formatPercent(pensionPct)] : []),
    ];
    const pensionStr = pensionParts.join(' + ');
    return `${baseStr} x (${middle}) x (${pensionStr})`;
  }
  if (!hasMiddle) return baseStr;
  return `${baseStr} x (${middle})`;
};

const computeFormulaValue = (components: FormulaComponents): number => {
  const baseValue = Number.isFinite(components.baseValue) ? components.baseValue : 0;
  const feriePct = Number.isFinite(components.feriePct) ? components.feriePct : 0;
  const fritvalgPct = Number.isFinite(components.fritvalgPct) ? components.fritvalgPct : 0;
  const shSoPct = Number.isFinite(components.shSoPct) ? components.shSoPct : 0;
  const pensionPct = Number.isFinite(components.pensionPct) ? components.pensionPct : 0;
  const storeBededagPct = Number.isFinite(components.storeBededagPct) ? components.storeBededagPct : 0;
  const tillæg = feriePct + fritvalgPct + shSoPct + storeBededagPct;
  const factor = (1 + tillæg / 100) * (1 + pensionPct / 100);
  return baseValue * factor;
};

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
    current.setUTCDate(current.getUTCDate() + 1);
  }
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

    const start = createDate(year, month - 1, 1);
    const end = createDate(year, month, 0);
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

const parseOffentligDato = (value: string | undefined): ISODateString | undefined => {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') return undefined;
  const parsed = parseDanishDate(trimmed);
  if (!parsed) return undefined;
  return dateToISO(parsed);
};

const addWeekdayNonShDatesFromIsoRange = (
  set: Set<ISODateString>,
  range: Readonly<{ fra: ISODateString; til: ISODateString }>,
  shDays: ReadonlySet<ISODateString>
): void => {
  const start = isoDateToDate(range.fra);
  const end = isoDateToDate(range.til);
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

const buildExplicitFerieSet = (
  values: ErstatningsopgoerelseValues,
  shDays: ReadonlySet<ISODateString>
): ReadonlySet<ISODateString> => {
  const set = new Set<ISODateString>();
  const ferieRows = [...(values.ferieperioder ?? []), ...(values.fravaerPerioder ?? [])];
  for (const row of ferieRows) {
    const range = getIsoRange(row.fra, row.til);
    if (!range) continue;
    addWeekdayNonShDatesFromIsoRange(set, range, shDays);
  }
  return set;
};

const buildLoseFeriedageSet = (
  values: ErstatningsopgoerelseValues,
  shDays: ReadonlySet<ISODateString>,
  explicitFerie: ReadonlySet<ISODateString>
): ReadonlySet<ISODateString> => {
  const set = new Set<ISODateString>();
  const tafRows = values.tafPerioder ?? [];

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
      const dow = d.getUTCDay();
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
    const dow = d.getUTCDay();
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

const SYGEDAGPENGE_SH_CUTOFF = toISODateString('2012-07-02');

const isOffentligYdelseDatoMedregnet = (
  iso: ISODateString,
  dateObj: Date,
  shDays: ReadonlySet<ISODateString>,
  periodisering: Periodisering,
  ydelsestypeKey: string,
  rowTilISO: ISODateString
): boolean => {
  return isOffentligYdelseDatoMedregnetCentral({
    iso,
    dateObj,
    shDays,
    periodisering,
    ydelsestypeKey,
    rowTilISO,
    sygedagpengeShCutoff: SYGEDAGPENGE_SH_CUTOFF,
  });
};

const rangesOverlap = (
  aStart: ISODateString,
  aEnd: ISODateString | undefined,
  bStart: ISODateString,
  bEnd: ISODateString | undefined
): boolean => {
  const endA = aEnd ?? ('9999-12-31' as ISODateString);
  const endB = bEnd ?? ('9999-12-31' as ISODateString);
  const start = aStart > bStart ? aStart : bStart;
  const end = endA < endB ? endA : endB;
  return start <= end;
};

const findPeriodForDate = (periods: readonly ReguleringsPeriode[], iso: ISODateString): ReguleringsPeriode | undefined => {
  let candidate: ReguleringsPeriode | undefined;
  for (const period of periods) {
    if (period.startIso > iso) break;
    candidate = period;
  }
  return candidate ?? periods[0];
};

const calculateElapsedWholeMonths = (fromIso: ISODateString, toIso: ISODateString): number => {
  if (toIso <= fromIso) return 0;
  const fromDate = parseISODate(fromIso);
  const toDate = parseISODate(toIso);
  if (!fromDate || !toDate) return 0;

  let months =
    (toDate.getUTCFullYear() - fromDate.getUTCFullYear()) * 12 +
    (toDate.getUTCMonth() - fromDate.getUTCMonth());
  if (toDate.getUTCDate() < fromDate.getUTCDate()) {
    months -= 1;
  }

  return Math.max(0, months);
};

const getStatusIcon = (status: DebugStatus): React.ReactElement => {
  switch (status) {
    case 'error':
      return <ErrorOutline sx={{ color: 'red', fontSize: 20 }} />;
    case 'warning':
      return <WarningAmber sx={{ color: 'orange', fontSize: 20 }} />;
    case 'ok':
      return <Check sx={{ color: 'green', fontSize: 20 }} />;
  }
};

type IndkomstRow = Readonly<{
  id: string;
  label: string;
  displayValue: string;
  status: DebugStatus;
  value: number;
}>;

const EODebug = () => {
  const { getPersistedData, getLoenindkomstManuelReguleringInputErrors } = useFormPersistence();
  const { settings } = useAppSettings();
  const stamdataValues = React.useMemo(() => {
    return { ...STAMDATA_INITIAL_VALUES, ...(getPersistedData('stamdata') ?? {}) };
  }, [getPersistedData]);
  const erstatningsopgoerelseValues = React.useMemo(() => {
    return { ...createErstatningsopgoerelseInitialValues(), ...(getPersistedData('erstatningsopgoerelse') ?? {}) };
  }, [getPersistedData]);
  const manuelReguleringInputErrors = getLoenindkomstManuelReguleringInputErrors();

  const beregnesSvieSmerte = erstatningsopgoerelseValues.beregnesSvieSmerteGodtgoerelse === 'Ja';
  const beregnesTabtArbejdsfortjeneste = erstatningsopgoerelseValues.beregnesTabtArbejdsfortjeneste === 'Ja';
  const midlertidigtEetErSynlig = erstatningsopgoerelseValues.midlertidigtEetAfgorelse === 'Ja';
  const endeligtEetErSynlig = erstatningsopgoerelseValues.endeligtEetAfgorelse === 'Ja';

  const stamdataFieldErrors = useFormFieldErrorsBySource('stamdata');
  const erstatningsopgoerelseFieldErrors = useFormFieldErrorsBySource('erstatningsopgoerelse');

  // ============================================================================
  // EXECUTION CONTEXT
  // ============================================================================

  const ctx = React.useMemo<EODebugExecutionContext>(
    () => ({
      stamdataValues,
      stamdataErrors: stamdataFieldErrors,
      eoValues: erstatningsopgoerelseValues,
      eoErrors: erstatningsopgoerelseFieldErrors,
      loenindkomstManuelReguleringInputErrors: manuelReguleringInputErrors,
      appSettings: settings,
    }),
    [stamdataValues, stamdataFieldErrors, erstatningsopgoerelseValues, erstatningsopgoerelseFieldErrors, manuelReguleringInputErrors, settings]
  );

  // ============================================================================
  // GRUPPÉR ROWS PER SEKTION (BEVARER STRUKTUR)
  // ============================================================================

  const rowsBySection = React.useMemo(() => {
    const map = new Map<SectionId, DebugRowModel[]>();

    for (const entry of EO_DEBUG_BUILDERS) {
      map.set(entry.section, entry.run(ctx));
    }

    return map;
  }, [ctx]);
  const svieSmerteRows = rowsBySection.get('sviesmerte') ?? [];
  const svieSmerteOphoerRow = svieSmerteRows.find((row) => (row.id as string) === 'sviesmerte.ophoerSkyldes');
  const svieSmerteMainRows = svieSmerteRows.filter((row) => (row.id as string) !== 'sviesmerte.ophoerSkyldes');

  const {
    loenindkomstAnsaettelsesforhold,
    tafPerioder,
    vedroererPeriodeTil,
    ferieperioder,
  } = erstatningsopgoerelseValues;
  const { skadesdato, skadestype } = stamdataValues;

  const reguleringSections = React.useMemo(() => {
    const allowIncompleteOverenskomst = settings.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden;
    const overenskomstUdloebMaanederGraense = settings.allowReguleringMedUdloebMedMaaneder;

    const loenudviklingsKilde = resolveLoenudviklingKilde(erstatningsopgoerelseValues);

    return loenudviklingsKilde.map((af, index) => {
      const baseHeaderText = index === 0 ? 'Ansættelsesforhold' : `Ansættelsesforhold ${index + 1}`;
      const headerText = af.navnPaaArbejdssted ? `${baseHeaderText} (${af.navnPaaArbejdssted})` : baseHeaderText;

      const loenudviklingBasis = af.loenudviklingBeregningsgrundlag;

      const selectedValue = (() => {
        if (!loenudviklingBasis) return { display: 'Nej', ok: false };
        if (loenudviklingBasis === 'Ingen') return { display: 'Ingen', ok: true };
        if (loenudviklingBasis === 'Manuelt angivet') return { display: 'Manuelt angivet', ok: true };
        if (loenudviklingBasis === 'Overenskomst') {
          if (!af.overenskomstId) return { display: 'Nej', ok: false };
          const meta = getOverenskomstMetaById(af.overenskomstId);
          if (!meta) return { display: af.overenskomstId, ok: true };
          const loenPart = meta.loenmodtagerOrg[0] || '';
          const arbPart = meta.arbejdsgiverOrg[0] || '';
          return { display: `${meta.navn} (${loenPart} / ${arbPart})`, ok: true };
        }
        if (loenudviklingBasis === 'Statistik') {
          if (!af.loenudviklingStatistikModel) return { display: 'Nej', ok: false };
          return { display: af.loenudviklingStatistikModel, ok: true };
        }
        if (loenudviklingBasis === 'KRL satstabel') {
          if (!af.loenudviklingKRLSatstabel) return { display: 'Nej', ok: false };
          return { display: formatKRLSatstabelDisplay(af.loenudviklingKRLSatstabel), ok: true };
        }
        return { display: loenudviklingBasis, ok: true };
      })();

      const manuelReguleringNavnRaw =
        loenudviklingBasis === 'Manuelt angivet' && typeof af.loenudviklingManuelNavn === 'string'
          ? af.loenudviklingManuelNavn.trim()
          : '';
      const manuelReguleringNavnDisplay = manuelReguleringNavnRaw === '' ? '-' : manuelReguleringNavnRaw;
      const manuelReguleringNavnStatus: DebugStatus = manuelReguleringNavnRaw === '' ? 'warning' : 'ok';
      const hasManuelInputError =
        loenudviklingBasis === 'Manuelt angivet' && Boolean(manuelReguleringInputErrors[af.id]);

      const alleReguleringsvaerdierRow = (() => {
        if (loenudviklingBasis === 'Ingen') {
          return { display: 'Ingen', status: 'ok' as DebugStatus };
        }
        if (!loenudviklingBasis) {
          return { display: 'Nej', status: 'error' as DebugStatus };
        }
        if (loenudviklingBasis !== 'Manuelt angivet') {
          return { display: 'Ja', status: 'ok' as DebugStatus };
        }
        if (hasManuelInputError) {
          return { display: 'Ugyldig indtastning', status: 'error' as DebugStatus };
        }

        const manuelRows = af.loenudviklingManuelTableData ?? [];
        const aktiveRows = manuelRows.filter((row) => {
          const dato = row.dato ?? '';
          const feriepenge = row.feriepenge ?? '';
          const shSoSats = row.shSoSats ?? '';
          const fritvalg = row.fritvalg ?? '';
          const agPension = row.agPension ?? '';
          return (
            dato.trim() !== '' ||
            feriepenge.trim() !== '' ||
            shSoSats.trim() !== '' ||
            fritvalg.trim() !== '' ||
            agPension.trim() !== '' ||
            row.grundloen !== undefined
          );
        });

        if (aktiveRows.length === 0) {
          return { display: 'Nej', status: 'error' as DebugStatus };
        }

        const grundloenOk = aktiveRows.every((row) => row.grundloen !== undefined);

        const supplementFields = [
          'feriepenge',
          'shSoSats',
          'fritvalg',
          'agPension',
        ] as const;

        const usedSupplements = supplementFields.filter((field) =>
          aktiveRows.some((row) => (row[field] ?? '').trim() !== '')
        );
        const supplementsOk = usedSupplements.every((field) =>
          aktiveRows.every((row) => (row[field] ?? '').trim() !== '')
        );

        const ok = grundloenOk && supplementsOk;
        return { display: ok ? 'Ja' : 'Nej', status: ok ? 'ok' : 'error' as DebugStatus };
      })();

      const showReguleringDetails =
        selectedValue.ok &&
        alleReguleringsvaerdierRow.status === 'ok' &&
        alleReguleringsvaerdierRow.display === 'Ja';

      const skadesdatoIso = isISODateString(skadesdato) ? skadesdato : undefined;
      const saerligDato = isISODateString(af.saerligFraDatoRegulering) ? af.saerligFraDatoRegulering : undefined;
      const angivetLoenDato = getAngivetLoenOpreguleresFraDato(erstatningsopgoerelseValues);
      const reguleringsdato = erstatningsopgoerelseValues.beregnesUdFra !== 'Beregningsperiode'
        ? (angivetLoenDato ?? skadesdatoIso)
        : (saerligDato ?? skadesdatoIso);
      const reguleringsdatoDisplay = formatIsoValue(reguleringsdato);
      const reguleringsdatoLabel = (() => {
        if (erstatningsopgoerelseValues.beregnesUdFra !== 'Beregningsperiode' && angivetLoenDato) {
          const loenLabel = erstatningsopgoerelseValues.beregnesUdFra === 'Angivet månedsløn' ? 'månedsløn' : 'dagsløn';
          return `Reguleringsdato (Angivet ${loenLabel}, angivet reguleringsdato)`;
        }
        if (erstatningsopgoerelseValues.beregnesUdFra === 'Beregningsperiode' && saerligDato) {
          return 'Reguleringsdato (Beregningsperiode, angivet reguleringsdato)';
        }
        return 'Reguleringsdato (Skadesdato)';
      })();
      const reguleringsdatoStatus: DebugStatus = reguleringsdatoDisplay === '-' ? 'error' : 'ok';

      const periodeTil = isISODateString(vedroererPeriodeTil)
        ? vedroererPeriodeTil
        : undefined;
      const periodeFra = isISODateString(erstatningsopgoerelseValues.vedroererPeriodeFra)
        ? erstatningsopgoerelseValues.vedroererPeriodeFra
        : undefined;
      const periodeTilDisplay = formatIsoValue(periodeTil);
      const periodeTilStatus: DebugStatus = periodeTilDisplay === '-' ? 'error' : 'ok';

      const sidsteTafDatoISkadetPeriode = (() => {
        if (!periodeTil) return undefined;
        const periodRange = periodeFra && periodeFra <= periodeTil ? { fra: periodeFra, til: periodeTil } : null;

        let latest: ISODateString | undefined = undefined;
        for (const row of tafPerioder ?? []) {
          if (!isISODateString(row.fra) || !isISODateString(row.til)) continue;
          if (row.fra > row.til) continue;

          if (periodRange) {
            if (row.til < periodRange.fra || row.fra > periodRange.til) continue;
            const candidate = row.til > periodRange.til ? periodRange.til : row.til;
            if (!latest || candidate > latest) latest = candidate;
            continue;
          }

          if (!latest || row.til > latest) latest = row.til;
        }

        return latest;
      })();

      const foersteTafDatoISkadetPeriode = (() => {
        if (!periodeTil) return undefined;
        const periodRange = periodeFra && periodeFra <= periodeTil ? { fra: periodeFra, til: periodeTil } : null;

        let earliest: ISODateString | undefined = undefined;
        for (const row of tafPerioder ?? []) {
          if (!isISODateString(row.fra) || !isISODateString(row.til)) continue;
          if (row.fra > row.til) continue;

          if (periodRange) {
            if (row.til < periodRange.fra || row.fra > periodRange.til) continue;
            const candidate = row.fra < periodRange.fra ? periodRange.fra : row.fra;
            if (!earliest || candidate < earliest) earliest = candidate;
            continue;
          }

          if (!earliest || row.fra < earliest) earliest = row.fra;
        }

        return earliest;
      })();

      const sidsteTafDatoDisplay = formatIsoValue(sidsteTafDatoISkadetPeriode);
      const sidsteTafDatoStatus: DebugStatus = sidsteTafDatoDisplay === '-' ? 'error' : 'ok';
      const foersteTafDatoDisplay = formatIsoValue(foersteTafDatoISkadetPeriode);
      const foersteTafDatoStatus: DebugStatus = foersteTafDatoDisplay === '-' ? 'error' : 'ok';
      const tafStartIso = foersteTafDatoISkadetPeriode;
      const tafEndIso = sidsteTafDatoISkadetPeriode;

      const reguleringsRange = (() => {
        if (loenudviklingBasis === 'Overenskomst') {
          const interval = getReguleringsDatoIntervalForOverenskomst(af.overenskomstId ?? '');
          if (!interval) return {};
          return {
            min: parseDanishToISO(interval.fraDato),
            max: parseDanishToISO(interval.tilDato),
          };
        }
        if (loenudviklingBasis === 'Statistik') {
          const interval = getReguleringsDatoIntervalForStatistikModel(af.loenudviklingStatistikModel ?? '');
          if (!interval) return {};
          return {
            min: parseDanishToISO(interval.fraDato),
            max: parseDanishToISO(interval.tilDato),
          };
        }
        if (loenudviklingBasis === 'Manuelt angivet') {
          return getRangeForManualRegulering(reguleringsdato, af.loenudviklingManuelTableData);
        }
        if (loenudviklingBasis === 'KRL satstabel') {
          const krlId = af.loenudviklingKRLSatstabel as KRLSatstabelId | undefined;
          if (!krlId) return {};
          const interval = getReguleringsDatoIntervalForKRL(krlId);
          if (!interval) return {};
          return {
            min: parseDanishToISO(interval.fraDato),
            max: parseDanishToISO(interval.tilDato),
          };
        }
        return {};
      })();

      const startDateRow = (() => {
        if (!foersteTafDatoISkadetPeriode || !reguleringsRange.min) {
          return { display: '-', status: 'error' as DebugStatus };
        }
        return reguleringsRange.min <= foersteTafDatoISkadetPeriode
          ? { display: 'Ja', status: 'ok' as DebugStatus }
          : {
              display: `Nej (først fra ${formatIsoValue(reguleringsRange.min)})`,
              status: allowIncompleteOverenskomst ? 'warning' as DebugStatus : 'error' as DebugStatus,
            };
      })();

      const endDateRow = (() => {
        if (!sidsteTafDatoISkadetPeriode || !reguleringsRange.max) {
          return { display: '-', status: 'error' as DebugStatus };
        }
        if (reguleringsRange.max >= sidsteTafDatoISkadetPeriode) {
          return { display: 'Ja', status: 'ok' as DebugStatus };
        }

        const maanederSidenUdloeb = calculateElapsedWholeMonths(reguleringsRange.max, sidsteTafDatoISkadetPeriode);
        if (maanederSidenUdloeb < overenskomstUdloebMaanederGraense) {
          return {
            display: `(< ${overenskomstUdloebMaanederGraense} måneder)`,
            status: 'ok' as DebugStatus,
          };
        }

        return {
          display: `Nej (kun indtil ${formatIsoValue(reguleringsRange.max)})`,
          status: allowIncompleteOverenskomst ? 'warning' as DebugStatus : 'error' as DebugStatus,
        };
      })();


      const baseIndex = (() => {
        if (!reguleringsdato) return null;
        if (loenudviklingBasis === 'Overenskomst') {
          if (!af.overenskomstId) return null;
          const offentligSelection = resolveOffentligLoenSelection(af);
          if (offentligSelection) {
            const reguleringsdatoDanish = isoToDanish(reguleringsdato);
            if (!reguleringsdatoDanish) return null;
            const resultat = getOffentligLoenForDato(
              offentligSelection.overenskomstType,
              reguleringsdatoDanish,
              offentligSelection.loentrin,
              offentligSelection.loengruppe
            );
            if (!resultat) return null;
            const baseValue =
              offentligSelection.loenType === 'maanedsLoen' ? resultat.maanedsLoen : resultat.timeLoen;
            return {
              components: {
                baseValue,
                feriePct: 0,
                fritvalgPct: 0,
                shSoPct: 0,
                pensionPct: 0,
                storeBededagPct: 0,
              },
              visibility: {
                showFritvalg: false,
                showShSo: false,
                showPension: false,
                showStoreBededag: false,
              },
            };
          }
          const overenskomstRef = resolveOverenskomstRef(af.overenskomstId);
          if (!overenskomstRef) return null;
          const reguleringsdatoDanish = isoToDanish(reguleringsdato);
          if (!reguleringsdatoDanish) return null;
          const applyAlmindeligLoenPaaShDageRegel =
            af.loenPaaHelligdage === loenPaaHelligdageSchema.enum['Almindelig løn'];
          const sats = getEffektiveSatserForDato({
            overenskomstId: overenskomstRef.baseId,
            dato: reguleringsdatoDanish,
            applyAlmindeligLoenPaaShDageRegel,
          });
          if (!sats) return null;
          const allSatser = getOverenskomst(overenskomstRef.baseId)?.satser ?? [];
          const hasShSo = allSatser.some((entry) => entry.shSoSats !== null);
          const hasFritvalg = allSatser.some((entry) => entry.fritvalg !== null);
          const hasAgPension = allSatser.some((entry) => entry.agPension !== null);
          return {
            components: {
              baseValue: sats.grundloen ?? 0,
              feriePct: typeof af.feriePct === 'number' ? af.feriePct : 0,
              fritvalgPct: percentFromDecimal(sats.fritvalg),
              shSoPct: percentFromDecimal(sats.shSoSats),
              pensionPct: percentFromDecimal(sats.agPension),
              storeBededagPct: 0,
            },
            visibility: {
              showFritvalg: hasFritvalg,
              showShSo: hasShSo,
              showPension: hasAgPension,
              showStoreBededag: false,
            },
          };
        }
        if (loenudviklingBasis === 'Manuelt angivet') {
          const baseRow = (af.loenudviklingManuelTableData ?? [])[0];
          if (!baseRow) return null;
          return {
            components: {
              baseValue: parseAmount(baseRow.grundloen),
              feriePct: typeof af.feriePct === 'number' ? af.feriePct : 0,
              fritvalgPct: parsePercentInput(baseRow.fritvalg),
              shSoPct: parsePercentInput(baseRow.shSoSats),
              pensionPct: parsePercentInput(baseRow.agPension),
              storeBededagPct: 0,
            },
            visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
          };
        }
        if (loenudviklingBasis === 'Statistik') {
          const modelLabel = af.loenudviklingStatistikModel ?? '';
          if (modelLabel.trim() === '') return null;
          if (modelLabel.trim().startsWith('ASL-')) {
            const start = parseISODate(reguleringsdato);
            if (!start) return null;
            const value = aarsloenMax[start.getUTCFullYear() as keyof typeof aarsloenMax];
            if (typeof value !== 'number') return null;
            return {
              components: {
                baseValue: value,
                feriePct: typeof af.feriePct === 'number' ? af.feriePct : 0,
                fritvalgPct: typeof af.fritvalgPct === 'number' ? af.fritvalgPct : 0,
                shSoPct: typeof af.shSoPct === 'number' ? af.shSoPct : 0,
                pensionPct: typeof af.pensionPct === 'number' ? af.pensionPct : 0,
                storeBededagPct: 0,
              },
              visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
            };
          }
          const modelId = resolveStatistikModelIdFromLabel(modelLabel);
          if (!modelId) return null;
          const model = getStatistiskLoenudvikling(modelId);
          if (!model) return null;
          const periodStarts = model.indeksvaerdier
            .map((value) => {
              const match = value.kvartal.match(/^(\d{4})K([1-4])$/);
              if (!match) return null;
              const year = Number(match[1]);
              const quarter = Number(match[2]);
              if (!Number.isFinite(year) || !Number.isFinite(quarter)) return null;
              const month = (quarter - 1) * 3;
              const startIso = formatToISO(createDate(year, month, 1));
              if (!startIso) return null;
              return { startIso, indeks: value.indeksvaerdi };
            })
            .filter((row): row is Readonly<{ startIso: ISODateString; indeks: number }> => Boolean(row))
            .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
          if (periodStarts.length === 0) return null;
          let candidate = periodStarts[0];
          for (const period of periodStarts) {
            if (period.startIso > reguleringsdato) break;
            candidate = period;
          }
          return {
            components: {
              baseValue: candidate.indeks,
              feriePct: typeof af.feriePct === 'number' ? af.feriePct : 0,
              fritvalgPct: typeof af.fritvalgPct === 'number' ? af.fritvalgPct : 0,
              shSoPct: typeof af.shSoPct === 'number' ? af.shSoPct : 0,
              pensionPct: typeof af.pensionPct === 'number' ? af.pensionPct : 0,
              storeBededagPct: 0,
            },
            visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
          };
        }
        if (loenudviklingBasis === 'KRL satstabel') {
          const krlId = af.loenudviklingKRLSatstabel as KRLSatstabelId | undefined;
          if (!krlId) return null;
          const tabel = getKRLSatstabel(krlId);
          if (!tabel || tabel.vaerdier.length === 0) return null;
          const periodStarts = tabel.vaerdier
            .map((v) => {
              const startIso = parseDanishToISO(v.fraDato);
              if (!startIso) return null;
              return { startIso, reguleringsPct: v.reguleringsPct };
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
            .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
          if (periodStarts.length === 0) return null;
          let candidate = periodStarts[0];
          for (const period of periodStarts) {
            if (period.startIso > reguleringsdato) break;
            candidate = period;
          }
          return {
            components: {
              baseValue: 100 + candidate.reguleringsPct,
              feriePct: 0,
              fritvalgPct: 0,
              shSoPct: 0,
              pensionPct: 0,
              storeBededagPct: 0,
            },
            visibility: { showFritvalg: false, showShSo: false, showPension: false, showStoreBededag: false },
          };
        }
        return null;
      })();

      const reguleringsvaerdiRow = (() => {
        if (!reguleringsdato) {
          return { display: '-', status: 'error' as DebugStatus };
        }
        if (!baseIndex) {
          return {
            display: reguleringsRange.min
              ? `Nej (først fra ${formatIsoValue(reguleringsRange.min)})`
              : 'Nej',
            status: allowIncompleteOverenskomst ? 'warning' as DebugStatus : 'error' as DebugStatus,
          };
        }
        return { display: 'Ja', status: 'ok' as DebugStatus };
      })();

      const indeksTable = (() => {
        if (!loenudviklingBasis || loenudviklingBasis === 'Ingen') return null;
        if (!tafStartIso) return null;
        if (!tafEndIso) return null;
        if (tafStartIso > tafEndIso) return null;
        if (!baseIndex) return null;
        // Bevidst forskel: Indeks-tabellen følger altid TAF-start (ikke reguleringsdato).

        const feriePct = typeof af.feriePct === 'number' ? af.feriePct : 0;
        const tafRanges = (tafPerioder ?? [])
          .map((row) => getIsoRange(row.fra, row.til))
          .filter((range): range is Readonly<{ fra: ISODateString; til: ISODateString }> => Boolean(range));

        const applyAlmindeligLoenPaaShDageRegel = af.loenPaaHelligdage === loenPaaHelligdageSchema.enum['Almindelig løn']

        const periods: ReguleringsPeriode[] = (() => {
          if (loenudviklingBasis === 'Overenskomst') {
            if (!af.overenskomstId) return [];
            const offentligSelection = resolveOffentligLoenSelection(af);
            if (offentligSelection) {
              const fraDato = isoToDanish(tafStartIso);
              const tilDato = isoToDanish(tafEndIso);
              if (!fraDato || !tilDato) return [];

              const satser = getOffentligLoenForPeriode(
                offentligSelection.overenskomstType,
                fraDato,
                tilDato,
                offentligSelection.loentrin,
                offentligSelection.loengruppe
              );

              const periodStarts = satser
                .map((sats) => {
                  const startIso = parseDanishToISO(sats.effectiveDate);
                  if (!startIso) return null;
                  const baseValue =
                    offentligSelection.loenType === 'maanedsLoen' ? sats.maanedsLoen : sats.timeLoen;
                  const components: FormulaComponents = {
                    baseValue,
                    feriePct: 0,
                    fritvalgPct: 0,
                    shSoPct: 0,
                    pensionPct: 0,
                    storeBededagPct: 0,
                  };
                  return { startIso, components };
                })
                .filter((row): row is Readonly<{ startIso: ISODateString; components: FormulaComponents }> => Boolean(row))
                .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));

              const visibility: FormulaVisibility = {
                showFritvalg: false,
                showShSo: false,
                showPension: false,
                showStoreBededag: false,
              };

              return periodStarts.map((period, index) => ({
                ...period,
                visibility,
                endIso: index < periodStarts.length - 1 ? subtractOneDay(periodStarts[index + 1]?.startIso) : tafEndIso,
              }));
            }
            const ref = resolveOverenskomstRef(af.overenskomstId);
            if (!ref) return [];
            const fraDato = isoToDanish(tafStartIso);
            const tilDato = isoToDanish(tafEndIso);
            if (!fraDato || !tilDato) return [];

            const satser = getEffektiveSatserForPeriode({
              overenskomstId: ref.baseId,
              fraDato,
              tilDato,
              applyAlmindeligLoenPaaShDageRegel,
            });

            const allSatser = getOverenskomst(ref.baseId)?.satser ?? satser;
            const hasShSo = allSatser.some((sats) => sats.shSoSats !== null);
            const hasFritvalg = allSatser.some((sats) => sats.fritvalg !== null);
            const hasAgPension = allSatser.some((sats) => sats.agPension !== null);

            const periodStarts = satser
              .map((sats) => {
                const startIso = parseDanishToISO(sats.fraDato);
                if (!startIso) return null;
                const components: FormulaComponents = {
                  baseValue: sats.grundloen ?? 0,
                  feriePct,
                  fritvalgPct: percentFromDecimal(sats.fritvalg),
                  shSoPct: percentFromDecimal(sats.shSoSats),
                  pensionPct: percentFromDecimal(sats.agPension),
                  storeBededagPct: 0,
                };
                return { startIso, components };
              })
              .filter((row): row is Readonly<{ startIso: ISODateString; components: FormulaComponents }> => Boolean(row))
              .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));

            const applyStoreBededagRegulering =
              applyAlmindeligLoenPaaShDageRegel && tafStartIso < STORE_BEDEDAG_START && tafEndIso >= STORE_BEDEDAG_START;

            if (applyStoreBededagRegulering) {
              const baseForStore = [...periodStarts]
                .filter((period) => period.startIso <= STORE_BEDEDAG_START)
                .sort((a, b) => (a.startIso < b.startIso ? 1 : -1))[0];
              if (baseForStore && !periodStarts.some((p) => p.startIso === STORE_BEDEDAG_START)) {
                periodStarts.push({
                  startIso: STORE_BEDEDAG_START,
                  components: {
                    ...baseForStore.components,
                    storeBededagPct: STORE_BEDEDAG_PCT,
                  },
                });
              }
              const updated = periodStarts.map((period) => {
                if (period.startIso < STORE_BEDEDAG_START) return period;
                return {
                  ...period,
                  components: {
                    ...period.components,
                    storeBededagPct: STORE_BEDEDAG_PCT,
                  },
                };
              });
              periodStarts.length = 0;
              periodStarts.push(...updated);
              periodStarts.sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
            }

              const visibility: FormulaVisibility = {
                showFritvalg: hasFritvalg,
                showShSo: hasShSo,
                showPension: hasAgPension,
                showStoreBededag: applyStoreBededagRegulering,
              };

            return periodStarts.map((period, index) => ({
              ...period,
              visibility,
              endIso: index < periodStarts.length - 1 ? subtractOneDay(periodStarts[index + 1]?.startIso) : tafEndIso,
            }));
          }

            if (loenudviklingBasis === 'Manuelt angivet') {
              const rows = af.loenudviklingManuelTableData ?? [];
              const baseRow = rows[0];
              const baseComponents: FormulaComponents = {
                baseValue: parseAmount(baseRow?.grundloen),
                feriePct,
                fritvalgPct: parsePercentInput(baseRow?.fritvalg),
                shSoPct: parsePercentInput(baseRow?.shSoSats),
                pensionPct: parsePercentInput(baseRow?.agPension),
                storeBededagPct: 0,
              };

              const periodStarts = [
                { startIso: tafStartIso, components: baseComponents },
                ...rows.slice(1).map((row) => {
                  const startIso = parseDanishToISO(row.dato);
                  if (!startIso) return null;
                  if (startIso < tafStartIso) return null;
                  if (tafEndIso && startIso > tafEndIso) return null;
                  const components: FormulaComponents = {
                    baseValue: parseAmount(row.grundloen),
                    feriePct,
                    fritvalgPct: parsePercentInput(row.fritvalg),
                    shSoPct: parsePercentInput(row.shSoSats),
                    pensionPct: parsePercentInput(row.agPension),
                    storeBededagPct: 0,
                  };
                  return { startIso, components };
                }),
              ]
                .filter((row): row is Readonly<{ startIso: ISODateString; components: FormulaComponents }> => Boolean(row))
                .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));

              const applyStoreBededagRegulering =
                applyAlmindeligLoenPaaShDageRegel && tafStartIso < STORE_BEDEDAG_START && tafEndIso >= STORE_BEDEDAG_START;

              if (applyStoreBededagRegulering) {
                const baseForStore = [...periodStarts]
                  .filter((period) => period.startIso <= STORE_BEDEDAG_START)
                  .sort((a, b) => (a.startIso < b.startIso ? 1 : -1))[0];
                if (baseForStore && !periodStarts.some((p) => p.startIso === STORE_BEDEDAG_START)) {
                  periodStarts.push({
                    startIso: STORE_BEDEDAG_START,
                    components: {
                      ...baseForStore.components,
                      storeBededagPct: STORE_BEDEDAG_PCT,
                    },
                  });
                }
                const updated = periodStarts.map((period) => {
                  if (period.startIso < STORE_BEDEDAG_START) return period;
                  return {
                    ...period,
                    components: {
                      ...period.components,
                      storeBededagPct: STORE_BEDEDAG_PCT,
                    },
                  };
                });
                periodStarts.length = 0;
                periodStarts.push(...updated);
                periodStarts.sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
              }

              return periodStarts.map((period, index) => ({
                ...period,
                visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: applyStoreBededagRegulering },
                endIso: index < periodStarts.length - 1 ? subtractOneDay(periodStarts[index + 1]?.startIso) : tafEndIso,
              }));
            }

          if (loenudviklingBasis === 'Statistik') {
            const fritvalgPct = typeof af.fritvalgPct === 'number' ? af.fritvalgPct : 0;
            const shSoPct = typeof af.shSoPct === 'number' ? af.shSoPct : 0;
            const pensionPct = typeof af.pensionPct === 'number' ? af.pensionPct : 0;

            const modelLabel = af.loenudviklingStatistikModel ?? '';
            if (modelLabel.trim() === '') return [];

            if (modelLabel.trim().startsWith('ASL-')) {
              const start = parseISODate(tafStartIso);
              const end = parseISODate(tafEndIso);
              if (!start || !end) return [];
              const startYear = start.getUTCFullYear();
              const endYear = end.getUTCFullYear();

              const periodStarts: Array<{ startIso: ISODateString; components: FormulaComponents }> = [];
              for (let year = startYear; year <= endYear; year += 1) {
                const value = aarsloenMax[year as keyof typeof aarsloenMax];
                if (typeof value !== 'number') continue;
                const startIso = formatToISO(createDate(year, 0, 1));
                if (!startIso) continue;
                periodStarts.push({
                  startIso,
                  components: {
                    baseValue: value,
                    feriePct,
                    fritvalgPct,
                    shSoPct,
                    pensionPct,
                    storeBededagPct: 0,
                  },
                });
              }

              return periodStarts
                .sort((a, b) => (a.startIso < b.startIso ? -1 : 1))
                  .map((period, index) => ({
                    ...period,
                    visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
                    endIso: index < periodStarts.length - 1 ? subtractOneDay(periodStarts[index + 1]?.startIso) : tafEndIso,
                  }));
              }

            const modelId = resolveStatistikModelIdFromLabel(modelLabel);
            if (!modelId) return [];
            const model = getStatistiskLoenudvikling(modelId);
            if (!model) return [];

            const periodStarts = model.indeksvaerdier
              .map((value) => {
                const match = value.kvartal.match(/^(\d{4})K([1-4])$/);
                if (!match) return null;
                const year = Number(match[1]);
                const quarter = Number(match[2]);
                if (!Number.isFinite(year) || !Number.isFinite(quarter)) return null;
                const month = (quarter - 1) * 3;
                const startIso = formatToISO(createDate(year, month, 1));
                if (!startIso) return null;
                return {
                  startIso,
                  components: {
                    baseValue: value.indeksvaerdi,
                    feriePct,
                    fritvalgPct,
                    shSoPct,
                    pensionPct,
                    storeBededagPct: 0,
                  },
                };
              })
              .filter((row): row is Readonly<{ startIso: ISODateString; components: FormulaComponents }> => Boolean(row))
              .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));

            return periodStarts.map((period, index) => ({
              ...period,
              visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
              endIso: index < periodStarts.length - 1 ? subtractOneDay(periodStarts[index + 1]?.startIso) : tafEndIso,
            }));
          }

          if (loenudviklingBasis === 'KRL satstabel') {
            const krlId = af.loenudviklingKRLSatstabel as KRLSatstabelId | undefined;
            if (!krlId) return [];
            const tabel = getKRLSatstabel(krlId);
            if (!tabel || tabel.vaerdier.length === 0) return [];
            const periodStarts = tabel.vaerdier
              .map((v) => {
                const startIso = parseDanishToISO(v.fraDato);
                if (!startIso) return null;
                return {
                  startIso,
                  components: {
                    baseValue: 100 + v.reguleringsPct,
                    feriePct: 0,
                    fritvalgPct: 0,
                    shSoPct: 0,
                    pensionPct: 0,
                    storeBededagPct: 0,
                  },
                };
              })
              .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
              .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
            return periodStarts.map((period, index) => ({
              ...period,
              visibility: { showFritvalg: false, showShSo: false, showPension: false, showStoreBededag: false },
              endIso: index < periodStarts.length - 1 ? subtractOneDay(periodStarts[index + 1]?.startIso) : tafEndIso,
            }));
          }

          return [];
        })();

        const baseComponents: FormulaComponents = baseIndex.components;
        const baseVisibility: FormulaVisibility = baseIndex.visibility;
        const isStatistik = loenudviklingBasis === 'Statistik';
        const isKRL = loenudviklingBasis === 'KRL satstabel';
        const isSimpleIndex = isStatistik || isKRL;
        const statistikModelLabel = af.loenudviklingStatistikModel ?? '';
        const isAslModel = isStatistik && statistikModelLabel.trim().startsWith('ASL-');
        const statDecimalPlaces = (() => {
          if (isKRL) return 4;
          if (!isStatistik || isAslModel) return 2;
          const modelId = resolveStatistikModelIdFromLabel(statistikModelLabel);
          if (!modelId) return 2;
          const model = getStatistiskLoenudvikling(modelId);
          if (!model) return 2;
          return detectDecimalPlaces(model.indeksvaerdier.map((value) => value.indeksvaerdi));
        })();
        const formatStatValue = isAslModel
          ? formatCurrency
          : (value: number) => value.toLocaleString('da-DK', { minimumFractionDigits: statDecimalPlaces, maximumFractionDigits: statDecimalPlaces });

        const baseValueRaw = isSimpleIndex ? baseComponents.baseValue : computeFormulaValue(baseComponents);
        const baseFormula = isSimpleIndex ? formatStatValue(baseValueRaw) : buildFormulaText(baseComponents, baseVisibility);
        const basePeriod = findPeriodForDate(periods, tafStartIso);
        const basePeriodComponents = basePeriod?.components ?? baseComponents;
        const basePeriodVisibility = basePeriod?.visibility ?? baseVisibility;
        const basePeriodValueRaw = isSimpleIndex ? basePeriodComponents.baseValue : computeFormulaValue(basePeriodComponents);
        const basePeriodFormula = isSimpleIndex
          ? formatStatValue(basePeriodValueRaw)
          : buildFormulaText(basePeriodComponents, basePeriodVisibility);

        // Byg SH-dage og feriedage set for beregning af arbejdsdage
        const eoRange = tafEndIso ? { fra: tafStartIso, til: tafEndIso } : null;
        const shDageSet = eoRange ? buildSHDageSet(eoRange.fra, eoRange.til) : new Set<ISODateString>();
        const ferieDageSet = eoRange
          ? buildFerieDageSet({ ferieperioder, tafPerioder }, shDageSet, eoRange.fra, eoRange.til)
          : new Set<ISODateString>();

        const sortedPeriods = periods
          .filter((period) => period.startIso > tafStartIso)
          .filter((period) => !tafEndIso || period.startIso <= tafEndIso);

        // Beregn arbejdsdage og måneder for base-periode
        const baseEndIso = sortedPeriods.length > 0 ? subtractOneDay(sortedPeriods[0].startIso) : tafEndIso;
        const baseStats = baseEndIso && tafEndIso
          ? beregnArbejdsdageOgMaaneder(tafStartIso, baseEndIso, shDageSet, ferieDageSet)
          : { arbejdsdage: 0, maaneder: 0 };

        const isSameNumericValue = (left: number, right: number): boolean =>
          Math.abs(left - right) < 1e-9;
        const buildIndexFormulaDisplay = (
          numeratorDisplay: string,
          denominatorDisplay: string,
          numeratorValue: number,
          denominatorValue: number
        ): string => {
          const isPlainValue = isSimpleIndex || (!numeratorDisplay.includes(' x ') && !denominatorDisplay.includes(' x '));
          if (isSameNumericValue(numeratorValue, denominatorValue)) {
            return isPlainValue ? numeratorDisplay : `(${numeratorDisplay})`;
          }
          return isPlainValue
            ? `${numeratorDisplay} / ${denominatorDisplay}`
            : `(${numeratorDisplay}) /\n(${denominatorDisplay})`;
        };

        const rows: StandardDisplayTableRow[] = [
          {
            key: `regulering-indeks-${af.id}-base`,
            cells: [
              formatIsoValue(tafStartIso),
              baseEndIso ? formatIsoValue(baseEndIso) : '-',
              baseStats.arbejdsdage.toString(),
              formatMaanederTrimmed(baseStats.maaneder),
              buildIndexFormulaDisplay(basePeriodFormula, baseFormula, basePeriodValueRaw, baseValueRaw),
              baseValueRaw > 0 ? formatIndexValue((basePeriodValueRaw / baseValueRaw) * 100) : '-'
            ],
          },
        ];

        for (let i = 0; i < sortedPeriods.length; i++) {
          const period = sortedPeriods[i];
          const hasTafOverlap = tafRanges.some((range) => rangesOverlap(period.startIso, period.endIso, range.fra, range.til));
          if (!hasTafOverlap) continue;

          const periodVisibility = period.visibility ?? { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false };
          const valueRaw = isSimpleIndex ? period.components.baseValue : computeFormulaValue(period.components);
          const formula = buildFormulaText(period.components, periodVisibility);
          const displayFormula = buildIndexFormulaDisplay(
            isSimpleIndex ? formatStatValue(valueRaw) : formula,
            baseFormula,
            valueRaw,
            baseValueRaw
          );
          const indexValue = baseValueRaw > 0 ? formatIndexValue((valueRaw / baseValueRaw) * 100) : '-';

          // Beregn arbejdsdage og måneder for denne periode
            const periodEndIso = i < sortedPeriods.length - 1 ? subtractOneDay(sortedPeriods[i + 1].startIso) : tafEndIso;
            const periodStats = periodEndIso && tafEndIso
              ? beregnArbejdsdageOgMaaneder(period.startIso, periodEndIso, shDageSet, ferieDageSet)
              : { arbejdsdage: 0, maaneder: 0 };

          rows.push({
            key: `regulering-indeks-${af.id}-${period.startIso}`,
            cells: [
              formatIsoValue(period.startIso),
              periodEndIso ? formatIsoValue(periodEndIso) : '-',
              periodStats.arbejdsdage.toString(),
              formatMaanederTrimmed(periodStats.maaneder),
              displayFormula,
              indexValue
            ],
          });
        }

        const columns: StandardDisplayTableColumn[] = [
          centeredCol('Fra-dato', 120),
          centeredCol('Til-dato', 120),
          centeredCol('Arbejdsdage', 100),
          centeredCol('Måneder', 100),
          {
            ...centeredCol('Indeksberegning', 520),
            cellSx: {
              whiteSpace: 'pre-line',
              wordBreak: 'break-word',
            },
          },
          centeredCol('Indeks', 120),
        ];

        return { columns, rows };
      })();

      const reguleringTable = (() => {
        if (!loenudviklingBasis || loenudviklingBasis === 'Ingen') return null;
        if (!tafStartIso || !tafEndIso) return null;
        if (tafStartIso > tafEndIso) return null;
        if (!baseIndex) return null;
        // Bevidst forskel: Reguleringstabellen (satser) må starte tidligere end TAF ved tidlig reguleringsdato.
        const reguleringTableStartIso = resolveReguleringTableStartIso(reguleringsdato, tafStartIso);

        if (loenudviklingBasis === 'Overenskomst') {
            const offentligSelection = resolveOffentligLoenSelection(af);
            if (offentligSelection) {
              const fraDato = isoToDanish(reguleringTableStartIso);
              const tilDato = isoToDanish(tafEndIso);
              if (!fraDato || !tilDato) return null;

              const baseResult = getOffentligLoenForDato(
                offentligSelection.overenskomstType,
                fraDato,
                offentligSelection.loentrin,
                offentligSelection.loengruppe
              );
              if (!baseResult) return null;

              const satser = getOffentligLoenForPeriode(
                offentligSelection.overenskomstType,
                fraDato,
                tilDato,
                offentligSelection.loentrin,
                offentligSelection.loengruppe
              );

              const columns: StandardDisplayTableColumn[] = [
                centeredCol('Fra-dato', 120),
                centeredCol('Månedsløn', 120),
                centeredCol('Timeløn', 120),
              ];

              const rows: StandardDisplayTableRow[] = [];
              const addRow = (labelIso: ISODateString, maanedsLoen: number, timeLoen: number) => {
                rows.push({
                  key: `ok-offentlig-${af.id}-${labelIso}`,
                  cells: [
                    isoToDanish(labelIso) ?? labelIso,
                    formatCurrency(maanedsLoen),
                    formatCurrency(timeLoen),
                  ],
                });
              };

              addRow(reguleringTableStartIso, baseResult.maanedsLoen, baseResult.timeLoen);

              const laterSatser = satser
                .map((entry) => {
                  const iso = parseDanishToISO(entry.effectiveDate);
                  if (!iso) return null;
                  return { iso, maanedsLoen: entry.maanedsLoen, timeLoen: entry.timeLoen };
                })
                .filter((entry): entry is Readonly<{ iso: ISODateString; maanedsLoen: number; timeLoen: number }> => Boolean(entry))
                .filter((entry) => entry.iso > reguleringTableStartIso)
                .sort((a, b) => (a.iso < b.iso ? -1 : 1));

              for (const entry of laterSatser) {
                addRow(entry.iso, entry.maanedsLoen, entry.timeLoen);
              }

              return { columns, rows };
            }
            const isAlmindeligLoen = af.loenPaaHelligdage === loenPaaHelligdageSchema.enum['Almindelig løn'];
            const applyStoreBededagRegulering =
              isAlmindeligLoen && reguleringTableStartIso < STORE_BEDEDAG_START && tafEndIso >= STORE_BEDEDAG_START;
            const overenskomstRef = af.overenskomstId ? resolveOverenskomstRef(af.overenskomstId) : undefined;
            if (!overenskomstRef) return null;
            const fraDato = isoToDanish(reguleringTableStartIso);
            const tilDato = isoToDanish(tafEndIso);
            if (!fraDato || !tilDato) return null;
            const satser = getEffektiveSatserForPeriode({
              overenskomstId: overenskomstRef.baseId,
              fraDato,
              tilDato,
              applyAlmindeligLoenPaaShDageRegel: isAlmindeligLoen
            }).slice().reverse();

            const allSatser = getOverenskomst(overenskomstRef.baseId)?.satser ?? satser;
            const hasGrundloen = allSatser.some((sats) => sats.grundloen !== null);
            const hasShSo = allSatser.some((sats) => sats.shSoSats !== null);
            const hasFritvalg = allSatser.some((sats) => sats.fritvalg !== null);
            const hasAgPension = allSatser.some((sats) => sats.agPension !== null);
            const hasSfgg = allSatser.some((sats) => sats.sfgg !== null);
            const hasSfggFaglKbh = allSatser.some((sats) => sats.sfggFaglKbh !== null);
            const hasSfggFaglProv = allSatser.some((sats) => sats.sfggFaglProv !== null);
            const hasSfggUfaglKbh = allSatser.some((sats) => sats.sfggUfaglKbh !== null);
            const hasSfggUfaglProv = allSatser.some((sats) => sats.sfggUfaglProv !== null);
            const hasStoreBededag = applyStoreBededagRegulering;

            const feriePctDisplay = formatInputPercent(af.feriePct);
            const columns: StandardDisplayTableColumn[] = [
              centeredCol('Fra-dato', 120),
              ...(hasGrundloen ? [centeredCol('Grundløn', 120), centeredCol('Feriegodtgørelse', 140)] : []),
              ...(hasShSo ? [centeredCol('SH/SO', 100)] : []),
              ...(hasStoreBededag ? [centeredCol('Store Bededag', 120)] : []),
              ...(hasFritvalg ? [centeredCol('Fritvalg', 110)] : []),
              ...(hasAgPension ? [centeredCol('AG pension', 120)] : []),
              ...(hasSfgg ? [centeredCol('SFGG', 120)] : []),
              ...(hasSfggFaglKbh ? [centeredCol('SFGG fagl. Kbh', 140)] : []),
              ...(hasSfggFaglProv ? [centeredCol('SFGG fagl. prov', 140)] : []),
              ...(hasSfggUfaglKbh ? [centeredCol('SFGG ufagl. Kbh', 140)] : []),
              ...(hasSfggUfaglProv ? [centeredCol('SFGG ufagl. prov', 140)] : []),
            ];

            const satsWithIso = satser
              .map((sats) => ({ sats, iso: parseDanishToISO(sats.fraDato) }))
              .filter((entry): entry is Readonly<{ sats: typeof satser[number]; iso: ISODateString }> => Boolean(entry.iso))
              .sort((a, b) => (a.iso < b.iso ? -1 : 1));

            const baseSats = [...satsWithIso]
              .filter((entry) => entry.iso <= reguleringTableStartIso)
              .sort((a, b) => (a.iso < b.iso ? 1 : -1))[0];
            if (!baseSats) return null;

            const rows: StandardDisplayTableRow[] = [];
            const addRow = (labelIso: ISODateString, sats: (typeof satser)[number], storeBededagPct: number) => {
              const cells: React.ReactNode[] = [isoToDanish(labelIso) ?? labelIso];
              if (hasGrundloen) {
                cells.push(formatOverenskomstAmount(sats.grundloen));
                cells.push(feriePctDisplay);
              }
              if (hasShSo) cells.push(formatOverenskomstPercent(sats.shSoSats));
              if (hasStoreBededag) cells.push(formatPercentFixed2(storeBededagPct));
              if (hasFritvalg) cells.push(formatOverenskomstPercent(sats.fritvalg));
              if (hasAgPension) cells.push(formatOverenskomstPercent(sats.agPension));
              if (hasSfgg) cells.push(formatOverenskomstAmount(sats.sfgg));
              if (hasSfggFaglKbh) cells.push(formatOverenskomstAmount(sats.sfggFaglKbh));
              if (hasSfggFaglProv) cells.push(formatOverenskomstAmount(sats.sfggFaglProv));
              if (hasSfggUfaglKbh) cells.push(formatOverenskomstAmount(sats.sfggUfaglKbh));
              if (hasSfggUfaglProv) cells.push(formatOverenskomstAmount(sats.sfggUfaglProv));
              rows.push({
                key: `ok-${af.id}-${labelIso}`,
                cells,
              });
            };

            addRow(reguleringTableStartIso, baseSats.sats, 0);

            const laterSatser = satsWithIso.filter((entry) => entry.iso > reguleringTableStartIso);
            let storeBededagInserted = false;

            for (const entry of laterSatser) {
              if (applyStoreBededagRegulering && !storeBededagInserted && STORE_BEDEDAG_START < entry.iso) {
                addRow(STORE_BEDEDAG_START, baseSats.sats, STORE_BEDEDAG_PCT);
                storeBededagInserted = true;
              }
              const bededagPct = applyStoreBededagRegulering && entry.iso >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0;
              addRow(entry.iso, entry.sats, bededagPct);
            }

            if (applyStoreBededagRegulering && !storeBededagInserted && STORE_BEDEDAG_START > reguleringTableStartIso && STORE_BEDEDAG_START <= tafEndIso) {
              addRow(STORE_BEDEDAG_START, baseSats.sats, STORE_BEDEDAG_PCT);
            }

            return { columns, rows };
          }
          if (loenudviklingBasis === 'Manuelt angivet') {
            const rows = af.loenudviklingManuelTableData
              .map((row, rowIndex): StandardDisplayTableRow | null => {
                const iso = rowIndex === 0 && reguleringTableStartIso ? reguleringTableStartIso : parseDanishToISO(row.dato);
                if (!iso) return null;
                if (iso < reguleringTableStartIso || iso > tafEndIso) return null;
                return {
                  key: `manual-${af.id}-${row.id}`,
                  cells: [
                    formatIsoValue(iso),
                    normalizeTableValue(row.grundloen),
                    formatInputPercent(af.feriePct),
                    normalizeTableValue(row.feriepenge),
                    normalizeTableValue(row.shSoSats),
                    normalizeTableValue(row.fritvalg),
                    normalizeTableValue(row.agPension),
                  ],
                };
              })
              .filter((row): row is StandardDisplayTableRow => row !== null);

          const columns: StandardDisplayTableColumn[] = [
            centeredCol('Dato', 120),
            centeredCol('Grundløn', 120),
            centeredCol('Feriegodtgørelse', 140),
            centeredCol('Feriepenge', 120),
            centeredCol('SH/SO', 100),
            centeredCol('Fritvalg', 110),
            centeredCol('AG pension', 120),
          ];

          return { columns, rows };
        }

        if (loenudviklingBasis === 'Statistik') {
            const modelLabel = af.loenudviklingStatistikModel ?? '';
            if (modelLabel.trim() === '') return null;

            const includeBase = true;

            if (modelLabel.trim().startsWith('ASL-')) {
              const start = parseISODate(reguleringTableStartIso);
              const end = parseISODate(tafEndIso);
              const regDate = reguleringsdato ? parseISODate(reguleringsdato) : null;
              if (!start || !end || !regDate) return null;
              const startYear = start.getUTCFullYear();
              const endYear = end.getUTCFullYear();
              const regYear = regDate.getUTCFullYear();

              const rows: StandardDisplayTableRow[] = [];
              const regValue = aarsloenMax[regYear as keyof typeof aarsloenMax];
              if (typeof regValue === 'number') {
                rows.push({
                  key: `asl-${af.id}-${regYear}-reg`,
                  cells: [String(regYear), formatCurrency(regValue)],
                });
              } else {
                return null;
              }

              for (let year = startYear; year <= endYear; year += 1) {
                const value = aarsloenMax[year as keyof typeof aarsloenMax];
                if (typeof value !== 'number') continue;
                const rowIso = formatToISO(createDate(year, 0, 1));
                if (!rowIso) continue;
                if (year === regYear) continue;
                rows.push({
                  key: `asl-${af.id}-${year}`,
                  cells: [String(year), formatCurrency(value)],
                });
              }

              const columns: StandardDisplayTableColumn[] = [
                centeredCol('År', 100),
                centeredCol('Maksimum årsløn', 160),
              ];

              return { columns, rows };
            }

            const modelId = resolveStatistikModelIdFromLabel(modelLabel);
            if (!modelId) return null;
            const model = getStatistiskLoenudvikling(modelId);
            if (!model) return null;

            const periodStarts = model.indeksvaerdier
              .map((value) => {
                const match = value.kvartal.match(/^(\d{4})K([1-4])$/);
                if (!match) return null;
                const year = Number(match[1]);
                const quarter = Number(match[2]);
                if (!Number.isFinite(year) || !Number.isFinite(quarter)) return null;
                const month = (quarter - 1) * 3 + 1;
                const startIso = formatToISO(createDate(year, month - 1, 1));
                if (!startIso) return null;
                return { kvartal: value.kvartal, startIso, indeks: value.indeksvaerdi };
              })
              .filter((row): row is Readonly<{ kvartal: Kvartal; startIso: ISODateString; indeks: number }> => Boolean(row))
              .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));

            let basePeriod = periodStarts[0];
              for (const period of periodStarts) {
              if (period.startIso > reguleringTableStartIso) break;
              basePeriod = period;
            }

            const rows: StandardDisplayTableRow[] = [];
            if (includeBase && basePeriod) {
              rows.push({
                key: `stat-${af.id}-base`,
                cells: [
                  basePeriod.kvartal,
                  formatIsoValue(reguleringTableStartIso),
                  basePeriod.indeks.toLocaleString('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                ],
              });
            }

            for (const period of periodStarts) {
              if (basePeriod && period.startIso === basePeriod.startIso && includeBase) continue;
              rows.push({
                key: `stat-${af.id}-${period.kvartal}`,
                cells: [
                  period.kvartal,
                  formatIsoValue(period.startIso),
                  period.indeks.toLocaleString('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                ],
              });
            }

            const columns: StandardDisplayTableColumn[] = [
              centeredCol('Kvartal', 120),
              centeredCol('Startdato', 120),
              centeredCol('Indeksværdi', 100),
            ];

              return { columns, rows };
            }

        if (loenudviklingBasis === 'KRL satstabel') {
          const krlId = af.loenudviklingKRLSatstabel as KRLSatstabelId | undefined;
          if (!krlId) return null;
          const tabel = getKRLSatstabel(krlId);
          if (!tabel || tabel.vaerdier.length === 0) return null;

          const formatKrlPct = (value: number): string =>
            value.toLocaleString('da-DK', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + ' %';

          const periodStarts = tabel.vaerdier
            .map((v) => {
              const startIso = parseDanishToISO(v.fraDato);
              if (!startIso) return null;
              return { startIso, fraDato: v.fraDato, reguleringsPct: v.reguleringsPct };
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
            .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
          if (periodStarts.length === 0) return null;

          let basePeriod = periodStarts[0];
          for (const period of periodStarts) {
            if (period.startIso > reguleringTableStartIso) break;
            basePeriod = period;
          }

          const rows: StandardDisplayTableRow[] = [];
          if (basePeriod) {
            rows.push({
              key: `krl-${af.id}-base`,
              cells: [isoToDanish(reguleringTableStartIso) ?? reguleringTableStartIso, formatKrlPct(basePeriod.reguleringsPct)],
            });
          }

          for (const period of periodStarts) {
            if (period.startIso <= reguleringTableStartIso) continue;
            if (period.startIso > tafEndIso) continue;
            rows.push({
              key: `krl-${af.id}-${period.fraDato}`,
              cells: [period.fraDato, formatKrlPct(period.reguleringsPct)],
            });
          }

          const columns: StandardDisplayTableColumn[] = [
            centeredCol('Fra-dato', 120),
            centeredCol('Reguleringsprocent', 160),
          ];

          return { columns, rows };
        }

            return null;
        })();

      const rows: Array<{ id: string; label: string; displayValue: string; status: DebugStatus }> = [
        {
          id: 'regulering.valgt',
          label: 'Valgt regulering',
          displayValue: selectedValue.display,
          status: selectedValue.ok ? 'ok' : 'error',
        },
      ];

      if (selectedValue.ok) {
        if (loenudviklingBasis === 'Manuelt angivet') {
          rows.push({
            id: 'regulering.navn',
            label: 'Navn på reguleringsform',
            displayValue: manuelReguleringNavnDisplay,
            status: manuelReguleringNavnStatus,
          });
        }

        if (loenudviklingBasis !== 'Ingen') {
          rows.push({
            id: 'regulering.alleVaerdier',
            label: 'Alle reguleringsværdier udfyldt',
            displayValue: alleReguleringsvaerdierRow.display,
            status: alleReguleringsvaerdierRow.status,
          });
        }

        if (showReguleringDetails) {
          rows.push(
            {
              id: 'regulering.reguleringsdato',
              label: reguleringsdatoLabel,
              displayValue: reguleringsdatoDisplay,
              status: reguleringsdatoStatus,
            },
            {
              id: 'regulering.reguleringsvaerdi',
              label: 'Reguleringsværdi på reguleringsdato',
              displayValue: reguleringsvaerdiRow.display,
              status: reguleringsvaerdiRow.status,
            },
            {
              id: 'regulering.foersteTafDato',
              label: 'Første dato i TAF-periode',
              displayValue: foersteTafDatoDisplay,
              status: foersteTafDatoStatus,
            },
            {
              id: 'regulering.startvaerdi',
              label: 'Reguleringsværdi på start-dato',
              displayValue: startDateRow.display,
              status: startDateRow.status,
            },
            {
              id: 'regulering.slutdato',
              label: 'Sidste dato i TAF-periode',
              displayValue: sidsteTafDatoDisplay,
              status: sidsteTafDatoStatus,
            },
            {
              id: 'regulering.slutvaerdi',
              label: 'Reguleringsværdi på slut-dato',
              displayValue: endDateRow.display,
              status: endDateRow.status,
            }
          );
        }
      }

      return {
        id: af.id,
        headerText,
        rows,
        showTable: showReguleringDetails,
        table: reguleringTable,
        indeksTable,
        hasDateRange: Boolean(reguleringsdato && tafEndIso),
      };
    });
  }, [
    loenindkomstAnsaettelsesforhold,
    tafPerioder,
    vedroererPeriodeTil,
    ferieperioder,
    skadesdato,
    settings.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden,
    settings.allowReguleringMedUdloebMedMaaneder,
    erstatningsopgoerelseValues.beregnesUdFra,
    erstatningsopgoerelseValues.angivetMaanedsloenOpreguleresFraDato,
    erstatningsopgoerelseValues.angivetDagsloenOpreguleresFraDato,
  ]);

  const indkomstSections = React.useMemo(() => {
    return buildIndkomstSectionStatuses(loenindkomstAnsaettelsesforhold, skadesdato, erstatningsopgoerelseValues.beregnesUdFra);
  }, [loenindkomstAnsaettelsesforhold, skadesdato, erstatningsopgoerelseValues.beregnesUdFra]);

  const offentligeYdelserDebugRows = React.useMemo(() => {
    return buildOffentligeYdelserDebugRows(erstatningsopgoerelseValues.offentligeYdelserRows ?? []);
  }, [erstatningsopgoerelseValues.offentligeYdelserRows]);

  const differencekravDatoRow = React.useMemo(() => {
    return rowsBySection.get('aes')?.find((row) => (row.id as string) === 'aes.differencekravDato');
  }, [rowsBySection]);

  const aesRows = rowsBySection.get('aes') ?? [];
  const aesVarigeMenRows = aesRows.filter((row) => row.group === 'aes.varigeMen');
  const aesMidlertidigtRows = aesRows.filter((row) => row.group === 'aes.midlertidigtEet');
  const aesEndeligtRows = aesRows.filter((row) => row.group === 'aes.endeligtEet');
  const aesOevrigtRows = aesRows.filter((row) => row.group === 'aes.oevrigt');

  const indkomstIBeregningsperioden = React.useMemo((): Readonly<{
    loenRows: ReadonlyArray<IndkomstRow>;
    ydelseRows: ReadonlyArray<IndkomstRow>;
  }> => {
    const beregningsRange = getIsoRange(
      erstatningsopgoerelseValues.periodeTilBeregningFra,
      erstatningsopgoerelseValues.periodeTilBeregningTil
    );
    if (!beregningsRange) return { loenRows: [], ydelseRows: [] };
    const income = buildIncomeForRanges(erstatningsopgoerelseValues, [beregningsRange]);
    const loenRows: IndkomstRow[] = income.employers
      .filter((entry) => entry.amount > 0)
      .map((entry) => {
        const baseLabel = entry.index === 0 ? 'Ansættelsesforhold' : `Ansættelsesforhold ${entry.index + 1}`;
        const label = entry.name !== '' ? `${baseLabel} (${entry.name})` : baseLabel;
        return {
          id: `taf.beregningsgrundlag.indkomst.loen.${entry.id}`,
          label,
          displayValue: formatCurrency(entry.amount),
          status: 'ok',
          value: entry.amount,
        };
      });

    const ydelseRows: IndkomstRow[] = income.benefits
      .filter((entry) => entry.amount > 0)
      .map((entry) => ({
        id: `taf.beregningsgrundlag.indkomst.ydelse.${entry.typeKey || entry.label}`,
        label: entry.label,
        displayValue: formatCurrency(entry.amount),
        status: 'ok',
        value: entry.amount,
      }));

    return { loenRows, ydelseRows };
  }, [erstatningsopgoerelseValues]);

  const referenceloenRow = React.useMemo(() => {
    if (erstatningsopgoerelseValues.beregnesUdFra !== 'Beregningsperiode') return null;

    const entries = [
      ...indkomstIBeregningsperioden.loenRows,
      ...indkomstIBeregningsperioden.ydelseRows,
    ]
      .map((row) => row.value)
      .filter((value) => Number.isFinite(value) && value > 0);

    if (entries.length === 0) {
      return { label: '-', displayValue: '-', status: 'ok' as DebugStatus };
    }

    const periodeFra = erstatningsopgoerelseValues.periodeTilBeregningFra;
    const periodeTil = erstatningsopgoerelseValues.periodeTilBeregningTil;
    if (!periodeFra || !periodeTil || periodeFra > periodeTil) {
      return { label: '-', displayValue: '-', status: 'error' as DebugStatus };
    }

    const overlap = computeTafOverlapWithBeregningsperiode({
      beregningsperiode: { fra: periodeFra, til: periodeTil },
      tafPerioder: (erstatningsopgoerelseValues.tafPerioder ?? []).map((periode) => ({
        id: periode.id,
        fra: periode.fra,
        til: periode.til,
      })),
    });
    if (overlap.firstOverlapMessage) {
      return { label: '-', displayValue: '-', status: 'error' as DebugStatus };
    }

    const arbejdsdage = (() => {
      if (
        erstatningsopgoerelseValues.oevrigtFravaerUdenLoen === 'Ja' &&
        erstatningsopgoerelseValues.oevrigeFravaersdage === undefined
      ) {
        return null;
      }
      const beregningsFerieperioder = erstatningsopgoerelseValues.fravaerPerioder ?? [];
      const loseFeriedage = typeof erstatningsopgoerelseValues.uspecificeredeFerieFridage === 'number'
        ? erstatningsopgoerelseValues.uspecificeredeFerieFridage
        : 0;
      const oevrigeFravaersdageValue =
        erstatningsopgoerelseValues.oevrigtFravaerUdenLoen === 'Ja' &&
        typeof erstatningsopgoerelseValues.oevrigeFravaersdage === 'number'
          ? erstatningsopgoerelseValues.oevrigeFravaersdage
          : 0;
      const breakdown = calculateTafArbejdsdageBreakdown(
        periodeFra,
        periodeTil,
        beregningsFerieperioder,
        loseFeriedage,
        { kind: 'beregningsgrundlag', oevrigeFravaersdage: oevrigeFravaersdageValue }
      );
      if (!breakdown) return null;
      return Math.max(0, breakdown.tafDage);
    })();

    const maaneder = (() => {
      if (
        erstatningsopgoerelseValues.oevrigtFravaerUdenLoen === 'Ja' &&
        erstatningsopgoerelseValues.oevrigeFravaersdage === undefined
      ) {
        return null;
      }

      const oevrigeFravaersdageValue =
        erstatningsopgoerelseValues.oevrigtFravaerUdenLoen === 'Ja' &&
        typeof erstatningsopgoerelseValues.oevrigeFravaersdage === 'number'
          ? erstatningsopgoerelseValues.oevrigeFravaersdage
          : 0;
      return calculateTafAntalMaanederPraecis(
        periodeFra,
        periodeTil,
        [],
        0,
        oevrigeFravaersdageValue
      );
    })();

    const beregnesSom = computeTafBeregningsenhed(erstatningsopgoerelseValues);

    const divisor = beregnesSom === TAF_BEREGNES_SOM.MAANEDER ? maaneder : arbejdsdage;
    const divisorLabel = beregnesSom === TAF_BEREGNES_SOM.MAANEDER ? 'måneder' : 'arbejdsdage';
    if (!divisor || !Number.isFinite(divisor) || divisor <= 0) {
      return { label: '-', displayValue: '-', status: 'error' as DebugStatus };
    }

    const sum = entries.reduce((acc, value) => acc + value, 0);
    const formattedEntries = entries.map((value) => formatCurrency(value));
    const divisorDisplay = beregnesSom === TAF_BEREGNES_SOM.MAANEDER
      ? formatMaanederTrimmed(divisor)
      : Math.trunc(divisor).toLocaleString('da-DK');

    const label = formattedEntries.length === 1
      ? `${formattedEntries[0]} kr. / ${divisorDisplay} ${divisorLabel} =`
      : `(${formattedEntries.join(' + ')} kr.) / ${divisorDisplay} ${divisorLabel} =`;

    const displayValue = formatCurrency(sum / divisor);
    return { label, displayValue, status: 'ok' as DebugStatus };
  }, [erstatningsopgoerelseValues, indkomstIBeregningsperioden]);

  const indkomstManglerIBeregningsperiodenRow = React.useMemo(() => {
    return rowsBySection
      .get('taf-beregningsgrundlag')
      ?.find((row) => (row.id as string) === 'taf.beregningsgrundlag.indkomst');
  }, [rowsBySection]);

  return (
    <Box>
      <ContentBox className="content-box">
        <Typography className="section-header">Stamdata</Typography>

        {rowsBySection.get('stamdata')?.map((row) => {
          return (
            <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
              <Typography className="row--text">{row.label}</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">{row.displayValue}</Typography>
                {getStatusIcon(row.status)}
              </Box>
            </Box>
          );
        })}
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Forlig</Typography>

        {rowsBySection.get('forlig')?.map((row) => {
          return (
            <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
              <Typography className="row--text">{row.label}</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">{row.displayValue}</Typography>
                {getStatusIcon(row.status)}
              </Box>
            </Box>
          );
        })}
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Erstatningsopgørelse</Typography>

        {rowsBySection.get('erstatningsopgoerelse')?.map((row) => {
          return (
            <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
              <Typography className="row--text">{row.label}</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">{row.displayValue}</Typography>
                {getStatusIcon(row.status)}
              </Box>
            </Box>
          );
        })}
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">AES-afgørelser</Typography>

        <Typography className="row--subheading">Varige mén</Typography>

        {aesVarigeMenRows.map((row) => {
          return (
            <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
              <Typography className="row--text">{row.label}</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">{row.displayValue}</Typography>
                {getStatusIcon(row.status)}
              </Box>
            </Box>
          );
        })}

        <Typography className="row--subheading">Midlertidigt erhvervsevnetab</Typography>

        {aesMidlertidigtRows.filter((row) => {
          if (midlertidigtEetErSynlig) return true;
          return !(
            row.id === 'aes.midlertidigEETAfgoerelseDato' ||
            row.id === 'aes.midlertidigEETVirkningsdato' ||
            row.id === 'aes.beregnetMidlertidigEETStartdato'
          );
        }).map((row) => {
          return (
            <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
              <Typography className="row--text">{row.label}</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">{row.displayValue}</Typography>
                {getStatusIcon(row.status)}
              </Box>
            </Box>
          );
        })}

        <Typography className="row--subheading">Endeligt erhvervsevnetab</Typography>

        {aesEndeligtRows.filter((row) => {
          if (endeligtEetErSynlig) return true;
          return !(
            row.id === 'aes.endeligEETAfgoerelseDato' ||
            row.id === 'aes.endeligEETVirkningsdato' ||
            row.id === 'aes.beregnetEndeligEETStartdato'
          );
        }).map((row) => {
          return (
            <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
              <Typography className="row--text">{row.label}</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">{row.displayValue}</Typography>
                {getStatusIcon(row.status)}
              </Box>
            </Box>
          );
        })}

        <Typography className="row--subheading">Øvrigt</Typography>

        {aesOevrigtRows.map((row) => {
          return (
            <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
              <Typography className="row--text">{row.label}</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">{row.displayValue}</Typography>
                {getStatusIcon(row.status)}
              </Box>
            </Box>
          );
        })}
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Svie/smerte</Typography>

        <Box className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
          <Typography className="row--text">Beregnes der svie/smerte godtgørelse i opgørelsen</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
            {erstatningsopgoerelseValues.beregnesSvieSmerteGodtgoerelse ? (
              <>
                <Typography className="row--text">{beregnesSvieSmerte ? 'Ja' : 'Nej'}</Typography>
                {getStatusIcon('ok')}
              </>
            ) : (
              <>
                <Typography className="row--text">-</Typography>
                {getStatusIcon('error')}
              </>
            )}
          </Box>
        </Box>

        {svieSmerteOphoerRow && (
          <Box key={svieSmerteOphoerRow.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
            <Typography className="row--text">{svieSmerteOphoerRow.label}</Typography>
            <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
              <Typography className="row--text">{svieSmerteOphoerRow.displayValue}</Typography>
              {getStatusIcon(svieSmerteOphoerRow.status)}
            </Box>
          </Box>
        )}

        {beregnesSvieSmerte && (
          <>
            {svieSmerteMainRows.map((row) => {
              // Periode-rækker får en bredere label-width for at forhindre tekst-komprimering
              const labelWidth = row.id.startsWith('sviesmerte.periode.') ? '300px' : LABEL_WIDTH;
              // Multi-line displayValue kræver whiteSpace: 'pre-line' for at vise linjeskift
              const hasMultipleLines = row.displayValue.includes('\n');
              return (
                <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': labelWidth }}>
                  <Typography className="row--text" sx={{ minWidth: labelWidth }}>{row.label}</Typography>
                  <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                    <Typography
                      className="row--text"
                      sx={{
                        maxWidth: '600px',
                        wordBreak: 'break-word',
                        whiteSpace: hasMultipleLines ? 'pre-line' : 'normal',
                        textAlign: hasMultipleLines ? 'right' : 'left'
                      }}
                    >
                      {row.displayValue}
                    </Typography>
                    {getStatusIcon(row.status)}
                  </Box>
                </Box>
              );
            })}
          </>
        )}
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Tabt arbejdsfortjeneste</Typography>

        <Box className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
          <Typography className="row--text">Beregnes der tabt arbejdsfortjeneste i opgørelsen</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
            {erstatningsopgoerelseValues.beregnesTabtArbejdsfortjeneste ? (
              <>
                <Typography className="row--text">{beregnesTabtArbejdsfortjeneste ? 'Ja' : 'Nej'}</Typography>
                {getStatusIcon('ok')}
              </>
            ) : (
              <>
                <Typography className="row--text">-</Typography>
                {getStatusIcon('error')}
              </>
            )}
          </Box>
        </Box>

        {beregnesTabtArbejdsfortjeneste && (
          <>
            {rowsBySection.get('taf')?.filter((row) => (row.id as string) === 'taf.ophoerSkyldes').map((row) => {
              return (
                <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
                  <Typography className="row--text">{row.label}</Typography>
                  <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                    <Typography className="row--text">{row.displayValue}</Typography>
                    {getStatusIcon(row.status)}
                  </Box>
                </Box>
              );
            })}

            <Typography className="row--subheading">TAF-perioder</Typography>

            {rowsBySection.get('taf')?.filter((row) => row.id.startsWith('taf.periode.')).map((row) => {
              const labelWidth = row.id.startsWith('taf.periode.') ? '340px' : LABEL_WIDTH;
              const hasMultipleLines = row.displayValue.includes('\n');
              return (
                <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': labelWidth }}>
                  <Typography className="row--text" sx={{ minWidth: labelWidth }}>{row.label}</Typography>
                  <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                    <Typography
                      className="row--text"
                      sx={{
                        whiteSpace: hasMultipleLines ? 'pre-line' : 'normal',
                        textAlign: hasMultipleLines ? 'right' : 'left',
                      }}
                    >
                      {row.displayValue}
                    </Typography>
                    {getStatusIcon(row.status)}
                  </Box>
                </Box>
              );
            })}

            <Typography className="row--subheading">Ferie i TAF-perioden:</Typography>

            {rowsBySection.get('taf')?.filter((row) => row.id.startsWith('taf.ferie.')).map((row) => {
              return (
                <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
                  <Typography className="row--text">{row.label}</Typography>
                  <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                    <Typography className="row--text">{row.displayValue}</Typography>
                    {getStatusIcon(row.status)}
                  </Box>
                </Box>
              );
            })}

            <Typography className="row--subheading">Øvrige</Typography>

            {differencekravDatoRow ? (
              <Box key={differencekravDatoRow.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
                <Typography className="row--text">{differencekravDatoRow.label}</Typography>
                <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                  <Typography className="row--text">{differencekravDatoRow.displayValue}</Typography>
                  {getStatusIcon(differencekravDatoRow.status)}
                </Box>
              </Box>
            ) : null}

            {rowsBySection.get('taf')?.filter((row) => (row.id as string) === 'taf.andelSfggILoenen' || (row.id as string) === 'taf.tidligereModtagetTaf').map((row) => {
              return (
                <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
                  <Typography className="row--text">{row.label}</Typography>
                  <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                    <Typography className="row--text">{row.displayValue}</Typography>
                    {getStatusIcon(row.status)}
                  </Box>
                </Box>
              );
            })}
          </>
        )}
      </ContentBox>

      
      
      {beregnesTabtArbejdsfortjeneste && (
        <ContentBox className="content-box">
        <Typography className="section-header">TAF beregningsgrundlag</Typography>

        {rowsBySection.get('taf-beregningsgrundlag')
          ?.filter(
            (row) =>
              (row.id as string) === 'taf.beregningsgrundlag.beregnesUdFra' ||
              (row.id as string) === 'taf.beregnesSom' ||
              (row.id as string) === 'taf.beregningsgrundlag.beregningsperiode'
          )
          .map((row) => {
            return (
              <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
                <Typography className="row--text">{row.label}</Typography>
                <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                  <Typography className="row--text">{row.displayValue}</Typography>
                  {getStatusIcon(row.status)}
                </Box>
              </Box>
            );
          })}

        {erstatningsopgoerelseValues.beregnesUdFra === 'Beregningsperiode' && (
          <>
            <Typography className="row--subheading">Ferie i beregningsperioden:</Typography>

            {rowsBySection.get('taf-beregningsgrundlag')
              ?.filter((row) => row.id.startsWith('taf.beregningsgrundlag.ferie.'))
              .map((row) => {
                const labelWidth = row.id.startsWith('taf.beregningsgrundlag.ferie.') ? '340px' : LABEL_WIDTH;
                return (
                  <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': labelWidth }}>
                    <Typography className="row--text" sx={{ minWidth: labelWidth }}>
                      {row.label}
                    </Typography>
                    <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                      <Typography className="row--text">{row.displayValue}</Typography>
                      {getStatusIcon(row.status)}
                    </Box>
                  </Box>
                );
              })}

            <Typography className="row--subheading">Øvrigt fravær i beregningsperioden:</Typography>

            {rowsBySection.get('taf-beregningsgrundlag')
              ?.filter(
                (row) =>
                  (row.id as string) === 'taf.beregningsgrundlag.uspecificeredeFerieFridage' ||
                  (row.id as string) === 'taf.beregningsgrundlag.oevrigtFravaerUdenLoen' ||
                  (row.id as string) === 'taf.beregningsgrundlag.oevrigeFravaersdage' ||
                  (row.id as string) === 'taf.beregningsgrundlag.oevrigeFravaersdageBeskrivelse'
              )
              .map((row) => {
                return (
                  <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
                    <Typography className="row--text">{row.label}</Typography>
                    <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                      <Typography className="row--text">{row.displayValue}</Typography>
                      {getStatusIcon(row.status)}
                    </Box>
                  </Box>
                );
              })}

            <Typography className="row--subheading">Beregningsperiode</Typography>

            {rowsBySection.get('taf-beregningsgrundlag')
              ?.filter(
                (row) =>
                  (row.id as string) === 'taf.beregningsgrundlag.arbejdsdage' ||
                  (row.id as string) === 'taf.beregningsgrundlag.maaneder'
              )
              .map((row) => {
                const labelWidth = '360px';
                const rightAlignValue = (row.id as string) === 'taf.beregningsgrundlag.arbejdsdage';
                return (
                  <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': labelWidth }}>
                    <Typography className="row--text" sx={{ minWidth: labelWidth }}>
                      {row.label}
                    </Typography>
                    <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                      <Typography className="row--text" sx={rightAlignValue ? { textAlign: 'right' } : undefined}>
                        {row.displayValue}
                      </Typography>
                      {getStatusIcon(row.status)}
                    </Box>
                  </Box>
                );
              })}

            <Typography className="row--subheading">Indkomst i beregningsperioden</Typography>

            {indkomstIBeregningsperioden.loenRows.map((row) => {
              return (
                <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
                  <Typography className="row--text">{row.label}</Typography>
                  <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                    <Typography className="row--text">{row.displayValue}</Typography>
                    {getStatusIcon(row.status)}
                  </Box>
                </Box>
              );
            })}

            {indkomstIBeregningsperioden.ydelseRows.map((row) => {
              return (
                <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
                  <Typography className="row--text">{row.label}</Typography>
                  <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                    <Typography className="row--text">{row.displayValue}</Typography>
                    {getStatusIcon(row.status)}
                  </Box>
                </Box>
              );
            })}

            {indkomstManglerIBeregningsperiodenRow && (
              <Box className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
                <Typography className="row--text">{indkomstManglerIBeregningsperiodenRow.label}</Typography>
                <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                  <Typography className="row--text">-</Typography>
                  {getStatusIcon(indkomstManglerIBeregningsperiodenRow.status)}
                </Box>
              </Box>
            )}

            <Typography className="row--subheading">Referenceløn</Typography>

            {referenceloenRow && (
              <Box className="row--label-right-hover" sx={{ '--label-width': '360px' }}>
                <Typography className="row--text" sx={{ minWidth: '360px' }}>
                  {referenceloenRow.label}
                </Typography>
                <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                  <Typography className="row--text">{referenceloenRow.displayValue}</Typography>
                  {getStatusIcon(referenceloenRow.status)}
                </Box>
              </Box>
            )}
          </>
        )}

        {erstatningsopgoerelseValues.beregnesUdFra !== 'Beregningsperiode' && (
          <>
            <Typography className="row--subheading">Angivet løn:</Typography>

            {rowsBySection.get('taf-beregningsgrundlag')
              ?.filter(
                (row) =>
                  (row.id as string) === 'taf.beregningsgrundlag.maanedsloen' ||
                  (row.id as string) === 'taf.beregningsgrundlag.dagsloen' ||
                  (row.id as string) === 'taf.beregningsgrundlag.loenBaseretPaa'
              )
              .map((row) => {
                return (
                  <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
                    <Typography className="row--text">{row.label}</Typography>
                    <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                      <Typography className="row--text">{row.displayValue}</Typography>
                      {getStatusIcon(row.status)}
                    </Box>
                  </Box>
                );
              })}
          </>
        )}

      </ContentBox>
      )}

      
      {beregnesTabtArbejdsfortjeneste && (
        <ContentBox className="content-box">
        <Typography className="section-header">Indkomst</Typography>

        {indkomstSections.map((section) => (
          <Box key={section.id} sx={{ mb: 2 }}>
            <Typography className="row--subheading">{section.headerText}</Typography>

            <Box className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
              <Typography className="row--text">Navn på arbejdssted</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">{section.arbejdsstedNavnDisplay}</Typography>
                {getStatusIcon(section.arbejdsstedNavnStatus)}
              </Box>
            </Box>

            <Box className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
              <Typography className="row--text">Satser på skadestidspunktet</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">{section.satserMessage}</Typography>
                {getStatusIcon(section.satserStatus)}
              </Box>
            </Box>

            <Box className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
              <Typography className="row--text">Alle lønoplysninger indtastet korrekt</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">{section.tableMessage}</Typography>
                {getStatusIcon(section.tableStatus)}
              </Box>
            </Box>
          </Box>
        ))}

        <Typography className="row--subheading">Offentlige ydelser</Typography>

        {offentligeYdelserDebugRows.map((row) => {
          return (
            <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
              <Typography className="row--text">{row.label}</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">{row.message}</Typography>
                {getStatusIcon(row.status)}
              </Box>
            </Box>
          );
        })}
      </ContentBox>
      )}

      {beregnesTabtArbejdsfortjeneste && (
        <ContentBox className="content-box">
          <Typography className="section-header">Regulering</Typography>

          {reguleringSections.map((section) => {
            return (
              <Box key={section.id} sx={{ mb: 2 }}>
                <Typography className="row--subheading">{section.headerText}</Typography>

                {section.rows.map((row) => (
                  <React.Fragment key={`${section.id}-${row.id}`}>
                    {row.id === 'regulering.reguleringsdato' ? (
                      <Box sx={{ height: '1px', backgroundColor: 'grey.300', my: 0, mx: '12px' }} />
                    ) : null}
                    {row.id === 'regulering.foersteTafDato' ? (
                      <Box sx={{ height: '1px', backgroundColor: 'grey.300', my: 0, mx: '12px' }} />
                    ) : null}
                    {row.id === 'regulering.slutdato' ? (
                      <Box sx={{ height: '1px', backgroundColor: 'grey.300', my: 0, mx: '12px' }} />
                    ) : null}
                    <Box className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
                      <Typography className="row--text">{row.label}</Typography>
                      <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                        <Typography className="row--text">{row.displayValue}</Typography>
                        {getStatusIcon(row.status)}
                      </Box>
                    </Box>
                  </React.Fragment>
                ))}

                {section.showTable ? (
                  section.table ? (
                    <>
                      <Box sx={{ height: '1px', backgroundColor: 'grey.300', my: 0, mx: '12px' }} />
                      <StandardDisplayTable
                        useSmallFont
                        columns={section.table.columns}
                        rows={section.table.rows.length > 0
                          ? section.table.rows
                          : ([
                              {
                                key: `${section.id}-tom`,
                                cells: [
                                  section.hasDateRange ? 'Ingen reguleringsrækker i perioden.' : 'Mangler datoer til visning.',
                                  ...section.table.columns.slice(1).map(() => '-'),
                                ],
                              },
                            ] satisfies StandardDisplayTableRow[])}
                        containerSx={{ mt: 1, mb: 4 }}
                      />
                      {section.indeksTable ? (
                        <StandardDisplayTable
                          useSmallFont
                          columns={section.indeksTable.columns}
                          rows={section.indeksTable.rows}
                          tableSx={{
                            '& td:nth-of-type(5), & th:nth-of-type(5)': {
                              whiteSpace: 'pre-line',
                              wordBreak: 'break-word',
                            },
                          }}
                          containerSx={{ mt: 1 }}
                        />
                      ) : (
                        <Typography className="row--text" sx={{ mt: 1 }}>
                          Mangler datoer til visning af reguleringstabel.
                        </Typography>
                      )}
                    </>
                  ) : (
                    <Typography className="row--text" sx={{ mt: 1 }}>
                      Mangler datoer til visning af reguleringstabel.
                    </Typography>
                  )
                ) : null}
              </Box>
            );
          })}
        </ContentBox>
      )}

      <ContentBox className="content-box">
        <Typography className="section-header">Øvrige erstatningskrav</Typography>

        {rowsBySection.get('oevrige-krav')?.map((row) => {
          return (
            <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
              <Typography className="row--text">{row.label}</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">{row.displayValue}</Typography>
                {getStatusIcon(row.status)}
              </Box>
            </Box>
          );
        })}
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Eventuelle særlige kommentarer</Typography>

        {rowsBySection.get('saerlige-kommentarer')?.map((row) => {
          return (
            <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
              <Typography className="row--text">{row.label}</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">{row.displayValue}</Typography>
                {getStatusIcon(row.status)}
              </Box>
            </Box>
          );
        })}
      </ContentBox>
    </Box>
  );
};

export default EODebug;
