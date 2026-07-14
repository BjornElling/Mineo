import { createFieldAddress, fieldAddressesEqual, serializeFieldAddress } from '../../input/fieldAddress';
import {
  createEmptyPersistedInputSections,
  createPersistedInputStateSchema,
} from '../../input/inputState';

describe('inputState', () => {
  const knownAddress = createFieldAddress({
    section: 'stamdata',
    path: [],
    field: 'skadelidteNavn',
  });
  const schema = createPersistedInputStateSchema((address) => fieldAddressesEqual(address, knownAddress));

  it('validerer canonical sektioner og et kendt ikke-tomt rejected input samlet', () => {
    const input = {
      sections: createEmptyPersistedInputSections(),
      rejectedInputs: {
        [serializeFieldAddress(knownAddress)]: { raw: '12..20' },
      },
    };

    const parsed = schema.parse(input);

    expect(parsed).toEqual(input);
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it('afviser tom råtekst med en præcis rejected-input-sti', () => {
    const serialized = serializeFieldAddress(knownAddress);
    const result = schema.safeParse({
      sections: createEmptyPersistedInputSections(),
      rejectedInputs: { [serialized]: { raw: '' } },
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Testinvariant: schemaet skulle afvise tom råtekst');
    expect(result.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ['rejectedInputs', serialized, 'raw'] }),
    ]));
  });

  it('afviser en strukturelt gyldig adresse, som ikke findes i feltkataloget', () => {
    const unknownAddress = createFieldAddress({
      section: 'stamdata',
      path: [],
      field: 'ukendtFelt',
    });
    const serialized = serializeFieldAddress(unknownAddress);
    const result = schema.safeParse({
      sections: createEmptyPersistedInputSections(),
      rejectedInputs: { [serialized]: { raw: 'x' } },
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Testinvariant: schemaet skulle afvise en ukendt adresse');
    expect(result.error.issues).toEqual([
      expect.objectContaining({
        path: ['rejectedInputs', serialized],
        message: 'Feltadressen findes ikke i feltkataloget',
      }),
    ]);
  });

  it('afviser manglende sektioner og ekstra aggregate-data', () => {
    const { stamdata: _omittedStamdata, ...sections } = createEmptyPersistedInputSections();

    expect(schema.safeParse({ sections, rejectedInputs: {} }).success).toBe(false);
    expect(schema.safeParse({
      sections: createEmptyPersistedInputSections(),
      rejectedInputs: {},
      revision: 1,
    }).success).toBe(false);
  });
});
