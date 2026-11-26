import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { createAmountFieldCodec } from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type { FieldDescriptor, FieldValidator } from '../fieldDescriptor';
import { defineStructuralField, isUndefined } from '../structuralDescriptors';
import { amountBoundsValidator } from './boundsValidators';
import { amountValueToNumber } from '../../utils/expressionAmount';
import {
  validateAslAarsloenBySkadesaarMax,
  validateAslAarsloenDivisibleBy1000,
} from '../../domain/aslEalAarsloen/aarsloenValidators';
import {
  SKADELIDTES_AARSLOEN_ASL_LABEL,
  SKADELIDTES_AARSLOEN_EAL_FELT_LABEL,
} from '../../domain/aslEalAarsloen/aarsloenLabels';
import { stamdataSkadedatoField, stamdataSkadestypeField } from './stamdataDescriptors';

// Produkt-descriptors for `faellesAarsloen`-sektionen (ASL/EAL-årsløn, §3.2). Sektionen har ingen
// egen route; den redigeres i flere domænekontekster (EET, Forsørgertab, EO). Beløbene er heltal med et hårdt
// gulv på 1000 og et repræsentationsloft på 9999999 – altid som en afledt canonical bounds-feltvalidator
// (§1.6), ikke som en codec-afvisning. ASL-feltets skærpede loft (skadesårets ASL-maksimum) er en
// DOMÆNEREGEL, ikke en bounds-grænse; se begrundelsen ved `faellesAarsloenAslAarsloenField`.
// En værdi under gulvet committes canonical med et rødt bounds-issue og kan gemmes i `.eo`. Fortegn ikke tilladt.

const createEmptyFaellesAarsloenSection = (): unknown => ({});

const AMOUNT_MIN = 1000;
const AMOUNT_MAX = 9999999;

/**
 * Feltet tager kun hele kroner; en tastet decimal afrundes ved settle. En `.eo`-fil kan dog bære øre
 * (`amountValue` tillader to decimaler), og så viser feltet «400.001», mens beregningen bruger 400.000,50.
 * Værdien bevares og bliver rød, så brugeren selv retter den.
 */
const wholeKronerValidator = (field: string): FieldValidator<AmountValue | undefined> => (value) => {
  const amount = amountValueToNumber(value);
  if (amount === undefined || Number.isInteger(amount)) return undefined;
  return { reason: 'rule', code: `faellesAarsloen.${field}.helekroner`, message: 'Beløbet skal angives i hele kroner' };
};

const amountField = (
  field: string,
  label: string,
  extraValidators: readonly FieldValidator<AmountValue | undefined>[] = [],
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
      amountBoundsValidator(`faellesAarsloen.${field}.bounds`, AMOUNT_MIN, AMOUNT_MAX),
      ...extraValidators,
    ],
  });

/**
 * ASL-årslønsloftet er sat ÉT sted.
 *
 * Sættes loftet også her som en generisk bounds-grænse ved siden af `validateAslAarsloenBySkadesaarMax`
 * nedenfor, kører bounds-validatoren først og vinder, så brugeren får «Værdi skal være mellem 1000 og
 * 551000» – en tekst, der siger AT der er en grænse, men ikke hvor den kommer fra. Den forklarende besked,
 * som navngiver skadesåret («Skadelidtes årsløn (efter ASL) kan ikke overstige maks årslønnen i skadesåret
 * (551.000 kr.)»), bliver da uopnåelig død kode – to grænser, der er den samme grænse skrevet to gange.
 *
 * Bounds-grænsen er derfor det faste repræsentationsloft, og skadesårets skærpelse ejes alene af
 * domænereglen, hvis besked er den, brugeren ser. Sæt ikke skadesårsloftet ind her igen.
 */
export const faellesAarsloenAslAarsloenField = amountField('aslAarsloen', SKADELIDTES_AARSLOEN_ASL_LABEL, [
  (value, _field, view) => {
    const aarsloen = amountValueToNumber(value);
    /**
     * MAKSIMUM har forrang over delelighed, når begge er brudt.
     *
     * Rækkefølgen betyder noget, fordi maksimumsbeskeden er den, brugeren ser: et tal som `9.999.999` bryder begge
     * regler, og «kan ikke overstige maks årslønnen i skadesåret (608.000 kr.)» siger langt mere end
     * «skal være deleligt med 1.000» – loftet er den grænse, der reelt binder.
     */
    const message = validateAslAarsloenBySkadesaarMax(
      aarsloen,
      view.readCanonical(stamdataSkadedatoField.bind()),
      // Datoens navn følger skadestypen: «anmeldelsesåret» ved en erhvervssygdom.
      view.readCanonical(stamdataSkadestypeField.bind())
    ) ?? validateAslAarsloenDivisibleBy1000(aarsloen);
    return message === undefined
      ? undefined
      : { reason: 'rule', code: 'faellesAarsloen.aslAarsloen.rule', message };
  },
]);
// ASL-feltet fanges allerede af «deleligt med 1.000»; EAL-feltet har ingen sådan regel.
export const faellesAarsloenEalAarsloenField = amountField('ealAarsloen', SKADELIDTES_AARSLOEN_EAL_FELT_LABEL, [
  wholeKronerValidator('ealAarsloen'),
]);

export const faellesAarsloenFields = catalogFields(faellesAarsloenAslAarsloenField, faellesAarsloenEalAarsloenField);
export const faellesAarsloenCollections = catalogCollections();
