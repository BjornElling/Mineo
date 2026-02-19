import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { parseISODate } from '../../types/branded';
import { createDate, formatDanishDate } from '../../utils/dateUtils';
import { getAarsloenTableValidation } from '../../utils/aarsloenTableValidation';
import {
  getOffentligeYdelserRowFilledState,
  getOffentligeYdelserTableValidation,
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
import { formatCurrency, parseAmount } from '../../utils/formatUtils';

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
      tableMessage = tableValidation.summary.firstErrorCell?.reason === 'input'
        ? 'Fejl i indtastning'
        : 'Manglende indtastning';
    } else if (tableValidation.summary.hasWarnings) {
      tableStatus = 'warning';
      tableMessage = 'Manglende indtastning';
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
  const validation = getOffentligeYdelserTableValidation({
    rows,
    cellErrorsByCellKey: cellErrors,
  });
  const issuesByRowId = new Map(validation.summary.rowIssues.map((issue) => [issue.rowId, issue]));

  type OffentligeYdelserDebugRowDraft = {
    id: string;
    label: string;
    firstErrorMessage?: string;
    firstWarningMessage?: string;
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
        group.firstErrorMessage = issue.reason === 'input' ? 'Fejl i indtastning' : 'Manglende indtastning';
      }
      continue;
    }

    if (issue?.level === 'warning' && !group.firstWarningMessage) {
      group.firstWarningMessage = 'Manglende indtastning';
    }
  }

  return result.map((row) => {
    if (row.firstErrorMessage) {
      return {
        id: row.id,
        label: row.label,
        status: 'error' as DebugStatus,
        message: row.firstErrorMessage,
      };
    }
    if (row.firstWarningMessage) {
      return {
        id: row.id,
        label: row.label,
        status: 'warning' as DebugStatus,
        message: row.firstWarningMessage,
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
