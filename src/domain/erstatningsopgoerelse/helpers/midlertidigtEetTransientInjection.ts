import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { EetIssue } from '../../erhvervsevnetab/eetTypes';
import type { ISODateString } from '../../../types/branded';
import { isAslAfgoerelseRowEmpty } from '../../erhvervsevnetab/eetAslAfgoerelser';
import { buildMidlertidigtEetAfgoerelseGroupsFromComputation, type MidlertidigtEetAfgoerelseGroup, type MidlertidigtEetInsertSource } from './midlertidigtEetInsertRows';
import { computeEetLoebendeYdelser } from '../../erhvervsevnetab/eetLoebendeYdelserCalculation';

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
  const groups = buildMidlertidigtEetAfgoerelseGroupsFromComputation(result.computation);
  return {
    groups,
    issues: result.issues,
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
  const virtualRows = groups.flatMap((g) => g.rows);
  if (virtualRows.length === 0) {
    if (baseRows.length === (eoValues.offentligeYdelserRows ?? []).length) return eoValues;
    return { ...eoValues, offentligeYdelserRows: baseRows };
  }
  return {
    ...eoValues,
    offentligeYdelserRows: [...baseRows, ...virtualRows],
  };
};
