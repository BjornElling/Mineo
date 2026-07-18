// @vitest-environment jsdom
import {
  createEoStandardLoenFieldSet,
  eoStandardLoenCollectionRef,
  readEoStandardLoenTableRows,
  resolveEoStandardLoenTableValidation,
} from '../../../domain/erstatningsopgoerelse/eoStandardLoenFieldSet';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import type { ErstatningsopgoerelseValues, StandardLoenTableRow } from '../../../schemas/formSchemas';

// Greenfield EO StandardLoen-feltsæt (§2.4/§2.5 trin 8): beviser at feltsættet binder den NESTED løntabel-collection
// + celle-descriptorerne til ét ansættelsesforhold-id, rekonstruerer rækkerne fra readeren og udleder den samme rene
// valideringssummary som Årsløn — så den delte StandardLoenTable kan drives af EO's nested tabel ved tab-cutoveren.

const catalog = getProductionInputCatalog();
const asAmount = (value: number) => ({ kind: 'number' as const, value });

const buildEoWithLoenRows = (rows: StandardLoenTableRow[]): ErstatningsopgoerelseValues => {
  const base = createErstatningsopgoerelseInitialValues();
  return {
    ...base,
    loenindkomstAnsaettelsesforhold: [
      { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af-1', indtaegtsoplysningerTableData: rows },
    ],
  };
};

const emptyRow = (id: string): StandardLoenTableRow => ({
  id, col0_maaned: '', col1_maaned: '', col0_uge: '', col1_uge: '', col0_dag: undefined, col1_dag: undefined,
  col2: undefined, col3: undefined, col4: undefined, col5: undefined, fpFvShSoBeloeb: undefined, pensionBeloeb: undefined,
});

const buildReader = (eo: ErstatningsopgoerelseValues) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken, settings: DEFAULT_APP_SETTINGS }).reader;
};

describe('eoStandardLoenFieldSet', () => {
  it('binder collection-ref til det konkrete ansættelsesforhold-id', () => {
    const ref = eoStandardLoenCollectionRef('af-1');
    expect(ref.section).toBe('erstatningsopgoerelse');
    expect(ref.collection).toBe('indtaegtsoplysningerTableData');
    expect(ref.path).toEqual([{ kind: 'entity', collection: 'loenindkomstAnsaettelsesforhold', entityId: 'af-1' }]);
  });

  it('rekonstruerer de nested løntabelrækker fra readeren i afsluttet rækkefølge', () => {
    const rows: StandardLoenTableRow[] = [
      { ...emptyRow('r1'), col0_maaned: '1', col1_maaned: '2022', col2: asAmount(40000) },
      { ...emptyRow('r2'), col0_maaned: '2', col1_maaned: '2022', col2: asAmount(41000) },
    ];
    const reader = buildReader(buildEoWithLoenRows(rows));
    const rebuilt = readEoStandardLoenTableRows(reader, 'af-1');
    expect(rebuilt).toEqual(rows);
    // Feltsættets readRows er den samme rekonstruktion.
    expect(createEoStandardLoenFieldSet('af-1').readRows(reader)).toEqual(rows);
  });

  it('skjuler en ugyldig celle-værdi (måned uden for 1..12) til tomværdien og markerer cellefejlen i valideringen', () => {
    const rows: StandardLoenTableRow[] = [{ ...emptyRow('r1'), col0_maaned: '13', col1_maaned: '2022', col2: asAmount(40000) }];
    const reader = buildReader(buildEoWithLoenRows(rows));

    // Satser-doktrin: den out-of-bounds månedsværdi skjules → tomværdien '' i rekonstruktionen.
    const rebuilt = readEoStandardLoenTableRows(reader, 'af-1');
    expect(rebuilt[0].col0_maaned).toBe('');

    // Valideringen ser cellefejlen (samme cellenøgle-kontrakt som Årsløn: `${rowId}:${colIndex}`).
    const validation = resolveEoStandardLoenTableValidation(reader, 'af-1', 'maaned', 'procent');
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('isolerer ansættelsesforholdene: en fejl i af-2 påvirker ikke af-1 (§1.10)', () => {
    const base = createErstatningsopgoerelseInitialValues();
    const eo: ErstatningsopgoerelseValues = {
      ...base,
      loenindkomstAnsaettelsesforhold: [
        { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af-1', indtaegtsoplysningerTableData: [{ ...emptyRow('r1'), col0_maaned: '1', col1_maaned: '2022' }] },
        { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af-2', indtaegtsoplysningerTableData: [{ ...emptyRow('r2'), col0_maaned: '13', col1_maaned: '2022' }] },
      ],
    };
    const reader = buildReader(eo);
    expect(resolveEoStandardLoenTableValidation(reader, 'af-1', 'maaned', 'procent').errors).toEqual([]);
    expect(resolveEoStandardLoenTableValidation(reader, 'af-2', 'maaned', 'procent').errors.length).toBeGreaterThan(0);
  });
});
