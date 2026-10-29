import {
  amountAutofillColumn,
  dateAutofillColumn,
  integerAutofillColumn,
} from '../../../inputCore/autofill/autofillColumns';
import type { AutofillSuggestModel } from '../../../inputCore/autofill/autofillSuggestModel';
import {
  rentekravBelobField,
  rentekravRenterFraField,
  rentekravTillaegstidField,
} from '../../../inputCore/catalog/renteberegningDescriptors';
import type { RentekravRow } from '../../../schemas/formSchemas';

/**
 * Autofill-modellen for renteberegningens kravtabel (Renteberegning og MinProcesrente).
 *
 * Kolonneindeksene er tabellens egne (`BeregnetRenteTable`): 0 beløb, 1 forfaldsdato, 2 tillægstid og
 * 3 enhed. Beløbet har ingen periode og gentages derfor kun som to ens beløb; forfaldsdatoen er en
 * selvstændig datoserie (fx månedlige rater). Tillægstiden gentages kun ved samme enhed i prøverne og
 * målrækken. Enheden er aldrig tom og kan derfor ikke vise et forslag.
 */
export const buildRentekravAutofillModel = (
  rowIds: readonly string[],
  committedById: ReadonlyMap<string, RentekravRow>
): AutofillSuggestModel => {
  const rows = rowIds.map((rowId) => committedById.get(rowId));
  return Object.freeze({
    rowIds,
    columns: Object.freeze([
      amountAutofillColumn(0, rentekravBelobField, rows.map((row) => row?.belob)),
      dateAutofillColumn(1, rentekravRenterFraField, rows.map((row) => row?.renterFra)),
      integerAutofillColumn(2, rentekravTillaegstidField, rows.map((row) => row?.tillaegstid), rows.map((row) => row?.enhed ?? 'dage')),
    ]),
  });
};
