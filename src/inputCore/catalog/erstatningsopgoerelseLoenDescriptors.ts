import { dateRanges_aarsloen, getCurrentYear, MIN_YEAR } from '../../config/dateRanges';
import { STATIC_DATE_BOUNDS } from '../../utils/dateRangeErrorMessages';
import {
  anciennitetSatsPerEnum,
  krlSatstabelEnum,
  loenPaaHelligdageEnum,
  loenperiodeEnum,
  loenudviklingBeregningsgrundlagEnum,
  loenudviklingStatistikModelEnum,
  offentligLoenTypeEnum,
  tillaegAngivesSomEnum,
  type PersistedLoenindkomstAnsaettelsesforhold,
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
import type { FieldAddressTemplate, FieldControlKind, FieldDescriptor, FieldRef, FieldValidator } from '../fieldDescriptor';
import { dateOrderValidator, type DatePairBinding } from './dateOrderValidators';
import { dateBounds, systemrammeSpec } from './dateBoundsValidators';
import type { DateBoundsSpec } from '../dateBoundsDeclaration';
import type { FieldCodec } from '../fieldCodec';
import {
  defineStructuralCollection,
  defineStructuralField,
  isEmptyString,
  isUndefined,
} from '../structuralDescriptors';
import {
  amountBoundsValidator,
  integerBoundsValidator,
  integerStringBoundsValidator,
  percentBoundsValidator,
  weekYearBoundsValidator,
  yearStringBoundsValidator,
} from './boundsValidators';
import { createEmptyErstatningsopgoerelseSection } from './erstatningsopgoerelseDescriptors';
import { isStandardLoenRowPersistenceEmpty } from '../../domain/aarsloen/standardLoenRowInitialValues';
import { STANDARD_LOEN_COLUMN_LABELS } from '../../types/table';
import {
  isLoenudviklingManuelProcentsatsRowEmpty,
  isLoenudviklingManuelRowEmpty,
} from '../../domain/erstatningsopgoerelse/helpers/rowEmpty';

// Produkt-descriptors for EO's nested løntræ (§3.2): samlingen `loenindkomstAnsaettelsesforhold`
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

// Delte codecs for lønfelterne.
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
  dateBounds?: DateBoundsSpec;
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
  ...(options.dateBounds === undefined ? {} : { dateBounds: options.dateBounds }),
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

/**
 * Et datofelt under lønindkomst-træet. Grænserne er PÅKRÆVEDE og påføres HER, ikke af kaldsstedet.
 *
 * Otte af træets datofelter — sidste arbejdsdag, de to anciennitetsdatoer, de to særlige
 * reguleringsdatoer og lønudviklingstabellernes datoer — stod uden nogen validator, fordi de blev bygget
 * med den generiske `optField`, hvor grænser er en glemsom ekstraparameter. Helperen fjerner det valg:
 * et datofelt her kan ikke opstå uden erklærede grænser.
 */
const dateFieldWithBounds = (
  ownerId: string, path: PathSegments, field: string, label: string,
  spec: DateBoundsSpec,
  extraValidators: readonly FieldValidator<ISODateString | undefined>[] = [],
): FieldDescriptor<ISODateString | undefined> =>
  createField<ISODateString | undefined>({
    ownerId, path, field, label, controlKind: 'text', codec: dateCodec,
    emptyValue: undefined, isEmpty: isUndefined,
    ...dateBounds(spec, extraValidators),
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
export const eoLoenindkomstAnsaettelsesforholdCollection =
defineStructuralCollection<PersistedLoenindkomstAnsaettelsesforhold>({
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
const empAmountBounds = (field: string): readonly FieldValidator<AmountValue | undefined>[] =>
  [amountBoundsValidator(`${EMP_ID}.${field}.bounds`, 0, undefined)];

/** Datofelt direkte på en ansættelsesforhold-række. Systemrammen medmindre feltet har en skarpere regel. */
const empDate = (
  field: string, label: string, spec: DateBoundsSpec = systemrammeSpec,
): FieldDescriptor<ISODateString | undefined> =>
  dateFieldWithBounds(EMP_ID, employmentPath, field, label, spec);

// Navngivne employment-descriptors, som readerprojektion og grid binder direkte. Aggregatarrayet
// nedenfor afledes fra dette record, så kataloget ikke kan drive fra de eksporterede refs.
export const eoEmploymentFields = {
  navnPaaArbejdssted: emp<string>('navnPaaArbejdssted', 'Navn på arbejdssted', 'text', optionalTextCodec),
  harOverenskomst: createField<boolean>({ ownerId: EMP_ID, path: employmentPath, field: 'harOverenskomst', label: 'Overenskomst', controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false }),
  overenskomstId: emp<string>('overenskomstId', 'Vælg overenskomst', 'choice', optionalTextCodec),
  ansatPaaSkadestidspunktet: createField<boolean>({ ownerId: EMP_ID, path: employmentPath, field: 'ansatPaaSkadestidspunktet', label: 'Ansat på skadestidspunktet', controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false }),
  ansaettelsesforholdOphoert: createField<boolean>({ ownerId: EMP_ID, path: employmentPath, field: 'ansaettelsesforholdOphoert', label: 'Opsagt fra stillingen', controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false }),
  sidsteArbejdsdag: empDate('sidsteArbejdsdag', 'Sidste dag i ansættelsesforholdet'),
  fritvalgPct: emp<number>('fritvalgPct', 'Fritvalg', 'text', percentCodec, empPercentBounds('fritvalgPct')),
  shSoPct: emp<number>('shSoPct', 'SH/SO-sats', 'text', percentCodec, empPercentBounds('shSoPct')),
  pensionPct: emp<number>('pensionPct', 'Arbejdsgivers pensionsbidrag', 'text', percentCodec, empPercentBounds('pensionPct')),
  tillaegAngivesSom: reqChoiceField(EMP_ID, employmentPath, 'tillaegAngivesSom', 'Tillæg angives som', tillaegAngivesSomEnum.options, 'procent'),
  loenperiode: reqChoiceField(EMP_ID, employmentPath, 'loenperiode', 'Løn indtastes som', loenperiodeEnum.options, 'maaned'),
  fuldLoenUnderFerie: reqChoiceField(EMP_ID, employmentPath, 'fuldLoenUnderFerie', 'Fuld løn under ferie', ['Ja', 'Nej'] as const, 'Nej', 'toggle'),
  harAnciennitetstillaegEfterSkadedatoen: createField<boolean>({ ownerId: EMP_ID, path: employmentPath, field: 'harAnciennitetstillaegEfterSkadedatoen', label: 'Anciennitetstillæg efter skadedatoen', controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false }),
  anciennitetstillaegDato: empDate('anciennitetstillaegDato', 'Dato for opnået anciennitetstillæg'),
  anciennitetstillaegSatsAngivesPer: reqChoiceField(EMP_ID, employmentPath, 'anciennitetstillaegSatsAngivesPer', 'Satsen angives per', anciennitetSatsPerEnum.options, 'Måned'),
  anciennitetstillaegSats: emp<AmountValue>('anciennitetstillaegSats', 'Anciennitetstillægssats', 'text', amountCodec, empAmountBounds('anciennitetstillaegSats')),
  feriePct: emp<number>('feriePct', 'Feriegodtgørelse/-tillæg', 'text', percentCodec, empPercentBounds('feriePct')),
  loenPaaHelligdage: reqChoiceField(EMP_ID, employmentPath, 'loenPaaHelligdage', 'Løn på helligdage', loenPaaHelligdageEnum.options, 'Almindelig løn'),
  saerligFraDatoRegulering: empDate('saerligFraDatoRegulering', 'Særlig fra-dato for regulering'),
  loenudviklingBeregningsgrundlag: optField(EMP_ID, employmentPath, 'loenudviklingBeregningsgrundlag', 'Lønudvikling beregnes ud fra', 'choice', createChoiceFieldCodec(loenudviklingBeregningsgrundlagEnum.options)),
  loenudviklingStatistikModel: optField(EMP_ID, employmentPath, 'loenudviklingStatistikModel', 'Statistisk beregningsmodel', 'choice', createChoiceFieldCodec(loenudviklingStatistikModelEnum.options)),
  loenudviklingKRLSatstabel: optField(EMP_ID, employmentPath, 'loenudviklingKRLSatstabel', 'Satstabel', 'choice', createChoiceFieldCodec(krlSatstabelEnum.options)),
  loenudviklingManuelNavn: emp<string>('loenudviklingManuelNavn', 'Navn på reguleringsform', 'text', optionalTextCodec),
  offentligLoenType: optField(EMP_ID, employmentPath, 'offentligLoenType', 'Ansættelse', 'choice', createChoiceFieldCodec(offentligLoenTypeEnum.options)),
  offentligLoenTrin: emp<number>('offentligLoenTrin', 'Løntrin', 'text', integerCodec(1, 55, 2), [integerBoundsValidator(`${EMP_ID}.offentligLoenTrin.bounds`, 1, 55)]),
  offentligLoenGruppe: emp<number>('offentligLoenGruppe', 'Gruppe', 'text', integerCodec(0, 4, 1), [integerBoundsValidator(`${EMP_ID}.offentligLoenGruppe.bounds`, 0, 4)]),
  offentligLoenEkstraGrundloen: emp<AmountValue>('offentligLoenEkstraGrundloen', 'Forhøjet grundløn ud over løntrin', 'text', amountCodec, empAmountBounds('offentligLoenEkstraGrundloen')),
} as const;

const employmentFields = Object.values(eoEmploymentFields);

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

export const eoEmploymentFilterFields = {
  loenmodtager: filterField(EMP_ID, employmentPath, 'loenmodtager'),
  arbejdsgiver: filterField(EMP_ID, employmentPath, 'arbejdsgiver'),
} as const;

const employmentFilterFields = Object.values(eoEmploymentFilterFields);

// ── Nested standard-løntabel under en ansættelsesforhold-række ──────────────────────
export const eoLoenindkomstStandardRowsCollection = defineStructuralCollection<StandardLoenTableRow>({
  id: 'eo.loenindkomstAnsaettelsesforhold.indtaegtsoplysningerTableData',
  template: { section: S, path: employmentPath, collection: STANDARD_ROWS },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
  isEntityEmpty: (row) => isStandardLoenRowPersistenceEmpty(row),
});

const STD_ID = 'eo.loenindkomstAnsaettelsesforhold.indtaegtsoplysningerTableData';
const stdRowPath: PathSegments = [...employmentPath, { kind: 'entity', collection: STANDARD_ROWS }];

/**
 * Indtægtstabellens datokolonner. Grænserne er Årslønstabellens: det er SAMME tabelform med samme
 * «Dato fra»/«Dato til»-semantik, men EO-tvillingen havde kun kronologivalidatoren, mens Årsløn-siden
 * håndhævede sine grænser. Den asymmetri var den tydeligste enkeltstående i kodebasen.
 */
const stdDate = (
  field: string, label: string,
  spec: DateBoundsSpec,
  extraValidators: readonly FieldValidator<ISODateString | undefined>[] = [],
): FieldDescriptor<ISODateString | undefined> =>
  dateFieldWithBounds(STD_ID, stdRowPath, field, label, spec, extraValidators);

/**
 * Indtægtstabellens «Dato fra»/«Dato til». Rækkerne ligger NESTET under et
 * ansættelsesforhold, så modparten skal bindes med BEGGE entity-id'er — ansættelsesforholdet og rækken —
 * i den rækkefølge, adressen har dem.
 */
const stdRowIds = <T,>(field: FieldRef<T>): readonly string[] =>
  field.address.path.flatMap((segment) => segment.kind === 'entity' ? [segment.entityId] : []);

const stdDagPair: DatePairBinding = {
  fra: () => eoStandardRowFields.col0_dag,
  til: () => eoStandardRowFields.col1_dag,
  bindIds: stdRowIds,
};
const stdString = (
  field: string, label: string, codec: FieldCodec<string | undefined>,
  validators?: readonly FieldValidator<string | undefined>[],
): FieldDescriptor<string | undefined> =>
  createField<string | undefined>({
    ownerId: STD_ID, path: stdRowPath, field, label, controlKind: 'text', codec, emptyValue: '', isEmpty: isEmptyString,
    ...(validators === undefined ? {} : { validators }),
  });

// Månedskolonnens 1..12 er en canonical bounds-feltvalidator (string-backed, §1.6).
const stdAmount = (field: string, label: string): FieldDescriptor<AmountValue | undefined> =>
  optField<AmountValue>(STD_ID, stdRowPath, field, label, 'text', tableAmountCodec);

// Kolonnenavnene er ét sandt sted (`STANDARD_LOEN_COLUMN_LABELS`, §3.2a): descriptor-labelen ER
// gridoverskriften, så en fejl på en celle navngiver den kolonne, brugeren faktisk ser. `col4`/`col5` hed
// tidligere «Løn (3)»/«Løn (4)» her, mens overskriften sagde noget andet.
const stdLabel = STANDARD_LOEN_COLUMN_LABELS;

export const eoStandardRowFields = {
  col0_maaned: stdString('col0_maaned', stdLabel.col0_maaned, createStringBackedFieldCodec(integerCodec(1, 12, 2)), [
    integerStringBoundsValidator(`${STD_ID}.col0_maaned.bounds`, 1, 12),
  ]),
  col1_maaned: stdString('col1_maaned', stdLabel.col1_maaned, createStringBackedFieldCodec(createYearFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: getCurrentYear() })), [yearStringBoundsValidator(`${STD_ID}.col1_maaned.bounds`, MIN_YEAR, getCurrentYear)]),
  col0_uge: stdString('col0_uge', stdLabel.col0_uge, createStringBackedFieldCodec(createWeekFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: getCurrentYear(), maxDraftLength: 8 })), [weekYearBoundsValidator(`${STD_ID}.col0_uge.bounds`, MIN_YEAR, getCurrentYear)]),
  col1_uge: stdString('col1_uge', stdLabel.col1_uge, createStringBackedFieldCodec(createWeekFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: getCurrentYear(), maxDraftLength: 8 })), [weekYearBoundsValidator(`${STD_ID}.col1_uge.bounds`, MIN_YEAR, getCurrentYear)]),
  col0_dag: stdDate('col0_dag', stdLabel.col0_dag, {
    min: () => dateRanges_aarsloen.tabelAarsloenFra.min,
    max: () => dateRanges_aarsloen.tabelAarsloenFra.fallbackMax,
    origin: STATIC_DATE_BOUNDS,
  }, [dateOrderValidator('fra', stdDagPair)]),
  col1_dag: stdDate('col1_dag', stdLabel.col1_dag, {
    min: () => dateRanges_aarsloen.tabelAarsloenTil.fallbackMin,
    max: () => dateRanges_aarsloen.tabelAarsloenTil.max,
    origin: STATIC_DATE_BOUNDS,
  }, [dateOrderValidator('til', stdDagPair)]),
  col2: stdAmount('col2', stdLabel.col2),
  col3: stdAmount('col3', stdLabel.col3),
  col4: stdAmount('col4', stdLabel.col4),
  col5: stdAmount('col5', stdLabel.col5),
  fpFvShSoBeloeb: stdAmount('fpFvShSoBeloeb', stdLabel.fpFvShSoBeloeb),
  pensionBeloeb: stdAmount('pensionBeloeb', stdLabel.pensionBeloeb),
} as const;

const standardRowFields = Object.values(eoStandardRowFields);

// ── Nested manuel-lønudviklings-tabeller (delt mellem de to ejere) ──────────────────
export type ManualBindings = Readonly<{
  manualCollection: ReturnType<typeof defineStructuralCollection<LoenudviklingManuelRow>>;
  manualPercentCollection: ReturnType<typeof defineStructuralCollection<LoenudviklingManuelProcentsatsRow>>;
  manualFields: Readonly<{
    dato: FieldDescriptor<ISODateString | undefined>;
    grundloen: FieldDescriptor<AmountValue | undefined>;
    feriepenge: FieldDescriptor<number | undefined>;
    shSoSats: FieldDescriptor<number | undefined>;
    fritvalg: FieldDescriptor<number | undefined>;
    agPension: FieldDescriptor<number | undefined>;
  }>;
  manualPercentFields: Readonly<{
    dato: FieldDescriptor<ISODateString | undefined>;
    procent: FieldDescriptor<number | undefined>;
  }>;
  collections: ReturnType<typeof catalogCollections>;
  fields: ReturnType<typeof catalogFields>;
}>;

const createManualBindings = (ownerId: string, ownerPath: PathSegments): ManualBindings => {
  const manualCollection = defineStructuralCollection<LoenudviklingManuelRow>({
    id: `${ownerId}.loenudviklingManuelTableData`,
    template: { section: S, path: ownerPath, collection: MANUAL_ROWS },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
    // Første række er den programstyrede basisrække og må aldrig forsvinde ved almindelig field-clear.
    isEntityEmpty: (row, index) => index > 0 && isLoenudviklingManuelRowEmpty(row),
  });
  const manualPercentCollection = defineStructuralCollection<LoenudviklingManuelProcentsatsRow>({
    id: `${ownerId}.loenudviklingManuelProcentsatsTableData`,
    template: { section: S, path: ownerPath, collection: MANUAL_PERCENT_ROWS },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
    // Som ovenfor: basisrækken er strukturel, mens efterfølgende bruger-rækker auto-ryddes når de tømmes.
    isEntityEmpty: (row, index) => index > 0 && isLoenudviklingManuelProcentsatsRowEmpty(row),
  });
  const manualRowPath: PathSegments = [...ownerPath, { kind: 'entity', collection: MANUAL_ROWS }];
  const manualPercentRowPath: PathSegments = [...ownerPath, { kind: 'entity', collection: MANUAL_PERCENT_ROWS }];
  const manualId = `${ownerId}.loenudviklingManuelTableData`;
  const manualPercentId = `${ownerId}.loenudviklingManuelProcentsatsTableData`;

  const manualFields = {
    dato: dateFieldWithBounds(manualId, manualRowPath, 'dato', 'Dato', systemrammeSpec),
    grundloen: optField<AmountValue>(manualId, manualRowPath, 'grundloen', 'Grundløn', 'text', tableAmountCodec),
    feriepenge: optField<number>(manualId, manualRowPath, 'feriepenge', 'Feriepenge', 'text', percentCodec, [percentBoundsValidator(`${manualId}.feriepenge.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })]),
    shSoSats: optField<number>(manualId, manualRowPath, 'shSoSats', 'SH/SO-sats', 'text', percentCodec, [percentBoundsValidator(`${manualId}.shSoSats.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })]),
    fritvalg: optField<number>(manualId, manualRowPath, 'fritvalg', 'Fritvalg', 'text', percentCodec, [percentBoundsValidator(`${manualId}.fritvalg.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })]),
    agPension: optField<number>(manualId, manualRowPath, 'agPension', 'Arbejdsgivers pension', 'text', percentCodec, [percentBoundsValidator(`${manualId}.agPension.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })]),
  } as const;
  const manualPercentFields = {
    dato: dateFieldWithBounds(manualPercentId, manualPercentRowPath, 'dato', 'Dato', systemrammeSpec),
    procent: optField<number>(manualPercentId, manualPercentRowPath, 'procent', 'Procent', 'text', percentCodec, [percentBoundsValidator(`${manualPercentId}.procent.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })]),
  } as const;

  return {
    manualCollection,
    manualPercentCollection,
    manualFields,
    manualPercentFields,
    collections: catalogCollections(manualCollection, manualPercentCollection),
    fields: catalogFields(
      manualFields.dato,
      manualFields.grundloen,
      manualFields.feriepenge,
      manualFields.shSoSats,
      manualFields.fritvalg,
      manualFields.agPension,
      manualPercentFields.dato,
      manualPercentFields.procent,
    ),
  };
};

export const eoEmploymentManual = createManualBindings(EMP_ID, employmentPath);
const employmentManual = eoEmploymentManual;

// ── eoAngivetLoenLoenudvikling (singulært property-objekt) ──────────────────────────
const EO_LOEN_ID = 'eo.eoAngivetLoenLoenudvikling';
const eoLoen = <T>(
  field: string, label: string, controlKind: FieldControlKind, codec: FieldCodec<T | undefined>,
  validators?: readonly FieldValidator<T | undefined>[],
) => optField<T>(EO_LOEN_ID, eoLoenPath, field, label, controlKind, codec, validators);
const eoLoenAmountBounds = (field: string): readonly FieldValidator<AmountValue | undefined>[] =>
  [amountBoundsValidator(`${EO_LOEN_ID}.${field}.bounds`, 0, undefined)];

/** Datofelt på det singulære eoLoen-objekt — tvillingen til {@link empDate}. */
const eoLoenDate = (
  field: string, label: string, spec: DateBoundsSpec = systemrammeSpec,
): FieldDescriptor<ISODateString | undefined> =>
  dateFieldWithBounds(EO_LOEN_ID, eoLoenPath, field, label, spec);

export const eoAngivetLoenFields = {
  overenskomstId: eoLoen<string>('overenskomstId', 'Vælg overenskomst', 'choice', optionalTextCodec),
  harAnciennitetstillaegEfterSkadedatoen: createField<boolean>({ ownerId: EO_LOEN_ID, path: eoLoenPath, field: 'harAnciennitetstillaegEfterSkadedatoen', label: 'Anciennitetstillæg efter skadedatoen', controlKind: 'toggle', codec: booleanFieldCodec, emptyValue: false, isEmpty: () => false }),
  anciennitetstillaegDato: eoLoenDate('anciennitetstillaegDato', 'Dato for opnået anciennitetstillæg'),
  anciennitetstillaegSatsAngivesPer: reqChoiceField(EO_LOEN_ID, eoLoenPath, 'anciennitetstillaegSatsAngivesPer', 'Satsen angives per', anciennitetSatsPerEnum.options, 'Måned'),
  anciennitetstillaegSats: eoLoen<AmountValue>('anciennitetstillaegSats', 'Anciennitetstillægssats', 'text', amountCodec, eoLoenAmountBounds('anciennitetstillaegSats')),
  feriePct: eoLoen<number>('feriePct', 'Feriegodtgørelse/-tillæg', 'text', percentCodec, [percentBoundsValidator(`${EO_LOEN_ID}.feriePct.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })]),
  // Samme required-choice-kontrakt som ansættelsesforholdets tvilling (`eoEmploymentFields.loenPaaHelligdage`).
  // Feltet har ingen editor under angivet løn, så dets værdi ER tomværdien — og en tomværdi på `undefined`
  // ville føde motoren en tilstand, den erklærer umulig. Descriptorens tomværdi skal derfor være den
  // samme konkrete sats, som schemaets `.default()` giver.
  loenPaaHelligdage: reqChoiceField(EO_LOEN_ID, eoLoenPath, 'loenPaaHelligdage', 'Løn på helligdage', loenPaaHelligdageEnum.options, 'Almindelig løn'),
  saerligFraDatoRegulering: eoLoenDate('saerligFraDatoRegulering', 'Særlig fra-dato for regulering'),
  loenudviklingBeregningsgrundlag: optField(EO_LOEN_ID, eoLoenPath, 'loenudviklingBeregningsgrundlag', 'Lønudvikling beregnes ud fra', 'choice', createChoiceFieldCodec(loenudviklingBeregningsgrundlagEnum.options)),
  loenudviklingStatistikModel: optField(EO_LOEN_ID, eoLoenPath, 'loenudviklingStatistikModel', 'Statistisk beregningsmodel', 'choice', createChoiceFieldCodec(loenudviklingStatistikModelEnum.options)),
  loenudviklingKRLSatstabel: optField(EO_LOEN_ID, eoLoenPath, 'loenudviklingKRLSatstabel', 'Satstabel', 'choice', createChoiceFieldCodec(krlSatstabelEnum.options)),
  loenudviklingManuelNavn: eoLoen<string>('loenudviklingManuelNavn', 'Navn på reguleringsform', 'text', optionalTextCodec),
  offentligLoenType: optField(EO_LOEN_ID, eoLoenPath, 'offentligLoenType', 'Ansættelse', 'choice', createChoiceFieldCodec(offentligLoenTypeEnum.options)),
  offentligLoenTrin: eoLoen<number>('offentligLoenTrin', 'Løntrin', 'text', integerCodec(1, 55, 2), [integerBoundsValidator(`${EO_LOEN_ID}.offentligLoenTrin.bounds`, 1, 55)]),
  offentligLoenGruppe: eoLoen<number>('offentligLoenGruppe', 'Gruppe', 'text', integerCodec(0, 4, 1), [integerBoundsValidator(`${EO_LOEN_ID}.offentligLoenGruppe.bounds`, 0, 4)]),
  offentligLoenEkstraGrundloen: eoLoen<AmountValue>('offentligLoenEkstraGrundloen', 'Forhøjet grundløn ud over løntrin', 'text', amountCodec, eoLoenAmountBounds('offentligLoenEkstraGrundloen')),
} as const;

const eoLoenFields = Object.values(eoAngivetLoenFields);

export const eoAngivetLoenFilterFields = {
  loenmodtager: filterField(EO_LOEN_ID, eoLoenPath, 'loenmodtager'),
  arbejdsgiver: filterField(EO_LOEN_ID, eoLoenPath, 'arbejdsgiver'),
} as const;

const eoLoenFilterFields = Object.values(eoAngivetLoenFilterFields);

export const eoAngivetLoenManual = createManualBindings(EO_LOEN_ID, eoLoenPath);
const eoLoenManual = eoAngivetLoenManual;

// De navngivne descriptorgrupper eksporteres som records, som readerprojektion og grid binder direkte.
// Aggregatarrayet afledes fra `Object.values(...)` af de samme records, så kataloget ikke kan
// drive fra de eksporterede refs. `Object.values` giver et union-typet array; `eraseFieldGroup` type-eraser det til
// katalogets eksistentielle visning (samme erasure som `catalogFields`, men uden tuple-invarians på et union-array).
const eraseFieldGroup = (fields: readonly FieldDescriptor<unknown>[]): readonly FieldDescriptor<unknown>[] => fields;

export const erstatningsopgoerelseLoenFields = Object.freeze([
  ...eraseFieldGroup(employmentFields as readonly FieldDescriptor<unknown>[]),
  ...eraseFieldGroup(employmentFilterFields as readonly FieldDescriptor<unknown>[]),
  ...eraseFieldGroup(standardRowFields as readonly FieldDescriptor<unknown>[]),
  ...employmentManual.fields,
  ...eraseFieldGroup(eoLoenFields as readonly FieldDescriptor<unknown>[]),
  ...eraseFieldGroup(eoLoenFilterFields as readonly FieldDescriptor<unknown>[]),
  ...eoLoenManual.fields,
]);

export const erstatningsopgoerelseLoenCollections = Object.freeze([
  ...catalogCollections(eoLoenindkomstAnsaettelsesforholdCollection, eoLoenindkomstStandardRowsCollection),
  ...employmentManual.collections,
  ...eoLoenManual.collections,
]);
