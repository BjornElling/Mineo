import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { TillaegstidEnhed } from '../../schemas/formSchemas/enumSchemas';
import type { RentekravRow } from '../../schemas/formSchemas/sections/renteberegningSchemas';
import type { ISODateString } from '../../types/branded';
import { dateRanges_renteberegning } from '../../config/dateRanges';
import { derivedDateBounds, STATIC_DATE_BOUNDS } from '../../utils/dateRangeErrorMessages';
import { dateBounds } from './dateBoundsValidators';
import type { DateBoundsSpec } from '../dateBoundsDeclaration';
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
import { amountBoundsValidator, integerBoundsValidator } from './boundsValidators';
import { COMMENT_TEXT_MAX_LENGTH } from './fieldLengthLimits';
import { isRentekravRowEmpty } from '../../domain/renteberegning/rowEmpty';

// Produkt-descriptors for `renteberegning`-sektionen (§3.2): to skalarfelter og samlingen
// `rentekravRows` med dens rækkefelter. Den tomme sektion har en tom collection (schemaet kræver arrayet,
// men tillader 0 rækker).

const createEmptyRenteberegningSection = (): unknown => ({ rentekravRows: [] });

const beregningsdatoBoundsSpec: DateBoundsSpec = {
  min: () => dateRanges_renteberegning.renteTil.min,
  max: () => dateRanges_renteberegning.renteTil.max,
  origin: STATIC_DATE_BOUNDS,
};

const renterFraBoundsSpec: DateBoundsSpec = {
  min: () => dateRanges_renteberegning.renteTil.min,
  max: () => dateRanges_renteberegning.renteTil.max,
  // Renter kan ikke løbe fra en dato efter den, der beregnes til.
  narrowMax: (context) => context.view.readCanonical(renteberegningBeregningsdatoField.bind()),
  origin: derivedDateBounds('Beregningsdato'),
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
  ...dateBounds(beregningsdatoBoundsSpec),
});

export const renteberegningKommentarerField = defineStructuralField<string | undefined>({
  id: 'renteberegning.kommentarer',
  template: { section: 'renteberegning', path: [], field: 'kommentarer' },
  codec: createOptionalTextFieldCodec({ maxLength: COMMENT_TEXT_MAX_LENGTH, preservesLineBreaks: true }),
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
  isEntityEmpty: (row) => isRentekravRowEmpty(row),
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
  ...dateBounds(renterFraBoundsSpec),
});

export const rentekravTillaegstidField = defineStructuralField<number | undefined>({
  id: 'renteberegning.rentekravRows.tillaegstid',
  template: rowTemplate('tillaegstid'),
  // Den samme to-cifferpolitik skal bruges af codec, formular/grid-admission og paste. Bounds-validatoren
  // ejer talintervallet; codecets maxDigits ejer den repræsenterbare brugerindtastning.
  codec: createIntegerFieldCodec({ allowNegative: false, maxDigits: 2 }),
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
