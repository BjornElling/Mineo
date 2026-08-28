import {
  buildCollectionCellSpec,
  collectionLocationPrefix,
  type CollectionRenderRow,
} from '../../../inputCore/react/cellSpecBuilder';
import { collectionOwnerEntityIds } from '../../../inputCore/collectionCellBinding';
import { createCollectionRef, type CollectionRef, type FieldAddress } from '../../../inputCore/fieldAddress';
import type { FieldDescriptor } from '../../../inputCore/fieldDescriptor';
import { aarsloenTableCol0MaanedField } from '../../../inputCore/catalog/aarsloenDescriptors';
import { eoStandardRowFields } from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { eoStandardLoenCollectionRef } from '../../../domain/erstatningsopgoerelse/eoStandardLoenFieldSet';
import { aarsloenTableDataCollectionRef } from '../../../domain/aarsloen/aarsloenStandardLoenFieldSet';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';

// Den fælles cellebindingskontrakt (§3.2, §1.11). Kernekravet: en celles dataidentitet er descriptoren bundet til
// HELE ejerstien – og den er den SAMME for en eksisterende række og for dens placeholder. Kunne de to arter få
// forskellig adressestruktur, ville en nested tabel (EO's løntabel under ét ansættelsesforhold) binde med for få
// entity-led, og adresseariteten i `FieldDescriptor.bind` ville kaste under render.

const emptyRow = (id: string): StandardLoenTableRow => ({
  id,
  col0_maaned: undefined, col1_maaned: undefined, col0_uge: undefined, col1_uge: undefined,
  col0_dag: undefined, col1_dag: undefined,
  col2: undefined, col3: undefined, col4: undefined, col5: undefined,
  fpFvShSoBeloeb: undefined, pensionBeloeb: undefined,
});

const binding = (collection: CollectionRef) => ({
  collection,
  createEmptyRow: emptyRow,
  locationPrefix: collectionLocationPrefix(collection),
  locationNav: { route: '/x', tabKey: null },
});

const existing = (rowId: string): CollectionRenderRow => ({ rowId, kind: 'existing' });
const placeholder = (rowId: string): CollectionRenderRow => ({ rowId, kind: 'placeholder' });

/** Entity-id'erne i en bundet feltadresse, i stiens rækkefølge. */
const entityIdsOf = (path: FieldAddress['path']): readonly string[] =>
  path.flatMap((segment) => segment.kind === 'entity' ? [segment.entityId] : []);

describe('collectionOwnerEntityIds – ejer-id\'erne udledes af collectionens egen sti', () => {
  it('en top-level collection har ingen ejere', () => {
    expect(collectionOwnerEntityIds(aarsloenTableDataCollectionRef)).toEqual([]);
  });

  it('en nested collection giver ejerens entity-id', () => {
    expect(collectionOwnerEntityIds(eoStandardLoenCollectionRef('af-1'))).toEqual(['af-1']);
  });

  it('flere entity-led giver ejerne i stiens rækkefølge', () => {
    const deep = createCollectionRef({
      section: 'erstatningsopgoerelse',
      path: [
        { kind: 'entity', collection: 'loenindkomstAnsaettelsesforhold', entityId: 'af-9' },
        { kind: 'property', name: 'noget' },
      ],
      collection: 'indtaegtsoplysningerTableData',
    });
    expect(collectionOwnerEntityIds(deep)).toEqual(['af-9']);
  });
});

describe('buildCollectionCellSpec – samme adressestruktur for begge cellearter', () => {
  it('top-level: adressen har præcis rækkens entity-id', () => {
    const b = binding(aarsloenTableDataCollectionRef);
    const cell = buildCollectionCellSpec(b, existing('row-1'), aarsloenTableCol0MaanedField, 0);
    expect(entityIdsOf(cell.field.address.path)).toEqual(['row-1']);
  });

  it('NESTED: adressen har BÅDE ansættelsesforholdets og rækkens entity-id', () => {
    // Det konkrete crash: løntabellen under et ansættelsesforhold bandt kun rækkens id, og
    // `FieldDescriptor.bind` afviste den manglende arity under render.
    const b = binding(eoStandardLoenCollectionRef('af-1'));
    const cell = buildCollectionCellSpec(b, existing('row-1'), eoStandardRowFields.col0_maaned, 0);
    expect(entityIdsOf(cell.field.address.path)).toEqual(['af-1', 'row-1']);
  });

  it('NESTED placeholder: samme fulde ejersti som en eksisterende celle – og den kaster ikke', () => {
    const b = binding(eoStandardLoenCollectionRef('af-1'));
    const cell = buildCollectionCellSpec(b, placeholder('row-new'), eoStandardRowFields.col0_maaned, 0);
    expect(cell.kind).toBe('placeholder');
    expect(entityIdsOf(cell.field.address.path)).toEqual(['af-1', 'row-new']);
  });

  it('en placeholder bærer den fuldt formede tom-række-entity med placeholderens id', () => {
    const b = binding(eoStandardLoenCollectionRef('af-1'));
    const cell = buildCollectionCellSpec(b, placeholder('row-new'), eoStandardRowFields.col2, 2);
    if (cell.kind !== 'placeholder') throw new Error('forventede en placeholder-celle');
    expect((cell.entity as StandardLoenTableRow).id).toBe('row-new');
    expect(cell.collection).toEqual(eoStandardLoenCollectionRef('af-1'));
  });

  it('eksisterende og placeholder for SAMME række-id giver identisk feltadresse', () => {
    // Invarianten der gør promotion sikker: placeholderens adresse ER den kommende rækkes adresse.
    const b = binding(eoStandardLoenCollectionRef('af-2'));
    const asPlaceholder = buildCollectionCellSpec(b, placeholder('row-7'), eoStandardRowFields.col3, 3);
    const asExisting = buildCollectionCellSpec(b, existing('row-7'), eoStandardRowFields.col3, 3);
    expect(asPlaceholder.field.address).toEqual(asExisting.field.address);
  });

  it('ALLE løntabellens redigerbare descriptorer kan bindes i den nested collection', () => {
    // Enhver synlig celle kunne være første crashsted, så kontrakten dækker hele kolonnesættet.
    //
    // Kolonnerne har forskellige værdityper, og `FieldDescriptor<T>` er invariant i `T` (T optræder både i
    // read- og write-position). Hver descriptor bindes derfor gennem sin egen typeparameter via `probe`, og
    // listen er EKSPLICIT – så en ny kolonne i feltsættet skal tilføjes her, frem for at et `Object.entries`
    // lydløst udvidede dækningen til noget, typen ikke kunne udtale sig om.
    const b = binding(eoStandardLoenCollectionRef('af-1'));
    const probe = <T,>(name: string, descriptor: FieldDescriptor<T>): void => {
      for (const row of [existing('row-1'), placeholder('row-new')]) {
        expect(() => buildCollectionCellSpec(b, row, descriptor, 0), `${name} / ${row.kind}`).not.toThrow();
      }
    };

    probe('col0_maaned', eoStandardRowFields.col0_maaned);
    probe('col1_maaned', eoStandardRowFields.col1_maaned);
    probe('col0_uge', eoStandardRowFields.col0_uge);
    probe('col1_uge', eoStandardRowFields.col1_uge);
    probe('col0_dag', eoStandardRowFields.col0_dag);
    probe('col1_dag', eoStandardRowFields.col1_dag);
    probe('col2', eoStandardRowFields.col2);
    probe('col3', eoStandardRowFields.col3);
    probe('col4', eoStandardRowFields.col4);
    probe('col5', eoStandardRowFields.col5);
    probe('fpFvShSoBeloeb', eoStandardRowFields.fpFvShSoBeloeb);
    probe('pensionBeloeb', eoStandardRowFields.pensionBeloeb);

    // Hele feltsættet er dækket – ingen kolonne kan glide udenom listen ubemærket.
    expect(Object.keys(eoStandardRowFields)).toHaveLength(12);
  });
});

describe('collectionLocationPrefix – to instanser af samme collection kolliderer ikke', () => {
  it('nested instanser under forskellige ejere får forskellige editorlokationer (§3.7)', () => {
    const a = buildCollectionCellSpec(binding(eoStandardLoenCollectionRef('af-1')), existing('row-1'), eoStandardRowFields.col2, 2);
    const b = buildCollectionCellSpec(binding(eoStandardLoenCollectionRef('af-2')), existing('row-1'), eoStandardRowFields.col2, 2);
    expect(a.location.locationId).not.toBe(b.location.locationId);
  });

  it('en top-level collection har intet ejer-suffiks', () => {
    expect(collectionLocationPrefix(aarsloenTableDataCollectionRef)).toBe('aarsloen.tableData');
  });
});
