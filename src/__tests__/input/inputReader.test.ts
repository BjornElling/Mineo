import {
  InputCatalog,
  createCollectionBinding,
  createFieldBinding,
} from '../../input/fieldCatalog';
import { serializeFieldAddress } from '../../input/fieldAddress';
import { bindField, defineField } from '../../input/fieldDefinition';
import { createInputReader, createInputRevision } from '../../input/inputReader';
import {
  createEmptyPersistedInputSections,
  createPersistedInputStateSchema,
  type PersistedInputStateCandidate,
} from '../../input/inputState';
import type { RentekravRow } from '../../schemas/formSchemas/sections/renteberegningSchemas';

const textDefinition = defineField<string | undefined>({
  label: 'Skadelidtes navn',
  controlKind: 'text',
  codec: {
    parseForSettle: (raw) => ({ status: 'valid', value: raw || undefined }),
    format: (value) => value ?? '',
    formatForEdit: (value) => value ?? '',
    acceptsInitialKey: (key) => key.length === 1,
  },
});

const nameBinding = createFieldBinding({
  definition: textDefinition,
  template: { section: 'stamdata', path: [], field: 'skadelidte' },
  readCanonical: (sections) => sections.stamdata?.skadelidte,
  writeCanonical: (sections, _address, value) => ({
    ...sections,
    stamdata: { ...(sections.stamdata ?? {}), skadelidte: value },
  }),
});

const objectDefinition = defineField<Readonly<{ value: string }>>({
  label: 'Objektfelt',
  controlKind: 'text',
  codec: {
    parseForSettle: (raw) => ({ status: 'valid', value: { value: raw } }),
    format: (value) => value.value,
    formatForEdit: (value) => value.value,
    acceptsInitialKey: () => true,
  },
});

const objectBinding = createFieldBinding({
  definition: objectDefinition,
  template: { section: 'stamdata', path: [], field: 'objekt' },
  readCanonical: (sections) => ({ value: sections.stamdata?.skadelidte ?? '' }),
  writeCanonical: (sections, _address, value) => ({
    ...sections,
    stamdata: { ...(sections.stamdata ?? {}), skadelidte: value.value },
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

const rowFieldBinding = createFieldBinding({
  definition: textDefinition,
  template: {
    section: 'renteberegning',
    path: [{ kind: 'entity', collection: 'rentekravRows' }],
    field: 'renterFra',
  },
  readCanonical: () => undefined,
  writeCanonical: (sections) => sections,
});

const createSubject = (candidate?: Partial<PersistedInputStateCandidate>) => {
  const catalog = new InputCatalog();
  catalog.registerField(nameBinding);
  catalog.registerField(objectBinding);
  catalog.registerCollection(rowsBinding);
  catalog.registerField(rowFieldBinding);
  catalog.seal();
  const input = createPersistedInputStateSchema(catalog).parse({
    sections: createEmptyPersistedInputSections(),
    rejectedInputs: {},
    ...candidate,
  });
  return {
    catalog,
    input,
    reader: createInputReader({ input, revision: createInputRevision(4), catalog }),
  };
};

describe('inputReader', () => {
  it('maskerer recovery-værdien når feltet har rejected input', () => {
    const catalog = new InputCatalog();
    catalog.registerField(nameBinding);
    catalog.seal();
    const field = nameBinding.createRef();
    const input = createPersistedInputStateSchema(catalog).parse({
      sections: {
        ...createEmptyPersistedInputSections(),
        stamdata: { skadelidte: 'Anna' },
      },
      rejectedInputs: {
        [serializeFieldAddress(field.address)]: { raw: '12..20' },
      },
    });
    const reader = createInputReader({ input, revision: createInputRevision(4), catalog });

    expect(reader.read(field)).toEqual({ status: 'invalid', raw: '12..20' });
    expect(reader.revision).toBe(4);
  });

  it('returnerer canonical tomhed og deep-frosne objektværdier', () => {
    const { reader } = createSubject({
      sections: {
        ...createEmptyPersistedInputSections(),
        stamdata: { skadelidte: 'Anna' },
      },
    });
    const empty = reader.read(nameBinding.createRef());
    const object = reader.read(objectBinding.createRef());

    expect(empty).toEqual({ status: 'valid', value: 'Anna' });
    expect(object).toEqual({ status: 'valid', value: { value: 'Anna' } });
    if (object.status === 'invalid') throw new Error('Testinvariant: objektfeltet skulle være valid');
    expect(Object.isFrozen(object.value)).toBe(true);
    expect(() => {
      (object.value as { value: string }).value = 'muteret';
    }).toThrow(TypeError);
    expect(reader.read(objectBinding.createRef())).toEqual({ status: 'valid', value: { value: 'Anna' } });
  });

  it('afviser ukendt definition og refs til slettede entities før valid/rejected read', () => {
    const sections = {
      ...createEmptyPersistedInputSections(),
      renteberegning: { rentekravRows: [{ id: 'række-1', enhed: 'dage' as const }] },
    };
    const { catalog, input } = createSubject({ sections });
    const forgedDefinition = defineField({ ...textDefinition, label: 'Forkert felt' });
    const forgedField = bindField(forgedDefinition, nameBinding.createRef().address);
    const deletedField = rowFieldBinding.createRef('slettet-række');
    const reader = createInputReader({ input, revision: createInputRevision(1), catalog });

    expect(() => reader.read(forgedField)).toThrow('ukendt, slettet eller forkert bundet feltreference');
    expect(() => reader.read(deletedField)).toThrow('ukendt, slettet eller forkert bundet feltreference');
  });

  it('udstiller kun stabile entity-referencer fra kendte samlinger', () => {
    const { reader } = createSubject({
      sections: {
        ...createEmptyPersistedInputSections(),
        renteberegning: {
          rentekravRows: [
            { id: 'række-1', enhed: 'dage' },
            { id: 'række-2', enhed: 'dage' },
          ],
        },
      },
    });
    const collection = rowsBinding.createRef();
    const entities = reader.listEntities(collection);

    expect(entities).toEqual([
      { collection, entityId: 'række-1' },
      { collection, entityId: 'række-2' },
    ]);
    expect(Object.isFrozen(entities)).toBe(true);
    expect(Object.isFrozen(entities[0])).toBe(true);
  });

  it('kræver forseglet katalog og gyldig revision', () => {
    const sealed = createSubject();
    expect(() => createInputReader({
      input: sealed.input,
      revision: createInputRevision(0),
      catalog: new InputCatalog(),
    })).toThrow('kataloget skal være forseglet');
    expect(() => createInputRevision(-1)).toThrow();
    expect(() => createInputRevision(1.5)).toThrow();
    expect(() => createInputRevision(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});
