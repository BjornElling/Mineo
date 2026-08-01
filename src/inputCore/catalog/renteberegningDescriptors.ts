import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { TillaegstidEnhed } from '../../schemas/formSchemas/enumSchemas';
import type { RentekravRow } from '../../schemas/formSchemas/sections/renteberegningSchemas';
import type { ISODateString } from '../../types/branded';
import { dateRanges_renteberegning } from '../../config/dateRanges';
import { resolveDateRangeErrorMessage, derivedDateBounds, STATIC_DATE_BOUNDS } from '../../utils/dateRangeErrorMessages';
import { minISO } from '../../utils/isoDateHelpers';
import {
  createAmountFieldCodec,
  createDateFieldCodec,
  createIntegerFieldCodec,
  createOptionalTextFieldCodec,
  createRequiredChoiceFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import { createCollectionRef, type CollectionRef } from '../fieldAddress';
import { defineStructuralCollection, defineStructuralField, isUndefined } from '../structuralDescriptors';
import type { FieldValidator } from '../fieldDescriptor';
import { amountBoundsValidator, integerBoundsValidator } from './boundsValidators';

// Produkt-descriptors for `renteberegning`-sektionen (§3.2): to skalarfelter og samlingen
// `rentekravRows` med dens rækkefelter. Den tomme sektion har en tom collection (schemaet kræver arrayet,
// men tillader 0 rækker).

const createEmptyRenteberegningSection = (): unknown => ({ rentekravRows: [] });

const beregningsdatoBoundsValidator: FieldValidator<ISODateString | undefined> = (value) => {
  if (value === undefined) return undefined;
  const { min, max } = dateRanges_renteberegning.renteTil;
  if (value >= min && value <= max) return undefined;
  return {
    reason: 'bounds',
    code: 'renteberegning.beregningsdato.bounds',
    message: resolveDateRangeErrorMessage({ iso: value, minDate: min, maxDate: max, bounds: STATIC_DATE_BOUNDS }),
    detail: { minDate: min, maxDate: max },
  };
};

const renterFraBoundsValidator: FieldValidator<ISODateString | undefined> = (value, _field, view) => {
  if (value === undefined) return undefined;
  const minDate = dateRanges_renteberegning.renteTil.min;
  const standardMax = dateRanges_renteberegning.renteTil.max;
  const beregningsdato = view.readCanonical(renteberegningBeregningsdatoField.bind());
  const maxDate = beregningsdato === undefined ? standardMax : minISO(beregningsdato, standardMax);
  if (value >= minDate && value <= maxDate) return undefined;
  return {
    reason: 'bounds',
    code: 'renteberegning.rentekravRows.renterFra.bounds',
    message: resolveDateRangeErrorMessage({
      iso: value,
      minDate,
      maxDate,
      bounds: derivedDateBounds('Beregningsdato'),
    }),
    detail: { minDate, maxDate },
  };
};

export const renteberegningBeregningsdatoField = defineStructuralField<ISODateString | undefined>({
  id: 'renteberegning.beregningsdato',
  template: { section: 'renteberegning', path: [], field: 'beregningsdato' },
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Beregningsdato',
  controlKind: 'text',
  createEmptySection: createEmptyRenteberegningSection,
  validators: [beregningsdatoBoundsValidator],
});

export const renteberegningKommentarerField = defineStructuralField<string | undefined>({
  id: 'renteberegning.kommentarer',
  template: { section: 'renteberegning', path: [], field: 'kommentarer' },
  codec: createOptionalTextFieldCodec(),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Kommentarer',
  controlKind: 'text',
  createEmptySection: createEmptyRenteberegningSection,
});

export const rentekravRowsCollection = defineStructuralCollection<RentekravRow>({
  id: 'renteberegning.rentekravRows',
  template: { section: 'renteberegning', path: [], collection: 'rentekravRows' },
  createEmptySection: createEmptyRenteberegningSection,
});

/** Den kanoniske CollectionRef for rentekrav-rækkerne (top-level collection, ingen entity-parent). */
export const rentekravRowsCollectionRef: CollectionRef = createCollectionRef({
  section: 'renteberegning',
  path: [],
  collection: 'rentekravRows',
});

const rowTemplate = (field: string) => ({
  section: 'renteberegning' as const,
  path: [{ kind: 'entity' as const, collection: 'rentekravRows' }],
  field,
});

export const rentekravBelobField = defineStructuralField<AmountValue | undefined>({
  id: 'renteberegning.rentekravRows.belob',
  template: rowTemplate('belob'),
  codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Beløb',
  controlKind: 'text',
  createEmptySection: createEmptyRenteberegningSection,
  validators: [amountBoundsValidator('renteberegning.rentekravRows.belob.bounds', 0, undefined)],
});

export const rentekravRenterFraField = defineStructuralField<ISODateString | undefined>({
  id: 'renteberegning.rentekravRows.renterFra',
  template: rowTemplate('renterFra'),
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Renter fra',
  controlKind: 'text',
  createEmptySection: createEmptyRenteberegningSection,
  validators: [renterFraBoundsValidator],
});

/** Den synlige heltalsform er 0–99; normal tastning begrænses derfor til to cifre. */
export const RENTEKRAV_TILLAEGSTID_MAX_DRAFT_LENGTH = 2;

export const rentekravTillaegstidField = defineStructuralField<number | undefined>({
  id: 'renteberegning.rentekravRows.tillaegstid',
  template: rowTemplate('tillaegstid'),
  codec: createIntegerFieldCodec({ allowNegative: false }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Tillægstid',
  controlKind: 'text',
  createEmptySection: createEmptyRenteberegningSection,
  validators: [integerBoundsValidator('renteberegning.rentekravRows.tillaegstid.bounds', 0, 99)],
});

// `enhed` er en required enum med canonical default `'dage'` (rowEmpty.ts) — aldrig tom, aldrig rød.
export const rentekravEnhedField = defineStructuralField<TillaegstidEnhed>({
  id: 'renteberegning.rentekravRows.enhed',
  template: rowTemplate('enhed'),
  codec: createRequiredChoiceFieldCodec<TillaegstidEnhed>(['dage', 'uger', 'maaneder'], 'dage'),
  emptyValue: 'dage',
  isEmpty: () => false,
  label: 'Enhed',
  controlKind: 'choice',
  createEmptySection: createEmptyRenteberegningSection,
});

export const renteberegningFields = catalogFields(
  renteberegningBeregningsdatoField,
  renteberegningKommentarerField,
  rentekravBelobField,
  rentekravRenterFraField,
  rentekravTillaegstidField,
  rentekravEnhedField,
);
export const renteberegningCollections = catalogCollections(rentekravRowsCollection);
