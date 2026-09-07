import {
  amountAutofillColumn,
  choiceAutofillColumn,
  dateAutofillColumn,
} from '../../../inputCore/autofill/autofillColumns';
import type { AutofillSuggestModel } from '../../../inputCore/autofill/autofillSuggestModel';
import {
  eoOffentligeYdelserFraDatoField,
  eoOffentligeYdelserTillaegField,
  eoOffentligeYdelserTilDatoField,
  eoOffentligeYdelserYdelseField,
  eoOffentligeYdelserYdelsestypeField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { ydelsestypeKeys, ydelsestyper, type YdelsestypeKey } from '../../../data/ydelsestyper';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';

/**
 * Autofill-modellen for Offentlige ydelser-tabellen.
 *
 * Kolonneindeksene er tabellens egne (`OffentligeYdelserTable`): 0 fra-dato, 1 til-dato, 2 ydelse,
 * 3 tillæg og 4 ydelsestype. Ydelsestypen kan gentage et synligt, aktivt katalogvalg; de sidste tre
 * kolonner er afledte og indgår ikke.
 *
 * Ydelse og tillæg gentager cellen ovenover uden mønster eller årsskifte-gate – se
 * {@link buildStandardLoenAutofillModel} for begrundelsen.
 */
export const buildOffentligeYdelserAutofillModel = (
  rowIds: readonly string[],
  committedById: ReadonlyMap<string, OffentligeYdelserRow>,
  availableYdelsestyper: readonly YdelsestypeKey[] = ydelsestypeKeys
): AutofillSuggestModel => {
  const rows = rowIds.map((rowId) => committedById.get(rowId));
  return Object.freeze({
    rowIds,
    columns: Object.freeze([
      dateAutofillColumn(0, eoOffentligeYdelserFraDatoField, rows.map((row) => row?.fraDato)),
      dateAutofillColumn(1, eoOffentligeYdelserTilDatoField, rows.map((row) => row?.tilDato)),
      amountAutofillColumn(2, eoOffentligeYdelserYdelseField, rows.map((row) => row?.ydelse)),
      amountAutofillColumn(3, eoOffentligeYdelserTillaegField, rows.map((row) => row?.tillaeg)),
      choiceAutofillColumn(
        4,
        eoOffentligeYdelserYdelsestypeField,
        rows.map((row) => row?.ydelsestype),
        (value) => ydelsestyper[value]?.label,
        availableYdelsestyper,
      ),
    ]),
  });
};
