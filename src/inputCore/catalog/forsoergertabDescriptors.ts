import type { Koen } from '../../schemas/formSchemas/enumSchemas';
import type { ISODateString } from '../../types/branded';
import { dateRanges_forsoergertab } from '../../config/dateRanges';
import { maxISO, minISO } from '../../utils/isoDateHelpers';
import { resolveDateRangeErrorMessage, derivedDateBounds, STATIC_DATE_BOUNDS } from '../../utils/dateRangeErrorMessages';
import {
  createChoiceFieldCodec,
  createDateFieldCodec,
  createIntegerFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type { FieldDescriptor, FieldValidator } from '../fieldDescriptor';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';
import { integerBoundsValidator } from './boundsValidators';
import {
  stamdataSkadedatoField,
} from './stamdataDescriptors';

// Produkt-descriptors for `forsoergertab`-sektionen (§3.2). Kun top-level skalarer.
//
// **Dato-bounds (§1.6, Fase 3 Forsørgertab-slice):** de dynamiske min/max-grænser, som legacy-siden håndhævede
// via `StyledDateField`s `minDate`/`maxDate`-props + `onFieldError`, er nu canonical bounds-FELTVALIDATORER på
// descriptoren. En schema-repræsenterbar dato uden for grænsen committes canonical (kan gemmes i `.eo`) og
// bærer et rødt bounds-issue, som readeren skjuler for afhængige consumers. Grænserne er byte-identiske med
// legacy (samme `dateRanges_forsoergertab` + `resolveDateRangeErrorMessage`), så den røde beskedtekst er
// uændret. Krydsfeltafhængigheder læses via `view.readCanonical` (den raw canonical dependency, uafhængigt af
// dependencyens eget issue — som legacy brugte den rå `values.virkningsdato`/`stamdata.skadedato` til at udlede
// grænsen).

const createEmptyForsoergertabSection = (): unknown => ({});

// Legacy-`skadedatoMin`: `coerceToISODateString(stamdata?.skadedato) ?? fallbackMin`.
const resolveSkadedatoMin = (skadedato: ISODateString | undefined): ISODateString =>
  skadedato ?? dateRanges_forsoergertab.virkningsdato.fallbackMin;

const dateField = (
  field: string,
  label: string,
  validators?: readonly FieldValidator<ISODateString | undefined>[]
): FieldDescriptor<ISODateString | undefined> =>
  defineStructuralField<ISODateString | undefined>({
    id: `forsoergertab.${field}`,
    template: { section: 'forsoergertab', path: [], field },
    codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyForsoergertabSection,
    ...(validators === undefined ? {} : { validators }),
  });

// Efterladtes fødselsdato: statisk 1900-01-01 .. i dag (dateRanges_forsoergertab.efterladteFodselsdato).
export const forsoergertabEfterladteFodselsdatoField = dateField('efterladteFodselsdato', 'Efterladte ægtefælle/samlevers fødselsdato', [
  (value) => {
    if (value === undefined) return undefined;
    const minDate = dateRanges_forsoergertab.efterladteFodselsdato.min;
    const maxDate = dateRanges_forsoergertab.efterladteFodselsdato.max;
    if (value >= minDate && value <= maxDate) return undefined;
    return {
      reason: 'bounds',
      code: 'forsoergertab.efterladteFodselsdato.bounds',
      // Begge grænser er konstanter fra konfigurationen; intervallet kan ikke blive umuligt.
      message: resolveDateRangeErrorMessage({ iso: value, minDate, maxDate, bounds: STATIC_DATE_BOUNDS }),
      detail: { minDate, maxDate },
    };
  },
]);

// Beregningsdato: min = max(skadedatoMin, virkningsdato); max = forsørgertab-datadækning (dataCoverageMax).
// Legacy: `minDate={snapshot.inputBounds.beregningsdatoMin}` / `maxDate=beregningsdato.max`.
export const forsoergertabBeregningsdatoField = dateField('beregningsdato', 'Beregningsdato', [
  (value, _field, view) => {
    if (value === undefined) return undefined;
    const skadedato = view.readCanonical(stamdataSkadedatoField.bind());
    const virkningsdato = view.readCanonical(forsoergertabVirkningsdatoField.bind());
    const skadedatoMin = resolveSkadedatoMin(skadedato);
    const minDate = virkningsdato ? maxISO(skadedatoMin, virkningsdato) : skadedatoMin;
    const maxDate = dateRanges_forsoergertab.beregningsdato.max;
    if (value >= minDate && value <= maxDate) return undefined;
    return {
      reason: 'bounds',
      code: 'forsoergertab.beregningsdato.bounds',
      message: resolveDateRangeErrorMessage({
        iso: value,
        minDate,
        maxDate,
        special: { maxBoundKind: 'dataCoverageMax', maxBoundFieldLabel: 'Beregningsdato' },
        // Min udledes af Skadedato og Startdato for ASL-ydelse; en for sen af dem gør intervallet umuligt.
        bounds: derivedDateBounds('Skadedato og Startdato for ASL-ydelse'),
      }),
      detail: { minDate, maxDate },
    };
  },
]);

// Startdato for ASL-ydelse (virkningsdato): min = skadedatoMin; max = min(dataCoverageMax, beregningsdato).
// Legacy: `minDate={snapshot.inputBounds.skadedatoMin}` / `maxDate={snapshot.inputBounds.virkningsdatoMax}`.
export const forsoergertabVirkningsdatoField = dateField('virkningsdato', 'Startdato for ASL-ydelse', [
  (value, _field, view) => {
    if (value === undefined) return undefined;
    const skadedato = view.readCanonical(stamdataSkadedatoField.bind());
    const beregningsdato = view.readCanonical(forsoergertabBeregningsdatoField.bind());
    const minDate = resolveSkadedatoMin(skadedato);
    const maxCoverage = dateRanges_forsoergertab.virkningsdato.max;
    const maxDate = beregningsdato ? minISO(maxCoverage, beregningsdato) : maxCoverage;
    if (value >= minDate && value <= maxDate) return undefined;
    return {
      reason: 'bounds',
      code: 'forsoergertab.virkningsdato.bounds',
      message: resolveDateRangeErrorMessage({
        iso: value,
        minDate,
        maxDate,
        special: { maxBoundKind: 'dataCoverageMax', maxBoundFieldLabel: 'Virkningsdato' },
        // Min fra Skadedato, max fra Beregningsdato: en Beregningsdato før Skadedato gør intervallet umuligt.
        bounds: derivedDateBounds('Skadedato og Beregningsdato'),
      }),
      detail: { minDate, maxDate },
    };
  },
]);

export const forsoergertabKoenField = defineStructuralField<Koen | undefined>({
  id: 'forsoergertab.koen',
  template: { section: 'forsoergertab', path: [], field: 'koen' },
  codec: createChoiceFieldCodec<Koen>(['Mand', 'Kvinde']),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Køn',
  controlKind: 'choice',
  createEmptySection: createEmptyForsoergertabSection,
});

// 1..10 er en domænegrænse (afledt bounds-issue), ikke en codec-parseregel.
export const forsoergertabTilkendtForPeriodeAarField = defineStructuralField<number | undefined>({
  id: 'forsoergertab.tilkendtForPeriodeAar',
  template: { section: 'forsoergertab', path: [], field: 'tilkendtForPeriodeAar' },
  codec: createIntegerFieldCodec({ allowNegative: false }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Tilkendt for periode',
  controlKind: 'text',
  createEmptySection: createEmptyForsoergertabSection,
  validators: [integerBoundsValidator('forsoergertab.tilkendtForPeriodeAar.bounds', 1, 10)],
});

export const forsoergertabFields = catalogFields(
  forsoergertabEfterladteFodselsdatoField,
  forsoergertabBeregningsdatoField,
  forsoergertabVirkningsdatoField,
  forsoergertabKoenField,
  forsoergertabTilkendtForPeriodeAarField,
);
export const forsoergertabCollections = catalogCollections();
