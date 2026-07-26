import type { StandardLoenTableRow, Loenperiode, TillaegAngivesSom } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import type { InputReader } from '../../inputCore/inputReader';
import type { StandardLoenTableValidationResult } from '../../domain/aarsloen/standardLoenTableValidation';

// Parametrisering af den delte StandardLoenTable: hvert domæne ejer sit konkrete feltsæt, mens denne
// sideagnostiske kontrakt kun beskriver den fælles tabeloverflade.

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
  /** Opret en fuldt schemaformet tom række for collectionen. */
  createRow: (id: string) => StandardLoenTableRow;
  /** Rekonstruér de committede rækker (read-only) for feltsættets collection. */
  readRows: (reader: InputReader) => StandardLoenTableRow[];
  /** Reader-afledt valideringssummary + errors for feltsættets collection. */
  resolveValidation: (reader: InputReader, loenperiode: Loenperiode, tillaegAngivesSom: TillaegAngivesSom) => StandardLoenTableValidationResult;
}>;

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
