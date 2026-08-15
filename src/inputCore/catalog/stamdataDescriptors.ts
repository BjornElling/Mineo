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
import type { ContextualLabelRule, FieldDescriptor, FieldValidator } from '../fieldDescriptor';
import {
  SKADESTYPE_DATO_LABEL_DEFAULT,
  resolveSkadestypeDatoLabel,
} from '../../domain/policies/stamdataCalculations';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';
import { SHORT_TEXT_MAX_LENGTH } from './fieldLengthLimits';

// Produkt-descriptors for `stamdata`-sektionen (§3.2). Alle felter er top-level skalarer; ingen
// samlinger. Den tomme sektion er `{}` (alle felter optional).

const createEmptyStamdataSection = (): unknown => ({});

const textField = (field: string, label: string): FieldDescriptor<string | undefined> =>
  defineStructuralField<string | undefined>({
    id: `stamdata.${field}`,
    template: { section: 'stamdata', path: [], field },
    codec: createOptionalTextFieldCodec({ maxLength: SHORT_TEXT_MAX_LENGTH }),
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
  }>,
  contextualLabel?: ContextualLabelRule
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
    ...(contextualLabel === undefined ? {} : { contextualLabel }),
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

/**
 * Feltets navn er KONTEKSTUELT (§3.2a): «Skadedato» ved Arbejdsulykke og ukendt skadestype,
 * «Anmeldelsesdato» ved Erhvervssygdom. Reglen er erklæret HER — på feltet — så både den synlige label og
 * enhver besked om feltet navngiver det ens.
 *
 * Selve navnevalget er en domæneregel og bliver derfor læst fra `resolveSkadestypeDatoLabel`, ikke skrevet
 * som en ternary her: alle kanaler (UI, beskeder, PDF, EO-rækker) skal dele præcis det ene navnevalg.
 */
export const stamdataSkadedatoField = dateField('skadedato', SKADESTYPE_DATO_LABEL_DEFAULT, dateBounds({
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
}), (view) => resolveSkadestypeDatoLabel(view.readCanonical(stamdataSkadestypeField.bind())));

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
