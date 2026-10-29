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
import { resolveMidlertidigEetDato } from '../validation/tafPeriodConstraints';
import { erMidlertidigtEetYdelsestype } from '../../../data/ydelsestyper';
import { eoMidlertidigtEETAfgorelseField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';

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

const MIDLERTIDIGT_EET_IMPORT_FAILURE_PREFIX = 'Midlertidigt EET kan ikke hentes fra Erhvervsevnetab-siden';

/**
 * En fejl, der spærrer importen, siger FØLGEN først: «Midlertidigt EET kan ikke hentes fra Erhvervsevnetab-siden:
 * <årsag>». Årsagen alene («Der er en afgørelse uden afgørelsesdato») læses i EO som en bemærkning om EET-siden – og
 * ikke som, at fradraget er faldet bort (BB-357). Beskeder, der allerede nævner midlertidigt EET, står urørte.
 */
const describeImportFailure = (issue: EetIssue): EetIssue => {
  if (issue.severity !== 'error' || issue.message.startsWith('Midlertidigt EET')) return issue;
  const cause = issue.message.trim();
  // Et ord med versal efterfulgt af minuskel er sætningsbegyndelsen; forkortelser som «EET-…» og «ASL» bevares.
  const causeInSentence = /^\p{Lu}\p{Ll}/u.test(cause)
    ? `${cause.charAt(0).toLocaleLowerCase('da-DK')}${cause.slice(1)}`
    : cause;
  return { ...issue, message: `${MIDLERTIDIGT_EET_IMPORT_FAILURE_PREFIX}: ${causeInSentence}` };
};

/**
 * Adapterer den schema-validerede EET-importport til EO's virtuelle grupper.
 *
 * Returnerer altid både `groups` og `issues` samtidigt, så EOberegningTab og snapshot
 * kan dele samme beregningsresultat uden at kalde `computeEetLoebendeYdelser` to gange.
 *
 * Kun en FEJL stopper importen. En advarsel fra EET-siden (fx en procent uden for 10 %-trinnene eller en
 * midlertidig afgørelse efter en endelig) følger med som advarsel, og fradraget er det samme, som EET-siden selv
 * regner. Før opgav importen alle perioder ved den mindste linje fra EET-siden – også en advarsel – og kravet
 * blev det fulde fradrag for højt uden et ord om, at fradraget var faldet bort (BB-357, mønster M-43).
 */
export const buildMidlertidigtEetSourceResult = (
  context: EetImportContext | null | undefined
): MidlertidigtEetTransientResult => {
  if (!context) {
    return {
      groups: [],
      issues: [describeImportFailure({
        id: 'midlertidigt-eet-source-missing',
        severity: 'error',
        message: 'EET-oplysningerne kunne ikke indlæses sikkert til Erstatningsopgørelsen.',
      })],
    };
  }
  if (context.issues.some((issue) => issue.severity === 'error')) {
    return { groups: [], issues: context.issues.map(describeImportFailure) };
  }
  let groups: readonly MidlertidigtEetAfgoerelseGroup[];
  try {
    groups = buildMidlertidigtEetAfgoerelseGroupsFromImportContext(context.groups);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl i midlertidigt EET-import.';
    return {
      groups: [],
      issues: [
        ...context.issues,
        describeImportFailure({
          id: 'midlertidigt-eet-import-invariant',
          severity: 'error',
          message,
        }),
      ],
    };
  }
  return {
    groups,
    issues: context.issues,
  };
};

export const MIDLERTIDIGT_EET_INGEN_YDELSER_I_TAF_ID = 'midlertidigt-eet-ingen-ydelser-i-taf';

export const MIDLERTIDIGT_EET_INGEN_YDELSER_I_TAF_MESSAGE =
  'Erhvervsevnetab-siden har ingen midlertidig afgørelse med ydelser i TAF-perioden – der fradrages intet midlertidigt EET';

/**
 * Togglen er slået til, men importen giver ingen løbende ydelse i TAF-perioden: en ikke-blokerende advarsel
 * (BB-358, udviklerafgørelse 2026-10-29). Uden den så det udfald, hvor intet trækkes fra, ud præcis som det, hvor
 * fradraget er gjort – og den eksisterende advarsel om en afgørelse uden ydelser tav, fordi togglen tæller som ydelser.
 *
 * Advarslen gælder kun, når TAF-perioden helt eller delvist ligger på eller efter den midlertidige afgørelses dato på
 * EO oplysninger (virkningsdatoen, ellers afgørelsesdatoen): før den dato løber der endnu ingen ydelse. Er der ingen
 * afgørelse på EO oplysninger, siger konsistensadvarslen det allerede; spærrer importen, siger fejlen det.
 *
 * Det er den sidste udvej mod et tavst tab af midlertidigt EET: uanset hvorfor importen kommer tom tilbage – ingen
 * midlertidig afgørelse, ydelser kun uden for TAF-perioden eller en afgørelse, EET-siden ikke kan periodisere – står
 * der en linje.
 */
export const resolveMidlertidigtEetIngenYdelserIssue = (args: Readonly<{
  values: Pick<
    ErstatningsopgoerelseValues,
    'midlertidigtEetFraEetSiden' | 'midlertidigtEETAfgorelse' | 'midlertidigEETVirkningsdato' | 'midlertidigEETAfgoerelseDato'
  >;
  tafRanges: readonly IsoRange[];
  result: MidlertidigtEetTransientResult;
}>): EetIssue | undefined => {
  const { values, tafRanges, result } = args;
  if (values.midlertidigtEetFraEetSiden !== 'Ja') return undefined;
  if (result.issues.some((issue) => issue.severity === 'error')) return undefined;
  const afgoerelsensDato = resolveMidlertidigEetDato(values);
  if (afgoerelsensDato === undefined) return undefined;
  if (!tafRanges.some((range) => range.til >= afgoerelsensDato)) return undefined;
  const harYdelseITafPerioden = result.groups.some((group) => group.perioder.some((periode) =>
    periode.beregnetEetOre > 0 && tafRanges.some((range) => periode.fra <= range.til && range.fra <= periode.til)
  ));
  if (harYdelseITafPerioden) return undefined;
  return {
    id: MIDLERTIDIGT_EET_INGEN_YDELSER_I_TAF_ID,
    severity: 'warning',
    message: MIDLERTIDIGT_EET_INGEN_YDELSER_I_TAF_MESSAGE,
  };
};

export const MIDLERTIDIGT_EET_UDEN_AFGOERELSE_INTET_HENTET_ID = 'midlertidigt-eet-uden-afgoerelse-intet-hentet';
export const MIDLERTIDIGT_EET_UDEN_AFGOERELSE_HENTET_ID = 'midlertidigt-eet-uden-afgoerelse-hentet';

/**
 * Togglen er slået til, men «Midlertidigt EET-afgørelse» på EO oplysninger er ikke `Ja` (BB-372, udviklerafgørelse
 * 2026-10-29). To tilstande med hver sin gule linje – før stod «Der er indtastet midlertidige EET-ydelser, men ikke
 * angivet en afgørelse» i begge, også når intet var indtastet eller hentet:
 *
 *  - importen giver intet: der fradrages intet, og det siger linjen;
 *  - importen giver ydelser: de fradrages (valg A – fradraget følger togglen, ikke valget på EO oplysninger), og
 *    linjen påpeger uoverensstemmelsen mellem de to sider.
 *
 * Ikke-blokerende som BB-240's mønster: afgørelsen er en oplysning, ydelsen en forventning. En blokerende importfejl
 * siger selv sit; så tier denne.
 */
export const resolveMidlertidigtEetUdenAfgoerelseIssue = (args: Readonly<{
  values: Pick<ErstatningsopgoerelseValues, 'midlertidigtEetFraEetSiden' | 'midlertidigtEETAfgorelse'>;
  result: MidlertidigtEetTransientResult;
}>): EetIssue | undefined => {
  const { values, result } = args;
  if (values.midlertidigtEetFraEetSiden !== 'Ja' || values.midlertidigtEETAfgorelse === 'Ja') return undefined;
  if (result.issues.some((issue) => issue.severity === 'error')) return undefined;
  const focusTarget = { kind: 'fieldAddress' as const, address: eoMidlertidigtEETAfgorelseField.bind().address };
  return result.groups.length === 0
    ? {
      id: MIDLERTIDIGT_EET_UDEN_AFGOERELSE_INTET_HENTET_ID,
      severity: 'warning',
      message: 'Midlertidigt EET hentes fra Erhvervsevnetab-siden, men der er ikke angivet en midlertidig EET-afgørelse – der fradrages intet midlertidigt EET',
      focusTarget,
    }
    : {
      id: MIDLERTIDIGT_EET_UDEN_AFGOERELSE_HENTET_ID,
      severity: 'warning',
      message: 'Erhvervsevnetab-siden har en midlertidig afgørelse, men der er ikke angivet en midlertidig EET-afgørelse på EO oplysninger',
      focusTarget,
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
    (row) => !erMidlertidigtEetYdelsestype(row.ydelsestype)
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
