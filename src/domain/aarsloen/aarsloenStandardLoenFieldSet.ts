import {
  aarsloenTableCol0DagField,
  aarsloenTableCol0MaanedField,
  aarsloenTableCol0UgeField,
  aarsloenTableCol1DagField,
  aarsloenTableCol1MaanedField,
  aarsloenTableCol1UgeField,
  aarsloenTableCol2Field,
  aarsloenTableCol3Field,
  aarsloenTableCol4Field,
  aarsloenTableCol5Field,
  aarsloenTableFpFvShSoBeloebField,
  aarsloenTablePensionBeloebField,
} from '../../inputCore/catalog/aarsloenDescriptors';
import type { StandardLoenTableFieldSet } from '../../components/tables/standardLoenTableFieldSet';
import {
  aarsloenTableDataCollectionRef,
  readAarsloenTableRows,
  resolveStandardLoenTableValidation,
} from './aarsloenProjection';
import { createEmptyStandardLoenRow } from './standardLoenRowInitialValues';

export const aarsloenStandardLoenFieldSet: StandardLoenTableFieldSet = {
  collection: aarsloenTableDataCollectionRef,
  col0_maaned: aarsloenTableCol0MaanedField,
  col1_maaned: aarsloenTableCol1MaanedField,
  col0_uge: aarsloenTableCol0UgeField,
  col1_uge: aarsloenTableCol1UgeField,
  col0_dag: aarsloenTableCol0DagField,
  col1_dag: aarsloenTableCol1DagField,
  col2: aarsloenTableCol2Field,
  col3: aarsloenTableCol3Field,
  col4: aarsloenTableCol4Field,
  col5: aarsloenTableCol5Field,
  fpFvShSoBeloeb: aarsloenTableFpFvShSoBeloebField,
  pensionBeloeb: aarsloenTablePensionBeloebField,
  createRow: createEmptyStandardLoenRow,
  readRows: readAarsloenTableRows,
  resolveValidation: resolveStandardLoenTableValidation,
};
