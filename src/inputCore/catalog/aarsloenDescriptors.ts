import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type {
  LoenPaaHelligdage,
  Loenperiode,
  TillaegAngivesSom,
} from '../../schemas/formSchemas/enumSchemas';
import type { StandardLoenTableRow } from '../../schemas/formSchemas/sections/aarsloenSchemas';
import type { ISODateString } from '../../types/branded';
import { CURRENT_YEAR, dateRanges_aarsloen, MIN_YEAR } from '../../config/dateRanges';
import { resolveDateRangeErrorMessage } from '../../utils/dateRangeErrorMessages';
import { parseWeekString } from '../../utils/dateUtils';
import { DATE_ORDER_ERROR_MESSAGE } from '../../utils/dateOrderValidation';
import { maxISO, minISO } from '../../utils/isoDateHelpers';
import {
  booleanFieldCodec,
  createBooleanFieldCodec,
  createAmountFieldCodec,
  createDateFieldCodec,
  createIntegerFieldCodec,
  createPercentFieldCodec,
  createRequiredChoiceFieldCodec,
  createStringBackedFieldCodec,
  createWeekFieldCodec,
  createYearFieldCodec,
} from '../fieldCodecs';
import { catalogCollections, catalogFields } from '../fieldCatalog';
import type {
  CanonicalView,
  FieldAddressTemplate,
  FieldDescriptor,
  FieldRef,
  FieldValidator,
  RelevanceRule,
} from '../fieldDescriptor';
import type { FieldCodec } from '../fieldCodec';
import {
  defineStructuralCollection,
  defineStructuralField,
  isEmptyString,
  isUndefined,
} from '../structuralDescriptors';
import {
  canonicalStringCodecValidator,
  integerStringBoundsValidator,
  percentBoundsValidator,
  weekYearBoundsValidator,
  yearStringBoundsValidator,
} from './boundsValidators';

// Greenfield produkt-descriptors for `aarsloen`-sektionen (§3.2). Måned/år bevarer schemaets historiske
// canonical strengrepræsentation via string-backed codec; ugefelterne er allerede canonical strenge.

const createEmptyAarsloenSection = (): unknown => ({ tableData: [] });

const isPercentMode = <T>(_field: FieldRef<T>, view: CanonicalView): boolean =>
  view.readCanonical(aarsloenTillaegAngivesSomField.bind()) !== 'beloeb';

const isAmountMode = <T>(_field: FieldRef<T>, view: CanonicalView): boolean =>
  view.readCanonical(aarsloenTillaegAngivesSomField.bind()) === 'beloeb';

const periodIs = <T>(period: Loenperiode): RelevanceRule<T> =>
  (_field, view) => view.readCanonical(aarsloenLoenperiodeField.bind()) === period;

const rowIdOf = <T>(field: FieldRef<T>): string => {
  const entity = field.address.path.find((segment) => segment.kind === 'entity' && segment.collection === 'tableData');
  if (entity?.kind !== 'entity') throw new Error(`Årsløn-feltet ${field.descriptor.id} mangler tableData-entity`);
  return entity.entityId;
};

const percentField = (field: string, label: string): FieldDescriptor<number | undefined> =>
  defineStructuralField<number | undefined>({
    id: `aarsloen.${field}`,
    template: { section: 'aarsloen', path: [], field },
    codec: createPercentFieldCodec({ allowNegative: false, allowDecimals: true, minValue: 0, maxValue: 100 }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyAarsloenSection,
    relevance: isPercentMode,
    validators: [percentBoundsValidator(`aarsloen.${field}.bounds`, { minValue: 0, maxValue: 100, allowDecimals: true })],
  });

export const aarsloenFeriePctField = percentField('feriePct', 'Feriegodtgørelse/-tillæg');
export const aarsloenFritvalgPctField = percentField('fritvalgPct', 'Fritvalg');
export const aarsloenShSoPctField = percentField('shSoPct', 'SH/SO-sats');
export const aarsloenStoreBededagPctField = percentField('storeBededagPct', 'Store Bededagstillæg');
export const aarsloenPensionPctField = percentField('pensionPct', 'Arbejdsgivers pensionsbidrag');

export const aarsloenLoenperiodeField = defineStructuralField<Loenperiode>({
  id: 'aarsloen.loenperiode',
  template: { section: 'aarsloen', path: [], field: 'loenperiode' },
  codec: createRequiredChoiceFieldCodec<Loenperiode>(['maaned', 'uge', 'dag'], 'maaned'),
  emptyValue: 'maaned',
  isEmpty: () => false,
  label: 'Løn indtastes som',
  controlKind: 'choice',
  createEmptySection: createEmptyAarsloenSection,
});

export const aarsloenTillaegAngivesSomField = defineStructuralField<TillaegAngivesSom>({
  id: 'aarsloen.tillaegAngivesSom',
  template: { section: 'aarsloen', path: [], field: 'tillaegAngivesSom' },
  codec: createRequiredChoiceFieldCodec<TillaegAngivesSom>(['procent', 'beloeb'], 'procent'),
  emptyValue: 'procent',
  isEmpty: () => false,
  label: 'Tillæg angives som',
  controlKind: 'choice',
  createEmptySection: createEmptyAarsloenSection,
});

export const aarsloenLoenPaaHelligdageField = defineStructuralField<LoenPaaHelligdage>({
  id: 'aarsloen.loenPaaHelligdage',
  template: { section: 'aarsloen', path: [], field: 'loenPaaHelligdage' },
  codec: createRequiredChoiceFieldCodec<LoenPaaHelligdage>(
    ['Almindelig løn', 'SH-udbetaling', 'Ingen'],
    'Almindelig løn'
  ),
  emptyValue: 'Almindelig løn',
  isEmpty: () => false,
  label: 'Løn på helligdage',
  controlKind: 'choice',
  createEmptySection: createEmptyAarsloenSection,
});

const toggle = (field: string, label: string, emptyValue: boolean): FieldDescriptor<boolean> =>
  defineStructuralField<boolean>({
    id: `aarsloen.${field}`,
    template: { section: 'aarsloen', path: [], field },
    codec: emptyValue ? createBooleanFieldCodec(true) : booleanFieldCodec,
    emptyValue,
    isEmpty: () => false,
    label,
    controlKind: 'toggle',
    createEmptySection: createEmptyAarsloenSection,
  });

export const aarsloenOmregningTilFuldtAarField = toggle('omregningTilFuldtAar', 'Omregning til fuldt år', false);
export const aarsloenFuldLoenUnderFerieField = toggle('fuldLoenUnderFerie', 'Fuld løn under ferie', true);
export const aarsloenRetTilSjetteFerieugeField = toggle('retTilSjetteFerieuge', 'Ret til 6. ferieuge', true);

// 0..99 er en afledt bounds-issue (feltvalidator), ikke codec-config: antalFeriedage forbliver canonical med et
// rødt afledt issue uden for [0,99] (§1.6), i modsætning til et format/range-rejected råtekst-felt. Reglen er
// KUN relevant, når omregning er valgt OG der ikke er fuld løn under ferie — udtrykt som en ren relevansregel
// over de canonical toggle-felter (§3.1: relevans må aldrig afhænge af mounted state/settings). Et skjult/
// irrelevant felt overblokerer ikke (§1.9). Spejler legacy `resolveAarsloenCanonicalRangeIssues`.
export const aarsloenAntalFeriedageField = defineStructuralField<number | undefined>({
  id: 'aarsloen.antalFeriedage',
  template: { section: 'aarsloen', path: [], field: 'antalFeriedage' },
  codec: createIntegerFieldCodec({ allowNegative: false }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Antal feriedage (mandag-fredag) i de indtastede perioder',
  controlKind: 'text',
  createEmptySection: createEmptyAarsloenSection,
  relevance: (_field, view) => {
    const omregning = view.readCanonical(aarsloenOmregningTilFuldtAarField.bind());
    const fuldLoen = view.readCanonical(aarsloenFuldLoenUnderFerieField.bind());
    return omregning === true && fuldLoen !== true;
  },
  validators: [
    (value) => {
      if (value === undefined) return undefined;
      if (value < 0 || value > 99) {
        return {
          reason: 'bounds',
          code: 'aarsloen.antalFeriedage.bounds',
          message: 'Antal feriedage skal være mellem 0 og 99.',
        };
      }
      return undefined;
    },
  ],
});

// ── Samlingen tableData ────────────────────────────────────────────────────────
export const aarsloenTableDataCollection = defineStructuralCollection<StandardLoenTableRow>({
  id: 'aarsloen.tableData',
  template: { section: 'aarsloen', path: [], collection: 'tableData' },
  createEmptySection: createEmptyAarsloenSection,
});

const rowTemplate = (field: string): FieldAddressTemplate => ({
  section: 'aarsloen',
  path: [{ kind: 'entity', collection: 'tableData' }],
  field,
});

const dateBoundsValidator = (
  role: 'fra' | 'til'
): FieldValidator<ISODateString | undefined> => (value, field, view) => {
  if (value === undefined) return undefined;
  const rowId = rowIdOf(field);
  const counterpart = role === 'fra'
    ? view.readCanonical(aarsloenTableCol1DagField.bind(rowId))
    : view.readCanonical(aarsloenTableCol0DagField.bind(rowId));
  const minDate = role === 'fra'
    ? dateRanges_aarsloen.tabelAarsloenFra.min
    : counterpart === undefined
      ? dateRanges_aarsloen.tabelAarsloenTil.fallbackMin
      : maxISO(counterpart, dateRanges_aarsloen.tabelAarsloenTil.fallbackMin);
  const maxDate = role === 'fra'
    ? counterpart === undefined
      ? dateRanges_aarsloen.tabelAarsloenFra.fallbackMax
      : minISO(counterpart, dateRanges_aarsloen.tabelAarsloenFra.fallbackMax)
    : dateRanges_aarsloen.tabelAarsloenTil.max;
  if (value >= minDate && value <= maxDate) return undefined;
  return {
    reason: 'bounds',
    code: `aarsloen.tableData.${role}.bounds`,
    message: resolveDateRangeErrorMessage({
      iso: value,
      minDate,
      maxDate,
      special: { fraTilRole: role },
      noValidRangeInputs: 'Dato fra og Dato til i samme række',
    }),
    detail: { minDate, maxDate },
  };
};

const weekOrderValidator = (
  role: 'fra' | 'til'
): FieldValidator<string | undefined> => (value, field, view) => {
  if (value === undefined || value.trim() === '') return undefined;
  const rowId = rowIdOf(field);
  const counterpart = role === 'fra'
    ? view.readCanonical(aarsloenTableCol1UgeField.bind(rowId))
    : view.readCanonical(aarsloenTableCol0UgeField.bind(rowId));
  if (counterpart === undefined || counterpart.trim() === '') return undefined;
  const fra = parseWeekString(role === 'fra' ? value : counterpart);
  const til = parseWeekString(role === 'til' ? value : counterpart);
  if (fra === null || til === null || fra.start <= til.end) return undefined;
  return {
    reason: 'bounds',
    code: `aarsloen.tableData.uge.${role}.order`,
    message: DATE_ORDER_ERROR_MESSAGE,
  };
};

const rowDate = (
  field: string,
  label: string,
  role: 'fra' | 'til'
): FieldDescriptor<ISODateString | undefined> =>
  defineStructuralField<ISODateString | undefined>({
    id: `aarsloen.tableData.${field}`,
    template: rowTemplate(field),
    codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyAarsloenSection,
    relevance: periodIs('dag'),
    validators: [dateBoundsValidator(role)],
  });

const rowString = (
  field: string,
  label: string,
  codec: FieldCodec<string | undefined>,
  relevance: RelevanceRule<string | undefined>,
  validators?: readonly FieldValidator<string | undefined>[]
): FieldDescriptor<string | undefined> =>
  defineStructuralField<string | undefined>({
    id: `aarsloen.tableData.${field}`,
    template: rowTemplate(field),
    codec,
    emptyValue: '',
    isEmpty: isEmptyString,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyAarsloenSection,
    relevance,
    validators: [
      canonicalStringCodecValidator(`aarsloen.${field}.schema`, codec),
      ...(validators ?? []),
    ],
  });

// Tabellens beløbskolonner tillader negative (canBeNegative-default i TableAmountInput).
const rowAmount = (
  field: string,
  label: string,
  relevance?: RelevanceRule<AmountValue | undefined>
): FieldDescriptor<AmountValue | undefined> =>
  defineStructuralField<AmountValue | undefined>({
    id: `aarsloen.tableData.${field}`,
    template: rowTemplate(field),
    codec: createAmountFieldCodec({ allowNegative: true, allowDecimals: true }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyAarsloenSection,
    ...(relevance === undefined ? {} : { relevance }),
  });

export const aarsloenTableCol0DagField = rowDate('col0_dag', 'Dato fra', 'fra');
export const aarsloenTableCol1DagField = rowDate('col1_dag', 'Dato til', 'til');
export const aarsloenTableCol0MaanedField = rowString(
  'col0_maaned', 'Måned',
  createStringBackedFieldCodec(createIntegerFieldCodec({ allowNegative: false, maxDigits: 2, minValue: 1, maxValue: 12 })),
  periodIs('maaned'),
  [integerStringBoundsValidator('aarsloen.tableData.col0_maaned.bounds', 1, 12)],
);
export const aarsloenTableCol1MaanedField = rowString(
  'col1_maaned', 'År',
  createStringBackedFieldCodec(createYearFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: CURRENT_YEAR })),
  periodIs('maaned'),
  [yearStringBoundsValidator('aarsloen.tableData.col1_maaned.bounds', MIN_YEAR, CURRENT_YEAR)],
);
export const aarsloenTableCol0UgeField = rowString(
  'col0_uge', 'Uge fra',
  createStringBackedFieldCodec(createWeekFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: CURRENT_YEAR, maxDraftLength: 8 })),
  periodIs('uge'),
  [weekYearBoundsValidator('aarsloen.tableData.col0_uge.bounds', MIN_YEAR, CURRENT_YEAR), weekOrderValidator('fra')],
);
export const aarsloenTableCol1UgeField = rowString(
  'col1_uge', 'Uge til',
  createStringBackedFieldCodec(createWeekFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: CURRENT_YEAR, maxDraftLength: 8 })),
  periodIs('uge'),
  [weekYearBoundsValidator('aarsloen.tableData.col1_uge.bounds', MIN_YEAR, CURRENT_YEAR), weekOrderValidator('til')],
);
export const aarsloenTableCol2Field = rowAmount('col2', 'Løn');
export const aarsloenTableCol3Field = rowAmount('col3', 'Løn (2)');
export const aarsloenTableCol4Field = rowAmount('col4', 'Løn (3)');
export const aarsloenTableCol5Field = rowAmount('col5', 'Løn (4)');
export const aarsloenTableFpFvShSoBeloebField = rowAmount('fpFvShSoBeloeb', 'FP/FV/SH/SO/St.B.', isAmountMode);
export const aarsloenTablePensionBeloebField = rowAmount('pensionBeloeb', 'Arb.g. Pension', isAmountMode);

export const aarsloenFields = catalogFields(
  aarsloenFeriePctField,
  aarsloenFritvalgPctField,
  aarsloenShSoPctField,
  aarsloenStoreBededagPctField,
  aarsloenPensionPctField,
  aarsloenLoenperiodeField,
  aarsloenTillaegAngivesSomField,
  aarsloenLoenPaaHelligdageField,
  aarsloenOmregningTilFuldtAarField,
  aarsloenFuldLoenUnderFerieField,
  aarsloenRetTilSjetteFerieugeField,
  aarsloenAntalFeriedageField,
  aarsloenTableCol0MaanedField,
  aarsloenTableCol1MaanedField,
  aarsloenTableCol0UgeField,
  aarsloenTableCol1UgeField,
  aarsloenTableCol0DagField,
  aarsloenTableCol1DagField,
  aarsloenTableCol2Field,
  aarsloenTableCol3Field,
  aarsloenTableCol4Field,
  aarsloenTableCol5Field,
  aarsloenTableFpFvShSoBeloebField,
  aarsloenTablePensionBeloebField,
);
export const aarsloenCollections = catalogCollections(aarsloenTableDataCollection);
