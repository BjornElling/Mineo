import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import type { FieldErrorsForSection } from '../../types/fieldErrors';
import { buildEODebugModel } from './eoDebugModel';
import {
  buildEODebugSammentaellingModel,
  buildSammentaellingDisplayTables,
  buildSammentaellingDisplayRows,
  buildSvieSmerteContext,
  buildTaftContext,
  getSammentaellingControlStatus,
  type SammentaellingDisplayRow,
  type SammentaellingDisplayTables,
  type SammentaellingModel,
} from './eoDebugSammentaelling';
import type { EODebugModel } from './eoDebugModel';

/**
 * EODebugSnapshot is a consistency-critical, entry-bound snapshot.
 *
 * Invariants:
 * - built only on tab entry
 * - revision is monotonic and must change on EO input/error mutation
 * - hasControlErrors === sammentaellingRows.some(status === 'error')
 */
export type EODebugSnapshot = Readonly<{
  revision: string;
  createdAt: string;
  model: EODebugModel;
  sammentaelling: SammentaellingModel;
  sammentaellingTables: SammentaellingDisplayTables;
  sammentaellingRows: readonly SammentaellingDisplayRow[];
  // Must remain equivalent to sammentaellingRows.some(status === 'error').
  hasControlErrors: boolean;
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  fieldErrors: Readonly<{
    stamdata: FieldErrorsForSection<'stamdata'>;
    erstatningsopgoerelse: FieldErrorsForSection<'erstatningsopgoerelse'>;
  }>;
}>;

export const buildEODebugSnapshot = (args: {
  revision: string;
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  stamdataErrors: FieldErrorsForSection<'stamdata'>;
  eoErrors: FieldErrorsForSection<'erstatningsopgoerelse'>;
}): EODebugSnapshot => {
  const { revision, stamdataValues, eoValues, stamdataErrors, eoErrors } = args;
  const svieSmerteContext = buildSvieSmerteContext(stamdataValues, eoValues);
  const taftContext = buildTaftContext(stamdataValues, eoValues);
  const model = buildEODebugModel(eoValues);
  const sammentaelling = buildEODebugSammentaellingModel({
    values: eoValues,
    errors: eoErrors,
    model,
    svieSmerteContext,
    taftContext,
  });
  const sammentaellingTables = buildSammentaellingDisplayTables(sammentaelling);
  const sammentaellingRows = buildSammentaellingDisplayRows(sammentaelling);
  const hasControlErrors = sammentaellingRows.some(
    (row) => getSammentaellingControlStatus(row.control) === 'error'
  );

  return {
    revision,
    createdAt: new Date().toISOString(),
    model,
    sammentaelling,
    sammentaellingTables,
    sammentaellingRows,
    hasControlErrors,
    stamdataValues,
    eoValues,
    fieldErrors: {
      stamdata: stamdataErrors,
      erstatningsopgoerelse: eoErrors,
    },
  };
};
