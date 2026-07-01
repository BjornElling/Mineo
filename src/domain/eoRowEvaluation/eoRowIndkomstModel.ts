import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { resolveSatserErrorField, isFeriePctRequiredForBlocking } from '../erstatningsopgoerelse/validation/loenindkomstSatserGate';
import {
  getStandardLoenTableValidation,
  isStandardLoenTableValueEffectivelyEmptyForValidation,
} from '../aarsloen/standardLoenTableValidation';
import {
  OFFENTLIGE_YDELSER_COLUMN_ORDER,
  getOffentligeYdelserRowFilledState,
  getOffentligeYdelserTableValidation,
  parseOffentligeYdelserCellKey,
} from '../erstatningsopgoerelse/validation/offentligeYdelserTableValidation';
import { ydelsestyper } from '../../data/ydelsestyper';
import type { EoRowStatus } from './eoRowTypes';
import { buildStandardLoenCellErrors, buildOffentligeYdelserCellErrors } from '../erstatningsopgoerelse/validation/indkomstRowValidation';
import type { StandardLoenTableColumnKey, OffentligeYdelserTableColumnKey } from '../../types/table';
import type { Loenperiode } from '../../types/loen';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { buildStandardLoenZeroArbejdsdageIssues } from '../erstatningsopgoerelse/validation/indkomstRowValidation';
import { DEFAULT_APP_SETTINGS, resolveDefaultOverenskomstFilter, type AppSettings } from '../../settings/appSettingsSchema';
import { resolveStandardLoenColumnLabel } from '../aarsloen/standardLoenTableColumns';
import { resolveOffentligeYdelserColumnLabel } from '../erstatningsopgoerelse/tables/offentligeYdelserTableColumns';
import { getAngivetLoenOpreguleresFraDato } from '../erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from '../erstatningsopgoerelse/helpers/eoSharedUtils';

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

export type IndkomstSectionStatus = Readonly<{
  id: string;
  headerText: string;
  arbejdsstedNavnDisplay: string;
  arbejdsstedNavnStatus: EoRowStatus;
  satserStatus: EoRowStatus;
  satserMessage: string;
  tableStatus: EoRowStatus;
  tableMessage: string;
}>;

export type OffentligeYdelserDebugRow = Readonly<{
  id: string;
  label: string;
  status: EoRowStatus;
  message: string;
  summaryDisplay?: 'messageOnly';
}>;

const PERIOD_COLUMN_KEYS: Record<Loenperiode, readonly [StandardLoenTableColumnKey, StandardLoenTableColumnKey]> = {
  maaned: ['col0_maaned', 'col1_maaned'],
  uge: ['col0_uge', 'col1_uge'],
  dag: ['col0_dag', 'col1_dag'],
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
  const isManualPercentEmpty = (value: number | undefined): boolean =>
    typeof value !== 'number' || !Number.isFinite(value);

  return (
    row.dato === undefined &&
    isStandardLoenTableValueEffectivelyEmptyForValidation(row.grundloen) &&
    isManualPercentEmpty(row.feriepenge) &&
    isManualPercentEmpty(row.shSoSats) &&
    isManualPercentEmpty(row.fritvalg) &&
    isManualPercentEmpty(row.agPension)
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
    af.harAnciennitetstillaegEfterSkadedatoen !== false ||
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
  skadedato: ISODateString | undefined
): ReadonlyArray<IndkomstSectionStatus> => {
  const ansaettelsesforhold = values.loenindkomstAnsaettelsesforhold ?? [];
  const angivetLoenMetodeOpreguleresFraDato = getAngivetLoenOpreguleresFraDato(values);

  return ansaettelsesforhold.map((af, index) => {
    const baseHeaderText = index === 0 ? 'Ansættelsesforhold' : `Ansættelsesforhold ${index + 1}`;
    const arbejdsstedNavn = af.navnPaaArbejdssted?.trim() ?? '';
    const headerText = arbejdsstedNavn !== '' ? `${baseHeaderText} (${arbejdsstedNavn})` : baseHeaderText;

    const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
      beregnesUdFra: values.beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato,
      saerligFraDatoRegulering: af.saerligFraDatoRegulering,
      beregningsperiodeTil: values.tafBeregningsperiodeTil,
      skadedato,
    });
    const feriePctRequired = isFeriePctRequiredForBlocking(af, values.beregnesUdFra);
    const satserError = resolveSatserErrorField(af, anvendtReguleringsdato, feriePctRequired);
    const satserStatus: EoRowStatus = satserError ? 'error' : 'ok';
    const satserMessage = satserError ? satserError.message : 'Ok';

    const tableRows = af.indtaegtsoplysningerTableData ?? [];
    const cellErrors = buildStandardLoenCellErrors(tableRows, af.loenperiode);
    const tableValidation = getStandardLoenTableValidation({
      rows: tableRows,
      loenperiode: af.loenperiode,
      cellErrorsByCellKey: cellErrors,
      tillaegAngivesSom: af.tillaegAngivesSom,
    });

    let tableStatus: EoRowStatus = 'ok';
    let tableMessage = 'Ok';
    const zeroArbejdsdageIssue = buildStandardLoenZeroArbejdsdageIssues(values, af.id)[0];
    if (zeroArbejdsdageIssue) {
      tableStatus = 'error';
      tableMessage = zeroArbejdsdageIssue.message;
    } else if (tableValidation.summary.hasErrors) {
      tableStatus = 'error';
      const firstErrorCell = tableValidation.summary.firstErrorCell;
      if (!firstErrorCell) {
        tableMessage = 'Der er en ugyldig værdi i lønoplysningerne';
      } else if (firstErrorCell.reason === 'input') {
        tableMessage = `Ugyldig værdi i ${resolveStandardLoenColumnLabel(firstErrorCell.colKey)}`;
      } else {
        tableMessage = `${resolveStandardLoenColumnLabel(firstErrorCell.colKey)} er ikke angivet`;
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
            : 'Der er en ugyldig værdi i ydelsesrækken';
        } else {
          const state = getOffentligeYdelserRowFilledState(row);
          if (!state.periodComplete) {
            group.firstErrorMessage = 'Dato er ikke angivet';
          } else if (!state.ydelsestypeSelected) {
            group.firstErrorMessage = 'Ydelsestype er ikke valgt';
          } else {
            // Uopnåelig restklasse (en ikke-input-fejl kræver manglende periode eller ydelsestype,
            // begge fanget ovenfor) — men hold teksten specifik frem for generisk, hvis den nås.
            group.firstErrorMessage = 'Dato eller ydelsestype er ikke angivet';
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
        status: 'error' as EoRowStatus,
        message: row.firstErrorMessage,
        summaryDisplay: 'messageOnly',
      };
    }
    if (row.warningCount > 0) {
      const warningMessage = row.warningCount === 1
        ? 'Beløb er ikke angivet'
        : `Beløb er ikke angivet (${row.warningCount} perioder)`;
      return {
        id: row.id,
        label: row.label,
        status: 'warning' as EoRowStatus,
        message: warningMessage,
        summaryDisplay: 'messageOnly',
      };
    }
    return {
      id: row.id,
      label: row.label,
      status: 'ok' as EoRowStatus,
      message: 'Ok',
    };
  });
};
