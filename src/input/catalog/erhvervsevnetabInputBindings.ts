import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import type {
  AfgoerelseType,
  JaNej,
  Koen,
} from '../../schemas/formSchemas/enumSchemas';
import type { AslAfgoerelseRow } from '../../schemas/formSchemas/sections/erhvervsevnetabSchemas';
import type { ISODateString } from '../../types/branded';
import type { FieldAddressTemplate } from '../fieldCatalog';
import type { CollectionBinding, FieldBinding } from '../fieldCatalog';
import {
  booleanFieldCodec,
  createChoiceFieldCodec,
  createDateFieldCodec,
  createPercentFieldCodec,
} from '../fieldCodecs';
import { defineField, type FieldCodec } from '../fieldDefinition';
import { createStructuralCollectionBinding, createStructuralFieldBinding } from '../structuralBindings';
import { defineInputManifest } from './inputManifest';

/**
 * Strukturelle bindinger for `erhvervsevnetab`-sektionen: skalarer (herunder differencekrav-fanens
 * boolean-valg), det nested bilagsvalgsobjekt og samlingen `aslAfgoerelser` med dens rækkefelter.
 *
 * Den tomme sektion er sektionens fulde canonical default (samme som formularlaget materialiserer),
 * så et første typed commit i en tom sag ikke afviger fra legacy-basen. Bilagsvalgsobjektet skal
 * findes i den tomme sektion, for at en nested boolean kan skrives.
 */
const createEmptyErhvervsevnetabSection = (): unknown =>
  structuredClone(ERHVERVSEVNETAB_INITIAL_VALUES as PersistedSectionMap['erhvervsevnetab']);

// ─── Skalarfelter ─────────────────────────────────────────────────────────────

export const erhvervsevnetabBeregningsdatoBinding: FieldBinding<ISODateString | undefined> =
  createStructuralFieldBinding({
    definition: defineField<ISODateString | undefined>({
      label: 'Beregningsdato',
      controlKind: 'text',
      codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    }),
    template: { section: 'erhvervsevnetab', path: [], field: 'beregningsdato' },
    createEmptySection: createEmptyErhvervsevnetabSection,
  });

export const erhvervsevnetabKoenBinding: FieldBinding<Koen | undefined> = createStructuralFieldBinding({
  definition: defineField<Koen | undefined>({
    label: 'Køn',
    controlKind: 'choice',
    codec: createChoiceFieldCodec<Koen>(['Mand', 'Kvinde']),
  }),
  template: { section: 'erhvervsevnetab', path: [], field: 'koen' },
  createEmptySection: createEmptyErhvervsevnetabSection,
});

// UI'et forbyder decimaler; 0..100 og divisible-by-5 er afledte issues, ikke codec-config.
export const erhvervsevnetabEalEetPctBinding: FieldBinding<number | undefined> =
  createStructuralFieldBinding({
    definition: defineField<number | undefined>({
      label: 'EET % (hvis afviger fra ASL)',
      controlKind: 'text',
      codec: createPercentFieldCodec({ allowNegative: false, allowDecimals: false }),
    }),
    template: { section: 'erhvervsevnetab', path: [], field: 'ealEetPct' },
    createEmptySection: createEmptyErhvervsevnetabSection,
  });

const eetToggleField = (field: string, label: string): FieldBinding<boolean> =>
  createStructuralFieldBinding({
    definition: defineField<boolean>({
      label,
      controlKind: 'toggle',
      codec: booleanFieldCodec,
    }),
    template: { section: 'erhvervsevnetab', path: [], field },
    createEmptySection: createEmptyErhvervsevnetabSection,
  });

export const erhvervsevnetabEndeligEetTilbagevirkendeBinding = eetToggleField(
  'endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft',
  'Endelig EET gør midlertidig endelig med tilbagevirkende kraft'
);
export const erhvervsevnetabIndregnMerErstatningBinding = eetToggleField(
  'indregnMerErstatningVedForhoejetPensionsalder',
  'Indregn mer-erstatning ved forhøjet pensionsalder'
);

// ─── Nested bilagsvalg (eetDifferencekravBilagSelection) ────────────────────────

const bilagSelectionTemplate = (field: string): FieldAddressTemplate => ({
  section: 'erhvervsevnetab',
  path: [{ kind: 'property', name: 'eetDifferencekravBilagSelection' }],
  field,
});

const bilagToggleField = (field: string, label: string): FieldBinding<boolean> =>
  createStructuralFieldBinding({
    definition: defineField<boolean>({
      label,
      controlKind: 'toggle',
      codec: booleanFieldCodec,
    }),
    template: bilagSelectionTemplate(field),
    createEmptySection: createEmptyErhvervsevnetabSection,
  });

export const erhvervsevnetabBilagLoebendeYdelserBinding = bilagToggleField('loebendeYdelser', 'Løbende ydelser');
export const erhvervsevnetabBilagKapitaliseringBinding = bilagToggleField('kapitalisering', 'Kapitalisering');
export const erhvervsevnetabBilagEetEfterEalBinding = bilagToggleField('eetEfterEal', 'EET efter EAL');
export const erhvervsevnetabBilagProformaKapitaliseringBinding = bilagToggleField(
  'proformaKapitalisering',
  'Proformakap. af rest-EET'
);
export const erhvervsevnetabBilagMerErstatningPensionsalderBinding = bilagToggleField(
  'merErstatningPensionsalder',
  'Mer-erstatning forhøjet folkepension'
);
export const erhvervsevnetabBilagVisUdvidetSpecifikationBinding = bilagToggleField(
  'visUdvidetSpecifikation',
  'Vis udvidet specifikation'
);
export const erhvervsevnetabBilagVisUdvidetSpecLoebendeBinding = bilagToggleField(
  'visUdvidetSpecifikationLoebendeYdelserBilag',
  'Medtag udvidet specifikation på løbende ydelser'
);

// ─── Samlingen aslAfgoerelser ───────────────────────────────────────────────────

export const erhvervsevnetabAslAfgoerelserBinding: CollectionBinding<AslAfgoerelseRow> =
  createStructuralCollectionBinding<AslAfgoerelseRow>({
    template: { section: 'erhvervsevnetab', path: [], collection: 'aslAfgoerelser' },
    createEmptySection: createEmptyErhvervsevnetabSection,
  });

const aslRowFieldTemplate = (field: string): FieldAddressTemplate => ({
  section: 'erhvervsevnetab',
  path: [{ kind: 'entity', collection: 'aslAfgoerelser' }],
  field,
});

const aslDateField = (field: string, label: string): FieldBinding<ISODateString | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<ISODateString | undefined>({
      label,
      controlKind: 'text',
      codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    }),
    template: aslRowFieldTemplate(field),
    createEmptySection: createEmptyErhvervsevnetabSection,
  });

const aslPctField = (field: string, label: string): FieldBinding<number | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<number | undefined>({
      label,
      controlKind: 'text',
      codec: createPercentFieldCodec({ allowNegative: false, allowDecimals: false }),
    }),
    template: aslRowFieldTemplate(field),
    createEmptySection: createEmptyErhvervsevnetabSection,
  });

export const aslAfgoerelseAfgoerelsesDatoBinding = aslDateField('afgoerelsesDato', 'Afgørelsesdato');
export const aslAfgoerelseVirkningsDatoBinding = aslDateField('virkningsDato', 'Virkningsdato');
export const aslAfgoerelseEetPctBinding = aslPctField('eetPct', 'EET %');
export const aslAfgoerelseKapDatoBinding = aslDateField('kapDato', 'Kap.dato');
export const aslAfgoerelseKapPctBinding = aslPctField('kapPct', 'Kap. %');
export const aslAfgoerelseTidlKapDatoBinding = aslDateField('tidlKapDato', 'Hvis genopt. - tidl. kap.dato');

export const aslAfgoerelseAfgoerelseTypeBinding: FieldBinding<AfgoerelseType | undefined> =
  createStructuralFieldBinding({
    definition: defineField<AfgoerelseType | undefined>({
      label: 'Afgørelsestype',
      controlKind: 'choice',
      codec: createChoiceFieldCodec<AfgoerelseType>(['Midlertidig', 'Delvist endelig', 'Endelig']),
    }),
    template: aslRowFieldTemplate('afgoerelseType'),
    createEmptySection: createEmptyErhvervsevnetabSection,
  });

// fsTilbageholdtEet er en defaulted (ikke-optional) enum: canonical er altid 'Ja'|'Nej'.
// Choice-codecet parser tom tekst til undefined, men den optræder aldrig i en committed række
// (schemaet defaulter til 'Nej'); readeren returnerer den defaultede canonical værdi.
const jaNejChoiceCodec: FieldCodec<JaNej | undefined> = createChoiceFieldCodec<JaNej>(['Ja', 'Nej']);

export const aslAfgoerelseFsTilbageholdtEetBinding: FieldBinding<JaNej | undefined> =
  createStructuralFieldBinding({
    definition: defineField<JaNej | undefined>({
      label: 'FS tilbageholdt EET',
      controlKind: 'choice',
      codec: jaNejChoiceCodec,
    }),
    template: aslRowFieldTemplate('fsTilbageholdtEet'),
    createEmptySection: createEmptyErhvervsevnetabSection,
  });

export const erhvervsevnetabInputManifest = defineInputManifest({
  id: 'erhvervsevnetab',
  fields: [
    erhvervsevnetabBeregningsdatoBinding,
    erhvervsevnetabKoenBinding,
    erhvervsevnetabEalEetPctBinding,
    erhvervsevnetabEndeligEetTilbagevirkendeBinding,
    erhvervsevnetabIndregnMerErstatningBinding,
    erhvervsevnetabBilagLoebendeYdelserBinding,
    erhvervsevnetabBilagKapitaliseringBinding,
    erhvervsevnetabBilagEetEfterEalBinding,
    erhvervsevnetabBilagProformaKapitaliseringBinding,
    erhvervsevnetabBilagMerErstatningPensionsalderBinding,
    erhvervsevnetabBilagVisUdvidetSpecifikationBinding,
    erhvervsevnetabBilagVisUdvidetSpecLoebendeBinding,
    aslAfgoerelseAfgoerelsesDatoBinding,
    aslAfgoerelseVirkningsDatoBinding,
    aslAfgoerelseEetPctBinding,
    aslAfgoerelseKapDatoBinding,
    aslAfgoerelseKapPctBinding,
    aslAfgoerelseTidlKapDatoBinding,
    aslAfgoerelseAfgoerelseTypeBinding,
    aslAfgoerelseFsTilbageholdtEetBinding,
  ],
  collections: [erhvervsevnetabAslAfgoerelserBinding],
});
