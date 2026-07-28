import {
  buildMidlertidigtEetInsertSource,
  EET_IMPORT_DEPENDENCY_FIELD_IDS,
} from '../../domain/erhvervsevnetab/eetImportPort';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import {
  getProductionInputCatalog,
  productionInputFields,
} from '../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../inputCore/evaluationSource';
import { toISODateString } from '../../types/branded';
import type {
  ErhvervsevnetabValues,
  FaellesAarsloenValues,
  StamdataValues,
} from '../../schemas/formSchemas';

const catalog = getProductionInputCatalog();
const amount = (value: number) => ({ kind: 'number' as const, value });

const buildEvaluation = (options?: Readonly<{
  eetPct?: number;
  /** Procenten på selve ASL-afgørelsesrækken — i modsætning til `eetPct` ER den en importafhængighed. */
  afgoerelseEetPct?: number;
  aslAarsloen?: number;
  foedselsdato?: string;
  skadedato?: string;
}>) => {
  const erhvervsevnetab: ErhvervsevnetabValues = {
    ...ERHVERVSEVNETAB_INITIAL_VALUES,
    beregningsdato: toISODateString('2026-03-01'),
    ealEetPct: options?.eetPct ?? 25,
    aslAfgoerelser: [{
      id: 'afg-1',
      afgoerelsesDato: toISODateString('2026-02-01'),
      virkningsDato: toISODateString('2026-02-01'),
      eetPct: options?.afgoerelseEetPct ?? 25,
      kapDato: undefined,
      kapPct: undefined,
      afgoerelseType: 'Midlertidig',
      tidlKapDato: undefined,
      fsTilbageholdtEet: 'Nej',
    }],
  };
  const faellesAarsloen: FaellesAarsloenValues = {
    aslAarsloen: amount(options?.aslAarsloen ?? 600000),
    ealAarsloen: amount(600000),
  };
  const stamdata: StamdataValues = {
    journalnr: 'J', advokat: 'A', sagsbehandler: 'S', skadelidte: 'T', skadestype: 'Arbejdsulykke',
    skadelidteFodselsdato: toISODateString(options?.foedselsdato ?? '1980-01-01'),
    skadedato: toISODateString(options?.skadedato ?? '2024-01-01'),
  };
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab,
    },
    rejectedInputs: {},
  });
  return createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(7), createSettingsRevision(3)),
  });
};

describe('buildMidlertidigtEetInsertSource', () => {
  it('bygger importkilden fra readerens samme revision og canonical værdier', () => {
    const source = buildMidlertidigtEetInsertSource(buildEvaluation());

    expect(source.revision).toBe('input-7-settings-3');
    expect(source.eetValues.ealEetPct).toBe(25);
    expect(source.eetValues.aslAfgoerelser).toHaveLength(1);
    expect(source.issues).toBeUndefined();
  });

  // R3-F01: gaten var sektionsvis og blokerede importen ved ETHVERT rødt felt i `erhvervsevnetab`.
  // `ealEetPct` læses ikke af `computeEetLoebendeYdelserForEoImport` — kun af EET-siden selv og
  // EET-efter-EAL. En bounds-fejl her fjernede altså importen og dens grupper fra Erstatningsopgørelsen
  // uden at røre noget tal i importen. Overblokering er lige så forkert som falske tal (§1.10).
  it('blokerer IKKE importen ved et rødt felt, importberegningen ikke læser', () => {
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({ eetPct: 101 }));

    // Readeren maskerer fortsat den røde værdi — men den er ikke en importafhængighed.
    expect(source.eetValues.ealEetPct).toBeUndefined();
    expect(source.issues).toBeUndefined();
  });

  it('fail-closer ved et rødt felt, importberegningen FAKTISK læser', () => {
    // Modretningen: gaten må ikke være blevet tandløs. `aslAfgoerelser.eetPct` ganges ind i periodebeløbene,
    // så en maskeret værdi ville give et falsk tal.
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({ afgoerelseEetPct: 101 }));

    expect(source.issues?.map((issue) => issue.id)).toContain('midlertidigt-eet-source-schema-invalid');
  });

  it('fail-closer ved en rød ASL-årsløn — grundlønnen ganges ind i hvert periodebeløb', () => {
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({ aslAarsloen: -5 }));

    expect(source.issues?.map((issue) => issue.id))
      .toContain('midlertidigt-eet-faelles-aarsloen-schema-invalid');
  });

  it('fail-closer ved ugyldig datoorden i stamdata', () => {
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({
      foedselsdato: '2010-01-01',
      skadedato: '2009-01-01',
    }));

    expect(source.issues?.map((issue) => issue.id)).toContain('midlertidigt-eet-stamdata-date-order');
  });

  // R3-F01: dependency-listen er kun troværdig, hvis den måles mod produktionskataloget. Var den en
  // håndskrevet liste, ville et omdøbt felt lydløst falde ud af gaten — og importen ville da regne på en
  // maskeret værdi. Samme completeness-mønster som EO's `eoDependencyGroups.test.ts`.
  it('hvert dependency-id findes i produktionskataloget', () => {
    const productionFieldIds = new Set(productionInputFields.map((field) => field.id));

    expect(productionFieldIds.size).toBeGreaterThan(100);
    expect(EET_IMPORT_DEPENDENCY_FIELD_IDS.length).toBeGreaterThan(5);
    for (const id of EET_IMPORT_DEPENDENCY_FIELD_IDS) {
      expect(productionFieldIds.has(id), `${id} findes ikke i produktionskataloget`).toBe(true);
    }
  });

  it('ALLE felter i ASL-afgørelsesrækken er dependencies — en ny celle må ikke falde uden for', () => {
    // Hele rækken fodrer periodiseringen og beløbene. Uden dette led kunne en senere tilføjet celle blive
    // læst af beregningen uden at være i gaten.
    const rowFieldIds = productionInputFields
      .filter((field) => field.template.path.some((segment) =>
        segment.kind === 'entity' && segment.collection === 'aslAfgoerelser'))
      .map((field) => field.id);

    expect(rowFieldIds.length).toBeGreaterThan(0);
    for (const id of rowFieldIds) {
      expect(EET_IMPORT_DEPENDENCY_FIELD_IDS).toContain(id);
    }
  });
});
