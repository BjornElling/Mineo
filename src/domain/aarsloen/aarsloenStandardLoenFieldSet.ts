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
import { createCollectionRef, type CollectionRef } from '../../inputCore/fieldAddress';
import type { StandardLoenTableFieldSet } from '../../components/tables/standardLoenTableFieldSet';
import { createEmptyStandardLoenRow } from './standardLoenRowInitialValues';

// Løntabellens collection-ref bor HER hos feltsættet og ikke i projektionen. Ellers ville projektionen —
// som nu selv aftager feltsættets fælles rekonstruktion (GM-F15) — og feltsættet importere hinanden.

/** Årslønnens løntabel: en TOP-LEVEL collection (ingen ejer-entity i stien). */
export const aarsloenTableDataCollectionRef: CollectionRef = createCollectionRef({
  section: 'aarsloen',
  path: [],
  collection: 'tableData',
});

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
};
