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
  getReguleringsDatoIntervalForOverenskomst,
  resolveOverenskomstRef,
  type OverenskomstId,
} from '../../../data/overenskomstRates';
import {
  getReguleringsDatoIntervalForStatistikModel,
  getStatistiskLoenudvikling,
  type Kvartal,
  type StatistiskLoenudviklingId,
} from '../../../data/statistiskLoenudviklingRates';
import { loenPaaHelligdageSchema } from '../../../schemas/formSchemas';
import { ERSTATNINGSOPGOERELSE_INITIAL_VALUES } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { useFormFieldErrorsBySource } from '../../../hooks/useFormFieldErrors';
import { useFormPersistence } from '../../../contexts/FormPersistenceContext';
import type { ISODateString } from '../../../types/branded';
import { dateToISO, isoToDanish, isISODateString, subtractOneDay, toISODateString } from '../../../types/branded';
import { addDays, addMonths, formatDanishDate, formatToISO, parseDanishDate, parseISODate, parseWeekString } from '../../../utils/dateUtils';
import { formatCurrency, formatPercent, parseAmount } from '../../../utils/formatUtils';
import { amountValueToDisplayString } from '../../../utils/expressionAmount';
import { formatDecimal } from '../../../domain/debug/eoDebugFormat';
import { buildSHDageSet, buildFerieDageSet, beregnArbejdsdageOgMaaneder } from '../../../domain/debug/eoDebugRegulationCore';
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

const parseDanishToISO = (value: string | undefined): ISODateString | undefined => {
  if (!value || value.trim() === '') return undefined;
  const parsed = parseDanishDate(value.trim());
  if (!parsed) return undefined;
  return formatToISO(parsed);
};

const formatIsoValue = (iso: ISODateString | undefined): string => {
  if (!iso) return '-';
  return isoToDanish(iso) ?? '-';
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
  const middleParts = [
    formatPercent(100),
    ...(feriePct !== 0 ? [formatPercent(feriePct)] : []),
    ...(visibility.showFritvalg && fritvalgPct !== 0 ? [formatPercent(fritvalgPct)] : []),
    ...(visibility.showShSo && shSoPct !== 0 ? [formatPercent(shSoPct)] : []),
    ...(visibility.showStoreBededag && storeBededagPct !== 0 ? [formatPercentFixed2(storeBededagPct)] : []),
  ];
  const middle = middleParts.join(' + ');
  if (visibility.showPension) {
    const pensionParts = [
      formatPercent(100),
      ...(pensionPct !== 0 ? [formatPercent(pensionPct)] : []),
    ];
    const pensionStr = pensionParts.join(' + ');
    return `${baseStr} x (${middle}) x (${pensionStr})`;
  }
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
    current.setDate(current.getDate() + 1);
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
    const dow = d.getDay();
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

const SYGEDAGPENGE_SH_CUTOFF = toISODateString('2012-07-02');

const isOffentligYdelseDatoMedregnet = (
  iso: ISODateString,
  dateObj: Date,
  shDays: ReadonlySet<ISODateString>,
  periodisering: Periodisering,
  ydelsestypeKey: string,
  rowTilISO: ISODateString
): boolean => {
  if (periodisering === 'kalenderdage') return true;
  const dow = dateObj.getDay();
  const erHverdag = dow >= 1 && dow <= 5;
  if (!erHverdag) return false;
  if (periodisering === 'hverdage') return true;

  if (ydelsestypeKey === 'sygedagpenge') {
    if (rowTilISO < SYGEDAGPENGE_SH_CUTOFF) return true;
  }
  return !shDays.has(iso);
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
}>;

const EODebug = () => {
  const { getPersistedData } = useFormPersistence();
  const stamdataValues = React.useMemo(() => {
    return { ...STAMDATA_INITIAL_VALUES, ...(getPersistedData('stamdata') ?? {}) };
  }, [getPersistedData]);
  const erstatningsopgoerelseValues = React.useMemo(() => {
    return { ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES, ...(getPersistedData('erstatningsopgoerelse') ?? {}) };
  }, [getPersistedData]);

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
    }),
    [stamdataValues, stamdataFieldErrors, erstatningsopgoerelseValues, erstatningsopgoerelseFieldErrors]
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

  const {
    loenindkomstAnsaettelsesforhold,
    tafPerioder,
    vedroererPeriodeTil,
    ferieperioder,
  } = erstatningsopgoerelseValues;
  const { skadesdato, skadestype } = stamdataValues;

  const reguleringSections = React.useMemo(() => {
    return loenindkomstAnsaettelsesforhold.map((af, index) => {
      const baseHeaderText = index === 0 ? 'Ansættelsesforhold' : `Ansættelsesforhold ${index + 1}`;
      const headerText = af.navnPaaArbejdssted ? `${baseHeaderText} (${af.navnPaaArbejdssted})` : baseHeaderText;

      const loenudviklingBasis = af.loenudviklingBeregningsgrundlag;
      const isIngen = loenudviklingBasis === 'Ingen';

      const selectedValue = (() => {
        if (!loenudviklingBasis) return { display: '-', ok: false };
        if (loenudviklingBasis === 'Ingen') return { display: 'Ingen', ok: true };
        if (loenudviklingBasis === 'Manuelt angivet') return { display: 'Manuelt angivet', ok: true };
        if (loenudviklingBasis === 'Overenskomst') {
          if (!af.overenskomstId) return { display: '-', ok: false };
          const meta = getOverenskomstMetaById(af.overenskomstId);
          if (!meta) return { display: af.overenskomstId, ok: true };
          const loenPart = meta.loenmodtagerOrg[0] || '';
          const arbPart = meta.arbejdsgiverOrg[0] || '';
          return { display: `${meta.navn} (${loenPart} / ${arbPart})`, ok: true };
        }
        if (loenudviklingBasis === 'Statistik') {
          if (!af.loenudviklingStatistikModel) return { display: '-', ok: false };
          return { display: af.loenudviklingStatistikModel, ok: true };
        }
        return { display: loenudviklingBasis, ok: true };
      })();

      const manuelReguleringNavnRaw =
        loenudviklingBasis === 'Manuelt angivet' && typeof af.loenudviklingManuelNavn === 'string'
          ? af.loenudviklingManuelNavn.trim()
          : '';
      const manuelReguleringNavnDisplay = manuelReguleringNavnRaw === '' ? '-' : manuelReguleringNavnRaw;
      const manuelReguleringNavnStatus: DebugStatus = manuelReguleringNavnRaw === '' ? 'warning' : 'ok';

      const saerligDato = isISODateString(af.saerligFraDatoRegulering) ? af.saerligFraDatoRegulering : undefined;
      const skadesdatoIso = isISODateString(skadesdato) ? skadesdato : undefined;
      const reguleringsdato = saerligDato ?? skadesdatoIso;
      const reguleringsdatoDisplay = formatIsoValue(reguleringsdato);
      const reguleringsdatoLabel = saerligDato
        ? 'Startdato (Manuel reguleringsdato)'
        : skadestype === 'Erhvervssygdom'
          ? 'Startdato (Anmeldedato)'
          : 'Startdato (Skadesdato)';
      const reguleringsdatoStatus: DebugStatus = reguleringsdatoDisplay === '-' ? 'error' : 'ok';

      const periodeTil = isISODateString(vedroererPeriodeTil)
        ? vedroererPeriodeTil
        : undefined;
      const periodeTilDisplay = formatIsoValue(periodeTil);
      const periodeTilStatus: DebugStatus = periodeTilDisplay === '-' ? 'error' : 'ok';

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
        return {};
      })();

      const startDateRow = (() => {
        if (!reguleringsdato || !reguleringsRange.min) {
          return { display: '-', status: 'error' as DebugStatus };
        }
        return reguleringsRange.min <= reguleringsdato
          ? { display: 'Ja', status: 'ok' as DebugStatus }
          : { display: 'Nej', status: 'error' as DebugStatus };
      })();

      const endDateRow = (() => {
        if (!periodeTil || !reguleringsRange.max) {
          return { display: '-', status: 'error' as DebugStatus };
        }
        return reguleringsRange.max >= periodeTil
          ? { display: 'Ja', status: 'ok' as DebugStatus }
          : { display: 'Nej', status: 'warning' as DebugStatus };
      })();

      const indeksRowIsos: ISODateString[] = [];

      const indeksTable = (() => {
        if (!loenudviklingBasis || loenudviklingBasis === 'Ingen') return null;
        if (!reguleringsdato) return null;

        const feriePct = typeof af.feriePct === 'number' ? af.feriePct : 0;
        const tafRanges = (tafPerioder ?? [])
          .map((row) => getIsoRange(row.fra, row.til))
          .filter((range): range is Readonly<{ fra: ISODateString; til: ISODateString }> => Boolean(range));

        const applyAlmindeligLoenPaaShDageRegel = af.loenPaaHelligdage === loenPaaHelligdageSchema.enum['Almindelig løn']

        const periods: ReguleringsPeriode[] = (() => {
          if (loenudviklingBasis === 'Overenskomst') {
            if (!af.overenskomstId) return [];
            const ref = resolveOverenskomstRef(af.overenskomstId);
            if (!ref) return [];
            const fraDato = isoToDanish(reguleringsdato);
            const tilDato = isoToDanish(periodeTil ?? reguleringsdato);
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
              applyAlmindeligLoenPaaShDageRegel && reguleringsdato < STORE_BEDEDAG_START && (periodeTil ?? reguleringsdato) >= STORE_BEDEDAG_START;

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
              endIso: index < periodStarts.length - 1 ? subtractOneDay(periodStarts[index + 1]?.startIso) : periodeTil,
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
                { startIso: reguleringsdato, components: baseComponents },
                ...rows.slice(1).map((row) => {
                  const startIso = parseDanishToISO(row.dato);
                  if (!startIso) return null;
                  if (startIso < reguleringsdato) return null;
                  if (periodeTil && startIso > periodeTil) return null;
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
                applyAlmindeligLoenPaaShDageRegel && reguleringsdato < STORE_BEDEDAG_START && (periodeTil ?? reguleringsdato) >= STORE_BEDEDAG_START;

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
                endIso: index < periodStarts.length - 1 ? subtractOneDay(periodStarts[index + 1]?.startIso) : periodeTil,
              }));
            }

          if (loenudviklingBasis === 'Statistik') {
            const fritvalgPct = typeof af.fritvalgPct === 'number' ? af.fritvalgPct : 0;
            const shSoPct = typeof af.shSoPct === 'number' ? af.shSoPct : 0;
            const pensionPct = typeof af.pensionPct === 'number' ? af.pensionPct : 0;

            const modelLabel = af.loenudviklingStatistikModel ?? '';
            if (modelLabel.trim() === '') return [];

            if (modelLabel.trim().startsWith('ASL-')) {
              const start = parseISODate(reguleringsdato);
              const end = parseISODate(periodeTil ?? reguleringsdato);
              if (!start || !end) return [];
              const startYear = start.getFullYear();
              const endYear = end.getFullYear();

              const periodStarts: Array<{ startIso: ISODateString; components: FormulaComponents }> = [];
              for (let year = startYear; year <= endYear; year += 1) {
                const value = aarsloenMax[year as keyof typeof aarsloenMax];
                if (typeof value !== 'number') continue;
                const startIso = formatToISO(new Date(year, 0, 1));
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
                    endIso: index < periodStarts.length - 1 ? subtractOneDay(periodStarts[index + 1]?.startIso) : periodeTil,
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
                const startIso = formatToISO(new Date(year, month, 1));
                if (!startIso) return null;
                return {
                  startIso,
                  components: {
                    baseValue: value.indeks,
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
              endIso: index < periodStarts.length - 1 ? subtractOneDay(periodStarts[index + 1]?.startIso) : periodeTil,
            }));
          }

          return [];
        })();

        const basePeriod = findPeriodForDate(periods, reguleringsdato);
        const baseComponents: FormulaComponents = basePeriod?.components ?? {
          baseValue: 0,
          feriePct,
          fritvalgPct: 0,
          shSoPct: 0,
          pensionPct: 0,
          storeBededagPct: 0,
        };
        const baseVisibility: FormulaVisibility = basePeriod?.visibility ?? { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false };
        const isStatistik = loenudviklingBasis === 'Statistik';
        const statistikModelLabel = af.loenudviklingStatistikModel ?? '';
        const isAslModel = isStatistik && statistikModelLabel.trim().startsWith('ASL-');
        const statDecimalPlaces = (() => {
          if (!isStatistik || isAslModel) return 2;
          const modelId = resolveStatistikModelIdFromLabel(statistikModelLabel);
          if (!modelId) return 2;
          const model = getStatistiskLoenudvikling(modelId);
          if (!model) return 2;
          return detectDecimalPlaces(model.indeksvaerdier.map((value) => value.indeks));
        })();
        const formatStatValue = isAslModel
          ? formatCurrency
          : (value: number) => value.toLocaleString('da-DK', { minimumFractionDigits: statDecimalPlaces, maximumFractionDigits: statDecimalPlaces });

        const baseValueRaw = isStatistik ? baseComponents.baseValue : computeFormulaValue(baseComponents);
        const baseFormula = isStatistik ? formatStatValue(baseValueRaw) : buildFormulaText(baseComponents, baseVisibility);

        // Byg SH-dage og feriedage set for beregning af arbejdsdage
        const eoRange = periodeTil ? { fra: reguleringsdato, til: periodeTil } : null;
        const shDageSet = eoRange ? buildSHDageSet(eoRange.fra, eoRange.til) : new Set<ISODateString>();
        const ferieDageSet = eoRange
          ? buildFerieDageSet({ ferieperioder, tafPerioder }, shDageSet, eoRange.fra, eoRange.til)
          : new Set<ISODateString>();

        const rowIsos: ISODateString[] = [reguleringsdato];

        const sortedPeriods = periods
          .filter((period) => period.startIso > reguleringsdato)
          .filter((period) => !periodeTil || period.startIso <= periodeTil);

        // Beregn arbejdsdage og måneder for base-periode
        const baseEndIso = sortedPeriods.length > 0 ? subtractOneDay(sortedPeriods[0].startIso) : periodeTil;
        const baseStats = baseEndIso && periodeTil
          ? beregnArbejdsdageOgMaaneder(reguleringsdato, baseEndIso, shDageSet, ferieDageSet)
          : { arbejdsdage: 0, maaneder: 0 };

        const rows: StandardDisplayTableRow[] = [
          {
            key: `regulering-indeks-${af.id}-base`,
            cells: [
              formatIsoValue(reguleringsdato),
              baseEndIso ? formatIsoValue(baseEndIso) : '-',
              baseStats.arbejdsdage.toString(),
              formatDecimal(baseStats.maaneder, 2),
              baseFormula,
              formatIndexValue(100)
            ],
          },
        ];

        for (let i = 0; i < sortedPeriods.length; i++) {
          const period = sortedPeriods[i];
          const hasTafOverlap = tafRanges.some((range) => rangesOverlap(period.startIso, period.endIso, range.fra, range.til));
          if (!hasTafOverlap) continue;

          const periodVisibility = period.visibility ?? { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false };
          const valueRaw = isStatistik ? period.components.baseValue : computeFormulaValue(period.components);
          const formula = buildFormulaText(period.components, periodVisibility);
          const displayFormula = isStatistik ? `${formatStatValue(valueRaw)} /\n${baseFormula}` : `(${formula}) /\n(${baseFormula})`;
          const indexValue = baseValueRaw > 0 ? formatIndexValue((valueRaw / baseValueRaw) * 100) : '-';

          // Beregn arbejdsdage og måneder for denne periode
          const periodEndIso = i < sortedPeriods.length - 1 ? subtractOneDay(sortedPeriods[i + 1].startIso) : periodeTil;
          const periodStats = periodEndIso && periodeTil
            ? beregnArbejdsdageOgMaaneder(period.startIso, periodEndIso, shDageSet, ferieDageSet)
            : { arbejdsdage: 0, maaneder: 0 };

          rows.push({
            key: `regulering-indeks-${af.id}-${period.startIso}`,
            cells: [
              formatIsoValue(period.startIso),
              periodEndIso ? formatIsoValue(periodEndIso) : '-',
              periodStats.arbejdsdage.toString(),
              formatDecimal(periodStats.maaneder, 2),
              displayFormula,
              indexValue
            ],
          });
          rowIsos.push(period.startIso);
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

        indeksRowIsos.push(...rowIsos);
        return { columns, rows };
      })();

      const reguleringTable = (() => {
        if (!loenudviklingBasis || loenudviklingBasis === 'Ingen') return null;
        if (!reguleringsdato || !periodeTil) return null;
        if (reguleringsdato > periodeTil) return null;
        const rowIsoSet = indeksRowIsos.length > 0 ? new Set(indeksRowIsos) : null;

        if (loenudviklingBasis === 'Overenskomst') {
            const isAlmindeligLoen = af.loenPaaHelligdage === loenPaaHelligdageSchema.enum['Almindelig løn'];
            const applyStoreBededagRegulering =
              isAlmindeligLoen && reguleringsdato < STORE_BEDEDAG_START && periodeTil >= STORE_BEDEDAG_START;
            const overenskomstRef = af.overenskomstId ? resolveOverenskomstRef(af.overenskomstId) : undefined;
            if (!overenskomstRef) return null;
            const fraDato = isoToDanish(reguleringsdato);
            const tilDato = isoToDanish(periodeTil);
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
              .filter((entry) => entry.iso <= reguleringsdato)
              .sort((a, b) => (a.iso < b.iso ? 1 : -1))[0];
            if (!baseSats) return null;

            const rows: StandardDisplayTableRow[] = [];
            const addRow = (labelIso: ISODateString, sats: (typeof satser)[number], storeBededagPct: number) => {
              if (rowIsoSet && !rowIsoSet.has(labelIso)) return;
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

            addRow(reguleringsdato, baseSats.sats, 0);

            const laterSatser = satsWithIso.filter((entry) => entry.iso > reguleringsdato);
            let storeBededagInserted = false;

            for (const entry of laterSatser) {
              if (applyStoreBededagRegulering && !storeBededagInserted && STORE_BEDEDAG_START < entry.iso) {
                addRow(STORE_BEDEDAG_START, baseSats.sats, STORE_BEDEDAG_PCT);
                storeBededagInserted = true;
              }
              const bededagPct = applyStoreBededagRegulering && entry.iso >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0;
              addRow(entry.iso, entry.sats, bededagPct);
            }

            if (applyStoreBededagRegulering && !storeBededagInserted && STORE_BEDEDAG_START > reguleringsdato && STORE_BEDEDAG_START <= periodeTil) {
              addRow(STORE_BEDEDAG_START, baseSats.sats, STORE_BEDEDAG_PCT);
            }

            return { columns, rows };
          }
          if (loenudviklingBasis === 'Manuelt angivet') {
            const rows = af.loenudviklingManuelTableData
              .map((row, rowIndex): StandardDisplayTableRow | null => {
                const iso = rowIndex === 0 && reguleringsdato ? reguleringsdato : parseDanishToISO(row.dato);
                if (!iso) return null;
                if (iso < reguleringsdato || iso > periodeTil) return null;
                if (rowIsoSet && !rowIsoSet.has(iso)) return null;
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

            const includeBase = Boolean(rowIsoSet?.has(reguleringsdato));

            if (modelLabel.trim().startsWith('ASL-')) {
              const start = parseISODate(reguleringsdato);
              const end = parseISODate(periodeTil);
              if (!start || !end) return null;
              const startYear = start.getFullYear();
              const endYear = end.getFullYear();
              const baseYearIso = formatToISO(new Date(startYear, 0, 1));

              const rows: StandardDisplayTableRow[] = [];
              if (includeBase) {
                const baseValue = aarsloenMax[startYear as keyof typeof aarsloenMax];
                if (typeof baseValue === 'number') {
                  rows.push({
                    key: `asl-${af.id}-${startYear}-base`,
                    cells: [String(startYear), formatCurrency(baseValue)],
                  });
                }
              }

              for (let year = startYear; year <= endYear; year += 1) {
                const value = aarsloenMax[year as keyof typeof aarsloenMax];
                if (typeof value !== 'number') continue;
                const rowIso = formatToISO(new Date(year, 0, 1));
                if (!rowIso) continue;
                if (rowIso === baseYearIso && includeBase) continue;
                if (rowIsoSet && !rowIsoSet.has(rowIso)) continue;
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
                const startIso = formatToISO(new Date(year, month - 1, 1));
                if (!startIso) return null;
                return { kvartal: value.kvartal, startIso, indeks: value.indeks };
              })
              .filter((row): row is Readonly<{ kvartal: Kvartal; startIso: ISODateString; indeks: number }> => Boolean(row))
              .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));

            let basePeriod = periodStarts[0];
            for (const period of periodStarts) {
              if (period.startIso > reguleringsdato) break;
              basePeriod = period;
            }

            const rows: StandardDisplayTableRow[] = [];
            if (includeBase && basePeriod) {
              rows.push({
                key: `stat-${af.id}-base`,
                cells: [
                  basePeriod.kvartal,
                  formatIsoValue(reguleringsdato),
                  basePeriod.indeks.toLocaleString('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                ],
              });
            }

            for (const period of periodStarts) {
              if (basePeriod && period.startIso === basePeriod.startIso && includeBase) continue;
              if (rowIsoSet && !rowIsoSet.has(period.startIso)) continue;
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
              centeredCol('Indeks', 100),
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

      if (loenudviklingBasis === 'Manuelt angivet') {
        rows.push({
          id: 'regulering.navn',
          label: 'Navn på reguleringsform',
          displayValue: manuelReguleringNavnDisplay,
          status: manuelReguleringNavnStatus,
        });
      }

      if (!isIngen) {
        rows.push(
          {
            id: 'regulering.dato',
            label: reguleringsdatoLabel,
            displayValue: reguleringsdatoDisplay,
            status: reguleringsdatoStatus,
          },
          {
            id: 'regulering.slutdato',
            label: 'Sidste dato i erstatningsperiode',
            displayValue: periodeTilDisplay,
            status: periodeTilStatus,
          },
          {
            id: 'regulering.startvaerdi',
            label: 'Reguleringsværdi på start-dato',
            displayValue: startDateRow.display,
            status: startDateRow.status,
          },
          {
            id: 'regulering.slutvaerdi',
            label: 'Reguleringsværdi på slut-dato',
            displayValue: endDateRow.display,
            status: endDateRow.status,
          }
        );
      }

      return {
        id: af.id,
        headerText,
        rows,
        showTable: !isIngen,
        table: reguleringTable,
        indeksTable,
        hasDateRange: Boolean(reguleringsdato && periodeTil),
      };
    });
  }, [
    loenindkomstAnsaettelsesforhold,
    tafPerioder,
    vedroererPeriodeTil,
    ferieperioder,
    skadesdato,
    skadestype,
  ]);

  const indkomstSections = React.useMemo(() => {
    return buildIndkomstSectionStatuses(loenindkomstAnsaettelsesforhold, skadesdato);
  }, [loenindkomstAnsaettelsesforhold, skadesdato]);

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

    let minDate: ISODateString | undefined;
    let maxDate: ISODateString | undefined;
    const addRange = (range: Readonly<{ fra: ISODateString; til: ISODateString }> | undefined): void => {
      if (!range) return;
      minDate = minISO(minDate, range.fra);
      maxDate = maxISO(maxDate, range.til);
    };

    addRange(beregningsRange);

    const ferieRows = [...(erstatningsopgoerelseValues.ferieperioder ?? []), ...(erstatningsopgoerelseValues.fravaerPerioder ?? [])];
    ferieRows.forEach((row) => addRange(getIsoRange(row.fra, row.til)));
    (erstatningsopgoerelseValues.tafPerioder ?? []).forEach((row) => addRange(getIsoRange(row.fra, row.til)));

    for (const af of erstatningsopgoerelseValues.loenindkomstAnsaettelsesforhold ?? []) {
      const rows = af.indtaegtsoplysningerTableData ?? [];
      for (const row of rows) {
        if (isAarsloenRowEffectivelyEmpty(row)) continue;
        const interval = parseAarsloenRowInterval(row, af.loenperiode);
        if (!interval) continue;
        const startISO = dateToISO(interval.start);
        const endISO = dateToISO(interval.end);
        if (!startISO || !endISO) continue;
        addRange({ fra: startISO, til: endISO });
      }
    }

    for (const row of erstatningsopgoerelseValues.offentligeYdelserRows ?? []) {
      addRange(getIsoRange(parseOffentligDato(row.fraDato), parseOffentligDato(row.tilDato)));
    }

    if (!minDate || !maxDate) return { loenRows: [], ydelseRows: [] };

    const shDays = buildSHDageSet(minDate, maxDate);
    const explicitFerie = buildExplicitFerieSet(erstatningsopgoerelseValues, shDays);
    const loseFerie = buildLoseFeriedageSet(erstatningsopgoerelseValues, shDays, explicitFerie);
    const reservedBeregningsperiodeDates = new Set<ISODateString>([...explicitFerie, ...loseFerie]);
    const oevrigeFravaersdageCount =
      erstatningsopgoerelseValues.oevrigtFravaerUdenLoen === 'Ja' &&
      typeof erstatningsopgoerelseValues.oevrigeFravaersdage === 'number'
        ? erstatningsopgoerelseValues.oevrigeFravaersdage
        : 0;
    const oevrigtFravaerDates = allocateWeekdayDates({
      range: beregningsRange,
      count: oevrigeFravaersdageCount,
      shDays,
      reserved: reservedBeregningsperiodeDates,
    });
    const allFerieDates = new Set<ISODateString>([
      ...explicitFerie,
      ...loseFerie,
      ...oevrigtFravaerDates,
    ]);

    const isWorkday = (iso: ISODateString, dateObj: Date): boolean => {
      const dow = dateObj.getDay();
      const erHverdag = dow >= 1 && dow <= 5;
      if (!erHverdag) return false;
      if (shDays.has(iso)) return false;
      if (allFerieDates.has(iso)) return false;
      return true;
    };

    const loenRows: IndkomstRow[] = [];

    (erstatningsopgoerelseValues.loenindkomstAnsaettelsesforhold ?? []).forEach((af, index) => {
      const baseLabel = index === 0 ? 'Ansættelsesforhold' : `Ansættelsesforhold ${index + 1}`;
      const navn = typeof af.navnPaaArbejdssted === 'string' ? af.navnPaaArbejdssted.trim() : '';
      const label = navn !== '' ? `${baseLabel} (${navn})` : baseLabel;

      let total = 0;
      const satser = {
        feriePct: af.feriePct,
        fritvalgPct: af.fritvalgPct,
        shSoPct: af.shSoPct,
        storeBededagPct: af.storeBededagPct,
        pensionPct: af.pensionPct,
      };

      for (const row of af.indtaegtsoplysningerTableData ?? []) {
        if (isAarsloenRowEffectivelyEmpty(row)) continue;
        const interval = parseAarsloenRowInterval(row, af.loenperiode);
        if (!interval) continue;

        const startISO = dateToISO(interval.start);
        const endISO = dateToISO(interval.end);
        if (!startISO || !endISO) continue;

        const rowTotal = calculateAarsloenRowDerived(row, satser).samlet;
        if (rowTotal === 0) continue;

        let workdays = 0;
        iterateDatesInclusive(interval.start, interval.end, (d) => {
          const iso = dateToISO(d);
          if (!iso) return;
          if (isWorkday(iso, d)) workdays += 1;
        });
        if (workdays <= 0) continue;

        const overlapStart = maxISO(startISO, beregningsRange.fra);
        const overlapEnd = minISO(endISO, beregningsRange.til);
        if (!overlapStart || !overlapEnd || overlapStart > overlapEnd) continue;

        const perDay = rowTotal / workdays;
        const overlapStartDate = isoDateToDate(overlapStart);
        const overlapEndDate = isoDateToDate(overlapEnd);

        iterateDatesInclusive(overlapStartDate, overlapEndDate, (d) => {
          const iso = dateToISO(d);
          if (!iso) return;
          if (!isWorkday(iso, d)) return;
          total += perDay;
        });
      }

      if (total > 0) {
        loenRows.push({
          id: `taf.beregningsgrundlag.indkomst.loen.${af.id}`,
          label,
          displayValue: formatCurrency(total),
          status: 'ok',
        });
      }
    });

    const ydelseTotals = new Map<string, number>();
    for (const row of erstatningsopgoerelseValues.offentligeYdelserRows ?? []) {
      const typeKey = row.ydelsestype?.trim() ?? '';
      if (typeKey === '') continue;
      const config = ydelsestyper[typeKey];
      if (!config) continue;

      const range = getIsoRange(parseOffentligDato(row.fraDato), parseOffentligDato(row.tilDato));
      if (!range) continue;

      const total = parseAmount(row.ydelse) + parseAmount(row.tillaeg);
      if (total === 0) continue;

      let dayCount = 0;
      const start = isoDateToDate(range.fra);
      const end = isoDateToDate(range.til);
      iterateDatesInclusive(start, end, (d) => {
        const iso = dateToISO(d);
        if (!iso) return;
        if (isOffentligYdelseDatoMedregnet(iso, d, shDays, config.periodisering, typeKey, range.til)) {
          dayCount += 1;
        }
      });
      if (dayCount <= 0) continue;

      const overlapStart = maxISO(range.fra, beregningsRange.fra);
      const overlapEnd = minISO(range.til, beregningsRange.til);
      if (!overlapStart || !overlapEnd || overlapStart > overlapEnd) continue;

      const perDay = total / dayCount;
      const overlapStartDate = isoDateToDate(overlapStart);
      const overlapEndDate = isoDateToDate(overlapEnd);

      let subtotal = 0;
      iterateDatesInclusive(overlapStartDate, overlapEndDate, (d) => {
        const iso = dateToISO(d);
        if (!iso) return;
        if (!isOffentligYdelseDatoMedregnet(iso, d, shDays, config.periodisering, typeKey, range.til)) return;
        subtotal += perDay;
      });

      if (subtotal > 0) {
        ydelseTotals.set(typeKey, (ydelseTotals.get(typeKey) ?? 0) + subtotal);
      }
    }

    const ydelseRows: IndkomstRow[] = [];
    for (const [typeKey, total] of ydelseTotals) {
      if (total <= 0) continue;
      const label = ydelsestyper[typeKey]?.label ?? typeKey;
      ydelseRows.push({
        id: `taf.beregningsgrundlag.indkomst.ydelse.${typeKey}`,
        label,
        displayValue: formatCurrency(total),
        status: 'ok',
      });
    }

    return { loenRows, ydelseRows };
  }, [erstatningsopgoerelseValues]);

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

        {aesMidlertidigtRows.map((row) => {
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

        {aesEndeligtRows.map((row) => {
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

        {rowsBySection.get('sviesmerte')?.map((row) => {
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
      </ContentBox>

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

      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Indkomst</Typography>

        {indkomstSections.map((section) => (
          <Box key={section.id} sx={{ mb: 2 }}>
            <Typography className="row--subheading">{section.headerText}</Typography>

            {!section.hasArbejdsstedNavn && (
              <Box className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
                <Typography className="row--text">Navn på arbejdssted</Typography>
                <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                  <Typography className="row--text">-</Typography>
                  {getStatusIcon('warning')}
                </Box>
              </Box>
            )}

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

      <ContentBox className="content-box">
        <Typography className="section-header">Tabt arbejdsfortjeneste</Typography>

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
          return (
            <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': labelWidth }}>
              <Typography className="row--text" sx={{ minWidth: labelWidth }}>{row.label}</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">{row.displayValue}</Typography>
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
      </ContentBox>

      
      <ContentBox className="content-box">
        <Typography className="section-header">Regulering</Typography>

        {reguleringSections.map((section) => {
          return (
            <Box key={section.id} sx={{ mb: 2 }}>
              <Typography className="row--subheading">{section.headerText}</Typography>

              {section.rows.map((row) => (
                <Box key={`${section.id}-${row.id}`} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
                  <Typography className="row--text">{row.label}</Typography>
                  <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                    <Typography className="row--text">{row.displayValue}</Typography>
                    {getStatusIcon(row.status)}
                  </Box>
                </Box>
              ))}

              {section.showTable ? (
                section.table ? (
                  <>
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
