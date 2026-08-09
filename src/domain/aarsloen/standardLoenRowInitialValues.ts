import type { StandardLoenTableRow } from '../../schemas/formSchemas';

/**
 * Kanonisk tom lønrække. Fabrikken ligger i Årsløn-domænet, fordi samme rækkeform bruges af både
 * Årsløn og Erstatningsopgørelse; ingen af de to consumers må være kilde for den anden.
 */
export const createEmptyStandardLoenRow = <TId extends string>(
  id: TId
): Omit<StandardLoenTableRow, 'id'> & { id: TId } => ({
  id,
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: undefined,
  col1_dag: undefined,
  col2: undefined,
  col3: undefined,
  col4: undefined,
  col5: undefined,
  fpFvShSoBeloeb: undefined,
  pensionBeloeb: undefined,
});

/**
 * Persistence-tomhed for tabelinfrastrukturen. I modsætning til beregningens "effektivt tom" tæller
 * et eksplicit nulbeløb som indhold her: brugeren skal ikke miste en afsluttet, repræsenterbar værdi.
 */
export const isStandardLoenRowPersistenceEmpty = (row: StandardLoenTableRow): boolean =>
  (row.col0_maaned ?? '').trim() === ''
  && (row.col1_maaned ?? '').trim() === ''
  && (row.col0_uge ?? '').trim() === ''
  && (row.col1_uge ?? '').trim() === ''
  && row.col0_dag === undefined
  && row.col1_dag === undefined
  && row.col2 === undefined
  && row.col3 === undefined
  && row.col4 === undefined
  && row.col5 === undefined
  && row.fpFvShSoBeloeb === undefined
  && row.pensionBeloeb === undefined;
