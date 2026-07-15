import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type {
  LoenPaaHelligdage,
  Loenperiode,
  TillaegAngivesSom,
} from '../../schemas/formSchemas/enumSchemas';
import type { StandardLoenTableRow } from '../../schemas/formSchemas/sections/aarsloenSchemas';
import type { ISODateString } from '../../types/branded';
import type { CollectionBinding, FieldAddressTemplate, FieldBinding } from '../fieldCatalog';
import {
  booleanFieldCodec,
  createAmountFieldCodec,
  createChoiceFieldCodec,
  createDateFieldCodec,
  createIntegerFieldCodec,
  createPercentFieldCodec,
} from '../fieldCodecs';
import { defineField } from '../fieldDefinition';
import { createStructuralCollectionBinding, createStructuralFieldBinding } from '../structuralBindings';

/**
 * Strukturelle bindinger for `aarsloen`-sektionen. Skalarerne og samlingen `tableData`s
 * VÆRDI-persisterede rækkefelter (dato- og beløbskolonner) registreres her.
 *
 * BEVIDST DEFER (egen sub-sletteliste): tabellens `col0_maaned`/`col1_maaned`/`col0_uge`/`col1_uge`
 * persisteres som `allowEmptyString` (canonical STRENG), men indtastes via heltals-/uge-codecs, hvis
 * output-type ikke matcher schema-strengen. En binding kræver enten et streng-producerende måned/uge-
 * codec eller en schema-evolution af kolonnerne (som ville ændre .eo-formatet). Det hører til en senere,
 * dedikeret runde og forelægges særskilt, fordi det rører .eo-repræsentationen.
 */
const createEmptyAarsloenSection = (): unknown => ({ tableData: [] });

const AARSLOEN_FOCUS = { route: '/aarsloen', tab: null } as const;

// ─── Procentskalarer (0..100 er afledt bounds-issue) ────────────────────────────

const percentField = (field: string, label: string): FieldBinding<number | undefined> =>
  createStructuralFieldBinding({
    definition: defineField<number | undefined>({
      label,
      controlKind: 'text',
      focusTarget: AARSLOEN_FOCUS,
      codec: createPercentFieldCodec({ allowNegative: false, allowDecimals: true }),
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
      focusTarget: AARSLOEN_FOCUS,
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
      focusTarget: AARSLOEN_FOCUS,
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
      focusTarget: AARSLOEN_FOCUS,
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
      focusTarget: AARSLOEN_FOCUS,
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
      focusTarget: AARSLOEN_FOCUS,
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
      focusTarget: AARSLOEN_FOCUS,
      codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
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
      focusTarget: AARSLOEN_FOCUS,
      codec: createAmountFieldCodec({ allowNegative: true, allowDecimals: true }),
    }),
    template: tableRowFieldTemplate(field),
    createEmptySection: createEmptyAarsloenSection,
  });

export const aarsloenTableCol0DagBinding = tableDateField('col0_dag', 'Dato fra');
export const aarsloenTableCol1DagBinding = tableDateField('col1_dag', 'Dato til');
export const aarsloenTableCol2Binding = tableAmountField('col2', 'Løn');
export const aarsloenTableCol3Binding = tableAmountField('col3', 'Løn (2)');
export const aarsloenTableCol4Binding = tableAmountField('col4', 'Løn (3)');
export const aarsloenTableCol5Binding = tableAmountField('col5', 'Løn (4)');
export const aarsloenTableFpFvShSoBeloebBinding = tableAmountField('fpFvShSoBeloeb', 'FP/FV/SH/SO/St.B.');
export const aarsloenTablePensionBeloebBinding = tableAmountField('pensionBeloeb', 'Arb.g. Pension');
