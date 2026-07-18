import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import type {
  AfgoerelseType,
  JaNej,
  Koen,
} from '../../schemas/formSchemas/enumSchemas';
import type { AslAfgoerelseRow } from '../../schemas/formSchemas/sections/erhvervsevnetabSchemas';
import type { ISODateString } from '../../types/branded';
import { dateRanges_erhvervsevnetab } from '../../config/dateRanges';
import { resolveDateRangeErrorMessage } from '../../utils/dateRangeErrorMessages';
import {
  createBooleanFieldCodec,
  createChoiceFieldCodec,
  createDateFieldCodec,
  createPercentFieldCodec,
  createRequiredChoiceFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import { createCollectionRef, type CollectionRef } from '../fieldAddress';
import type { FieldAddressTemplate, FieldDescriptor } from '../fieldDescriptor';
import {
  defineStructuralCollection,
  defineStructuralField,
  isUndefined,
} from '../structuralDescriptors';
import { percentBoundsValidator } from './boundsValidators';
import { stamdataSkadedatoField } from './stamdataDescriptors';

// Greenfield produkt-descriptors for `erhvervsevnetab`-sektionen (§3.2): skalarer (herunder differencekrav-
// booleans), det nested bilagsvalgsobjekt og samlingen `aslAfgoerelser` med dens rækkefelter.
// Den tomme sektion er sektionens fulde canonical default; bilagsvalgsobjektet skal findes, for at en
// nested boolean kan skrives.

const createEmptyErhvervsevnetabSection = (): unknown =>
  structuredClone(ERHVERVSEVNETAB_INITIAL_VALUES as PersistedSectionMap['erhvervsevnetab']);

// Beregningsdato-bounds (§1.6, Fase 3 Erhvervsevnetab-slice) — som Forsørgertab: den dynamiske min/faste max, som
// legacy-siden håndhævede via `StyledDateField`s `minDate`/`maxDate` + `onFieldError`, er nu en canonical bounds-
// FELTVALIDATOR. Legacy `skadedatoMin = coerceToISODateString(skadedato) ?? fallbackMin`; `maxDate = DATE_EET_MAX`;
// special `eetDataMax`. Grænserne er byte-identiske med legacy (`dateRanges_erhvervsevnetab` + `resolveDateRange
// ErrorMessage`), så beskedteksten er uændret. Skadedato krydslæses via `view.readCanonical` (den rå dependency,
// uafhængigt af dens eget issue — som legacy brugte den rå `stamdata.skadedato`).
export const erhvervsevnetabBeregningsdatoField = defineStructuralField<ISODateString | undefined>({
  id: 'erhvervsevnetab.beregningsdato',
  template: { section: 'erhvervsevnetab', path: [], field: 'beregningsdato' },
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Beregningsdato',
  controlKind: 'text',
  createEmptySection: createEmptyErhvervsevnetabSection,
  validators: [
    (value, _field, view) => {
      if (value === undefined) return undefined;
      const skadedato = view.readCanonical(stamdataSkadedatoField.bind());
      // Legacy `skadedatoMin = coerceToISODateString(skadedato) ?? fallbackMin` (INGEN max med fallbackMin — en
      // skadedato før 2005 sænker min tilsvarende, som legacy).
      const minDate = skadedato ?? dateRanges_erhvervsevnetab.beregningsdato.fallbackMin;
      const maxDate = dateRanges_erhvervsevnetab.beregningsdato.max;
      if (value >= minDate && value <= maxDate) return undefined;
      return {
        reason: 'bounds',
        code: 'erhvervsevnetab.beregningsdato.bounds',
        message: resolveDateRangeErrorMessage({
          iso: value,
          minDate,
          maxDate,
          special: { maxBoundKind: 'eetDataMax', maxBoundFieldLabel: 'Beregningsdato' },
        }),
        detail: { minDate, maxDate },
      };
    },
  ],
});

export const erhvervsevnetabKoenField = defineStructuralField<Koen | undefined>({
  id: 'erhvervsevnetab.koen',
  template: { section: 'erhvervsevnetab', path: [], field: 'koen' },
  codec: createChoiceFieldCodec<Koen>(['Mand', 'Kvinde']),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Køn',
  controlKind: 'choice',
  createEmptySection: createEmptyErhvervsevnetabSection,
});

// UI'et forbyder decimaler; 0..100 og divisible-by-5 er afledte issues, ikke codec-config.
export const erhvervsevnetabEalEetPctField = defineStructuralField<number | undefined>({
  id: 'erhvervsevnetab.ealEetPct',
  template: { section: 'erhvervsevnetab', path: [], field: 'ealEetPct' },
  codec: createPercentFieldCodec({ allowNegative: false, allowDecimals: false }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'EET % (hvis afviger fra ASL)',
  controlKind: 'text',
  createEmptySection: createEmptyErhvervsevnetabSection,
  validators: [percentBoundsValidator('erhvervsevnetab.ealEetPct.bounds', {
    minValue: 0,
    maxValue: 100,
    allowDecimals: false,
  })],
});

const eetToggle = (field: string, label: string): FieldDescriptor<boolean> =>
  defineStructuralField<boolean>({
    id: `erhvervsevnetab.${field}`,
    template: { section: 'erhvervsevnetab', path: [], field },
    codec: createBooleanFieldCodec(true),
    emptyValue: true,
    isEmpty: () => false,
    label,
    controlKind: 'toggle',
    createEmptySection: createEmptyErhvervsevnetabSection,
  });

export const erhvervsevnetabEndeligEetTilbagevirkendeField = eetToggle(
  'endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft',
  'Endelig EET gør midlertidig endelig med tilbagevirkende kraft',
);
export const erhvervsevnetabIndregnMerErstatningField = eetToggle(
  'indregnMerErstatningVedForhoejetPensionsalder',
  'Indregn mer-erstatning ved forhøjet pensionsalder',
);

// ── Nested bilagsvalg (eetDifferencekravBilagSelection) ──────────────────────────
const bilagTemplate = (field: string): FieldAddressTemplate => ({
  section: 'erhvervsevnetab',
  path: [{ kind: 'property', name: 'eetDifferencekravBilagSelection' }],
  field,
});

const bilagToggle = (field: string, label: string, emptyValue: boolean): FieldDescriptor<boolean> =>
  defineStructuralField<boolean>({
    id: `erhvervsevnetab.eetDifferencekravBilagSelection.${field}`,
    template: bilagTemplate(field),
    codec: createBooleanFieldCodec(emptyValue),
    emptyValue,
    isEmpty: () => false,
    label,
    controlKind: 'toggle',
    createEmptySection: createEmptyErhvervsevnetabSection,
  });

export const erhvervsevnetabBilagLoebendeYdelserField = bilagToggle('loebendeYdelser', 'Løbende ydelser', true);
export const erhvervsevnetabBilagKapitaliseringField = bilagToggle('kapitalisering', 'Kapitalisering', true);
export const erhvervsevnetabBilagEetEfterEalField = bilagToggle('eetEfterEal', 'EET efter EAL', true);
export const erhvervsevnetabBilagProformaKapitaliseringField = bilagToggle('proformaKapitalisering', 'Proformakap. af rest-EET', true);
export const erhvervsevnetabBilagMerErstatningPensionsalderField = bilagToggle('merErstatningPensionsalder', 'Mer-erstatning forhøjet folkepension', true);
export const erhvervsevnetabBilagVisUdvidetSpecifikationField = bilagToggle('visUdvidetSpecifikation', 'Vis udvidet specifikation', false);
export const erhvervsevnetabBilagVisUdvidetSpecLoebendeField = bilagToggle('visUdvidetSpecifikationLoebendeYdelserBilag', 'Medtag udvidet specifikation på løbende ydelser', false);

// ── Samlingen aslAfgoerelser ─────────────────────────────────────────────────────
export const erhvervsevnetabAslAfgoerelserCollection = defineStructuralCollection<AslAfgoerelseRow>({
  id: 'erhvervsevnetab.aslAfgoerelser',
  template: { section: 'erhvervsevnetab', path: [], collection: 'aslAfgoerelser' },
  createEmptySection: createEmptyErhvervsevnetabSection,
});

/** Den kanoniske CollectionRef for ASL-afgørelsesrækkerne (top-level collection, ingen entity-parent). */
export const erhvervsevnetabAslAfgoerelserCollectionRef: CollectionRef = createCollectionRef({
  section: 'erhvervsevnetab',
  path: [],
  collection: 'aslAfgoerelser',
});

const aslRowTemplate = (field: string): FieldAddressTemplate => ({
  section: 'erhvervsevnetab',
  path: [{ kind: 'entity', collection: 'aslAfgoerelser' }],
  field,
});

const aslDate = (field: string, label: string): FieldDescriptor<ISODateString | undefined> =>
  defineStructuralField<ISODateString | undefined>({
    id: `erhvervsevnetab.aslAfgoerelser.${field}`,
    template: aslRowTemplate(field),
    codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErhvervsevnetabSection,
  });

const aslPct = (field: string, label: string): FieldDescriptor<number | undefined> =>
  defineStructuralField<number | undefined>({
    id: `erhvervsevnetab.aslAfgoerelser.${field}`,
    template: aslRowTemplate(field),
    codec: createPercentFieldCodec({ allowNegative: false, allowDecimals: false }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErhvervsevnetabSection,
    validators: [percentBoundsValidator(`erhvervsevnetab.aslAfgoerelser.${field}.bounds`, {
      minValue: 0,
      maxValue: 100,
      allowDecimals: false,
    })],
  });

export const aslAfgoerelseAfgoerelsesDatoField = aslDate('afgoerelsesDato', 'Afgørelsesdato');
export const aslAfgoerelseVirkningsDatoField = aslDate('virkningsDato', 'Virkningsdato');
export const aslAfgoerelseEetPctField = aslPct('eetPct', 'EET %');
export const aslAfgoerelseKapDatoField = aslDate('kapDato', 'Kap.dato');
export const aslAfgoerelseKapPctField = aslPct('kapPct', 'Kap. %');
export const aslAfgoerelseTidlKapDatoField = aslDate('tidlKapDato', 'Hvis genopt. - tidl. kap.dato');

export const aslAfgoerelseAfgoerelseTypeField = defineStructuralField<AfgoerelseType | undefined>({
  id: 'erhvervsevnetab.aslAfgoerelser.afgoerelseType',
  template: aslRowTemplate('afgoerelseType'),
  codec: createChoiceFieldCodec<AfgoerelseType>(['Midlertidig', 'Delvist endelig', 'Endelig']),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Afgørelsestype',
  controlKind: 'choice',
  createEmptySection: createEmptyErhvervsevnetabSection,
});

// fsTilbageholdtEet er en defaulted enum ('Nej'); choice-codecet parser tom tekst til undefined, men den
// optræder aldrig i en committed række (schemaet defaulter). Readeren returnerer den defaultede canonical værdi.
export const aslAfgoerelseFsTilbageholdtEetField = defineStructuralField<JaNej>({
  id: 'erhvervsevnetab.aslAfgoerelser.fsTilbageholdtEet',
  template: aslRowTemplate('fsTilbageholdtEet'),
  codec: createRequiredChoiceFieldCodec<JaNej>(['Ja', 'Nej'], 'Nej'),
  emptyValue: 'Nej',
  isEmpty: () => false,
  label: 'FS tilbageholdt EET',
  controlKind: 'choice',
  createEmptySection: createEmptyErhvervsevnetabSection,
});

export const erhvervsevnetabFields = catalogFields(
  erhvervsevnetabBeregningsdatoField,
  erhvervsevnetabKoenField,
  erhvervsevnetabEalEetPctField,
  erhvervsevnetabEndeligEetTilbagevirkendeField,
  erhvervsevnetabIndregnMerErstatningField,
  erhvervsevnetabBilagLoebendeYdelserField,
  erhvervsevnetabBilagKapitaliseringField,
  erhvervsevnetabBilagEetEfterEalField,
  erhvervsevnetabBilagProformaKapitaliseringField,
  erhvervsevnetabBilagMerErstatningPensionsalderField,
  erhvervsevnetabBilagVisUdvidetSpecifikationField,
  erhvervsevnetabBilagVisUdvidetSpecLoebendeField,
  aslAfgoerelseAfgoerelsesDatoField,
  aslAfgoerelseVirkningsDatoField,
  aslAfgoerelseEetPctField,
  aslAfgoerelseKapDatoField,
  aslAfgoerelseKapPctField,
  aslAfgoerelseTidlKapDatoField,
  aslAfgoerelseAfgoerelseTypeField,
  aslAfgoerelseFsTilbageholdtEetField,
);
export const erhvervsevnetabCollections = catalogCollections(erhvervsevnetabAslAfgoerelserCollection);
