import type { Skadestype } from '../../schemas/formSchemas/enumSchemas';
import type { ISODateString } from '../../types/branded';
import {
  createChoiceFieldCodec,
  createDateFieldCodec,
  createOptionalTextFieldCodec,
} from '../fieldCodecs';
import { defineField } from '../fieldDefinition';
import type { FieldBinding } from '../fieldCatalog';
import { createStructuralFieldBinding } from '../structuralBindings';
import { defineInputManifest } from './inputManifest';

/**
 * Strukturelle bindinger for `stamdata`-sektionen. Alle felter er top-level skalarer; sektionen har
 * ingen samlinger. Den tomme sektion er `{}` (alle felter optional).
 */
const createEmptyStamdataSection = (): unknown => ({});

const textField = (field: string, label: string): FieldBinding<string | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<string | undefined>({
      label,
      controlKind: 'text',
      codec: createOptionalTextFieldCodec(),
    }),
    template: { section: 'stamdata', path: [], field },
    createEmptySection: createEmptyStamdataSection,
  });

export const stamdataJournalnrBinding = textField('journalnr', 'Journalnr.');
export const stamdataAdvokatBinding = textField('advokat', 'Advokat');
export const stamdataSagsbehandlerBinding = textField('sagsbehandler', 'Sagsbehandler');
export const stamdataSkadelidteBinding = textField('skadelidte', 'Skadelidtes navn');

export const stamdataSkadelidteFodselsdatoBinding: FieldBinding<ISODateString | undefined> =
  createStructuralFieldBinding({
    definition: defineField<ISODateString | undefined>({
      label: 'Fødselsdato',
      controlKind: 'text',
      codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    }),
    template: { section: 'stamdata', path: [], field: 'skadelidteFodselsdato' },
    createEmptySection: createEmptyStamdataSection,
  });

export const stamdataSkadestypeBinding: FieldBinding<Skadestype | undefined> =
  createStructuralFieldBinding({
    definition: defineField<Skadestype | undefined>({
      label: 'Skadestype',
      controlKind: 'choice',
      codec: createChoiceFieldCodec<Skadestype>(['Arbejdsulykke', 'Erhvervssygdom']),
    }),
    template: { section: 'stamdata', path: [], field: 'skadestype' },
    createEmptySection: createEmptyStamdataSection,
  });

// Feltets brugervendte label er dynamisk i UI'et ('Skadedato' for arbejdsulykke, 'Anmeldelsesdato'
// for erhvervssygdom). Feltdefinitionens label er den kanoniske, skadestype-uafhængige betegnelse;
// den dynamiske overskrift hører til visningslaget, ikke til feltidentiteten.
export const stamdataSkadedatoBinding: FieldBinding<ISODateString | undefined> =
  createStructuralFieldBinding({
    definition: defineField<ISODateString | undefined>({
      label: 'Skadedato',
      controlKind: 'text',
      codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    }),
    template: { section: 'stamdata', path: [], field: 'skadedato' },
    createEmptySection: createEmptyStamdataSection,
  });

export const stamdataInputManifest = defineInputManifest({
  id: 'stamdata',
  fields: [
    stamdataJournalnrBinding,
    stamdataAdvokatBinding,
    stamdataSagsbehandlerBinding,
    stamdataSkadelidteBinding,
    stamdataSkadelidteFodselsdatoBinding,
    stamdataSkadestypeBinding,
    stamdataSkadedatoBinding,
  ],
  collections: [],
});
