import {
  amountAutofillColumn,
  dateAutofillColumn,
} from '../../../inputCore/autofill/autofillColumns';
import type { AutofillSuggestModel } from '../../../inputCore/autofill/autofillSuggestModel';
import {
  eoOffentligeYdelserFraDatoField,
  eoOffentligeYdelserTillaegField,
  eoOffentligeYdelserTilDatoField,
  eoOffentligeYdelserYdelseField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';

/**
 * Autofill-modellen for Offentlige ydelser-tabellen.
 *
 * Kolonneindeksene er tabellens egne (`OffentligeYdelserTable`): 0 fra-dato, 1 til-dato, 2 ydelse,
 * 3 tillæg. Ydelsestypen (4) er en dropdown og de sidste tre kolonner er afledte – ingen af dem er
 * indtastningsceller og ingen af dem indgår.
 *
 * `yearAnchorColIndex: 0` er FRA-datoen: det er rækkens periodestart, og et beløb foreslås ikke, når
 * startdatoen falder i et nyt kalenderår (nye satser, ny sygedagpengesats).
 */
export const buildOffentligeYdelserAutofillModel = (
  rowIds: readonly string[],
  committedById: ReadonlyMap<string, OffentligeYdelserRow>
): AutofillSuggestModel => {
  const rows = rowIds.map((rowId) => committedById.get(rowId));
  return Object.freeze({
    rowIds,
    columns: Object.freeze([
      dateAutofillColumn(0, eoOffentligeYdelserFraDatoField, rows.map((row) => row?.fraDato)),
      dateAutofillColumn(1, eoOffentligeYdelserTilDatoField, rows.map((row) => row?.tilDato)),
      amountAutofillColumn(2, eoOffentligeYdelserYdelseField, rows.map((row) => row?.ydelse)),
      amountAutofillColumn(3, eoOffentligeYdelserTillaegField, rows.map((row) => row?.tillaeg)),
    ]),
    yearAnchorColIndex: 0,
  });
};
