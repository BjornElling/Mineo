import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import type { FieldErrorsForSection } from '../../types/fieldErrors';
import type { ISODateString } from '../../types/branded';
import { dateToISO, subtractOneDay } from '../../types/branded';
import { formatCurrency, parseAmount } from '../../utils/formatUtils';
import { debugTabelColumnId } from './eoDebugLoenTypes';
import type { EODebugModel } from './eoDebugModel';
import { buildEODebugSvieSmerteRows, buildEODebugTaftRows } from '../erstatningsopgoerelse/eoDebugErstatningsopgoerelseModel';
import { calculateTafArbejdsdageBreakdown } from '../erstatningsopgoerelse/tafCalculations';
import { computeTafOverlapWithBeregningsperiode } from '../erstatningsopgoerelse/beregningsperiodeTafOverlap';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../erstatningsopgoerelse/tafBeregningsenhed';
import { buildBeregningsperiodeRange, buildIncomeForRanges, buildTafRanges, type IsoRange } from '../erstatningsopgoerelse/indtaegtPerioder';
import { buildFerieDageSet, buildSHDageSet } from './eoDebugRegulationCore';
import { isoDateToDate } from '../dates/isoDate';

export type SvieSmerteContext = Readonly<{
  skadesdatoISO: ISODateString | undefined;
  erErhvervssygdom: boolean;
  menAfgoerelseDatoForTabel: ISODateString | undefined;
  verserendeKlageMen: boolean;
}>;

export type TaftContext = Readonly<{
  skadesdatoISO: ISODateString | undefined;
  erErhvervssygdom: boolean;
  endeligEETBeregnetDato: ISODateString | undefined;
  differencekravDato: ISODateString | undefined;
  verserendeKlageEet: boolean;
}>;

export type SammentaellingControl = Readonly<{
  beregnetDisplay: string;
  tabelDisplay: string;
  beregnetValue: number | null;
  tabelValue: number | null;
  loseFeriedage: number;
  oevrigeFravaersdage: number;
  warningEligible: boolean;
  feriedageCount?: number | null;
}>;

export type SammentaellingControlStatus = 'ok' | 'warning' | 'error';

export type SammentaellingModel = Readonly<{
  beregningsenhed: TafBeregningsenhed;
  beregningsperiode: SammentaellingControl;
  taf: SammentaellingControl;
  svieSmerteSygedage: SammentaellingControl;
  svieSmerteDelvise: SammentaellingControl;
  beregningsperiodeIndtaegter: readonly SammentaellingEntry[];
  tafIndtaegter: readonly SammentaellingEntry[];
}>;

type SvieSmerteCounts = Readonly<{ sygedage: number; delviseSygedage: number }>;

type ErstatningsopgoerelseFieldErrors = FieldErrorsForSection<'erstatningsopgoerelse'>;

export type SammentaellingEntry = Readonly<{
  key: string;
  label: string;
  control: SammentaellingControl;
}>;

export type SammentaellingDisplayRow = Readonly<{
  key: string;
  label: string;
  control: SammentaellingControl;
}>;

export const buildSvieSmerteContext = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues
): SvieSmerteContext => {
  const erErhvervssygdom = stamdataValues.skadestype === 'Erhvervssygdom';
  const menAfgoerelseDatoForTabel =
    eoValues.varigeMenAfgorelse === 'Ja' ? subtractOneDay(eoValues.menAfgoerelseDato) : undefined;
  const verserendeKlageMen = eoValues.verserendeKlageMen === 'Ja';

  return {
    skadesdatoISO: stamdataValues.skadesdato,
    erErhvervssygdom,
    menAfgoerelseDatoForTabel,
    verserendeKlageMen,
  };
};

export const buildTaftContext = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues
): TaftContext => {
  const erErhvervssygdom = stamdataValues.skadestype === 'Erhvervssygdom';
  const endeligEETBeregnetDato =
    eoValues.endeligtEetAfgorelse === 'Ja'
      ? eoValues.endeligEETVirkningsdato || eoValues.endeligEETAfgoerelseDato
      : undefined;
  const verserendeKlageEet = eoValues.verserendeKlageEet === 'Ja';

  return {
    skadesdatoISO: stamdataValues.skadesdato,
    erErhvervssygdom,
    endeligEETBeregnetDato,
    differencekravDato: eoValues.differencekravDato,
    verserendeKlageEet,
  };
};

export const getSammentaellingWarningMeta = (
  control: SammentaellingControl
): Readonly<{ tabel: number; lose: number; oevrige: number; beregnet: number }> | null => {
  if (!control.warningEligible) return null;
  if (control.beregnetValue === null || control.tabelValue === null) return null;
  if (control.beregnetValue === control.tabelValue) return null;

  if (control.tabelValue - control.loseFeriedage - control.oevrigeFravaersdage !== control.beregnetValue) {
    return null;
  }

  return {
    tabel: control.tabelValue,
    lose: control.loseFeriedage,
    oevrige: control.oevrigeFravaersdage,
    beregnet: control.beregnetValue,
  };
};

export const getSammentaellingControlStatus = (control: SammentaellingControl): SammentaellingControlStatus => {
  // Explicit domain choice: tiny tolerance (0.005) for floating rounding; 0 and null are treated as empty ("-") in UI.
  const EPS = 0.005;
  const normalizedBeregnet = control.beregnetValue === null || control.beregnetValue === 0 ? null : control.beregnetValue;
  const normalizedTabel = control.tabelValue === null || control.tabelValue === 0 ? null : control.tabelValue;

  if (normalizedBeregnet === null && normalizedTabel === null) {
    return 'ok';
  }

  if (
    typeof normalizedBeregnet === 'number' &&
    typeof normalizedTabel === 'number' &&
    Number.isFinite(normalizedBeregnet) &&
    Number.isFinite(normalizedTabel) &&
    Math.abs(normalizedBeregnet - normalizedTabel) <= EPS
  ) {
    return 'ok';
  }
  if (getSammentaellingWarningMeta(control)) {
    return 'warning';
  }
  return 'error';
};

export type SammentaellingDisplayTables = Readonly<{
  basis: readonly SammentaellingDisplayRow[];
  beregningsperiode: readonly SammentaellingDisplayRow[];
  taf: readonly SammentaellingDisplayRow[];
}>;

export const buildSammentaellingDisplayTables = (model: SammentaellingModel): SammentaellingDisplayTables => {
  const formatFeriedage = (value: number | null | undefined): string => {
    const resolved = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return resolved.toLocaleString('da-DK');
  };

  const beregningsperiodeLabel = model.beregningsenhed === TAF_BEREGNES_SOM.MAANEDER
    ? `Arbejdsdage i beregningsperiode (+ ${formatFeriedage(model.beregningsperiode.feriedageCount)} ferie- og SH-dage)`
    : 'Arbejdsdage i beregningsperiode';

  const tafLabel = model.beregningsenhed === TAF_BEREGNES_SOM.MAANEDER
    ? `Arbejdsdage i TAF-periode (+ ${formatFeriedage(model.taf.feriedageCount)} ferie- og SH-dage)`
    : 'Arbejdsdage i TAF-periode';

  const basisRows: SammentaellingDisplayRow[] = [
    {
      key: 'arbejdsdage-beregning',
      label: beregningsperiodeLabel,
      control: model.beregningsperiode,
    },
    {
      key: 'arbejdsdage-taf',
      label: tafLabel,
      control: model.taf,
    },
    {
      key: 'svie-smerte-sygedage',
      label: 'Svie/smerte, sygedage',
      control: model.svieSmerteSygedage,
    },
    {
      key: 'svie-smerte-delvise',
      label: 'Svie/smerte, delvise sygedage',
      control: model.svieSmerteDelvise,
    },
  ];

  const beregningsperiodeRows = model.beregningsperiodeIndtaegter.map((entry) => ({
    key: entry.key,
    label: entry.label,
    control: entry.control,
  }));

  const tafRows = model.tafIndtaegter.map((entry) => ({
    key: entry.key,
    label: entry.label,
    control: entry.control,
  }));

  return {
    basis: basisRows,
    beregningsperiode: beregningsperiodeRows,
    taf: tafRows,
  };
};

export const buildSammentaellingDisplayRows = (model: SammentaellingModel): SammentaellingDisplayRow[] => {
  const tables = buildSammentaellingDisplayTables(model);
  return [...tables.basis, ...tables.beregningsperiode, ...tables.taf];
};

const getIsoRange = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined
): Readonly<{ fra: ISODateString; til: ISODateString }> | null => {
  if (!fra || !til) return null;
  if (fra > til) return null;
  return { fra, til };
};

const allocateWeekdayDates = (args: {
  range: Readonly<{ fra: ISODateString; til: ISODateString }> | null;
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

  const current = new Date(start);
  while (current <= end) {
    if (remaining <= 0) break;
    const dow = current.getDay();
    const erHverdag = dow >= 1 && dow <= 5;
    if (!erHverdag) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    const iso = dateToISO(current);
    if (!iso) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    if (shDays.has(iso) || reserved.has(iso)) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    selected.add(iso);
    reserved.add(iso);
    remaining -= 1;
    current.setDate(current.getDate() + 1);
  }

  return selected;
};

const buildShDatesInRange = (
  range: Readonly<{ fra: ISODateString; til: ISODateString }> | null
): ReadonlySet<ISODateString> => {
  if (!range) return new Set<ISODateString>();
  return buildSHDageSet(range.fra, range.til);
};

const buildFerieDatesInRange = (
  values: ErstatningsopgoerelseValues,
  range: Readonly<{ fra: ISODateString; til: ISODateString }> | null
): ReadonlySet<ISODateString> => {
  if (!range) return new Set<ISODateString>();

  const shDays = buildSHDageSet(range.fra, range.til);
  const ferieperioder = [...(values.ferieperioder ?? []), ...(values.fravaerPerioder ?? [])];
  const ferieDates = buildFerieDageSet(
    { ferieperioder, tafPerioder: values.tafPerioder ?? [] },
    shDays,
    range.fra,
    range.til
  );

  const reserved = new Set<ISODateString>(ferieDates);
  const oevrigeFravaersdageCount =
    values.oevrigtFravaerUdenLoen === 'Ja' && typeof values.oevrigeFravaersdage === 'number'
      ? values.oevrigeFravaersdage
      : 0;

  const oevrigtFravaerDates = allocateWeekdayDates({
    range,
    count: oevrigeFravaersdageCount,
    shDays,
    reserved,
  });

  return new Set<ISODateString>([...ferieDates, ...oevrigtFravaerDates]);
};

const formatDaInt = (value: number): string => value.toLocaleString('da-DK');

const formatOptionalInt = (value: number | null): string => (value === null || value === 0 ? '-' : formatDaInt(value));

const formatOptionalAmount = (value: number | null): string =>
  value === null || value === 0 ? '-' : formatCurrency(value);

const isDanishNumberString = (value: string): boolean => {
  if (value.trim() === '') return false;
  return /^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(value) || /^-?\d+(,\d+)?$/.test(value);
};

const sumDebugTableColumn = (
  model: EODebugModel,
  columnId: string
): { sum: number | null; hasColumn: boolean } => {
  if (model.rowCount === 0) return { sum: null, hasColumn: false };
  const hasColumn = model.columns.some((col) => col.id === columnId);
  if (!hasColumn) return { sum: null, hasColumn: false };

  const raw = model.columnRawValues.get(columnId as never);
  if (raw) {
    let sum = 0;
    let hasValue = false;
    for (let i = 0; i < raw.length; i += 1) {
      const value = raw[i] ?? 0;
      if (value === 0) continue;
      sum += value;
      hasValue = true;
    }
    return { sum: hasValue ? sum : null, hasColumn: true };
  }

  let sum = 0;
  let hasValue = false;
  for (let rowIndex = 0; rowIndex < model.rowCount; rowIndex += 1) {
    const cell = model.getCell(rowIndex, columnId as never);
    const trimmed = String(cell ?? '').trim();
    if (trimmed === '' || trimmed === '-') continue;
    if (!isDanishNumberString(trimmed)) continue;
    const parsed = parseAmount(trimmed);
    if (!Number.isFinite(parsed)) continue;
    sum += parsed;
    hasValue = true;
  }

  return { sum: hasValue ? sum : null, hasColumn: true };
};

const buildRangeMask = (dates: readonly ISODateString[], ranges: readonly IsoRange[]): readonly boolean[] => {
  if (ranges.length === 0) return [];
  return dates.map((iso) => ranges.some((range) => iso >= range.fra && iso <= range.til));
};

const sumDebugTableColumnInRanges = (
  model: EODebugModel,
  columnId: string,
  ranges: readonly IsoRange[]
): { sum: number | null; hasColumn: boolean } => {
  if (model.rowCount === 0) return { sum: null, hasColumn: false };
  const hasColumn = model.columns.some((col) => col.id === columnId);
  if (!hasColumn) return { sum: null, hasColumn: false };
  if (ranges.length === 0) return { sum: null, hasColumn: true };

  const mask = buildRangeMask(model.tableData.dates, ranges);
  if (mask.length === 0) return { sum: null, hasColumn: true };

  const raw = model.columnRawValues.get(columnId as never);
  if (raw) {
    let sum = 0;
    let hasValue = false;
    for (let i = 0; i < raw.length; i += 1) {
      if (!mask[i]) continue;
      const value = raw[i] ?? 0;
      if (value === 0) continue;
      sum += value;
      hasValue = true;
    }
    return { sum: hasValue ? sum : null, hasColumn: true };
  }

  let sum = 0;
  let hasValue = false;
  for (let rowIndex = 0; rowIndex < model.rowCount; rowIndex += 1) {
    if (!mask[rowIndex]) continue;
    const cell = model.getCell(rowIndex, columnId as never);
    const trimmed = String(cell ?? '').trim();
    if (trimmed === '' || trimmed === '-') continue;
    if (!isDanishNumberString(trimmed)) continue;
    const parsed = parseAmount(trimmed);
    if (!Number.isFinite(parsed)) continue;
    sum += parsed;
    hasValue = true;
  }

  return { sum: hasValue ? sum : null, hasColumn: true };
};

const parseTafDaysFromDisplay = (value: string): number | null => {
  const match = value.match(/=\s*([0-9.,]+)\s*TAF-dage/i);
  if (!match) return null;
  const parsed = parseAmount(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseSvieSmerteCounts = (value: string): SvieSmerteCounts | null => {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '-') {
    return { sygedage: 0, delviseSygedage: 0 };
  }
  if (trimmed.toLowerCase().startsWith('fejl')) return null;

  const sygedageMatch = trimmed.match(/([0-9.,]+)\s+sygedage/i);
  const delviseMatch = trimmed.match(/([0-9.,]+)\s+delvise sygedage/i);

  if (!sygedageMatch && !delviseMatch) return null;

  const sygedage = sygedageMatch ? parseAmount(sygedageMatch[1]) : 0;
  const delviseSygedage = delviseMatch ? parseAmount(delviseMatch[1]) : 0;

  if (!Number.isFinite(sygedage) || !Number.isFinite(delviseSygedage)) return null;

  return {
    sygedage: Math.trunc(sygedage),
    delviseSygedage: Math.trunc(delviseSygedage),
  };
};

const countArbejdsdageInRange = (
  model: EODebugModel,
  range: Readonly<{ fra: ISODateString; til: ISODateString }> | null
): number | null => {
  if (!range || model.rowCount === 0) return null;
  let count = 0;
  for (let i = 0; i < model.tableData.dates.length; i += 1) {
    const iso = model.tableData.dates[i];
    if (iso < range.fra || iso > range.til) continue;
    if (model.tableData.isWorkdayByIndex[i]) count += 1;
  }
  return count;
};

const countTafDaysFromTable = (model: EODebugModel): number | null => {
  if (model.rowCount === 0) return null;
  if (model.tableData.tafColumnIds.length === 0) return null;

  let count = 0;
  for (let rowIndex = 0; rowIndex < model.rowCount; rowIndex += 1) {
    const row = model.rows[rowIndex];
    if (!row) continue;
    const hasTaf = model.tableData.tafColumnIds.some((colId) => row.cells[colId] === 'Ja');
    if (hasTaf) count += 1;
  }
  return count;
};

const countSvieSmerteFromTable = (
  model: EODebugModel,
  range: Readonly<{ fra: ISODateString; til: ISODateString }> | null
): SvieSmerteCounts | null => {
  if (!range || model.rowCount === 0) return null;
  let sygedage = 0;
  let delviseSygedage = 0;
  for (let i = 0; i < model.tableData.dates.length; i += 1) {
    const iso = model.tableData.dates[i];
    if (iso < range.fra || iso > range.til) continue;
    const cell = model.tableData.ssStatusByIndex[i];
    if (cell === 'Ja') sygedage += 1;
    if (cell === 'Delvis') delviseSygedage += 1;
  }
  return { sygedage, delviseSygedage };
};

export const buildEODebugSammentaellingModel = (args: {
  values: ErstatningsopgoerelseValues;
  errors: ErstatningsopgoerelseFieldErrors;
  model: EODebugModel;
  svieSmerteContext: SvieSmerteContext;
  taftContext: TaftContext;
}): SammentaellingModel => {
  const { values, errors, model, svieSmerteContext, taftContext } = args;

  const svieSmerteRows = buildEODebugSvieSmerteRows(values, errors, svieSmerteContext);
  const taftRows = buildEODebugTaftRows(values, errors, taftContext);
  const beregningsenhed = computeTafBeregningsenhed(values);

  const beregningsRange = getIsoRange(values.periodeTilBeregningFra, values.periodeTilBeregningTil);
  const erstatningsRange = getIsoRange(values.vedroererPeriodeFra, values.vedroererPeriodeTil);

  const beregningsFerieDates = buildFerieDatesInRange(values, beregningsRange);
  const beregningsShDates = buildShDatesInRange(beregningsRange);
  const beregningsFeriedageCount = beregningsFerieDates.size + beregningsShDates.size;

  const tafFerieDates = (() => {
    const collected = new Set<ISODateString>();
    for (const periode of values.tafPerioder ?? []) {
      const range = getIsoRange(periode.fra, periode.til);
      const set = buildFerieDatesInRange(values, range);
      set.forEach((iso) => collected.add(iso));
    }
    return collected;
  })();
  const tafShDates = (() => {
    const collected = new Set<ISODateString>();
    for (const periode of values.tafPerioder ?? []) {
      const range = getIsoRange(periode.fra, periode.til);
      const set = buildShDatesInRange(range);
      set.forEach((iso) => collected.add(iso));
    }
    return collected;
  })();
  const tafFeriedageCount = tafFerieDates.size + tafShDates.size;

  const beregningsArbejdsdage = countArbejdsdageInRange(model, beregningsRange);
  const tafArbejdsdageFromTable = countTafDaysFromTable(model);
  const svieSmerteTabelCounts = countSvieSmerteFromTable(model, erstatningsRange);

  const svieSmerteBeregnetRow = svieSmerteRows.find((row) => row.id === 'sviesmerte.antalDage');
  const svieSmerteBeregnetCounts = svieSmerteBeregnetRow
    ? parseSvieSmerteCounts(svieSmerteBeregnetRow.displayValue)
    : null;

  const svieSmerteSygedageDisplays = (() => {
    if (!svieSmerteBeregnetRow) {
      return { beregnet: '-', tabel: '-' };
    }

    const trimmed = svieSmerteBeregnetRow.displayValue.trim();
    if (trimmed.toLowerCase().startsWith('fejl')) {
      return { beregnet: svieSmerteBeregnetRow.displayValue, tabel: '-' };
    }

    const beregnet = svieSmerteBeregnetCounts ? formatOptionalInt(svieSmerteBeregnetCounts.sygedage) : '-';
    const tabel = svieSmerteTabelCounts ? formatOptionalInt(svieSmerteTabelCounts.sygedage) : '-';
    return { beregnet, tabel };
  })();

  const svieSmerteDelviseDisplays = (() => {
    if (!svieSmerteBeregnetRow) {
      return { beregnet: '-', tabel: '-' };
    }

    const trimmed = svieSmerteBeregnetRow.displayValue.trim();
    if (trimmed.toLowerCase().startsWith('fejl')) {
      return { beregnet: svieSmerteBeregnetRow.displayValue, tabel: '-' };
    }

    const beregnet = svieSmerteBeregnetCounts ? formatOptionalInt(svieSmerteBeregnetCounts.delviseSygedage) : '-';
    const tabel = svieSmerteTabelCounts ? formatOptionalInt(svieSmerteTabelCounts.delviseSygedage) : '-';
    return { beregnet, tabel };
  })();

  const tafBeregnetDays = (() => {
    let sum = 0;
    let parsedCount = 0;
    for (const row of taftRows) {
      if (!row.id.startsWith('taf.periode.')) continue;
      const parsed = parseTafDaysFromDisplay(row.displayValue);
      if (parsed === null) continue;
      sum += parsed;
      parsedCount += 1;
    }
    const base = parsedCount > 0 ? Math.trunc(sum) : null;
    if (base === null) return null;
    if (beregningsenhed !== TAF_BEREGNES_SOM.MAANEDER) return base;
    return base + tafFeriedageCount;
  })();

  const beregningsperiodeArbejdsdage = (() => {
    if (values.beregnesUdFra !== 'Beregningsperiode') return null;

    const periodeFra = values.periodeTilBeregningFra;
    const periodeTil = values.periodeTilBeregningTil;
    if (!periodeFra || !periodeTil) return null;
    if (periodeFra > periodeTil) return null;

    const overlap = computeTafOverlapWithBeregningsperiode({
      beregningsperiode: { fra: periodeFra, til: periodeTil },
      tafPerioder: (values.tafPerioder ?? []).map((periode) => ({
        id: periode.id,
        fra: periode.fra,
        til: periode.til,
      })),
    });
    if (overlap.firstOverlapMessage) return null;

    if (values.oevrigtFravaerUdenLoen === 'Ja' && values.oevrigeFravaersdage === undefined) {
      return null;
    }

    const beregningsFerieperioder = values.fravaerPerioder ?? [];
    const oevrigeFravaersdageValue =
      values.oevrigtFravaerUdenLoen === 'Ja' && typeof values.oevrigeFravaersdage === 'number'
        ? values.oevrigeFravaersdage
        : 0;
    const breakdown = calculateTafArbejdsdageBreakdown(
      periodeFra,
      periodeTil,
      beregningsFerieperioder,
      0,
      { kind: 'beregningsgrundlag', oevrigeFravaersdage: oevrigeFravaersdageValue }
    );
    if (!breakdown) return null;

    const base = Math.max(0, breakdown.tafDage);
    if (beregningsenhed !== TAF_BEREGNES_SOM.MAANEDER) return base;
    return base + beregningsFeriedageCount;
  })();

  const beregningsBeregnetDisplay = formatOptionalInt(beregningsperiodeArbejdsdage);
  const beregningsTabelDisplay = formatOptionalInt(beregningsArbejdsdage);
  const tafBeregnetDisplay = formatOptionalInt(tafBeregnetDays);
  const tafTabelDisplay = formatOptionalInt(tafArbejdsdageFromTable);

  const beregningsLoseFeriedage = 0;
  const beregningsOevrigeFravaersdage =
    values.oevrigtFravaerUdenLoen === 'Ja' && typeof values.oevrigeFravaersdage === 'number'
      ? values.oevrigeFravaersdage
      : 0;
  const beregningsWarningEligible =
    values.oevrigtFravaerUdenLoen !== 'Ja' || typeof values.oevrigeFravaersdage === 'number';

  const tafLoseFeriedage = (values.tafPerioder ?? []).reduce((sum, row) => {
    const next = typeof row.loseFeriedage === 'number' ? row.loseFeriedage : 0;
    return sum + next;
  }, 0);

  const beregningsperiodeRange = buildBeregningsperiodeRange(values);
  const beregningsperiodeRanges = beregningsperiodeRange ? [beregningsperiodeRange] : [];
  const tafRanges = buildTafRanges(values);

  const buildIndtaegtEntries = (ranges: readonly IsoRange[], scopeLabel: string): SammentaellingEntry[] => {
    const income = buildIncomeForRanges(values, ranges);
    const entries: SammentaellingEntry[] = [];

    income.employers.forEach((entry, index) => {
      const baseLabel = index === 0 ? 'Ansættelsesforhold' : `Ansættelsesforhold ${index + 1}`;
      const navn = entry.name.trim();
      const label = navn !== '' ? `${baseLabel} (${navn})` : baseLabel;
      const columnId = debugTabelColumnId.loenWage(entry.index, 'samlet');
      const tabel = sumDebugTableColumnInRanges(model, columnId, ranges);
      entries.push({
        key: `sammentaelling.${scopeLabel}.loen.${entry.id}`,
        label,
        control: {
          beregnetDisplay: formatOptionalAmount(entry.amount),
          tabelDisplay: formatOptionalAmount(tabel.sum),
          beregnetValue: entry.amount,
          tabelValue: tabel.sum,
          loseFeriedage: 0,
          oevrigeFravaersdage: 0,
          warningEligible: false,
        },
      });
    });

    income.benefits.forEach((entry) => {
      const columnId = entry.typeKey ? debugTabelColumnId.offentlig(entry.typeKey) : '';
      const tabel = columnId !== '' ? sumDebugTableColumnInRanges(model, columnId, ranges) : { sum: null, hasColumn: false };
      entries.push({
        key: `sammentaelling.${scopeLabel}.ydelse.${entry.typeKey || entry.label}`,
        label: entry.label,
        control: {
          beregnetDisplay: formatOptionalAmount(entry.amount),
          tabelDisplay: formatOptionalAmount(tabel.sum),
          beregnetValue: entry.amount,
          tabelValue: tabel.sum,
          loseFeriedage: 0,
          oevrigeFravaersdage: 0,
          warningEligible: false,
        },
      });
    });

    return entries;
  };

  return {
    beregningsenhed,
    beregningsperiode: {
      beregnetDisplay: beregningsBeregnetDisplay,
      tabelDisplay: beregningsTabelDisplay,
      beregnetValue: beregningsperiodeArbejdsdage,
      tabelValue: beregningsArbejdsdage,
      loseFeriedage: beregningsLoseFeriedage,
      oevrigeFravaersdage: beregningsOevrigeFravaersdage,
      warningEligible: beregningsWarningEligible,
      feriedageCount: beregningsFeriedageCount,
    },
    taf: {
      beregnetDisplay: tafBeregnetDisplay,
      tabelDisplay: tafTabelDisplay,
      beregnetValue: tafBeregnetDays,
      tabelValue: tafArbejdsdageFromTable,
      loseFeriedage: tafLoseFeriedage,
      oevrigeFravaersdage: 0,
      warningEligible: true,
      feriedageCount: tafFeriedageCount,
    },
    svieSmerteSygedage: {
      beregnetDisplay: svieSmerteSygedageDisplays.beregnet,
      tabelDisplay: svieSmerteSygedageDisplays.tabel,
      beregnetValue: null,
      tabelValue: null,
      loseFeriedage: 0,
      oevrigeFravaersdage: 0,
      warningEligible: false,
    },
    svieSmerteDelvise: {
      beregnetDisplay: svieSmerteDelviseDisplays.beregnet,
      tabelDisplay: svieSmerteDelviseDisplays.tabel,
      beregnetValue: null,
      tabelValue: null,
      loseFeriedage: 0,
      oevrigeFravaersdage: 0,
      warningEligible: false,
    },
    beregningsperiodeIndtaegter: buildIndtaegtEntries(beregningsperiodeRanges, 'beregningsperiode'),
    tafIndtaegter: buildIndtaegtEntries(tafRanges, 'taf'),
  };
};
