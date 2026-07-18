import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { TillaegstidEnhed } from '../../schemas/formSchemas/enumSchemas';
import type { RentekravRow } from '../../schemas/formSchemas/sections/renteberegningSchemas';
import type { ISODateString } from '../../types/branded';
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

// Greenfield produkt-descriptors for `renteberegning`-sektionen (§3.2): to skalarfelter og samlingen
// `rentekravRows` med dens rækkefelter. Den tomme sektion har en tom collection (schemaet kræver arrayet,
// men tillader 0 rækker).

const createEmptyRenteberegningSection = (): unknown => ({ rentekravRows: [] });

export const renteberegningBeregningsdatoField = defineStructuralField<ISODateString | undefined>({
  id: 'renteberegning.beregningsdato',
  template: { section: 'renteberegning', path: [], field: 'beregningsdato' },
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Beregningsdato',
  controlKind: 'text',
  createEmptySection: createEmptyRenteberegningSection,
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
});

export const rentekravTillaegstidField = defineStructuralField<number | undefined>({
  id: 'renteberegning.rentekravRows.tillaegstid',
  template: rowTemplate('tillaegstid'),
  codec: createIntegerFieldCodec({ allowNegative: false }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Tillægstid',
  controlKind: 'text',
  createEmptySection: createEmptyRenteberegningSection,
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
