import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { createAmountFieldCodec } from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type { FieldDescriptor } from '../fieldDescriptor';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';
import { amountBoundsValidator } from './boundsValidators';

// Greenfield produkt-descriptors for `faellesAarsloen`-sektionen (ASL/EAL-årsløn, §3.2). Sektionen har ingen
// egen route; den redigeres i flere domænekontekster (EET, Forsørgertab, EO). Beløbene er heltal med et hårdt
// gulv på 1000 og loft på 9999999 — nu en afledt canonical bounds-feltvalidator (§1.6), ikke en codec-afvisning.
// En værdi under gulvet committes canonical med et rødt bounds-issue og kan gemmes i `.eo`. Fortegn ikke tilladt.

const createEmptyFaellesAarsloenSection = (): unknown => ({});

const AMOUNT_MIN = 1000;
const AMOUNT_MAX = 9999999;

const amountField = (field: string, label: string): FieldDescriptor<AmountValue | undefined> =>
  defineStructuralField<AmountValue | undefined>({
    id: `faellesAarsloen.${field}`,
    template: { section: 'faellesAarsloen', path: [], field },
    codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: false, minValue: AMOUNT_MIN, maxValue: AMOUNT_MAX }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyFaellesAarsloenSection,
    validators: [amountBoundsValidator(`faellesAarsloen.${field}.bounds`, AMOUNT_MIN, AMOUNT_MAX)],
  });

export const faellesAarsloenAslAarsloenField = amountField('aslAarsloen', 'Årsløn');
export const faellesAarsloenEalAarsloenField = amountField('ealAarsloen', 'Årsløn (hvis forskellig fra ASL)');

export const faellesAarsloenFields = catalogFields(faellesAarsloenAslAarsloenField, faellesAarsloenEalAarsloenField);
export const faellesAarsloenCollections = catalogCollections();
