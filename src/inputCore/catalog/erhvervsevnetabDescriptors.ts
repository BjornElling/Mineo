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
import {
  resolveDateRangeErrorMessage,
  derivedDateBounds,
  type DateRangeSpecialErrors,
} from '../../utils/dateRangeErrorMessages';
import { getDayBeforeIso, maxISO } from '../../utils/isoDateHelpers';
import { dateBounds } from './dateBoundsValidators';
import type { DateBoundsSpec } from '../dateBoundsDeclaration';
import {
  isAslAfgoerelseRowPersistenceEmpty,
  KAP_DATO_NOT_ALLOWED_BY_AFGOERELSE_TYPE_MESSAGE,
  TIDL_KAP_DATO_WITHOUT_KAPITALISERING_MESSAGE,
  validatePercentDivisibleBy5FromValue,
  validatePercentNotZero,
} from '../../domain/erhvervsevnetab/eetAslAfgoerelser';
import {
  createBooleanFieldCodec,
  createChoiceFieldCodec,
  createDateFieldCodec,
  createPercentFieldCodec,
  createRequiredChoiceFieldCodec,
} from '../fieldCodecs';
import { validResolution } from '../fieldCodec';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import { createCollectionRef, type CollectionRef } from '../fieldAddress';
import type {
  CanonicalView,
  FieldAddressTemplate,
  FieldDescriptor,
  FieldRef,
  FieldValidator,
} from '../fieldDescriptor';
import {
  defineStructuralCollection,
  defineStructuralField,
  isUndefined,
} from '../structuralDescriptors';
import { percentBoundsValidator } from './boundsValidators';
import {
  resolveStamdataDatoReferenceFromView,
  stamdataSkadedatoField,
  withStamdataDatoReference,
} from './stamdataDescriptors';
import { opregulerMedAkkumuleretReguleringssats } from '../../domain/satser/opreguleringsmotorer';
import { reguleringssats } from '../../data/lovbestemteRates';

// Produkt-descriptors for `erhvervsevnetab`-sektionen (§3.2): skalarer (herunder differencekrav-
// booleans), det nested bilagsvalgsobjekt og samlingen `aslAfgoerelser` med dens rækkefelter.
// Den tomme sektion er sektionens fulde canonical default; bilagsvalgsobjektet skal findes, for at en
// nested boolean kan skrives.

const createEmptyErhvervsevnetabSection = (): unknown =>
  structuredClone(ERHVERVSEVNETAB_INITIAL_VALUES as PersistedSectionMap['erhvervsevnetab']);

// Beregningsdatoens dynamiske minimum og faste maksimum er en canonical bounds-FELTVALIDATOR (§1.6).
// Grænserne kommer fra `dateRanges_erhvervsevnetab`; Skadedato krydslæses via `view.readCanonical`,
// fordi den canonical dato bestemmer minimumsgrænsen.
/**
 * Gulvet ER skadedatoen – bemærk at det sættes via `min`, ikke `narrowMin`. `narrowMin` clamper med
 * `maxISO` og kan kun HÆVE gulvet; her skal en skadedato FØR 2005 tværtimod sænke det tilsvarende.
 */
const eetBeregningsdatoBoundsSpec: DateBoundsSpec = {
  min: (context) => context.view.readCanonical(stamdataSkadedatoField.bind())
    ?? dateRanges_erhvervsevnetab.beregningsdato.fallbackMin,
  max: () => dateRanges_erhvervsevnetab.beregningsdato.max,
  special: () => ({ maxBoundKind: 'eetDataMax', maxBoundFieldLabel: 'Beregningsdato' }),
  // Min ER skadedatoen (uden clamp), så en skadedato efter datadækningen gør intervallet umuligt.
  origin: (context) => derivedDateBounds(resolveStamdataDatoReferenceFromView(context.view).label),
};
const eetBeregningsdatoBounds = dateBounds(eetBeregningsdatoBoundsSpec);

export const erhvervsevnetabBeregningsdatoField = defineStructuralField<ISODateString | undefined>({
  id: 'erhvervsevnetab.beregningsdato',
  template: { section: 'erhvervsevnetab', path: [], field: 'beregningsdato' },
  codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Beregningsdato',
  controlKind: 'text',
  createEmptySection: createEmptyErhvervsevnetabSection,
  ...eetBeregningsdatoBounds,
  validators: [
    ...eetBeregningsdatoBounds.validators,
    (value, _field, view) => {
      if (value === undefined) return undefined;
      const skadedato = view.readCanonical(stamdataSkadedatoField.bind());
      if (skadedato === undefined) return undefined;
      const skadesaar = Number.parseInt(skadedato.slice(0, 4), 10);
      const beregningsaar = Number.parseInt(value.slice(0, 4), 10);
      const { manglendeAar } = opregulerMedAkkumuleretReguleringssats(
        { kildeAar: skadesaar, maalAar: beregningsaar },
        reguleringssats
      );
      return manglendeAar.length === 0
        ? undefined
        : {
          reason: 'rule',
          code: 'erhvervsevnetab.beregningsdato.reguleringssats',
          message: `EAL-beregningen kan ikke gennemføres, fordi der mangler reguleringssats for ${manglendeAar.join(', ')}.`,
        };
    },
  ],
});

/**
 * Om EET-beregningsdatoen kan bruges som grundlag for en årsafhængig feltgrænse.
 *
 * `CanonicalView` viser med vilje kun canonical værdier og ikke andre felters issues. Derfor er det ikke nok
 * at finde en dato: en dato før skadedatoen er stadig canonical, men har en rød bounds-fejl. Årslønsfeltet
 * bruger denne fælles validatorliste, så den ikke kommer til at vise en årsgrænse, som datoen selv ikke må
 * bruges til at aflede.
 */
export const isValidErhvervsevnetabBeregningsdato = (view: CanonicalView): boolean => {
  const field = erhvervsevnetabBeregningsdatoField.bind();
  const value = view.readCanonical(field);
  if (value === undefined) return false;
  return (field.descriptor.validators ?? []).every((validator) => validator(value, field, view) === undefined);
};

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
const ealEetPctBaseCodec = createPercentFieldCodec({ allowNegative: false, allowDecimals: false });
const ealEetPctCodec = Object.freeze({
  ...ealEetPctBaseCodec,
  parseForSettle: (raw: string) => {
    const resolution = ealEetPctBaseCodec.parseForSettle(raw);
    return resolution.status === 'valid' && resolution.value === 0
      ? validResolution<number | undefined>(undefined)
      : resolution;
  },
});

export const erhvervsevnetabEalEetPctField = defineStructuralField<number | undefined>({
  id: 'erhvervsevnetab.ealEetPct',
  template: { section: 'erhvervsevnetab', path: [], field: 'ealEetPct' },
  // EET-feltets etablerede semantik er, at 0 betyder "ingen afvigelse" og derfor canonicaliseres til tomt.
  codec: ealEetPctCodec,
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'EET % (hvis afviger fra ASL)',
  controlKind: 'text',
  createEmptySection: createEmptyErhvervsevnetabSection,
  validators: [
    percentBoundsValidator('erhvervsevnetab.ealEetPct.bounds', {
      minValue: 0,
      maxValue: 100,
      allowDecimals: false,
    }),
    (value) => {
      const message = validatePercentDivisibleBy5FromValue(value, 'EET %');
      return message === undefined ? undefined : {
        reason: 'rule', code: 'erhvervsevnetab.ealEetPct.divisibleBy5', message,
      };
    },
  ],
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
  isEntityEmpty: (row) => isAslAfgoerelseRowPersistenceEmpty(row),
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

const aslRowIdOf = <T>(field: FieldRef<T>): string => {
  const entity = field.address.path.find(
    (segment) => segment.kind === 'entity' && segment.collection === 'aslAfgoerelser'
  );
  if (entity?.kind !== 'entity') throw new Error(`EET-rækkefeltet ${field.descriptor.id} mangler rækkeidentitet`);
  return entity.entityId;
};

type AslDateRole = 'afgoerelsesDato' | 'virkningsDato' | 'kapDato' | 'tidlKapDato';

const aslDateBoundsValidator = (role: AslDateRole): FieldValidator<ISODateString | undefined> =>
  (value, field, view) => {
    if (value === undefined) return undefined;
    const rowId = aslRowIdOf(field);
    const skadedato = view.readCanonical(stamdataSkadedatoField.bind());
    const fallbackMin = dateRanges_erhvervsevnetab.tabelAfgoerelsesdato.fallbackMin;
    const skadedatoMin = skadedato ?? fallbackMin;
    const afgoerelsesDato = role === 'afgoerelsesDato'
      ? value
      : view.readCanonical(aslAfgoerelseAfgoerelsesDatoField.bind(rowId));
    const skadedatoMinIsEffective = skadedato !== undefined && skadedato > fallbackMin;
    const kapDatoMinIsEffective = afgoerelsesDato !== undefined && afgoerelsesDato > skadedatoMin;

    const minDate = role === 'kapDato'
      ? afgoerelsesDato === undefined ? skadedatoMin : maxISO(skadedatoMin, afgoerelsesDato)
      : skadedatoMin;
    const maxDate = role === 'afgoerelsesDato'
      ? dateRanges_erhvervsevnetab.tabelAfgoerelsesdato.max
      : role === 'virkningsDato'
        ? dateRanges_erhvervsevnetab.tabelVirkningsdato.max
        : role === 'kapDato'
          ? dateRanges_erhvervsevnetab.tabelKapitaliseringsdato.max
          // Uden rækkens afgørelsesdato findes der ingen "dagen før"-grænse. Konfigurationens
          // `fallbackMax` (EET-datadækningen) gælder da – den er netop erklæret til dette tilfælde.
          // Faldt loftet i stedet ud som `undefined`, var feltet HELT uden øvre grænse, indtil
          // afgørelsesdatoen blev udfyldt, og år 2100 kunne stå canonical.
          : getDayBeforeIso(afgoerelsesDato)
            ?? dateRanges_erhvervsevnetab.tabelTidlKapitaliseringsdato.fallbackMax;
    const rawSpecial: DateRangeSpecialErrors = role === 'afgoerelsesDato'
      ? {
        ...(skadedatoMinIsEffective
          ? { minBoundKind: 'skadedato' as const, minBoundReferenceISO: skadedato }
          : {}),
        maxBoundKind: 'eetDataMax',
        maxBoundFieldLabel: 'Afgørelsesdato',
      }
      : role === 'virkningsDato'
        ? {
          ...(skadedatoMinIsEffective
            ? { minBoundKind: 'skadedato' as const, minBoundReferenceISO: skadedato }
            : {}),
          maxBoundKind: 'eetDataMax',
          maxBoundFieldLabel: 'Virkningsdato',
        }
        : role === 'kapDato'
          ? {
            ...(kapDatoMinIsEffective
              ? { minBoundKind: 'kapDatoFoerAfgoerelsesdato' as const, minBoundReferenceISO: afgoerelsesDato }
              : skadedatoMinIsEffective
                ? { minBoundKind: 'skadedato' as const, minBoundReferenceISO: skadedato }
                : {}),
            maxBoundKind: 'eetDataMax',
            maxBoundFieldLabel: 'Kapitaliseringsdato',
          }
          : {
            // Kun når rækken HAR en afgørelsesdato, er loftet "dagen før" den. Uden den er loftet
            // datadækningen, og beskeden skal sige netop det frem for at pege på en dato, der ikke findes.
            ...(skadedatoMinIsEffective
              ? { minBoundKind: 'skadedato' as const, minBoundReferenceISO: skadedato }
              : {}),
            ...(afgoerelsesDato === undefined
              ? { maxBoundKind: 'dataCoverageMax' as const, maxBoundFieldLabel: 'Tidl. kap.dato' }
              : { maxBoundKind: 'foerAfgoerelsesdato' as const, maxBoundReferenceISO: afgoerelsesDato }),
          };
    const special = withStamdataDatoReference({ view, field }, rawSpecial) ?? rawSpecial;
    if (value >= minDate && (maxDate === undefined || value <= maxDate)) return undefined;
    return {
      reason: 'bounds',
      code: `erhvervsevnetab.aslAfgoerelser.${role}.bounds`,
      message: resolveDateRangeErrorMessage({
        iso: value,
        minDate,
        maxDate,
        special,
        // ALLE fire roller udleder min af Skadedato, og de to kapitaliseringsroller desuden af rækkens
        // Afgørelsesdato. Tidligere var årsagen kun sat for de to sidste – de øvrige gav derfor "ingen dato
        // er gyldig" uden at nævne, at det var Skadedato, brugeren skulle rette.
        bounds: derivedDateBounds(
          role === 'kapDato' || role === 'tidlKapDato'
            ? `Afgørelsesdato og ${resolveStamdataDatoReferenceFromView(view).label}`
            : resolveStamdataDatoReferenceFromView(view).label
        ),
      }),
      detail: { minDate, ...(maxDate === undefined ? {} : { maxDate }) },
    };
  };

const aslDateContextValidator = (role: AslDateRole): FieldValidator<ISODateString | undefined> =>
  (value, field, view) => {
    if (value === undefined) return undefined;
    const rowId = aslRowIdOf(field);

    if (role === 'kapDato') {
      const afgoerelseType = view.readCanonical(aslAfgoerelseAfgoerelseTypeField.bind(rowId));
      if (afgoerelseType === 'Midlertidig') {
        return {
          reason: 'rule',
          code: 'erhvervsevnetab.aslAfgoerelser.kapDato.midlertidig',
          priority: 'context',
          message: KAP_DATO_NOT_ALLOWED_BY_AFGOERELSE_TYPE_MESSAGE,
        };
      }
    }

    if (role === 'tidlKapDato') {
      const kapDato = view.readCanonical(aslAfgoerelseKapDatoField.bind(rowId));
      if (kapDato === undefined) {
        return {
          reason: 'rule',
          code: 'erhvervsevnetab.aslAfgoerelser.tidlKapDato.udenKapitalisering',
          priority: 'context',
          message: TIDL_KAP_DATO_WITHOUT_KAPITALISERING_MESSAGE,
        };
      }
    }

    return undefined;
  };

/**
 * ASL-rækkens grænser som erklæring.
 *
 * Selve håndhævelsen bliver i `aslDateBoundsValidator`: dens fire roller fletter min/max, `special` og
 * årsagstekst i ét udtryk, hvor både gulv og loft skifter kilde pr. rolle (og `tidlKapDato`s loft er dagen
 * FØR rækkens afgørelsesdato). Presset ned i `DateBoundsSpec`s min/max/narrow-form ville reglen skulle
 * skrives om, og en omskrivning her risikerer at flytte en besked uden at nogen opdager det.
 *
 * Erklæringen gengiver derfor den YDRE ramme, som gælder uanset rolle og rækkeindhold – den er sand og
 * håndhævet. Værnet `dateFieldsDeclareBounds.test.ts` måler adfærd, ikke erklæringen, så feltet skal
 * stadig faktisk afvise datoer uden for rammen for at bestå.
 */
const aslOuterBoundsSpec: DateBoundsSpec = {
  min: () => dateRanges_erhvervsevnetab.tabelAfgoerelsesdato.fallbackMin,
  max: () => dateRanges_erhvervsevnetab.tabelAfgoerelsesdato.max,
  origin: (context) => derivedDateBounds(
    `Afgørelsesdato og ${resolveStamdataDatoReferenceFromView(context.view).label}`
  ),
};

const aslDate = (
  field: AslDateRole,
  label: string
): FieldDescriptor<ISODateString | undefined> => {
  const bounds = dateBounds(aslOuterBoundsSpec, [], () => aslDateBoundsValidator(field));
  return defineStructuralField<ISODateString | undefined>({
    id: `erhvervsevnetab.aslAfgoerelser.${field}`,
    template: aslRowTemplate(field),
    codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    // ASL-validatoren fletter rolle-, række- og skadedato-afhængige grænser i én besked. En standard
    // bounds-validator oveni ville give to konkurrerende issues med samme kode og kunne vælge den
    // forkerte tooltip-tekst i issue-prioriteringen.
    ...bounds,
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyErhvervsevnetabSection,
    validators: [...bounds.validators, aslDateContextValidator(field)],
  });
};

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
    validators: [
      percentBoundsValidator(`erhvervsevnetab.aslAfgoerelser.${field}.bounds`, {
        minValue: 0,
        maxValue: 100,
        allowDecimals: false,
      }),
      (value) => {
        const message = validatePercentNotZero(value, label)
          ?? validatePercentDivisibleBy5FromValue(value, label);
        return message === undefined ? undefined : {
          reason: 'rule', code: `erhvervsevnetab.aslAfgoerelser.${field}.rule`, message,
        };
      },
    ],
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
