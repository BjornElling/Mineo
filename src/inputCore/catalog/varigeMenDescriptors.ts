import type { ISODateString } from '../../types/branded';
import { dateRanges_varigemen } from '../../config/dateRanges';
import { derivedDateBounds, resolveDateRangeErrorMessage, STATIC_DATE_BOUNDS } from '../../utils/dateRangeErrorMessages';
import { maxISO } from '../../utils/isoDateHelpers';
import { createDateFieldCodec, createIntegerFieldCodec } from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';
import type { FieldValidator } from '../fieldDescriptor';
import { integerBoundsValidator } from './boundsValidators';
import { stamdataSkadedatoField } from './stamdataDescriptors';

// Produkt-descriptors for `varigemen`-sektionen (§3.2). To top-level skalarer, ingen samlinger.

const createEmptyVarigeMenSection = (): unknown => ({});

const beregningsdatoBoundsValidator: FieldValidator<ISODateString | undefined> = (value, _field, view) => {
  if (value === undefined) return undefined;
  const staticRange = dateRanges_varigemen.beregningsdato;
  const skadedato = view.readCanonical(stamdataSkadedatoField.bind());
  const min = skadedato === undefined ? staticRange.min : maxISO(staticRange.min, skadedato);
  const max = staticRange.max;
  if (value >= min && value <= max) return undefined;
  return {
    reason: 'bounds',
    code: 'varigemen.beregningsdato.bounds',
    message: resolveDateRangeErrorMessage({
      iso: value,
      minDate: min,
      maxDate: max,
      bounds: skadedato === undefined
        ? STATIC_DATE_BOUNDS
        : derivedDateBounds('Skadedato og beregningsdatoens satsdækning'),
      ...(skadedato === undefined ? {} : {
        special: { minBoundKind: 'skadedato' as const, minBoundReferenceISO: skadedato },
      }),
    }),
    detail: { minDate: min, maxDate: max },
  };
};

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
  validators: [integerBoundsValidator('varigemen.mengrad.bounds', 1, 120)],
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
  validators: [beregningsdatoBoundsValidator],
});

export const varigeMenFields = catalogFields(varigeMenMengradField, varigeMenBeregningsdatoField);
export const varigeMenCollections = catalogCollections();
