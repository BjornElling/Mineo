import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../schemas/formSchemas';
import { assessLoenindkomstSatser } from '../erstatningsopgoerelse/validation/loenindkomstSatsAssessment';
import { FIELD_ISSUE_GENERIC_TOOLTIP, resolveFieldIssueTooltip, type FieldIssue } from '../../inputCore/inputIssue';
import { isStandardLoenTableValueEffectivelyEmptyForValidation } from '../standardLoen/standardLoenTableValidation';
import {
  OFFENTLIGE_YDELSER_COLUMN_ORDER,
  getOffentligeYdelserRowFilledState,
  getOffentligeYdelserTableValidation,
  parseOffentligeYdelserCellKey,
} from '../erstatningsopgoerelse/validation/offentligeYdelserTableValidation';
import { ydelsestyper } from '../../data/ydelsestyper';
import type { EoRowStatus } from './eoRowTypes';
import {
  formatOffentligYdelseRowName,
  resolveOffentligeYdelserRowWarnings,
  type OffentligeYdelserRowWarning,
} from '../erstatningsopgoerelse/validation/eoIncomeRowWarnings';
import { buildOffentligeYdelserCellErrors } from '../erstatningsopgoerelse/validation/indkomstRowValidation';
import type { StandardLoenTableColumnKey, OffentligeYdelserTableColumnKey } from '../../types/table';
import type { Loenperiode } from '../../types/loen';
import { DEFAULT_APP_SETTINGS, resolveDefaultOverenskomstFilter, type AppSettings } from '../../settings/appSettingsSchema';
import { resolveOffentligeYdelserColumnLabel } from '../erstatningsopgoerelse/tables/offentligeYdelserTableColumns';

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

export type IndkomstSectionStatus = Readonly<{
  id: string;
  arbejdsstedNavnDisplay: string;
  arbejdsstedNavnStatus: EoRowStatus;
  satserStatus: EoRowStatus;
  satserMessage: string;
}>;

export type OffentligeYdelserStatusRow = Readonly<{
  id: string;
  label: string;
  status: EoRowStatus;
  message: string;
  summaryDisplay?: 'messageOnly';
  /**
   * Den ydelsesRÆKKE, statusrækkens besked stammer fra – tabellens eget række-id, ikke gruppenøglen.
   *
   * Statusrækkerne grupperer flere ydelsesrækker pr. ydelsestype, og gruppenøglen
   * (`ydelsestype-<key>`/`mangler-ydelsestype`) er derfor ikke et element i DOM. Uden den oprindelige
   * række kunne fejllinket kun føre til fanen; med den kan det pege på den række, beskeden handler om.
   */
  sourceRowId?: string;
  /** Cellen, linket skal føre til (BB-291). Uden den forankres linket til rækken. */
  focusColKey?: OffentligeYdelserTableColumnKey;
}>;

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

const isManualProcentsatsRowEffectivelyEmpty = (
  row: NonNullable<Ansaettelsesforhold['loenudviklingManuelProcentsatsTableData']>[number]
): boolean => {
  const isManualPercentEmpty = (value: number | undefined): boolean =>
    typeof value !== 'number' || !Number.isFinite(value);

  return row.dato === undefined && isManualPercentEmpty(row.procent);
};

export const isLoenindkomstAnsaettelsesforholdEffectivelyEmpty = (
  af: Ansaettelsesforhold,
  appSettings: AppSettings = DEFAULT_APP_SETTINGS
): boolean => {
  const defaultFuldLoenUnderFerie = appSettings.defaultFuldLoenUnderFerie ? 'Ja' : 'Nej';
  const defaultOverenskomstFilter = resolveDefaultOverenskomstFilter(appSettings);
  const hasAnyLoenRowInput = (af.indtaegtsoplysningerTableData ?? []).some((row) => !isLoenRowEffectivelyEmpty(row, af.loenperiode));
  const hasAnyManualReguleringInput = (af.loenudviklingManuelTableData ?? []).some((row) => !isManualReguleringRowEffectivelyEmpty(row));
  const hasAnyManualProcentsatsInput = (af.loenudviklingManuelProcentsatsTableData ?? []).some((row) => !isManualProcentsatsRowEffectivelyEmpty(row));
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
    // Satserne er tomme for læserne ved «Beløb» (BB-301); selve valget er stadig en indtastning.
    af.tillaegAngivesSom === 'beloeb' ||
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
    hasAnyManualProcentsatsInput ||
    af.offentligLoenType !== 'Månedsløn' ||
    af.offentligLoenTrin !== undefined ||
    af.offentligLoenGruppe !== undefined ||
    af.offentligLoenEkstraGrundloen !== undefined ||
    af.offentligLoenEkstraGrundloenAngivesPer !== 'Måned' ||
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

/**
 * Kortets status uden indtægtstabellen: tabellens rækker har deres egne linjer
 * (`eoRowLoenindkomstTableLines.ts`, BB-291).
 *
 * Skadedatoen er IKKE længere en parameter: de datoafhængige satsafvigelser hørte til de LÅSTE satser, som
 * nu er afledte felter, reduceren materialiserer. En bevaret, ulæst parameter ville erklære
 * en afhængighed, funktionen ikke har, og skjule for næste læser, hvad rækkerne faktisk afhænger af.
 */
export const buildIndkomstSectionStatuses = (
  values: ErstatningsopgoerelseValues,
  kortFieldIssues: Readonly<Record<string, readonly FieldIssue[]>> = {}
): ReadonlyArray<IndkomstSectionStatus> => {
  const ansaettelsesforhold = values.loenindkomstAnsaettelsesforhold ?? [];

  return ansaettelsesforhold.map((af) => {
    const arbejdsstedNavn = af.navnPaaArbejdssted?.trim() ?? '';

    // Samme vurdering som feltets ring (`assessLoenindkomstSatser`). Har feriefeltet sin egen røde fejl, læser
    // readeren det som tomt; vurderingen får det at vide, så en ugyldig værdi ikke også meldes «ikke udfyldt».
    const feriePctHarFeltfejl = (kortFieldIssues[af.id] ?? [])
      .some((issue) => issue.field.address.field === 'feriePct');
    const satserFinding = assessLoenindkomstSatser(af, { feriePctHarFeltfejl })[0];
    const satserStatus: EoRowStatus = satserFinding === undefined
      ? 'ok'
      : satserFinding.severity === 'error' ? 'error' : 'warning';
    const satserMessage = satserFinding?.message ?? 'Ok';

    return {
      id: af.id,
      arbejdsstedNavnDisplay: arbejdsstedNavn !== '' ? arbejdsstedNavn : '-',
      arbejdsstedNavnStatus: arbejdsstedNavn !== '' ? 'ok' : (values.beregnesUdFra === 'Beregningsperiode' ? 'warning' : 'ok'),
      satserStatus,
      satserMessage,
    };
  });
};

/**
 * Offentlige ydelsers linjer: ÉN linje pr. ydelsesrække med en fejl eller advarsel – med rækkens navn, cellens egen
 * tekst og et link til cellen – og en «ok»-linje pr. ydelsestype uden fund (BB-291's form, udviklerønske
 * 2026-10-19). Før stod der én linje pr. ydelsestype med den FØRSTE fejl, uden række.
 *
 * `cellIssues` er readerens røde celler i tabellen. Rækkerne er readerens værdier, hvor en rød celle er tom.
 */
export const buildOffentligeYdelserStatusRows = (
  rows: ReadonlyArray<OffentligeYdelserRow>,
  cellIssues: readonly FieldIssue[] = [],
  /** Sagens perioder til rimelighedskontrollen (BB-297); uden dem vurderes beløbene ikke. */
  values?: ErstatningsopgoerelseValues
): ReadonlyArray<OffentligeYdelserStatusRow> => {
  if (rows.length === 0) return [];

  const issuesByCellKey = new Map<string, FieldIssue>();
  for (const issue of cellIssues) {
    const segment = issue.field.address.path[0];
    if (segment?.kind !== 'entity' || segment.collection !== 'offentligeYdelserRows') continue;
    const colKey = issue.field.address.field;
    if (!(OFFENTLIGE_YDELSER_COLUMN_ORDER as readonly string[]).includes(colKey)) continue;
    const key = `${segment.entityId}:${colKey}`;
    if (!issuesByCellKey.has(key)) issuesByCellKey.set(key, issue);
  }
  const cellErrors: Record<string, true> = { ...buildOffentligeYdelserCellErrors(rows) };
  for (const key of issuesByCellKey.keys()) cellErrors[key] = true;
  const cellErrorsByRowId = collectOffentligeYdelserCellErrorsByRow(cellErrors);
  const validation = getOffentligeYdelserTableValidation({ rows, cellErrorsByCellKey: cellErrors });
  const issuesByRowId = new Map(validation.summary.rowIssues.map((issue) => [issue.rowId, issue]));
  const warningsByRowId = new Map<string, OffentligeYdelserRowWarning[]>();
  for (const warning of resolveOffentligeYdelserRowWarnings(rows, values)) {
    warningsByRowId.set(warning.rowId, [...(warningsByRowId.get(warning.rowId) ?? []), warning]);
  }

  const result: OffentligeYdelserStatusRow[] = [];
  const okTypes = new Map<string, OffentligeYdelserStatusRow>();
  const typesWithFindings = new Set<string>();

  rows.forEach((row, index) => {
    const { hasAnyFilled, periodComplete, fraDatoFilled, ydelsestypeSelected } = getOffentligeYdelserRowFilledState(row);
    if (!hasAnyFilled) return;
    const typeKey = row.ydelsestype?.trim() ?? '';
    const groupKey = typeKey === '' ? 'mangler-ydelsestype' : `ydelsestype-${typeKey}`;
    const label = typeKey === '' ? 'Uspecificeret' : (ydelsestyper[typeKey]?.label ?? typeKey);
    const rowName = formatOffentligYdelseRowName(row, index);
    const issue = issuesByRowId.get(row.id);

    if (issue?.level === 'error') {
      typesWithFindings.add(groupKey);
      const parts: string[] = [];
      let focusColKey: OffentligeYdelserTableColumnKey | undefined;
      const rowErrorKeys = cellErrorsByRowId.get(row.id) ?? new Set<OffentligeYdelserTableColumnKey>();
      for (const colKey of OFFENTLIGE_YDELSER_COLUMN_ORDER) {
        if (!rowErrorKeys.has(colKey)) continue;
        const cellIssue = issuesByCellKey.get(`${row.id}:${colKey}`);
        const tooltip = cellIssue === undefined ? FIELD_ISSUE_GENERIC_TOOLTIP : resolveFieldIssueTooltip(cellIssue);
        const text = tooltip === FIELD_ISSUE_GENERIC_TOOLTIP ? 'ugyldig værdi' : tooltip;
        parts.push(`${resolveOffentligeYdelserColumnLabel(colKey)} – ${text}`);
        focusColKey ??= colKey;
      }
      if (!periodComplete && !rowErrorKeys.has('fraDato') && !rowErrorKeys.has('tilDato')) {
        parts.push('Dato er ikke angivet');
        focusColKey ??= fraDatoFilled ? 'tilDato' : 'fraDato';
      }
      if (!ydelsestypeSelected) {
        parts.push('Ydelsestype er ikke valgt');
        focusColKey ??= 'ydelsestype';
      }
      result.push({
        id: `${row.id}.fejl`,
        label,
        status: 'error',
        message: `${rowName}: ${parts.length > 0 ? parts.join('; ') : 'ugyldig værdi'}`,
        summaryDisplay: 'messageOnly',
        sourceRowId: row.id,
        ...(focusColKey === undefined ? {} : { focusColKey }),
      });
      return;
    }

    if (issue?.level === 'warning') {
      typesWithFindings.add(groupKey);
      result.push({
        id: `${row.id}.udenBeloeb`,
        label,
        status: 'warning',
        message: `${rowName}: Beløb er ikke angivet`,
        summaryDisplay: 'messageOnly',
        sourceRowId: row.id,
        focusColKey: 'ydelse',
      });
    }
    for (const warning of warningsByRowId.get(row.id) ?? []) {
      typesWithFindings.add(groupKey);
      result.push({
        id: `${row.id}.${warning.kind}`,
        label,
        status: 'warning',
        message: warning.summaryMessage,
        summaryDisplay: 'messageOnly',
        sourceRowId: row.id,
        focusColKey: warning.kind === 'duplicateRow' ? 'fraDato' : 'ydelse',
      });
    }
    if (!okTypes.has(groupKey)) {
      okTypes.set(groupKey, { id: groupKey, label, status: 'ok', message: 'Ok' });
    }
  });

  const okRows = Array.from(okTypes.entries())
    .filter(([groupKey]) => !typesWithFindings.has(groupKey))
    .map(([, row]) => row);
  return [...result, ...okRows];
};
