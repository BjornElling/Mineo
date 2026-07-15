import { createCollectionRef } from '../../input/fieldAddress';
import {
  readCanonicalAtAddress,
  readEntitiesAtCollection,
  writeCanonicalAtAddress,
  writeEntitiesAtCollection,
} from '../../input/structuralCanonicalAccessors';
import { createInputReader, createInputRevision } from '../../input/inputReader';
import { getProductionInputCatalog } from '../../input/catalog/productionInputCatalog';
import {
  renteberegningBeregningsdatoBinding,
  rentekravRenterFraBinding,
  rentekravRowsBinding,
} from '../../input/catalog/renteberegningInputBindings';
import { satserAargangBinding } from '../../input/catalog/satserInputBindings';
import { createEmptyPersistedInputSections, type PersistedInputSections } from '../../input/inputState';
import { createEmptyRentekravCommittedRow } from '../../domain/renteberegning/rentekravTableModel';
import { toISODateString } from '../../types/branded';

const withRenteRows = (): PersistedInputSections => {
  const sections = createEmptyPersistedInputSections();
  return {
    ...sections,
    renteberegning: {
      rentekravRows: [
        { ...createEmptyRentekravCommittedRow('row-1'), renterFra: toISODateString('2024-01-01') },
        { ...createEmptyRentekravCommittedRow('row-2') },
      ],
    },
  } as PersistedInputSections;
};

describe('structuralCanonicalAccessors', () => {
  it('læser og skriver top-level felter og opretter en tom sektion ved behov', () => {
    const empty = createEmptyPersistedInputSections();
    expect(readCanonicalAtAddress(empty, satserAargangBinding.createRef().address)).toBeUndefined();

    const written = writeCanonicalAtAddress(
      structuredClone(empty),
      satserAargangBinding.createRef().address,
      2025,
      () => ({})
    );
    expect(written.satser).toEqual({ aargang: 2025 });
    expect(readCanonicalAtAddress(written, satserAargangBinding.createRef().address)).toBe(2025);
  });

  it('læser og skriver felter under en entity via id-opslag uden at røre andre rækker', () => {
    const sections = withRenteRows();
    const ref = rentekravRenterFraBinding.createRef('row-2');
    expect(readCanonicalAtAddress(sections, ref.address)).toBeUndefined();

    const written = writeCanonicalAtAddress(
      structuredClone(sections),
      ref.address,
      toISODateString('2025-06-01'),
      () => ({ rentekravRows: [] })
    );
    expect(written.renteberegning?.rentekravRows[1]?.renterFra).toBe('2025-06-01');
    // Nabo-rækken er uændret.
    expect(written.renteberegning?.rentekravRows[0]?.renterFra).toBe('2024-01-01');
  });

  it('læser og skriver hele collections', () => {
    const collection = createCollectionRef({ section: 'renteberegning', path: [], collection: 'rentekravRows' });
    const sections = withRenteRows();
    expect(readEntitiesAtCollection(sections, collection)).toHaveLength(2);

    const next = writeEntitiesAtCollection(
      structuredClone(sections),
      collection,
      [createEmptyRentekravCommittedRow('row-3')],
      () => ({ rentekravRows: [] })
    );
    expect(next.renteberegning?.rentekravRows.map((row) => row.id)).toEqual(['row-3']);
  });

  it('resolver et rækkefelts entity-led på en custom id-egenskab', () => {
    // En samling der identificeres på et andet felt end `id` (fx sfggAnsaettelsesforhold →
    // `ansaettelsesforholdId`): resolveren SKAL bruge den rigtige egenskab, ellers finder
    // read/write ingen række, og default-`id`-opslaget ville altid ramme undefined.
    const resolver = (collection: string) => (collection === 'rows' ? 'customId' : 'id');
    const address = {
      section: 'erstatningsopgoerelse' as const,
      path: [{ kind: 'entity' as const, collection: 'rows', entityId: 'b' }],
      field: 'note',
    };
    const sections = {
      ...createEmptyPersistedInputSections(),
      erstatningsopgoerelse: { rows: [{ customId: 'a', note: 'A' }, { customId: 'b', note: 'B' }] },
    } as unknown as PersistedInputSections;

    // Uden resolveren (default `id`) findes rækken ikke; med resolveren rammer vi 'b'.
    expect(readCanonicalAtAddress(sections, address)).toBeUndefined();
    expect(readCanonicalAtAddress(sections, address, resolver)).toBe('B');

    const written = writeCanonicalAtAddress(
      structuredClone(sections),
      address,
      'B2',
      () => ({ rows: [] }),
      resolver
    );
    const rows = (written.erstatningsopgoerelse as unknown as { rows: { customId: string; note: string }[] }).rows;
    expect(rows.find((row) => row.customId === 'b')?.note).toBe('B2');
    // Nabo-rækken er uændret.
    expect(rows.find((row) => row.customId === 'a')?.note).toBe('A');
  });
});

describe('produktionskatalog', () => {
  it('læser migrerede referencefelter gennem InputReader', () => {
    const catalog = getProductionInputCatalog();
    const sections: PersistedInputSections = {
      ...withRenteRows(),
      satser: { aargang: 2024 },
    } as PersistedInputSections;
    const reader = createInputReader({
      input: { sections, rejectedInputs: {} } as never,
      revision: createInputRevision(1),
      catalog,
    });

    expect(reader.read(satserAargangBinding.createRef())).toEqual({ status: 'valid', value: 2024 });
    expect(reader.read(renteberegningBeregningsdatoBinding.createRef()))
      .toEqual({ status: 'valid', value: undefined });
    expect(reader.read(rentekravRenterFraBinding.createRef('row-1')))
      .toEqual({ status: 'valid', value: '2024-01-01' });
    expect(reader.listEntities(rentekravRowsBinding.createRef()).map((entity) => entity.entityId))
      .toEqual(['row-1', 'row-2']);
  });

  it('maskerer canonical værdi med rejected input', () => {
    const catalog = getProductionInputCatalog();
    const ref = satserAargangBinding.createRef();
    const reader = createInputReader({
      input: {
        sections: { ...createEmptyPersistedInputSections(), satser: { aargang: 2024 } },
        rejectedInputs: { [JSON.stringify({ version: '1', address: ref.address })]: { raw: '20x4' } },
      } as never,
      revision: createInputRevision(2),
      catalog,
    });
    expect(reader.read(ref)).toEqual({ status: 'invalid', raw: '20x4' });
  });
});
