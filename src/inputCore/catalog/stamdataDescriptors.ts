import type { Skadestype } from '../../schemas/formSchemas/enumSchemas';
import type { ISODateString } from '../../types/branded';
import { dateRanges_skadelidteFodselsdato, dateRanges_stamdata } from '../../config/dateRanges';
import { derivedDateBounds } from '../../utils/dateRangeErrorMessages';
import { dateBounds } from './dateBoundsValidators';
import type { DateBoundsSpec } from '../dateBoundsDeclaration';
import {
  createChoiceFieldCodec,
  createDateFieldCodec,
  createOptionalTextFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type { FieldDescriptor, FieldValidator } from '../fieldDescriptor';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';

// Produkt-descriptors for `stamdata`-sektionen (§3.2). Alle felter er top-level skalarer; ingen
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

/** Grænserne er PÅKRÆVEDE og leveres som en `dateBounds(...)`-spredning (erklæring + validator i ét). */
const dateField = (
  field: string,
  label: string,
  bounds: Readonly<{
    dateBounds: DateBoundsSpec;
    validators: readonly FieldValidator<ISODateString | undefined>[];
  }>
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
    ...bounds,
  });

export const stamdataJournalnrField = textField('journalnr', 'Journalnr.');
export const stamdataAdvokatField = textField('advokat', 'Advokat');
export const stamdataSagsbehandlerField = textField('sagsbehandler', 'Sagsbehandler');
export const stamdataSkadelidteField = textField('skadelidte', 'Skadelidtes navn');
export const stamdataSkadelidteFodselsdatoField = dateField('skadelidteFodselsdato', 'Fødselsdato', dateBounds({
  min: () => dateRanges_skadelidteFodselsdato.min,
  max: () => dateRanges_skadelidteFodselsdato.max,
  // Skadedatoen kan kun SÆNKE loftet: man kan ikke være født efter sin egen skade.
  narrowMax: (context) => context.view.readCanonical(stamdataSkadedatoField.bind()),
  special: (context) => {
    const skadedato = context.view.readCanonical(stamdataSkadedatoField.bind());
    return skadedato === undefined || skadedato >= dateRanges_skadelidteFodselsdato.max
      ? undefined
      : { maxBoundKind: 'skadedato', maxBoundReferenceISO: skadedato };
  },
  origin: derivedDateBounds('Fødselsdato og Skadedato'),
}));

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
export const stamdataSkadedatoField = dateField('skadedato', 'Skadedato', dateBounds({
  min: () => dateRanges_stamdata.skadedato.min,
  max: () => dateRanges_stamdata.skadedato.max,
  // Fødselsdatoen kan kun HÆVE gulvet: skaden kan ikke ligge før fødslen.
  narrowMin: (context) => context.view.readCanonical(stamdataSkadelidteFodselsdatoField.bind()),
  special: (context) => {
    const foedselsdato = context.view.readCanonical(stamdataSkadelidteFodselsdatoField.bind());
    return foedselsdato === undefined || foedselsdato <= dateRanges_stamdata.skadedato.min
      ? undefined
      : { minBoundKind: 'fodselsdato', minBoundReferenceISO: foedselsdato };
  },
  origin: derivedDateBounds('Fødselsdato og Skadedato'),
}));

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
