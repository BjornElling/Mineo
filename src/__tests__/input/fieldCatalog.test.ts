import {
  CollectionCatalog,
  FieldCatalog,
  createCollectionBinding,
  createFieldBinding,
} from '../../input/fieldCatalog';
import { createFieldAddress } from '../../input/fieldAddress';
import { bindField, defineField } from '../../input/fieldDefinition';
import { createEmptyPersistedInputSections } from '../../input/inputState';

const amountDefinition = defineField<number | undefined>({
  label: 'Løn',
  controlKind: 'text',
  focusTarget: { route: '/erstatningsopgoerelse', tab: 'loenindkomst' },
  codec: {
    parseForSettle: (raw) => ({ status: 'valid', value: raw === '' ? undefined : Number(raw) }),
    format: (value) => value === undefined ? '' : String(value),
    acceptsInitialKey: (key) => /^\d$/.test(key),
  },
});

describe('FieldCatalog', () => {
  it('binder nested entity-id’er til én strukturel felttemplate', () => {
    const binding = createFieldBinding({
      definition: amountDefinition,
      template: {
        section: 'erstatningsopgoerelse',
        path: [
          { kind: 'entity', collection: 'loenindkomstAnsaettelsesforhold' },
          { kind: 'entity', collection: 'indtaegtsoplysningerTableData' },
        ],
        field: 'col2',
      },
      readCanonical: (_sections, address) => address.path[1]?.kind === 'entity' ? 42 : undefined,
    });
    const catalog = new FieldCatalog();
    catalog.register(binding);
    const field = binding.createRef('arbejde:1', 'række:2');

    expect(field.address).toEqual({
      section: 'erstatningsopgoerelse',
      path: [
        { kind: 'entity', collection: 'loenindkomstAnsaettelsesforhold', entityId: 'arbejde:1' },
        { kind: 'entity', collection: 'indtaegtsoplysningerTableData', entityId: 'række:2' },
      ],
      field: 'col2',
    });
    expect(catalog.isKnownAddress(field.address)).toBe(true);
    expect(catalog.readCanonical(createEmptyPersistedInputSections(), field)).toBe(42);
  });

  it('afviser forkert antal entity-id’er og dobbeltregistrering', () => {
    const binding = createFieldBinding({
      definition: amountDefinition,
      template: {
        section: 'renteberegning',
        path: [{ kind: 'entity', collection: 'rentekrav' }],
        field: 'hovedstol',
      },
      readCanonical: () => 100,
    });
    const catalog = new FieldCatalog();
    catalog.register(binding);

    expect(() => binding.createRef()).toThrow("FieldBinding: forventede 1 entity-id'er, modtog 0");
    expect(() => catalog.register(binding)).toThrow('FieldCatalog: feltadressen er allerede registreret');
  });

  it('afviser en ref med korrekt adresse men en anden definition', () => {
    const binding = createFieldBinding({
      definition: amountDefinition,
      template: { section: 'stamdata', path: [], field: 'indtægt' },
      readCanonical: () => 100,
    });
    const catalog = new FieldCatalog();
    catalog.register(binding);
    const otherDefinition = defineField({
      ...amountDefinition,
      label: 'Anden definition',
    });
    const forgedRef = bindField(otherDefinition, createFieldAddress({
      section: 'stamdata',
      path: [],
      field: 'indtægt',
    }));

    expect(() => catalog.readCanonical(createEmptyPersistedInputSections(), forgedRef))
      .toThrow('FieldCatalog: ukendt eller forkert bundet feltreference');
  });
});

describe('CollectionCatalog', () => {
  it('binder parent-entity og udstiller kun unikke stabile id’er', () => {
    const binding = createCollectionBinding({
      template: {
        section: 'erstatningsopgoerelse',
        path: [{ kind: 'entity', collection: 'loenindkomstAnsaettelsesforhold' }],
        collection: 'indtaegtsoplysningerTableData',
      },
      readEntityIds: () => ['række-1', 'række-2'],
    });
    const catalog = new CollectionCatalog();
    catalog.register(binding);
    const collection = binding.createRef('arbejde-1');

    expect(catalog.listEntityIds(createEmptyPersistedInputSections(), collection)).toEqual([
      'række-1',
      'række-2',
    ]);
    expect(Object.isFrozen(catalog.listEntityIds(createEmptyPersistedInputSections(), collection))).toBe(true);
  });

  it('afviser ukendte samlinger samt tomme og duplikerede entity-id’er', () => {
    const binding = createCollectionBinding({
      template: { section: 'renteberegning', path: [], collection: 'rentekrav' },
      readEntityIds: () => ['række-1', 'række-1'],
    });
    const catalog = new CollectionCatalog();
    catalog.register(binding);

    expect(() => catalog.listEntityIds(createEmptyPersistedInputSections(), binding.createRef()))
      .toThrow('CollectionCatalog: entity-id’er skal være ikke-tomme og unikke');
    expect(() => catalog.listEntityIds(createEmptyPersistedInputSections(), createCollectionBinding({
      template: { section: 'aarsloen', path: [], collection: 'standardLoen' },
      readEntityIds: () => [],
    }).createRef())).toThrow('CollectionCatalog: ukendt samlingsreference');
  });
});
