import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type {
  LoenPaaHelligdage,
  Loenperiode,
  TillaegAngivesSom,
} from '../../schemas/formSchemas/enumSchemas';
import type { StandardLoenTableRow } from '../../schemas/formSchemas/sections/aarsloenSchemas';
import type { ISODateString } from '../../types/branded';
import { CURRENT_YEAR, MIN_YEAR } from '../../config/dateRanges';
import type { CollectionBinding, FieldAddressTemplate, FieldBinding } from '../fieldCatalog';
import {
  booleanFieldCodec,
  createAmountFieldCodec,
  createChoiceFieldCodec,
  createDateFieldCodec,
  createIntegerFieldCodec,
  createPercentFieldCodec,
  createStringBackedFieldCodec,
  createWeekFieldCodec,
  createYearFieldCodec,
} from '../fieldCodecs';
import { defineField } from '../fieldDefinition';
import { createStructuralCollectionBinding, createStructuralFieldBinding } from '../structuralBindings';
import { defineInputManifest } from './inputManifest';

/**
 * Strukturelle bindinger for `aarsloen`-sektionen. Skalarerne og samlingen `tableData`s
 * rækkefelter registreres her. Måned/år bevarer schemaets historiske canonical strengrepræsentation
 * gennem `createStringBackedFieldCodec`, mens inputsemantikken fortsat kommer fra de fælles
 * heltals-/årscodecs. Ugefelterne er allerede canonical strenge og bruger ugecodecet direkte.
 */
const createEmptyAarsloenSection = (): unknown => ({ tableData: [] });

// ─── Procentskalarer (0..100 er feltets commit-interval) ─────────────────────────

const percentField = (field: string, label: string): FieldBinding<number | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<number | undefined>({
      label,
      controlKind: 'text',
      codec: createPercentFieldCodec({
        allowNegative: false,
        allowDecimals: true,
        minValue: 0,
        maxValue: 100,
      }),
    }),
    template: { section: 'aarsloen', path: [], field },
    createEmptySection: createEmptyAarsloenSection,
  });

export const aarsloenFeriePctBinding = percentField('feriePct', 'Feriegodtgørelse/-tillæg');
export const aarsloenFritvalgPctBinding = percentField('fritvalgPct', 'Fritvalg');
export const aarsloenShSoPctBinding = percentField('shSoPct', 'SH/SO-sats');
export const aarsloenStoreBededagPctBinding = percentField('storeBededagPct', 'Store Bededagstillæg');
export const aarsloenPensionPctBinding = percentField('pensionPct', 'Arbejdsgivers pensionsbidrag');

// ─── Valg (choice/toggle) ───────────────────────────────────────────────────────

export const aarsloenLoenperiodeBinding: FieldBinding<Loenperiode | undefined> =
  createStructuralFieldBinding({
    definition: defineField<Loenperiode | undefined>({
      label: 'Løn indtastes som',
      controlKind: 'choice',
      codec: createChoiceFieldCodec<Loenperiode>(['maaned', 'uge', 'dag']),
    }),
    template: { section: 'aarsloen', path: [], field: 'loenperiode' },
    createEmptySection: createEmptyAarsloenSection,
  });

export const aarsloenTillaegAngivesSomBinding: FieldBinding<TillaegAngivesSom | undefined> =
  createStructuralFieldBinding({
    definition: defineField<TillaegAngivesSom | undefined>({
      label: 'Tillæg angives som',
      controlKind: 'choice',
      codec: createChoiceFieldCodec<TillaegAngivesSom>(['procent', 'beloeb']),
    }),
    template: { section: 'aarsloen', path: [], field: 'tillaegAngivesSom' },
    createEmptySection: createEmptyAarsloenSection,
  });

export const aarsloenLoenPaaHelligdageBinding: FieldBinding<LoenPaaHelligdage | undefined> =
  createStructuralFieldBinding({
    definition: defineField<LoenPaaHelligdage | undefined>({
      label: 'Løn på helligdage',
      controlKind: 'choice',
      codec: createChoiceFieldCodec<LoenPaaHelligdage>(['Almindelig løn', 'SH-udbetaling', 'Ingen']),
    }),
    template: { section: 'aarsloen', path: [], field: 'loenPaaHelligdage' },
    createEmptySection: createEmptyAarsloenSection,
  });

const aarsloenToggle = (field: string, label: string): FieldBinding<boolean> =>
  createStructuralFieldBinding({
    definition: defineField<boolean>({
      label,
      controlKind: 'toggle',
      codec: booleanFieldCodec,
    }),
    template: { section: 'aarsloen', path: [], field },
    createEmptySection: createEmptyAarsloenSection,
  });

export const aarsloenOmregningTilFuldtAarBinding = aarsloenToggle('omregningTilFuldtAar', 'Omregning til fuldt år');
export const aarsloenFuldLoenUnderFerieBinding = aarsloenToggle('fuldLoenUnderFerie', 'Fuld løn under ferie');
export const aarsloenRetTilSjetteFerieugeBinding = aarsloenToggle('retTilSjetteFerieuge', 'Ret til 6. ferieuge');

// 0..99 er en afledt bounds-issue, ikke codec-config.
export const aarsloenAntalFeriedageBinding: FieldBinding<number | undefined> =
  createStructuralFieldBinding({
    definition: defineField<number | undefined>({
      label: 'Antal feriedage (mandag-fredag) i de indtastede perioder',
      controlKind: 'text',
      codec: createIntegerFieldCodec({ allowNegative: false }),
    }),
    template: { section: 'aarsloen', path: [], field: 'antalFeriedage' },
    createEmptySection: createEmptyAarsloenSection,
  });

// ─── Samlingen tableData (kun værdi-persisterede rækkefelter) ────────────────────

export const aarsloenTableDataBinding: CollectionBinding<StandardLoenTableRow> =
  createStructuralCollectionBinding<StandardLoenTableRow>({
    template: { section: 'aarsloen', path: [], collection: 'tableData' },
    createEmptySection: createEmptyAarsloenSection,
  });

const tableRowFieldTemplate = (field: string): FieldAddressTemplate => ({
  section: 'aarsloen',
  path: [{ kind: 'entity', collection: 'tableData' }],
  field,
});

const tableDateField = (field: string, label: string): FieldBinding<ISODateString | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<ISODateString | undefined>({
      label,
      controlKind: 'text',
      codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
    }),
    template: tableRowFieldTemplate(field),
    createEmptySection: createEmptyAarsloenSection,
  });

const tableStringField = (
  field: string,
  label: string,
  codec: FieldBinding<string | undefined>['definition']['codec']
): FieldBinding<string | undefined> => createStructuralFieldBinding({
  definition: defineField<string | undefined>({
    label,
    controlKind: 'text',
    codec,
  }),
  template: tableRowFieldTemplate(field),
  createEmptySection: createEmptyAarsloenSection,
});

// Tabellens beløbskolonner tillader negative (canBeNegative-default i TableAmountInput).
const tableAmountField = (field: string, label: string): FieldBinding<AmountValue | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<AmountValue | undefined>({
      label,
      controlKind: 'text',
      codec: createAmountFieldCodec({ allowNegative: true, allowDecimals: true }),
    }),
    template: tableRowFieldTemplate(field),
    createEmptySection: createEmptyAarsloenSection,
  });

export const aarsloenTableCol0DagBinding = tableDateField('col0_dag', 'Dato fra');
export const aarsloenTableCol1DagBinding = tableDateField('col1_dag', 'Dato til');
export const aarsloenTableCol0MaanedBinding = tableStringField(
  'col0_maaned',
  'Måned',
  createStringBackedFieldCodec(createIntegerFieldCodec({
    allowNegative: false,
    maxDigits: 2,
    minValue: 1,
    maxValue: 12,
  }))
);
export const aarsloenTableCol1MaanedBinding = tableStringField(
  'col1_maaned',
  'År',
  createStringBackedFieldCodec(createYearFieldCodec({
    twoDigitYearPolicy: 'infer',
    minYear: MIN_YEAR,
    maxYear: CURRENT_YEAR,
  }))
);
export const aarsloenTableCol0UgeBinding = tableStringField(
  'col0_uge',
  'Uge fra',
  createStringBackedFieldCodec(createWeekFieldCodec({
    twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: CURRENT_YEAR, maxDraftLength: 8,
  }))
);
export const aarsloenTableCol1UgeBinding = tableStringField(
  'col1_uge',
  'Uge til',
  createStringBackedFieldCodec(createWeekFieldCodec({
    twoDigitYearPolicy: 'infer', minYear: MIN_YEAR, maxYear: CURRENT_YEAR, maxDraftLength: 8,
  }))
);
export const aarsloenTableCol2Binding = tableAmountField('col2', 'Løn');
export const aarsloenTableCol3Binding = tableAmountField('col3', 'Løn (2)');
export const aarsloenTableCol4Binding = tableAmountField('col4', 'Løn (3)');
export const aarsloenTableCol5Binding = tableAmountField('col5', 'Løn (4)');
export const aarsloenTableFpFvShSoBeloebBinding = tableAmountField('fpFvShSoBeloeb', 'FP/FV/SH/SO/St.B.');
export const aarsloenTablePensionBeloebBinding = tableAmountField('pensionBeloeb', 'Arb.g. Pension');

export const aarsloenInputManifest = defineInputManifest({
  id: 'aarsloen',
  fields: [
    aarsloenFeriePctBinding,
    aarsloenFritvalgPctBinding,
    aarsloenShSoPctBinding,
    aarsloenStoreBededagPctBinding,
    aarsloenPensionPctBinding,
    aarsloenLoenperiodeBinding,
    aarsloenTillaegAngivesSomBinding,
    aarsloenLoenPaaHelligdageBinding,
    aarsloenOmregningTilFuldtAarBinding,
    aarsloenFuldLoenUnderFerieBinding,
    aarsloenRetTilSjetteFerieugeBinding,
    aarsloenAntalFeriedageBinding,
    aarsloenTableCol0MaanedBinding,
    aarsloenTableCol1MaanedBinding,
    aarsloenTableCol0UgeBinding,
    aarsloenTableCol1UgeBinding,
    aarsloenTableCol0DagBinding,
    aarsloenTableCol1DagBinding,
    aarsloenTableCol2Binding,
    aarsloenTableCol3Binding,
    aarsloenTableCol4Binding,
    aarsloenTableCol5Binding,
    aarsloenTableFpFvShSoBeloebBinding,
    aarsloenTablePensionBeloebBinding,
  ],
  collections: [aarsloenTableDataBinding],
});
