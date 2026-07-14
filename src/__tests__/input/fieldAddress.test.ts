import {
  createFieldAddress,
  deserializeFieldAddress,
  fieldAddressesEqual,
  isFieldAddressBelowEntity,
  serializeFieldAddress,
} from '../../input/fieldAddress';

describe('fieldAddress', () => {
  it('round-tripper nested entity-adresser uden delimiterkollisioner', () => {
    const address = createFieldAddress({
      section: 'erstatningsopgoerelse',
      path: [
        { kind: 'entity', collection: 'loenindkomstAnsaettelsesforhold', entityId: 'arbejde:1' },
        { kind: 'entity', collection: 'indtaegtsoplysningerTableData', entityId: 'række:2' },
      ],
      field: 'col2',
    });

    const serialized = serializeFieldAddress(address);

    expect(deserializeFieldAddress(serialized)).toEqual(address);
    expect(fieldAddressesEqual(deserializeFieldAddress(serialized)!, address)).toBe(true);
  });

  it('afviser ukendt version, ekstra data og tomme adresseled', () => {
    expect(deserializeFieldAddress(JSON.stringify({
      version: '2',
      address: { section: 'stamdata', path: [], field: 'navn' },
    }))).toBeNull();
    expect(deserializeFieldAddress(JSON.stringify({
      version: '1',
      address: { section: 'stamdata', path: [], field: 'navn', columnIndex: 2 },
    }))).toBeNull();
    expect(() => createFieldAddress({ section: 'stamdata', path: [], field: '' })).toThrow();
  });

  it('finder kun felter under den konkrete entity-sti', () => {
    const field = createFieldAddress({
      section: 'erstatningsopgoerelse',
      path: [
        { kind: 'property', name: 'loenindkomst' },
        { kind: 'entity', collection: 'ansaettelsesforhold', entityId: 'af-1' },
        { kind: 'entity', collection: 'loenrækker', entityId: 'række-1' },
      ],
      field: 'beloeb',
    });
    const parentPath = field.path.slice(0, 2);

    expect(isFieldAddressBelowEntity(field, 'erstatningsopgoerelse', parentPath)).toBe(true);
    expect(isFieldAddressBelowEntity(field, 'erstatningsopgoerelse', [
      { kind: 'property', name: 'loenindkomst' },
      { kind: 'entity', collection: 'ansaettelsesforhold', entityId: 'af-2' },
    ])).toBe(false);
    expect(isFieldAddressBelowEntity(field, 'renteberegning', parentPath)).toBe(false);
  });
});
