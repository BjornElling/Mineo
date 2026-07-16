import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { createAmountFieldCodec } from '../fieldCodecs';
import { defineField } from '../fieldDefinition';
import type { FieldBinding } from '../fieldCatalog';
import { createStructuralFieldBinding } from '../structuralBindings';
import { defineInputManifest } from './inputManifest';

/**
 * Strukturelle bindinger for `faellesAarsloen`-sektionen (ASL/EAL-årsløn). Sektionen har ingen egen
 * route; den redigeres i flere domænekontekster (EET, Forsørgertab, EO).
 * Beløbene er heltal med et hårdt gulv på 1000 (afledt bounds-issue), som beløbs-codecet forwarder til
 * paste-afskæringen; fortegn er ikke tilladt.
 */
const createEmptyFaellesAarsloenSection = (): unknown => ({});

const amountField = (field: string, label: string): FieldBinding<AmountValue | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<AmountValue | undefined>({
      label,
      controlKind: 'text',
      codec: createAmountFieldCodec({
        allowNegative: false,
        allowDecimals: false,
        minValue: 1000,
        maxValue: 9999999,
      }),
    }),
    template: { section: 'faellesAarsloen', path: [], field },
    createEmptySection: createEmptyFaellesAarsloenSection,
  });

export const faellesAarsloenAslAarsloenBinding = amountField('aslAarsloen', 'Årsløn');
export const faellesAarsloenEalAarsloenBinding = amountField('ealAarsloen', 'Årsløn (hvis forskellig fra ASL)');

export const faellesAarsloenInputManifest = defineInputManifest({
  id: 'faelles-aarsloen',
  fields: [faellesAarsloenAslAarsloenBinding, faellesAarsloenEalAarsloenBinding],
  collections: [],
});
