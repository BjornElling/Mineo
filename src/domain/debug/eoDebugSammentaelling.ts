import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import type { FieldErrorsForSection } from '../../types/fieldErrors';
import type { ISODateString } from '../../types/branded';
import { formatCurrency, parseAmount } from '../../utils/formatUtils';
import { calculateAarsloenRowDerived, isAarsloenRowEffectivelyEmpty } from '../../utils/aarsloenTableCalculations';
import { debugTabelColumnId } from './eoDebugLoenTypes';
import { ydelsestyper } from '../../data/ydelsestyper';
import type { EODebugModel } from './eoDebugModel';
import { buildEODebugSvieSmerteRows, buildEODebugTaftRows } from '../erstatningsopgoerelse/eoDebugErstatningsopgoerelseModel';
import { calculateTafArbejdsdageBreakdown } from '../erstatningsopgoerelse/tafCalculations';
import { computeTafOverlapWithBeregningsperiode } from '../erstatningsopgoerelse/beregningsperiodeTafOverlap';

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
}>;

export type SammentaellingModel = Readonly<{
  beregningsperiode: SammentaellingControl;
  taf: SammentaellingControl;
  svieSmerteSygedage: SammentaellingControl;
  svieSmerteDelvise: SammentaellingControl;
  loenindkomst: readonly SammentaellingEntry[];
  offentligeYdelser: readonly SammentaellingEntry[];
}>;

type SvieSmerteCounts = Readonly<{ sygedage: number; delviseSygedage: number }>;

type ErstatningsopgoerelseFieldErrors = FieldErrorsForSection<'erstatningsopgoerelse'>;

export type SammentaellingEntry = Readonly<{
  key: string;
  label: string;
  control: SammentaellingControl;
}>;

const getIsoRange = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined
): Readonly<{ fra: ISODateString; til: ISODateString }> | null => {
  if (!fra || !til) return null;
  if (fra > til) return null;
  return { fra, til };
};

const formatDaInt = (value: number): string => value.toLocaleString('da-DK');

const formatOptionalInt = (value: number | null): string => (value === null ? '-' : formatDaInt(value));

const formatOptionalAmount = (value: number | null): string => (value === null ? '-' : formatCurrency(value));

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

  const beregningsRange = getIsoRange(values.periodeTilBeregningFra, values.periodeTilBeregningTil);
  const erstatningsRange = getIsoRange(values.vedroererPeriodeFra, values.vedroererPeriodeTil);

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
    return parsedCount > 0 ? Math.trunc(sum) : null;
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
    const breakdown = calculateTafArbejdsdageBreakdown(periodeFra, periodeTil, beregningsFerieperioder, 0);
    if (!breakdown) return null;

    const oevrigeFravaersdageValue =
      values.oevrigtFravaerUdenLoen === 'Ja' && typeof values.oevrigeFravaersdage === 'number'
        ? values.oevrigeFravaersdage
        : 0;

    return Math.max(0, breakdown.tafDage - oevrigeFravaersdageValue);
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

  return {
    beregningsperiode: {
      beregnetDisplay: beregningsBeregnetDisplay,
      tabelDisplay: beregningsTabelDisplay,
      beregnetValue: beregningsperiodeArbejdsdage,
      tabelValue: beregningsArbejdsdage,
      loseFeriedage: beregningsLoseFeriedage,
      oevrigeFravaersdage: beregningsOevrigeFravaersdage,
      warningEligible: beregningsWarningEligible,
    },
    taf: {
      beregnetDisplay: tafBeregnetDisplay,
      tabelDisplay: tafTabelDisplay,
      beregnetValue: tafBeregnetDays,
      tabelValue: tafArbejdsdageFromTable,
      loseFeriedage: tafLoseFeriedage,
      oevrigeFravaersdage: 0,
      warningEligible: true,
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
    loenindkomst: (() => {
      const entries: SammentaellingEntry[] = [];

      (values.loenindkomstAnsaettelsesforhold ?? []).forEach((af, index) => {
        const rows = af.indtaegtsoplysningerTableData ?? [];
        let hasInput = false;
        let beregnetTotal = 0;

        const satser = {
          feriePct: af.feriePct,
          fritvalgPct: af.fritvalgPct,
          shSoPct: af.shSoPct,
          storeBededagPct: af.storeBededagPct,
          pensionPct: af.pensionPct,
        };

        for (const row of rows) {
          if (isAarsloenRowEffectivelyEmpty(row)) continue;
          hasInput = true;
          const derived = calculateAarsloenRowDerived(row, satser);
          beregnetTotal += derived.samlet;
        }

        if (!hasInput) return;

        const baseLabel = index === 0 ? 'Ansættelsesforhold' : `Ansættelsesforhold ${index + 1}`;
        const navn = typeof af.navnPaaArbejdssted === 'string' ? af.navnPaaArbejdssted.trim() : '';
        const label = navn !== '' ? `${baseLabel} (${navn})` : baseLabel;

        const columnId = debugTabelColumnId.loenWage(index, 'samlet');
        const tabel = sumDebugTableColumn(model, columnId);

        entries.push({
          key: `sammentaelling.loen.${af.id}`,
          label,
          control: {
            beregnetDisplay: formatOptionalAmount(beregnetTotal),
            tabelDisplay: formatOptionalAmount(tabel.sum),
            beregnetValue: beregnetTotal,
            tabelValue: tabel.sum,
            loseFeriedage: 0,
            oevrigeFravaersdage: 0,
            warningEligible: false,
          },
        });
      });

      return entries;
    })(),
    offentligeYdelser: (() => {
      const totalsByType = new Map<string, number>();
      const order: string[] = [];

      for (const row of values.offentligeYdelserRows ?? []) {
        const typeKey = row.ydelsestype?.trim() ?? '';
        if (typeKey === '') continue;
        const total = parseAmount(row.ydelse) + parseAmount(row.tillaeg);
        if (total === 0) continue;
        if (!totalsByType.has(typeKey)) order.push(typeKey);
        totalsByType.set(typeKey, (totalsByType.get(typeKey) ?? 0) + total);
      }

      return order.map((typeKey) => {
        const label = ydelsestyper[typeKey]?.label ?? typeKey;
        const beregnetTotal = totalsByType.get(typeKey) ?? 0;
        const columnId = debugTabelColumnId.offentlig(typeKey);
        const tabel = sumDebugTableColumn(model, columnId);

        return {
          key: `sammentaelling.ydelse.${typeKey}`,
          label,
          control: {
            beregnetDisplay: formatOptionalAmount(beregnetTotal),
            tabelDisplay: formatOptionalAmount(tabel.sum),
            beregnetValue: beregnetTotal,
            tabelValue: tabel.sum,
            loseFeriedage: 0,
            oevrigeFravaersdage: 0,
            warningEligible: false,
          },
        };
      });
    })(),
  };
};
