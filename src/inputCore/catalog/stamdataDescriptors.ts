import type { Skadestype } from '../../schemas/formSchemas/enumSchemas';
import type { ISODateString } from '../../types/branded';
import { dateRanges_skadelidteFodselsdato, dateRanges_stamdata } from '../../config/dateRanges';
import { maxISO, minISO } from '../../utils/isoDateHelpers';
import { resolveDateRangeErrorMessage } from '../../utils/dateRangeErrorMessages';
import {
  createChoiceFieldCodec,
  createDateFieldCodec,
  createOptionalTextFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type { FieldDescriptor, FieldValidator } from '../fieldDescriptor';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';

// Greenfield produkt-descriptors for `stamdata`-sektionen (§3.2). Alle felter er top-level skalarer; ingen
// samlinger. Den tomme sektion er `{}` (alle felter optional).

const createEmptyStamdataSection = (): unknown => ({});

const textField = (field: string, label: string): FieldDescriptor<string | undefined> =>
  defineStructuralField<string | undefined>({
    id: `stamdata.${field}`,
    template: { section: 'stamdata', path: [], field },
    codec: createOptionalTextFieldCodec(),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyStamdataSection,
  });

const dateField = (
  field: string,
  label: string,
  validators?: readonly FieldValidator<ISODateString | undefined>[]
): FieldDescriptor<ISODateString | undefined> =>
  defineStructuralField<ISODateString | undefined>({
    id: `stamdata.${field}`,
    template: { section: 'stamdata', path: [], field },
    codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyStamdataSection,
    ...(validators === undefined ? {} : { validators }),
  });

export const stamdataJournalnrField = textField('journalnr', 'Journalnr.');
export const stamdataAdvokatField = textField('advokat', 'Advokat');
export const stamdataSagsbehandlerField = textField('sagsbehandler', 'Sagsbehandler');
export const stamdataSkadelidteField = textField('skadelidte', 'Skadelidtes navn');
export const stamdataSkadelidteFodselsdatoField = dateField('skadelidteFodselsdato', 'Fødselsdato', [
  (value, _field, view) => {
    const skadedato = view.readCanonical(stamdataSkadedatoField.bind());
    if (value === undefined) return undefined;
    const minDate = dateRanges_skadelidteFodselsdato.min;
    const maxDate = skadedato === undefined
      ? dateRanges_skadelidteFodselsdato.max
      : minISO(dateRanges_skadelidteFodselsdato.max, skadedato);
    if (value >= minDate && value <= maxDate) return undefined;
    return {
      reason: 'bounds',
      code: 'stamdata.skadelidteFodselsdato.bounds',
      message: resolveDateRangeErrorMessage({
        iso: value,
        minDate,
        maxDate,
        special: skadedato === undefined
          ? undefined
          : { maxBoundKind: 'skadedato', maxBoundReferenceISO: skadedato },
        noValidRangeInputs: 'Fødselsdato og Skadedato',
      }),
      detail: { minDate, maxDate },
    };
  },
]);

export const stamdataSkadestypeField = defineStructuralField<Skadestype | undefined>({
  id: 'stamdata.skadestype',
  template: { section: 'stamdata', path: [], field: 'skadestype' },
  codec: createChoiceFieldCodec<Skadestype>(['Arbejdsulykke', 'Erhvervssygdom']),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Skadestype',
  controlKind: 'choice',
  createEmptySection: createEmptyStamdataSection,
});

// Feltets brugervendte label er dynamisk i UI'et; feltdefinitionens label er den kanoniske betegnelse.
export const stamdataSkadedatoField = dateField('skadedato', 'Skadedato', [
  (value, _field, view) => {
    const foedselsdato = view.readCanonical(stamdataSkadelidteFodselsdatoField.bind());
    if (value === undefined) return undefined;
    const minDate = foedselsdato === undefined
      ? dateRanges_stamdata.skadedato.min
      : maxISO(dateRanges_stamdata.skadedato.min, foedselsdato);
    const maxDate = dateRanges_stamdata.skadedato.max;
    if (value >= minDate && value <= maxDate) return undefined;
    return {
      reason: 'bounds',
      code: 'stamdata.skadedato.bounds',
      message: resolveDateRangeErrorMessage({
        iso: value,
        minDate,
        maxDate,
        special: foedselsdato === undefined
          ? undefined
          : { minBoundKind: 'fodselsdato', minBoundReferenceISO: foedselsdato },
        noValidRangeInputs: 'Fødselsdato og Skadedato',
      }),
      detail: { minDate, maxDate },
    };
  },
]);

export const stamdataFields = catalogFields(
  stamdataJournalnrField,
  stamdataAdvokatField,
  stamdataSagsbehandlerField,
  stamdataSkadelidteField,
  stamdataSkadelidteFodselsdatoField,
  stamdataSkadestypeField,
  stamdataSkadedatoField,
);
export const stamdataCollections = catalogCollections();
