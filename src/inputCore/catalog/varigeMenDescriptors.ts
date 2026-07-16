import type { ISODateString } from '../../types/branded';
import { createDateFieldCodec, createIntegerFieldCodec } from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';

// Greenfield produkt-descriptors for `varigemen`-sektionen (§3.2). To top-level skalarer, ingen samlinger.

const createEmptyVarigeMenSection = (): unknown => ({});

// mengrad persisteres som heltal. 1..120 er en domænegrænse, der afledes som bounds-issue efter settle —
// ikke en codec-parseregel (jf. renteberegning `tillaegstid`).
export const varigeMenMengradField = defineStructuralField<number | undefined>({
  id: 'varigemen.mengrad',
  template: { section: 'varigemen', path: [], field: 'mengrad' },
  codec: createIntegerFieldCodec({ allowNegative: false }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Méngrad',
  controlKind: 'text',
  createEmptySection: createEmptyVarigeMenSection,
});

export const varigeMenBeregningsdatoField = defineStructuralField<ISODateString | undefined>({
  id: 'varigemen.beregningsdato',
  template: { section: 'varigemen', path: [], field: 'beregningsdato' },
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Beregningsdato',
  controlKind: 'text',
  createEmptySection: createEmptyVarigeMenSection,
});

export const varigeMenFields = catalogFields(varigeMenMengradField, varigeMenBeregningsdatoField);
export const varigeMenCollections = catalogCollections();
