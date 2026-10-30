// @vitest-environment jsdom
import {
  createEoStandardLoenFieldSet,
  eoStandardLoenCollectionRef,
} from '../../../domain/erstatningsopgoerelse/eoStandardLoenFieldSet';
import {
  hasStandardLoenRowBeloebFejl,
  hasStandardLoenSatsFejl,
  readStandardLoenTableRows,
  resolveStandardLoenTableValidationFromReader,
} from '../../../domain/standardLoen/standardLoenTableFieldSet';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import type { ErstatningsopgoerelseValues, StandardLoenTableRow } from '../../../schemas/formSchemas';

// Greenfield EO StandardLoen-feltsæt (§2.4/§2.5 trin 8): beviser at feltsættet binder den NESTED løntabel-collection
// + celle-descriptorerne til ét ansættelsesforhold-id, rekonstruerer rækkerne fra readeren og udleder den samme rene
// valideringssummary som Årsløn – så den delte StandardLoenTable kan drives af EO's nested tabel ved tab-cutoveren.

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
  return createInputEvaluation({ input, catalog, sourceToken }).reader;
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
    // Rekonstruktionen er den FÆLLES: ejer-id'et kommer fra feltsættets collection-sti.
    const rebuilt = readStandardLoenTableRows(createEoStandardLoenFieldSet('af-1'), reader);
    expect(rebuilt).toEqual(rows);
  });

  it('skjuler en ugyldig celle-værdi (måned uden for 1..12) til tomværdien og markerer cellefejlen i valideringen', () => {
    const rows: StandardLoenTableRow[] = [{ ...emptyRow('r1'), col0_maaned: '13', col1_maaned: '2022', col2: asAmount(40000) }];
    const reader = buildReader(buildEoWithLoenRows(rows));

    // Satser-doktrin: den out-of-bounds månedsværdi skjules → tomværdien '' i rekonstruktionen.
    const rebuilt = readStandardLoenTableRows(createEoStandardLoenFieldSet('af-1'), reader);
    expect(rebuilt[0].col0_maaned).toBe('');

    // Valideringen ser cellefejlen (samme cellenøgle-kontrakt som Årsløn: `${rowId}:${colIndex}`).
    const validation = resolveStandardLoenTableValidationFromReader(createEoStandardLoenFieldSet('af-1'), reader, 'maaned', 'procent');
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
    expect(resolveStandardLoenTableValidationFromReader(createEoStandardLoenFieldSet('af-1'), reader, 'maaned', 'procent').errors).toEqual([]);
    expect(resolveStandardLoenTableValidationFromReader(createEoStandardLoenFieldSet('af-2'), reader, 'maaned', 'procent').errors.length).toBeGreaterThan(0);
  });

  // BB-099: den delte tabel viser «—» i de afledte kolonner, når en sats er rød. Satserne bor på
  // ansættelsesforholdet, så feltsættet skal binde DETTE forholds satser – ikke naboens.
  describe('hasStandardLoenSatsFejl', () => {
    const buildEoWithSatser = (af1: Partial<ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]>) => {
      const base = createErstatningsopgoerelseInitialValues();
      return {
        ...base,
        loenindkomstAnsaettelsesforhold: [
          { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af-1', ...af1 },
          { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af-2', feriePct: 12.5 },
        ],
      };
    };

    it('er sand for en sats uden for 0–100 på netop dette ansættelsesforhold', () => {
      const reader = buildReader(buildEoWithSatser({ feriePct: 150 }));
      expect(hasStandardLoenSatsFejl(reader, createEoStandardLoenFieldSet('af-1'), 'procent')).toBe(true);
      expect(hasStandardLoenSatsFejl(reader, createEoStandardLoenFieldSet('af-2'), 'procent')).toBe(false);
    });

    it('er falsk for gyldige og tomme satser', () => {
      const reader = buildReader(buildEoWithSatser({ feriePct: 12.5, pensionPct: undefined }));
      expect(hasStandardLoenSatsFejl(reader, createEoStandardLoenFieldSet('af-1'), 'procent')).toBe(false);
    });

    it('er falsk i Beløb-tilstand, hvor satserne ikke læses', () => {
      const reader = buildReader(buildEoWithSatser({ feriePct: 150, tillaegAngivesSom: 'beloeb' }));
      expect(hasStandardLoenSatsFejl(reader, createEoStandardLoenFieldSet('af-1'), 'beloeb')).toBe(false);
    });

    it('er sand, når fladens kravregel melder en tom påkrævet sats – men ikke i Beløb-tilstand (M-37)', () => {
      const reader = buildReader(buildEoWithSatser({ feriePct: undefined }));
      const fieldSet = createEoStandardLoenFieldSet('af-1');
      expect(hasStandardLoenSatsFejl(reader, fieldSet, 'procent', { paakraevetSatsMangler: true })).toBe(true);
      expect(hasStandardLoenSatsFejl(reader, fieldSet, 'procent', { paakraevetSatsMangler: false })).toBe(false);
      expect(hasStandardLoenSatsFejl(reader, fieldSet, 'beloeb', { paakraevetSatsMangler: true })).toBe(false);
    });
  });

  // BB-099, rækkeformen: en rød beløbscelle læses som tom, så rækkens afledte kolonner ellers blev regnet uden den.
  describe('hasStandardLoenRowBeloebFejl', () => {
    const buildEoWithRows = (rows: readonly StandardLoenTableRow[], tillaegAngivesSom: 'procent' | 'beloeb' = 'procent') => {
      const base = createErstatningsopgoerelseInitialValues();
      return {
        ...base,
        loenindkomstAnsaettelsesforhold: [
          { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af-1', feriePct: 12.5, tillaegAngivesSom, indtaegtsoplysningerTableData: [...rows] },
        ],
      };
    };
    const tooLarge = { kind: 'number' as const, value: 20_000_000 };

    it('er sand kun for rækken med den røde beløbscelle', () => {
      const reader = buildReader(buildEoWithRows([
        { ...emptyRow('r1'), col0_maaned: '1', col1_maaned: '2022', col3: tooLarge },
        { ...emptyRow('r2'), col0_maaned: '2', col1_maaned: '2022', col2: { kind: 'number', value: 1000 } },
      ]));
      const fieldSet = createEoStandardLoenFieldSet('af-1');
      expect(hasStandardLoenRowBeloebFejl(reader, fieldSet, 'r1', 'procent')).toBe(true);
      expect(hasStandardLoenRowBeloebFejl(reader, fieldSet, 'r2', 'procent')).toBe(false);
    });

    it('læser tillægsbeløbene kun i Beløb-tilstand', () => {
      const row = { ...emptyRow('r1'), col0_maaned: '1', col1_maaned: '2022', fpFvShSoBeloeb: tooLarge };
      const fieldSet = createEoStandardLoenFieldSet('af-1');
      expect(hasStandardLoenRowBeloebFejl(buildReader(buildEoWithRows([row])), fieldSet, 'r1', 'procent')).toBe(false);
      expect(hasStandardLoenRowBeloebFejl(buildReader(buildEoWithRows([row], 'beloeb')), fieldSet, 'r1', 'beloeb')).toBe(true);
    });
  });
});
