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
import { createRealPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { extractPdfText } from '../utils/pdf/pdfTextExtractor';

const iso = (value: string) => toISODateString(value);
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const normalizeChannelText = (text: string): string => text
  .replace(/\u00a0/g, ' ')
  .replace(/\u2212/g, '-')
  .replace(/\u2264/g, '<=')
  .replace(/\u2013/g, '-')
  .replace(/mineo\.dk\s*\/\/\s*\S+/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeWordText = (documentXml: string): string => normalizeChannelText(
  xmlToPlainText(
    documentXml
      .replace(/<\/w:tc>/g, ' ')
      .replace(/<\/w:tr>/g, ' ')
      .replace(/<\/w:p>/g, ' ')
  )
);

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

    // Uafhængigt facit: rest-EET proformakapitaliseres med særfaktoren 1,245 nedsat til 3/24 = 0,156:
    // ceil(194.397,06 x 0,156) = 30.326 kr. 2.284.800 − 535.730 − 30.326 = 1.718.744 kr.;
    // 1.718.744 x 50 % = 859.372 kr. efter forliget.
    expect(input.computation).toEqual(expect.objectContaining({
      ealKravOre: fromKroner(2284800),
      ealEetPct: 50,
      fradragLoebendeYdelserOre: fromKroner(535730),
      fradragKapitaliseretEetOre: fromKroner(0),
      differencekravFoerForligOre: fromKroner(1718744),
      forligFactor: 0.5,
      forligLabel: '50 %',
      differencekravOre: fromKroner(859372),
    }));
    expect(input.bilagSelection.opgoerelse).toBe(true);

    const renderer = await differencekravDocumentDefinition.loadRenderer();
    const pdfArtifact = await renderer(
      await createRealPdfDocumentSessionForTest(),
      input,
      { visBrevhoved: false },
    );
    const pdfText = normalizeChannelText(await extractPdfText(pdfArtifact.blob));
    const { filename, documentXml } = await renderWordDocument((session) =>
      renderer(session, input, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);
    const wordText = normalizeWordText(documentXml);

    expect(filename).toBe('Differencekrav (EET).docx');
    expect(pdfText).toContain('Differencekrav (EET)');
    expect(pdfText).toContain('1.718.744 kr.');
    expect(pdfText).toContain('859.372 kr.');
    // Forklaringen af den nedsatte særfaktor står som «Note» nederst i proformabilaget – ikke på
    // differencekravssiden – i begge kanaler (wordText === pdfText nedenfor).
    const forklaring = 'Der er 3 mdr. til folkepensionsdatoen, så faktoren nedsættes forholdsmæssigt: 1,245 x 3/24 = 0,156.';
    const bilagStart = pdfText.indexOf('Proformakapitalisering af rest-EET (ASL)');
    expect(bilagStart).toBeGreaterThan(-1);
    expect(pdfText.indexOf(forklaring)).toBeGreaterThan(pdfText.indexOf('Note', bilagStart));
    expect(pdfText.indexOf('Note', bilagStart)).toBeGreaterThan(bilagStart);
    expect(pdfText.split(forklaring)).toHaveLength(2);
    // Bilagenes overskrifter i differencekravet angiver loven (ASL), ikke tabstypen (EET).
    expect(pdfText).toContain('Løbende ydelser (ASL)');
    expect(pdfText).not.toContain('Løbende ydelser (EET)');
    expect(pdfText).not.toContain('Kapitalisering (EET)');
    expect(text).toContain('Differencekrav (EET)');
    expect(text).toContain('1.718.744 kr.');
    expect(text).toContain('859.372 kr.');
    expect(wordText).toBe(pdfText);
  });

  it('udelader særfaktornoten, når brugeren fravælger proformabilaget', async () => {
    const input = project();
    const renderer = await differencekravDocumentDefinition.loadRenderer();
    const { documentXml } = await renderWordDocument((session) => renderer(session, {
      ...input,
      bilagSelection: { ...input.bilagSelection, proformaKapitalisering: false },
    }, { visBrevhoved: false }));
    const text = normalizeWordText(documentXml);
    expect(text).toContain('Der foretages fradrag med kapitaliseringsværdien af resterende EET.');
    expect(text).toContain('859.372 kr.');
    expect(text).not.toContain('Proformakapitalisering af rest-EET (ASL)');
    expect(text).not.toContain('så faktoren nedsættes forholdsmæssigt');
  });
});
