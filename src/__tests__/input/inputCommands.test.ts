import { FieldCatalog, createFieldBinding } from '../../input/fieldCatalog';
import { defineField } from '../../input/fieldDefinition';
import { commitImmediateField, reduceFieldInputCommand, settleField } from '../../input/inputCommands';
import { createEmptyPersistedInputSections, createPersistedInputStateSchema } from '../../input/inputState';

const nameDefinition = defineField<string>({
  label: 'Skadelidte',
  controlKind: 'text',
  focusTarget: { route: '/stamdata', tab: null },
  codec: {
    parseForSettle: (raw) => raw === '!' ? { status: 'invalid' } : { status: 'valid', value: raw.trim() },
    format: (value) => value,
    acceptsInitialKey: (key) => key.length === 1,
  },
});

describe('reduceFieldInputCommand', () => {
  const createSubject = () => {
    const catalog = new FieldCatalog();
    const binding = createFieldBinding({
      definition: nameDefinition,
      template: { section: 'stamdata', path: [], field: 'skadelidte' },
      readCanonical: (sections) => sections.stamdata?.skadelidte ?? '',
      writeCanonical: (sections, _address, value) => ({
        ...sections,
        stamdata: { ...(sections.stamdata ?? {}), skadelidte: value },
      }),
    });
    catalog.register(binding);
    const input = createPersistedInputStateSchema((address) => catalog.isKnownAddress(address)).parse({
      sections: createEmptyPersistedInputSections(),
      rejectedInputs: {},
    });
    return { catalog, field: binding.createRef(), input };
  };

  it('skriver canonical værdi og rydder en tidligere rejection i samme kandidataggregate', () => {
    const { catalog, field, input } = createSubject();
    const invalid = reduceFieldInputCommand(input, settleField(field, '!'), catalog, (address) =>
      catalog.isKnownAddress(address));
    const valid = reduceFieldInputCommand(invalid.input, settleField(field, ' Anna '), catalog, (address) =>
      catalog.isKnownAddress(address));

    expect(invalid.changed).toBe(true);
    expect(Object.values(invalid.input.rejectedInputs)).toEqual([{ raw: '!' }]);
    expect(valid.input.rejectedInputs).toEqual({});
    expect(valid.input.sections.stamdata?.skadelidte).toBe('Anna');
  });

  it('bevarer recovery-værdien, når en ny afslutning er ugyldig', () => {
    const { catalog, field, input } = createSubject();
    const first = reduceFieldInputCommand(input, settleField(field, 'Anna'), catalog, (address) =>
      catalog.isKnownAddress(address));
    const rejected = reduceFieldInputCommand(first.input, commitImmediateField(field, '!'), catalog, (address) =>
      catalog.isKnownAddress(address));

    expect(rejected.input.sections.stamdata?.skadelidte).toBe('Anna');
    expect(Object.values(rejected.input.rejectedInputs)).toEqual([{ raw: '!' }]);
  });

  it('afviser en semantisk no-op uden at ændre inputtet', () => {
    const { catalog, field, input } = createSubject();
    const first = reduceFieldInputCommand(input, settleField(field, 'Anna'), catalog, (address) =>
      catalog.isKnownAddress(address));
    const repeated = reduceFieldInputCommand(first.input, settleField(field, ' Anna '), catalog, (address) =>
      catalog.isKnownAddress(address));

    expect(repeated.changed).toBe(false);
    expect(repeated.input).toBe(first.input);
  });

  it('afviser en field reference med en fremmed definition', () => {
    const { catalog, field, input } = createSubject();
    const invalidDefinition = defineField({
      ...nameDefinition,
      codec: { ...nameDefinition.codec, parseForSettle: () => ({ status: 'invalid' as const }) },
    });
    const invalidField = { ...field, definition: invalidDefinition };

    expect(() => reduceFieldInputCommand(input, { kind: 'settleField', field: invalidField, raw: '' }, catalog, (address) =>
      catalog.isKnownAddress(address))).toThrow('FieldCatalog: ukendt eller forkert bundet feltreference');
  });
});
