import { createCollectionRef } from '../../input/fieldAddress';
import {
  InputCatalog,
  createCollectionBinding,
  createFieldBinding,
} from '../../input/fieldCatalog';
import { defineField } from '../../input/fieldDefinition';
import { createEmptyPersistedInputSections, type PersistedInputSections } from '../../input/inputState';
import type { RentekravRow } from '../../schemas/formSchemas/sections/renteberegningSchemas';

const textDefinition = defineField<string | undefined>({
  label: 'Felt',
  controlKind: 'text',
  focusTarget: { route: '/renteberegning', tab: null },
  codec: {
    parseForSettle: (raw) => ({ status: 'valid', value: raw || undefined }),
    format: (value) => value ?? '',
    formatForEdit: (value) => value ?? '',
    acceptsInitialKey: (key) => key.length === 1,
  },
});

const dateDefinition = defineField<RentekravRow['renterFra']>({
  label: 'Renter fra',
  controlKind: 'text',
  focusTarget: { route: '/renteberegning', tab: null },
  codec: {
    parseForSettle: () => ({ status: 'invalid' }),
    format: (value) => value ?? '',
    formatForEdit: (value) => value ?? '',
    acceptsInitialKey: (key) => /^\d$/.test(key),
  },
});

const rentekravRowsBinding = createCollectionBinding<RentekravRow>({
  template: { section: 'renteberegning', path: [], collection: 'rentekravRows' },
  getEntityId: (row) => row.id,
  readEntities: (sections) => sections.renteberegning?.rentekravRows ?? [],
  writeEntities: (sections, _collection, rows) => ({
    ...sections,
    renteberegning: {
      ...(sections.renteberegning ?? {}),
      rentekravRows: [...rows],
    },
  }),
});

const renterFraBinding = createFieldBinding({
  definition: dateDefinition,
  template: {
    section: 'renteberegning',
    path: [{ kind: 'entity', collection: 'rentekravRows' }],
    field: 'renterFra',
  },
  readCanonical: (sections, address) => {
    const rowId = address.path[0]?.kind === 'entity' ? address.path[0].entityId : '';
    return sections.renteberegning?.rentekravRows.find((row) => row.id === rowId)?.renterFra;
  },
  writeCanonical: (sections, address, value) => {
    const rowId = address.path[0]?.kind === 'entity' ? address.path[0].entityId : '';
    if (sections.renteberegning === null) return sections;
    return {
      ...sections,
      renteberegning: {
        ...sections.renteberegning,
        rentekravRows: sections.renteberegning.rentekravRows.map((row) =>
          row.id === rowId ? { ...row, renterFra: value } : row),
      },
    };
  },
});

const withRows = (rows: readonly RentekravRow[]): PersistedInputSections => ({
  ...createEmptyPersistedInputSections(),
  renteberegning: { rentekravRows: [...rows] },
});

describe('InputCatalog', () => {
  it('forsegler kataloget før brug og afviser efterfølgende registrering', () => {
    const catalog = new InputCatalog();
    catalog.registerCollection(rentekravRowsBinding);
    catalog.registerField(renterFraBinding);

    expect(() => catalog.isKnownAddress(renterFraBinding.createRef('række-1').address))
      .toThrow('kataloget skal forsegles før brug');
    expect(catalog.seal()).toBe(catalog);
    expect(catalog.isSealed).toBe(true);
    expect(() => catalog.registerField(renterFraBinding)).toThrow('et forseglet katalog kan ikke ændres');
    expect(catalog.seal()).toBe(catalog);
  });

  it('afviser dobbeltregistrering og manglende parent-samling', () => {
    const duplicateCatalog = new InputCatalog();
    duplicateCatalog.registerCollection(rentekravRowsBinding);
    expect(() => duplicateCatalog.registerCollection(rentekravRowsBinding))
      .toThrow('samlingen er allerede registreret');

    const missingParentCatalog = new InputCatalog();
    missingParentCatalog.registerField(renterFraBinding);
    expect(() => missingParentCatalog.seal()).toThrow('entity-sti mangler registrering af sin parentsamling');
  });

  it('afviser refs til slettede og nested ikke-eksisterende entities fail-closed', () => {
    type Child = Readonly<{ id: string }>;
    const childrenBinding = createCollectionBinding<Child>({
      template: {
        section: 'renteberegning',
        path: [{ kind: 'entity', collection: 'rentekravRows' }],
        collection: 'children',
      },
      getEntityId: (child) => child.id,
      readEntities: (_sections, collection) => {
        const parentId = collection.path[0]?.kind === 'entity' ? collection.path[0].entityId : '';
        return parentId === 'række-1' ? [{ id: 'barn-1' }] : [];
      },
      writeEntities: (sections) => sections,
    });
    const childFieldBinding = createFieldBinding({
      definition: textDefinition,
      template: {
        section: 'renteberegning',
        path: [
          { kind: 'entity', collection: 'rentekravRows' },
          { kind: 'entity', collection: 'children' },
        ],
        field: 'værdi',
      },
      readCanonical: () => 'værdi',
      writeCanonical: (sections) => sections,
    });
    const catalog = new InputCatalog();
    catalog.registerCollection(rentekravRowsBinding);
    catalog.registerCollection(childrenBinding);
    catalog.registerField(childFieldBinding);
    catalog.seal();
    const sections = withRows([{ id: 'række-1', enhed: 'dage' }]);

    expect(catalog.readCanonical(sections, childFieldBinding.createRef('række-1', 'barn-1'))).toBe('værdi');
    expect(() => catalog.readCanonical(sections, childFieldBinding.createRef('slettet', 'barn-1')))
      .toThrow('ukendt, slettet eller forkert bundet feltreference');
    expect(() => catalog.readCanonical(sections, childFieldBinding.createRef('række-1', 'slettet')))
      .toThrow('ukendt, slettet eller forkert bundet feltreference');
    expect(() => catalog.listEntityIds(sections, childrenBinding.createRef('slettet')))
      .toThrow('samlingen ligger under en slettet eller ukendt entity');
  });

  it('afviser whitespace og duplikerede entity-id’er, også uden rejections', () => {
    const catalog = new InputCatalog();
    catalog.registerCollection(rentekravRowsBinding);
    catalog.seal();

    expect(() => catalog.validateCollections(withRows([{ id: ' ', enhed: 'dage' }])))
      .toThrow('ikke-tomme, trimmede og unikke');
    expect(() => catalog.validateCollections(withRows([
      { id: 'række-1', enhed: 'dage' },
      { id: 'række-1', enhed: 'dage' },
    ]))).toThrow('ikke-tomme, trimmede og unikke');
  });

  it('isolerer muterende read- og write-callbacks fra før-snapshottet', () => {
    let mutateDuringRead = true;
    const binding = createFieldBinding({
      definition: textDefinition,
      template: { section: 'stamdata', path: [], field: 'skadelidte' },
      readCanonical: (sections) => {
        if (mutateDuringRead && sections.stamdata !== null) {
          (sections.stamdata as { skadelidte?: string }).skadelidte = 'muteret';
        }
        return sections.stamdata?.skadelidte;
      },
      writeCanonical: (sections, _address, value) => {
        if (sections.stamdata !== null) sections.stamdata.skadelidte = value;
        return sections;
      },
    });
    const catalog = new InputCatalog();
    catalog.registerField(binding);
    catalog.seal();
    const sections: PersistedInputSections = {
      ...createEmptyPersistedInputSections(),
      stamdata: { skadelidte: 'Anna' },
    };

    expect(() => catalog.readCanonical(sections, binding.createRef())).toThrow(TypeError);
    expect(sections.stamdata?.skadelidte).toBe('Anna');

    mutateDuringRead = false;
    const written = catalog.writeCanonical(sections, binding.createRef(), 'Birgit');
    expect(written.stamdata?.skadelidte).toBe('Birgit');
    expect(sections.stamdata?.skadelidte).toBe('Anna');
    expect(written).not.toBe(sections);
  });

  it('isolerer muterende entity-id-callbacks fra canonical entities', () => {
    const mutatingBinding = createCollectionBinding<RentekravRow>({
      template: { section: 'renteberegning', path: [], collection: 'rentekravRows' },
      getEntityId: (row) => {
        (row as { id: string }).id = 'muteret';
        return row.id;
      },
      readEntities: (sections) => sections.renteberegning?.rentekravRows ?? [],
      writeEntities: (sections) => sections,
    });
    const catalog = new InputCatalog();
    catalog.registerCollection(mutatingBinding);
    catalog.seal();
    const sections = withRows([{ id: 'række-1', enhed: 'dage' }]);

    expect(() => catalog.listEntityIds(sections, mutatingBinding.createRef())).toThrow(TypeError);
    expect(sections.renteberegning?.rentekravRows[0]?.id).toBe('række-1');
  });

  it('udstiller stabile, frosne id-lister fra kendte samlinger', () => {
    const catalog = new InputCatalog();
    catalog.registerCollection(rentekravRowsBinding);
    catalog.seal();
    const collection = createCollectionRef({
      section: 'renteberegning',
      path: [],
      collection: 'rentekravRows',
    });
    const ids = catalog.listEntityIds(withRows([
      { id: 'række-1', enhed: 'dage' },
      { id: 'række-2', enhed: 'dage' },
    ]), collection);

    expect(ids).toEqual(['række-1', 'række-2']);
    expect(Object.isFrozen(ids)).toBe(true);
  });
});
