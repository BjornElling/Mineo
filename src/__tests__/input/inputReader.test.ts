import { createCollectionRef, createFieldAddress, fieldAddressesEqual, serializeFieldAddress } from '../../input/fieldAddress';
import { bindField, defineField, type FieldRef } from '../../input/fieldDefinition';
import { createInputReader, createInputRevision, type InputFieldCatalog } from '../../input/inputReader';
import { createEmptyPersistedInputSections, type PersistedInputState } from '../../input/inputState';

const textDefinition = defineField<string | undefined>({
  label: 'Skadelidtes navn',
  controlKind: 'text',
  focusTarget: { route: '/stamdata', tab: null },
  codec: {
    parseForSettle: (raw) => ({ status: 'valid', value: raw || undefined }),
    format: (value) => value ?? '',
    acceptsInitialKey: (key) => key.length === 1,
  },
});

const nameField = bindField(textDefinition, createFieldAddress({
  section: 'stamdata',
  path: [],
  field: 'skadelidteNavn',
}));

const createResolver = (expectedField: FieldRef<string | undefined>, value: string | undefined): InputFieldCatalog['readCanonical'] =>
  <T>(_sections: PersistedInputState['sections'], field: FieldRef<T>): T => {
    if (!fieldAddressesEqual(field.address, expectedField.address)) {
      throw new Error('Testresolver: ukendt felt');
    }
    // Adresseligheden binder opslaget til samme typed feltregistrering.
    return value as T;
  };

describe('inputReader', () => {
  it('maskerer recovery-værdien når feltet har rejected input', () => {
    const input: PersistedInputState = {
      sections: createEmptyPersistedInputSections(),
      rejectedInputs: {
        [serializeFieldAddress(nameField.address)]: { raw: '12..20' },
      },
    };
    const reader = createInputReader({
      input,
      revision: createInputRevision(4),
      fieldCatalog: {
        isKnownAddress: (address) => fieldAddressesEqual(address, nameField.address),
        readCanonical: () => {
          throw new Error('Recovery-værdien må ikke læses');
        },
      },
      collectionCatalog: { listEntityIds: () => [] },
    });

    expect(reader.read(nameField)).toEqual({ status: 'invalid', raw: '12..20' });
    expect(reader.revision).toBe(4);
  });

  it('returnerer canonical værdi, herunder canonical tomhed, når feltet ikke er rejected', () => {
    const input: PersistedInputState = {
      sections: createEmptyPersistedInputSections(),
      rejectedInputs: {},
    };
    const reader = createInputReader({
      input,
      revision: createInputRevision(0),
      fieldCatalog: {
        isKnownAddress: (address) => fieldAddressesEqual(address, nameField.address),
        readCanonical: createResolver(nameField, undefined),
      },
      collectionCatalog: { listEntityIds: () => [] },
    });

    expect(reader.read(nameField)).toEqual({ status: 'valid', value: undefined });
  });

  it('afviser ukendte feltreferencer fail-closed', () => {
    const unknownField = bindField(textDefinition, createFieldAddress({
      section: 'stamdata',
      path: [],
      field: 'ukendtFelt',
    }));
    const reader = createInputReader({
      input: { sections: createEmptyPersistedInputSections(), rejectedInputs: {} },
      revision: createInputRevision(1),
      fieldCatalog: {
        isKnownAddress: (address) => fieldAddressesEqual(address, nameField.address),
        readCanonical: createResolver(nameField, 'Anne'),
      },
      collectionCatalog: { listEntityIds: () => [] },
    });

    expect(() => reader.read(unknownField)).toThrow('InputReader: ukendt feltadresse');
  });

  it('udstiller kun stabile entity-referencer fra samlinger', () => {
    const collection = createCollectionRef({
      section: 'renteberegning',
      path: [],
      collection: 'rentekrav',
    });
    const reader = createInputReader({
      input: { sections: createEmptyPersistedInputSections(), rejectedInputs: {} },
      revision: createInputRevision(2),
      fieldCatalog: {
        isKnownAddress: (address) => fieldAddressesEqual(address, nameField.address),
        readCanonical: createResolver(nameField, 'Anne'),
      },
      collectionCatalog: {
        listEntityIds: (_sections, requestedCollection) =>
          requestedCollection === collection ? ['række-1', 'række-2'] : [],
      },
    });

    expect(reader.listEntities(collection)).toEqual([
      { collection, entityId: 'række-1' },
      { collection, entityId: 'række-2' },
    ]);
    expect(Object.isFrozen(reader.listEntities(collection))).toBe(true);
  });

  it('afviser negative og ikke-heltallige revisioner', () => {
    expect(() => createInputRevision(-1)).toThrow();
    expect(() => createInputRevision(1.5)).toThrow();
  });
});
