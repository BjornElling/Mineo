import type { ISODateString } from '../../types/branded';
import { createDateFieldCodec, createIntegerFieldCodec } from '../fieldCodecs';
import { defineField } from '../fieldDefinition';
import type { FieldBinding } from '../fieldCatalog';
import { createStructuralFieldBinding } from '../structuralBindings';
import { defineInputManifest } from './inputManifest';

/**
 * Strukturelle bindinger for `varigemen`-sektionen. To top-level skalarer, ingen samlinger.
 * Begge felter redigeres på Ménberegning-fanen.
 */
const createEmptyVarigeMenSection = (): unknown => ({});

// mengrad persisteres som heltal (`wholeNumber`). 1..120 er en domænegrænse, der afledes som
// bounds-issue efter settle — ikke en codec-parseregel (jf. renteberegning `tillaegstid`).
export const varigeMenMengradBinding: FieldBinding<number | undefined> = createStructuralFieldBinding({
  definition: defineField<number | undefined>({
    label: 'Méngrad',
    controlKind: 'text',
    codec: createIntegerFieldCodec({ allowNegative: false }),
  }),
  template: { section: 'varigemen', path: [], field: 'mengrad' },
  createEmptySection: createEmptyVarigeMenSection,
});

export const varigeMenBeregningsdatoBinding: FieldBinding<ISODateString | undefined> =
  createStructuralFieldBinding({
    definition: defineField<ISODateString | undefined>({
      label: 'Beregningsdato',
      controlKind: 'text',
      codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    }),
    template: { section: 'varigemen', path: [], field: 'beregningsdato' },
    createEmptySection: createEmptyVarigeMenSection,
  });

export const varigeMenInputManifest = defineInputManifest({
  id: 'varige-men',
  fields: [varigeMenMengradBinding, varigeMenBeregningsdatoBinding],
  collections: [],
});
