import type { Koen } from '../../schemas/formSchemas/enumSchemas';
import type { ISODateString } from '../../types/branded';
import {
  createChoiceFieldCodec,
  createDateFieldCodec,
  createIntegerFieldCodec,
} from '../fieldCodecs';
import { defineField } from '../fieldDefinition';
import type { FieldBinding } from '../fieldCatalog';
import { createStructuralFieldBinding } from '../structuralBindings';

/**
 * Strukturelle bindinger for `forsoergertab`-sektionen. Kun top-level skalarer; siden er ikke fanet.
 */
const createEmptyForsoergertabSection = (): unknown => ({});

const FORSOERGERTAB_FOCUS = { route: '/forsoergertab', tab: null } as const;

const dateField = (field: string, label: string): FieldBinding<ISODateString | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<ISODateString | undefined>({
      label,
      controlKind: 'text',
      focusTarget: FORSOERGERTAB_FOCUS,
      codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    }),
    template: { section: 'forsoergertab', path: [], field },
    createEmptySection: createEmptyForsoergertabSection,
  });

export const forsoergertabEfterladteFodselsdatoBinding = dateField(
  'efterladteFodselsdato',
  'Efterladte ægtefælle/samlevers fødselsdato'
);
export const forsoergertabBeregningsdatoBinding = dateField('beregningsdato', 'Beregningsdato');
export const forsoergertabVirkningsdatoBinding = dateField('virkningsdato', 'Startdato for ASL-ydelse');

export const forsoergertabKoenBinding: FieldBinding<Koen | undefined> = createStructuralFieldBinding({
  definition: defineField<Koen | undefined>({
    label: 'Køn',
    controlKind: 'choice',
    focusTarget: FORSOERGERTAB_FOCUS,
    codec: createChoiceFieldCodec<Koen>(['Mand', 'Kvinde']),
  }),
  template: { section: 'forsoergertab', path: [], field: 'koen' },
  createEmptySection: createEmptyForsoergertabSection,
});

// 1..10 er en domænegrænse (afledt bounds-issue), ikke en codec-parseregel.
export const forsoergertabTilkendtForPeriodeAarBinding: FieldBinding<number | undefined> =
  createStructuralFieldBinding({
    definition: defineField<number | undefined>({
      label: 'Tilkendt for periode',
      controlKind: 'text',
      focusTarget: FORSOERGERTAB_FOCUS,
      codec: createIntegerFieldCodec({ allowNegative: false }),
    }),
    template: { section: 'forsoergertab', path: [], field: 'tilkendtForPeriodeAar' },
    createEmptySection: createEmptyForsoergertabSection,
  });
