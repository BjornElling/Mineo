import type { Koen } from '../../schemas/formSchemas/enumSchemas';
import type { ISODateString } from '../../types/branded';
import {
  createChoiceFieldCodec,
  createDateFieldCodec,
  createIntegerFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type { FieldDescriptor } from '../fieldDescriptor';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';

// Greenfield produkt-descriptors for `forsoergertab`-sektionen (§3.2). Kun top-level skalarer.

const createEmptyForsoergertabSection = (): unknown => ({});

const dateField = (field: string, label: string): FieldDescriptor<ISODateString | undefined> =>
  defineStructuralField<ISODateString | undefined>({
    id: `forsoergertab.${field}`,
    template: { section: 'forsoergertab', path: [], field },
    codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyForsoergertabSection,
  });

export const forsoergertabEfterladteFodselsdatoField = dateField('efterladteFodselsdato', 'Efterladte ægtefælle/samlevers fødselsdato');
export const forsoergertabBeregningsdatoField = dateField('beregningsdato', 'Beregningsdato');
export const forsoergertabVirkningsdatoField = dateField('virkningsdato', 'Startdato for ASL-ydelse');

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
});

export const forsoergertabFields = catalogFields(
  forsoergertabEfterladteFodselsdatoField,
  forsoergertabBeregningsdatoField,
  forsoergertabVirkningsdatoField,
  forsoergertabKoenField,
  forsoergertabTilkendtForPeriodeAarField,
);
export const forsoergertabCollections = catalogCollections();
