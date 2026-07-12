import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isISODateString } from '../../../types/branded';
import type { EetImportContext } from '../../erhvervsevnetab/eetImportPort';
import type { EetLoebendePeriodeRow } from '../../erhvervsevnetab/eetLoebendeYdelserCalculation';
import { generateOffentligYdelseRowId } from './eoRowInitialValues';
import { toKroner } from '../../money/money';

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
  eetPct: number;
  rows: readonly OffentligeYdelserRow[];
  perioder: readonly EetLoebendePeriodeRow[];
}>;

export const buildMidlertidigtEetAfgoerelseGroupsFromImportContext = (
  importGroups: EetImportContext['groups']
): readonly MidlertidigtEetAfgoerelseGroup[] => {
  const groups: MidlertidigtEetAfgoerelseGroup[] = [];

  for (const afgoerelse of importGroups) {
    const rows: OffentligeYdelserRow[] = [];
    for (const periode of afgoerelse.perioder) {
      if (!isISODateString(periode.fra) || !isISODateString(periode.til)) {
        throw new Error('CRITICAL: Kunne ikke konvertere midlertidigt EET-periode til ISO EO-række.');
      }
      rows.push({
        id: generateOffentligYdelseRowId(),
        fraDato: periode.fra,
        tilDato: periode.til,
        ydelse: {
          kind: 'number',
          // AmountValue er et persisted kroneinput; MoneyOre må kun forlades ved denne port.
          value: toKroner(periode.beregnetEetOre),
        },
        tillaeg: undefined,
        ydelsestype: 'midlertidigt_eet',
      });
    }

    if (rows.length > 0) {
      groups.push({
        afgoerelsesdato: afgoerelse.afgoerelsesdato,
        eetPct: afgoerelse.eetPct,
        rows,
        perioder: afgoerelse.perioder,
      });
    }
  }

  return groups;
};
