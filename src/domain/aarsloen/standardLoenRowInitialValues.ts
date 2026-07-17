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
