import {
  createEvaluationSourceToken,
  createInputEvaluation,
  createInputRevision,
  createSettingsRevision,
  reduceInputCommand,
  settleField,
  type FieldRef,
  type SettledInput,
} from '../../inputCore';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { eoAngivetLoenFields } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { stamdataSkadedatoField } from '../../inputCore/catalog/stamdataDescriptors';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
import {
  projectMineoDocumentGateSettings,
  type MineoDocumentGateSettings,
} from '../../document/definition/mineoDocumentDefinition';
import { __createTestSourceSettings } from '../../settings/sourceSettings';
import { DEFAULT_BREVHOVED_INDSTILLINGER } from '../../settings/appSettingsSchema';
import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import {
  klLoenaftalerDocumentDefinition,
  krlDocumentDefinition,
  reguleringDocumentAction,
  reguleringDocumentDefinition,
  resolveReguleringDocumentOutputId,
  type ReguleringDocumentInput,
  type ReguleringSatstabelDocumentInput,
  type ReguleringDocumentOutputId,
} from '../../domain/erstatningsopgoerelse/reguleringDocumentDefinitions';
import type { DocumentGenerationSession } from '../../document/documentGenerationSession';
import { toDanishDateString } from '../../types/branded';

vi.mock('../../document/generators/eo/reguleringDocument', () => ({
  generateReguleringDocument: vi.fn(async () => ({ blob: new Blob(), filename: 'mock-regulering.docx' })),
}));
vi.mock('../../document/generators/krl/krlDocument', () => ({
  generateKRLDocument: vi.fn(async () => ({ blob: new Blob(), filename: 'mock-krl.docx' })),
}));
vi.mock('../../document/generators/klLoenaftaler/klLoenaftalerDocument', () => ({
  generateKlLoenaftalerDocument: vi.fn(async () => ({ blob: new Blob(), filename: 'mock-kl.docx' })),
}));

const catalog = getProductionInputCatalog();
const GATE_SETTINGS: MineoDocumentGateSettings = projectMineoDocumentGateSettings(__createTestSourceSettings({
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: false,
  allowReguleringMedUdloebMedMaaneder: 0,
}));
const GATE_SETTINGS_WITH_BREVHOVED: MineoDocumentGateSettings = projectMineoDocumentGateSettings(__createTestSourceSettings({
  brevhovedIndstillinger: {
    ...DEFAULT_BREVHOVED_INDSTILLINGER,
    regulering: true,
  },
}));
const CASE_REQUEST = { scope: 'case' } as const;

const empty = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null,
    satser: null,
    aarsloen: null,
    faellesAarsloen: null,
    renteberegning: null,
    varigemen: null,
    forsoergertab: null,
    erstatningsopgoerelse: null,
    erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

type AnyInputCommand = Parameters<typeof reduceInputCommand>[1];

const dispatch = (input: SettledInput, command: AnyInputCommand): SettledInput => {
  const result = reduceInputCommand(input, command, catalog);
  return result.changed ? result.input : input;
};

const settle = <T>(field: FieldRef<T>, raw: string): AnyInputCommand => settleField(field, raw) as AnyInputCommand;

const contextOf = (input: SettledInput, settings: MineoDocumentGateSettings = GATE_SETTINGS) => createDocumentSourceContext(
  createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  }),
  settings
);

describe('DOC-001 – reguleringsdokumentets outputvalg', () => {
  it('mapper hvert committed grundlag til præcis dets dokumentoutput', () => {
    const expected: ReadonlyArray<readonly [string, ReguleringDocumentOutputId]> = [
      ['Overenskomst', 'regulering'],
      ['Statistik', 'regulering'],
      ['KRL satstabel', 'krl'],
      ['KL-lønaftaler', 'kl-loenaftaler'],
    ];

    for (const [basis, outputId] of expected) {
      const input = dispatch(
        empty(),
        settle(eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(), basis),
      );

      expect(
        resolveReguleringDocumentOutputId(contextOf(input), CASE_REQUEST),
        `Grundlaget ${basis} skal vælge ${outputId}`,
      ).toBe(outputId);
    }

    expect(resolveReguleringDocumentOutputId(contextOf(empty()), CASE_REQUEST)).toBeNull();
  });

  it('sender hvert outputvalg gennem den tilsvarende dokumentaction', () => {
    const bases = [
      ['Overenskomst', 'regulering'],
      ['Statistik', 'regulering'],
      ['KRL satstabel', 'krl'],
      ['KL-lønaftaler', 'kl-loenaftaler'],
    ] as const;

    for (const [basis, outputId] of bases) {
      const input = dispatch(
        empty(),
        settle(eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(), basis),
      );

      // Testen låser dispatch-grenen, også når den efterfølgende projektion blokerer på manglende
      // øvrige sagsdata. Det er switchens valgte definition, der er facit her.
      const result = reguleringDocumentAction.resolve(contextOf(input), CASE_REQUEST);
      if (result.status === 'ready') {
        expect(result.document.id).toBe(outputId);
      } else {
        expect(result.status).toBe('blocked');
      }
    }

    const noOutput = reguleringDocumentAction.resolve(contextOf(empty()), CASE_REQUEST);
    expect(noOutput).toEqual({
      status: 'blocked',
      reasons: [{
        code: 'regulering:no-output',
        message: 'Der er ikke valgt et grundlag med tilgængelige reguleringssatser',
        kind: 'missing-input',
      }],
    });
  });

  it('videresender de tre lazy-loadede renderer-inputs', async () => {
    const session = {
      format: 'word',
      render: async () => new Blob(),
    } satisfies DocumentGenerationSession;
    const interval = {
      fraDato: toDanishDateString('01-01-2024'),
      tilDato: toDanishDateString('31-12-2024'),
    };
    const stamdata = {};
    const reguleringInput: ReguleringDocumentInput = {
      interval,
      stamdata,
      overenskomstLabel: 'Overenskomst',
      loenudviklingBasis: 'Overenskomst',
      overenskomstId: undefined,
      statistikModelLabel: undefined,
      applyAlmindeligLoenPaaShDageRegel: false,
      offentligLoenType: undefined,
      offentligLoenTrin: undefined,
      offentligLoenGruppe: undefined,
      offentligLoenEkstraGrundloen: undefined,
    };
    const satstabelInput: ReguleringSatstabelDocumentInput = { interval, stamdata };

    const renderRegulering = await reguleringDocumentDefinition.loadRenderer();
    const renderKrl = await krlDocumentDefinition.loadRenderer();
    const renderKl = await klLoenaftalerDocumentDefinition.loadRenderer();

    expect((await renderRegulering(session, reguleringInput, { visBrevhoved: false })).filename)
      .toBe('mock-regulering.docx');
    expect((await renderKrl(session, satstabelInput, { visBrevhoved: false })).filename)
      .toBe('mock-krl.docx');
    expect((await renderKl(session, satstabelInput, { visBrevhoved: false })).filename)
      .toBe('mock-kl.docx');
  });

  it('fail-closer når en definition møder et andet friskt grundlag', () => {
    let krlInput = dispatch(
      empty(),
      settle(eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(), 'KRL satstabel'),
    );
    krlInput = dispatch(
      krlInput,
      settle(eoAngivetLoenFields.loenudviklingKRLSatstabel.bind(), 'KTO (kommuner)'),
    );
    const klInput = dispatch(
      empty(),
      settle(eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(), 'KL-lønaftaler'),
    );

    expect(reguleringDocumentDefinition.project(contextOf(krlInput), CASE_REQUEST).status).toBe('blocked');
    expect(krlDocumentDefinition.project(contextOf(klInput), CASE_REQUEST).status).toBe('blocked');
    expect(klLoenaftalerDocumentDefinition.project(contextOf(krlInput), CASE_REQUEST).status).toBe('blocked');
    expect(krlDocumentDefinition.project(contextOf(krlInput), CASE_REQUEST).status).toBe('ready');
    expect(klLoenaftalerDocumentDefinition.project(contextOf(klInput), CASE_REQUEST).status).toBe('ready');

    const missingEmployment = { scope: 'employment', employmentId: 'missing' } as const;
    expect(resolveReguleringDocumentOutputId(contextOf(empty()), missingEmployment)).toBeNull();
    expect(reguleringDocumentDefinition.project(contextOf(empty()), missingEmployment).status).toBe('blocked');
  });

  it('læser også et eksisterende ansættelsesforhold på employment-scope', () => {
    const employmentId = 'employment-1';
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      loenindkomstAnsaettelsesforhold: [{
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: employmentId,
        loenudviklingBeregningsgrundlag: 'KRL satstabel',
        loenudviklingKRLSatstabel: 'KTO (kommuner)',
      }],
    };
    const input = catalog.validateSettledInput({
      sections: {
        stamdata: null,
        satser: null,
        aarsloen: null,
        faellesAarsloen: null,
        renteberegning: null,
        varigemen: null,
        forsoergertab: null,
        erstatningsopgoerelse: values,
        erhvervsevnetab: null,
      },
      rejectedInputs: {},
    });

    expect(resolveReguleringDocumentOutputId(
      contextOf(input),
      { scope: 'employment', employmentId },
    )).toBe('krl');
  });

  it('blokerer før grundlagslæsning, når reguleringens brevhoved kræver manglende stamdata', () => {
    let input = dispatch(
      empty(),
      settle(stamdataSkadedatoField.bind(), '31-02-2024'),
    );
    input = dispatch(
      input,
      settle(eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(), 'Statistik'),
    );
    input = dispatch(
      input,
      settle(eoAngivetLoenFields.loenudviklingStatistikModel.bind(), 'ILON12 (Danmarks Statistik)'),
    );

    expect(reguleringDocumentDefinition.project(
      contextOf(input, GATE_SETTINGS_WITH_BREVHOVED),
      CASE_REQUEST,
    ).status).toBe('blocked');
  });
});
