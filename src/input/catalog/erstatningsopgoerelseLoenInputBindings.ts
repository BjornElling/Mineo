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
  type EOAngivetLoenLoenudvikling,
  type LoenindkomstAnsaettelsesforhold,
  type LoenudviklingManuelProcentsatsRow,
  type LoenudviklingManuelRow,
  type StandardLoenTableRow,
} from '../../schemas/formSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../types/branded';
import type { CollectionBinding, FieldAddressTemplate, FieldBinding } from '../fieldCatalog';
import type { FieldCodec, FieldControlKind } from '../fieldDefinition';
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
import { defineField } from '../fieldDefinition';
import { createStructuralCollectionBinding, createStructuralFieldBinding } from '../structuralBindings';
import { defineInputManifest } from './inputManifest';
import { createEmptyErstatningsopgoerelseSection } from './erstatningsopgoerelseInputBindings';

const EMPLOYMENTS = 'loenindkomstAnsaettelsesforhold';
const STANDARD_ROWS = 'indtaegtsoplysningerTableData';
const MANUAL_ROWS = 'loenudviklingManuelTableData';
const MANUAL_PERCENT_ROWS = 'loenudviklingManuelProcentsatsTableData';
const EO_LOEN_PROPERTY = 'eoAngivetLoenLoenudvikling';

const createBinding = <T>(options: Readonly<{
  field: string;
  label: string;
  controlKind: FieldControlKind;
  codec: FieldCodec<T>;
  path: FieldAddressTemplate['path'];
}>): FieldBinding<T> => createStructuralFieldBinding({
  definition: defineField({
    label: options.label,
    controlKind: options.controlKind,
    codec: options.codec,
  }),
  template: { section: 'erstatningsopgoerelse', path: options.path, field: options.field },
  createEmptySection: createEmptyErstatningsopgoerelseSection,
});

const employmentPath = [{ kind: 'entity', collection: EMPLOYMENTS }] as const;
const eoLoenPath = [{ kind: 'property', name: EO_LOEN_PROPERTY }] as const;

const employmentField = <K extends keyof LoenindkomstAnsaettelsesforhold>(options: Readonly<{
  field: K;
  label: string;
  controlKind: FieldControlKind;
  codec: FieldCodec<LoenindkomstAnsaettelsesforhold[K]>;
}>): FieldBinding<LoenindkomstAnsaettelsesforhold[K]> => createBinding({
  ...options,
  field: String(options.field),
  path: employmentPath,
});

const eoLoenField = <K extends keyof EOAngivetLoenLoenudvikling>(options: Readonly<{
  field: K;
  label: string;
  controlKind: FieldControlKind;
  codec: FieldCodec<EOAngivetLoenLoenudvikling[K]>;
}>): FieldBinding<EOAngivetLoenLoenudvikling[K]> => createBinding({
  ...options,
  field: String(options.field),
  path: eoLoenPath,
});

const optionalTextCodec = createOptionalTextFieldCodec();
const dateCodec = createDateFieldCodec({ twoDigitYearPolicy: 'infer' });
const percentCodec = createPercentFieldCodec({
  allowNegative: false,
  allowDecimals: true,
  minValue: 0,
  maxValue: 100,
});
const amountCodec = createAmountFieldCodec({ allowNegative: false, allowDecimals: true });
const tableAmountCodec = createAmountFieldCodec({ allowNegative: true, allowDecimals: true });
const integerCodec = (minValue: number, maxValue: number, maxDigits: number) => createIntegerFieldCodec({
  allowNegative: false,
  minValue,
  maxValue,
  maxDigits,
});

export const eoLoenindkomstAnsaettelsesforholdBinding: CollectionBinding<LoenindkomstAnsaettelsesforhold> =
  createStructuralCollectionBinding({
    template: { section: 'erstatningsopgoerelse', path: [], collection: EMPLOYMENTS },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const employmentFields = [
  employmentField({ field: 'navnPaaArbejdssted', label: 'Navn på arbejdssted', controlKind: 'text', codec: optionalTextCodec }),
  employmentField({ field: 'harOverenskomst', label: 'Overenskomst', controlKind: 'toggle', codec: booleanFieldCodec }),
  employmentField({ field: 'overenskomstId', label: 'Vælg overenskomst', controlKind: 'choice', codec: optionalTextCodec }),
  employmentField({ field: 'ansatPaaSkadestidspunktet', label: 'Ansat på skadestidspunktet', controlKind: 'toggle', codec: booleanFieldCodec }),
  employmentField({ field: 'ansaettelsesforholdOphoert', label: 'Opsagt fra stillingen', controlKind: 'toggle', codec: booleanFieldCodec }),
  employmentField({ field: 'sidsteArbejdsdag', label: 'Sidste dag i ansættelsesforholdet', controlKind: 'text', codec: dateCodec }),
  employmentField({ field: 'fritvalgPct', label: 'Fritvalg', controlKind: 'text', codec: percentCodec }),
  employmentField({ field: 'shSoPct', label: 'SH/SO-sats', controlKind: 'text', codec: percentCodec }),
  employmentField({ field: 'storeBededagPct', label: 'Store Bededagstillæg', controlKind: 'text', codec: percentCodec }),
  employmentField({ field: 'pensionPct', label: 'Arbejdsgivers pensionsbidrag', controlKind: 'text', codec: percentCodec }),
  employmentField({ field: 'tillaegAngivesSom', label: 'Tillæg angives som', controlKind: 'choice', codec: createRequiredChoiceFieldCodec(tillaegAngivesSomEnum.options) }),
  employmentField({ field: 'loenperiode', label: 'Løn indtastes som', controlKind: 'choice', codec: createRequiredChoiceFieldCodec(loenperiodeEnum.options) }),
  employmentField({ field: 'fuldLoenUnderFerie', label: 'Fuld løn under ferie', controlKind: 'toggle', codec: createRequiredChoiceFieldCodec(['Ja', 'Nej'] as const) }),
  employmentField({ field: 'harAnciennitetstillaegEfterSkadedatoen', label: 'Anciennitetstillæg efter skadedatoen', controlKind: 'toggle', codec: booleanFieldCodec }),
  employmentField({ field: 'anciennitetstillaegDato', label: 'Dato for opnået anciennitetstillæg', controlKind: 'text', codec: dateCodec }),
  employmentField({ field: 'anciennitetstillaegSatsAngivesPer', label: 'Satsen angives per', controlKind: 'choice', codec: createRequiredChoiceFieldCodec(anciennitetSatsPerEnum.options) }),
  employmentField({ field: 'anciennitetstillaegSats', label: 'Anciennitetstillægssats', controlKind: 'text', codec: amountCodec }),
  employmentField({ field: 'feriePct', label: 'Feriegodtgørelse/-tillæg', controlKind: 'text', codec: percentCodec }),
  employmentField({ field: 'loenPaaHelligdage', label: 'Løn på helligdage', controlKind: 'choice', codec: createRequiredChoiceFieldCodec(loenPaaHelligdageEnum.options) }),
  employmentField({ field: 'saerligFraDatoRegulering', label: 'Særlig fra-dato for regulering', controlKind: 'text', codec: dateCodec }),
  employmentField({ field: 'loenudviklingBeregningsgrundlag', label: 'Lønudvikling beregnes ud fra', controlKind: 'choice', codec: createChoiceFieldCodec(loenudviklingBeregningsgrundlagEnum.options) }),
  employmentField({ field: 'loenudviklingStatistikModel', label: 'Statistisk beregningsmodel', controlKind: 'choice', codec: createChoiceFieldCodec(loenudviklingStatistikModelEnum.options) }),
  employmentField({ field: 'loenudviklingKRLSatstabel', label: 'Satstabel', controlKind: 'choice', codec: createChoiceFieldCodec(krlSatstabelEnum.options) }),
  employmentField({ field: 'loenudviklingManuelNavn', label: 'Navn på reguleringsform', controlKind: 'text', codec: optionalTextCodec }),
  employmentField({ field: 'offentligLoenType', label: 'Ansættelse', controlKind: 'choice', codec: createChoiceFieldCodec(offentligLoenTypeEnum.options) }),
  employmentField({ field: 'offentligLoenTrin', label: 'Løntrin', controlKind: 'text', codec: integerCodec(1, 55, 2) }),
  employmentField({ field: 'offentligLoenGruppe', label: 'Gruppe', controlKind: 'text', codec: integerCodec(0, 4, 1) }),
  employmentField({ field: 'offentligLoenEkstraGrundloen', label: 'Forhøjet grundløn ud over løntrin', controlKind: 'text', codec: amountCodec }),
] as const;

const filterField = (
  ownerPath: FieldAddressTemplate['path'],
  field: 'loenmodtager' | 'arbejdsgiver'
): FieldBinding<string | undefined> => createBinding({
  field,
  label: field === 'loenmodtager' ? 'Lønmodtagerfilter' : 'Arbejdsgiverfilter',
  controlKind: 'choice',
  codec: optionalTextCodec,
  path: [...ownerPath, { kind: 'property', name: 'overenskomstFilter' }],
});

const employmentFilterFields = [
  filterField(employmentPath, 'loenmodtager'),
  filterField(employmentPath, 'arbejdsgiver'),
] as const;

const standardLoenDefinitions = () => ({
  col0_maaned: defineField<string | undefined>({
    label: 'Måned', controlKind: 'text',
    codec: createStringBackedFieldCodec(integerCodec(1, 12, 2)),
  }),
  col1_maaned: defineField<string | undefined>({
    label: 'År', controlKind: 'text',
    codec: createStringBackedFieldCodec(createYearFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: CURRENT_YEAR })),
  }),
  col0_uge: defineField<string | undefined>({
    label: 'Uge fra', controlKind: 'text',
    codec: createStringBackedFieldCodec(createWeekFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: CURRENT_YEAR, maxDraftLength: 8 })),
  }),
  col1_uge: defineField<string | undefined>({
    label: 'Uge til', controlKind: 'text',
    codec: createStringBackedFieldCodec(createWeekFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: CURRENT_YEAR, maxDraftLength: 8 })),
  }),
  col0_dag: defineField<ISODateString | undefined>({ label: 'Dato fra', controlKind: 'text', codec: dateCodec }),
  col1_dag: defineField<ISODateString | undefined>({ label: 'Dato til', controlKind: 'text', codec: dateCodec }),
  col2: defineField<AmountValue | undefined>({ label: 'Løn', controlKind: 'text', codec: tableAmountCodec }),
  col3: defineField<AmountValue | undefined>({ label: 'Løn (2)', controlKind: 'text', codec: tableAmountCodec }),
  col4: defineField<AmountValue | undefined>({ label: 'Løn (3)', controlKind: 'text', codec: tableAmountCodec }),
  col5: defineField<AmountValue | undefined>({ label: 'Løn (4)', controlKind: 'text', codec: tableAmountCodec }),
  fpFvShSoBeloeb: defineField<AmountValue | undefined>({ label: 'FP/FV/SH/SO/St.B.', controlKind: 'text', codec: tableAmountCodec }),
  pensionBeloeb: defineField<AmountValue | undefined>({ label: 'Arb.g. Pension', controlKind: 'text', codec: tableAmountCodec }),
});

const standardDefinitions = standardLoenDefinitions();

export const eoLoenindkomstStandardRowsBinding: CollectionBinding<StandardLoenTableRow> =
  createStructuralCollectionBinding({
    template: { section: 'erstatningsopgoerelse', path: employmentPath, collection: STANDARD_ROWS },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const standardRowField = <K extends keyof typeof standardDefinitions>(field: K): FieldBinding<StandardLoenTableRow[K]> =>
  createStructuralFieldBinding<StandardLoenTableRow[K]>({
    definition: standardDefinitions[field] as FieldBinding<StandardLoenTableRow[K]>['definition'],
    template: {
      section: 'erstatningsopgoerelse',
      path: [...employmentPath, { kind: 'entity', collection: STANDARD_ROWS }],
      field,
    },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });

const standardRowFields = [
  standardRowField('col0_maaned'),
  standardRowField('col1_maaned'),
  standardRowField('col0_uge'),
  standardRowField('col1_uge'),
  standardRowField('col0_dag'),
  standardRowField('col1_dag'),
  standardRowField('col2'),
  standardRowField('col3'),
  standardRowField('col4'),
  standardRowField('col5'),
  standardRowField('fpFvShSoBeloeb'),
  standardRowField('pensionBeloeb'),
] as const;

const createManualCollectionBindings = (ownerPath: FieldAddressTemplate['path']) => {
  const manualCollection = createStructuralCollectionBinding<LoenudviklingManuelRow>({
    template: { section: 'erstatningsopgoerelse', path: ownerPath, collection: MANUAL_ROWS },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
  const manualPercentCollection = createStructuralCollectionBinding<LoenudviklingManuelProcentsatsRow>({
    template: { section: 'erstatningsopgoerelse', path: ownerPath, collection: MANUAL_PERCENT_ROWS },
    createEmptySection: createEmptyErstatningsopgoerelseSection,
  });
  const manualEntityPath = [...ownerPath, { kind: 'entity' as const, collection: MANUAL_ROWS }];
  const manualPercentEntityPath = [...ownerPath, { kind: 'entity' as const, collection: MANUAL_PERCENT_ROWS }];
  const manualField = <K extends Exclude<keyof LoenudviklingManuelRow, 'id'>>(
    name: K,
    label: string,
    codec: FieldCodec<LoenudviklingManuelRow[K]>
  ): FieldBinding<LoenudviklingManuelRow[K]> => createBinding({
    field: String(name), label, controlKind: 'text', codec, path: manualEntityPath,
  });
  const manualPercentField = <K extends Exclude<keyof LoenudviklingManuelProcentsatsRow, 'id'>>(
    name: K,
    label: string,
    codec: FieldCodec<LoenudviklingManuelProcentsatsRow[K]>
  ): FieldBinding<LoenudviklingManuelProcentsatsRow[K]> => createBinding({
    field: String(name), label, controlKind: 'text', codec, path: manualPercentEntityPath,
  });

  const manualFields = [
    manualField('dato', 'Dato', dateCodec),
    manualField('grundloen', 'Grundløn', tableAmountCodec),
    manualField('feriepenge', 'Feriepenge', percentCodec),
    manualField('shSoSats', 'SH/SO-sats', percentCodec),
    manualField('fritvalg', 'Fritvalg', percentCodec),
    manualField('agPension', 'Arbejdsgivers pension', percentCodec),
    manualPercentField('dato', 'Dato', dateCodec),
    manualPercentField('procent', 'Procent', percentCodec),
  ] as const;

  return {
    manualCollection,
    manualPercentCollection,
    collections: [manualCollection, manualPercentCollection] as const,
    fields: manualFields,
  };
};

const employmentManualBindings = createManualCollectionBindings(employmentPath);

const eoLoenFields = [
  eoLoenField({ field: 'overenskomstId', label: 'Vælg overenskomst', controlKind: 'choice', codec: optionalTextCodec }),
  eoLoenField({ field: 'harAnciennitetstillaegEfterSkadedatoen', label: 'Anciennitetstillæg efter skadedatoen', controlKind: 'toggle', codec: booleanFieldCodec }),
  eoLoenField({ field: 'anciennitetstillaegDato', label: 'Dato for opnået anciennitetstillæg', controlKind: 'text', codec: dateCodec }),
  eoLoenField({ field: 'anciennitetstillaegSatsAngivesPer', label: 'Satsen angives per', controlKind: 'choice', codec: createRequiredChoiceFieldCodec(anciennitetSatsPerEnum.options) }),
  eoLoenField({ field: 'anciennitetstillaegSats', label: 'Anciennitetstillægssats', controlKind: 'text', codec: amountCodec }),
  eoLoenField({ field: 'feriePct', label: 'Feriegodtgørelse/-tillæg', controlKind: 'text', codec: percentCodec }),
  eoLoenField({ field: 'loenPaaHelligdage', label: 'Løn på helligdage', controlKind: 'choice', codec: createChoiceFieldCodec(loenPaaHelligdageEnum.options) }),
  eoLoenField({ field: 'saerligFraDatoRegulering', label: 'Særlig fra-dato for regulering', controlKind: 'text', codec: dateCodec }),
  eoLoenField({ field: 'loenudviklingBeregningsgrundlag', label: 'Lønudvikling beregnes ud fra', controlKind: 'choice', codec: createChoiceFieldCodec(loenudviklingBeregningsgrundlagEnum.options) }),
  eoLoenField({ field: 'loenudviklingStatistikModel', label: 'Statistisk beregningsmodel', controlKind: 'choice', codec: createChoiceFieldCodec(loenudviklingStatistikModelEnum.options) }),
  eoLoenField({ field: 'loenudviklingKRLSatstabel', label: 'Satstabel', controlKind: 'choice', codec: createChoiceFieldCodec(krlSatstabelEnum.options) }),
  eoLoenField({ field: 'loenudviklingManuelNavn', label: 'Navn på reguleringsform', controlKind: 'text', codec: optionalTextCodec }),
  eoLoenField({ field: 'offentligLoenType', label: 'Ansættelse', controlKind: 'choice', codec: createChoiceFieldCodec(offentligLoenTypeEnum.options) }),
  eoLoenField({ field: 'offentligLoenTrin', label: 'Løntrin', controlKind: 'text', codec: integerCodec(1, 55, 2) }),
  eoLoenField({ field: 'offentligLoenGruppe', label: 'Gruppe', controlKind: 'text', codec: integerCodec(0, 4, 1) }),
  eoLoenField({ field: 'offentligLoenEkstraGrundloen', label: 'Forhøjet grundløn ud over løntrin', controlKind: 'text', codec: amountCodec }),
] as const;

const eoFilterFields = [
  filterField(eoLoenPath, 'loenmodtager'),
  filterField(eoLoenPath, 'arbejdsgiver'),
] as const;

const eoManualBindings = createManualCollectionBindings(eoLoenPath);

export const eoLoenindkomstManualRowsBinding = employmentManualBindings.manualCollection;
export const eoLoenindkomstManualPercentRowsBinding = employmentManualBindings.manualPercentCollection;
export const eoAngivetLoenManualRowsBinding = eoManualBindings.manualCollection;
export const eoAngivetLoenManualPercentRowsBinding = eoManualBindings.manualPercentCollection;

export const eoLoenCollectionBindings = [
  eoLoenindkomstAnsaettelsesforholdBinding,
  eoLoenindkomstStandardRowsBinding,
  ...employmentManualBindings.collections,
  ...eoManualBindings.collections,
] as readonly CollectionBinding<unknown>[];

export const eoLoenFieldBindings = [
  ...employmentFields,
  ...employmentFilterFields,
  ...standardRowFields,
  ...employmentManualBindings.fields,
  ...eoLoenFields,
  ...eoFilterFields,
  ...eoManualBindings.fields,
] as readonly FieldBinding<unknown>[];

export const erstatningsopgoerelseLoenInputManifest = defineInputManifest({
  id: 'erstatningsopgoerelse-loen',
  fields: eoLoenFieldBindings,
  collections: eoLoenCollectionBindings,
});
