// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
import { forsoergertabDocumentDefinition } from '../../domain/forsoergertab/forsoergertabDocumentDefinition';
import { createInputEvaluation } from '../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../inputCore/evaluationSource';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type {
  FaellesAarsloenValues,
  ForsoergertabValues,
  StamdataValues,
} from '../../schemas/formSchemas';
import { projectMineoDocumentGateSettings } from '../../document/definition/mineoDocumentDefinition';
import { __createTestSourceSettings } from '../../settings/sourceSettings';
import { DEFAULT_BREVHOVED_INDSTILLINGER } from '../../settings/appSettingsSchema';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';
import { toISODateString } from '../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const stamdata: StamdataValues = {
  journalnr: 'FST-dokumentfacit',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Uafhængigt dokumentfacit',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2013-01-01'),
  skadelidteFodselsdato: iso('1970-01-01'),
};

const forsoergertab: ForsoergertabValues = {
  beregningsdato: iso('2013-01-01'),
  efterladteFodselsdato: iso('1969-01-01'),
  virkningsdato: iso('2013-01-01'),
  koen: 'Kvinde',
  tilkendtForPeriodeAar: 1,
};

const faellesAarsloen: FaellesAarsloenValues = {
  aslAarsloen: amount(100000),
  ealAarsloen: amount(1000000),
};

const gateSettings = projectMineoDocumentGateSettings(__createTestSourceSettings({
  brevhovedIndstillinger: {
    ...DEFAULT_BREVHOVED_INDSTILLINGER,
    forsoergertab: false,
  },
}));

const project = () => {
  const catalog = getProductionInputCatalog();
  const input = catalog.validateSettledInput({
    sections: {
      stamdata,
      satser: null,
      aarsloen: null,
      faellesAarsloen,
      renteberegning: null,
      varigemen: null,
      forsoergertab,
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
  const result = forsoergertabDocumentDefinition.project(
    createDocumentSourceContext(evaluation, gateSettings),
    undefined,
  );

  expect(result.status).toBe('ready');
  if (result.status !== 'ready') {
    throw new Error('Forsørgertab-dokumentet blev blokeret i det uafhængige facit');
  }
  return result.input;
};

describe('CALC-005 – forsørgertab fra snapshot til Word', () => {
  it('fører det håndberegnede resultat og de to ydelsesdele til dokumentet', async () => {
    const input = project();

    // Uafhængigt håndfacit: EAL-kravet er 2.175.456 kr., ASL-fradragene er
    // 81 kr. og 17.190 kr., og nettokravet er 2.158.185 kr.
    expect(input.pdfProjection.result).toEqual({
      ealKrav: 2175456,
      aslKapitalbelob: 17190,
      aslLobendeYdelserTotal: 81,
      nettokrav: 2158185,
    });

    const renderer = await forsoergertabDocumentDefinition.loadRenderer();
    const { filename, documentXml } = await renderWordDocument((session) =>
      renderer(session, input, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(filename).toBe('Forsørgertab.docx');
    expect(text).toContain('Beregnet forsørgertab');
    expect(text).toContain('EAL-krav');
    expect(text).toContain('2.175.456 kr.');
    expect(text).toContain('Løbende ydelser i alt');
    expect(text).toContain('81 kr.');
    expect(text).toContain('Kapitalbeløb');
    expect(text).toContain('17.190 kr.');
    expect(text).toContain('Forsørgertabserstatning');
    expect(text).toContain('2.158.185 kr.');
    expect(text).toContain('Resterende periode (hele år og måneder)');
    expect(text).toContain('0 år og 11 måneder');
  });
});
