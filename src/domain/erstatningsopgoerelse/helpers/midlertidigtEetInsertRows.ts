import type { ErhvervsevnetabComposedValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isoToDanish } from '../../../types/branded';
import { computeEetLoebendeYdelser, type EetLoebendeComputation, type EetLoebendePeriodeRow } from '../../erhvervsevnetab/eetLoebendeYdelserCalculation';
import { generateOffentligYdelseRowId } from './eoRowInitialValues';

/** Input til buildMidlertidigtEetAfgoerelseGroups. */
export type MidlertidigtEetInsertSource = Readonly<{
  eetValues: ErhvervsevnetabComposedValues;
  skadedato: ISODateString | undefined;
}>;

type BuildMidlertidigtEetRowsArgs = MidlertidigtEetInsertSource;

/**
 * Én afgørelses data til hhv. UI-tabelindsætning og PDF-rendering.
 *
 * - `rows`: Bruges til indsætning i offentlige ydelser-tabellen (UI).
 *   Indeholder én OffentligeYdelserRow pr. periode med `ydelsestype: 'midlertidigt_eet'`.
 * - `perioder`: Bruges til PDF-rendering i midlertidigt EET-sektionen.
 *   Indeholder beregningsdetaljer (grundydelse, regulering, måneder osv.) pr. periode.
 * Begge er deriveret fra den samme afgørelses perioder og er altid i sync.
 */
export type MidlertidigtEetAfgoerelseGroup = Readonly<{
  afgoerelsesdato: ISODateString;
  rows: readonly OffentligeYdelserRow[];
  perioder: readonly EetLoebendePeriodeRow[];
}>;

export const buildMidlertidigtEetAfgoerelseGroups = ({
  eetValues,
  skadedato,
}: BuildMidlertidigtEetRowsArgs): readonly MidlertidigtEetAfgoerelseGroup[] => {
  const result = computeEetLoebendeYdelser({
    erhvervsevnetab: eetValues,
    skadedato,
    skadelidteFodselsdato: eetValues.skadelidteFodselsdato,
  });

  return buildMidlertidigtEetAfgoerelseGroupsFromComputation(result.computation);
};

export const buildMidlertidigtEetAfgoerelseGroupsFromComputation = (
  computation: EetLoebendeComputation | null
): readonly MidlertidigtEetAfgoerelseGroup[] => {
  if (!computation) return [];
  const groups: MidlertidigtEetAfgoerelseGroup[] = [];

  for (const afgoerelse of computation.afgoerelser) {
    if (afgoerelse.afgoerelseType !== 'Midlertidig' && afgoerelse.afgoerelseType !== 'Delvist endelig') continue;

    const rows: OffentligeYdelserRow[] = [];
    for (const periode of afgoerelse.perioder) {
      const fraDato = isoToDanish(periode.fra);
      const tilDato = isoToDanish(periode.til);
      if (!fraDato || !tilDato) {
        throw new Error('CRITICAL: Kunne ikke konvertere midlertidigt EET-periode til dansk tabel-format.');
      }

      rows.push({
        id: generateOffentligYdelseRowId(),
        fraDato,
        tilDato,
        ydelse: {
          kind: 'number',
          value: periode.beregnetEet,
        },
        tillaeg: undefined,
        ydelsestype: 'midlertidigt_eet',
      });
    }

    if (rows.length > 0) {
      groups.push({
        afgoerelsesdato: afgoerelse.afgoerelsesdato,
        rows,
        perioder: afgoerelse.perioder,
      });
    }
  }

  return groups;
};

/**
 * EO-importen af midlertidigt EET er en bevidst kontrakt-undtagelse, jf.
 * `domain-boundary-contract.md` §9 og `eo-snapshot-contract.md` §13:
 * - Den læser EET's committed input på page-niveau og kører nøjagtig samme
 *   løbende-ydelser-beregning som fanen "Løbende ydelser".
 * - Der laves ingen særskilt EO-beregning og ingen differencekravs-variant.
 * - Hver række i EET-tabellen "Beregnede ydelser" bliver til præcis én EO-række.
 * - Midlertidigt EET i EET-fanen beregnes på kalenderdage; EO-importen skal derfor
 *   bevare både periode og periodetotalbeløb uændret for at være korrekt.
 *
 * Importen aktiveres af togglen `midlertidigtEetFraEetSiden` på Offentlige ydelser-fanen.
 * Når togglen er `'Ja'`, injiceres rækkerne *transient* i EO-beregningen via
 * `buildEoValuesWithTransientMidlertidigtEet` i `midlertidigtEetTransientInjection.ts` —
 * de skrives aldrig til committed form-state. Den tidligere "Indsæt midlertidigt EET"-knap
 * (som skrev rækkerne til form-state) er udfaset og erstattet af denne toggle-baserede
 * mekanisme.
 */
