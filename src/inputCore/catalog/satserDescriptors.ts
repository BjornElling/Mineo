import { satserAngivAarYearBounds } from '../../data/lovbestemteRates';
import { createYearFieldCodec } from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';

// Greenfield produkt-descriptors for `satser`-sektionen (§3.2). Kun det valgte satsår er sagsinput.
// Den tomme sektion er `{}` (aargang er optional i schemaet).

const createEmptySatserSection = (): unknown => ({});

export const satserAargangField = defineStructuralField<number | undefined>({
  id: 'satser.aargang',
  template: { section: 'satser', path: [], field: 'aargang' },
  // Satsårets faste feltinterval er en commit-grænse; værdier udenfor bevares som rejected rå tekst.
  codec: createYearFieldCodec({
    twoDigitYearPolicy: 'infer',
    minYear: satserAngivAarYearBounds.minYear,
    maxYear: satserAngivAarYearBounds.maxYear,
  }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Satsår',
  controlKind: 'text',
  createEmptySection: createEmptySatserSection,
});

export const satserFields = catalogFields(satserAargangField);
export const satserCollections = catalogCollections();
