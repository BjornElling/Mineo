import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type {
  LoenPaaHelligdage,
  Loenperiode,
  TillaegAngivesSom,
} from '../../schemas/formSchemas/enumSchemas';
import type { StandardLoenTableRow } from '../../schemas/formSchemas/sections/aarsloenSchemas';
import type { ISODateString } from '../../types/branded';
import { CURRENT_YEAR, MIN_YEAR } from '../../config/dateRanges';
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
import type { FieldAddressTemplate, FieldDescriptor } from '../fieldDescriptor';
import type { FieldCodec } from '../fieldCodec';
import {
  defineStructuralCollection,
  defineStructuralField,
  isEmptyString,
  isUndefined,
} from '../structuralDescriptors';

// Greenfield produkt-descriptors for `aarsloen`-sektionen (§3.2). Måned/år bevarer schemaets historiske
// canonical strengrepræsentation via string-backed codec; ugefelterne er allerede canonical strenge.

const createEmptyAarsloenSection = (): unknown => ({ tableData: [] });

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

// 0..99 er en afledt bounds-issue, ikke codec-config.
export const aarsloenAntalFeriedageField = defineStructuralField<number | undefined>({
  id: 'aarsloen.antalFeriedage',
  template: { section: 'aarsloen', path: [], field: 'antalFeriedage' },
  codec: createIntegerFieldCodec({ allowNegative: false }),
  emptyValue: undefined,
  isEmpty: isUndefined,
  label: 'Antal feriedage (mandag-fredag) i de indtastede perioder',
  controlKind: 'text',
  createEmptySection: createEmptyAarsloenSection,
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

const rowDate = (field: string, label: string): FieldDescriptor<ISODateString | undefined> =>
  defineStructuralField<ISODateString | undefined>({
    id: `aarsloen.tableData.${field}`,
    template: rowTemplate(field),
    codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyAarsloenSection,
  });

const rowString = (field: string, label: string, codec: FieldCodec<string | undefined>): FieldDescriptor<string | undefined> =>
  defineStructuralField<string | undefined>({
    id: `aarsloen.tableData.${field}`,
    template: rowTemplate(field),
    codec,
    emptyValue: '',
    isEmpty: isEmptyString,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyAarsloenSection,
  });

// Tabellens beløbskolonner tillader negative (canBeNegative-default i TableAmountInput).
const rowAmount = (field: string, label: string): FieldDescriptor<AmountValue | undefined> =>
  defineStructuralField<AmountValue | undefined>({
    id: `aarsloen.tableData.${field}`,
    template: rowTemplate(field),
    codec: createAmountFieldCodec({ allowNegative: true, allowDecimals: true }),
    emptyValue: undefined,
    isEmpty: isUndefined,
    label,
    controlKind: 'text',
    createEmptySection: createEmptyAarsloenSection,
  });

export const aarsloenTableCol0DagField = rowDate('col0_dag', 'Dato fra');
export const aarsloenTableCol1DagField = rowDate('col1_dag', 'Dato til');
export const aarsloenTableCol0MaanedField = rowString(
  'col0_maaned', 'Måned',
  createStringBackedFieldCodec(createIntegerFieldCodec({ allowNegative: false, maxDigits: 2, minValue: 1, maxValue: 12 })),
);
export const aarsloenTableCol1MaanedField = rowString(
  'col1_maaned', 'År',
  createStringBackedFieldCodec(createYearFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: CURRENT_YEAR })),
);
export const aarsloenTableCol0UgeField = rowString(
  'col0_uge', 'Uge fra',
  createStringBackedFieldCodec(createWeekFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: CURRENT_YEAR, maxDraftLength: 8 })),
);
export const aarsloenTableCol1UgeField = rowString(
  'col1_uge', 'Uge til',
  createStringBackedFieldCodec(createWeekFieldCodec({ twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: CURRENT_YEAR, maxDraftLength: 8 })),
);
export const aarsloenTableCol2Field = rowAmount('col2', 'Løn');
export const aarsloenTableCol3Field = rowAmount('col3', 'Løn (2)');
export const aarsloenTableCol4Field = rowAmount('col4', 'Løn (3)');
export const aarsloenTableCol5Field = rowAmount('col5', 'Løn (4)');
export const aarsloenTableFpFvShSoBeloebField = rowAmount('fpFvShSoBeloeb', 'FP/FV/SH/SO/St.B.');
export const aarsloenTablePensionBeloebField = rowAmount('pensionBeloeb', 'Arb.g. Pension');

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
