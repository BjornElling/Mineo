import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { parseISODate } from '../../types/branded';
import { formatDanishDate } from '../../utils/dateUtils';
import { STORE_BEDEDAG_START } from '../../config/dateRanges';
import { STORE_BEDEDAG_PCT } from '../../config/regulatoryRates';
import {
  getStandardLoenTableValidation,
  isStandardLoenTableValueEffectivelyEmptyForValidation,
} from '../aarsloen/standardLoenTableValidation';
import {
  OFFENTLIGE_YDELSER_COLUMN_ORDER,
  getOffentligeYdelserRowFilledState,
  getOffentligeYdelserTableValidation,
  parseOffentligeYdelserCellKey,
} from '../erstatningsopgoerelse/offentligeYdelserTableValidation';
import { ydelsestyper } from '../../data/ydelsestyper';
import {
  getEffektiveSatserForDato,
  resolveOverenskomstRef,
  type OverenskomstId,
  isOffentligOverenskomstId,
  getOffentligTillaegsSatserForDato,
} from '../../data/overenskomstRates';
import type { DebugStatus } from './eoDebugTypes';
import { buildStandardLoenCellErrors, buildOffentligeYdelserCellErrors } from '../erstatningsopgoerelse/indkomstRowValidation';
import type { StandardLoenTableColumnKey, OffentligeYdelserTableColumnKey } from '../../types/table';
import type { Loenperiode } from '../../types/loen';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { buildStandardLoenZeroArbejdsdageIssues } from '../erstatningsopgoerelse/indkomstRowValidation';
import { DEFAULT_APP_SETTINGS, resolveDefaultOverenskomstFilter, type AppSettings } from '../../settings/appSettingsSchema';

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

const hasStoreBededagSatserAfvigelse = (
  loenPaaHelligdage: string,
  inputValue: number | undefined,
  reguleringsDato: ISODateString | undefined
): boolean => {
  if (!reguleringsDato) return false;
  const isFrom2024 = reguleringsDato >= STORE_BEDEDAG_START;

  let expectedPct: number;
  if (loenPaaHelligdage === 'Almindelig løn' && isFrom2024) {
    expectedPct = STORE_BEDEDAG_PCT;
  } else {
    expectedPct = 0;
  }

  const actualValue = inputValue ?? 0;
  return Math.abs(actualValue - expectedPct) > 0.01;
};

const hasFeriePctAfvigelse = (
  _fuldLoenUnderFerie: Ansaettelsesforhold['fuldLoenUnderFerie'],
  inputValue: number | undefined
): boolean => {
  if (inputValue === undefined) return false;
  if (inputValue >= 12) return false;
  return true;
};

const hasOverenskomstSatsAfvigelse = (
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

  if (hasFeriePctAfvigelse(af.fuldLoenUnderFerie, af.feriePct)) {
    return 'Feriegodtgørelse/-tillæg';
  }
  if (hasOverenskomstSatsAfvigelse(af.overenskomstId, 'fritvalgPct', af.fritvalgPct, reguleringsDato, applyAlmindeligLoenPaaShDageRegel)) {
    return 'Fritvalg';
  }
  if (hasOverenskomstSatsAfvigelse(af.overenskomstId, 'shSoPct', af.shSoPct, reguleringsDato, applyAlmindeligLoenPaaShDageRegel)) {
    return 'SH/SO-sats';
  }
  if (hasStoreBededagSatserAfvigelse(af.loenPaaHelligdage, af.storeBededagPct, reguleringsDato)) {
    return 'Store Bededagstillæg';
  }
  if (hasOverenskomstSatsAfvigelse(af.overenskomstId, 'pensionPct', af.pensionPct, reguleringsDato, applyAlmindeligLoenPaaShDageRegel)) {
    return 'Arbejdsgivers pensionsbidrag';
  }
  return null;
};

const PERIOD_COLUMN_KEYS: Record<Loenperiode, readonly [StandardLoenTableColumnKey, StandardLoenTableColumnKey]> = {
  maaned: ['col0_maaned', 'col1_maaned'],
  uge: ['col0_uge', 'col1_uge'],
  dag: ['col0_dag', 'col1_dag'],
};

const resolveAarsloenColumnLabel = (colKey: StandardLoenTableColumnKey): string => {
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
    const startFilled = !isStandardLoenTableValueEffectivelyEmptyForValidation(row[startKey]);
    const endFilled = !isStandardLoenTableValueEffectivelyEmptyForValidation(row[endKey]);
    const periodComplete = startFilled && endFilled;
    if (!periodComplete) return count;

    const hasAmounts =
      amountValueToNumber(row.col2) !== undefined ||
      amountValueToNumber(row.col3) !== undefined ||
      amountValueToNumber(row.col4) !== undefined ||
      amountValueToNumber(row.col5) !== undefined;

    return hasAmounts ? count : count + 1;
  }, 0);
};

const isLoenRowEffectivelyEmpty = (
  row: Ansaettelsesforhold['indtaegtsoplysningerTableData'][number],
  loenperiode: Loenperiode
): boolean => {
  const periodKeys: ReadonlyArray<StandardLoenTableColumnKey> = loenperiode === 'maaned'
    ? ['col0_maaned', 'col1_maaned']
    : loenperiode === 'uge'
      ? ['col0_uge', 'col1_uge']
      : ['col0_dag', 'col1_dag'];
  const allKeys: ReadonlyArray<StandardLoenTableColumnKey> = [...periodKeys, 'col2', 'col3', 'col4', 'col5'];

  return allKeys.every((key) =>
    isStandardLoenTableValueEffectivelyEmptyForValidation(row[key])
  );
};

const isManualReguleringRowEffectivelyEmpty = (
  row: NonNullable<Ansaettelsesforhold['loenudviklingManuelTableData']>[number]
): boolean => {
  return (
    (row.dato?.trim() ?? '') === '' &&
    isStandardLoenTableValueEffectivelyEmptyForValidation(row.grundloen) &&
    (row.feriepenge?.trim() ?? '') === '' &&
    (row.shSoSats?.trim() ?? '') === '' &&
    (row.fritvalg?.trim() ?? '') === '' &&
    (row.agPension?.trim() ?? '') === ''
  );
};

export const isLoenindkomstAnsaettelsesforholdEffectivelyEmpty = (
  af: Ansaettelsesforhold,
  appSettings: AppSettings = DEFAULT_APP_SETTINGS
): boolean => {
  const defaultFuldLoenUnderFerie = appSettings.defaultFuldLoenUnderFerie ? 'Ja' : 'Nej';
  const defaultOverenskomstFilter = resolveDefaultOverenskomstFilter(appSettings);
  const hasAnyLoenRowInput = (af.indtaegtsoplysningerTableData ?? []).some((row) => !isLoenRowEffectivelyEmpty(row, af.loenperiode));
  const hasAnyManualReguleringInput = (af.loenudviklingManuelTableData ?? []).some((row) => !isManualReguleringRowEffectivelyEmpty(row));
  const overenskomstFilter = af.overenskomstFilter ?? { loenmodtager: undefined, arbejdsgiver: undefined };
  const hasNonDefaultOverenskomstFilter =
    overenskomstFilter.loenmodtager !== defaultOverenskomstFilter.loenmodtager ||
    overenskomstFilter.arbejdsgiver !== defaultOverenskomstFilter.arbejdsgiver;
  const loenudviklingBeregningsgrundlag = af.loenudviklingBeregningsgrundlag;
  const hasLoenudviklingBeregningsgrundlag =
    loenudviklingBeregningsgrundlag !== undefined && loenudviklingBeregningsgrundlag !== 'Ingen';

  return !(
    (af.navnPaaArbejdssted?.trim() ?? '') !== '' ||
    af.harOverenskomst !== true ||
    (af.overenskomstId?.trim() ?? '') !== '' ||
    af.ansatPaaSkadestidspunktet !== true ||
    af.ansaettelsesforholdOphoert !== false ||
    af.sidsteArbejdsdag !== undefined ||
    af.harAnciennitetstillaegEfterSkadesdatoen !== false ||
    af.anciennitetstillaegDato !== undefined ||
    af.anciennitetstillaegSats !== undefined ||
    af.anciennitetstillaegSatsAngivesPer !== 'Måned' ||
    af.feriePct !== undefined ||
    af.fritvalgPct !== undefined ||
    af.shSoPct !== undefined ||
    af.storeBededagPct !== undefined ||
    af.pensionPct !== undefined ||
    af.loenperiode !== 'maaned' ||
    af.fuldLoenUnderFerie !== defaultFuldLoenUnderFerie ||
    af.loenPaaHelligdage !== appSettings.defaultLoenPaaHelligdage ||
    af.saerligFraDatoRegulering !== undefined ||
    hasAnyLoenRowInput ||
    hasLoenudviklingBeregningsgrundlag ||
    af.loenudviklingStatistikModel !== undefined ||
    af.loenudviklingKRLSatstabel !== undefined ||
    (af.loenudviklingManuelNavn?.trim() ?? '') !== '' ||
    hasAnyManualReguleringInput ||
    af.offentligLoenType !== 'Månedsløn' ||
    af.offentligLoenTrin !== undefined ||
    af.offentligLoenGruppe !== undefined ||
    af.offentligLoenEkstraGrundloen !== undefined ||
    hasNonDefaultOverenskomstFilter
  );
};

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
  values: ErstatningsopgoerelseValues,
  skadesdato: ISODateString | undefined
): ReadonlyArray<IndkomstSectionStatus> => {
  const ansaettelsesforhold = values.loenindkomstAnsaettelsesforhold ?? [];

  return ansaettelsesforhold.map((af, index) => {
    const baseHeaderText = index === 0 ? 'Ansættelsesforhold' : `Ansættelsesforhold ${index + 1}`;
    const arbejdsstedNavn = af.navnPaaArbejdssted?.trim() ?? '';
    const headerText = arbejdsstedNavn !== '' ? `${baseHeaderText} (${arbejdsstedNavn})` : baseHeaderText;

    const satserErrorField = resolveSatserErrorField(af, skadesdato);
    const satserStatus: DebugStatus = satserErrorField ? 'error' : 'ok';
    const satserMessage = satserErrorField ? `Forkert værdi indtastet i ${satserErrorField}` : 'Ok';

    const tableRows = af.indtaegtsoplysningerTableData ?? [];
    const cellErrors = buildStandardLoenCellErrors(tableRows, af.loenperiode);
    const tableValidation = getStandardLoenTableValidation({
      rows: tableRows,
      loenperiode: af.loenperiode,
      cellErrorsByCellKey: cellErrors,
    });

    let tableStatus: DebugStatus = 'ok';
    let tableMessage = 'Ok';
    const zeroArbejdsdageIssue = buildStandardLoenZeroArbejdsdageIssues(values, af.id)[0];
    if (zeroArbejdsdageIssue) {
      tableStatus = 'error';
      tableMessage = zeroArbejdsdageIssue.message;
    } else if (tableValidation.summary.hasErrors) {
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
      arbejdsstedNavnStatus: arbejdsstedNavn !== '' ? 'ok' : (values.beregnesUdFra === 'Beregningsperiode' ? 'warning' : 'ok'),
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
  };

  const result: OffentligeYdelserDebugRowDraft[] = [];
  const grouped = new Map<string, OffentligeYdelserDebugRowDraft>();

  for (const row of rows) {
    const { hasAnyFilled } = getOffentligeYdelserRowFilledState(row);
    if (!hasAnyFilled) continue;

    const typeKey = row.ydelsestype?.trim() ?? '';
    const groupKey = typeKey === '' ? 'mangler-ydelsestype' : `ydelsestype-${typeKey}`;
    const label = typeKey === '' ? 'Uspecificeret' : (ydelsestyper[typeKey]?.label ?? typeKey);

    let group = grouped.get(groupKey);
    if (!group) {
      group = {
        id: groupKey,
        label,
        warningCount: 0,
      };
      grouped.set(groupKey, group);
      result.push(group);
    }

    const issue = issuesByRowId.get(row.id);
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
          if (!state.periodComplete) {
            group.firstErrorMessage = 'Dato mangler';
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
        ? 'Beløb mangler'
        : `Beløb mangler (${row.warningCount} perioder)`;
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
      message: 'Ok',
    };
  });
};
