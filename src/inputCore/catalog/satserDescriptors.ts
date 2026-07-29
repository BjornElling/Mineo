import { satserAngivAarYearBounds } from '../../data/lovbestemteRates';
import { createYearFieldCodec } from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';
import { yearBoundsValidator } from './boundsValidators';

// Produkt-descriptors for `satser`-sektionen (§3.2). Kun det valgte satsår er sagsinput.
// Den tomme sektion er `{}` (aargang er optional i schemaet).

const createEmptySatserSection = (): unknown => ({});

export const satserAargangField = defineStructuralField<number | undefined>({
  id: 'satser.aargang',
  template: { section: 'satser', path: [], field: 'aargang' },
  // Et velformet satsår uden for [minYear, maxYear] committes canonical og bærer et afledt bounds-issue (§1.6);
  // det blokerer satser-projektionen som rødt feltissue, men kan gemmes i `.eo`. Kun ikke-parsebart format er rejected.
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
  validators: [yearBoundsValidator(
    'satser.aargang.bounds',
    satserAngivAarYearBounds.minYear,
    satserAngivAarYearBounds.maxYear
  )],
});

export const satserFields = catalogFields(satserAargangField);
export const satserCollections = catalogCollections();
