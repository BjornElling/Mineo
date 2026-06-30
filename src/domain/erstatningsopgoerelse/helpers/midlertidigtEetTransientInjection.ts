import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { EetIssue } from '../../erhvervsevnetab/eetTypes';
import type { ISODateString } from '../../../types/branded';
import { isAslAfgoerelseRowEmpty } from '../../erhvervsevnetab/eetAslAfgoerelser';
import { buildMidlertidigtEetAfgoerelseGroupsFromComputation, type MidlertidigtEetAfgoerelseGroup, type MidlertidigtEetInsertSource } from './midlertidigtEetInsertRows';
import { computeEetLoebendeYdelser, EET_LOEBENDE_BEREGNINGSDATO_RELATIVE_WARNING_IDS } from '../../erhvervsevnetab/eetLoebendeYdelserCalculation';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { sumMaanedsbroekForInterval } from '../engines/periodiseringsMotor';
import { splitIsoRangeByCalendarMonthsInclusive } from '../engines/periodRangeGroups';

export type MidlertidigtEetTransientResult = Readonly<{
  groups: readonly MidlertidigtEetAfgoerelseGroup[];
  issues: readonly EetIssue[];
}>;

/**
 * Beregner midlertidigt EET-grupper og EET-issues fra insert-source'en i ét kald.
 *
 * Returnerer altid både `groups` og `issues` samtidigt, så EOberegningTab og snapshot
 * kan dele samme beregningsresultat uden at kalde `computeEetLoebendeYdelser` to gange.
 */
export const buildMidlertidigtEetSourceResult = (
  source: MidlertidigtEetInsertSource | null | undefined,
  options?: Readonly<{ loebendeYdelserSlutdatoOverride?: ISODateString }>
): MidlertidigtEetTransientResult => {
  if (!source) {
    return { groups: [], issues: [] };
  }
  if (source.issues && source.issues.length > 0) {
    return { groups: [], issues: source.issues };
  }
  const hasImportRelevantAslRow = source.eetValues.aslAfgoerelser.some((row) =>
    !isAslAfgoerelseRowEmpty(row) &&
    (row.afgoerelseType === 'Midlertidig' || row.afgoerelseType === 'Delvist endelig')
  );

  if (!hasImportRelevantAslRow) {
    return { groups: [], issues: [] };
  }

  const result = computeEetLoebendeYdelser({
    erhvervsevnetab: source.eetValues,
    skadedato: source.skadedato,
    skadelidteFodselsdato: source.eetValues.skadelidteFodselsdato,
    loebendeYdelserSlutdatoOverride: options?.loebendeYdelserSlutdatoOverride,
  });
  // EO-import-relevansfiltrering: de beregningsdato-relative advarsler giver ikke mening i
  // erstatningsopgørelsen, hvor "beregningsdatoen" blot er TAF-slutdatoen. Se konstantens JSDoc.
  const issues = result.issues.filter(
    (issue) => !EET_LOEBENDE_BEREGNINGSDATO_RELATIVE_WARNING_IDS.has(issue.id)
  );
  let groups: readonly MidlertidigtEetAfgoerelseGroup[];
  try {
    groups = buildMidlertidigtEetAfgoerelseGroupsFromComputation(result.computation);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl i midlertidigt EET-import.';
    return {
      groups: [],
      issues: [
        ...issues,
        {
          id: 'midlertidigt-eet-import-invariant',
          severity: 'error',
          message,
        },
      ],
    };
  }
  return {
    groups,
    issues,
  };
};

/**
 * Når togglen `midlertidigtEetFraEetSiden` er `'Ja'`, injiceres rækkerne fra EET-siden
 * transient ind i `offentligeYdelserRows` (som om de var indtastet i tabellen).
 *
 * Eksisterende manuelle `midlertidigt_eet`-rækker filtreres defensivt væk, så invarianten
 * fra §6.1 i implementeringsplanen ikke kan brydes ved fx en bug i UI'et.
 *
 * Når togglen er `'Nej'`, returneres EO-værdierne uændret.
 */
export const buildEoValuesWithTransientMidlertidigtEet = (
  eoValues: ErstatningsopgoerelseValues,
  groups: readonly MidlertidigtEetAfgoerelseGroup[]
): ErstatningsopgoerelseValues => {
  if (eoValues.midlertidigtEetFraEetSiden !== 'Ja') return eoValues;
  const baseRows = (eoValues.offentligeYdelserRows ?? []).filter(
    (row) => row.ydelsestype?.trim() !== 'midlertidigt_eet'
  );
  const virtualRows = buildMidlertidigtEetCalculationRows(groups);
  if (virtualRows.length === 0) {
    if (baseRows.length === (eoValues.offentligeYdelserRows ?? []).length) return eoValues;
    return { ...eoValues, offentligeYdelserRows: baseRows };
  }
  return {
    ...eoValues,
    offentligeYdelserRows: [...baseRows, ...virtualRows],
  };
};

export const buildMidlertidigtEetCalculationRows = (
  groups: readonly MidlertidigtEetAfgoerelseGroup[]
): readonly OffentligeYdelserRow[] => {
  const rows: OffentligeYdelserRow[] = [];

  groups.forEach((group, groupIndex) => {
    group.perioder.forEach((periode, periodeIndex) => {
      const monthRanges = splitIsoRangeByCalendarMonthsInclusive(periode.fra, periode.til);
      monthRanges.forEach((range, monthIndex) => {
        const maaneder = sumMaanedsbroekForInterval(range.fra, range.til);
        const ydelse = maaneder * periode.maanedligYdelse;
        if (!Number.isFinite(ydelse) || ydelse <= 0) return;
        // Importeret EET er en månedsydelse. Internt splittes den derfor pr.
        // kalendermåned, så den eksisterende kalenderdagsperiodisering inden for
        // rækken svarer til x/dage-i-måneden og ikke til gennemsnitsdage over en
        // længere EET-periode.
        rows.push({
          id: `midlertidigt_eet_calc_${groupIndex}_${periodeIndex}_${monthIndex}_${range.fra}_${range.til}`,
          fraDato: range.fra,
          tilDato: range.til,
          ydelse: {
            kind: 'number',
            value: ydelse,
          },
          tillaeg: undefined,
          ydelsestype: 'midlertidigt_eet',
        });
      });
    });
  });

  return rows;
};
