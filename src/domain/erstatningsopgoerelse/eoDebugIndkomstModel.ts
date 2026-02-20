import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { parseISODate } from '../../types/branded';
import { createDate, formatDanishDate } from '../../utils/dateUtils';
import {
  getAarsloenTableValidation,
  isAarsloenTableValueEffectivelyEmptyForValidation,
} from '../../utils/aarsloenTableValidation';
import {
  getOffentligeYdelserRowFilledState,
  getOffentligeYdelserTableValidation,
  parseOffentligeYdelserCellKey,
} from '../../utils/offentligeYdelserTableValidation';
import { ydelsestyper } from '../../data/ydelsestyper';
import {
  getEffektiveSatserForDato,
  resolveOverenskomstRef,
  type OverenskomstId,
  isOffentligOverenskomstId,
  getOffentligTillaegsSatserForDato,
} from '../../data/overenskomstRates';
import type { DebugStatus } from '../debug/eoDebugTypes';
import { buildAarsloenCellErrors, buildOffentligeYdelserCellErrors } from './indkomstRowValidation';
import { formatCurrency } from '../../utils/formatUtils';
import { parseAmount } from '../../utils/numberParsing';
import type { AarsloenTableColumnKey, OffentligeYdelserTableColumnKey } from '../../types/table';
import type { Loenperiode } from '../../types/loen';

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

export type IndkomstSectionStatus = Readonly<{
  id: string;
  headerText: string;
  arbejdsstedNavnDisplay: string;
  arbejdsstedNavnStatus: DebugStatus;
  satserStatus: DebugStatus;
  satserMessage: string;
  tableStatus: DebugStatus;
  tableMessage: string;
}>;

export type OffentligeYdelserDebugRow = Readonly<{
  id: string;
  label: string;
  status: DebugStatus;
  message: string;
  summaryDisplay?: 'messageOnly';
}>;

const getReguleringsDatoForAnsaettelsesforhold = (
  af: Ansaettelsesforhold,
  skadesdato: ISODateString | undefined
): ISODateString | undefined => {
  return af.saerligFraDatoRegulering || skadesdato;
};

const validateStoreBededagSatser = (
  loenPaaHelligdage: string,
  inputValue: number | undefined,
  reguleringsDato: ISODateString | undefined
): boolean => {
  if (!reguleringsDato) return false;
  const dateObj = parseISODate(reguleringsDato);
  if (!dateObj) return false;

  const cutoffDate = createDate(2024, 0, 1);
  const isFrom2024 = dateObj >= cutoffDate;

  let expectedPct: number;
  if (loenPaaHelligdage === 'Almindelig løn' && isFrom2024) {
    expectedPct = 0.45;
  } else {
    expectedPct = 0;
  }

  const actualValue = inputValue ?? 0;
  return Math.abs(actualValue - expectedPct) > 0.01;
};

const validateFeriePct = (
  fuldLoenUnderFerie: Ansaettelsesforhold['fuldLoenUnderFerie'],
  inputValue: number | undefined
): boolean => {
  if (inputValue === undefined) return false;
  if (inputValue >= 12) return false;
  return true;
};

const validateOverenskomstSats = (
  overenskomstId: string | undefined,
  fieldName: 'fritvalgPct' | 'shSoPct' | 'pensionPct',
  inputValue: number | undefined,
  reguleringsDato: ISODateString | undefined,
  applyAlmindeligLoenPaaShDageRegel: boolean
): boolean => {
  if (!overenskomstId) return false;
  if (!reguleringsDato) return false;

  const dateObj = parseISODate(reguleringsDato);
  if (!dateObj) return false;

  const danishDate = formatDanishDate(dateObj);
  let expectedValue: number | undefined;

  if (isOffentligOverenskomstId(overenskomstId)) {
    const tillaegSatser = getOffentligTillaegsSatserForDato(
      overenskomstId,
      danishDate,
      applyAlmindeligLoenPaaShDageRegel
    );
    if (!tillaegSatser) return false;
    if (fieldName === 'fritvalgPct') {
      expectedValue = tillaegSatser.fritvalg ?? 0;
    } else if (fieldName === 'shSoPct') {
      expectedValue = tillaegSatser.shSoSats ?? 0;
    } else {
      expectedValue = tillaegSatser.agPension ?? 0;
    }
  } else {
    const ref = resolveOverenskomstRef(overenskomstId);
    if (!ref) return false;

    const satser = getEffektiveSatserForDato({
      overenskomstId: ref.baseId as OverenskomstId,
      dato: danishDate,
      applyAlmindeligLoenPaaShDageRegel,
    });
    if (!satser) return false;

    if (fieldName === 'fritvalgPct') {
      expectedValue = satser.fritvalg ?? 0;
    } else if (fieldName === 'shSoPct') {
      expectedValue = satser.shSoSats ?? 0;
    } else {
      expectedValue = satser.agPension ?? 0;
    }
  }

  const expectedPct = (expectedValue ?? 0) * 100;
  const actualValue = inputValue ?? 0;
  return Math.abs(actualValue - expectedPct) > 0.01;
};

const resolveSatserErrorField = (
  af: Ansaettelsesforhold,
  skadesdato: ISODateString | undefined
): string | null => {
  const reguleringsDato = getReguleringsDatoForAnsaettelsesforhold(af, skadesdato);
  const applyAlmindeligLoenPaaShDageRegel = af.loenPaaHelligdage === 'Almindelig løn';

  if (validateFeriePct(af.fuldLoenUnderFerie, af.feriePct)) {
    return 'Feriegodtgørelse/-tillæg';
  }
  if (validateOverenskomstSats(af.overenskomstId, 'fritvalgPct', af.fritvalgPct, reguleringsDato, applyAlmindeligLoenPaaShDageRegel)) {
    return 'Fritvalg';
  }
  if (validateOverenskomstSats(af.overenskomstId, 'shSoPct', af.shSoPct, reguleringsDato, applyAlmindeligLoenPaaShDageRegel)) {
    return 'SH/SO-sats';
  }
  if (validateStoreBededagSatser(af.loenPaaHelligdage, af.storeBededagPct, reguleringsDato)) {
    return 'Store Bededagstillæg';
  }
  if (validateOverenskomstSats(af.overenskomstId, 'pensionPct', af.pensionPct, reguleringsDato, applyAlmindeligLoenPaaShDageRegel)) {
    return 'Arbejdsgivers pensionsbidrag';
  }
  return null;
};

const PERIOD_COLUMN_KEYS: Record<Loenperiode, readonly [AarsloenTableColumnKey, AarsloenTableColumnKey]> = {
  maaned: ['col0_maaned', 'col1_maaned'],
  uge: ['col0_uge', 'col1_uge'],
  dag: ['col0_dag', 'col1_dag'],
};

const resolveAarsloenColumnLabel = (colKey: AarsloenTableColumnKey): string => {
  switch (colKey) {
    case 'col0_maaned':
      return 'Måned';
    case 'col1_maaned':
      return 'År';
    case 'col0_uge':
      return 'Uge fra';
    case 'col1_uge':
      return 'Uge til';
    case 'col0_dag':
      return 'Dato fra';
    case 'col1_dag':
      return 'Dato til';
    case 'col2':
      return 'Grundløn';
    case 'col3':
      return 'Tillæg';
    case 'col4':
      return 'Ikke-pensionsgivende løn';
    case 'col5':
      return 'ATP og anden ikke FB-løn';
    default:
      return 'felt';
  }
};

const countRowsWithPeriodOnly = (
  rows: ReadonlyArray<Ansaettelsesforhold['indtaegtsoplysningerTableData'][number]>,
  loenperiode: Loenperiode
): number => {
  const [startKey, endKey] = PERIOD_COLUMN_KEYS[loenperiode];
  return rows.reduce((count, row) => {
    const startFilled = !isAarsloenTableValueEffectivelyEmptyForValidation(row[startKey]);
    const endFilled = !isAarsloenTableValueEffectivelyEmptyForValidation(row[endKey]);
    const periodComplete = startFilled && endFilled;
    if (!periodComplete) return count;

    const hasAmounts =
      row.col2 !== undefined && row.col2 !== null ||
      row.col3 !== undefined && row.col3 !== null ||
      row.col4 !== undefined && row.col4 !== null ||
      row.col5 !== undefined && row.col5 !== null;

    return hasAmounts ? count : count + 1;
  }, 0);
};

const OFFENTLIGE_YDELSER_COLUMN_ORDER: readonly OffentligeYdelserTableColumnKey[] = [
  'fraDato',
  'tilDato',
  'ydelse',
  'tillaeg',
  'ydelsestype',
];

const resolveOffentligeYdelserColumnLabel = (colKey: OffentligeYdelserTableColumnKey): string => {
  switch (colKey) {
    case 'fraDato':
      return 'Fra dato';
    case 'tilDato':
      return 'Til dato';
    case 'ydelse':
      return 'Ydelse';
    case 'tillaeg':
      return 'Tillæg';
    case 'ydelsestype':
      return 'Ydelsestype';
    default:
      return 'felt';
  }
};

const collectOffentligeYdelserCellErrorsByRow = (
  cellErrorsByCellKey: Readonly<Record<string, true>>
): ReadonlyMap<string, ReadonlySet<OffentligeYdelserTableColumnKey>> => {
  const result = new Map<string, Set<OffentligeYdelserTableColumnKey>>();
  for (const cellKey of Object.keys(cellErrorsByCellKey)) {
    const parsed = parseOffentligeYdelserCellKey(cellKey);
    if (!parsed) continue;
    const set = result.get(parsed.rowId);
    if (set) {
      set.add(parsed.colKey);
    } else {
      result.set(parsed.rowId, new Set<OffentligeYdelserTableColumnKey>([parsed.colKey]));
    }
  }
  return result;
};

export const buildIndkomstSectionStatuses = (
  ansaettelsesforhold: ReadonlyArray<Ansaettelsesforhold>,
  skadesdato: ISODateString | undefined,
  beregnesUdFra?: string
): ReadonlyArray<IndkomstSectionStatus> => {
  return ansaettelsesforhold.map((af, index) => {
    const baseHeaderText = index === 0 ? 'Ansættelsesforhold' : `Ansættelsesforhold ${index + 1}`;
    const arbejdsstedNavn = af.navnPaaArbejdssted?.trim() ?? '';
    const headerText = arbejdsstedNavn !== '' ? `${baseHeaderText} (${arbejdsstedNavn})` : baseHeaderText;

    const satserErrorField = resolveSatserErrorField(af, skadesdato);
    const satserStatus: DebugStatus = satserErrorField ? 'error' : 'ok';
    const satserMessage = satserErrorField ? `Forkert værdi indtastet i ${satserErrorField}` : 'Ja';

    const tableRows = af.indtaegtsoplysningerTableData ?? [];
    const cellErrors = buildAarsloenCellErrors(tableRows, af.loenperiode);
    const tableValidation = getAarsloenTableValidation({
      rows: tableRows,
      loenperiode: af.loenperiode,
      cellErrorsByCellKey: cellErrors,
    });

    let tableStatus: DebugStatus = 'ok';
    let tableMessage = 'Ja';
    if (tableValidation.summary.hasErrors) {
      tableStatus = 'error';
      const firstErrorCell = tableValidation.summary.firstErrorCell;
      if (!firstErrorCell) {
        tableMessage = 'Fejl i indtastning';
      } else if (firstErrorCell.reason === 'input') {
        tableMessage = `Ugyldig værdi i ${resolveAarsloenColumnLabel(firstErrorCell.colKey)}`;
      } else {
        tableMessage = `${resolveAarsloenColumnLabel(firstErrorCell.colKey)} mangler`;
      }
    } else if (tableValidation.summary.hasWarnings) {
      tableStatus = 'warning';
      const periodOnlyCount = countRowsWithPeriodOnly(tableRows, af.loenperiode);
      if (periodOnlyCount <= 1) {
        tableMessage = 'Lønperiode er udfyldt uden beløb i lønfelterne';
      } else {
        tableMessage = `${periodOnlyCount} lønperioder er udfyldt uden beløb i lønfelterne`;
      }
    }

    return {
      id: af.id,
      headerText,
      arbejdsstedNavnDisplay: arbejdsstedNavn !== '' ? arbejdsstedNavn : '-',
      arbejdsstedNavnStatus: arbejdsstedNavn !== '' ? 'ok' : (beregnesUdFra === 'Beregningsperiode' ? 'warning' : 'ok'),
      satserStatus,
      satserMessage,
      tableStatus,
      tableMessage,
    };
  });
};

export const buildOffentligeYdelserDebugRows = (
  rows: ReadonlyArray<OffentligeYdelserRow>
): ReadonlyArray<OffentligeYdelserDebugRow> => {
  if (rows.length === 0) return [];

  const cellErrors = buildOffentligeYdelserCellErrors(rows);
  const cellErrorsByRowId = collectOffentligeYdelserCellErrorsByRow(cellErrors);
  const validation = getOffentligeYdelserTableValidation({
    rows,
    cellErrorsByCellKey: cellErrors,
  });
  const issuesByRowId = new Map(validation.summary.rowIssues.map((issue) => [issue.rowId, issue]));

  type OffentligeYdelserDebugRowDraft = {
    id: string;
    label: string;
    firstErrorMessage?: string;
    warningCount: number;
    sum: number;
  };

  const result: OffentligeYdelserDebugRowDraft[] = [];
  const grouped = new Map<string, OffentligeYdelserDebugRowDraft>();

  for (const row of rows) {
    const { hasAnyFilled } = getOffentligeYdelserRowFilledState(row);
    if (!hasAnyFilled) continue;

    const typeKey = row.ydelsestype?.trim() ?? '';
    const groupKey = typeKey === '' ? 'mangler-ydelsestype' : `ydelsestype-${typeKey}`;
    const label = typeKey === '' ? 'Ydelsestype ikke valgt' : (ydelsestyper[typeKey]?.label ?? typeKey);

    let group = grouped.get(groupKey);
    if (!group) {
      group = {
        id: groupKey,
        label,
        warningCount: 0,
        sum: 0,
      };
      grouped.set(groupKey, group);
      result.push(group);
    }

    const issue = issuesByRowId.get(row.id);
    if (!issue || issue.level !== 'error') {
      group.sum += parseAmount(row.ydelse) + parseAmount(row.tillaeg);
    }

    if (issue?.level === 'error') {
      if (!group.firstErrorMessage) {
        if (issue.reason === 'input') {
          const rowErrorKeys = cellErrorsByRowId.get(row.id) ?? new Set<OffentligeYdelserTableColumnKey>();
          const firstInvalidColumn = OFFENTLIGE_YDELSER_COLUMN_ORDER.find((colKey) => rowErrorKeys.has(colKey));
          group.firstErrorMessage = firstInvalidColumn
            ? `Ugyldig værdi i ${resolveOffentligeYdelserColumnLabel(firstInvalidColumn)}`
            : 'Fejl i indtastning';
        } else {
          const state = getOffentligeYdelserRowFilledState(row);
          if (!state.fraDatoFilled) {
            group.firstErrorMessage = 'Fra dato mangler';
          } else if (!state.tilDatoFilled) {
            group.firstErrorMessage = 'Til dato mangler';
          } else if (!state.ydelsestypeSelected) {
            group.firstErrorMessage = 'Ydelsestype mangler';
          } else {
            group.firstErrorMessage = 'Manglende indtastning';
          }
        }
      }
      continue;
    }

    if (issue?.level === 'warning') {
      group.warningCount += 1;
    }
  }

  return result.map((row) => {
    if (row.firstErrorMessage) {
      return {
        id: row.id,
        label: row.label,
        status: 'error' as DebugStatus,
        message: row.firstErrorMessage,
        summaryDisplay: 'messageOnly',
      };
    }
    if (row.warningCount > 0) {
      const warningMessage = row.warningCount === 1
        ? 'Periode og ydelsestype er udfyldt uden ydelse eller tillæg'
        : `${row.warningCount} perioder med ydelsestype er udfyldt uden ydelse eller tillæg`;
      return {
        id: row.id,
        label: row.label,
        status: 'warning' as DebugStatus,
        message: warningMessage,
        summaryDisplay: 'messageOnly',
      };
    }
    return {
      id: row.id,
      label: row.label,
      status: 'ok' as DebugStatus,
      message: formatCurrency(row.sum),
    };
  });
};
