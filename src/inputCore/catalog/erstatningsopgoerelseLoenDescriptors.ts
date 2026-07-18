import { CURRENT_YEAR, MIN_YEAR } from '../../config/dateRanges';
import {
  anciennitetSatsPerEnum,
  krlSatstabelEnum,
  loenPaaHelligdageEnum,
  loenperiodeEnum,
  loenudviklingBeregningsgrundlagEnum,
  loenudviklingStatistikModelEnum,
  offentligLoenTypeEnum,
  tillaegAngivesSomEnum,
  type LoenindkomstAnsaettelsesforhold,
  type LoenudviklingManuelProcentsatsRow,
  type LoenudviklingManuelRow,
  type StandardLoenTableRow,
} from '../../schemas/formSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../types/branded';
import {
  booleanFieldCodec,
  createAmountFieldCodec,
  createChoiceFieldCodec,
  createDateFieldCodec,
  createIntegerFieldCodec,
  createOptionalTextFieldCodec,
  createPercentFieldCodec,
  createRequiredChoiceFieldCodec,
  createStringBackedFieldCodec,
  createWeekFieldCodec,
  createYearFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type { FieldAddressTemplate, FieldControlKind, FieldDescriptor, FieldValidator } from '../fieldDescriptor';
import type { FieldCodec } from '../fieldCodec';
import {
  defineStructuralCollection,
  defineStructuralField,
  isEmptyString,
  isUndefined,
} from '../structuralDescriptors';
import {
  integerBoundsValidator,
  percentBoundsValidator,
  weekYearBoundsValidator,
  yearStringBoundsValidator,
} from './boundsValidators';
import { getIntegerRangeErrorMessage } from '../../utils/integerRange';
import { createEmptyErstatningsopgoerelseSection } from './erstatningsopgoerelseDescriptors';

// Greenfield produkt-descriptors for EO's nested løntræ (§3.2): samlingen `loenindkomstAnsaettelsesforhold`
// med skalarfelter + overenskomstFilter + tre nested tabeller, samt det singulære property-objekt
// `eoAngivetLoenLoenudvikling` med sin filter + to nested tabeller.

const S = 'erstatningsopgoerelse' as const;
const EMPLOYMENTS = 'loenindkomstAnsaettelsesforhold';
const STANDARD_ROWS = 'indtaegtsoplysningerTableData';
const MANUAL_ROWS = 'loenudviklingManuelTableData';
const MANUAL_PERCENT_ROWS = 'loenudviklingManuelProcentsatsTableData';
const EO_LOEN_PROPERTY = 'eoAngivetLoenLoenudvikling';

type PathSegments = FieldAddressTemplate['path'];

const employmentPath: PathSegments = [{ kind: 'entity', collection: EMPLOYMENTS }];
const eoLoenPath: PathSegments = [{ kind: 'property', name: EO_LOEN_PROPERTY }];

// Delte codecs (identiske config'er som legacy-bindingen).
const optionalTextCodec = createOptionalTextFieldCodec();
const dateCodec = createDateFieldCodec({ twoDigitYearPolicy: 'infer' });
const percentCodec = createPercentFieldCodec({ allowNegative: false, allowDecimals: true, minValue: 0, maxValue: 100 });
const amountCodec = createAmountFieldCodec({ allowNegative: false, allowDecimals: true });
const tableAmountCodec = createAmountFieldCodec({ allowNegative: true, allowDecimals: true });
const integerCodec = (minValue: number, maxValue: number, maxDigits: number): FieldCodec<number | undefined> =>
  createIntegerFieldCodec({ allowNegative: false, minValue, maxValue, maxDigits });

/**
 * `createField` bygger en descriptor på en fast owner-sti. `id` udledes af sti+felt, så `overenskomstFilter`
 * under de to ejere (employment-række vs. eoLoen-property) får entydige id'er.
 */
const createField = <T>(options: Readonly<{
  ownerId: string;
  path: PathSegments;
  field: string;
  label: string;
  controlKind: FieldControlKind;
  codec: FieldCodec<T>;
  emptyValue: T;
  isEmpty: (value: T) => boolean;
  validators?: readonly FieldValidator<T>[];
}>): FieldDescriptor<T> => defineStructuralField<T>({
  id: `${options.ownerId}.${options.field}`,
  template: { section: S, path: options.path, field: options.field },
  codec: options.codec,
  emptyValue: options.emptyValue,
  isEmpty: options.isEmpty,
  label: options.label,
  controlKind: options.controlKind,
  createEmptySection: createEmptyErstatningsopgoerelseSection,
  ...(options.validators === undefined ? {} : { validators: options.validators }),
});

// Optionelle felter (canonical tomhed = undefined).
const optField = <T>(
  ownerId: string, path: PathSegments, field: string, label: string,
  controlKind: FieldControlKind, codec: FieldCodec<T | undefined>,
  validators?: readonly FieldValidator<T | undefined>[],
): FieldDescriptor<T | undefined> =>
  createField<T | undefined>({
    ownerId, path, field, label, controlKind, codec, emptyValue: undefined, isEmpty: isUndefined,
    ...(validators === undefined ? {} : { validators }),
  });

// Required-choice (canonical tomhed = defaultværdien; aldrig tom, aldrig rød).
const reqChoiceField = <T extends string>(
  ownerId: string, path: PathSegments, field: string, label: string,
  values: readonly T[], emptyValue: T, controlKind: FieldControlKind = 'choice',
): FieldDescriptor<T> =>
  createField<T>({
    ownerId, path, field, label, controlKind,
    codec: createRequiredChoiceFieldCodec<T>(values, emptyValue),
    emptyValue, isEmpty: () => false,
  });

// ── Samlingen loenindkomstAnsaettelsesforhold ──────────────────────────────────────
export const eoLoenindkomstAnsaettelsesforholdCollection = defineStructuralCollection<LoenindkomstAnsaettelsesforhold>({
  id: 'eo.loenindkomstAnsaettelsesforhold',
  template: { section: S, path: [], collection: EMPLOYMENTS },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

// Skalarfelter under en ansættelsesforhold-række.
const EMP_ID = 'eo.loenindkomstAnsaettelsesforhold';
const emp = <T>(
  field: string, label: string, controlKind: FieldControlKind, codec: FieldCodec<T | undefined>,
  validators?: readonly FieldValidator<T | undefined>[],
) => optField<T>(EMP_ID, employmentPath, field, label, controlKind, codec, validators);

// Delt canonical bounds-validator for procentfelterne (0..100). Codecet afviser ikke længere out-of-bounds;
// grænsen er nu et afledt bounds-issue (§1.6).
const empPercentBounds = (field: string): readonly FieldValidator<number | undefined>[] =>
  [percentBoundsValidator(`${EMP_ID}.${field}.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })];

const employmentFields = [
  emp('navnPaaArbejdssted', 'Navn på arbejdssted', 'text', optionalTextCodec),
  createField<boolean>({ ownerId: EMP_ID, path: employmentPath, field: 'harOverenskomst', label: 'Overenskomst', controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false }),
  emp('overenskomstId', 'Vælg overenskomst', 'choice', optionalTextCodec),
  createField<boolean>({ ownerId: EMP_ID, path: employmentPath, field: 'ansatPaaSkadestidspunktet', label: 'Ansat på skadestidspunktet', controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false }),
  createField<boolean>({ ownerId: EMP_ID, path: employmentPath, field: 'ansaettelsesforholdOphoert', label: 'Opsagt fra stillingen', controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false }),
  emp('sidsteArbejdsdag', 'Sidste dag i ansættelsesforholdet', 'text', dateCodec),
  emp('fritvalgPct', 'Fritvalg', 'text', percentCodec, empPercentBounds('fritvalgPct')),
  emp('shSoPct', 'SH/SO-sats', 'text', percentCodec, empPercentBounds('shSoPct')),
  emp('storeBededagPct', 'Store Bededagstillæg', 'text', percentCodec, empPercentBounds('storeBededagPct')),
  emp('pensionPct', 'Arbejdsgivers pensionsbidrag', 'text', percentCodec, empPercentBounds('pensionPct')),
  reqChoiceField(EMP_ID, employmentPath, 'tillaegAngivesSom', 'Tillæg angives som', tillaegAngivesSomEnum.options, 'procent'),
  reqChoiceField(EMP_ID, employmentPath, 'loenperiode', 'Løn indtastes som', loenperiodeEnum.options, 'maaned'),
  reqChoiceField(EMP_ID, employmentPath, 'fuldLoenUnderFerie', 'Fuld løn under ferie', ['Ja', 'Nej'] as const, 'Nej', 'toggle'),
  createField<boolean>({ ownerId: EMP_ID, path: employmentPath, field: 'harAnciennitetstillaegEfterSkadedatoen', label: 'Anciennitetstillæg efter skadedatoen', controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false }),
  emp('anciennitetstillaegDato', 'Dato for opnået anciennitetstillæg', 'text', dateCodec),
  reqChoiceField(EMP_ID, employmentPath, 'anciennitetstillaegSatsAngivesPer', 'Satsen angives per', anciennitetSatsPerEnum.options, 'Måned'),
  emp('anciennitetstillaegSats', 'Anciennitetstillægssats', 'text', amountCodec),
  emp('feriePct', 'Feriegodtgørelse/-tillæg', 'text', percentCodec, empPercentBounds('feriePct')),
  reqChoiceField(EMP_ID, employmentPath, 'loenPaaHelligdage', 'Løn på helligdage', loenPaaHelligdageEnum.options, 'Almindelig løn'),
  emp('saerligFraDatoRegulering', 'Særlig fra-dato for regulering', 'text', dateCodec),
  optField(EMP_ID, employmentPath, 'loenudviklingBeregningsgrundlag', 'Lønudvikling beregnes ud fra', 'choice', createChoiceFieldCodec(loenudviklingBeregningsgrundlagEnum.options)),
  optField(EMP_ID, employmentPath, 'loenudviklingStatistikModel', 'Statistisk beregningsmodel', 'choice', createChoiceFieldCodec(loenudviklingStatistikModelEnum.options)),
  optField(EMP_ID, employmentPath, 'loenudviklingKRLSatstabel', 'Satstabel', 'choice', createChoiceFieldCodec(krlSatstabelEnum.options)),
  emp('loenudviklingManuelNavn', 'Navn på reguleringsform', 'text', optionalTextCodec),
  optField(EMP_ID, employmentPath, 'offentligLoenType', 'Ansættelse', 'choice', createChoiceFieldCodec(offentligLoenTypeEnum.options)),
  emp('offentligLoenTrin', 'Løntrin', 'text', integerCodec(1, 55, 2), [integerBoundsValidator(`${EMP_ID}.offentligLoenTrin.bounds`, 1, 55)]),
  emp('offentligLoenGruppe', 'Gruppe', 'text', integerCodec(0, 4, 1), [integerBoundsValidator(`${EMP_ID}.offentligLoenGruppe.bounds`, 0, 4)]),
  emp('offentligLoenEkstraGrundloen', 'Forhøjet grundløn ud over løntrin', 'text', amountCodec),
] as const;

// overenskomstFilter (property-objekt under ejeren).
const filterField = (ownerId: string, ownerPath: PathSegments, field: 'loenmodtager' | 'arbejdsgiver'): FieldDescriptor<string | undefined> =>
  optField<string>(
    `${ownerId}.overenskomstFilter`,
    [...ownerPath, { kind: 'property', name: 'overenskomstFilter' }],
    field,
    field === 'loenmodtager' ? 'Lønmodtagerfilter' : 'Arbejdsgiverfilter',
    'choice',
    optionalTextCodec,
  );

const employmentFilterFields = [
  filterField(EMP_ID, employmentPath, 'loenmodtager'),
  filterField(EMP_ID, employmentPath, 'arbejdsgiver'),
] as const;

// ── Nested standard-løntabel under en ansættelsesforhold-række ──────────────────────
export const eoLoenindkomstStandardRowsCollection = defineStructuralCollection<StandardLoenTableRow>({
  id: 'eo.loenindkomstAnsaettelsesforhold.indtaegtsoplysningerTableData',
  template: { section: S, path: employmentPath, collection: STANDARD_ROWS },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

const STD_ID = 'eo.loenindkomstAnsaettelsesforhold.indtaegtsoplysningerTableData';
const stdRowPath: PathSegments = [...employmentPath, { kind: 'entity', collection: STANDARD_ROWS }];

const stdDate = (field: string, label: string): FieldDescriptor<ISODateString | undefined> =>
  optField<ISODateString>(STD_ID, stdRowPath, field, label, 'text', dateCodec);
const stdString = (
  field: string, label: string, codec: FieldCodec<string | undefined>,
  validators?: readonly FieldValidator<string | undefined>[],
): FieldDescriptor<string | undefined> =>
  createField<string | undefined>({
    ownerId: STD_ID, path: stdRowPath, field, label, controlKind: 'text', codec, emptyValue: '', isEmpty: isEmptyString,
    ...(validators === undefined ? {} : { validators }),
  });

// Månedskolonnens 1..12 er en canonical bounds-feltvalidator (string-backed, §1.6).
const stdMaanedBounds = (): readonly FieldValidator<string | undefined>[] => [(value) => {
  if (value === undefined || value.trim() === '') return undefined;
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) return undefined;
  const message = getIntegerRangeErrorMessage(numeric, 1, 12);
  if (message === '') return undefined;
  return { reason: 'bounds', code: `${STD_ID}.col0_maaned.bounds`, message, detail: { minValue: 1, maxValue: 12 } };
}];
const stdAmount = (field: string, label: string): FieldDescriptor<AmountValue | undefined> =>
  optField<AmountValue>(STD_ID, stdRowPath, field, label, 'text', tableAmountCodec);

const standardRowFields = [
  stdString('col0_maaned', 'Måned', createStringBackedFieldCodec(integerCodec(1, 12, 2)), stdMaanedBounds()),
  stdString('col1_maaned', 'År', createStringBackedFieldCodec(createYearFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: CURRENT_YEAR })), [yearStringBoundsValidator(`${STD_ID}.col1_maaned.bounds`, MIN_YEAR, CURRENT_YEAR)]),
  stdString('col0_uge', 'Uge fra', createStringBackedFieldCodec(createWeekFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: CURRENT_YEAR, maxDraftLength: 8 })), [weekYearBoundsValidator(`${STD_ID}.col0_uge.bounds`, MIN_YEAR, CURRENT_YEAR)]),
  stdString('col1_uge', 'Uge til', createStringBackedFieldCodec(createWeekFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: CURRENT_YEAR, maxDraftLength: 8 })), [weekYearBoundsValidator(`${STD_ID}.col1_uge.bounds`, MIN_YEAR, CURRENT_YEAR)]),
  stdDate('col0_dag', 'Dato fra'),
  stdDate('col1_dag', 'Dato til'),
  stdAmount('col2', 'Løn'),
  stdAmount('col3', 'Løn (2)'),
  stdAmount('col4', 'Løn (3)'),
  stdAmount('col5', 'Løn (4)'),
  stdAmount('fpFvShSoBeloeb', 'FP/FV/SH/SO/St.B.'),
  stdAmount('pensionBeloeb', 'Arb.g. Pension'),
] as const;

// ── Nested manuel-lønudviklings-tabeller (delt mellem de to ejere) ──────────────────
type ManualBindings = Readonly<{
  collections: ReturnType<typeof catalogCollections>;
  fields: ReturnType<typeof catalogFields>;
}>;

const createManualBindings = (ownerId: string, ownerPath: PathSegments): ManualBindings => {
  const manualCollection = defineStructuralCollection<LoenudviklingManuelRow>({
    id: `${ownerId}.loenudviklingManuelTableData`,
    template: { section: S, path: ownerPath, collection: MANUAL_ROWS },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
  const manualPercentCollection = defineStructuralCollection<LoenudviklingManuelProcentsatsRow>({
    id: `${ownerId}.loenudviklingManuelProcentsatsTableData`,
    template: { section: S, path: ownerPath, collection: MANUAL_PERCENT_ROWS },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
  const manualRowPath: PathSegments = [...ownerPath, { kind: 'entity', collection: MANUAL_ROWS }];
  const manualPercentRowPath: PathSegments = [...ownerPath, { kind: 'entity', collection: MANUAL_PERCENT_ROWS }];
  const manualId = `${ownerId}.loenudviklingManuelTableData`;
  const manualPercentId = `${ownerId}.loenudviklingManuelProcentsatsTableData`;

  return {
    collections: catalogCollections(manualCollection, manualPercentCollection),
    fields: catalogFields(
      optField<ISODateString>(manualId, manualRowPath, 'dato', 'Dato', 'text', dateCodec),
      optField<AmountValue>(manualId, manualRowPath, 'grundloen', 'Grundløn', 'text', tableAmountCodec),
      optField<number>(manualId, manualRowPath, 'feriepenge', 'Feriepenge', 'text', percentCodec, [percentBoundsValidator(`${manualId}.feriepenge.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })]),
      optField<number>(manualId, manualRowPath, 'shSoSats', 'SH/SO-sats', 'text', percentCodec, [percentBoundsValidator(`${manualId}.shSoSats.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })]),
      optField<number>(manualId, manualRowPath, 'fritvalg', 'Fritvalg', 'text', percentCodec, [percentBoundsValidator(`${manualId}.fritvalg.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })]),
      optField<number>(manualId, manualRowPath, 'agPension', 'Arbejdsgivers pension', 'text', percentCodec, [percentBoundsValidator(`${manualId}.agPension.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })]),
      optField<ISODateString>(manualPercentId, manualPercentRowPath, 'dato', 'Dato', 'text', dateCodec),
      optField<number>(manualPercentId, manualPercentRowPath, 'procent', 'Procent', 'text', percentCodec, [percentBoundsValidator(`${manualPercentId}.procent.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })]),
    ),
  };
};

const employmentManual = createManualBindings(EMP_ID, employmentPath);

// ── eoAngivetLoenLoenudvikling (singulært property-objekt) ──────────────────────────
const EO_LOEN_ID = 'eo.eoAngivetLoenLoenudvikling';
const eoLoen = <T>(
  field: string, label: string, controlKind: FieldControlKind, codec: FieldCodec<T | undefined>,
  validators?: readonly FieldValidator<T | undefined>[],
) => optField<T>(EO_LOEN_ID, eoLoenPath, field, label, controlKind, codec, validators);

const eoLoenFields = [
  eoLoen('overenskomstId', 'Vælg overenskomst', 'choice', optionalTextCodec),
  createField<boolean>({ ownerId: EO_LOEN_ID, path: eoLoenPath, field: 'harAnciennitetstillaegEfterSkadedatoen', label: 'Anciennitetstillæg efter skadedatoen', controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false }),
  eoLoen('anciennitetstillaegDato', 'Dato for opnået anciennitetstillæg', 'text', dateCodec),
  reqChoiceField(EO_LOEN_ID, eoLoenPath, 'anciennitetstillaegSatsAngivesPer', 'Satsen angives per', anciennitetSatsPerEnum.options, 'Måned'),
  eoLoen('anciennitetstillaegSats', 'Anciennitetstillægssats', 'text', amountCodec),
  eoLoen('feriePct', 'Feriegodtgørelse/-tillæg', 'text', percentCodec, [percentBoundsValidator(`${EO_LOEN_ID}.feriePct.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })]),
  optField(EO_LOEN_ID, eoLoenPath, 'loenPaaHelligdage', 'Løn på helligdage', 'choice', createChoiceFieldCodec(loenPaaHelligdageEnum.options)),
  eoLoen('saerligFraDatoRegulering', 'Særlig fra-dato for regulering', 'text', dateCodec),
  optField(EO_LOEN_ID, eoLoenPath, 'loenudviklingBeregningsgrundlag', 'Lønudvikling beregnes ud fra', 'choice', createChoiceFieldCodec(loenudviklingBeregningsgrundlagEnum.options)),
  optField(EO_LOEN_ID, eoLoenPath, 'loenudviklingStatistikModel', 'Statistisk beregningsmodel', 'choice', createChoiceFieldCodec(loenudviklingStatistikModelEnum.options)),
  optField(EO_LOEN_ID, eoLoenPath, 'loenudviklingKRLSatstabel', 'Satstabel', 'choice', createChoiceFieldCodec(krlSatstabelEnum.options)),
  eoLoen('loenudviklingManuelNavn', 'Navn på reguleringsform', 'text', optionalTextCodec),
  optField(EO_LOEN_ID, eoLoenPath, 'offentligLoenType', 'Ansættelse', 'choice', createChoiceFieldCodec(offentligLoenTypeEnum.options)),
  eoLoen('offentligLoenTrin', 'Løntrin', 'text', integerCodec(1, 55, 2), [integerBoundsValidator(`${EO_LOEN_ID}.offentligLoenTrin.bounds`, 1, 55)]),
  eoLoen('offentligLoenGruppe', 'Gruppe', 'text', integerCodec(0, 4, 1), [integerBoundsValidator(`${EO_LOEN_ID}.offentligLoenGruppe.bounds`, 0, 4)]),
  eoLoen('offentligLoenEkstraGrundloen', 'Forhøjet grundløn ud over løntrin', 'text', amountCodec),
] as const;

const eoLoenFilterFields = [
  filterField(EO_LOEN_ID, eoLoenPath, 'loenmodtager'),
  filterField(EO_LOEN_ID, eoLoenPath, 'arbejdsgiver'),
] as const;

const eoLoenManual = createManualBindings(EO_LOEN_ID, eoLoenPath);

// De koncrete grupper type-erases hver for sig via `catalogFields`; derefter konkateneres alle allerede-
// erasede arrays med almindelig spread (så generisk invarians ikke rammer den blandede sammensætning).
export const erstatningsopgoerelseLoenFields = Object.freeze([
  ...catalogFields(...employmentFields),
  ...catalogFields(...employmentFilterFields),
  ...catalogFields(...standardRowFields),
  ...employmentManual.fields,
  ...catalogFields(...eoLoenFields),
  ...catalogFields(...eoLoenFilterFields),
  ...eoLoenManual.fields,
]);

export const erstatningsopgoerelseLoenCollections = Object.freeze([
  ...catalogCollections(eoLoenindkomstAnsaettelsesforholdCollection, eoLoenindkomstStandardRowsCollection),
  ...employmentManual.collections,
  ...eoLoenManual.collections,
]);
