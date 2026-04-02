import type { ErhvervsevnetabComposedValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isoToDanish } from '../../../types/branded';
import { computeEetLoebendeYdelser } from '../../erhvervsevnetab/eetLoebendeYdelserCalculation';
import { generateOffentligYdelseRowId } from './eoRowInitialValues';

type BuildMidlertidigtEetRowsArgs = Readonly<{
  eetValues: ErhvervsevnetabComposedValues;
  skadesdato: ISODateString | undefined;
}>;

export const buildMidlertidigtEetRowsFromEet = ({
  eetValues,
  skadesdato,
}: BuildMidlertidigtEetRowsArgs): readonly OffentligeYdelserRow[] => {
  const result = computeEetLoebendeYdelser({
    erhvervsevnetab: eetValues,
    skadesdato,
    skadelidteFodselsdato: eetValues.skadelidteFodselsdato,
  });

  const computation = result.computation;
  if (!computation) return [];

  const rows: OffentligeYdelserRow[] = [];

  for (const afgoerelse of computation.afgoerelser) {
    if (afgoerelse.afgoerelseType !== 'Midlertidig' && afgoerelse.afgoerelseType !== 'Delvist endelig') continue;

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
  }

  return rows;
};

/**
 * EO-importen af midlertidigt EET er en bevidst kontrakt-undtagelse:
 * - Den læser EET's committed input på page-niveau og kører nøjagtig samme
 *   løbende-ydelser-beregning som fanen "Løbende ydelser".
 * - Der laves ingen særskilt EO-beregning og ingen differencekravs-variant.
 * - Hver række i EET-tabellen "Beregnede ydelser" bliver til præcis én EO-række.
 */
