// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';
import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
import {
  efterEalDocumentDefinition,
  type EfterEalDocumentInput,
  loebendeYdelserDocumentDefinition,
} from '../../domain/erhvervsevnetab/eetDocumentDefinitions';
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
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../types/branded';
import { createRealPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { extractPdfText } from '../utils/pdf/pdfTextExtractor';
import type {
  ErhvervsevnetabValues,
  FaellesAarsloenValues,
  StamdataValues,
} from '../../schemas/formSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';

const iso = (value: string) => toISODateString(value);
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const normalizePdfText = (text: string): string => text
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const stamdata: StamdataValues = {
  journalnr: 'EET-definition-orakel',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Uafhængigt facit',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2019-04-01'),
  skadelidteFodselsdato: iso('1955-07-01'),
};

const erhvervsevnetab: ErhvervsevnetabValues = {
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  beregningsdato: iso('2022-04-01'),
  koen: 'Kvinde',
  ealEetPct: 50,
  eetDifferencekravBilagSelection: {
    ...ERHVERVSEVNETAB_INITIAL_VALUES.eetDifferencekravBilagSelection,
    visUdvidetSpecifikation: true,
  },
  aslAfgoerelser: [{
    id: 'eet-definition-row',
    afgoerelsesDato: iso('2019-06-01'),
    virkningsDato: iso('2019-06-01'),
    eetPct: 60,
    kapDato: undefined,
    kapPct: undefined,
    afgoerelseType: 'Endelig',
    tidlKapDato: undefined,
    fsTilbageholdtEet: 'Nej',
  }],
  endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
  indregnMerErstatningVedForhoejetPensionsalder: false,
};

const faellesAarsloen: FaellesAarsloenValues = {
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  aslAarsloen: asAmount(401000),
  ealAarsloen: asAmount(900000),
};

const buildInput = () => {
  const erstatningsopgoerelse = {
    ...createErstatningsopgoerelseInitialValues(),
    forligAnsvarsgradProcent: 50,
    forligAnsvarsgradBroek: '',
  };
  const catalog = getProductionInputCatalog();
  return catalog.validateSettledInput({
    sections: {
      stamdata,
      satser: null,
      aarsloen: null,
      faellesAarsloen: faellesAarsloen,
      renteberegning: null,
      varigemen: null,
      forsoergertab: null,
      erstatningsopgoerelse,
      erhvervsevnetab,
    },
    rejectedInputs: {},
  });
};

const gateSettings = projectMineoDocumentGateSettings(__createTestSourceSettings({
  brevhovedIndstillinger: {
    ...DEFAULT_BREVHOVED_INDSTILLINGER,
    erhvervsevnetab: false,
  },
}));

const project = (): EfterEalDocumentInput => {
  const catalog = getProductionInputCatalog();
  const input = buildInput();
  const evaluation = createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  });
  const result = efterEalDocumentDefinition.project(
    createDocumentSourceContext(evaluation, gateSettings),
    undefined,
  );

  expect(result.status).toBe('ready');
  if (result.status !== 'ready') {
    throw new Error('EET efter EAL-definitionen blev blokeret i orakelfixturet');
  }
  return result.input;
};

const projectLoebendeYdelser = () => {
  const catalog = getProductionInputCatalog();
  const input = buildInput();
  const evaluation = createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  });
  const result = loebendeYdelserDocumentDefinition.project(
    createDocumentSourceContext(evaluation, gateSettings),
    undefined,
  );

  expect(result.status).toBe('ready');
  if (result.status !== 'ready') {
    throw new Error('Løbende ydelser-definitionen blev blokeret i orakelfixturet');
  }
  return result.input;
};

describe('EET efter EAL-definition – uafhængigt downstream-facit', () => {
  it('fører den projicerede beregning til Word med de håndberegnede beløb', async () => {
    const input = project();

    // Uafhængigt facit, uden produktionsberegnerens helpers:
    // 900.000 x (1,022 x 1,023 x 1,012) = 952.000 kr. efter 4-decimalers regulering og
    // afrunding til 500 kr.; 952.000 x 10 x 50 % = 4.760.000 kr.; alder 63 giver 52 %
    // reduktion = 2.475.200 kr.; EAL-kravet er 2.284.800 kr., og 50 % forlig giver 1.142.400 kr.
    expect(input.computation).toEqual(expect.objectContaining({
      reguleretAarsloenOre: 95200000,
      eetBeregnetOre: 476000000,
      aldersreduktionBeloebOre: 247520000,
      ealKravOre: 228480000,
    }));
    expect(input.computation.forlig).toEqual({
      label: '50 %',
      dato: null,
      ealKravEfterForligOre: 114240000,
    });

    const renderer = await efterEalDocumentDefinition.loadRenderer();
    const pdfArtifact = await renderer(
      await createRealPdfDocumentSessionForTest(),
      input,
      { visBrevhoved: false },
    );
    const pdfText = normalizePdfText(await extractPdfText(pdfArtifact.blob));
    const { filename, documentXml } = await renderWordDocument((session) =>
      renderer(session, input, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(filename).toMatch(/\.docx$/);
    expect(pdfText).toContain('1.142.400 kr.');
    expect(text).toContain('EET efter EAL');
    expect(text).toContain('952.000 kr. x 10 x 50 %');
    expect(text).toContain('4.760.000 kr.');
    expect(text).toContain('2.475.200 kr.');
    expect(text).toContain('50 % x (4.760.000 kr. - 2.475.200 kr.) =');
    expect(text).toContain('1.142.400 kr.');
  });

  it('fører den projicerede løbende ydelse til Word med det håndberegnede totalbeløb', async () => {
    const input = projectLoebendeYdelser();

    // Uafhængigt facit: grundlønnen er 401.000 x 367.000 / 539.000 = 273.037 kr., og
    // den ene afgørelses fem regulerede perioder summerer til 536.270 kr. i løbende EET.
    expect(input.computation).toEqual(expect.objectContaining({
      benyttetAarsloenOre: 40100000,
      grundloenOre: 27303700,
      erstatningsniveauPct: 83,
      amBidragPct: 8,
    }));
    expect(input.computation.afgoerelser).toHaveLength(1);
    expect(input.computation.afgoerelser[0]).toEqual(expect.objectContaining({
      eetPct: 60,
      iAltBeregnetEetOre: 53627000,
    }));

    const renderer = await loebendeYdelserDocumentDefinition.loadRenderer();
    const { filename, documentXml } = await renderWordDocument((session) =>
      renderer(session, input, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Løbende ydelser (EET)');
    expect(text).toContain('Afgørelse 1. juni 2019');
    expect(text).toContain('536.270 kr.');
    expect(text).toContain('Udvidet specifikation');
    expect(text).toContain('273.037 kr.');
  });
});
