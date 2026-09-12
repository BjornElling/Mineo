// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';
import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
import {
  kapitaliseringDocumentDefinition,
  type KapitaliseringDocumentInput,
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
import type {
  ErhvervsevnetabValues,
  FaellesAarsloenValues,
  StamdataValues,
} from '../../schemas/formSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';

const iso = (value: string) => toISODateString(value);
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const stamdata: StamdataValues = {
  journalnr: 'EET-kapitalisering-orakel',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Uafhængigt facit',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2019-04-01'),
  skadelidteFodselsdato: iso('1965-01-01'),
};

const erhvervsevnetab: ErhvervsevnetabValues = {
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  koen: 'Kvinde',
  aslAfgoerelser: [{
    id: 'eet-kapitalisering-row',
    afgoerelsesDato: iso('2024-01-15'),
    virkningsDato: iso('2024-01-15'),
    eetPct: 25,
    kapDato: iso('2024-02-01'),
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
    throw new Error('Kapitaliseringsdefinitionen blev blokeret i orakelfixturet');
  }
  return result.input;
};

describe('EET-kapitalisering – uafhængigt snapshot→Word-facit', () => {
  it('fører præ-2024-skadens 2024-opregulering til Word', async () => {
    const input = project();
    const afgoerelse = input.computation.afgoerelser[0];

    // Uafhængigt facit: 489.000 kr. x 367.000 / 539.000 = 332.955 kr. i grundløn.
    // Heraf bliver grundydelsen 63.561,11 kr. ved 25 % EET, 83 % erstatningsniveau og 8 % AM-bidrag.
    // En præ-2024-skade opreguleres med 65,7 % til 105.320,76 kr. i 2024-niveau, som er referenceåret.
    expect(afgoerelse).toEqual({
      rowId: 'eet-kapitalisering-row',
      afgoerelsesdato: '2024-01-15',
      kapitaliseringsdato: '2024-02-01',
      eetPct: 25,
      kapitaliseringspct: 25,
      grundloenOre: 33295500,
      erstatningsniveauPct: 83,
      amBidragPct: 8,
      grundydelseOre: 6356111,
      grundydelse2024Ore: 10532076,
      opreguleringTil2024PctRounded4: 65.7,
      aarsydelseGrundlagOre: 10532076,
      aarsydelseReguleringsPctRounded4: null,
      aarsydelseOre: 10532076,
      kapitaliseringsfaktor: 5.479,
      kapitalbelobOre: 57705300,
      saerfaktor: 1.245,
      kapitaliseretPgaUnderToAarTilFp: false,
      faktorMaanedsAfhaengig: true,
      alderAar: 59,
      alderMaaneder: 1,
      kapitaliseringsbekendtgoerelseLabel: 'Vejl. 9820/2023, tabel F',
      tabelLabel: 'F',
      folkepensionsalderLabel: '68 år',
      koenOpdelt: false,
    });

    const renderer = await kapitaliseringDocumentDefinition.loadRenderer();
    const { filename, documentXml } = await renderWordDocument((session) =>
      renderer(session, input, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Kapitalisering (EET)');
    expect(text).toContain('Afgørelse 15. januar 2024 (25 %)');
    expect(text).toContain('Kapitaliseringsdato01-02-2024');
    expect(text).toContain('Kapitaliseringsprocent25 %');
    expect(text).toContain('Grundydelse (25 %): Grundløn x EET x Erstatningsniveau x (100 % − AM-bidrag) =332.955 kr. x 25 % x 83 % x 92 % =63.561,11 kr.');
    expect(text).toContain('Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ 65,7 %): 63.561,11 kr. x 1,657 =105.320,76 kr.');
    expect(text).toContain('Årlig ydelse (105.320,76 kr.) =105.320,76 kr.');
    expect(text).toContain('Vejl. 9820/2023, tabel F');
    expect(text).toContain('Alder ved kapitalisering59 år, 1 måneder');
    expect(text).toContain('Folkepensionsalder68 år');
    expect(text).toContain('Kapitaliseret pga. ≤ 2 år til folkepension?Nej');
    expect(text).toContain('Faktor måneds-afhængig?Ja');
    expect(text).toContain('Kapitaliseringsfaktor5,479');
    expect(text).toContain('Beregnet kapitalbeløb (105.320,76 kr. x 5,479) =577.053 kr.');
    expect(text).not.toContain('Særfaktor');
  });
});
