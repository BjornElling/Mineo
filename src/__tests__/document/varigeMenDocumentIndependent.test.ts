// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
import { varigeMenDocumentDefinition } from '../../domain/varigemen/varigeMenDocumentDefinition';
import { createInputEvaluation } from '../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../inputCore/evaluationSource';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { projectMineoDocumentGateSettings } from '../../document/definition/mineoDocumentDefinition';
import { __createTestSourceSettings } from '../../settings/sourceSettings';
import { DEFAULT_BREVHOVED_INDSTILLINGER } from '../../settings/appSettingsSchema';
import type { StamdataValues, VarigeMenValues } from '../../schemas/formSchemas';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';
import { toISODateString } from '../../types/branded';

const iso = (value: string) => toISODateString(value);

const stamdata: StamdataValues = {
  journalnr: 'VM-dokumentfacit',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Uafhængigt dokumentfacit',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2024-02-29'),
  skadelidteFodselsdato: iso('1964-02-29'),
};

const varigemen: VarigeMenValues = {
  mengrad: 37,
  beregningsdato: iso('2025-07-01'),
};

const gateSettings = projectMineoDocumentGateSettings(__createTestSourceSettings({
  brevhovedIndstillinger: {
    ...DEFAULT_BREVHOVED_INDSTILLINGER,
    varigeMen: false,
  },
}));

const project = () => {
  const catalog = getProductionInputCatalog();
  const input = catalog.validateSettledInput({
    sections: {
      stamdata,
      satser: null,
      aarsloen: null,
      faellesAarsloen: null,
      renteberegning: null,
      varigemen,
      forsoergertab: null,
      erstatningsopgoerelse: null,
      erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const evaluation = createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  });
  const result = varigeMenDocumentDefinition.project(
    createDocumentSourceContext(evaluation, gateSettings),
    undefined,
  );

  expect(result.status).toBe('ready');
  if (result.status !== 'ready') {
    throw new Error('Varige mén-dokumentet blev blokeret i det uafhængige facit');
  }
  return result.input;
};

describe('CALC-004 – varige mén fra snapshot til Word', () => {
  it('fører det håndberegnede resultat til det faktiske Word-dokument', async () => {
    const input = project();

    // Uafhængigt håndfacit: 10.530 x 37 = 389.610 kr.; 60 år giver 22 %
    // reduktion på 85.714 kr., så den oprundede godtgørelse er 303.896 kr.
    expect(input.beregningsResultat).toEqual({
      beregnetGodtgoerelse: 303896,
      grundbeloeb: 1053000,
      satsPerMengrad: 10530,
      aldersreduktionPct: 22,
      grundbeloebUdenReduktion: 389610,
      aldersreduktionBeloeb: 85714,
      beregningsaar: 2025,
      alderVedSkade: 60,
    });

    const renderer = await varigeMenDocumentDefinition.loadRenderer();
    const { filename, documentXml } = await renderWordDocument((session) =>
      renderer(session, input, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(filename).toBe('Méngodtgørelse.docx');
    expect(text).toContain('Ménberegning');
    expect(text).toContain('Sats pr. méngrad i beregningsår 2025');
    expect(text).toContain('10.530 kr.');
    expect(text).toContain('Beregnet méngodtgørelse');
    expect(text).toContain('389.610 kr.');
    expect(text).toContain('85.714 kr.');
    expect(text).toContain('303.896 kr.');
  });
});
