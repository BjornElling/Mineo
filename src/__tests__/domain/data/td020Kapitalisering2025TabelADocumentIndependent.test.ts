// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { renderWordDocument, xmlToPlainText } from '../../docx/generators/wordContentHarness';
import { createDocumentSourceContext } from '../../../document/definition/documentSourceContext';
import {
  kapitaliseringDocumentDefinition,
  type KapitaliseringDocumentInput,
} from '../../../domain/erhvervsevnetab/eetDocumentDefinitions';
import { projectMineoDocumentGateSettings } from '../../../document/definition/mineoDocumentDefinition';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { __createTestSourceSettings } from '../../../settings/sourceSettings';
import { DEFAULT_BREVHOVED_INDSTILLINGER } from '../../../settings/appSettingsSchema';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';
import type {
  ErhvervsevnetabValues,
  FaellesAarsloenValues,
  StamdataValues,
} from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const iso = (value: string) => toISODateString(value);
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const stamdata: StamdataValues = {
  journalnr: 'TD-020-kapitalisering-2025',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Uafhængigt facit',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2021-01-01'),
  skadelidteFodselsdato: iso('1971-01-01'),
};

const erhvervsevnetab: ErhvervsevnetabValues = {
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  koen: 'Kvinde',
  aslAfgoerelser: [{
    id: 'td020-kapitalisering-2025-row',
    afgoerelsesDato: iso('2025-12-15'),
    virkningsDato: iso('2025-12-15'),
    eetPct: 25,
    kapDato: iso('2025-12-31'),
    kapPct: 25,
    afgoerelseType: 'Endelig',
    tidlKapDato: undefined,
    fsTilbageholdtEet: 'Nej',
  }],
};

const faellesAarsloen: FaellesAarsloenValues = {
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  aslAarsloen: asAmount(489000),
};

const buildInput = () => {
  const catalog = getProductionInputCatalog();
  return catalog.validateSettledInput({
    sections: {
      stamdata,
      satser: null,
      aarsloen: null,
      faellesAarsloen,
      renteberegning: null,
      varigemen: null,
      forsoergertab: null,
      erstatningsopgoerelse: createErstatningsopgoerelseInitialValues(),
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

const project = (): KapitaliseringDocumentInput => {
  const catalog = getProductionInputCatalog();
  const evaluation = createInputEvaluation({
    input: buildInput(),
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  });
  const result = kapitaliseringDocumentDefinition.project(
    createDocumentSourceContext(evaluation, gateSettings),
    undefined,
  );

  if (result.status !== 'ready') {
    throw new Error('Kapitaliseringsdefinitionen blev blokeret i 2025-facittet');
  }
  return result.input;
};

describe('TD-020 – 31.12.2025-kapitalisering gennem Word-generatoren', () => {
  it('fører 10183/2025 tabel A fra typed input til beregning og Word', async () => {
    const input = project();
    const afgoerelse = input.computation.afgoerelser[0];

    expect(afgoerelse).toEqual(expect.objectContaining({
      rowId: 'td020-kapitalisering-2025-row',
      afgoerelsesdato: '2025-12-15',
      kapitaliseringsdato: '2025-12-31',
      kapitaliseringsbekendtgoerelseLabel: 'Vejl. 10183/2025, tabel A',
      tabelLabel: 'A',
      folkepensionsalderLabel: '70 år',
      alderAar: 54,
      alderMaaneder: 11,
      kapitaliseretPgaUnderToAarTilFp: false,
      faktorMaanedsAfhaengig: true,
      kapitaliseringsfaktor: 9.929,
    }));

    const renderer = await kapitaliseringDocumentDefinition.loadRenderer();
    const { filename, documentXml } = await renderWordDocument((session) =>
      renderer(session, input, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Kapitalisering (EET)');
    expect(text).toContain('Kapitaliseringsdato31-12-2025');
    expect(text).toContain('Vejl. 10183/2025, tabel A');
    expect(text).toContain('Alder ved kapitalisering54 år, 11 måneder');
    expect(text).toContain('Folkepensionsalder70 år');
    expect(text).toContain('Kapitaliseringsfaktor9,929');
  });
});
