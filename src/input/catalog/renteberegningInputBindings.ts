import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { TillaegstidEnhed } from '../../schemas/formSchemas/enumSchemas';
import type { RentekravRow } from '../../schemas/formSchemas/sections/renteberegningSchemas';
import type { ISODateString } from '../../types/branded';
import {
  createAmountFieldCodec,
  createChoiceFieldCodec,
  createDateFieldCodec,
  createIntegerFieldCodec,
  createOptionalTextFieldCodec,
} from '../fieldCodecs';
import { defineField } from '../fieldDefinition';
import type { CollectionBinding, FieldBinding } from '../fieldCatalog';
import { createStructuralCollectionBinding, createStructuralFieldBinding } from '../structuralBindings';
import { defineInputManifest } from './inputManifest';

/**
 * Strukturelle bindinger for `renteberegning`-sektionen: to skalarfelter og samlingen `rentekravRows`
 * med dens rækkefelter. Den tomme sektion har en tom collection (schemaet kræver arrayet, men tillader 0
 * rækker).
 */
const createEmptyRenteberegningSection = (): unknown => ({ rentekravRows: [] });

const beregningsdatoDefinition = defineField<ISODateString | undefined>({
  label: 'Beregningsdato',
  controlKind: 'text',
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
});

const kommentarerDefinition = defineField<string | undefined>({
  label: 'Kommentarer',
  controlKind: 'text',
  codec: createOptionalTextFieldCodec(),
});

const belobDefinition = defineField<AmountValue | undefined>({
  label: 'Beløb',
  controlKind: 'text',
  codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
});

const renterFraDefinition = defineField<ISODateString | undefined>({
  label: 'Renter fra',
  controlKind: 'text',
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
});

const tillaegstidDefinition = defineField<number | undefined>({
  label: 'Tillægstid',
  controlKind: 'text',
  codec: createIntegerFieldCodec({ allowNegative: false }),
});

const enhedDefinition = defineField<TillaegstidEnhed | undefined>({
  label: 'Enhed',
  controlKind: 'choice',
  codec: createChoiceFieldCodec<TillaegstidEnhed>(['dage', 'uger', 'maaneder']),
});

export const renteberegningBeregningsdatoBinding: FieldBinding<ISODateString | undefined> =
  createStructuralFieldBinding({
    definition: beregningsdatoDefinition,
    template: { section: 'renteberegning', path: [], field: 'beregningsdato' },
    createEmptySection: createEmptyRenteberegningSection,
  });

export const renteberegningKommentarerBinding: FieldBinding<string | undefined> =
  createStructuralFieldBinding({
    definition: kommentarerDefinition,
    template: { section: 'renteberegning', path: [], field: 'kommentarer' },
    createEmptySection: createEmptyRenteberegningSection,
  });

export const rentekravRowsBinding: CollectionBinding<RentekravRow> = createStructuralCollectionBinding<RentekravRow>({
  template: { section: 'renteberegning', path: [], collection: 'rentekravRows' },
  createEmptySection: createEmptyRenteberegningSection,
});

const rentekravRowFieldTemplate = (field: string) => ({
  section: 'renteberegning' as const,
  path: [{ kind: 'entity' as const, collection: 'rentekravRows' }],
  field,
});

export const rentekravBelobBinding: FieldBinding<AmountValue | undefined> = createStructuralFieldBinding({
  definition: belobDefinition,
  template: rentekravRowFieldTemplate('belob'),
  createEmptySection: createEmptyRenteberegningSection,
});

export const rentekravRenterFraBinding: FieldBinding<ISODateString | undefined> = createStructuralFieldBinding({
  definition: renterFraDefinition,
  template: rentekravRowFieldTemplate('renterFra'),
  createEmptySection: createEmptyRenteberegningSection,
});

export const rentekravTillaegstidBinding: FieldBinding<number | undefined> = createStructuralFieldBinding({
  definition: tillaegstidDefinition,
  template: rentekravRowFieldTemplate('tillaegstid'),
  createEmptySection: createEmptyRenteberegningSection,
});

export const rentekravEnhedBinding: FieldBinding<TillaegstidEnhed | undefined> = createStructuralFieldBinding({
  definition: enhedDefinition,
  template: rentekravRowFieldTemplate('enhed'),
  createEmptySection: createEmptyRenteberegningSection,
});

export const renteberegningInputManifest = defineInputManifest({
  id: 'renteberegning',
  fields: [
    renteberegningBeregningsdatoBinding,
    renteberegningKommentarerBinding,
    rentekravBelobBinding,
    rentekravRenterFraBinding,
    rentekravTillaegstidBinding,
    rentekravEnhedBinding,
  ],
  collections: [rentekravRowsBinding],
});
