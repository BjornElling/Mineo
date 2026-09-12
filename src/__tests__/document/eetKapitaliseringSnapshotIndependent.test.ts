// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';
import {
  kapitaliseringDocumentDefinition,
  type KapitaliseringDocumentInput,
} from '../../domain/erhvervsevnetab/eetDocumentDefinitions';
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
  journalnr: 'EET-historisk-koen-orakel',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Uafhængigt facit',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2007-07-01'),
  skadelidteFodselsdato: iso('1960-01-01'),
};

const erhvervsevnetab: ErhvervsevnetabValues = {
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  beregningsdato: iso('2008-02-01'),
  koen: 'Mand',
  aslAfgoerelser: [{
    id: 'eet-historisk-koen-orakel-row',
    afgoerelsesDato: iso('2008-01-15'),
    virkningsDato: iso('2008-01-15'),
    eetPct: 50,
    kapDato: iso('2008-02-01'),
    kapPct: 25,
    afgoerelseType: 'Delvist endelig',
    tidlKapDato: undefined,
    fsTilbageholdtEet: 'Nej',
  }],
};

const faellesAarsloen: FaellesAarsloenValues = {
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  aslAarsloen: asAmount(400000),
  ealAarsloen: asAmount(400000),
};

const gateSettings = projectMineoDocumentGateSettings(__createTestSourceSettings({
  brevhovedIndstillinger: {
    ...DEFAULT_BREVHOVED_INDSTILLINGER,
    erhvervsevnetab: false,
  },
}));

const project = (): KapitaliseringDocumentInput => {
  const catalog = getProductionInputCatalog();
  const input = catalog.validateSettledInput({
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
  const evaluation = createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  });
  const result = kapitaliseringDocumentDefinition.project(
    createDocumentSourceContext(evaluation, gateSettings),
    undefined,
  );

  expect(result.status).toBe('ready');
  if (result.status !== 'ready') {
    throw new Error('Kapitalisering-definitionen blev blokeret i orakelfixturet');
  }
  return result.input;
};

describe('EET kapitalisering – uafhængigt snapshot → Word-facit', () => {
  it('fører historisk kønsopdelt månedsfaktor fra snapshot til Word', async () => {
    const input = project();
    const afgoerelse = input.computation.afgoerelser[0];

    expect(input.computation.afgoerelser).toHaveLength(1);
    expect(afgoerelse).toEqual(expect.objectContaining({
      rowId: 'eet-historisk-koen-orakel-row',
      afgoerelsesdato: iso('2008-01-15'),
      kapitaliseringsdato: iso('2008-02-01'),
      eetPct: 50,
      kapitaliseringspct: 25,
      grundloenOre: 36068800,
      erstatningsniveauPct: 80,
      amBidragPct: 0,
      grundydelseOre: 7213760,
      grundydelse2024Ore: null,
      opreguleringTil2024PctRounded4: null,
      aarsydelseGrundlagOre: 7213760,
      aarsydelseReguleringsPctRounded4: 14.3,
      aarsydelseOre: 8245328,
      kapitaliseringsbekendtgoerelseLabel: 'Bkg. 1263/2007, tabel A',
      tabelLabel: 'A',
      folkepensionsalderLabel: '65 år',
      saerfaktor: null,
      alderAar: 48,
      alderMaaneder: 1,
      kapitaliseretPgaUnderToAarTilFp: false,
      faktorMaanedsAfhaengig: true,
      kapitaliseringsfaktor: 8.764,
      kapitalbelobOre: 72262100,
      koenOpdelt: true,
    }));

    const renderer = await kapitaliseringDocumentDefinition.loadRenderer();
    const { filename, documentXml } = await renderWordDocument((session) =>
      renderer(session, input, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Kapitalisering (EET)');
    expect(text).toContain('Afgørelse 15. januar 2008 (50 %)');
    expect(text).toContain('Kapitaliseringsdato');
    expect(text).toContain('01-02-2008');
    expect(text).toContain('Kapitaliseringsprocent');
    expect(text).toContain('25 %');
    expect(text).toContain('Grundydelse (25 %): Grundløn x EET x Erstatningsniveau');
    expect(text).toContain('360.688 kr. x 25 % x 80 %');
    expect(text).toContain('72.137,60 kr.');
    expect(text).toContain('Reguleringsprocent (01-02-2008)');
    expect(text).toContain('14,3 %');
    expect(text).toContain('Årlig ydelse (72.137,60 kr. x 114,3 %)');
    expect(text).toContain('82.453,28 kr.');
    expect(text).toContain('Kapitaliseringsbekendtgørelse');
    expect(text).toContain('Bkg. 1263/2007, tabel A');
    expect(text).toContain('Alder ved kapitalisering');
    expect(text).toContain('48 år, 1 måneder');
    expect(text).toContain('Folkepensionsalder');
    expect(text).toContain('65 år');
    expect(text).toContain('Kapitaliseret pga. ≤ 2 år til folkepension?');
    expect(text).toContain('Nej');
    expect(text).toContain('Faktor måneds-afhængig?');
    expect(text).toContain('Ja');
    expect(text).toContain('Køn');
    expect(text).toContain('Mand');
    expect(text).toContain('Kapitaliseringsfaktor');
    expect(text).toContain('8,764');
    expect(text).toContain('Beregnet kapitalbeløb (82.453,28 kr. x 8,764) =');
    expect(text).toContain('722.621 kr.');
  });
});
