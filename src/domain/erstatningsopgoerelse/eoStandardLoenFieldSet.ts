import { createCollectionRef, type CollectionRef } from '../../inputCore/fieldAddress';
import { eoStandardRowFields } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { createEmptyStandardLoenRow } from '../aarsloen/standardLoenRowInitialValues';
import type { StandardLoenTableFieldSet } from '../../components/tables/standardLoenTableFieldSet';

// EO-parametrisering af den delte StandardLoenTable. Løntabellen deles mellem Årsløn (top-level
// `aarsloen.tableData`) og EO's loenindkomst, hvor den ligger NESTED under hver ansættelsesforholds-række
// (`loenindkomstAnsaettelsesforhold[i].indtaegtsoplysningerTableData`).
//
// Modulet leverer KUN den nested `collection` – som selv bærer ansættelsesforholdets entity-id – plus de rå
// celle-descriptorer. Descriptorerne er BEVIDST ubundne: bindingen sker ét sted, i den fælles
// `buildCollectionCellSpec`/`standardLoenTableFieldSet`, som udleder ejer-id'erne af `collection.path` (§3.2).
// Derfor kan et feltsæt ikke glemme ejeren, og en celles adresse er altid `field.bind(employmentId, rowId)`.
//
// Modulet havde tidligere sin EGEN rekonstruktion + cellefejl-indsamling – en næsten ordret kopi af Årsløns,
// hvis eneste forskel var det ekstra ejer-id i `bind`. Begge afledninger er nu generiske over
// feltsættet, så der findes ét sted, hvor en løntabelrække rekonstrueres.

const S = 'erstatningsopgoerelse' as const;
const EMPLOYMENTS = 'loenindkomstAnsaettelsesforhold';
const STANDARD_ROWS = 'indtaegtsoplysningerTableData';

/** Den nested collection-ref for løntabellen under ét konkret ansættelsesforhold. */
export const eoStandardLoenCollectionRef = (employmentId: string): CollectionRef =>
  createCollectionRef({
    section: S,
    path: [{ kind: 'entity', collection: EMPLOYMENTS, entityId: employmentId }],
    collection: STANDARD_ROWS,
  });


/**
 * Bygger StandardLoenTable-feltsættet for ét konkret ansættelsesforhold. Bruges af `AnsaettelsesforholdCard`;
 * strukturelt identisk med `aarsloenStandardLoenFieldSet` bortset fra ÉN ting: `collection` er den nested ref med
 * ansættelsesforholdets entity-id. Cellernes ejer-id'er kommer derfra – ikke fra en separat parameter.
 */
export const createEoStandardLoenFieldSet = (employmentId: string): StandardLoenTableFieldSet => ({
  collection: eoStandardLoenCollectionRef(employmentId),
  col0_maaned: eoStandardRowFields.col0_maaned,
  col1_maaned: eoStandardRowFields.col1_maaned,
  col0_uge: eoStandardRowFields.col0_uge,
  col1_uge: eoStandardRowFields.col1_uge,
  col0_dag: eoStandardRowFields.col0_dag,
  col1_dag: eoStandardRowFields.col1_dag,
  col2: eoStandardRowFields.col2,
  col3: eoStandardRowFields.col3,
  col4: eoStandardRowFields.col4,
  col5: eoStandardRowFields.col5,
  fpFvShSoBeloeb: eoStandardRowFields.fpFvShSoBeloeb,
  pensionBeloeb: eoStandardRowFields.pensionBeloeb,
  createRow: createEmptyStandardLoenRow,
});
