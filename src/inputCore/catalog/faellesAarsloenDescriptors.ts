import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { createAmountFieldCodec } from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type { FieldDescriptor } from '../fieldDescriptor';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';

// Greenfield produkt-descriptors for `faellesAarsloen`-sektionen (ASL/EAL-årsløn, §3.2). Sektionen har ingen
// egen route; den redigeres i flere domænekontekster (EET, Forsørgertab, EO). Beløbene er heltal med et hårdt
// gulv på 1000 (afledt bounds via codec), fortegn ikke tilladt.

const createEmptyFaellesAarsloenSection = (): unknown => ({});

const amountField = (field: string, label: string): FieldDescriptor<AmountValue | undefined> =>
  defineStructuralField<AmountValue | undefined>({
    id: `faellesAarsloen.${field}`,
    template: { section: 'faellesAarsloen', path: [], field },
    codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: false, minValue: 1000, maxValue: 9999999 }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyFaellesAarsloenSection,
  });

export const faellesAarsloenAslAarsloenField = amountField('aslAarsloen', 'Årsløn');
export const faellesAarsloenEalAarsloenField = amountField('ealAarsloen', 'Årsløn (hvis forskellig fra ASL)');

export const faellesAarsloenFields = catalogFields(faellesAarsloenAslAarsloenField, faellesAarsloenEalAarsloenField);
export const faellesAarsloenCollections = catalogCollections();
