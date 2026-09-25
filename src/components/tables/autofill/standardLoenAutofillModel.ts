import {
  amountAutofillColumn,
  dateAutofillColumn,
  monthOfYearAutofillColumn,
  weekAutofillColumn,
  yearAutofillColumn,
} from '../../../inputCore/autofill/autofillColumns';
import type { AutofillColumn, AutofillSuggestModel } from '../../../inputCore/autofill/autofillSuggestModel';
import type { StandardLoenTableFieldSet } from '../../../domain/standardLoen/standardLoenTableFieldSet';
import type { Loenperiode, StandardLoenTableRow } from '../../../schemas/formSchemas';

/**
 * Autofill-modellen for løntabellen.
 *
 * De to periodekolonner (0 og 1) BETYDER forskellige ting pr. lønperiode, og det er ikke et
 * implementeringsdetalje men selve mønstret:
 *
 * - **Måned:** kolonne 0 er månedstallet og kolonne 1 er årstallet. De to udgør ÉN månedsserie – derfor
 *   koblingen. Efter 12/2025 er næste par 01/2026, og årstallet vokser, fordi måneden wrappede.
 * - **Uge:** to selvstændige uge/år-serier (fra-uge og til-uge), hver med sit eget skridt. Så bærer
 *   tabellen både enkeltuger og flerugers-intervaller (2 og 4 uger) uden en særregel.
 * - **Dag:** to selvstændige datoserier. Her falder både ugeintervaller (7/14/28 dage) og
 *   månedsintervaller (samme dag i næste måned, sidste dag i næste måned) ud af datomønstrene.
 *
 * Beløbskolonnerne (2–5 og i Beløb-tilstand 6–7) kræver to ens beløb. Koblingen til periodekolonnerne
 * bruges til at undertrykke en gentagelse, når målrækken dækker flere kalenderdage.
 *
 * Tillægsbeløbene (6/7) er kun indtastningsceller i Beløb-tilstand; i Procent-tilstand er de afledte
 * visningsfelter og indgår ikke.
 */
export const buildStandardLoenAutofillModel = ({
  rowIds,
  committedById,
  fieldSet,
  loenperiode,
  beloebMode,
}: Readonly<{
  rowIds: readonly string[];
  committedById: ReadonlyMap<string, StandardLoenTableRow>;
  fieldSet: StandardLoenTableFieldSet;
  loenperiode: Loenperiode;
  beloebMode: boolean;
}>): AutofillSuggestModel => {
  const rows = rowIds.map((rowId) => committedById.get(rowId));

  const periodColumns: readonly AutofillColumn[] = loenperiode === 'maaned'
    ? [
        monthOfYearAutofillColumn(0, fieldSet.col0_maaned, rows.map((row) => row?.col0_maaned), 1),
        yearAutofillColumn(1, fieldSet.col1_maaned, rows.map((row) => row?.col1_maaned), 0),
      ]
    : loenperiode === 'uge'
      ? [
          weekAutofillColumn(0, fieldSet.col0_uge, rows.map((row) => row?.col0_uge)),
          weekAutofillColumn(1, fieldSet.col1_uge, rows.map((row) => row?.col1_uge)),
        ]
      : [
          dateAutofillColumn(0, fieldSet.col0_dag, rows.map((row) => row?.col0_dag), 'start'),
          dateAutofillColumn(1, fieldSet.col1_dag, rows.map((row) => row?.col1_dag), 'end'),
        ];

  const amountColumns: readonly AutofillColumn[] = [
    amountAutofillColumn(2, fieldSet.col2, rows.map((row) => row?.col2), [0, 1]),
    amountAutofillColumn(3, fieldSet.col3, rows.map((row) => row?.col3), [0, 1]),
    amountAutofillColumn(4, fieldSet.col4, rows.map((row) => row?.col4), [0, 1]),
    amountAutofillColumn(5, fieldSet.col5, rows.map((row) => row?.col5), [0, 1]),
    ...(beloebMode
      ? [
          amountAutofillColumn(6, fieldSet.fpFvShSoBeloeb, rows.map((row) => row?.fpFvShSoBeloeb), [0, 1]),
          amountAutofillColumn(7, fieldSet.pensionBeloeb, rows.map((row) => row?.pensionBeloeb), [0, 1]),
        ]
      : []),
  ];

  return Object.freeze({
    rowIds,
    columns: Object.freeze([...periodColumns, ...amountColumns]),
  });
};
