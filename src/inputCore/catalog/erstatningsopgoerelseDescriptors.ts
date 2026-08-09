import type {
  AfsluttesMed,
  Arbejdsstatus,
  Beregningsmetode,
  EoBilagLoenindkomstOgOffentligeYdelserIndgaar,
  Helbredsstatus,
  JaNej,
  JaNejSkjul,
  SvieSmerteDelvisSygemeldingSats,
  SygeferiegodtgoerelseBeregningskilde,
  SygeferiegodtgoerelseSatsvalg,
  Tilstand,
} from '../../schemas/formSchemas/enumSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import {
  erstatningsopgoerelseSchema,
  type FerieperiodeRow,
  type OevrigeKravRow,
  type OffentligeYdelserRow,
  type SvieSmertePeriodeRow,
  type SygeferiegodtgoerelseAnsaettelsesforholdRow,
  type TafPeriodeRow,
} from '../../schemas/formSchemas/sections/erstatningsopgoerelseSchemas';
import {
  computeSkadedatoMinRule,
  getCurrentYear,
  dateRanges_erstatningsopgoerelse,
  dateRanges_offentligeYdelser,
  MIN_SVIESMERTE_YEAR,
} from '../../config/dateRanges';
import { DEFAULT_FRACTION_MAX_DIGITS } from '../../utils/fraction';
import type { ISODateString } from '../../types/branded';
import {
  createBooleanFieldCodec,
  createAmountFieldCodec,
  createChoiceFieldCodec,
  createDateFieldCodec,
  createFractionFieldCodec,
  createIntegerFieldCodec,
  createOptionalTextFieldCodec,
  createPercentFieldCodec,
  createRequiredChoiceFieldCodec,
  createTextFieldCodec,
  createYearFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type {
  FieldControlKind,
  FieldAddressTemplate,
  FieldDescriptor,
  FieldRef,
  FieldValidator,
} from '../fieldDescriptor';
import { dateOrderValidator, type DatePairBinding } from './dateOrderValidators';
import { dateBounds, originWhenNarrowed, systemrammeSpec } from './dateBoundsValidators';
import type { DateBoundsContext, DateBoundsSpec } from '../dateBoundsDeclaration';
import type { FieldCodec } from '../fieldCodec';
import {
  defineStructuralCollection,
  defineStructuralField,
  isUndefined,
} from '../structuralDescriptors';
import {
  amountBoundsValidator,
  integerBoundsValidator,
  percentBoundsValidator,
  yearBoundsValidator,
} from './boundsValidators';
import { stamdataSkadedatoField, stamdataSkadestypeField } from './stamdataDescriptors';
import { STATIC_DATE_BOUNDS } from '../../utils/dateRangeErrorMessages';
import { evaluateForligAnsvarsgradRules } from '../../domain/erstatningsopgoerelse/validation/forligAnsvarsgradRules';
import { evaluateForligsgrad } from '../../domain/erstatningsopgoerelse/engines/forligsgrad';
import {
  isFerieRowEmpty,
  isOffentligeYdelserRowEmpty,
  isOevrigeKravRowEmpty,
  isSvieSmerteRowEmpty,
  isTafRowEmpty,
} from '../../domain/erstatningsopgoerelse/helpers/rowEmpty';

// Produkt-descriptors for `erstatningsopgoerelse`-sektionen (§3.2): top-level skalarer (incl. nested
// bilagsvalgs-booleans) og de rene top-level samlinger med deres rækkefelter. Lønindkomstens/EO-angivet løns
// nested træ ligger i `erstatningsopgoerelseLoenDescriptors.ts`.
//
// Den tomme sektion er den fulde canonical default: `loenindkomstAnsaettelsesforhold` er en påkrævet (ikke-
// defaultet) array, så den skal angives eksplicit for at parse.

export const createEmptyErstatningsopgoerelseSection = (): unknown =>
  erstatningsopgoerelseSchema.parse({ loenindkomstAnsaettelsesforhold: [] });

const S = 'erstatningsopgoerelse' as const;

/**
 * Erklærede tegnlængder for EO's fritekstfelter (`input-field-behavior-contract.md` §3.4, §4.1, §4.2).
 * De står som navngivne konstanter, fordi kontrakten angiver dem præcist — et bart tal på kaldsstedet
 * ville ikke kunne spores tilbage til den regel, det stammer fra.
 */
export const EO_NUMMER_MAX_LENGTH = 7;
export const EO_LEDSAGETEKST_MAX_LENGTH = 64;
export const EO_KOMMENTARER_MAX_LENGTH = 512;

// ── Generiske top-level felt-hjælpere ────────────────────────────────────────────
/**
 * `maxLength` er feltets erklærede maksimale tegnlængde (`input-field-behavior-contract.md` §2.5).
 * Den erklæres HER — på descriptoren — så både formularfeltet og en eventuel tabelcelle håndhæver
 * samme tal ved tastning OG paste. Udelades den, har feltet bevidst ingen længdegrænse.
 */
const optionalTextField = (
  field: string,
  label: string,
  maxLength?: number
): FieldDescriptor<string | undefined> =>
  defineStructuralField<string | undefined>({
    id: `eo.${field}`,
    template: { section: S, path: [], field },
    codec: createOptionalTextFieldCodec(maxLength === undefined ? {} : { maxLength }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

/**
 * Et EO-datofelt. Grænserne er PÅKRÆVEDE og leveres som en `dateBounds(...)`-spredning, der bærer både
 * erklæringen og dens validator. Den valgfrie `validators?`-parameter, der stod her før, var netop det, der
 * lod 14 EO-datofelter blive oprettet helt uden grænser; nu er udeladelse en typefejl.
 */
type DateFieldBounds = Readonly<{
  dateBounds: DateBoundsSpec;
  validators: readonly FieldValidator<ISODateString | undefined>[];
}>;

const dateField = (
  field: string,
  label: string,
  bounds: DateFieldBounds
): FieldDescriptor<ISODateString | undefined> =>
  defineStructuralField<ISODateString | undefined>({
    id: `eo.${field}`,
    template: { section: S, path: [], field },
    codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
    ...bounds,
  });

// ── EO's datogrænser: fra deklaration til håndhævelse ────────────────────────────
//
// EO var det værste tilfælde af det strukturelle hul (se `dateBoundsValidators.ts`): `dateRanges.ts`
// deklarerede grænser for periodefelterne, de fem AES-datoer, differencekravsdatoen og alle tabellernes
// dato-par, men INGEN af dem havde en bounds-validator. Kun Forligsdato og Øvrige krav havde én, og de var
// skrevet i hånden hver for sig. Byggeklodserne nedenfor gør de tre tilbagevendende grænseformer til data,
// så et nyt EO-datofelt arver dem frem for at genopfinde dem — eller glemme dem.

/** Skadedato + Skadestype → EO's tilbagevendende nedre grænse (skadesdagen, eller anmeldedato minus 5 år). */
const skadedatoMinRuleFor = (
  context: DateBoundsContext,
  fallbackMin: ISODateString
): ReturnType<typeof computeSkadedatoMinRule> =>
  computeSkadedatoMinRule({
    skadedatoISO: context.view.readCanonical(stamdataSkadedatoField.bind()),
    erErhvervssygdom: context.view.readCanonical(stamdataSkadestypeField.bind()) === 'Erhvervssygdom',
    fallbackMin,
  });

/**
 * Grænseformen «tidligst skadesdagen, senest <max>» — EO's mest udbredte datoregel.
 *
 * Den bar tidligere kun Forligsdato og Øvrige krav, hver med sin egen håndskrevne kopi. De fem AES-datoer,
 * opgørelsesdatoen og differencekravsdatoen deklarerede nøjagtig samme regel i konfigurationen uden at
 * håndhæve den, så datoer før skadedagen kunne afsluttes canonical og nå hele vejen til PDF.
 */
const skadedatoBoundedSpec = (
  range: Readonly<{ fallbackMin: ISODateString; max: ISODateString }>
): DateBoundsSpec => ({
  min: () => range.fallbackMin,
  max: () => range.max,
  narrowMin: (context) => skadedatoMinRuleFor(context, range.fallbackMin).minDate,
  special: (context) => {
    const rule = skadedatoMinRuleFor(context, range.fallbackMin);
    return rule.minBoundKind === undefined || rule.minDate <= range.fallbackMin
      ? undefined
      : { minBoundKind: rule.minBoundKind, minBoundReferenceISO: rule.minBoundReferenceISO };
  },
  // Skadedato kan i sig selv gøre intervallet umuligt (fx en skadedato efter konfigurationens max), og
  // Skadestype afgør hvilken af de to min-regler der gælder. Begge navngives derfor som årsag.
  origin: originWhenNarrowed(
    'Skadedato og Skadestype',
    (context) => skadedatoMinRuleFor(context, range.fallbackMin).minDate > range.fallbackMin
  ),
});

const amountField = (field: string, label: string): FieldDescriptor<AmountValue | undefined> =>
  defineStructuralField<AmountValue | undefined>({
    id: `eo.${field}`,
    template: { section: S, path: [], field },
    codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
    validators: [amountBoundsValidator(`eo.${field}.bounds`, 0, undefined)],
  });

const integerField = (field: string, label: string): FieldDescriptor<number | undefined> =>
  defineStructuralField<number | undefined>({
    id: `eo.${field}`,
    template: { section: S, path: [], field },
    codec: createIntegerFieldCodec({ allowNegative: false }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
    validators: [integerBoundsValidator(`eo.${field}.bounds`, 0, undefined)],
  });

const choiceField = <T extends string>(
  field: string,
  label: string,
  values: readonly T[],
  controlKind: FieldControlKind = 'choice',
): FieldDescriptor<T | undefined> =>
  defineStructuralField<T | undefined>({
    id: `eo.${field}`,
    template: { section: S, path: [], field },
    codec: createChoiceFieldCodec<T>(values),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind,
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const requiredChoiceField = <T extends string>(
  field: string,
  label: string,
  values: readonly T[],
  emptyValue: T,
  controlKind: FieldControlKind = 'choice',
): FieldDescriptor<T> =>
  defineStructuralField<T>({
    id: `eo.${field}`,
    template: { section: S, path: [], field },
    codec: createRequiredChoiceFieldCodec(values, emptyValue),
    emptyValue,
    isEmpty: () => false,
    label,
    controlKind,
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const requiredJaNejField = (field: string, label: string, emptyValue: JaNej): FieldDescriptor<JaNej> =>
  requiredChoiceField(field, label, ['Ja', 'Nej'], emptyValue, 'toggle');

const requiredJaNejSkjulField = (
  field: string,
  label: string,
  emptyValue: JaNejSkjul
): FieldDescriptor<JaNejSkjul> =>
  requiredChoiceField(field, label, ['Ja', 'Nej', 'Skjul'], emptyValue);

// ── Base-blok ─────────────────────────────────────────────────────────────────────
// Længderne er kontraktens egne (§4.1: 7 tegn; §4.2: 64 tegn), ikke skønnede.
export const eoNummerField = optionalTextField('eoNummer', 'EO-nummer', EO_NUMMER_MAX_LENGTH);
export const eoLedsagetekstField = optionalTextField(
  'eoLedsagetekst', 'Ledsagetekst', EO_LEDSAGETEKST_MAX_LENGTH
);
export const eoOpgørelseLavetDenField = dateField(
  'opgørelseLavetDen', 'Opgørelse lavet den',
  dateBounds(skadedatoBoundedSpec(dateRanges_erstatningsopgoerelse.opgoerelse)),
);
export const eoIndsaetUdkastStempelField = requiredJaNejField('indsaetUdkastStempel', 'Indsæt udkast-stempel', 'Nej');
// «Vedrører perioden» er et skalar-dato-par. Kronologien lå KUN i legacy-validatoren som en
// `ValidationError` med et tekst-path, og rækkeoversigten (`buildEoErstatningsopgoerelseRows`) læser
// udelukkende core-feltissues — så fra > til kunne stå med normal formatering i oversigten, mens fejlen
// kun nåede frem som en generel invariant på Beregning-fanen. Reglen bor nu på descriptoren som alle andre.
const vedroererPeriodePair: DatePairBinding = {
  fra: () => eoVedroererPeriodeFraField,
  til: () => eoVedroererPeriodeTilField,
};
// Grænserne clampes bevidst IKKE mod modparten (jf. `dateOrderValidators.ts`): gjorde de det, ville
// bounds-reglen spise kronologireglen, og beskeden ville skifte til en intervaltekst, der ikke nævner
// den modgående dato. Kronologien ejes af `dateOrderValidator`, den ydre ramme af `dateBounds`.
export const eoVedroererPeriodeFraField = dateField(
  'vedroererPeriodeFra', 'Vedrører periode fra',
  dateBounds(
    {
      min: () => dateRanges_erstatningsopgoerelse.periodeFra.min,
      max: () => dateRanges_erstatningsopgoerelse.periodeFra.fallbackMax,
      origin: STATIC_DATE_BOUNDS,
    },
    [dateOrderValidator('fra', vedroererPeriodePair)],
  ),
);
export const eoVedroererPeriodeTilField = dateField(
  'vedroererPeriodeTil', 'Vedrører periode til',
  dateBounds(
    {
      min: () => dateRanges_erstatningsopgoerelse.periodeTil.fallbackMin,
      max: () => dateRanges_erstatningsopgoerelse.periodeTil.max,
      origin: STATIC_DATE_BOUNDS,
    },
    [dateOrderValidator('til', vedroererPeriodePair)],
  ),
);
export const eoRevideretOpgoerelseField = requiredJaNejField('revideretOpgoerelse', 'Revideret opgørelse', 'Nej');
export const eoMidlertidigtEetFraEetSidenField = requiredJaNejField('midlertidigtEetFraEetSiden', 'Midlertidigt EET indsættes fra Erhvervsevnetab-siden', 'Nej');
export const eoRegulerOffentligeYdelserField = requiredJaNejField('regulerOffentligeYdelser', 'Regulér offentlige ydelser', 'Ja');

export const eoForligAnsvarsgradProcentField: FieldDescriptor<number | undefined> = defineStructuralField<number | undefined>({
  id: 'eo.forligAnsvarsgradProcent',
  template: { section: S, path: [], field: 'forligAnsvarsgradProcent' },
  codec: createPercentFieldCodec({ allowNegative: false, allowDecimals: true }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Forlig ansvarsgrad (%)',
  controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
  validators: [percentBoundsValidator('eo.forligAnsvarsgradProcent.bounds', {
    minValue: 1,
    maxValue: 100,
    allowDecimals: true,
  }), (value, _field, view) => {
    const message = evaluateForligAnsvarsgradRules({
      forligAnsvarsgradProcent: value,
      forligAnsvarsgradBroek: view.readCanonical(eoForligAnsvarsgradBroekField.bind()),
      forligDato: view.readCanonical(eoForligDatoField.bind()),
    }).beggeUdfyldtFejl;
    return message === undefined ? undefined : { reason: 'rule', code: 'eo.forlig.beggeUdfyldt', message };
  }],
});

// Brøk-controllen bruges med standard-props; schematypen forbliver optionalString (tom brøk = undefined).
export const eoForligAnsvarsgradBroekField: FieldDescriptor<string | undefined> = defineStructuralField<string | undefined>({
  id: 'eo.forligAnsvarsgradBroek',
  template: { section: S, path: [], field: 'forligAnsvarsgradBroek' },
  codec: createFractionFieldCodec({
    maxDigits: DEFAULT_FRACTION_MAX_DIGITS,
    allowNegative: false,
    allowZeroNumerator: false,
    canonicalizeOnCommit: false,
    requireIntegerFraction: false,
  }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Forlig ansvarsgrad (brøk)',
  controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
  validators: [(value, _field, view) => {
    const forligAnsvarsgradProcent = view.readCanonical(eoForligAnsvarsgradProcentField.bind());
    const rulesMessage = evaluateForligAnsvarsgradRules({
      forligAnsvarsgradProcent,
      forligAnsvarsgradBroek: value,
      forligDato: view.readCanonical(eoForligDatoField.bind()),
    }).beggeUdfyldtFejl;
    if (rulesMessage !== undefined) {
      return { reason: 'rule', code: 'eo.forlig.beggeUdfyldt', message: rulesMessage };
    }
    const evaluation = evaluateForligsgrad({ forligAnsvarsgradProcent, forligAnsvarsgradBroek: value });
    return evaluation.status === 'invalid' && evaluation.reason === 'broek'
      ? { reason: 'rule', code: 'eo.forlig.broek', message: evaluation.message }
      : undefined;
  }],
});

const forligDatoBoundsSpec = skadedatoBoundedSpec(dateRanges_erstatningsopgoerelse.forligDato);
const forligDatoBounds = dateBounds(forligDatoBoundsSpec);

export const eoForligDatoField: FieldDescriptor<ISODateString | undefined> = defineStructuralField<ISODateString | undefined>({
  id: 'eo.forligDato',
  template: { section: S, path: [], field: 'forligDato' },
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Forligsdato',
  controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
  // Bounds deler nu spec med de øvrige EO-datoer; ansvarsgrad-reglen er feltets egen og bliver stående.
  // Rækkefølgen bevarer den hidtidige forrang: bounds FØRST, ansvarsgrad-reglen derefter. Den gamle
  // håndskrevne validator returnerede bounds-issuet i en tidlig return, så en dato uden for intervallet
  // aldrig nåede ansvarsgrad-kontrollen. `forligDatoBounds` holder erklæringen og bounds-validatoren
  // samlet, mens den feltlokale regel tilføjes efter den.
  ...forligDatoBounds,
  validators: [
    ...forligDatoBounds.validators,
    (value, _field, view) => {
      if (value === undefined) return undefined;
      const message = evaluateForligAnsvarsgradRules({
        forligAnsvarsgradProcent: view.readCanonical(eoForligAnsvarsgradProcentField.bind()),
        forligAnsvarsgradBroek: view.readCanonical(eoForligAnsvarsgradBroekField.bind()),
        forligDato: value,
      }).forligDatoFejl;
      return message === undefined ? undefined : { reason: 'rule', code: 'eo.forligDato.ansvarsgradMangler', message };
    },
  ],
});
export const eoKravPaaOevrigeErstatningskravField = requiredJaNejSkjulField('kravPaaOevrigeErstatningskrav', 'Krav på øvrige erstatningskrav', 'Ja');
// §3.4: «Maksimumlængden er 512 tegn.»
export const eoOffentligeYdelserKommentarerField = optionalTextField(
  'offentligeYdelserKommentarer', 'Kommentarer', EO_KOMMENTARER_MAX_LENGTH
);
export const eoSaerligeKommentarerField = optionalTextField('saerligeKommentarer', 'Særlige kommentarer');

export const eoAfsluttesMedField = requiredChoiceField<AfsluttesMed>(
  'erstatningsopgoerelseAfsluttesMed',
  'Afsluttes med',
  ['Bekræftet godkendt', 'Underskrift-linje', 'Ingen'],
  'Bekræftet godkendt'
);

export const eoBilagIndgaarField = requiredChoiceField<EoBilagLoenindkomstOgOffentligeYdelserIndgaar>(
  'eoBilagLoenindkomstOgOffentligeYdelserIndgaar',
  'Bilag: lønindkomst/off. ydelser indgår',
  ['Alle', 'Perioden'],
  'Perioden',
);

// ── Nested bilagsvalg (eoBilagSelection, 8 booleans) ──────────────────────────────
const bilagToggle = (field: string, label: string, emptyValue: boolean): FieldDescriptor<boolean> =>
  defineStructuralField<boolean>({
    id: `eo.eoBilagSelection.${field}`,
    template: { section: S, path: [{ kind: 'property', name: 'eoBilagSelection' }], field },
    codec: createBooleanFieldCodec(emptyValue),
    emptyValue,
    isEmpty: () => false,
    label,
    controlKind: 'toggle',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

export const eoBilagSelectionOpgoerelseField = bilagToggle('opgoerelse', 'Bilag: opgørelse', true);
export const eoBilagSelectionLoenindkomstField = bilagToggle('loenindkomst', 'Bilag: lønindkomst', true);
export const eoBilagSelectionOffentligeYdelserField = bilagToggle('offentligeYdelser', 'Bilag: offentlige ydelser', true);
export const eoBilagSelectionMidlertidigEetField = bilagToggle('midlertidigEet', 'Bilag: midlertidigt EET', true);
export const eoBilagSelectionShDageField = bilagToggle('shDage', 'Bilag: SH-dage', false);
export const eoBilagSelectionReguleringField = bilagToggle('regulering', 'Bilag: regulering', true);
export const eoBilagSelectionOkSatserField = bilagToggle('okSatser', 'Bilag: OK-satser', true);
export const eoBilagSelectionSygeferiegodtgoerelseField = bilagToggle('sygeferiegodtgoerelse', 'Bilag: sygeferiegodtgørelse', false);

// ── AES afgørelser (skalarer) ─────────────────────────────────────────────────────
export const eoVarigeMenAfgorelseField = requiredJaNejField('varigeMenAfgorelse', 'Varige mén-afgørelse', 'Nej');
// De fem AES-datoer og differencekravsdatoen deler grænseformen «tidligst skadesdagen, senest <max>».
// Alle seks stod uden validator, så datoer før skadedagen — og efter dags dato — kunne afsluttes canonical
// og nå hele vejen til en aktiv PDF-knap. Kun `max` skiller dem: afgørelsesdatoer kan ikke ligge
// i fremtiden, mens virkningsdatoer kan række et år frem.
export const eoMenAfgoerelseDatoField = dateField(
  'menAfgoerelseDato', 'Mén-afgørelsesdato',
  dateBounds(skadedatoBoundedSpec(dateRanges_erstatningsopgoerelse.menAfgoerelseDato)),
);
export const eoVerserendeKlageMenField = requiredJaNejField('verserendeKlageMen', 'Verserende klage (mén)', 'Nej');
export const eoMidlertidigtEETAfgorelseField = requiredJaNejField('midlertidigtEETAfgorelse', 'Midlertidigt EET-afgørelse', 'Nej');
export const eoMidlertidigEETAfgoerelseDatoField = dateField(
  'midlertidigEETAfgoerelseDato', 'Midlertidigt EET-afgørelsesdato',
  dateBounds(skadedatoBoundedSpec(dateRanges_erstatningsopgoerelse.midlertidigEETAfgoerelseDato)),
);
export const eoMidlertidigEETVirkningsdatoField = dateField(
  'midlertidigEETVirkningsdato', 'Midlertidigt EET-virkningsdato',
  dateBounds(skadedatoBoundedSpec(dateRanges_erstatningsopgoerelse.midlertidigEETVirkningsdato)),
);
export const eoEndeligtEETAfgorelseField = requiredJaNejField('endeligtEETAfgorelse', 'Endeligt EET-afgørelse', 'Nej');
export const eoEndeligEETAfgoerelseDatoField = dateField(
  'endeligEETAfgoerelseDato', 'Endeligt EET-afgørelsesdato',
  dateBounds(skadedatoBoundedSpec(dateRanges_erstatningsopgoerelse.endeligEETAfgoerelseDato)),
);
export const eoEndeligEETVirkningsdatoField = dateField(
  'endeligEETVirkningsdato', 'Endeligt EET-virkningsdato',
  dateBounds(skadedatoBoundedSpec(dateRanges_erstatningsopgoerelse.endeligEETVirkningsdato)),
);
export const eoVerserendeKlageEetField = requiredJaNejField('verserendeKlageEet', 'Verserende klage (EET)', 'Nej');
export const eoDifferencekravDatoField = dateField(
  'differencekravDato', 'Differencekravsdato',
  dateBounds(skadedatoBoundedSpec(dateRanges_erstatningsopgoerelse.differencekravDato)),
);

// ── Svie/smerte (skalarer) ──────────────────────────────────────────────────────
export const eoKravPaaSvieSmerteGodtgoerelseField = requiredJaNejSkjulField('kravPaaSvieSmerteGodtgoerelse', 'Krav på svie- og smertegodtgørelse', 'Ja');
export const eoSvieSmerteHelbredsstatusField = choiceField<Helbredsstatus>(
  'svieSmerteHelbredsstatus', 'Helbredsstatus', ['Sygemeldt', 'Delvist Sygemeldt', 'Raskmeldt'],
);
export const eoTidligereSsMaxField = requiredJaNejField('tidligereSsMax', 'Tidligere svie/smerte-max nået', 'Nej');
// Årsfelt: tocifrede år infereres; MIN_SVIESMERTE_YEAR..getCurrentYear er det afledte bounds-issue.
export const eoSvieSmerteSatserAarField = defineStructuralField<number | undefined>({
  id: 'eo.svieSmerteSatserAar',
  template: { section: S, path: [], field: 'svieSmerteSatserAar' },
  codec: createYearFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_SVIESMERTE_YEAR, maxYear: getCurrentYear() }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Svie/smerte satsår',
  controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
  validators: [yearBoundsValidator('eo.svieSmerteSatserAar.bounds', MIN_SVIESMERTE_YEAR, getCurrentYear)],
});
export const eoSvieSmerteDelvisSygemeldingSatsField = requiredChoiceField<SvieSmerteDelvisSygemeldingSats>(
  'svieSmerteDelvisSygemeldingSats', 'Sats ved delvis sygemelding', ['fuld', 'halv'], 'halv',
);
export const eoSvieSmerteTidligereTotalField = amountField('svieSmerteTidligereTotal', 'Tidligere udbetalt svie/smerte');
export const eoSvieSmerteAktuelPeriodeField = amountField('svieSmerteAktuelPeriode', 'Svie/smerte aktuel periode');

// ── TAF (skalarer) ──────────────────────────────────────────────────────────────
export const eoKravPaaTabtArbejdsfortjenesteField = requiredJaNejSkjulField('kravPaaTabtArbejdsfortjeneste', 'Krav på tabt arbejdsfortjeneste', 'Ja');
export const eoTafArbejdsstatusField = choiceField<Arbejdsstatus>('tafArbejdsstatus', 'Arbejdsstatus', [
  'Uarbejdsdygtig', 'Delvist raskmeldt', 'Fuldt arbejdsdygtig', 'Fleksjob', 'Revalidering', 'Uddannelse',
  'Førtidspension', 'Seniorpension', 'Folkepension', 'Efterløn', 'Kontanthjælp',
]);
// Uden en kendt domæneregel: systemets ydre ramme. Den fanger et forkert århundrede uden at påstå en
// juridisk grænse, feltet ikke har.
export const eoSidsteDagAnsaettelsesforholdField = dateField(
  'sidsteDagAnsaettelsesforhold', 'Sidste dag i ansættelsesforhold', dateBounds(systemrammeSpec),
);
export const eoTidligereModtagetTafField = amountField('tidligereModtagetTaf', 'Tidligere modtaget TAF');

// ── Indtægt før skaden (skalarer, fanen lønindkomst) ──────────────────────────────
export const eoKomprimerBeregningField = requiredJaNejField('komprimerBeregningEfterFoersteOpgoerelse', 'Komprimér beregning efter første opgørelse', 'Ja');
export const eoBeregnesUdFraField = requiredChoiceField<Beregningsmetode>(
  'beregnesUdFra', 'Beregnes ud fra', ['Beregningsperiode', 'Angivet månedsløn', 'Angivet dagsløn'], 'Beregningsperiode',
);
// Beregningsperioden er ligeledes et dato-par.
const tafBeregningsperiodePair: DatePairBinding = {
  fra: () => eoTafBeregningsperiodeFraField,
  til: () => eoTafBeregningsperiodeTilField,
};
export const eoTafBeregningsperiodeFraField = dateField(
  'tafBeregningsperiodeFra', 'Beregningsperiode fra',
  dateBounds(systemrammeSpec, [dateOrderValidator('fra', tafBeregningsperiodePair)]),
);
export const eoTafBeregningsperiodeTilField = dateField(
  'tafBeregningsperiodeTil', 'Beregningsperiode til',
  dateBounds(systemrammeSpec, [dateOrderValidator('til', tafBeregningsperiodePair)]),
);
export const eoUspecificeredeFerieFridageField = integerField('uspecificeredeFerieFridage', 'Uspecificerede ferie-/fridage');
export const eoOevrigtFravaerUdenLoenField = requiredJaNejField('oevrigtFravaerUdenLoen', 'Øvrigt fravær uden løn', 'Nej');
export const eoOevrigeFravaersdageField = integerField('oevrigeFravaersdage', 'Øvrige fraværsdage');
export const eoOevrigeFravaersdageBeskrivelseField = optionalTextField('oevrigeFravaersdageBeskrivelse', 'Beskrivelse af øvrige fraværsdage');
export const eoMaanedsloenenUdgoerField = amountField('maanedsloenenUdgoer', 'Månedslønnen udgør');
export const eoDagsloenenUdgoerField = amountField('dagsloenenUdgoer', 'Dagslønnen udgør');
export const eoAngivetMaanedsloenBaseretPaaField = optionalTextField('angivetMaanedsloenBaseretPaa', 'Angivet månedsløn baseret på');
export const eoAngivetMaanedsloenOpreguleresFraDatoField = dateField(
  'angivetMaanedsloenOpreguleresFraDato', 'Angivet månedsløn opreguleres fra', dateBounds(systemrammeSpec),
);
export const eoAngivetDagsloenBaseretPaaField = optionalTextField('angivetDagsloenBaseretPaa', 'Angivet dagsløn baseret på');
export const eoAngivetDagsloenOpreguleresFraDatoField = dateField(
  'angivetDagsloenOpreguleresFraDato', 'Angivet dagsløn opreguleres fra', dateBounds(systemrammeSpec),
);

// ── Bilagsnumre (skalarer) ────────────────────────────────────────────────────────
export const eoVisBilagsnumreField = requiredJaNejField('visBilagsnumre', 'Vis bilagsnumre', 'Nej');
export const eoBilagsnumreMenAfgoerelseField = optionalTextField('bilagsnumreMenAfgoerelse', 'Bilagsnr. mén-afgørelse');
export const eoBilagsnumreEetAfgoerelserField = optionalTextField('bilagsnumreEetAfgoerelser', 'Bilagsnr. EET-afgørelser');
export const eoBilagsnumreSvieSmerteDokumentationField = optionalTextField('bilagsnumreSvieSmerteDokumentation', 'Bilagsnr. svie/smerte-dokumentation');
export const eoBilagsnumreBeregningsgrundlagTafField = optionalTextField('bilagsnumreBeregningsgrundlagTaf', 'Bilagsnr. beregningsgrundlag TAF');
export const eoBilagsnumreLoenISygeperiodenField = optionalTextField('bilagsnumreLoenISygeperioden', 'Bilagsnr. løn i sygeperioden');
export const eoBilagsnumreOffentligeYdelserField = optionalTextField('bilagsnumreOffentligeYdelser', 'Bilagsnr. offentlige ydelser');
export const eoBilagsnumreOevrigeErstatningskravField = optionalTextField('bilagsnumreOevrigeErstatningskrav', 'Bilagsnr. øvrige erstatningskrav');

// ── Rene top-level samlinger + rækkefelter ─────────────────────────────────────────
const rowTemplate = (collection: string, field: string): FieldAddressTemplate => ({
  section: S, path: [{ kind: 'entity', collection }], field,
});

const rowDate = (
  collection: string,
  field: string,
  label: string,
  bounds: DateFieldBounds
): FieldDescriptor<ISODateString | undefined> =>
  defineStructuralField<ISODateString | undefined>({
    id: `eo.${collection}.${field}`,
    template: rowTemplate(collection, field),
    codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
    ...bounds,
  });

/**
 * Bygger fra/til-parret for en rækkekollektion som ÉN enhed.
 *
 * Parret dannes samlet, fordi de to halvdele refererer hinanden: registreres de hver for sig, kan et
 * kaldssted glemme den ene validator, og kronologien ville da kun være markeret fra den ene side —
 * præcis den halve dækning, fundet handler om. `rowIdOf` binder modparten i SAMME række.
 */
const rowDatePair = (
  collection: string,
  fraField: string,
  tilField: string,
  fraLabel: string,
  tilLabel: string,
  specs: Readonly<{ fra: DateBoundsSpec; til: DateBoundsSpec }>
): Readonly<{
  fra: FieldDescriptor<ISODateString | undefined>;
  til: FieldDescriptor<ISODateString | undefined>;
}> => {
  const rowIdOf = <T>(field: FieldRef<T>): string => {
    const entity = field.address.path.find(
      (segment) => segment.kind === 'entity' && segment.collection === collection
    );
    if (entity?.kind !== 'entity') {
      throw new Error(`EO-feltet ${field.descriptor.id} mangler ${collection}-entity`);
    }
    return entity.entityId;
  };
  const pair: DatePairBinding = {
    fra: () => fra,
    til: () => til,
    bindIds: (field) => [rowIdOf(field)],
  };
  const fra = rowDate(collection, fraField, fraLabel, dateBounds(specs.fra, [dateOrderValidator('fra', pair)]));
  const til = rowDate(collection, tilField, tilLabel, dateBounds(specs.til, [dateOrderValidator('til', pair)]));
  return { fra, til };
};

const topLevelCollection = <TEntity extends Readonly<Record<string, unknown>>>(
  collection: string,
  isEntityEmpty?: (entity: TEntity, index: number) => boolean
) =>
  defineStructuralCollection<TEntity>({
    id: `eo.${collection}`,
    template: { section: S, path: [], collection },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
    ...(isEntityEmpty === undefined ? {} : { isEntityEmpty }),
  });

// tafPerioder
export const eoTafPerioderCollection = topLevelCollection<TafPeriodeRow>('tafPerioder', isTafRowEmpty);
// TAF-perioderne deklarerede min = skadedato i konfigurationen, men håndhævede den kun i
// rækkeevaluerings-motoren, som producerer et kolonne-hint uden feltadresse — teksten kunne stå i
// "Fejl og advarsler", mens cellen aldrig blev rød. Grænsen bor nu på descriptoren.
const tafPeriodeDates = rowDatePair('tafPerioder', 'fra', 'til', 'Fra o.m.', 'Til o.m.', {
  fra: skadedatoBoundedSpec({
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMin,
    max: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMax,
  }),
  til: skadedatoBoundedSpec({
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelTAFTil.fallbackMin,
    max: dateRanges_erstatningsopgoerelse.tabelTAFTil.fallbackMax,
  }),
});
export const eoTafPeriodeFraField = tafPeriodeDates.fra;
export const eoTafPeriodeTilField = tafPeriodeDates.til;
export const eoTafPeriodeLoseFeriedageField = defineStructuralField<number | undefined>({
  id: 'eo.tafPerioder.loseFeriedage',
  template: rowTemplate('tafPerioder', 'loseFeriedage'),
  codec: createIntegerFieldCodec({ allowNegative: false }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Løse feriedage',
  controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
  validators: [integerBoundsValidator('eo.tafPerioder.loseFeriedage.bounds', 0, undefined)],
});

// ferieperioder
export const eoFerieperioderCollection = topLevelCollection<FerieperiodeRow>('ferieperioder', isFerieRowEmpty);
// Ferieperioderne er erklæret `unconstrained` i konfigurationen (optjeningsår kan ligge før skaden), så de
// får systemets ydre ramme frem for en skadedato-grænse — nok til at fange et forkert århundrede.
const ferieperiodeDates = rowDatePair('ferieperioder', 'fra', 'til', 'Fra o.m.', 'Til o.m.', {
  fra: systemrammeSpec,
  til: systemrammeSpec,
});
export const eoFerieperiodeFraField = ferieperiodeDates.fra;
export const eoFerieperiodeTilField = ferieperiodeDates.til;

// fravaerPerioder (samme rækkeform som ferieperioder)
export const eoFravaerPerioderCollection = topLevelCollection<FerieperiodeRow>('fravaerPerioder', isFerieRowEmpty);
const fravaerPeriodeDates = rowDatePair('fravaerPerioder', 'fra', 'til', 'Fra o.m.', 'Til o.m.', {
  fra: systemrammeSpec,
  til: systemrammeSpec,
});
export const eoFravaerPeriodeFraField = fravaerPeriodeDates.fra;
export const eoFravaerPeriodeTilField = fravaerPeriodeDates.til;

// svieSmertePerioder
export const eoSvieSmertePerioderCollection = topLevelCollection<SvieSmertePeriodeRow>(
  'svieSmertePerioder',
  isSvieSmerteRowEmpty
);
const svieSmertePeriodeDates = rowDatePair('svieSmertePerioder', 'fra', 'til', 'Fra o.m.', 'Til o.m.', {
  fra: skadedatoBoundedSpec({
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMin,
    max: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMax,
  }),
  til: skadedatoBoundedSpec({
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelSvieSmerteTil.fallbackMin,
    max: dateRanges_erstatningsopgoerelse.tabelSvieSmerteTil.max,
  }),
});
export const eoSvieSmertePeriodeFraField = svieSmertePeriodeDates.fra;
export const eoSvieSmertePeriodeTilField = svieSmertePeriodeDates.til;
export const eoSvieSmertePeriodeTilstandField = defineStructuralField<Tilstand | undefined>({
  id: 'eo.svieSmertePerioder.tilstand',
  template: rowTemplate('svieSmertePerioder', 'tilstand'),
  codec: createChoiceFieldCodec<Tilstand>(['sygemeldt', 'delvist-sygemeldt']),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Tilstand',
  controlKind: 'choice',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

// oevrigeKravPerioder
export const eoOevrigeKravPerioderCollection = topLevelCollection<OevrigeKravRow>(
  'oevrigeKravPerioder',
  isOevrigeKravRowEmpty
);
// Datoens dynamiske grænser (min=skadedatoMinRule / max=i dag) er en canonical
// bounds-feltvalidator (§1.6). Den krydslæser skadedato og
// skadestype via `view.readCanonical` (ingen recursion — validators læser canonical, ikke issues).
export const eoOevrigeKravDatoField: FieldDescriptor<ISODateString | undefined> = defineStructuralField<ISODateString | undefined>({
  id: 'eo.oevrigeKravPerioder.dato',
  template: rowTemplate('oevrigeKravPerioder', 'dato'),
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Dato',
  controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
  // Var en håndskrevet kopi af skadedato-reglen; deler nu spec med de øvrige EO-datoer.
  ...dateBounds(skadedatoBoundedSpec(dateRanges_erstatningsopgoerelse.tabelOevrigeKravDato)),
});
export const eoOevrigeKravUdgiftTilField = defineStructuralField<string>({
  id: 'eo.oevrigeKravPerioder.udgiftTil',
  template: rowTemplate('oevrigeKravPerioder', 'udgiftTil'),
  codec: createTextFieldCodec(),
  emptyValue: '',
  isEmpty: (value) => value === '',
  label: 'Udgift til',
  controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});
export const eoOevrigeKravBeloebField = defineStructuralField<AmountValue | undefined>({
  id: 'eo.oevrigeKravPerioder.beloeb',
  template: rowTemplate('oevrigeKravPerioder', 'beloeb'),
  codec: createAmountFieldCodec({ allowNegative: false, allowDecimals: true }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Beløb',
  controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
  validators: [amountBoundsValidator('eo.oevrigeKravPerioder.beloeb.bounds', 0, undefined)],
});

// offentligeYdelserRows (ydelse/tillaeg tillader negative jf. TableAmountInput-default)
export const eoOffentligeYdelserRowsCollection = topLevelCollection<OffentligeYdelserRow>(
  'offentligeYdelserRows',
  isOffentligeYdelserRowEmpty
);
// Offentlige ydelser har sin EGEN ramme: satsdækningen for sygedagpenge og ATP, ikke skadedatoen.
// Grænserne stod hidtil kun som `minDate`/`maxDate`-props på inputkomponenten i `OffentligeYdelserTab.tsx`
// — altså som en visuel hjælp uden et issue bag, så en dato uden for satsdækningen blev afsluttet
// canonical uden fejl. Konfigurationen er nu den håndhævede kilde.
const offentligeYdelserDates = rowDatePair(
  'offentligeYdelserRows', 'fraDato', 'tilDato', 'Fra dato', 'Til dato',
  {
    fra: {
      min: () => dateRanges_offentligeYdelser.fraDato.min,
      max: () => dateRanges_offentligeYdelser.fraDato.fallbackMax,
      origin: STATIC_DATE_BOUNDS,
    },
    til: {
      min: () => dateRanges_offentligeYdelser.tilDato.fallbackMin,
      max: () => dateRanges_offentligeYdelser.tilDato.max,
      origin: STATIC_DATE_BOUNDS,
    },
  },
);
export const eoOffentligeYdelserFraDatoField = offentligeYdelserDates.fra;
export const eoOffentligeYdelserTilDatoField = offentligeYdelserDates.til;
const offentligYdelseAmount = (field: string, label: string): FieldDescriptor<AmountValue | undefined> =>
  defineStructuralField<AmountValue | undefined>({
    id: `eo.offentligeYdelserRows.${field}`,
    template: rowTemplate('offentligeYdelserRows', field),
    codec: createAmountFieldCodec({ allowNegative: true, allowDecimals: true }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
export const eoOffentligeYdelserYdelseField = offentligYdelseAmount('ydelse', 'Ydelse');
export const eoOffentligeYdelserTillaegField = offentligYdelseAmount('tillaeg', 'Tillæg');
// ydelsestype er et frit valg fra ydelsestype-kataloget; registreres som fritekst (valgmængden bor i data-laget).
export const eoOffentligeYdelserYdelsestypeField = defineStructuralField<string | undefined>({
  id: 'eo.offentligeYdelserRows.ydelsestype',
  template: rowTemplate('offentligeYdelserRows', 'ydelsestype'),
  codec: createOptionalTextFieldCodec(),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Ydelsestype',
  controlKind: 'choice',
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

// sfggAnsaettelsesforhold — samling med custom entity-id (`ansaettelsesforholdId`).
const SFGG = 'sfggAnsaettelsesforhold';
const sfggEntityIdProps = { [SFGG]: 'ansaettelsesforholdId' } as const;

export const eoSfggAnsaettelsesforholdCollection = defineStructuralCollection<SygeferiegodtgoerelseAnsaettelsesforholdRow>({
  id: 'eo.sfggAnsaettelsesforhold',
  template: { section: S, path: [], collection: SFGG },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
  entityIdProperty: 'ansaettelsesforholdId',
});

const sfggField = <T>(
  field: string,
  label: string,
  codec: FieldCodec<T>,
  emptyValue: T,
  isEmpty: (value: T) => boolean,
  controlKind: FieldControlKind,
  validators?: readonly FieldValidator<T>[],
): FieldDescriptor<T> =>
  defineStructuralField<T>({
    id: `eo.sfggAnsaettelsesforhold.${field}`,
    template: rowTemplate(SFGG, field),
    codec,
    emptyValue,
    isEmpty,
    label,
    controlKind,
    createEmptySection: createEmptyErstatningsopgoerelseSection,
    entityIdProperties: sfggEntityIdProps,
    ...(validators === undefined ? {} : { validators }),
  });

export const eoSfggBeregningskildeField = sfggField<SygeferiegodtgoerelseBeregningskilde | undefined>(
  'sfggBeregningskilde', 'Beregningskilde',
  createChoiceFieldCodec<SygeferiegodtgoerelseBeregningskilde>(['Overenskomst', 'Manuelt angivet', 'Ferieloven', 'Ingen']),
  undefined, isUndefined, 'choice',
);
// SFGG-referenceperioden er også et dato-par og skal derfor bære samme kronologiregel som de øvrige
//. Parret bindes gennem SFGG-samlingens egen entity, ikke `rowDatePair`, fordi rækkerne
// identificeres af `ansaettelsesforholdId` frem for det generiske række-id.
const sfggReferenceperiodePair: DatePairBinding = {
  fra: () => eoSfggReferenceperiodeFraField,
  til: () => eoSfggReferenceperiodeTilField,
  bindIds: (field) => {
    const entity = field.address.path.find(
      (segment) => segment.kind === 'entity' && segment.collection === SFGG
    );
    if (entity?.kind !== 'entity') {
      throw new Error(`EO-feltet ${field.descriptor.id} mangler ${SFGG}-entity`);
    }
    return [entity.entityId];
  },
};
export const eoSfggReferenceperiodeFraField = defineStructuralField<ISODateString | undefined>({
  id: 'eo.sfggAnsaettelsesforhold.sfggReferenceperiodeFra',
  template: rowTemplate(SFGG, 'sfggReferenceperiodeFra'),
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined, isEmpty: isUndefined, label: 'Referenceperiode fra', controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection, entityIdProperties: sfggEntityIdProps,
  ...dateBounds(systemrammeSpec, [dateOrderValidator('fra', sfggReferenceperiodePair)]),
});
export const eoSfggReferenceperiodeTilField = defineStructuralField<ISODateString | undefined>({
  id: 'eo.sfggAnsaettelsesforhold.sfggReferenceperiodeTil',
  template: rowTemplate(SFGG, 'sfggReferenceperiodeTil'),
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined, isEmpty: isUndefined, label: 'Referenceperiode til', controlKind: 'text',
  createEmptySection: createEmptyErstatningsopgoerelseSection, entityIdProperties: sfggEntityIdProps,
  ...dateBounds(systemrammeSpec, [dateOrderValidator('til', sfggReferenceperiodePair)]),
});
export const eoSfggReferenceperiodeFravaersdageUdenLoenField = sfggField<number | undefined>(
  'sfggReferenceperiodeFravaersdageUdenLoen', 'Fraværsdage uden løn i referenceperioden',
  createIntegerFieldCodec({ allowNegative: false }), undefined, isUndefined, 'text',
  [integerBoundsValidator('eo.sfggAnsaettelsesforhold.sfggReferenceperiodeFravaersdageUdenLoen.bounds', 0, undefined)],
);
export const eoSfggManuelDagssatsField = sfggField<AmountValue | undefined>(
  'sfggManuelDagssats', 'Manuel dagssats',
  createAmountFieldCodec({ allowNegative: false, allowDecimals: true }), undefined, isUndefined, 'text',
  [amountBoundsValidator('eo.sfggAnsaettelsesforhold.sfggManuelDagssats.bounds', 0, undefined)],
);
export const eoSfggManuelBeloebIHenholdTilField = sfggField<string | undefined>(
  'sfggManuelBeloebIHenholdTil', 'Beløb i henhold til',
  createOptionalTextFieldCodec(), undefined, isUndefined, 'text',
);
export const eoSfggManuelFoerstEfterSygeloenField = sfggField<JaNej>(
  'sfggManuelFoerstEfterSygeloen', 'Først efter sygeløn',
  createRequiredChoiceFieldCodec<JaNej>(['Ja', 'Nej'], 'Nej'), 'Nej', () => false, 'choice',
);
export const eoSfggSatsvalgField = sfggField<SygeferiegodtgoerelseSatsvalg | undefined>(
  'sfggSatsvalg', 'Satsvalg',
  createChoiceFieldCodec<SygeferiegodtgoerelseSatsvalg>([
    'Faglaert-Koebenhavn', 'Faglaert-Provinsen', 'Ufaglaert-Koebenhavn', 'Ufaglaert-Provinsen',
  ]), undefined, isUndefined, 'choice',
);
export const eoSfggAlleredeBetaltBeloebField = sfggField<AmountValue | undefined>(
  'sfggAlleredeBetaltBeloeb', 'Allerede betalt beløb',
  createAmountFieldCodec({ allowNegative: false, allowDecimals: true }), undefined, isUndefined, 'text',
  [amountBoundsValidator('eo.sfggAnsaettelsesforhold.sfggAlleredeBetaltBeloeb.bounds', 0, undefined)],
);

export const erstatningsopgoerelseFields = catalogFields(
  eoNummerField,
  eoLedsagetekstField,
  eoOpgørelseLavetDenField,
  eoIndsaetUdkastStempelField,
  eoVedroererPeriodeFraField,
  eoVedroererPeriodeTilField,
  eoRevideretOpgoerelseField,
  eoMidlertidigtEetFraEetSidenField,
  eoRegulerOffentligeYdelserField,
  eoAfsluttesMedField,
  eoForligAnsvarsgradProcentField,
  eoForligAnsvarsgradBroekField,
  eoForligDatoField,
  eoKravPaaOevrigeErstatningskravField,
  eoOffentligeYdelserKommentarerField,
  eoSaerligeKommentarerField,
  eoBilagIndgaarField,
  eoBilagSelectionOpgoerelseField,
  eoBilagSelectionLoenindkomstField,
  eoBilagSelectionOffentligeYdelserField,
  eoBilagSelectionMidlertidigEetField,
  eoBilagSelectionShDageField,
  eoBilagSelectionReguleringField,
  eoBilagSelectionOkSatserField,
  eoBilagSelectionSygeferiegodtgoerelseField,
  eoVarigeMenAfgorelseField,
  eoMenAfgoerelseDatoField,
  eoVerserendeKlageMenField,
  eoMidlertidigtEETAfgorelseField,
  eoMidlertidigEETAfgoerelseDatoField,
  eoMidlertidigEETVirkningsdatoField,
  eoEndeligtEETAfgorelseField,
  eoEndeligEETAfgoerelseDatoField,
  eoEndeligEETVirkningsdatoField,
  eoVerserendeKlageEetField,
  eoDifferencekravDatoField,
  eoKravPaaSvieSmerteGodtgoerelseField,
  eoSvieSmerteHelbredsstatusField,
  eoTidligereSsMaxField,
  eoSvieSmerteSatserAarField,
  eoSvieSmerteDelvisSygemeldingSatsField,
  eoSvieSmerteTidligereTotalField,
  eoSvieSmerteAktuelPeriodeField,
  eoKravPaaTabtArbejdsfortjenesteField,
  eoTafArbejdsstatusField,
  eoSidsteDagAnsaettelsesforholdField,
  eoTidligereModtagetTafField,
  eoKomprimerBeregningField,
  eoBeregnesUdFraField,
  eoTafBeregningsperiodeFraField,
  eoTafBeregningsperiodeTilField,
  eoUspecificeredeFerieFridageField,
  eoOevrigtFravaerUdenLoenField,
  eoOevrigeFravaersdageField,
  eoOevrigeFravaersdageBeskrivelseField,
  eoMaanedsloenenUdgoerField,
  eoDagsloenenUdgoerField,
  eoAngivetMaanedsloenBaseretPaaField,
  eoAngivetMaanedsloenOpreguleresFraDatoField,
  eoAngivetDagsloenBaseretPaaField,
  eoAngivetDagsloenOpreguleresFraDatoField,
  eoVisBilagsnumreField,
  eoBilagsnumreMenAfgoerelseField,
  eoBilagsnumreEetAfgoerelserField,
  eoBilagsnumreSvieSmerteDokumentationField,
  eoBilagsnumreBeregningsgrundlagTafField,
  eoBilagsnumreLoenISygeperiodenField,
  eoBilagsnumreOffentligeYdelserField,
  eoBilagsnumreOevrigeErstatningskravField,
  eoTafPeriodeFraField,
  eoTafPeriodeTilField,
  eoTafPeriodeLoseFeriedageField,
  eoFerieperiodeFraField,
  eoFerieperiodeTilField,
  eoSfggBeregningskildeField,
  eoSfggReferenceperiodeFraField,
  eoSfggReferenceperiodeTilField,
  eoSfggReferenceperiodeFravaersdageUdenLoenField,
  eoSfggManuelDagssatsField,
  eoSfggManuelBeloebIHenholdTilField,
  eoSfggManuelFoerstEfterSygeloenField,
  eoSfggSatsvalgField,
  eoSfggAlleredeBetaltBeloebField,
  eoFravaerPeriodeFraField,
  eoFravaerPeriodeTilField,
  eoSvieSmertePeriodeFraField,
  eoSvieSmertePeriodeTilField,
  eoSvieSmertePeriodeTilstandField,
  eoOevrigeKravDatoField,
  eoOevrigeKravUdgiftTilField,
  eoOevrigeKravBeloebField,
  eoOffentligeYdelserFraDatoField,
  eoOffentligeYdelserTilDatoField,
  eoOffentligeYdelserYdelseField,
  eoOffentligeYdelserTillaegField,
  eoOffentligeYdelserYdelsestypeField,
);

export const erstatningsopgoerelseCollections = catalogCollections(
  eoTafPerioderCollection,
  eoFerieperioderCollection,
  eoSfggAnsaettelsesforholdCollection,
  eoFravaerPerioderCollection,
  eoSvieSmertePerioderCollection,
  eoOevrigeKravPerioderCollection,
  eoOffentligeYdelserRowsCollection,
);
