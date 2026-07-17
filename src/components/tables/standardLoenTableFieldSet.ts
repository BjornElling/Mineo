import type { StandardLoenTableRow, Loenperiode, TillaegAngivesSom } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import type { InputReader } from '../../inputCore/inputReader';
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
import {
  aarsloenTableDataCollectionRef,
  readAarsloenTableRows,
  resolveStandardLoenTableValidation,
} from '../../domain/aarsloen/aarsloenProjection';
import type { StandardLoenTableValidationResult } from '../../domain/aarsloen/standardLoenTableValidation';

// Greenfield-parametrisering af den delte StandardLoenTable (§2.5): tabellen deles mellem Årsløn (top-level
// `aarsloen.tableData`) og senere EO's loenindkomst (nested `ansaettelsesforhold[i].indtaegtsoplysningerTableData`).
// Et `StandardLoenTableFieldSet` beskriver hvilken collection + hvilke celle-descriptors en konkret brug binder,
// så komponenten selv forbliver sideagnostisk. Kun Årsløn-feltsættet findes i denne tranche; EO's nested feltsæt
// bygges, når EO-slicen migreres (§2.4 trin 8) — indtil da er EO's loenindkomst en bevidst brudt mellemtilstand.

/** Descriptorerne for løntabellens redigerbare celler i en konkret collection-kontekst. */
export type StandardLoenTableFieldSet = Readonly<{
  collection: CollectionRef;
  col0_maaned: FieldDescriptor<string | undefined>;
  col1_maaned: FieldDescriptor<string | undefined>;
  col0_uge: FieldDescriptor<string | undefined>;
  col1_uge: FieldDescriptor<string | undefined>;
  col0_dag: FieldDescriptor<ISODateString | undefined>;
  col1_dag: FieldDescriptor<ISODateString | undefined>;
  col2: FieldDescriptor<AmountValue | undefined>;
  col3: FieldDescriptor<AmountValue | undefined>;
  col4: FieldDescriptor<AmountValue | undefined>;
  col5: FieldDescriptor<AmountValue | undefined>;
  fpFvShSoBeloeb: FieldDescriptor<AmountValue | undefined>;
  pensionBeloeb: FieldDescriptor<AmountValue | undefined>;
  /** Rekonstruér de committede rækker (read-only) for feltsættets collection. */
  readRows: (reader: InputReader) => StandardLoenTableRow[];
  /** Reader-afledt valideringssummary + errors for feltsættets collection. */
  resolveValidation: (reader: InputReader, loenperiode: Loenperiode, tillaegAngivesSom: TillaegAngivesSom) => StandardLoenTableValidationResult;
}>;

/** Årsløns top-level løntabel-feltsæt (`aarsloen.tableData`). */
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
  readRows: readAarsloenTableRows,
  resolveValidation: resolveStandardLoenTableValidation,
};

/** Rekonstruér de committede rækker for et feltsæt. */
export const readStandardLoenTableRows = (fieldSet: StandardLoenTableFieldSet, reader: InputReader): StandardLoenTableRow[] =>
  fieldSet.readRows(reader);

/** Reader-afledt validering for et feltsæt. */
export const resolveStandardLoenTableValidationFromReader = (
  fieldSet: StandardLoenTableFieldSet,
  reader: InputReader,
  loenperiode: Loenperiode,
  tillaegAngivesSom: TillaegAngivesSom
): StandardLoenTableValidationResult => fieldSet.resolveValidation(reader, loenperiode, tillaegAngivesSom);
