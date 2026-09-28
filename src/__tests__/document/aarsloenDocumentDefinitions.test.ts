// @vitest-environment jsdom
import {
  createEvaluationSourceToken,
  createInputEvaluation,
  createInputRevision,
  createSettingsRevision,
  reduceInputCommand,
  settleField,
  type SettledInput,
} from '../../inputCore';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { stamdataSkadedatoField } from '../../inputCore/catalog/stamdataDescriptors';
import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
import {
  aarsloenDocumentDefinition,
  shDageDocumentDefinition,
} from '../../domain/aarsloen/aarsloenDocumentDefinitions';
import { AARSLOEN_INITIAL_VALUES } from '../../domain/aarsloen/aarsloenInitialValues';
import { DEFAULT_BREVHOVED_INDSTILLINGER } from '../../settings/appSettingsSchema';
import { __createTestSourceSettings } from '../../settings/sourceSettings';
import { projectMineoDocumentGateSettings } from '../../document/definition/mineoDocumentDefinition';

const catalog = getProductionInputCatalog();
type AnyInputCommand = Parameters<typeof reduceInputCommand>[1];

const dispatch = (input: SettledInput, command: AnyInputCommand): SettledInput => {
  const result = reduceInputCommand(input, command, catalog);
  return result.changed ? result.input : input;
};

const empty = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null,
    satser: null,
    aarsloen: {
      ...AARSLOEN_INITIAL_VALUES,
      tableData: [{
        id: 'r1',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: { kind: 'number', value: 30_000 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
        fpFvShSoBeloeb: undefined,
        pensionBeloeb: undefined,
      }],
    },
    faellesAarsloen: null,
    renteberegning: null,
    varigemen: null,
    forsoergertab: null,
    erstatningsopgoerelse: null,
    erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

const withBlockedStamdata = (input: SettledInput): SettledInput =>
  dispatch(input, settleField(stamdataSkadedatoField.bind(), 'ikke-en-dato') as AnyInputCommand);

const settings = projectMineoDocumentGateSettings(__createTestSourceSettings({
  brevhovedIndstillinger: {
    ...DEFAULT_BREVHOVED_INDSTILLINGER,
    aarsloensberegning: true,
    shDage: true,
  },
}));

const contextFor = (input: SettledInput) => createDocumentSourceContext(
  createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  }),
  settings
);

describe('Årslønsdokumentdefinitioner – stamdata-gate', () => {
  it('blokerer Årslønsberegningen, når brevhovedet er aktivt og Skadedato er rød', () => {
    const result = aarsloenDocumentDefinition.project(contextFor(withBlockedStamdata(empty())), undefined);

    expect(result).toEqual({
      status: 'blocked',
      reasons: [expect.objectContaining({
        code: 'aarsloen:stamdata-blocked',
        message: 'Ret fejlen i Stamdata',
      })],
    });
  });

  it('blokerer SH-dage-dokumentet på samme stamdatafejl efter SH-gaten er godkendt', () => {
    const input = empty();
    const aarsloen = input.sections.aarsloen;
    if (aarsloen === null) throw new Error('Testinvariant: Årsløn mangler');
    const shInput = catalog.validateSettledInput({
      sections: {
        ...input.sections,
        aarsloen: {
          ...aarsloen,
          omregningTilFuldtAar: true,
          loenPaaHelligdage: 'SH-udbetaling',
        },
      },
      rejectedInputs: input.rejectedInputs,
    });

    const result = shDageDocumentDefinition.project(contextFor(withBlockedStamdata(shInput)), undefined);

    expect(result).toEqual({
      status: 'blocked',
      reasons: [expect.objectContaining({
        code: 'sh-dage:stamdata-blocked',
        message: 'Ret fejlen i Stamdata',
      })],
    });
  });
});
