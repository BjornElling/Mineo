// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';
import type { DocumentSourceContext } from '../../document/definition/documentSourceContext';
import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
import {
  erstatningsopgoerelseDocumentDefinition,
  type ErstatningsopgoerelseDocumentInput,
} from '../../domain/erstatningsopgoerelse/eoDocumentDefinitions';
import {
  buildErstatningsopgoerelseReaderProjection,
} from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import type { ErstatningsopgoerelseDownloadGates } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseDownloadGate';
import type { EoSnapshot } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { projectMineoDocumentGateSettings } from '../../document/definition/mineoDocumentDefinition';
import { createInputEvaluation } from '../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../inputCore/evaluationSource';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { __createTestSourceSettings } from '../../settings/sourceSettings';
import { DEFAULT_BREVHOVED_INDSTILLINGER } from '../../settings/appSettingsSchema';
import { toISODateString } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type {
  ErstatningsopgoerelseValues,
  StamdataValues,
} from '../../schemas/formSchemas';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const stamdata: StamdataValues = {
  journalnr: 'EO-definition-orakel',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Uafhængigt facit',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2024-01-01'),
  skadelidteFodselsdato: iso('1980-01-01'),
};

const erstatningsopgoerelse: ErstatningsopgoerelseValues = {
  ...createErstatningsopgoerelseInitialValues(),
  eoNummer: '1',
  indsaetUdkastStempel: 'Nej',
  vedroererPeriodeFra: iso('2024-01-01'),
  vedroererPeriodeTil: iso('2024-01-31'),
  kravPaaSvieSmerteGodtgoerelse: 'Nej',
  kravPaaTabtArbejdsfortjeneste: 'Nej',
  kravPaaOevrigeErstatningskrav: 'Ja',
  oevrigeKravPerioder: [{
    id: 'oevrige-krav-1',
    dato: iso('2024-01-15'),
    udgiftTil: 'Transport',
    beloeb: amount(1200),
  }],
};

const gateSettings = projectMineoDocumentGateSettings(__createTestSourceSettings({
  brevhovedIndstillinger: {
    ...DEFAULT_BREVHOVED_INDSTILLINGER,
    erstatningsopgoerelse: false,
  },
}));

const buildInput = () => {
  const catalog = getProductionInputCatalog();
  return catalog.validateSettledInput({
    sections: {
      stamdata,
      satser: null,
      aarsloen: null,
      faellesAarsloen: null,
      renteberegning: null,
      varigemen: null,
      forsoergertab: null,
      erstatningsopgoerelse,
      erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
};

const project = (): ErstatningsopgoerelseDocumentInput => {
  const catalog = getProductionInputCatalog();
  const evaluation = createInputEvaluation({
    input: buildInput(),
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  });
  const result = erstatningsopgoerelseDocumentDefinition.project(
    createDocumentSourceContext(evaluation, gateSettings),
    undefined,
  );

  expect(result.status).toBe('ready');
  if (result.status !== 'ready') {
    throw new Error('Erstatningsopgørelsens definition blev blokeret i orakelfixturet');
  }
  return result.input;
};

describe('CALC-006/DOC-001 – erstatningsopgørelsens definition og renderer', () => {
  it('fører det håndberegnede EO-facit gennem definitionen til Word', async () => {
    const input = project();

    // Uafhængigt facit: én øvrig kravrække på 1.200 kr. og ingen øvrige kravkomponenter
    // giver 120.000 øre både før og efter eventuelt forlig.
    expect(input.document.samlet).toEqual({
      svieSmerteOre: 0,
      tabtArbejdsfortjenesteOre: 0,
      oevrigeKravOre: 120000,
      totalOre: 120000,
    });
    expect(input.document.oevrigeKrav.entries).toEqual([{
      dateText: '15-01-2024',
      udgiftTil: 'Transport',
      amountOre: 120000,
    }]);
    expect(input.selectedElements.opgoerelse).toBe(true);
    expect(input.midlertidigtEetGroups).toHaveLength(0);

    const renderer = await erstatningsopgoerelseDocumentDefinition.loadRenderer();
    const { filename, documentXml } = await renderWordDocument((session) =>
      renderer(session, input, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(filename).toBe('EO-definition-orakel - Erstatningsopgørelse 1.docx');
    expect(text).toContain('Erstatningsopgørelse 1');
    expect(text).toContain('01-01-2024 - 31-01-2024');
    expect(text).toContain('Øvrige krav');
    expect(text).toContain('15-01-2024');
    expect(text).toContain('Transport');
    expect(text).toContain('1.200,00 kr.');
    expect(text).toContain('Erstatningskrav i alt');
  });

  it('bevarer specifik projektion-blokering efter en godkendt dokumentgate', () => {
    const catalog = getProductionInputCatalog();
    const evaluation = createInputEvaluation({
      input: buildInput(),
      catalog,
      sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
    });
    const projection = buildErstatningsopgoerelseReaderProjection(evaluation.reader);
    const blockedSnapshot: EoSnapshot = {
      ...projection.snapshot,
      status: 'fail_closed',
      data: null,
      failClosedReason: 'runtime_exception',
    };
    const gates = {
      erstatningsopgoerelse: { canDownload: true, reasons: [] },
      tafFordeltPaaAar: { canDownload: true, reasons: [] },
      tafOpreguleret: { canDownload: true, reasons: [] },
      tafKravGraf: { canDownload: true, reasons: [] },
    } satisfies ErstatningsopgoerelseDownloadGates;
    const sharedSource = {
      projection: { ...projection, snapshot: blockedSnapshot },
      gates,
    };
    const context: DocumentSourceContext<typeof gateSettings> = {
      evaluation,
      settings: gateSettings,
      // Testen modellerer den defensive grænse mellem en godkendt fælles gate og en separat
      // dokumentprojektion, der alligevel svarer blocked. Den tilstand kan ikke nås gennem den
      // normale delte builder uden at sabotere gate/projektion-pariteten.
      shared: <T>(_builder: (sourceContext: DocumentSourceContext<typeof gateSettings>) => T): T =>
        sharedSource as unknown as T,
    };

    const result = erstatningsopgoerelseDocumentDefinition.project(context, undefined);

    expect(result).toEqual({
      status: 'blocked',
      reasons: [{
        code: 'eo.erstatningsopgoerelse.projection-blocked',
        message: 'EO-PDF kan ikke genereres for den aktuelle sag.',
        kind: 'specific',
      }],
    });
  });
});
