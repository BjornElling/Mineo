import { bindField, defineField, type FieldDefinition } from '../../input/fieldDefinition';

const createDefinition = () => defineField<string | undefined>({
  label: 'Skadelidtes navn',
  controlKind: 'text',
  focusTarget: { route: '/stamdata', tab: null },
  codec: {
    parseForSettle: (raw) => ({ status: 'valid', value: raw || undefined }),
    format: (value) => value ?? '',
    formatForEdit: (value) => value ?? '',
    acceptsInitialKey: (key) => key.length === 1,
  },
});

describe('fieldDefinition', () => {
  it('kræver og bevarer et eksplicit edit-format', () => {
    const definition = createDefinition();

    expect(definition.codec.formatForEdit('Anna')).toBe('Anna');
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.codec)).toBe(true);
    expect(Object.isFrozen(definition.focusTarget)).toBe(true);

    expect(() => defineField({
      label: 'Navn',
      controlKind: 'text',
      focusTarget: { route: '/stamdata', tab: null },
      codec: {
        parseForSettle: (raw: string) => ({ status: 'valid' as const, value: raw }),
        format: (value: string) => value,
        formatForEdit: undefined,
        acceptsInitialKey: () => true,
      } as unknown as typeof definition.codec,
    })).toThrow('codec.formatForEdit skal være en funktion');
  });

  it('bevarer et eksplicit edit-format', () => {
    const definition = defineField<number>({
      label: 'Beløb',
      controlKind: 'text',
      focusTarget: { route: '/erstatningsopgoerelse', tab: 'tab' },
      codec: {
        parseForSettle: (raw) => ({ status: 'valid', value: Number(raw) }),
        format: (value) => `${value} kr.`,
        formatForEdit: String,
        acceptsInitialKey: (key) => /^\d$/.test(key),
      },
    });

    expect(definition.codec.format(12)).toBe('12 kr.');
    expect(definition.codec.formatForEdit(12)).toBe('12');
  });

  it('afviser tom eller ikke-kanonisk metadata', () => {
    const valid = createDefinition();

    expect(() => defineField({ ...valid, label: '' })).toThrow();
    expect(() => defineField({ ...valid, label: ' Navn' })).toThrow();
    expect(() => defineField({ ...valid, focusTarget: { route: 'stamdata', tab: null } })).toThrow();
    expect(() => defineField({ ...valid, focusTarget: { route: '/stamdata', tab: '' } })).toThrow();
  });

  it('canonicaliserer og isolerer adressen ved binding', () => {
    const definition = createDefinition();
    const mutableAddress = {
      section: 'stamdata' as const,
      path: [] as Array<{ kind: 'property'; name: string }>,
      field: 'skadelidteNavn',
    };
    const field = bindField(definition, mutableAddress);

    mutableAddress.field = 'ændret';
    mutableAddress.path.push({ kind: 'property', name: 'ændret' });

    expect(field.address).toEqual({ section: 'stamdata', path: [], field: 'skadelidteNavn' });
    expect(Object.isFrozen(field.address)).toBe(true);
    expect(Object.isFrozen(field.address.path)).toBe(true);
  });

  it('kræver factory-oprettede definitioner ved den typede grænse', () => {
    const rawDefinition = {
      label: 'Skadelidtes navn',
      controlKind: 'text' as const,
      focusTarget: { route: '/stamdata', tab: null },
      codec: {
        parseForSettle: (raw: string) => ({ status: 'valid' as const, value: raw }),
        format: (value: string) => value,
        formatForEdit: (value: string) => value,
        acceptsInitialKey: () => true,
      },
    };

    // @ts-expect-error Factory-brandet forhindrer strukturel konstruktion uden defineField.
    const forgedDefinition: FieldDefinition<string> = rawDefinition;
    expect(forgedDefinition.label).toBe('Skadelidtes navn');
    expect(() => bindField(
      rawDefinition as unknown as FieldDefinition<string>,
      { section: 'stamdata', path: [], field: 'skadelidteNavn' }
    )).toThrow('feltdefinitionen er ikke oprettet med defineField');
  });
});
