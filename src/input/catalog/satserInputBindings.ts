import { satserAngivAarYearBounds } from '../../data/lovbestemteRates';
import { createYearFieldCodec } from '../fieldCodecs';
import { defineField } from '../fieldDefinition';
import { createStructuralFieldBinding } from '../structuralBindings';
import type { FieldBinding } from '../fieldCatalog';

/**
 * Strukturelle bindinger for `satser`-sektionen. Kun det valgte satsår er sagsinput.
 * Den tomme sektion er `{}` (aargang er optional i schemaet).
 */
const createEmptySatserSection = (): unknown => ({});

const aargangDefinition = defineField<number | undefined>({
  label: 'Satsår',
  controlKind: 'text',
  focusTarget: { route: '/satser', tab: null },
  // Årintervallet er et afledt bounds-issue; codecet afgør kun canonical parsebarhed.
  codec: createYearFieldCodec({
    twoDigitYearPolicy: 'infer',
    minYear: satserAngivAarYearBounds.minYear,
    maxYear: satserAngivAarYearBounds.maxYear,
  }),
});

export const satserAargangBinding: FieldBinding<number | undefined> = createStructuralFieldBinding({
  definition: aargangDefinition,
  template: { section: 'satser', path: [], field: 'aargang' },
  createEmptySection: createEmptySatserSection,
});
