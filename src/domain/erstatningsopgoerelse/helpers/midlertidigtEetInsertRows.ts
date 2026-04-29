import type { ErhvervsevnetabComposedValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isoToDanish } from '../../../types/branded';
import type { EetLoebendeComputation, EetLoebendePeriodeRow } from '../../erhvervsevnetab/eetLoebendeYdelserCalculation';
import { generateOffentligYdelseRowId } from './eoRowInitialValues';

/** Input til den kanoniske EET-import via buildMidlertidigtEetSourceResult. */
export type MidlertidigtEetInsertSource = Readonly<{
  eetValues: ErhvervsevnetabComposedValues;
  skadedato: ISODateString | undefined;
}>;

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
