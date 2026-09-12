// @vitest-environment jsdom
/// <reference types="vitest/globals" />

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
import type { DocumentGenerationSession } from '../../document/documentGenerationSession';
import { createRealPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { extractPdfText } from '../utils/pdf/pdfTextExtractor';
import { buildDocumentFooterText } from '../../document/layout/documentFooterImage';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';
import {
  MINEO_DOCUMENT_OUTPUT_IDS,
  STANDALONE_DOCUMENT_OUTPUT_IDS,
  type DocumentOutputId,
  type MineoDocumentOutputId,
} from '../../document/definition/documentOutputId';
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
import {
  standaloneRenteAlleDocumentDefinition,
  standaloneRenteDocumentDefinition,
  standaloneRenteOversigtDocumentDefinition,
} from '../../apps/minprocesrente/document/standaloneRenteDocumentDefinitions';
import { reguleringDocumentDefinition, krlDocumentDefinition, klLoenaftalerDocumentDefinition } from '../../domain/erstatningsopgoerelse/reguleringDocumentDefinitions';
import { erstatningsopgoerelseDocumentDefinition, tafFordeltPaaAarDocumentDefinition, tafOpreguleretPaaAarDocumentDefinition, tafKravGrafDocumentDefinition } from '../../domain/erstatningsopgoerelse/eoDocumentDefinitions';
import { aarsloenDocumentDefinition, shDageDocumentDefinition } from '../../domain/aarsloen/aarsloenDocumentDefinitions';
import { kapitaliseringDocumentDefinition, efterEalDocumentDefinition, differencekravDocumentDefinition, loebendeYdelserDocumentDefinition } from '../../domain/erhvervsevnetab/eetDocumentDefinitions';
import type { CriticalActionCoordinator } from '../../inputCore/runtime/criticalActionCoordinator';
import { triggerDocumentDownload } from '../../document/downloadArtifact';

vi.mock('../../document/downloadArtifact', () => ({
  triggerDocumentDownload: vi.fn(),
}));

// Testen af tekstkanalparitet måler dokumentgeneratorens håndtering af grafblokken,
// ikke browserens canvas-rendering. Den del har egne scene- og grafiktests.
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

vi.mock('../../document/generators/tafFordelt/tafKravGrafChart', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../document/generators/tafFordelt/tafKravGrafChart')>();
  return { ...actual, renderTafKravGrafChartPng: () => PNG_1X1 };
});

const triggerMock = vi.mocked(triggerDocumentDownload);

const catalog = getProductionInputCatalog();

// Kanalnormaliseringen er bevidst lokal: den må ikke genbruge PDF-writerens egen
// normalisering, ellers kan samme fejl i produktionshelperen gøre begge kanaler grønne.
const normalizeChannelText = (text: string): string => text
  .normalize('NFKC')
  .replace(/\u00a0/g, ' ')
  .replace(/\u200B/g, '')
  .replace(/\u200C/g, '')
  .replace(/\u200D/g, '')
  .replace(/\uFEFF/g, '')
  .replace(/\u2212/g, '-')
  .replace(/\u2013/g, '-')
  .replace(/\u2014/g, '-')
  .replace(/≤/g, '<=')
  .replace(/≥/g, '>=')
  .replace(/\s+/g, ' ')
  // PDF-writerens TJ-opdeling kan placere et plus-tegn uden det omgivende
  // mellemrum. Sammenligningen måler indhold og rækkefølge, ikke dette
  // kanalinterne tekstplaceringssignal.
  .replace(/\s*\+\s*/g, '+')
  .trim();

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

const withIrrelevantError = (input: SettledInput, outputId: DocumentOutputId): SettledInput => {
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

type LifecycleCalls = {
  loadRenderer: number;
  createSession: number;
  render: number;
  sessionRender: number;
  fileIo: number;
  events: string[];
};

type LifecycleRun = Readonly<{
  outcome: Awaited<ReturnType<typeof executeDocumentDownload>>;
  calls: LifecycleCalls;
}>;

type Fixture = Readonly<{
  project: (input: SettledInput) => DocumentProjectionResult<unknown>;
  runLifecycle: (input: SettledInput) => Promise<LifecycleRun>;
  renderArtifactParity: (input: SettledInput) => Promise<Readonly<{
    pdfText: string;
    wordText: string;
    pdfByteLength: number;
    wordMediaCount: number;
  }>>;
  ready: () => SettledInput;
  relevantError: () => SettledInput;
  bounds: () => SettledInput;
  warning: Readonly<{ kind: 'covered'; input: () => SettledInput }>
    | Readonly<{ kind: 'not-applicable'; reason: string }>;
  irrelevantError: () => SettledInput;
}>;

const fixture = <TRequest, TInput, TGateSettings, TBrevhovedKey extends string>(
  id: DocumentOutputId,
  definition: DocumentDefinition<TRequest, TInput, TGateSettings, TBrevhovedKey>,
  request: TRequest,
  ready: () => SettledInput,
  relevantError: (input: SettledInput) => SettledInput,
  bounds: (input: SettledInput) => SettledInput,
  gateSettings: TGateSettings,
  warning: Fixture['warning'] = {
    kind: 'not-applicable',
    reason: 'Definitionens domæneprojektion producerer ingen warning-severity for dette output.',
  }
): Fixture => {
  const project = (input: SettledInput): DocumentProjectionResult<TInput> =>
    definition.project(contextFor(input, gateSettings), request);
  const renderArtifactParity = async (input: SettledInput): Promise<Readonly<{
    pdfText: string;
    wordText: string;
    pdfByteLength: number;
    wordMediaCount: number;
  }>> => {
    const projection = project(input);
    if (projection.status !== 'ready') {
      throw new Error(`${id}/artefaktparitet kræver en klar fixture`);
    }
    const renderer = await definition.loadRenderer();
    const pdfArtifact = await renderer(
      await createRealPdfDocumentSessionForTest(),
      projection.input,
      { visBrevhoved: false },
    );
    const renderedWord = await renderWordDocument((session) => renderer(
      session,
      projection.input,
      { visBrevhoved: false },
    ));
    const decodeXmlEntities = (text: string): string => text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    const wordText = normalizeChannelText(decodeXmlEntities(xmlToPlainText(
      renderedWord.documentXml
        .replace(/<w:br\s*\/>/g, ' ')
        .replace(/<\/w:tc>/g, ' ')
        .replace(/<\/w:tr>/g, ' ')
        .replace(/<\/w:p>/g, ' ')
    )));
    const footerText = buildDocumentFooterText();
    const pdfText = normalizeChannelText((await extractPdfText(pdfArtifact.blob))
      .replaceAll(footerText, '')
      // I testmiljøets manglende canvas-fallback bliver PDF-vandmærket tekst,
      // mens Word-vandmærket ligger i headerens VML og ikke i document.xml.
      // Det er dokumentchrome, ikke body-paritet.
      .replaceAll('UDKAST', ''));
    const wordMediaCount = Object.keys(renderedWord.zip.files)
      .filter((name) => /^word\/media\//.test(name))
      .length;
    return { pdfText, wordText, pdfByteLength: pdfArtifact.blob.size, wordMediaCount };
  };
  const runLifecycle = async (input: SettledInput): Promise<LifecycleRun> => {
    const calls: LifecycleCalls = {
      loadRenderer: 0,
      createSession: 0,
      render: 0,
      sessionRender: 0,
      fileIo: 0,
      events: [],
    };
    const token = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
    const testDefinition: DocumentDefinition<TRequest, TInput, TGateSettings, TBrevhovedKey> = {
      ...definition,
      loadRenderer: async () => {
        calls.loadRenderer += 1;
        calls.events.push('load-renderer');
        return async (session: DocumentGenerationSession) => {
          calls.render += 1;
          calls.events.push('render');
          await session.render({ model: { blocks: [] }, properties: {} });
          return { blob: new Blob(), filename: 'fixture.pdf' };
        };
      },
    };
    const environment: DocumentExecutionEnvironment<TGateSettings, void, TBrevhovedKey> = {
      captureSource: () => ({
        evaluation: createInputEvaluation({ input, catalog, sourceToken: token }),
        gateSettings,
        renderSettings: undefined,
      }),
      readCurrentSourceToken: () => token,
      criticalActions: {
        prepare: async () => ({ status: 'committed', token }),
      } as unknown as CriticalActionCoordinator,
      resolveFormat: () => 'pdf',
      createSession: async () => {
        calls.createSession += 1;
        calls.events.push('create-session');
        const session: DocumentGenerationSession = Object.freeze({
          format: 'pdf',
          render: async () => {
            calls.sessionRender += 1;
            calls.events.push('session-render');
            return new Blob();
          },
        });
        return session;
      },
      resolveVisBrevhoved: () => false,
      reportFailure: () => {},
      showRuntimeFailureLocally: false,
    };
    triggerMock.mockImplementation(() => {
      calls.fileIo += 1;
      calls.events.push('file-io');
    });
    const outcome = await executeDocumentDownload(
      documentActionFromDefinition(testDefinition),
      request,
      environment
    );
    return { outcome, calls };
  };
  return {
    project,
    runLifecycle,
    renderArtifactParity,
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
  satser: fixture('satser', satserDocumentDefinition, undefined, readyInput, satserInvalid, satserBounds, SETTINGS),
  rente: fixture('rente', renteDocumentDefinition, { rowId: 'rente-1' }, readyInput, renteInvalid, renteBounds, SETTINGS),
  'rente-oversigt': fixture('rente-oversigt', renteOversigtDocumentDefinition, undefined, readyInput, renteInvalid, renteBounds, SETTINGS),
  regulering: fixture('regulering', reguleringDocumentDefinition, { scope: 'case' }, () => readyReguleringInput('Statistik'), stamdataInvalid, stamdataBounds, SETTINGS),
  krl: fixture('krl', krlDocumentDefinition, { scope: 'case' }, () => readyReguleringInput('KRL satstabel'), stamdataInvalid, stamdataBounds, SETTINGS),
  'kl-loenaftaler': fixture('kl-loenaftaler', klLoenaftalerDocumentDefinition, { scope: 'case' }, () => readyReguleringInput('KL-lønaftaler'), stamdataInvalid, stamdataBounds, SETTINGS),
  erstatningsopgoerelse: fixture('erstatningsopgoerelse', erstatningsopgoerelseDocumentDefinition, undefined, readyInput, eoInvalid, stamdataBounds, SETTINGS),
  'taf-fordelt-paa-aar': fixture('taf-fordelt-paa-aar', tafFordeltPaaAarDocumentDefinition, undefined, readyTafInput, eoInvalid, tafBounds, SETTINGS),
  'taf-opreguleret-paa-aar': fixture('taf-opreguleret-paa-aar', tafOpreguleretPaaAarDocumentDefinition, undefined, readyTafInput, eoInvalid, tafBounds, SETTINGS),
  'taf-krav-graf': fixture('taf-krav-graf', tafKravGrafDocumentDefinition, undefined, readyTafInput, eoInvalid, tafBounds, SETTINGS),
  varigemen: fixture('varigemen', varigeMenDocumentDefinition, undefined, readyInput, varigeMenInvalid, varigeMenBounds, SETTINGS),
  aarsloen: fixture('aarsloen', aarsloenDocumentDefinition, undefined, readyInput, aarsloenInvalid, aarsloenBounds, SETTINGS),
  'sh-dage': fixture('sh-dage', shDageDocumentDefinition, undefined, readyShDageInput, aarsloenInvalid, aarsloenBounds, SETTINGS),
  kapitalisering: fixture('kapitalisering', kapitaliseringDocumentDefinition, undefined, readyKapitaliseringInput, kapitaliseringInvalid, kapitaliseringBounds, SETTINGS, {
    kind: 'covered', input: readyKapitaliseringWarningInput,
  }),
  'efter-eal': fixture('efter-eal', efterEalDocumentDefinition, undefined, readyInput, eetInvalid, eetBounds, SETTINGS, {
    kind: 'covered', input: readyEalWarningInput,
  }),
  differencekrav: fixture('differencekrav', differencekravDocumentDefinition, undefined, readyInput, eetInvalid, eetBounds, SETTINGS, {
    kind: 'covered', input: readyEalWarningInput,
  }),
  'loebende-ydelser': fixture('loebende-ydelser', loebendeYdelserDocumentDefinition, undefined, readyInput, eetInvalid, eetBounds, SETTINGS, {
    kind: 'covered', input: readyLoebendeWarningInput,
  }),
  forsoergertab: fixture('forsoergertab', forsoergertabDocumentDefinition, undefined, readyInput, forsoergertabInvalid, forsoergertabBounds, SETTINGS),
} satisfies Record<MineoDocumentOutputId, Fixture>;

const STANDALONE_FIXTURES = {
  'standalone-rente': fixture(
    'standalone-rente',
    standaloneRenteDocumentDefinition,
    { rowId: 'rente-1' },
    readyInput,
    renteInvalid,
    renteBounds,
    undefined,
  ),
  'standalone-rente-alle': fixture(
    'standalone-rente-alle',
    standaloneRenteAlleDocumentDefinition,
    undefined,
    readyInput,
    renteInvalid,
    renteBounds,
    undefined,
  ),
  'standalone-rente-oversigt': fixture(
    'standalone-rente-oversigt',
    standaloneRenteOversigtDocumentDefinition,
    undefined,
    readyInput,
    renteInvalid,
    renteBounds,
    undefined,
  ),
} satisfies Record<(typeof STANDALONE_DOCUMENT_OUTPUT_IDS)[number], Fixture>;

const contextFor = <TGateSettings>(input: SettledInput, gateSettings: TGateSettings) => createDocumentSourceContext(
  createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  }),
  gateSettings
);

describe('uafhængigt fixture-register for alle Mineo-dokumentoutputs', () => {
  beforeEach(() => {
    triggerMock.mockClear();
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

  it.each(MINEO_DOCUMENT_OUTPUT_IDS)('%s følger hele download-livscyklussen med instrumenteret fil-I/O', async (id) => {
    const entry = FIXTURES[id];
    const ready = await entry.runLifecycle(entry.ready());
    expect(ready.outcome, `${id}/ready-livscyklus`).toEqual({ status: 'downloaded' });
    expect(ready.calls, `${id}/ready-faser`).toMatchObject({
      loadRenderer: 1,
      createSession: 1,
      render: 1,
      sessionRender: 1,
      fileIo: 1,
    });
    expect(ready.calls.events, `${id}/ready-rækkefølge`).toEqual([
      'load-renderer',
      'create-session',
      'render',
      'session-render',
      'file-io',
    ]);
    expect(triggerMock, `${id}/ready-download`).toHaveBeenCalledTimes(1);
    triggerMock.mockClear();

    for (const [name, blockedInput] of [
      ['ugyldigt input', entry.relevantError()],
      ['grænsefejl', entry.bounds()],
    ] as const) {
      const blocked = await entry.runLifecycle(blockedInput);
      expect(blocked.outcome.status, `${id}/${name}/blokeret-livscyklus`).toBe('rejected');
      if (blocked.outcome.status === 'rejected') {
        expect(blocked.outcome.rejection.kind, `${id}/${name}/blokeringsårsag`).toBe('gate-blocked');
      }
      expect(blocked.calls, `${id}/${name}/ingen-lifecycle-efter-gate`).toMatchObject({
        loadRenderer: 0,
        createSession: 0,
        render: 0,
        sessionRender: 0,
        fileIo: 0,
      });
      expect(blocked.calls.events, `${id}/${name}/ingen-fase-efter-gate`).toEqual([]);
      expect(triggerMock, `${id}/${name}/ingen-fil-io-ved-blokering`).not.toHaveBeenCalled();
    }
  });
});

describe('uafhængigt fixture-register for standalone-dokumentoutputs', () => {
  beforeEach(() => {
    triggerMock.mockClear();
  });

  it('er compiler-komplet og følger standalone-outputinventaret', () => {
    expect(Object.keys(STANDALONE_FIXTURES).sort()).toEqual([...STANDALONE_DOCUMENT_OUTPUT_IDS].sort());
  });

  it.each(STANDALONE_DOCUMENT_OUTPUT_IDS)('%s har en separat valid og bounds-blokeret gate', (id) => {
    const entry = STANDALONE_FIXTURES[id];
    const ready = entry.project(entry.ready());
    expect(ready.status, `${id}/ready`).toBe('ready');
    expect(entry.project(entry.bounds()).status, `${id}/bounds`).toBe('blocked');
    expect(entry.project(entry.irrelevantError()).status, `${id}/ikke-relevant`).toBe('ready');
  });

  it.each(STANDALONE_DOCUMENT_OUTPUT_IDS)('%s følger download-livscyklussen og stopper før lazy-load ved gatefejl', async (id) => {
    const entry = STANDALONE_FIXTURES[id];
    const ready = await entry.runLifecycle(entry.ready());
    expect(ready.outcome, `${id}/ready-livscyklus`).toEqual({ status: 'downloaded' });
    expect(ready.calls, `${id}/ready-faser`).toMatchObject({
      loadRenderer: 1,
      createSession: 1,
      render: 1,
      sessionRender: 1,
      fileIo: 1,
    });
    expect(ready.calls.events, `${id}/ready-rækkefølge`).toEqual([
      'load-renderer',
      'create-session',
      'render',
      'session-render',
      'file-io',
    ]);
    expect(triggerMock, `${id}/ready-download`).toHaveBeenCalledTimes(1);
    triggerMock.mockClear();

    const blocked = await entry.runLifecycle(entry.bounds());
    expect(blocked.outcome, `${id}/bounds-livscyklus`).toMatchObject({
      status: 'rejected',
      rejection: { kind: 'gate-blocked' },
    });
    expect(blocked.calls, `${id}/bounds-faser`).toMatchObject({
      loadRenderer: 0,
      createSession: 0,
      render: 0,
      sessionRender: 0,
      fileIo: 0,
    });
    expect(blocked.calls.events, `${id}/bounds-rækkefølge`).toEqual([]);
    expect(triggerMock, `${id}/bounds-ingen-fil-io`).not.toHaveBeenCalled();
  });
});

const TEXT_PARITY_OUTPUT_IDS = MINEO_DOCUMENT_OUTPUT_IDS.filter((id) => id !== 'taf-krav-graf');

describe('fysisk tekstparitet for hovedappens dokumentartefakter', () => {
  it.each(TEXT_PARITY_OUTPUT_IDS)('%s bevarer tekst, tal, sektioner og rækkefølge i PDF og Word', async (id) => {
    const entry = FIXTURES[id];
    const { pdfText, wordText } = await entry.renderArtifactParity(entry.ready());

    expect(pdfText, `${id}/PDF må ikke være tom`).not.toBe('');
    expect(wordText, `${id}/Word må ikke være tom`).not.toBe('');
    expect(pdfText, `${id}/PDF og Word`).toBe(wordText);
  });

  it('satser bevarer uafhængigt forventet indhold i både PDF og Word', async () => {
    const { pdfText, wordText } = await FIXTURES.satser.renderArtifactParity(FIXTURES.satser.ready());
    const expectedContent = [
      'Arbejdsskadesatser 2024',
      'Erstatningsansvarsloven',
      'Arbejdsskadesikringsloven',
      'Minimum årsløn (skader før 1.7.2024)',
      '227.000 kr.',
      'Minimum årsløn (skader fra 1.7.2024)',
      '257.000 kr.',
      'Reguleringsprocent for erhvervsevnetab (fra 2024)',
      '0 %',
    ] as const;

    // Forventningerne er bevidst litterale og ikke afledt af satsobjektet. Ellers kunne en
    // bortfiltreret eller forkert formatteret sats gøre både PDF- og Wordkontrollen grøn.
    for (const expected of expectedContent) {
      expect(pdfText, `PDF mangler ${expected}`).toContain(expected);
      expect(wordText, `Word mangler ${expected}`).toContain(expected);
    }
  });

  it('taf-krav-graf producerer fysiske billedartefakter i begge kanaler', async () => {
    const { pdfText, wordText, pdfByteLength, wordMediaCount } = await FIXTURES['taf-krav-graf']
      .renderArtifactParity(FIXTURES['taf-krav-graf'].ready());

    // Grafen har bevidst ingen tekstblokke. Dens kanalparitet ligger i billedet,
    // mens scene- og canvas-adfærden dækkes af særskilte graf-tests.
    expect(pdfText).toBe('');
    expect(wordText).toBe('');
    expect(pdfByteLength).toBeGreaterThan(1000);
    expect(wordMediaCount).toBeGreaterThan(0);
  });
});

describe('fysisk tekstparitet for standalone-dokumentartefakter', () => {
  it.each(STANDALONE_DOCUMENT_OUTPUT_IDS)('%s bevarer tekst, tal, sektioner og rækkefølge i PDF og Word', async (id) => {
    const entry = STANDALONE_FIXTURES[id];
    const { pdfText, wordText } = await entry.renderArtifactParity(entry.ready());

    expect(pdfText, `${id}/PDF må ikke være tom`).not.toBe('');
    expect(wordText, `${id}/Word må ikke være tom`).not.toBe('');
    expect(pdfText, `${id}/PDF og Word`).toBe(wordText);
  });
});
