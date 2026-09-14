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
import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
import {
  projectMineoDocumentGateSettings,
  type MineoDocumentGateSettings,
} from '../../document/definition/mineoDocumentDefinition';
import { __createTestSourceSettings } from '../../settings/sourceSettings';
import {
  resolveReguleringDocumentOutputId,
  type ReguleringDocumentOutputId,
} from '../../domain/erstatningsopgoerelse/reguleringDocumentDefinitions';

const catalog = getProductionInputCatalog();
const GATE_SETTINGS: MineoDocumentGateSettings = projectMineoDocumentGateSettings(__createTestSourceSettings({
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: false,
  allowReguleringMedUdloebMedMaaneder: 0,
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

const contextOf = (input: SettledInput) => createDocumentSourceContext(
  createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  }),
  GATE_SETTINGS
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
});
