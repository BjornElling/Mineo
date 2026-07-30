import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { EetIssue } from '../../erhvervsevnetab/eetTypes';
import {
  buildEetImportContext,
  buildUnavailableEetImportContext,
  type EetImportContext,
  type EetImportSource,
} from '../../erhvervsevnetab/eetImportPort';
import { buildMidlertidigtEetAfgoerelseGroupsFromImportContext, type MidlertidigtEetAfgoerelseGroup } from './midlertidigtEetInsertRows';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { sumMaanedsbroekForInterval } from '../../dates/maanedsbroek';
import { splitIsoRangeByCalendarMonthsInclusive } from '../engines/periodRangeGroups';
import { toKroner } from '../../money/money';
import type { IsoRange } from '../../../utils/isoDateHelpers';

export type MidlertidigtEetTransientResult = Readonly<{
  groups: readonly MidlertidigtEetAfgoerelseGroup[];
  issues: readonly EetIssue[];
}>;

/**
 * Den fælles EO-wiring fra schema-valideret EET-kilde og clampede TAF-ranges til importporten.
 * Komponenten og snapshot-testene bruger samme funktion, så valg af seneste TAF-slutdato og
 * fail-closed-fejlen ved manglende periode ikke kan drive fra hinanden.
 */
export const buildMidlertidigtEetImportContext = (
  source: EetImportSource,
  tafRanges: readonly IsoRange[]
): EetImportContext => {
  const slutdato = tafRanges.reduce<IsoRange['til'] | undefined>(
    (latest, range) => (latest && latest > range.til ? latest : range.til),
    undefined
  );
  return slutdato
    ? buildEetImportContext(source, slutdato)
    : buildUnavailableEetImportContext(source, 'taf_slutdato_missing');
};

/**
 * Adapterer den schema-validerede EET-importport til EO's virtuelle grupper.
 *
 * Returnerer altid både `groups` og `issues` samtidigt, så EOberegningTab og snapshot
 * kan dele samme beregningsresultat uden at kalde `computeEetLoebendeYdelser` to gange.
 */
export const buildMidlertidigtEetSourceResult = (
  context: EetImportContext | null | undefined
): MidlertidigtEetTransientResult => {
  if (!context) {
    return {
      groups: [],
      issues: [{
        id: 'midlertidigt-eet-source-missing',
        severity: 'error',
        message: 'EET-oplysningerne kunne ikke indlæses sikkert til Erstatningsopgørelsen.',
      }],
    };
  }
  if (context.issues.length > 0) return { groups: [], issues: context.issues };
  let groups: readonly MidlertidigtEetAfgoerelseGroup[];
  try {
    groups = buildMidlertidigtEetAfgoerelseGroupsFromImportContext(context.groups);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl i midlertidigt EET-import.';
    return {
      groups: [],
      issues: [
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
    issues: context.issues,
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
export const buildEoValuesWithTransientMidlertidigtEet = <
  T extends Pick<ErstatningsopgoerelseValues, 'midlertidigtEetFraEetSiden' | 'offentligeYdelserRows'>
>(
  eoValues: T,
  groups: readonly MidlertidigtEetAfgoerelseGroup[]
): T => {
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
        const ydelse = maaneder * toKroner(periode.maanedligYdelseOre);
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
