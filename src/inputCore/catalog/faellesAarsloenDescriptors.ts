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
  SKADELIDTES_AARSLOEN_EAL_LABEL,
} from '../../domain/aslEalAarsloen/aarsloenLabels';
import { stamdataSkadedatoField, stamdataSkadestypeField } from './stamdataDescriptors';

// Produkt-descriptors for `faellesAarsloen`-sektionen (ASL/EAL-årsløn, §3.2). Sektionen har ingen
// egen route; den redigeres i flere domænekontekster (EET, Forsørgertab, EO). Beløbene er heltal med et hårdt
// gulv på 1000 og et repræsentationsloft på 9999999 – altid som en afledt canonical bounds-feltvalidator
// (§1.6), ikke som en codec-afvisning. ASL-feltets skærpede loft (skadesårets ASL-maksimum) er en
// DOMÆNEREGEL, ikke en bounds-grænse; se begrundelsen ved `faellesAarsloenAslAarsloenField` (BB-125).
// En værdi under gulvet committes canonical med et rødt bounds-issue og kan gemmes i `.eo`. Fortegn ikke tilladt.

const createEmptyFaellesAarsloenSection = (): unknown => ({});

const AMOUNT_MIN = 1000;
const AMOUNT_MAX = 9999999;

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
 * ASL-årslønsloftet er sat ÉT sted (BB-125).
 *
 * Loftet var før sat to gange: her som en generisk bounds-grænse OG som `validateAslAarsloenBySkadesaarMax`
 * nedenfor. Bounds-validatoren kører først og vinder, så brugeren fik «Værdi skal være mellem 1000 og
 * 551000» – en tekst, der siger AT der er en grænse, men ikke hvor den kommer fra. Den forklarende besked,
 * som navngiver skadesåret («Skadelidtes årsløn (efter ASL) kan ikke overstige maks årslønnen i skadesåret
 * (551.000 kr.)»), var
 * uopnåelig død kode – præcis M-24's lære om to grænser, der er den samme grænse skrevet to gange.
 *
 * Bounds-grænsen er derfor det faste repræsentationsloft, og skadesårets skærpelse ejes alene af
 * domænereglen, hvis besked nu er den, brugeren ser. Sæt ikke skadesårsloftet ind her igen.
 */
export const faellesAarsloenAslAarsloenField = amountField('aslAarsloen', SKADELIDTES_AARSLOEN_ASL_LABEL, [
  (value, _field, view) => {
    const aarsloen = amountValueToNumber(value);
    /**
     * MAKSIMUM har forrang over delelighed, når begge er brudt.
     *
     * Rækkefølgen var omvendt, dengang maksimum også var en bounds-grænse: den generiske
     * bounds-besked vandt alligevel, så den lokale rækkefølge var uden betydning. Nu hvor
     * maksimumsbeskeden er den, brugeren ser (BB-125), betyder den: et tal som `9.999.999` bryder begge
     * regler, og «kan ikke overstige maks årslønnen i skadesåret (608.000 kr.)» siger langt mere end
     * «skal være deleligt med 1.000» – loftet er den grænse, der reelt binder.
     */
    const message = validateAslAarsloenBySkadesaarMax(
      aarsloen,
      view.readCanonical(stamdataSkadedatoField.bind()),
      // Datoens navn følger skadestypen (BB-121): «anmeldelsesåret» ved en erhvervssygdom.
      view.readCanonical(stamdataSkadestypeField.bind())
    ) ?? validateAslAarsloenDivisibleBy1000(aarsloen);
    return message === undefined
      ? undefined
      : { reason: 'rule', code: 'faellesAarsloen.aslAarsloen.rule', message };
  },
]);
export const faellesAarsloenEalAarsloenField = amountField('ealAarsloen', SKADELIDTES_AARSLOEN_EAL_LABEL);

export const faellesAarsloenFields = catalogFields(faellesAarsloenAslAarsloenField, faellesAarsloenEalAarsloenField);
export const faellesAarsloenCollections = catalogCollections();
