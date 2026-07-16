import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import type {
  AfgoerelseType,
  JaNej,
  Koen,
} from '../../schemas/formSchemas/enumSchemas';
import type { AslAfgoerelseRow } from '../../schemas/formSchemas/sections/erhvervsevnetabSchemas';
import type { ISODateString } from '../../types/branded';
import {
  booleanFieldCodec,
  createChoiceFieldCodec,
  createDateFieldCodec,
  createPercentFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type { FieldAddressTemplate, FieldDescriptor } from '../fieldDescriptor';
import {
  defineStructuralCollection,
  defineStructuralField,
  isUndefined,
} from '../structuralDescriptors';

// Greenfield produkt-descriptors for `erhvervsevnetab`-sektionen (§3.2): skalarer (herunder differencekrav-
// booleans), det nested bilagsvalgsobjekt og samlingen `aslAfgoerelser` med dens rækkefelter.
// Den tomme sektion er sektionens fulde canonical default; bilagsvalgsobjektet skal findes, for at en
// nested boolean kan skrives.

const createEmptyErhvervsevnetabSection = (): unknown =>
  structuredClone(ERHVERVSEVNETAB_INITIAL_VALUES as PersistedSectionMap['erhvervsevnetab']);

export const erhvervsevnetabBeregningsdatoField = defineStructuralField<ISODateString | undefined>({
  id: 'erhvervsevnetab.beregningsdato',
  template: { section: 'erhvervsevnetab', path: [], field: 'beregningsdato' },
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Beregningsdato',
  controlKind: 'text',
  createEmptySection: createEmptyErhvervsevnetabSection,
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
});

const eetToggle = (field: string, label: string): FieldDescriptor<boolean> =>
  defineStructuralField<boolean>({
    id: `erhvervsevnetab.${field}`,
    template: { section: 'erhvervsevnetab', path: [], field },
    codec: booleanFieldCodec,
    emptyValue: false,
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

const bilagToggle = (field: string, label: string): FieldDescriptor<boolean> =>
  defineStructuralField<boolean>({
    id: `erhvervsevnetab.eetDifferencekravBilagSelection.${field}`,
    template: bilagTemplate(field),
    codec: booleanFieldCodec,
    emptyValue: false,
    isEmpty: () => false,
    label,
    controlKind: 'toggle',
    createEmptySection: createEmptyErhvervsevnetabSection,
  });

export const erhvervsevnetabBilagLoebendeYdelserField = bilagToggle('loebendeYdelser', 'Løbende ydelser');
export const erhvervsevnetabBilagKapitaliseringField = bilagToggle('kapitalisering', 'Kapitalisering');
export const erhvervsevnetabBilagEetEfterEalField = bilagToggle('eetEfterEal', 'EET efter EAL');
export const erhvervsevnetabBilagProformaKapitaliseringField = bilagToggle('proformaKapitalisering', 'Proformakap. af rest-EET');
export const erhvervsevnetabBilagMerErstatningPensionsalderField = bilagToggle('merErstatningPensionsalder', 'Mer-erstatning forhøjet folkepension');
export const erhvervsevnetabBilagVisUdvidetSpecifikationField = bilagToggle('visUdvidetSpecifikation', 'Vis udvidet specifikation');
export const erhvervsevnetabBilagVisUdvidetSpecLoebendeField = bilagToggle('visUdvidetSpecifikationLoebendeYdelserBilag', 'Medtag udvidet specifikation på løbende ydelser');

// ── Samlingen aslAfgoerelser ─────────────────────────────────────────────────────
export const erhvervsevnetabAslAfgoerelserCollection = defineStructuralCollection<AslAfgoerelseRow>({
  id: 'erhvervsevnetab.aslAfgoerelser',
  template: { section: 'erhvervsevnetab', path: [], collection: 'aslAfgoerelser' },
  createEmptySection: createEmptyErhvervsevnetabSection,
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
export const aslAfgoerelseFsTilbageholdtEetField = defineStructuralField<JaNej | undefined>({
  id: 'erhvervsevnetab.aslAfgoerelser.fsTilbageholdtEet',
  template: aslRowTemplate('fsTilbageholdtEet'),
  codec: createChoiceFieldCodec<JaNej>(['Ja', 'Nej']),
  emptyValue: undefined,
  isEmpty: isUndefined,
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
