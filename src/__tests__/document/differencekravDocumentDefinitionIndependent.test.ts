// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { fromKroner } from '../../domain/money/money';
import type {
  ErhvervsevnetabValues,
  FaellesAarsloenValues,
  StamdataValues,
} from '../../schemas/formSchemas';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import {
  differencekravDocumentDefinition,
} from '../../domain/erhvervsevnetab/eetDocumentDefinitions';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
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
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';

const iso = (value: string) => toISODateString(value);
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

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

const gateSettings = projectMineoDocumentGateSettings(__createTestSourceSettings({
  brevhovedIndstillinger: {
    ...DEFAULT_BREVHOVED_INDSTILLINGER,
    erhvervsevnetab: false,
  },
}));

const buildInput = () => {
  const catalog = getProductionInputCatalog();
  const erstatningsopgoerelse = {
    ...createErstatningsopgoerelseInitialValues(),
    forligAnsvarsgradProcent: 50,
    forligAnsvarsgradBroek: '',
  };
  return catalog.validateSettledInput({
    sections: {
      stamdata,
      satser: null,
      aarsloen: null,
      faellesAarsloen,
      renteberegning: null,
      varigemen: null,
      forsoergertab: null,
      erstatningsopgoerelse,
      erhvervsevnetab,
    },
    rejectedInputs: {},
  });
};

const project = () => {
  const catalog = getProductionInputCatalog();
  const input = buildInput();
  const evaluation = createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  });
  const result = differencekravDocumentDefinition.project(
    createDocumentSourceContext(evaluation, gateSettings),
    undefined,
  );

  expect(result.status).toBe('ready');
  if (result.status !== 'ready') {
    throw new Error('Differencekrav-definitionen blev blokeret i orakelfixturet');
  }
  return result.input;
};

describe('DOC-001/DOC-003 – Differencekravs definition og renderer', () => {
  it('fører det håndberegnede Differencekrav-facit gennem definitionen til Word', async () => {
    const input = project();

    // Uafhængigt facit: 2.284.800 − 535.730 − 48.600 = 1.700.470 kr.;
    // 1.700.470 x 50 % = 850.235 kr. efter forliget.
    expect(input.computation).toEqual(expect.objectContaining({
      ealKravOre: fromKroner(2284800),
      ealEetPct: 50,
      fradragLoebendeYdelserOre: fromKroner(535730),
      fradragKapitaliseretEetOre: fromKroner(0),
      differencekravFoerForligOre: fromKroner(1700470),
      forligFactor: 0.5,
      forligLabel: '50 %',
      differencekravOre: fromKroner(850235),
    }));
    expect(input.bilagSelection.opgoerelse).toBe(true);

    const renderer = await differencekravDocumentDefinition.loadRenderer();
    const { filename, documentXml } = await renderWordDocument((session) =>
      renderer(session, input, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(filename).toBe('Differencekrav (EET).docx');
    expect(text).toContain('Differencekrav (EET)');
    expect(text).toContain('1.700.470 kr.');
    expect(text).toContain('850.235 kr.');
  });
});
