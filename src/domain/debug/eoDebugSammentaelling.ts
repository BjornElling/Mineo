import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import type { FieldErrorsForSection } from '../../types/fieldErrors';
import type { ISODateString } from '../../types/branded';
import { subtractOneDay } from '../../types/branded';
import { formatCurrency } from '../../utils/formatUtils';
import { debugTabelColumnId } from './eoDebugLoenTypes';
import type { EODebugModel } from './eoDebugModel';
import { buildEODebugSvieSmerteRows } from '../erstatningsopgoerelse/eoDebugErstatningsopgoerelseModel';
import { calculateTafArbejdsdageBreakdown } from '../erstatningsopgoerelse/tafCalculations';
import { computeTafOverlapWithBeregningsperiode } from '../erstatningsopgoerelse/beregningsperiodeTafOverlap';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../erstatningsopgoerelse/tafBeregningsenhed';
import { buildBeregningsperiodeRange, buildIncomeForRanges, buildTafRanges, type IsoRange } from '../erstatningsopgoerelse/indtaegtPerioder';
import { clampTafRange, getValidTafRange, resolveTafConstraintBounds } from '../erstatningsopgoerelse/tafPeriodConstraints';
import { buildFerieDageSet, buildSHDageSet } from './eoDebugRegulationCore';
import { computeTafArbejdsdageAggregation } from '../erstatningsopgoerelse/tafBeregningsEngine';

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
  ferieDageCount?: number | null;
  dateredeFerieDageCount?: number | null;
  loseFerieDageCount?: number | null;
  shDageCount?: number | null;
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
  const formatCount = (value: number | null | undefined): string => {
    const resolved = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return resolved.toLocaleString('da-DK');
  };
  const ferieShPrefix = model.beregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? 'inkl.' : '-';
  const beregningsFerieDageTilLabel =
    model.beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
      ? (model.beregningsperiode.dateredeFerieDageCount ?? model.beregningsperiode.ferieDageCount)
      : model.beregningsperiode.ferieDageCount;
  const tafFerieDageTilLabel =
    model.beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
      ? (model.taf.dateredeFerieDageCount ?? model.taf.ferieDageCount)
      : model.taf.ferieDageCount;
  const beregningsLoseFerieTilLabel = typeof model.beregningsperiode.loseFerieDageCount === 'number'
    ? Math.max(0, model.beregningsperiode.loseFerieDageCount)
    : 0;
  const tafLoseFerieTilLabel = typeof model.taf.loseFerieDageCount === 'number'
    ? Math.max(0, model.taf.loseFerieDageCount)
    : 0;
  const beregningsOevrigtTilLabel = Math.max(0, model.beregningsperiode.oevrigeFravaersdage);
  const beregningsEkstraSuffix = (() => {
    const samletLoseOgFravaer = beregningsLoseFerieTilLabel + beregningsOevrigtTilLabel;
    return samletLoseOgFravaer > 0 ? ` (- ${formatCount(samletLoseOgFravaer)} løse ferie- og fraværsdage)` : '';
  })();
  const tafEkstraSuffix = tafLoseFerieTilLabel > 0
    ? ` (- ${formatCount(tafLoseFerieTilLabel)} løse feriedage)`
    : '';

  const beregningsperiodeLabel =
    `Arbejdsdage i beregningsperiode (${ferieShPrefix} ${formatCount(beregningsFerieDageTilLabel)} feriedage og ${formatCount(model.beregningsperiode.shDageCount)} SH-dage)${beregningsEkstraSuffix}`;

  const tafLabel =
    `Arbejdsdage i TAF-periode (${ferieShPrefix} ${formatCount(tafFerieDageTilLabel)} feriedage og ${formatCount(model.taf.shDageCount)} SH-dage)${tafEkstraSuffix}`;

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

const buildShDatesInRange = (
  range: Readonly<{ fra: ISODateString; til: ISODateString }> | null
): ReadonlySet<ISODateString> => {
  if (!range) return new Set<ISODateString>();
  return buildSHDageSet(range.fra, range.til);
};

const buildFerieDatesInRange = (
  values: ErstatningsopgoerelseValues,
  range: Readonly<{ fra: ISODateString; til: ISODateString }> | null,
  options?: Readonly<{ includeTafLoseFeriedage?: boolean; includeBeregningsperiodeLoseFeriedage?: boolean }>
): ReadonlySet<ISODateString> => {
  if (!range) return new Set<ISODateString>();

  const shDays = buildSHDageSet(range.fra, range.til);
  const ferieperioder = [...(values.ferieperioder ?? []), ...(values.fravaerPerioder ?? [])];
  const includeTafLoseFeriedage = options?.includeTafLoseFeriedage === true;
  const includeBeregningsperiodeLoseFeriedage = options?.includeBeregningsperiodeLoseFeriedage === true;
  const beregningsperiodeLoseFeriedage =
    includeBeregningsperiodeLoseFeriedage && typeof values.uspecificeredeFerieFridage === 'number'
      ? Math.max(0, Math.trunc(values.uspecificeredeFerieFridage))
      : 0;

  const loseFerieSources: Array<{ fra?: ISODateString; til?: ISODateString; loseFeriedage?: number }> = [];
  if (includeTafLoseFeriedage) {
    loseFerieSources.push(...(values.tafPerioder ?? []));
  }
  if (includeBeregningsperiodeLoseFeriedage && beregningsperiodeLoseFeriedage > 0) {
    loseFerieSources.push({
      fra: range.fra,
      til: range.til,
      loseFeriedage: beregningsperiodeLoseFeriedage,
    });
  }

  return buildFerieDageSet(
    { ferieperioder, tafPerioder: loseFerieSources },
    shDays,
    range.fra,
    range.til
  );
};

const formatDaInt = (value: number): string => value.toLocaleString('da-DK');

const formatOptionalInt = (value: number | null): string => (value === null || value === 0 ? '-' : formatDaInt(value));

const formatOptionalAmount = (value: number | null): string =>
  value === null || value === 0 ? '-' : formatCurrency(value);

const isDanishNumberString = (value: string): boolean => {
  if (value.trim() === '') return false;
  return /^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(value) || /^-?\d+(,\d+)?$/.test(value);
};

const parseDanishNumberString = (value: string): number | null => {
  const trimmed = value.trim();
  if (!isDanishNumberString(trimmed)) return null;
  const clean = trimmed.replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(clean);
  return Number.isFinite(parsed) ? parsed : null;
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
    const parsed = parseDanishNumberString(trimmed);
    if (parsed === null) continue;
    sum += parsed;
    hasValue = true;
  }

  return { sum: hasValue ? sum : null, hasColumn: true };
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

  const sygedage = sygedageMatch ? parseDanishNumberString(sygedageMatch[1]) : 0;
  const delviseSygedage = delviseMatch ? parseDanishNumberString(delviseMatch[1]) : 0;
  if (sygedage === null || delviseSygedage === null) return null;

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
    const hasTaf = model.tableData.tafColumnIds.some((colId) => (row.cells[colId] ?? '').trim() === 'Ja');
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
  const { values, errors, model, svieSmerteContext } = args;

  const svieSmerteRows = buildEODebugSvieSmerteRows(values, errors, svieSmerteContext);
  const beregningsenhed = computeTafBeregningsenhed(values);
  const isBeregningsperiode = values.beregnesUdFra === 'Beregningsperiode';
  const isTafEnabled = values.beregnesTabtArbejdsfortjeneste === 'Ja';
  const isSvieSmerteEnabled = values.beregnesSvieSmerteGodtgoerelse === 'Ja';

  const beregningsRange = getIsoRange(values.periodeTilBeregningFra, values.periodeTilBeregningTil);
  const erstatningsRange = getIsoRange(values.vedroererPeriodeFra, values.vedroererPeriodeTil);

  const beregningsFerieDates = buildFerieDatesInRange(values, beregningsRange, {
    includeBeregningsperiodeLoseFeriedage: true,
    includeTafLoseFeriedage: false,
  });
  const beregningsDateredeFerieDates = buildFerieDatesInRange(values, beregningsRange, {
    includeBeregningsperiodeLoseFeriedage: false,
    includeTafLoseFeriedage: false,
  });
  const beregningsShDates = buildShDatesInRange(beregningsRange);
  const beregningsDateredeFerieDageCount = beregningsDateredeFerieDates.size;
  const beregningsFerieDageCount = beregningsFerieDates.size;
  const beregningsLoseFerieDageCount = Math.max(0, beregningsFerieDageCount - beregningsDateredeFerieDageCount);
  const beregningsShDageCount = beregningsShDates.size;
  const beregningsFeriedageCount = beregningsFerieDates.size + beregningsShDates.size;

  const tafBounds = resolveTafConstraintBounds(values);
  const tafFerieDates = (() => {
    const collected = new Set<ISODateString>();
    for (const periode of values.tafPerioder ?? []) {
      const validRange = getValidTafRange(periode);
      if (!validRange) continue;
      const range = clampTafRange(validRange, tafBounds);
      if (!range) continue;
      const set = buildFerieDatesInRange(values, range, {
        includeTafLoseFeriedage: true,
        includeBeregningsperiodeLoseFeriedage: false,
      });
      set.forEach((iso) => collected.add(iso));
    }
    return collected;
  })();
  const tafDateredeFerieDates = (() => {
    const collected = new Set<ISODateString>();
    for (const periode of values.tafPerioder ?? []) {
      const validRange = getValidTafRange(periode);
      if (!validRange) continue;
      const range = clampTafRange(validRange, tafBounds);
      if (!range) continue;
      const set = buildFerieDatesInRange(values, range, {
        includeTafLoseFeriedage: false,
        includeBeregningsperiodeLoseFeriedage: false,
      });
      set.forEach((iso) => collected.add(iso));
    }
    return collected;
  })();
  const tafShDates = (() => {
    const collected = new Set<ISODateString>();
    for (const periode of values.tafPerioder ?? []) {
      const validRange = getValidTafRange(periode);
      if (!validRange) continue;
      const range = clampTafRange(validRange, tafBounds);
      if (!range) continue;
      const set = buildShDatesInRange(range);
      set.forEach((iso) => collected.add(iso));
    }
    return collected;
  })();
  const tafDateredeFerieDageCount = tafDateredeFerieDates.size;
  const tafFerieDageCount = tafFerieDates.size;
  const tafLoseFerieDageCount = Math.max(0, tafFerieDageCount - tafDateredeFerieDageCount);
  const tafShDageCount = tafShDates.size;
  const tafFeriedageCount = tafFerieDates.size + tafShDates.size;

  const beregningsArbejdsdage = isBeregningsperiode
    ? countArbejdsdageInRange(model, beregningsRange)
    : null;
  const tafArbejdsdageFromTable = isTafEnabled ? countTafDaysFromTable(model) : null;
  const svieSmerteTabelCounts = isSvieSmerteEnabled ? countSvieSmerteFromTable(model, erstatningsRange) : null;

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

  const tafBeregnetDays = isTafEnabled
    ? computeTafArbejdsdageAggregation({
      erstatningsopgoerelse: values,
      tafPerioder: values.tafPerioder ?? [],
      ferieperioder: values.ferieperioder ?? [],
      beregningsenhed,
    })
    : null;

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
      typeof values.uspecificeredeFerieFridage === 'number' ? values.uspecificeredeFerieFridage : 0,
      { kind: 'beregningsgrundlag', oevrigeFravaersdage: oevrigeFravaersdageValue }
    );
    if (!breakdown) return null;

    // Systematik:
    // - Måneder: beregnet værdi i sammentælling er rene hverdage (ingen fradrag).
    // - Arbejdsdage: beregnet værdi er hverdage minus SH/ferie/løse ferie/øvrigt fravær.
    if (beregningsenhed === TAF_BEREGNES_SOM.MAANEDER) {
      return Math.max(0, breakdown.arbejdsdage);
    }
    return Math.max(0, breakdown.tafDage);
  })();

  const beregningsBeregnetDisplay = formatOptionalInt(beregningsperiodeArbejdsdage);
  const tafBeregnetDisplay = formatOptionalInt(tafBeregnetDays);

  const beregningsLoseFeriedage = beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
    ? beregningsLoseFerieDageCount
    : 0;
  const beregningsOevrigeFravaersdage =
    beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
      && values.oevrigtFravaerUdenLoen === 'Ja'
      && typeof values.oevrigeFravaersdage === 'number'
      ? values.oevrigeFravaersdage
      : 0;
  const beregningsTabelFradrag = beregningsLoseFeriedage + beregningsOevrigeFravaersdage;

  const tafLoseFeriedage = (values.tafPerioder ?? []).reduce((sum, row) => {
    const validRange = getValidTafRange(row);
    if (!validRange) return sum;
    const range = clampTafRange(validRange, tafBounds);
    if (!range) return sum;
    const next = typeof row.loseFeriedage === 'number' ? row.loseFeriedage : 0;
    return sum + next;
  }, 0);
  const tafLoseFeriedageForControl = isTafEnabled && beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE ? tafLoseFeriedage : 0;
  const tafTabelFradrag = tafLoseFeriedageForControl;

  const withTabelFradragDisplay = (tableValue: number | null, fradrag: number): string => {
    const base = formatOptionalInt(tableValue);
    if (tableValue === null || fradrag <= 0) return base;
    return `${base} (- ${formatDaInt(fradrag)})`;
  };

  const applyTabelFradrag = (tableValue: number | null, fradrag: number): number | null => {
    if (tableValue === null) return null;
    return Math.max(0, tableValue - fradrag);
  };

  const beregningsTabelDisplay = withTabelFradragDisplay(beregningsArbejdsdage, beregningsTabelFradrag);
  const tafTabelDisplay = withTabelFradragDisplay(tafArbejdsdageFromTable, tafTabelFradrag);
  const beregningsTabelValueForControl = applyTabelFradrag(beregningsArbejdsdage, beregningsTabelFradrag);
  const tafTabelValueForControl = applyTabelFradrag(tafArbejdsdageFromTable, tafTabelFradrag);

  const beregningsperiodeRange = isBeregningsperiode ? buildBeregningsperiodeRange(values) : undefined;
  const beregningsperiodeRanges = beregningsperiodeRange ? [beregningsperiodeRange] : [];
  const tafRanges = isTafEnabled ? buildTafRanges(values) : [];

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
      tabelValue: beregningsTabelValueForControl,
      loseFeriedage: beregningsLoseFeriedage,
      oevrigeFravaersdage: beregningsOevrigeFravaersdage,
      warningEligible: false,
      feriedageCount: isBeregningsperiode ? beregningsFeriedageCount : 0,
      ferieDageCount: isBeregningsperiode ? beregningsFerieDageCount : 0,
      dateredeFerieDageCount: isBeregningsperiode ? beregningsDateredeFerieDageCount : 0,
      loseFerieDageCount: isBeregningsperiode ? beregningsLoseFerieDageCount : 0,
      shDageCount: isBeregningsperiode ? beregningsShDageCount : 0,
    },
    taf: {
      beregnetDisplay: tafBeregnetDisplay,
      tabelDisplay: tafTabelDisplay,
      beregnetValue: tafBeregnetDays,
      tabelValue: tafTabelValueForControl,
      loseFeriedage: tafLoseFeriedageForControl,
      oevrigeFravaersdage: 0,
      warningEligible: false,
      feriedageCount: isTafEnabled ? tafFeriedageCount : 0,
      ferieDageCount: isTafEnabled ? tafFerieDageCount : 0,
      dateredeFerieDageCount: isTafEnabled ? tafDateredeFerieDageCount : 0,
      loseFerieDageCount: isTafEnabled ? tafLoseFerieDageCount : 0,
      shDageCount: isTafEnabled ? tafShDageCount : 0,
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
