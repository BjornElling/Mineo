import { serializeFieldAddress } from '../../input/fieldAddress';
import {
  InputCatalog,
  createCollectionBinding,
  createFieldBinding,
} from '../../input/fieldCatalog';
import { defineField } from '../../input/fieldDefinition';
import {
  ALLOW_SAVE_INPUT_ISSUE_POLICY,
  BLOCK_SAVE_INPUT_ISSUE_POLICY,
  createFieldInputIssue,
} from '../../input/inputIssue';
import {
  collectInputProjections,
  createInputProjectionValidator,
  createInputProjectionSpec,
  deriveInputProjectionIssues,
  evaluateInputProjection,
  flatMapInputProjection,
  inputProjectionFinding,
  mapInputProjection,
  optionalInput,
  requiredInput,
} from '../../input/inputProjection';
import { createInputReader, createInputRevision } from '../../input/inputReader';
import {
  createEmptyPersistedInputSections,
  createPersistedInputStateSchema,
  type PersistedInputState,
} from '../../input/inputState';
import { toISODateString } from '../../types/branded';

const textDefinition = (label: string) => defineField<string | undefined>({
  label,
  controlKind: 'text',
  codec: {
    parseForSettle: (raw) => ({ status: 'valid', value: raw || undefined }),
    format: (value) => value ?? '',
    formatForEdit: (value) => value ?? '',
    acceptsInitialKey: (key) => key.length === 1,
  },
});

const nameBinding = createFieldBinding({
  definition: textDefinition('Navn'),
  template: { section: 'stamdata', path: [], field: 'skadelidte' },
  readCanonical: (sections) => sections.stamdata?.skadelidte,
  writeCanonical: (sections, _address, value) => ({
    ...sections,
    stamdata: { ...(sections.stamdata ?? {}), skadelidte: value },
  }),
});
const journalBinding = createFieldBinding({
  definition: textDefinition('Journalnummer'),
  template: { section: 'stamdata', path: [], field: 'journalnr' },
  readCanonical: (sections) => sections.stamdata?.journalnr,
  writeCanonical: (sections, _address, value) => ({
    ...sections,
    stamdata: { ...(sections.stamdata ?? {}), journalnr: value },
  }),
});
const nameField = nameBinding.createRef();
const journalField = journalBinding.createRef();

const inputCatalog = new InputCatalog();
inputCatalog.registerField(nameBinding);
inputCatalog.registerField(journalBinding);
inputCatalog.seal();

const createReader = (options: Readonly<{
  name?: string;
  journal?: string;
  rejected?: Readonly<Record<string, { raw: string }>>;
  revision?: number;
}> = {}) => {
  const sections = {
    ...createEmptyPersistedInputSections(),
    stamdata: {
      skadelidte: options.name,
      journalnr: options.journal,
    },
  };
  const input = createPersistedInputStateSchema(inputCatalog).parse({
    sections,
    rejectedInputs: options.rejected ?? {},
  });
  return createInputReader({
    input,
    revision: createInputRevision(options.revision ?? 1),
    catalog: inputCatalog,
  });
};

const isNonEmptyString = (value: string | undefined): value is string =>
  typeof value === 'string' && value !== '';

describe('inputProjection', () => {
  it('blokerer rejected dependency uden at bygge data fra recovery-værdien', () => {
    const build = vi.fn(({ name }: { name: string }) => ({ name }));
    const spec = createInputProjectionSpec({
      dependencies: { name: requiredInput(nameField, isNonEmptyString, { missingPolicy: ALLOW_SAVE_INPUT_ISSUE_POLICY }) },
      build,
    });
    const reader = createReader({
      name: 'Recovery-navn',
      rejected: { [serializeFieldAddress(nameField.address)]: { raw: '12..20' } },
      revision: 7,
    });

    const projection = evaluateInputProjection(reader, spec);

    expect(projection).toEqual(expect.objectContaining({
      status: 'blocked',
      revision: 7,
      blockers: [expect.objectContaining({ code: 'input.invalid', reason: 'invalid' })],
    }));
    expect(build).not.toHaveBeenCalled();
  });

  it('overblokerer ikke rejected input, som consumeren ikke afhænger af', () => {
    const spec = createInputProjectionSpec({
      dependencies: { name: requiredInput(nameField, isNonEmptyString, { missingPolicy: ALLOW_SAVE_INPUT_ISSUE_POLICY }) },
      build: ({ name }) => name,
    });
    const projection = evaluateInputProjection(createReader({
      name: 'Anne',
      journal: 'Recovery',
      rejected: { [serializeFieldAddress(journalField.address)]: { raw: '???' } },
    }), spec);

    expect(projection).toEqual({ status: 'ready', data: 'Anne', issues: [], revision: 1 });
  });

  it('tillader optional canonical tomhed, men blokerer optional rejected input', () => {
    const spec = createInputProjectionSpec({
      dependencies: { journal: optionalInput(journalField) },
      build: ({ journal }) => journal,
    });

    expect(evaluateInputProjection(createReader(), spec)).toEqual({
      status: 'ready',
      data: undefined,
      issues: [],
      revision: 1,
    });
    expect(evaluateInputProjection(createReader({
      rejected: { [serializeFieldAddress(journalField.address)]: { raw: '?' } },
    }), spec).status).toBe('blocked');
  });

  it('bruger required type-guard til missing og narrowed ready-data', () => {
    const spec = createInputProjectionSpec({
      dependencies: { name: requiredInput(nameField, isNonEmptyString, { missingPolicy: ALLOW_SAVE_INPUT_ISSUE_POLICY }) },
      build: ({ name }) => name.toUpperCase(),
    });

    const projection = evaluateInputProjection(createReader(), spec);

    expect(projection).toEqual(expect.objectContaining({
      status: 'blocked',
      blockers: [expect.objectContaining({
        code: 'input.missing',
        message: 'Feltet Navn er ikke udfyldt',
      })],
    }));
    expect(projection.issues[0]?.policy.blocksSave).toBe(false);
  });

  it('bevarer issues fra validatorer, hvis egne dependencies er resolved i en blocked projektion', () => {
    const nameDependency = requiredInput(nameField, isNonEmptyString, {
      missingPolicy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
    });
    const journalDependency = requiredInput(journalField, isNonEmptyString, {
      missingPolicy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
    });
    const journalIssue = createFieldInputIssue({
      field: journalField,
      reason: 'range',
      code: 'journal.range',
      message: 'Journalnummeret ligger uden for de konkrete grænser',
      policy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
    });
    const validateJournal = vi.fn(() => [
      inputProjectionFinding(journalIssue, { blocksProjection: false }),
    ]);
    const validateName = vi.fn(() => []);
    const spec = createInputProjectionSpec({
      dependencies: { name: nameDependency, journal: journalDependency },
      validators: [
        createInputProjectionValidator({
          dependencies: { journal: journalDependency },
          validate: validateJournal,
        }),
        createInputProjectionValidator({
          dependencies: { name: nameDependency },
          validate: validateName,
        }),
      ],
      build: ({ name, journal }) => ({ name, journal }),
    });

    const projection = evaluateInputProjection(createReader({ journal: 'J-1' }), spec);

    expect(projection.status).toBe('blocked');
    expect(projection.issues).toEqual([
      expect.objectContaining({ reason: 'missing', target: expect.objectContaining({ kind: 'field' }) }),
      journalIssue,
    ]);
    expect(validateJournal).toHaveBeenCalledOnce();
    expect(validateName).not.toHaveBeenCalled();
  });

  it('bevarer ikke-blokerende error-issues i ready-grenen', () => {
    const rangeIssue = createFieldInputIssue({
      field: nameField,
      reason: 'bounds',
      code: 'navn.bounds',
      message: 'Navnet ligger uden for de konkrete grænser',
      policy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
    });
    const nameDependency = requiredInput(nameField, isNonEmptyString, { missingPolicy: ALLOW_SAVE_INPUT_ISSUE_POLICY });
    const spec = createInputProjectionSpec({
      dependencies: { name: nameDependency },
      validators: [createInputProjectionValidator({
        dependencies: { name: nameDependency },
        validate: () => [inputProjectionFinding(rangeIssue, { blocksProjection: false })],
      })],
      build: ({ name }) => name,
    });
    const reader = createReader({ name: 'Anne' });

    const projection = evaluateInputProjection(reader, spec);

    expect(projection).toEqual({ status: 'ready', data: 'Anne', issues: [rangeIssue], revision: 1 });
    expect(deriveInputProjectionIssues(reader, spec)).toEqual([rangeIssue]);
  });

  it('blokerer på eksplicit domæneregel og deduplikerer samme issue stabilt', () => {
    const ruleIssue = createFieldInputIssue({
      field: nameField,
      reason: 'rule',
      code: 'navn.rule',
      message: 'Navnet opfylder ikke reglen',
      policy: BLOCK_SAVE_INPUT_ISSUE_POLICY,
    });
    const finding = inputProjectionFinding(ruleIssue, { blocksProjection: true });
    const nameDependency = requiredInput(nameField, isNonEmptyString, { missingPolicy: ALLOW_SAVE_INPUT_ISSUE_POLICY });
    const spec = createInputProjectionSpec({
      dependencies: { name: nameDependency },
      validators: [createInputProjectionValidator({
        dependencies: { name: nameDependency },
        validate: () => [finding, finding],
      })],
      build: ({ name }) => name,
    });
    const projection = evaluateInputProjection(createReader({ name: 'Anne' }), spec);

    expect(projection.status).toBe('blocked');
    expect(projection.issues).toEqual([ruleIssue]);
    if (projection.status !== 'blocked') throw new Error('Testinvariant: projektionen skulle være blokeret');
    expect(projection.blockers).toHaveLength(1);
  });

  it('afviser field-issues for ikke-deklarerede eller forged dependencies', () => {
    const undeclaredIssue = createFieldInputIssue({ field: journalField, reason: 'invalid' });
    const forgedField = createFieldBinding({
      definition: textDefinition('Forkert navn'),
      template: { section: 'stamdata', path: [], field: 'skadelidte' },
      readCanonical: () => 'Anne',
      writeCanonical: (sections) => sections,
    }).createRef();
    const forgedIssue = createFieldInputIssue({ field: forgedField, reason: 'invalid' });
    const createSpec = (issue: typeof undeclaredIssue) => {
      const nameDependency = requiredInput(nameField, isNonEmptyString, { missingPolicy: ALLOW_SAVE_INPUT_ISSUE_POLICY });
      return createInputProjectionSpec({
        dependencies: { name: nameDependency },
        validators: [createInputProjectionValidator({
          dependencies: { name: nameDependency },
          validate: () => [inputProjectionFinding(issue, { blocksProjection: true })],
        })],
        build: ({ name }) => name,
      });
    };
    const reader = createReader({ name: 'Anne' });

    expect(() => evaluateInputProjection(reader, createSpec(undeclaredIssue)))
      .toThrow('InputProjection: field-issue peger på en ikke-deklareret dependency');
    expect(() => evaluateInputProjection(reader, createSpec(forgedIssue)))
      .toThrow('InputProjection: field-issue peger på en ikke-deklareret dependency');
  });

  it('håndhæver finding- og spec-invarianter selv uden factoryhelpers', () => {
    const warning = createFieldInputIssue({
      field: nameField,
      reason: 'rule',
      code: 'navn.warning',
      message: 'Kontrollér navnet',
      severity: 'warning',
      policy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
    });
    const nameDependency = optionalInput(nameField);
    const rawSpec = {
      dependencies: { first: nameDependency, duplicate: nameDependency },
      build: ({ first }: { first: string | undefined; duplicate: string | undefined }) => first,
    };
    const rawFindingSpec = createInputProjectionSpec({
      dependencies: { name: nameDependency },
      validators: [createInputProjectionValidator({
        dependencies: { name: nameDependency },
        validate: () => [{ issue: warning, blocksProjection: true }],
      })],
      build: ({ name }) => name,
    });
    const reader = createReader({ name: 'Anne' });

    expect(() => evaluateInputProjection(reader, rawSpec))
      .toThrow('InputProjection: samme feltadresse er deklareret mere end én gang');
    expect(() => evaluateInputProjection(reader, rawFindingSpec))
      .toThrow('InputProjection: et warning-issue må ikke blokere projektionen');

    expect(() => createInputProjectionSpec({
      dependencies: { name: nameDependency },
      validators: [createInputProjectionValidator({
        dependencies: { journal: optionalInput(journalField) },
        validate: () => [],
      })],
      build: ({ name }) => name,
    })).toThrow('InputProjection: validator afhænger af et felt uden for projektionen');
  });

  it('afviser kopierede eller ændrede issues uden for den autoritative factory', () => {
    const authentic = createFieldInputIssue({ field: nameField, reason: 'invalid' });
    const forged = {
      ...authentic,
      policy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
    } as typeof authentic;

    expect(() => inputProjectionFinding(forged, { blocksProjection: true }))
      .toThrow('InputIssue: issue skal være oprettet af den autoritative factory');
  });

  it('afviser konfliktende dubletter i stedet for at gøre gate afhængig af rækkefølge', () => {
    const base = {
      field: nameField,
      reason: 'rule' as const,
      code: 'navn.konflikt',
      message: 'Kontrollér navnet',
      policy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
    };
    const warning = createFieldInputIssue({ ...base, severity: 'warning' });
    const error = createFieldInputIssue({ ...base, severity: 'error' });
    const nameDependency = optionalInput(nameField);
    const spec = createInputProjectionSpec({
      dependencies: { name: nameDependency },
      validators: [createInputProjectionValidator({
        dependencies: { name: nameDependency },
        validate: () => [
          inputProjectionFinding(warning, { blocksProjection: false }),
          inputProjectionFinding(error, { blocksProjection: false }),
        ],
      })],
      build: ({ name }) => name,
    });

    expect(() => evaluateInputProjection(createReader({ name: 'Anne' }), spec))
      .toThrow('InputIssue: konflikt mellem issues med identiteten');
  });

  it('isolerer rækkeprojektioner og blokerer kun aggregatet, der samler den ugyldige række', () => {
    const rowDefinition = textDefinition('Rækketekst');
    const rowBinding = createFieldBinding({
      definition: rowDefinition,
      template: {
        section: 'renteberegning',
        path: [{ kind: 'entity', collection: 'rentekravRows' }],
        field: 'renterFra',
      },
      readCanonical: (sections, address) => {
        const entityId = address.path[0]?.kind === 'entity' ? address.path[0].entityId : undefined;
        return sections.renteberegning?.rentekravRows.find((row) => row.id === entityId)?.renterFra;
      },
      writeCanonical: (sections) => sections,
    });
    type RentekravRow = NonNullable<
      PersistedInputState['sections']['renteberegning']
    >['rentekravRows'][number];
    const rowCatalog = new InputCatalog();
    rowCatalog.registerField(rowBinding);
    rowCatalog.registerCollection(createCollectionBinding<RentekravRow>({
      template: { section: 'renteberegning', path: [], collection: 'rentekravRows' },
      getEntityId: (row) => row.id,
      readEntities: (sections) => sections.renteberegning?.rentekravRows ?? [],
      writeEntities: (sections, _collection, rows) => ({
        ...sections,
        renteberegning: { ...(sections.renteberegning ?? {}), rentekravRows: [...rows] },
      }),
    }));
    rowCatalog.seal();
    const row1 = rowBinding.createRef('række-1');
    const row2 = rowBinding.createRef('række-2');
    const input = {
      sections: {
        ...createEmptyPersistedInputSections(),
        renteberegning: {
          rentekravRows: [
            { id: 'række-1', renterFra: toISODateString('2024-01-01'), enhed: 'dage' },
            { id: 'række-2', renterFra: toISODateString('2024-02-01'), enhed: 'dage' },
          ],
        },
      },
      rejectedInputs: { [serializeFieldAddress(row2.address)]: { raw: 'ugyldig' } },
    };
    const validatedInput = createPersistedInputStateSchema(rowCatalog).parse(input);
    const reader = createInputReader({
      input: validatedInput,
      revision: createInputRevision(9),
      catalog: rowCatalog,
    });
    const rowProjection = (field: typeof row1) => evaluateInputProjection(reader, createInputProjectionSpec({
      dependencies: { value: requiredInput(field, isNonEmptyString, { missingPolicy: ALLOW_SAVE_INPUT_ISSUE_POLICY }) },
      build: ({ value }) => value,
    }));

    const first = rowProjection(row1);
    const second = rowProjection(row2);
    const aggregate = collectInputProjections(reader, [first, second]);

    expect(first).toEqual({ status: 'ready', data: '2024-01-01', issues: [], revision: 9 });
    expect(second.status).toBe('blocked');
    expect(aggregate.status).toBe('blocked');
    expect(aggregate.revision).toBe(9);
  });

  it('bevarer revision og issues gennem map/flatMap og afviser blandede revisioner', () => {
    const baseSpec = createInputProjectionSpec({
      dependencies: { name: requiredInput(nameField, isNonEmptyString, { missingPolicy: ALLOW_SAVE_INPUT_ISSUE_POLICY }) },
      build: ({ name }) => name,
    });
    const baseReader = createReader({ name: 'Anne', revision: 3 });
    const base = evaluateInputProjection(baseReader, baseSpec);
    const mapped = mapInputProjection(base, (name) => name.length);
    const flatMapped = flatMapInputProjection(mapped, (length) => mapInputProjection(base, (name) => ({ name, length })));
    const otherRevision = evaluateInputProjection(createReader({ name: 'Bo', revision: 4 }), baseSpec);

    expect(flatMapped).toEqual({
      status: 'ready',
      data: { name: 'Anne', length: 4 },
      issues: [],
      revision: 3,
    });
    expect(() => collectInputProjections(baseReader, [base, otherRevision]))
      .toThrow('InputProjection: projektioner fra forskellige revisioner kan ikke sammensættes');
    expect(() => flatMapInputProjection(base, () => otherRevision))
      .toThrow('InputProjection: projektioner fra forskellige revisioner kan ikke sammensættes');
  });

  it('kalder ikke map-funktioner for blocked projektioner og bevarer frosne resultater', () => {
    const spec = createInputProjectionSpec({
      dependencies: {
        name: requiredInput(nameField, isNonEmptyString, {
          missingPolicy: ALLOW_SAVE_INPUT_ISSUE_POLICY,
        }),
      },
      build: ({ name }) => name,
    });
    const blocked = evaluateInputProjection(createReader(), spec);
    const mapper = vi.fn((name: string) => name.length);

    const mapped = mapInputProjection(blocked, mapper);
    const flatMapped = flatMapInputProjection(blocked, () => {
      throw new Error('Mapperen må ikke kaldes');
    });

    expect(mapper).not.toHaveBeenCalled();
    expect(mapped.status).toBe('blocked');
    expect(flatMapped.status).toBe('blocked');
    expect(Object.isFrozen(mapped)).toBe(true);
    expect(Object.isFrozen(mapped.issues)).toBe(true);
    if (mapped.status !== 'blocked') throw new Error('Testinvariant: mapped skulle være blocked');
    expect(Object.isFrozen(mapped.blockers)).toBe(true);
  });

  it('isolerer og deep-freezer data fra build og map', () => {
    const buildResult = { nested: { names: ['Anna'] } };
    const spec = createInputProjectionSpec({
      dependencies: { name: optionalInput(nameField) },
      build: () => buildResult,
    });
    const projection = evaluateInputProjection(createReader({ name: 'Anna' }), spec);
    if (projection.status !== 'ready') throw new Error('Testinvariant: projektionen skulle være ready');

    const mapResult = { nested: { count: 1 } };
    const mapped = mapInputProjection(projection, () => mapResult);
    if (mapped.status !== 'ready') throw new Error('Testinvariant: den mappede projektion skulle være ready');

    expect(projection.data).not.toBe(buildResult);
    expect(Object.isFrozen(projection.data.nested)).toBe(true);
    expect(Object.isFrozen(projection.data.nested.names)).toBe(true);
    expect(mapped.data).not.toBe(mapResult);
    expect(Object.isFrozen(mapped.data.nested)).toBe(true);
    expect(Object.isFrozen(buildResult)).toBe(false);
    expect(Object.isFrozen(mapResult)).toBe(false);
  });

  it('samler en tom dynamisk collection på readerens eksplicitte revision', () => {
    const reader = createReader({ revision: 6 });
    const projection = collectInputProjections(reader, []);

    expect(projection).toEqual({ status: 'ready', data: [], issues: [], revision: 6 });
    if (projection.status !== 'ready') throw new Error('Testinvariant: tom collection skulle være ready');
    expect(Object.isFrozen(projection.data)).toBe(true);
  });
});
