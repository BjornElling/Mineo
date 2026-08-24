import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { TillaegstidEnhed } from '../../schemas/formSchemas/enumSchemas';
import type { RentekravRow } from '../../schemas/formSchemas/sections/renteberegningSchemas';
import type { ISODateString } from '../../types/branded';
import { dateRanges_renteberegning } from '../../config/dateRanges';
import { derivedDateBounds, STATIC_DATE_BOUNDS } from '../../utils/dateRangeErrorMessages';
import { formatISOToDanish } from '../../utils/dateFormatting';
import { dateBounds } from './dateBoundsValidators';
import type { DateBoundsSpec } from '../dateBoundsDeclaration';
import type { FieldValidator } from '../fieldDescriptor';
import {
  createAmountFieldCodec,
  createDateFieldCodec,
  createIntegerFieldCodec,
  createOptionalTextFieldCodec,
  createRequiredChoiceFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import { createCollectionRef, entityIdForCollection, type CollectionRef } from '../fieldAddress';
import { defineStructuralCollection, defineStructuralField, isUndefined } from '../structuralDescriptors';
import { amountBoundsValidator, integerBoundsValidator } from './boundsValidators';
import { COMMENT_TEXT_MAX_LENGTH } from './fieldLengthLimits';
import { isRentekravRowEmpty } from '../../domain/renteberegning/rowEmpty';
import { calculateInterestDate } from '../../domain/renteberegning/rentekravValidation';

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
  // Beskeden navngiver kilden, så snart skærpelsen faktisk er aktiv. Uden den stod fejlen enten uden
  // afsender («Dato skal være mellem … og 30-06-2026») eller tilskrev grænsen kalenderen, når
  // beregningsdatoen tilfældigvis var dags dato (BB-043).
  special: (context) => {
    const beregningsdato = context.view.readCanonical(renteberegningBeregningsdatoField.bind());
    return beregningsdato === undefined
      ? undefined
      : { maxBoundKind: 'efterFelt', maxBoundFieldLabel: 'beregningsdatoen', maxBoundReferenceISO: beregningsdato };
  },
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

/**
 * Et rentekrav på 0 kr. er ikke et beløb, der kan påløbe rente.
 *
 * Feltets nedre grænse var erklæret som 0 (den fælles beløbsregel: ikke-negativ), mens
 * `validateInterestCalculation` kræver `> 0`. De to var uenige, og uenigheden ramte brugeren som en
 * tavs blokering: `0` blev canonical og grønt, rækken mistede sin beregning, og hele sidens
 * download blev grå med «Indtastning mangler» – også for de øvrige, gyldige rækker (BB-038).
 *
 * Reglen står her frem for som en skarpere `amountBoundsValidator`-grænse, fordi grænsen er
 * EKSKLUSIV: den fælles bounds-besked («Værdi skal være 0 eller højere») kan kun udtrykke
 * inklusive grænser og ville påstå, at 0 er tilladt. `reason: 'rule'` giver samtidig den ordrette
 * tooltip (`REASONS_WITH_SPECIFIC_TOOLTIP`), så brugeren læser årsagen ved det felt, der skal rettes.
 */
const rentekravBelobPositiveValidator: FieldValidator<AmountValue | undefined> = (value) => {
  if (value?.value === undefined || value.value !== 0) return undefined;
  return {
    reason: 'rule',
    code: 'renteberegning.rentekravRows.belob.positive',
    message: 'Beløbet skal være større end 0 kr.',
  };
};

export const rentekravBelobField = defineStructuralField<AmountValue | undefined>({
  id: 'renteberegning.rentekravRows.belob',
  template: rowTemplate('belob'),
  codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Beløb',
  controlKind: 'text',
  createEmptySection: createEmptyRenteberegningSection,
  // Nulreglen FØRST: den er den mest konkrete besked, og §1.8 viser højst ét issue pr. felt.
  validators: [
    rentekravBelobPositiveValidator,
    amountBoundsValidator('renteberegning.rentekravRows.belob.bounds', 0, undefined),
  ],
});

export const rentekravRenterFraField = defineStructuralField<ISODateString | undefined>({
  id: 'renteberegning.rentekravRows.renterFra',
  template: rowTemplate('renterFra'),
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Forfaldsdato',
  controlKind: 'text',
  createEmptySection: createEmptyRenteberegningSection,
  ...dateBounds(renterFraBoundsSpec),
});

/**
 * Tillægstiden må ikke skubbe rækkens rentedato forbi beregningsdatoen.
 *
 * Rentedatoen er «Forfaldsdato» + tillægstid i den valgte enhed, og den er den dato, renten løber FRA.
 * Ligger den efter beregningsdatoen, findes der ingen renteperiode, og `validateInterestCalculation`
 * afviser rækken med `INVALID_DATE_ORDER`. Den afvisning nåede aldrig brugeren: motoren kaster fejlen
 * væk, rækkens «Beregnet rente» blev bare `-`, rækkens downloadikon forsvandt, og hele sidens
 * download blev grå – uden ét rødt felt og uden besked nogen steder (BB-037).
 *
 * Reglen ligger på TILLÆGSTID, fordi det er det felt, der flyttede datoen. «Forfaldsdato» har allerede
 * sin egen grænse mod beregningsdatoen (`renterFraBoundsSpec`), så en tillægstid er den eneste vej
 * til den umulige kombination – og dermed det felt, brugeren skal rette.
 *
 * Beskeden navngiver den senest mulige rentedato frem for et maksimalt antal enheder: tallet, brugeren
 * skal ramme, afhænger af enheden, mens datoen er den samme grænse uanset enhed – og det er den, der
 * gør det klart, hvorfor rækken ikke kan regnes.
 */
const rentekravRentedatoValidator: FieldValidator<number | undefined> = (value, field, view) => {
  if (value === undefined || value <= 0) return undefined;
  const rowId = entityIdForCollection(field.address, 'rentekravRows', field.descriptor.id);
  const renterFra = view.readCanonical(rentekravRenterFraField.bind(rowId));
  const beregningsdato = view.readCanonical(renteberegningBeregningsdatoField.bind());
  // Uden begge datoer findes grænsen ikke endnu. De to felter bærer selv deres egne fejl.
  if (renterFra === undefined || beregningsdato === undefined) return undefined;
  const enhed = view.readCanonical(rentekravEnhedField.bind(rowId)) ?? 'dage';

  const rentedato = calculateInterestDate({ kravetDato: renterFra, tillaegstid: value, enhed });
  if (!rentedato.success || rentedato.value <= beregningsdato) return undefined;
  return {
    reason: 'rule',
    code: 'renteberegning.rentekravRows.tillaegstid.rentedato',
    message: `Beregnet rentedato kan senest være ${formatISOToDanish(beregningsdato)}`,
    detail: { rentedato: rentedato.value, beregningsdato },
  };
};

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
  // Talintervallet FØRST: en tillægstid uden for 0–99 er den mere grundlæggende fejl, og §1.8 viser
  // højst ét issue pr. felt.
  validators: [
    integerBoundsValidator('renteberegning.rentekravRows.tillaegstid.bounds', 0, 99),
    rentekravRentedatoValidator,
  ],
});

// `enhed` er en required enum med canonical default `'dage'` (rowEmpty.ts) – aldrig tom, aldrig rød.
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
