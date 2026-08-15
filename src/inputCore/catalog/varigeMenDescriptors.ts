import type { ISODateString } from '../../types/branded';
import { dateRanges_varigemen } from '../../config/dateRanges';
import { dateBounds, originWhenNarrowed } from './dateBoundsValidators';
import type { DateBoundsSpec } from '../dateBoundsDeclaration';
import { createDateFieldCodec, createIntegerFieldCodec } from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';
import { integerBoundsValidator } from './boundsValidators';
import { digitsRequiredFor } from './fieldLengthLimits';
import { stamdataSkadedatoField } from './stamdataDescriptors';

// Produkt-descriptors for `varigemen`-sektionen (§3.2). To top-level skalarer, ingen samlinger.

const createEmptyVarigeMenSection = (): unknown => ({});

const beregningsdatoBoundsSpec: DateBoundsSpec = {
  min: () => dateRanges_varigemen.beregningsdato.min,
  max: () => dateRanges_varigemen.beregningsdato.max,
  narrowMin: (context) => context.view.readCanonical(stamdataSkadedatoField.bind()),
  special: (context) => {
    const skadedato = context.view.readCanonical(stamdataSkadedatoField.bind());
    return skadedato === undefined || skadedato <= dateRanges_varigemen.beregningsdato.min
      ? undefined
      : { minBoundKind: 'skadedato', minBoundReferenceISO: skadedato };
  },
  origin: originWhenNarrowed(
    'Skadedato og beregningsdatoens satsdækning',
    (context) => {
      const skadedato = context.view.readCanonical(stamdataSkadedatoField.bind());
      return skadedato !== undefined && skadedato > dateRanges_varigemen.beregningsdato.min;
    },
  ),
};

// mengrad persisteres som heltal. 1..120 er en domænegrænse, der afledes som bounds-issue efter settle —
// ikke en codec-parseregel (jf. renteberegning `tillaegstid`). Cifferloftet UDLEDES af maksimum, så 121
// fortsat kan tastes og bliver rødt (§1.2), mens et fjerde ciffer aldrig kommer ind i feltet.
const MENGRAD_MIN = 1;
const MENGRAD_MAX = 120;
export const varigeMenMengradField = defineStructuralField<number | undefined>({
  id: 'varigemen.mengrad',
  template: { section: 'varigemen', path: [], field: 'mengrad' },
  codec: createIntegerFieldCodec({
    allowNegative: false,
    maxDigits: digitsRequiredFor(MENGRAD_MAX),
  }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Méngrad',
  controlKind: 'text',
  createEmptySection: createEmptyVarigeMenSection,
  validators: [integerBoundsValidator('varigemen.mengrad.bounds', MENGRAD_MIN, MENGRAD_MAX)],
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
  ...dateBounds(beregningsdatoBoundsSpec),
});

export const varigeMenFields = catalogFields(varigeMenMengradField, varigeMenBeregningsdatoField);
export const varigeMenCollections = catalogCollections();
