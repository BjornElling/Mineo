import { serializeFieldAddress } from '../../input/fieldAddress';
import {
  InputCatalog,
  createCollectionBinding,
  createFieldBinding,
} from '../../input/fieldCatalog';
import { bindField, defineField } from '../../input/fieldDefinition';
import {
  clearCase,
  commitImmediateField,
  deleteRow,
  insertRow,
  reduceInputCommand,
  reorderRows,
  replaceCase,
  resetSection,
  settleField,
  settleFieldInNewRow,
} from '../../input/inputCommands';
import {
  createEmptyPersistedInputSections,
  createPersistedInputStateSchema,
  type PersistedInputState,
} from '../../input/inputState';
import type { RentekravRow } from '../../schemas/formSchemas/sections/renteberegningSchemas';

const parseNameForSettle = vi.fn((raw: string) => /^[!?]/.test(raw)
  ? { status: 'invalid' as const }
  : { status: 'valid' as const, value: raw.trim() || undefined });

const nameDefinition = defineField<string | undefined>({
  label: 'Skadelidte',
  controlKind: 'text',
  codec: {
    parseForSettle: parseNameForSettle,
    format: (value) => value ?? '',
    formatForEdit: (value) => value ?? '',
    acceptsInitialKey: (key) => key.length === 1,
  },
});

const supplementDefinition = defineField<number | undefined>({
  label: 'Tillægstid',
  controlKind: 'text',
  codec: {
    parseForSettle: (raw) => {
      const trimmed = raw.trim();
      if (trimmed === '') return { status: 'valid', value: undefined };
      if (!/^\d+$/.test(trimmed)) return { status: 'invalid' };
      return { status: 'valid', value: Number.parseInt(trimmed, 10) };
    },
    format: (value) => value === undefined ? '' : String(value),
    formatForEdit: (value) => value === undefined ? '' : String(value),
    acceptsInitialKey: (key) => /^\d$/.test(key),
  },
});

const nameBinding = createFieldBinding({
  definition: nameDefinition,
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
    renteberegning: {
      ...(sections.renteberegning ?? {}),
      rentekravRows: [...rows],
    },
  }),
});

const supplementBinding = createFieldBinding({
  definition: supplementDefinition,
  template: {
    section: 'renteberegning',
    path: [{ kind: 'entity', collection: 'rentekravRows' }],
    field: 'tillaegstid',
  },
  readCanonical: (sections, address) => {
    const rowId = address.path[0]?.kind === 'entity' ? address.path[0].entityId : '';
    return sections.renteberegning?.rentekravRows.find((row) => row.id === rowId)?.tillaegstid;
  },
  writeCanonical: (sections, address, value) => {
    const rowId = address.path[0]?.kind === 'entity' ? address.path[0].entityId : '';
    if (sections.renteberegning === null) return sections;
    return {
      ...sections,
      renteberegning: {
        ...sections.renteberegning,
        rentekravRows: sections.renteberegning.rentekravRows.map((row) =>
          row.id === rowId ? { ...row, tillaegstid: value } : row),
      },
    };
  },
});

const catalog = new InputCatalog();
catalog.registerField(nameBinding);
catalog.registerCollection(rowsBinding);
catalog.registerField(supplementBinding);
catalog.seal();

const inputSchema = createPersistedInputStateSchema(catalog);
const createRow = (id: string, supplement?: number): RentekravRow => ({
  id,
  enhed: 'dage',
  ...(supplement === undefined ? {} : { tillaegstid: supplement }),
});

const createInput = (options: Readonly<{
  name?: string;
  rows?: readonly RentekravRow[];
}> = {}): PersistedInputState => inputSchema.parse({
  sections: {
    ...createEmptyPersistedInputSections(),
    ...(options.name === undefined ? {} : { stamdata: { skadelidte: options.name } }),
    renteberegning: { rentekravRows: [...(options.rows ?? [createRow('række-1')])] },
  },
  rejectedInputs: {},
});

const rowIds = (input: PersistedInputState): readonly string[] =>
  input.sections.renteberegning?.rentekravRows.map((row) => row.id) ?? [];

describe('reduceInputCommand', () => {
  beforeEach(() => {
    parseNameForSettle.mockClear();
  });

  it('settler canonical værdi, rejected input og semantiske no-ops deterministisk', () => {
    const field = nameBinding.createRef();
    const input = createInput({ name: 'Recovery' });
    const invalid = reduceInputCommand(input, settleField(field, '!'), catalog);
    const repeatedInvalid = reduceInputCommand(invalid.input, settleField(field, '!'), catalog);
    const changedInvalid = reduceInputCommand(invalid.input, settleField(field, '??'), catalog);
    const valid = reduceInputCommand(changedInvalid.input, settleField(field, ' Anna '), catalog);
    const repeatedValid = reduceInputCommand(valid.input, settleField(field, 'Anna'), catalog);

    expect(invalid.changed).toBe(true);
    expect(invalid.input.sections.stamdata?.skadelidte).toBe('Recovery');
    expect(invalid.input.rejectedInputs).toEqual({
      [serializeFieldAddress(field.address)]: { raw: '!' },
    });
    expect(repeatedInvalid).toEqual({ changed: false, input: invalid.input });
    expect(repeatedInvalid.input).toBe(invalid.input);
    expect(changedInvalid.input.rejectedInputs).toEqual({
      [serializeFieldAddress(field.address)]: { raw: '??' },
    });
    expect(valid.input.sections.stamdata?.skadelidte).toBe('Anna');
    expect(valid.input.rejectedInputs).toEqual({});
    expect(repeatedValid.changed).toBe(false);
    expect(repeatedValid.input).toBe(valid.input);
    expect(input.sections.stamdata?.skadelidte).toBe('Recovery');
  });

  it('committer immediate canonical data uden at bruge label eller rå codec-protocol', () => {
    const field = nameBinding.createRef();
    const input = reduceInputCommand(createInput({ name: 'Recovery' }), settleField(field, '!'), catalog).input;
    parseNameForSettle.mockClear();

    // Samme tekst ville være rejected gennem parseren, men er gyldig canonical data fra controllet.
    const result = reduceInputCommand(input, commitImmediateField(field, '!'), catalog);

    expect(parseNameForSettle).not.toHaveBeenCalled();
    expect(result.input.sections.stamdata?.skadelidte).toBe('!');
    expect(result.input.rejectedInputs).toEqual({});
  });

  it('indsætter, omordner og sletter rækker gennem den registrerede samlingsbinding', () => {
    const input = createInput({ rows: [createRow('række-1'), createRow('række-2')] });
    const inserted = reduceInputCommand(
      input,
      insertRow(rowsBinding, createRow('række-3'), { index: 1 }),
      catalog
    );
    const reordered = reduceInputCommand(
      inserted.input,
      reorderRows(rowsBinding, ['række-2', 'række-3', 'række-1']),
      catalog
    );
    const deleted = reduceInputCommand(reordered.input, deleteRow(rowsBinding, 'række-3'), catalog);

    expect(rowIds(inserted.input)).toEqual(['række-1', 'række-3', 'række-2']);
    expect(rowIds(reordered.input)).toEqual(['række-2', 'række-3', 'række-1']);
    expect(rowIds(deleted.input)).toEqual(['række-2', 'række-1']);
    expect(rowIds(input)).toEqual(['række-1', 'række-2']);
  });

  it('fjerner alle rejected inputs under en slettet række uden at røre andre felter', () => {
    const rowField = supplementBinding.createRef('række-1');
    const otherField = nameBinding.createRef();
    let input = createInput({ name: 'Recovery', rows: [createRow('række-1'), createRow('række-2')] });
    input = reduceInputCommand(input, settleField(rowField, 'x'), catalog).input;
    input = reduceInputCommand(input, settleField(otherField, '!'), catalog).input;

    const result = reduceInputCommand(input, deleteRow(rowsBinding, 'række-1'), catalog);

    expect(result.input.rejectedInputs).toEqual({
      [serializeFieldAddress(otherField.address)]: { raw: '!' },
    });
    expect(rowIds(result.input)).toEqual(['række-2']);
  });

  it('promoverer første gyldige og ugyldige settle til en rigtig række atomisk', () => {
    const input = createInput();
    const validField = supplementBinding.createRef('række-2');
    const invalidField = supplementBinding.createRef('række-3');

    const valid = reduceInputCommand(
      input,
      settleFieldInNewRow(rowsBinding, createRow('række-2'), validField, '7'),
      catalog
    );
    const invalid = reduceInputCommand(
      valid.input,
      settleFieldInNewRow(rowsBinding, createRow('række-3'), invalidField, 'x'),
      catalog
    );

    expect(valid.input.sections.renteberegning?.rentekravRows).toEqual([
      createRow('række-1'),
      createRow('række-2', 7),
    ]);
    expect(invalid.input.sections.renteberegning?.rentekravRows).toEqual([
      createRow('række-1'),
      createRow('række-2', 7),
      createRow('række-3'),
    ]);
    expect(invalid.input.rejectedInputs).toEqual({
      [serializeFieldAddress(invalidField.address)]: { raw: 'x' },
    });
    expect(rowIds(input)).toEqual(['række-1']);
  });

  it('resetter en sektion og rydder kun sektionens rejected inputs', () => {
    const nameField = nameBinding.createRef();
    const rowField = supplementBinding.createRef('række-1');
    let input = createInput({ name: 'Anna' });
    input = reduceInputCommand(input, settleField(nameField, '!'), catalog).input;
    input = reduceInputCommand(input, settleField(rowField, 'x'), catalog).input;

    const result = reduceInputCommand(input, resetSection('stamdata', { skadelidte: 'Birgit' }), catalog);

    expect(result.input.sections.stamdata).toEqual({ skadelidte: 'Birgit' });
    expect(result.input.rejectedInputs).toEqual({
      [serializeFieldAddress(rowField.address)]: { raw: 'x' },
    });
  });

  it('erstatter og rydder hele sagen gennem validerede kandidataggregater', () => {
    const input = createInput({ name: 'Anna' });
    const replacement = {
      sections: {
        ...createEmptyPersistedInputSections(),
        stamdata: { skadelidte: 'Birgit' },
        renteberegning: { rentekravRows: [createRow('ny-række')] },
      },
      rejectedInputs: {},
    };

    const replaced = reduceInputCommand(input, replaceCase(replacement), catalog);
    const cleared = reduceInputCommand(replaced.input, clearCase(), catalog);

    expect(replaced.input.sections.stamdata?.skadelidte).toBe('Birgit');
    expect(rowIds(replaced.input)).toEqual(['ny-række']);
    expect(cleared.input.sections).toEqual(createEmptyPersistedInputSections());
    expect(cleared.input.rejectedInputs).toEqual({});
  });

  it('bevarer før-snapshottet ved mutationsfejl', () => {
    const input = createInput({ name: 'Anna' });
    const before = structuredClone(input);

    expect(() => reduceInputCommand(input, insertRow(rowsBinding, createRow('række-1')), catalog))
      .toThrow('entity-id’er skal være ikke-tomme, trimmede og unikke');
    expect(input).toEqual(before);
    expect(rowIds(input)).toEqual(['række-1']);
    expect(input.sections.stamdata?.skadelidte).toBe('Anna');
  });

  it('afviser forged feltdefinitioner og refs til ikke-eksisterende entities', () => {
    const input = createInput();
    const field = nameBinding.createRef();
    const forgedDefinition = defineField<string | undefined>({
      label: 'Forfalsket felt',
      controlKind: 'text',
      codec: nameDefinition.codec,
    });
    const forgedField = bindField(forgedDefinition, field.address);
    const nonexistentRowField = supplementBinding.createRef('findes-ikke');

    expect(() => reduceInputCommand(input, settleField(forgedField, 'Anna'), catalog))
      .toThrow('ukendt, slettet eller forkert bundet feltreference');
    expect(() => reduceInputCommand(input, settleField(nonexistentRowField, '7'), catalog))
      .toThrow('ukendt, slettet eller forkert bundet feltreference');
    expect(input.sections.stamdata).toBeNull();
    expect(rowIds(input)).toEqual(['række-1']);
  });
});
