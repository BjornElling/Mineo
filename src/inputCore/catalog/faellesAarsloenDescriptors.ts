import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { createAmountFieldCodec } from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type { CanonicalView, FieldDescriptor, FieldValidator } from '../fieldDescriptor';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';
import { amountBoundsValidator } from './boundsValidators';
import { amountValueToNumber } from '../../utils/expressionAmount';
import {
  resolveAslAarsloensmaksimumForSkadedato,
  validateAslAarsloenBySkadesaarMax,
  validateAslAarsloenDivisibleBy1000,
} from '../../domain/aslEalAarsloen/aarsloenValidators';
import { stamdataSkadedatoField } from './stamdataDescriptors';

// Produkt-descriptors for `faellesAarsloen`-sektionen (ASL/EAL-årsløn, §3.2). Sektionen har ingen
// egen route; den redigeres i flere domænekontekster (EET, Forsørgertab, EO). Beløbene er heltal med et hårdt
// gulv på 1000 og et fallback-loft på 9999999 — altid som en afledt canonical bounds-feltvalidator (§1.6),
// ikke som en codec-afvisning. ASL-feltets loft skærpes til skadesårets kanoniske ASL-maksimum, når skadedatoen findes.
// En værdi under gulvet committes canonical med et rødt bounds-issue og kan gemmes i `.eo`. Fortegn ikke tilladt.

const createEmptyFaellesAarsloenSection = (): unknown => ({});

const AMOUNT_MIN = 1000;
const AMOUNT_MAX = 9999999;

type AmountMaxResolver = (view: CanonicalView) => number;

const amountField = (
  field: string,
  label: string,
  extraValidators: readonly FieldValidator<AmountValue | undefined>[] = [],
  resolveMaxValue: AmountMaxResolver = () => AMOUNT_MAX,
): FieldDescriptor<AmountValue | undefined> =>
  defineStructuralField<AmountValue | undefined>({
    id: `faellesAarsloen.${field}`,
    template: { section: 'faellesAarsloen', path: [], field },
    codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: false, minValue: AMOUNT_MIN, maxValue: AMOUNT_MAX }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyFaellesAarsloenSection,
    validators: [
      (value, fieldRef, view) => amountBoundsValidator(
        `faellesAarsloen.${field}.bounds`,
        AMOUNT_MIN,
        resolveMaxValue(view),
      )(value, fieldRef, view),
      ...extraValidators,
    ],
  });

const resolveAslAarsloenMaxValue = (view: CanonicalView): number => {
  const skadedato = view.readCanonical(stamdataSkadedatoField.bind());
  return resolveAslAarsloensmaksimumForSkadedato(skadedato) ?? AMOUNT_MAX;
};

export const faellesAarsloenAslAarsloenField = amountField('aslAarsloen', 'Årsløn', [
  (value, _field, view) => {
    const message = validateAslAarsloenDivisibleBy1000(amountValueToNumber(value))
      ?? validateAslAarsloenBySkadesaarMax(
        amountValueToNumber(value),
        view.readCanonical(stamdataSkadedatoField.bind())
      );
    return message === undefined
      ? undefined
      : { reason: 'rule', code: 'faellesAarsloen.aslAarsloen.rule', message };
  },
], resolveAslAarsloenMaxValue);
export const faellesAarsloenEalAarsloenField = amountField('ealAarsloen', 'Årsløn (hvis forskellig fra ASL)');

export const faellesAarsloenFields = catalogFields(faellesAarsloenAslAarsloenField, faellesAarsloenEalAarsloenField);
export const faellesAarsloenCollections = catalogCollections();
