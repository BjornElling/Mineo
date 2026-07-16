import type { Skadestype } from '../../schemas/formSchemas/enumSchemas';
import type { ISODateString } from '../../types/branded';
import {
  createChoiceFieldCodec,
  createDateFieldCodec,
  createOptionalTextFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type { FieldDescriptor } from '../fieldDescriptor';
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

const dateField = (field: string, label: string): FieldDescriptor<ISODateString | undefined> =>
  defineStructuralField<ISODateString | undefined>({
    id: `stamdata.${field}`,
    template: { section: 'stamdata', path: [], field },
    codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyStamdataSection,
  });

export const stamdataJournalnrField = textField('journalnr', 'Journalnr.');
export const stamdataAdvokatField = textField('advokat', 'Advokat');
export const stamdataSagsbehandlerField = textField('sagsbehandler', 'Sagsbehandler');
export const stamdataSkadelidteField = textField('skadelidte', 'Skadelidtes navn');
export const stamdataSkadelidteFodselsdatoField = dateField('skadelidteFodselsdato', 'Fødselsdato');

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
export const stamdataSkadedatoField = dateField('skadedato', 'Skadedato');

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
