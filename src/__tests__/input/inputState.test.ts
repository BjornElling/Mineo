import { serializeFieldAddress } from '../../input/fieldAddress';
import {
  InputCatalog,
  createCollectionBinding,
  createFieldBinding,
} from '../../input/fieldCatalog';
import { defineField } from '../../input/fieldDefinition';
import {
  createEmptyPersistedInputSections,
  createPersistedInputStateSchema,
} from '../../input/inputState';
import type { RentekravRow } from '../../schemas/formSchemas/sections/renteberegningSchemas';

const definition = defineField<string | undefined>({
  label: 'Hovedstol',
  controlKind: 'text',
  codec: {
    parseForSettle: (raw) => ({ status: 'valid', value: raw || undefined }),
    format: (value) => value ?? '',
    formatForEdit: (value) => value ?? '',
    acceptsInitialKey: (key) => key.length === 1,
  },
});

const staticBinding = createFieldBinding({
  definition,
  template: { section: 'stamdata', path: [], field: 'skadelidte' },
  readCanonical: (sections) => sections.stamdata?.skadelidte,
  writeCanonical: (sections, _address, value) => ({
    ...sections,
    stamdata: { ...(sections.stamdata ?? {}), skadelidte: value },
  }),
});

const rowsBinding = createCollectionBinding<RentekravRow>({
  template: { section: 'renteberegning', path: [], collection: 'rentekravRows' },
  getEntityId: (row) => row.id,
  readEntities: (sections) => sections.renteberegning?.rentekravRows ?? [],
  writeEntities: (sections, _collection, rows) => ({
    ...sections,
    renteberegning: { ...(sections.renteberegning ?? {}), rentekravRows: [...rows] },
  }),
});

const dynamicBinding = createFieldBinding({
  definition,
  template: {
    section: 'renteberegning',
    path: [{ kind: 'entity', collection: 'rentekravRows' }],
    field: 'renterFra',
  },
  readCanonical: () => undefined,
  writeCanonical: (sections) => sections,
});

const createCatalog = (): InputCatalog => {
  const catalog = new InputCatalog();
  catalog.registerField(staticBinding);
  catalog.registerCollection(rowsBinding);
  catalog.registerField(dynamicBinding);
  return catalog.seal();
};

describe('inputState', () => {
  it('kræver et forseglet katalog', () => {
    expect(() => createPersistedInputStateSchema(new InputCatalog()))
      .toThrow('kataloget skal være forseglet');
  });

  it('validerer og deep-freezer canonical sektioner og kendt rejected input samlet', () => {
    const schema = createPersistedInputStateSchema(createCatalog());
    const address = staticBinding.createRef().address;
    const input = {
      sections: {
        ...createEmptyPersistedInputSections(),
        stamdata: { skadelidte: 'Anna' },
      },
      rejectedInputs: {
        [serializeFieldAddress(address)]: { raw: '12..20' },
      },
    };
    const parsed = schema.parse(input);

    expect(parsed).toEqual(input);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.sections)).toBe(true);
    expect(Object.isFrozen(parsed.sections.stamdata)).toBe(true);
    expect(Object.isFrozen(parsed.rejectedInputs)).toBe(true);
  });

  it('afviser tom råtekst og ukendte feltadresser med præcise stier', () => {
    const schema = createPersistedInputStateSchema(createCatalog());
    const known = serializeFieldAddress(staticBinding.createRef().address);
    const unknown = serializeFieldAddress({ section: 'stamdata', path: [], field: 'ukendtFelt' });
    const sections = createEmptyPersistedInputSections();

    const emptyResult = schema.safeParse({ sections, rejectedInputs: { [known]: { raw: '' } } });
    expect(emptyResult.success).toBe(false);
    if (emptyResult.success) throw new Error('Testinvariant: tom råtekst skulle afvises');
    expect(emptyResult.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ['rejectedInputs', known, 'raw'] }),
    ]));

    const unknownResult = schema.safeParse({ sections, rejectedInputs: { [unknown]: { raw: 'x' } } });
    expect(unknownResult.success).toBe(false);
    if (unknownResult.success) throw new Error('Testinvariant: ukendt feltadresse skulle afvises');
    expect(unknownResult.error.issues).toEqual([
      expect.objectContaining({
        path: ['rejectedInputs', unknown],
        message: 'Feltadressen findes ikke i det aktuelle inputkatalog',
      }),
    ]);
  });

  it('afviser rejected input til en slettet entity', () => {
    const schema = createPersistedInputStateSchema(createCatalog());
    const sections = {
      ...createEmptyPersistedInputSections(),
      renteberegning: { rentekravRows: [{ id: 'række-1', enhed: 'dage' as const }] },
    };
    const orphan = serializeFieldAddress(dynamicBinding.createRef('slettet-række').address);
    const existing = serializeFieldAddress(dynamicBinding.createRef('række-1').address);

    expect(schema.safeParse({ sections, rejectedInputs: { [orphan]: { raw: 'x' } } }).success).toBe(false);
    expect(schema.safeParse({ sections, rejectedInputs: { [existing]: { raw: 'x' } } }).success).toBe(true);
  });

  it('afviser whitespace og duplicate entity-id’er uden rejected inputs', () => {
    const schema = createPersistedInputStateSchema(createCatalog());
    const withRows = (rows: readonly RentekravRow[]) => ({
      ...createEmptyPersistedInputSections(),
      renteberegning: { rentekravRows: rows },
    });

    const whitespace = schema.safeParse({
      sections: withRows([{ id: ' ', enhed: 'dage' }]),
      rejectedInputs: {},
    });
    expect(whitespace.success).toBe(false);
    if (whitespace.success) throw new Error('Testinvariant: whitespace-id skulle afvises');
    expect(whitespace.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ['sections'], message: expect.stringContaining('trimmede') }),
    ]));

    const duplicate = schema.safeParse({
      sections: withRows([
        { id: 'række-1', enhed: 'dage' },
        { id: 'række-1', enhed: 'dage' },
      ]),
      rejectedInputs: {},
    });
    expect(duplicate.success).toBe(false);
  });

  it('afviser manglende sektioner og ekstra aggregate-data', () => {
    const schema = createPersistedInputStateSchema(createCatalog());
    const { stamdata: _omittedStamdata, ...sections } = createEmptyPersistedInputSections();

    expect(schema.safeParse({ sections, rejectedInputs: {} }).success).toBe(false);
    expect(schema.safeParse({
      sections: createEmptyPersistedInputSections(),
      rejectedInputs: {},
      revision: 1,
    }).success).toBe(false);
  });
});
