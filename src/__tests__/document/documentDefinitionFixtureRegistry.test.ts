import {
  createEvaluationSourceToken,
  createInputEvaluation,
  createInputRevision,
  reduceInputCommand,
  settleField,
  createSettingsRevision,
  type SettledInput,
  type FieldRef,
} from '../../inputCore';
import type { DocumentDefinition, DocumentProjectionResult } from '../../document/definition/documentDefinition';
import { documentActionFromDefinition } from '../../document/definition/documentAction';
import { executeDocumentDownload } from '../../document/definition/documentLifecycle';
import type { DocumentExecutionEnvironment } from '../../document/definition/documentExecutionEnvironment';
import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
import { MINEO_DOCUMENT_OUTPUT_IDS, type MineoDocumentOutputId } from '../../document/definition/documentOutputId';
import { DEFAULT_BREVHOVED_INDSTILLINGER } from '../../settings/appSettingsSchema';
import { __createTestSourceSettings } from '../../settings/sourceSettings';
import {
  projectMineoDocumentGateSettings,
  type MineoDocumentGateSettings,
} from '../../document/definition/mineoDocumentDefinition';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { stamdataSkadedatoField } from '../../inputCore/catalog/stamdataDescriptors';
import { satserAargangField } from '../../inputCore/catalog/satserDescriptors';
import { renteberegningBeregningsdatoField } from '../../inputCore/catalog/renteberegningDescriptors';
import {
  eoTafPeriodeFraField,
  eoVedroererPeriodeFraField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { aarsloenTableCol0MaanedField } from '../../inputCore/catalog/aarsloenDescriptors';
import { varigeMenMengradField } from '../../inputCore/catalog/varigeMenDescriptors';
import {
  aslAfgoerelseKapDatoField,
  erhvervsevnetabBeregningsdatoField,
} from '../../inputCore/catalog/erhvervsevnetabDescriptors';
import { forsoergertabTilkendtForPeriodeAarField } from '../../inputCore/catalog/forsoergertabDescriptors';
import { toISODateString } from '../../types/branded';
import { AARSLOEN_INITIAL_VALUES } from '../../domain/aarsloen/aarsloenInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { satserDocumentDefinition } from '../../domain/satser/satserDocumentDefinition';
import { varigeMenDocumentDefinition } from '../../domain/varigemen/varigeMenDocumentDefinition';
import { forsoergertabDocumentDefinition } from '../../domain/forsoergertab/forsoergertabDocumentDefinition';
import { renteDocumentDefinition, renteOversigtDocumentDefinition } from '../../domain/renteberegning/renteberegningDocumentDefinitions';
import { reguleringDocumentDefinition, krlDocumentDefinition, klLoenaftalerDocumentDefinition } from '../../domain/erstatningsopgoerelse/reguleringDocumentDefinitions';
import { erstatningsopgoerelseDocumentDefinition, tafFordeltPaaAarDocumentDefinition, tafOpreguleretPaaAarDocumentDefinition, tafKravGrafDocumentDefinition } from '../../domain/erstatningsopgoerelse/eoDocumentDefinitions';
import { aarsloenDocumentDefinition, shDageDocumentDefinition } from '../../domain/aarsloen/aarsloenDocumentDefinitions';
import { kapitaliseringDocumentDefinition, efterEalDocumentDefinition, differencekravDocumentDefinition, loebendeYdelserDocumentDefinition } from '../../domain/erhvervsevnetab/eetDocumentDefinitions';
import type { CriticalActionCoordinator } from '../../inputCore/runtime/criticalActionCoordinator';
import { triggerDocumentDownload } from '../../document/downloadArtifact';

vi.mock('../../document/downloadArtifact', () => ({
  triggerDocumentDownload: vi.fn(),
}));

const triggerMock = vi.mocked(triggerDocumentDownload);
const rendererMock = vi.fn(async () => ({ blob: new Blob(), filename: 'fixture.pdf' }));

const catalog = getProductionInputCatalog();
const asAmount = (value: number) => ({ kind: 'number' as const, value });
const stamdata = {
  journalnr: 'J-1',
  advokat: 'Advokat',
  sagsbehandler: 'Sagsbehandler',
  skadelidte: 'Test',
  skadestype: 'Arbejdsulykke' as const,
  skadedato: toISODateString('2024-07-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
};

const baseEo = {
  ...createErstatningsopgoerelseInitialValues(),
  kravPaaSvieSmerteGodtgoerelse: 'Nej' as const,
  kravPaaTabtArbejdsfortjeneste: 'Nej' as const,
  kravPaaOevrigeErstatningskrav: 'Nej' as const,
  vedroererPeriodeFra: toISODateString('2024-07-01'),
  vedroererPeriodeTil: toISODateString('2024-12-31'),
  loenindkomstAnsaettelsesforhold: [],
};

const readyInput = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata,
    satser: { aargang: 2024 },
    aarsloen: {
      ...AARSLOEN_INITIAL_VALUES,
      tableData: [{
        id: 'loen-1', col0_maaned: '1', col1_maaned: '2024', col0_uge: '', col1_uge: '',
        col0_dag: undefined, col1_dag: undefined, col2: asAmount(30_000), col3: undefined,
        col4: undefined, col5: undefined, fpFvShSoBeloeb: undefined, pensionBeloeb: undefined,
      }],
    },
    faellesAarsloen: { aslAarsloen: asAmount(600_000), ealAarsloen: asAmount(600_000) },
    renteberegning: {
      beregningsdato: toISODateString('2025-12-31'),
      kommentarer: undefined,
      rentekravRows: [{
        id: 'rente-1', belob: asAmount(1_000), renterFra: toISODateString('2025-01-01'),
        tillaegstid: 0, enhed: 'dage',
      }],
    },
    varigemen: { mengrad: 10, beregningsdato: toISODateString('2025-01-01') },
    forsoergertab: {
      beregningsdato: toISODateString('2025-06-01'),
      efterladteFodselsdato: toISODateString('1973-01-01'),
      virkningsdato: toISODateString('2025-05-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 10,
    },
    erstatningsopgoerelse: baseEo,
    erhvervsevnetab: {
      ...ERHVERVSEVNETAB_INITIAL_VALUES,
      beregningsdato: toISODateString('2026-03-19'),
      koen: 'Kvinde',
      ealEetPct: 25,
      aslAfgoerelser: [{
        id: 'asl-1',
        afgoerelsesDato: toISODateString('2026-02-01'),
        virkningsDato: toISODateString('2026-02-01'),
        eetPct: 25,
        kapDato: undefined,
        kapPct: undefined,
        afgoerelseType: 'Midlertidig',
        tidlKapDato: undefined,
        fsTilbageholdtEet: 'Nej',
      }],
    },
  },
  rejectedInputs: {},
});

const replaceSections = (
  input: SettledInput,
  sections: Partial<SettledInput['sections']>
): SettledInput => catalog.validateSettledInput({
  sections: { ...input.sections, ...sections },
  rejectedInputs: input.rejectedInputs,
});

const readyReguleringInput = (
  basis: 'Statistik' | 'KRL satstabel' | 'KL-lønaftaler'
): SettledInput => {
  const input = readyInput();
  const eo = input.sections.erstatningsopgoerelse;
  if (eo === null) throw new Error('Fixture mangler erstatningsopgørelse');
  return replaceSections(input, {
    erstatningsopgoerelse: {
      ...eo,
      eoAngivetLoenLoenudvikling: {
        ...eo.eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: basis,
        loenudviklingStatistikModel: basis === 'Statistik' ? 'ILON12 (Danmarks Statistik)' : undefined,
        loenudviklingKRLSatstabel: basis === 'KRL satstabel' ? 'KTO (kommuner)' : undefined,
      },
    },
  });
};

const readyKapitaliseringInput = (): SettledInput => {
  const input = readyInput();
  const eet = input.sections.erhvervsevnetab;
  if (eet === null) throw new Error('Fixture mangler erhvervsevnetab');
  const row = eet.aslAfgoerelser[0];
  if (row === undefined) throw new Error('Fixture mangler ASL-afgørelse');
  return replaceSections(input, {
    erhvervsevnetab: {
      ...eet,
      beregningsdato: toISODateString('2025-12-31'),
      aslAfgoerelser: [{
        ...row,
        afgoerelsesDato: toISODateString('2025-07-01'),
        virkningsDato: toISODateString('2025-07-01'),
        afgoerelseType: 'Endelig',
        kapDato: toISODateString('2025-07-01'),
        kapPct: 25,
      }],
    },
  });
};

const readyShDageInput = (): SettledInput => {
  const input = readyInput();
  const aarsloen = input.sections.aarsloen;
  if (aarsloen === null) throw new Error('Fixture mangler årsløn');
  const first = aarsloen.tableData[0];
  if (first === undefined) throw new Error('Fixture mangler lønrække');
  return replaceSections(input, {
    aarsloen: {
      ...aarsloen,
      omregningTilFuldtAar: true,
      loenPaaHelligdage: 'SH-udbetaling',
      tableData: [
        first,
        { ...first, id: 'loen-2', col0_maaned: '12', col1_maaned: '2024' },
      ],
    },
  });
};

const readyTafInput = (): SettledInput => {
  const input = readyInput();
  const eo = input.sections.erstatningsopgoerelse;
  if (eo === null) throw new Error('Fixture mangler erstatningsopgørelse');
  return replaceSections(input, {
    erstatningsopgoerelse: {
      ...eo,
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmount(30_000),
      tafArbejdsstatus: 'Fuldt arbejdsdygtig',
      tafPerioder: [{
        id: 'taf-1',
        fra: toISODateString('2024-07-01'),
        til: toISODateString('2024-12-31'),
        loseFeriedage: 0,
      }],
      loenindkomstAnsaettelsesforhold: [{
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-1',
        harOverenskomst: false,
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [{
          id: 'af-loen-1',
          col0_maaned: '6', col1_maaned: '2024', col0_uge: '', col1_uge: '',
          col0_dag: undefined, col1_dag: undefined, col2: asAmount(30_000), col3: undefined,
          col4: undefined, col5: undefined, fpFvShSoBeloeb: undefined, pensionBeloeb: undefined,
        }],
      }],
      sfggAnsaettelsesforhold: [{
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ingen',
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      }],
      eoAngivetLoenLoenudvikling: {
        ...eo.eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Ingen',
      },
    },
  });
};

const settleRaw = <T>(input: SettledInput, field: FieldRef<T>, raw: string): SettledInput => {
  const result = reduceInputCommand(
    input,
    settleField(field, raw),
    catalog
  );
  return result.changed ? result.input : input;
};

const withRelevantBoundsError = (input: SettledInput): SettledInput => {
  const current = input.sections.stamdata;
  if (current === null) throw new Error('Fixture mangler stamdata');
  return replaceSections(input, {
    stamdata: {
      ...current,
      skadelidteFodselsdato: toISODateString('2024-08-01'),
      skadedato: toISODateString('2024-07-01'),
    },
  });
};

const withIrrelevantError = (input: SettledInput, outputId: MineoDocumentOutputId): SettledInput => {
  if (outputId === 'satser') {
    const eet = input.sections.erhvervsevnetab;
    if (eet === null) throw new Error('Fixture mangler erhvervsevnetab');
    return replaceSections(input, { erhvervsevnetab: { ...eet, ealEetPct: 150 } });
  }
  return replaceSections(input, { satser: { aargang: 1800 } });
};

const SETTINGS: MineoDocumentGateSettings = projectMineoDocumentGateSettings(__createTestSourceSettings({
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: false,
  allowReguleringMedUdloebMedMaaneder: 0,
  // Denne fixture afprøver, at hvert outputs stamdataafhængighed blokerer, når brevhovedet er aktivt.
  // Alle flags skal derfor være tændt, også for outputs hvor brugerens standard er slukket.
  brevhovedIndstillinger: {
    ...DEFAULT_BREVHOVED_INDSTILLINGER,
    shDage: true,
    regulering: true,
    satser: true,
  },
}));

type Fixture = Readonly<{
  project: (input: SettledInput) => DocumentProjectionResult<unknown>;
  runLifecycle: (input: SettledInput) => ReturnType<typeof executeDocumentDownload>;
  ready: () => SettledInput;
  relevantError: () => SettledInput;
  bounds: () => SettledInput;
  warning: Readonly<{ kind: 'covered'; input: () => SettledInput }>
    | Readonly<{ kind: 'not-applicable'; reason: string }>;
  irrelevantError: () => SettledInput;
}>;

const fixture = <TRequest, TInput, TBrevhovedKey extends string>(
  id: MineoDocumentOutputId,
  definition: DocumentDefinition<TRequest, TInput, MineoDocumentGateSettings, TBrevhovedKey>,
  request: TRequest,
  ready: () => SettledInput,
  relevantError: (input: SettledInput) => SettledInput,
  bounds: (input: SettledInput) => SettledInput,
  warning: Fixture['warning'] = {
    kind: 'not-applicable',
    reason: 'Definitionens domæneprojektion producerer ingen warning-severity for dette output.',
  }
): Fixture => {
  const project = (input: SettledInput): DocumentProjectionResult<TInput> =>
    definition.project(contextFor(input), request);
  const runLifecycle = (input: SettledInput) => {
    const token = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
    const testDefinition: DocumentDefinition<TRequest, TInput, MineoDocumentGateSettings, TBrevhovedKey> = {
      ...definition,
      loadRenderer: async () => rendererMock,
    };
    const environment: DocumentExecutionEnvironment<MineoDocumentGateSettings, void, TBrevhovedKey> = {
      captureSource: () => ({
        evaluation: createInputEvaluation({ input, catalog, sourceToken: token }),
        gateSettings: SETTINGS,
        renderSettings: undefined,
      }),
      readCurrentSourceToken: () => token,
      criticalActions: {
        prepare: async () => ({ status: 'committed', token }),
      } as unknown as CriticalActionCoordinator,
      resolveFormat: () => 'pdf',
      createSession: async () => ({ format: 'pdf' }) as never,
      resolveVisBrevhoved: () => false,
      reportFailure: () => {},
      showRuntimeFailureLocally: false,
    };
    return executeDocumentDownload(documentActionFromDefinition(testDefinition), request, environment);
  };
  return {
    project,
    runLifecycle,
    ready,
    relevantError: () => relevantError(ready()),
    bounds: () => bounds(ready()),
    warning,
    irrelevantError: () => withIrrelevantError(ready(), id),
  };
};

const stamdataInvalid = (input: SettledInput) =>
  settleRaw(input, stamdataSkadedatoField.bind(), 'ikke-en-dato');
const stamdataBounds = withRelevantBoundsError;
const satserInvalid = (input: SettledInput) => settleRaw(input, satserAargangField.bind(), 'abc');
const satserBounds = (input: SettledInput) => settleRaw(input, satserAargangField.bind(), '1800');
const renteInvalid = (input: SettledInput) =>
  settleRaw(input, renteberegningBeregningsdatoField.bind(), 'ikke-en-dato');
const renteBounds = (input: SettledInput) =>
  settleRaw(input, renteberegningBeregningsdatoField.bind(), '01-01-1900');
const eoInvalid = (input: SettledInput) =>
  settleRaw(input, eoVedroererPeriodeFraField.bind(), 'ikke-en-dato');
const tafBounds = (input: SettledInput) =>
  settleRaw(input, eoTafPeriodeFraField.bind('taf-1'), '01-01-1900');
const aarsloenInvalid = (input: SettledInput) =>
  settleRaw(input, aarsloenTableCol0MaanedField.bind('loen-1'), 'x');
const aarsloenBounds = (input: SettledInput) =>
  settleRaw(input, aarsloenTableCol0MaanedField.bind('loen-1'), '13');
const varigeMenInvalid = (input: SettledInput) =>
  settleRaw(input, varigeMenMengradField.bind(), 'x');
const varigeMenBounds = (input: SettledInput) =>
  settleRaw(input, varigeMenMengradField.bind(), '121');
const eetInvalid = (input: SettledInput) =>
  settleRaw(input, erhvervsevnetabBeregningsdatoField.bind(), 'ikke-en-dato');
const eetBounds = (input: SettledInput) =>
  settleRaw(input, erhvervsevnetabBeregningsdatoField.bind(), '01-01-1900');
const kapitaliseringInvalid = (input: SettledInput) =>
  settleRaw(input, aslAfgoerelseKapDatoField.bind('asl-1'), 'ikke-en-dato');
const kapitaliseringBounds = (input: SettledInput) =>
  settleRaw(input, aslAfgoerelseKapDatoField.bind('asl-1'), '01-01-1900');
const forsoergertabInvalid = (input: SettledInput) =>
  settleRaw(input, forsoergertabTilkendtForPeriodeAarField.bind(), 'x');
const forsoergertabBounds = (input: SettledInput) =>
  settleRaw(input, forsoergertabTilkendtForPeriodeAarField.bind(), '11');

const readyLoebendeWarningInput = (): SettledInput => {
  const input = readyInput();
  const eet = input.sections.erhvervsevnetab;
  if (eet === null) throw new Error('Fixture mangler erhvervsevnetab');
  const row = eet.aslAfgoerelser[0];
  if (row === undefined) throw new Error('Fixture mangler ASL-afgørelse');
  return replaceSections(input, {
    erhvervsevnetab: { ...eet, aslAfgoerelser: [{ ...row, eetPct: 10 }] },
  });
};

const readyEalWarningInput = (): SettledInput => {
  const input = readyInput();
  const eet = input.sections.erhvervsevnetab;
  if (eet === null) throw new Error('Fixture mangler erhvervsevnetab');
  return replaceSections(input, { erhvervsevnetab: { ...eet, ealEetPct: 10 } });
};

const readyKapitaliseringWarningInput = (): SettledInput => {
  const input = readyKapitaliseringInput();
  const eet = input.sections.erhvervsevnetab;
  if (eet === null) throw new Error('Fixture mangler erhvervsevnetab');
  const row = eet.aslAfgoerelser[0];
  if (row === undefined) throw new Error('Fixture mangler ASL-afgørelse');
  return replaceSections(input, {
    erhvervsevnetab: {
      ...eet,
      aslAfgoerelser: [{ ...row, afgoerelseType: 'Delvist endelig', kapPct: 10 }],
    },
  });
};

const FIXTURES = {
  satser: fixture('satser', satserDocumentDefinition, undefined, readyInput, satserInvalid, satserBounds),
  rente: fixture('rente', renteDocumentDefinition, { rowId: 'rente-1' }, readyInput, renteInvalid, renteBounds),
  'rente-oversigt': fixture('rente-oversigt', renteOversigtDocumentDefinition, undefined, readyInput, renteInvalid, renteBounds),
  regulering: fixture('regulering', reguleringDocumentDefinition, { scope: 'case' }, () => readyReguleringInput('Statistik'), stamdataInvalid, stamdataBounds),
  krl: fixture('krl', krlDocumentDefinition, { scope: 'case' }, () => readyReguleringInput('KRL satstabel'), stamdataInvalid, stamdataBounds),
  'kl-loenaftaler': fixture('kl-loenaftaler', klLoenaftalerDocumentDefinition, { scope: 'case' }, () => readyReguleringInput('KL-lønaftaler'), stamdataInvalid, stamdataBounds),
  erstatningsopgoerelse: fixture('erstatningsopgoerelse', erstatningsopgoerelseDocumentDefinition, undefined, readyInput, eoInvalid, stamdataBounds),
  'taf-fordelt-paa-aar': fixture('taf-fordelt-paa-aar', tafFordeltPaaAarDocumentDefinition, undefined, readyTafInput, eoInvalid, tafBounds),
  'taf-opreguleret-paa-aar': fixture('taf-opreguleret-paa-aar', tafOpreguleretPaaAarDocumentDefinition, undefined, readyTafInput, eoInvalid, tafBounds),
  'taf-krav-graf': fixture('taf-krav-graf', tafKravGrafDocumentDefinition, undefined, readyTafInput, eoInvalid, tafBounds),
  varigemen: fixture('varigemen', varigeMenDocumentDefinition, undefined, readyInput, varigeMenInvalid, varigeMenBounds),
  aarsloen: fixture('aarsloen', aarsloenDocumentDefinition, undefined, readyInput, aarsloenInvalid, aarsloenBounds),
  'sh-dage': fixture('sh-dage', shDageDocumentDefinition, undefined, readyShDageInput, aarsloenInvalid, aarsloenBounds),
  kapitalisering: fixture('kapitalisering', kapitaliseringDocumentDefinition, undefined, readyKapitaliseringInput, kapitaliseringInvalid, kapitaliseringBounds, {
    kind: 'covered', input: readyKapitaliseringWarningInput,
  }),
  'efter-eal': fixture('efter-eal', efterEalDocumentDefinition, undefined, readyInput, eetInvalid, eetBounds, {
    kind: 'covered', input: readyEalWarningInput,
  }),
  differencekrav: fixture('differencekrav', differencekravDocumentDefinition, undefined, readyInput, eetInvalid, eetBounds, {
    kind: 'covered', input: readyEalWarningInput,
  }),
  'loebende-ydelser': fixture('loebende-ydelser', loebendeYdelserDocumentDefinition, undefined, readyInput, eetInvalid, eetBounds, {
    kind: 'covered', input: readyLoebendeWarningInput,
  }),
  forsoergertab: fixture('forsoergertab', forsoergertabDocumentDefinition, undefined, readyInput, forsoergertabInvalid, forsoergertabBounds),
} satisfies Record<MineoDocumentOutputId, Fixture>;

const contextFor = (input: SettledInput) => createDocumentSourceContext(
  createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  }),
  SETTINGS
);

describe('uafhængigt fixture-register for alle Mineo-dokumentoutputs', () => {
  beforeEach(() => {
    triggerMock.mockClear();
    rendererMock.mockClear();
  });

  it('er compiler-komplet og følger det kanoniske outputinventar', () => {
    expect(Object.keys(FIXTURES).sort()).toEqual([...MINEO_DOCUMENT_OUTPUT_IDS].sort());
  });

  it.each(MINEO_DOCUMENT_OUTPUT_IDS)('%s har en eksplicit klar og relevant blokeret forventning', (id) => {
    const entry = FIXTURES[id];
    const project = (name: string, input: SettledInput) => {
      try {
        return entry.project(input);
      } catch (error) {
        throw new Error(`${id}/${name} kastede`, { cause: error });
      }
    };
    const ready = project('ready', entry.ready());
    expect(ready.status, `${id}/ready: ${JSON.stringify(ready)}`).toBe('ready');
    expect(project('relevant', entry.relevantError()).status, `${id}/relevant`).toBe('blocked');
    expect(project('bounds', entry.bounds()).status, `${id}/bounds`).toBe('blocked');
    const irrelevant = project('irrelevant', entry.irrelevantError());
    expect(irrelevant.status, `${id}/ikke-relevant: ${JSON.stringify(irrelevant)}`).toBe('ready');
    if (entry.warning.kind === 'covered') {
      const warning = project('warning', entry.warning.input());
      expect(warning.status, `${id}/warning: ${JSON.stringify(warning)}`).toBe('ready');
    } else {
      expect(entry.warning.reason.trim(), `${id}/warning-begrundelse`).not.toBe('');
    }
  });

  it.each(MINEO_DOCUMENT_OUTPUT_IDS)('%s følger hele download-livscyklussen uden fil-I/O', async (id) => {
    const entry = FIXTURES[id];
    const ready = await entry.runLifecycle(entry.ready());
    expect(ready, `${id}/ready-livscyklus`).toEqual({ status: 'downloaded' });
    expect(rendererMock, `${id}/ready-rendering`).toHaveBeenCalledTimes(1);
    expect(triggerMock, `${id}/ready-download`).toHaveBeenCalledTimes(1);
    triggerMock.mockClear();
    rendererMock.mockClear();

    for (const [name, blockedInput] of [
      ['ugyldigt input', entry.relevantError()],
      ['grænsefejl', entry.bounds()],
    ] as const) {
      const blocked = await entry.runLifecycle(blockedInput);
      expect(blocked.status, `${id}/${name}/blokeret-livscyklus`).toBe('rejected');
      if (blocked.status === 'rejected') {
        expect(blocked.rejection.kind, `${id}/${name}/blokeringsårsag`).toBe('gate-blocked');
      }
      expect(rendererMock, `${id}/${name}/ingen-rendering-ved-blokering`).not.toHaveBeenCalled();
      expect(triggerMock, `${id}/${name}/ingen-fil-io-ved-blokering`).not.toHaveBeenCalled();
    }
  });
});
