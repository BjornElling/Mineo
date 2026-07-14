import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { TillaegstidEnhed } from '../../schemas/formSchemas/enumSchemas';
import type { RentekravRow } from '../../schemas/formSchemas/sections/renteberegningSchemas';
import type { ISODateString } from '../../types/branded';
import { trimWhitespaceEdges } from '../../utils/draftNormalization';
import {
  createAmountFieldCodec,
  createChoiceFieldCodec,
  createDateFieldCodec,
  createIntegerFieldCodec,
} from '../fieldCodecs';
import { defineField, type FieldCodec } from '../fieldDefinition';
import type { CollectionBinding, FieldBinding } from '../fieldCatalog';
import { createStructuralCollectionBinding, createStructuralFieldBinding } from '../structuralBindings';

/**
 * Strukturelle bindinger for `renteberegning`-sektionen: to skalarfelter og samlingen `rentekravRows`
 * med dens rækkefelter. Den tomme sektion har en tom collection (schemaet kræver arrayet, men tillader 0
 * rækker).
 */
const createEmptyRenteberegningSection = (): unknown => ({ rentekravRows: [] });

const RENTE_FOCUS = { route: '/renteberegning', tab: null } as const;

/** Optional fritekst: tom tekst er canonical `undefined`, ikke den tomme streng. */
const optionalTextCodec: FieldCodec<string | undefined> = Object.freeze({
  parseForSettle: (raw) => {
    const trimmed = trimWhitespaceEdges(raw);
    return { status: 'valid', value: trimmed === '' ? undefined : trimmed };
  },
  format: (value) => value ?? '',
  formatForEdit: (value) => value ?? '',
  acceptsInitialKey: (key) => key.length === 1,
});

const beregningsdatoDefinition = defineField<ISODateString | undefined>({
  label: 'Beregningsdato',
  controlKind: 'text',
  focusTarget: RENTE_FOCUS,
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
});

const kommentarerDefinition = defineField<string | undefined>({
  label: 'Kommentarer',
  controlKind: 'text',
  focusTarget: RENTE_FOCUS,
  codec: optionalTextCodec,
});

const belobDefinition = defineField<AmountValue | undefined>({
  label: 'Beløb',
  controlKind: 'text',
  focusTarget: RENTE_FOCUS,
  codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
});

const renterFraDefinition = defineField<ISODateString | undefined>({
  label: 'Renter fra',
  controlKind: 'text',
  focusTarget: RENTE_FOCUS,
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
});

const tillaegstidDefinition = defineField<number | undefined>({
  label: 'Tillægstid',
  controlKind: 'text',
  focusTarget: RENTE_FOCUS,
  codec: createIntegerFieldCodec({ allowNegative: false }),
});

const enhedDefinition = defineField<TillaegstidEnhed | undefined>({
  label: 'Enhed',
  controlKind: 'choice',
  focusTarget: RENTE_FOCUS,
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
