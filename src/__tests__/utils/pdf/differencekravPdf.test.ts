// @vitest-environment jsdom
import { toISODateString } from '../../../types/branded';
import { createPdfDocumentSessionForTest } from './createPdfDocumentSession';
import { fromKroner } from '../../../domain/money/money';

let pdfSession: Awaited<ReturnType<typeof createPdfDocumentSessionForTest>>;
/// <reference types="vitest/globals" />

class MockJsPDF {
  static instances: MockJsPDF[] = [];
  internal = { pageSize: { width: 210, height: 297 } };
  text = vi.fn();
  private currentFontName = 'helvetica';
  private currentFontStyle = 'normal';

  constructor() {
    MockJsPDF.instances.push(this);
  }

  setFont = vi.fn((name: string, style: string) => {
    this.currentFontName = name;
    this.currentFontStyle = style;
  });
  getFont = vi.fn(() => ({ fontName: this.currentFontName, fontStyle: this.currentFontStyle }));
  setFontSize = vi.fn();
  setTextColor = vi.fn();
  setDisplayMode = vi.fn();
  setProperties = vi.fn();
  splitTextToSize = vi.fn((text: string) => [text]);
  getTextWidth = vi.fn((text: string) => text.length);
  getNumberOfPages = vi.fn(() => 1);
  setPage = vi.fn();
  line = vi.fn();
  setLineWidth = vi.fn();
  addPage = vi.fn();
  addImage = vi.fn();
  save = vi.fn();
}

vi.mock('jspdf', () => ({ default: MockJsPDF }));
vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}));

describe('generateDifferencekravDocument', () => {
  beforeEach(async () => {
    pdfSession = await createPdfDocumentSessionForTest();
  });

  beforeEach(() => {
    MockJsPDF.instances = [];
  });

  it('udelader overflødig løbende-ydelser-linje for midlertidig afgørelse ved skadedato den 16. juni 2011 eller senere', async () => {
    const { generateDifferencekravDocument } = await import('../../../document/generators/differencekrav/differencekravDocument');

    generateDifferencekravDocument(pdfSession, {
      computation: {
        beregningsdato: toISODateString('2026-03-17'),
        skadedato: toISODateString('2011-06-16'),
        dagFoerBeregningsdato: toISODateString('2026-03-16'),
        ealKravOre: fromKroner(100000),
        ealEetPct: 15,
        fradragLoebendeYdelserOre: fromKroner(0),
        fradragKapitaliseretEetOre: fromKroner(0),
        proformaKapitalisering: null,
        proformaBeloebOre: fromKroner(0),
        differencekravFoerForligOre: fromKroner(100000),
        forligFactor: null,
        forligLabel: null,
        differencekravOre: fromKroner(100000),
        afgoerelser: [{
          afgoerelsesdato: toISODateString('2020-01-01'),
          virkningsdato: toISODateString('2020-02-01'),
          afgoerelseType: 'Midlertidig',
          eetPct: 15,
          beloebOre: fromKroner(0),
          fradragForetages: false,
          fradragesTil: null,
        }],
        kapitaliseringerAfgoerelser: [],
        loebendeComputation: null,
        kapComputation: null,
        ealComputation: null,
      } as never,
      bilagSelection: {
        loebendeYdelser: false,
        kapitalisering: false,
        eetEfterEal: false,
        proformaKapitalisering: false,
    merErstatningPensionsalder: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: false,
      },
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) =>
      String(call[0]).replace(/\u00A0/g, ' ')
    );
    expect(renderedText).toContain('Skaden er indtrådt den 16. juni 2011 eller senere.');
    expect(renderedText).toContain('Midlertidig afgørelse');
    expect(renderedText).not.toContain('Løbende ydelser derfor ikke relevante.');
    expect(renderedText).not.toContain('Ingen løbende ydelser.');
  });

  it('skriver proforma-opregulering til 2024 over to linjer med resultat kun i højrekolonnen', async () => {
    const { generateDifferencekravDocument } = await import('../../../document/generators/differencekrav/differencekravDocument');

    generateDifferencekravDocument(pdfSession, {
      computation: {
        beregningsdato: toISODateString('2026-03-17'),
        skadedato: toISODateString('2020-01-01'),
        dagFoerBeregningsdato: toISODateString('2026-03-16'),
        ealKravOre: fromKroner(100000),
        ealEetPct: 15,
        fradragLoebendeYdelserOre: fromKroner(0),
        fradragKapitaliseretEetOre: fromKroner(0),
        proformaKapitalisering: {
          loebendeEetPct: 50,
          kapitaliseringsdato: toISODateString('2026-03-17'),
          grundloenOre: fromKroner(351539),
          grundydelseOre: fromKroner(111444.9),
          grundydelse2024Ore: fromKroner(184664.2),
          opreguleringTil2024PctRounded4: 65.7,
          erstatningsniveauPct: 80,
          amBidragPct: 0,
          aarsydelseReguleringsPctRounded4: 0,
          aarsydelseGrundlagOre: fromKroner(184664.2),
          aarsydelseOre: fromKroner(184664.2),
          kapitaliseringsbekendtgoerelseLabel: 'Vejl. 9871/2020, tabel A',
          folkepensionsalderLabel: '69 år',
          saerfaktor: null,
          alderAar: 50,
          alderMaaneder: 10,
          kapitaliseretPgaUnderToAarTilFp: false,
          kapitaliseringsfaktor: 10,
          proformaBeloebOre: fromKroner(1846642),
          koenOpdelt: false,
          faktorMaanedsAfhaengig: true,
        },
        proformaBeloebOre: fromKroner(1846642),
        differencekravFoerForligOre: fromKroner(100000),
        forligFactor: null,
        forligLabel: null,
        differencekravOre: fromKroner(100000),
        afgoerelser: [],
        kapitaliseringerAfgoerelser: [],
        loebendeComputation: null,
        kapComputation: null,
        ealComputation: null,
      } as never,
      bilagSelection: {
        loebendeYdelser: false,
        kapitalisering: false,
        eetEfterEal: false,
        proformaKapitalisering: true,
    merErstatningPensionsalder: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: false,
      },
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) =>
      String(call[0]).replace(/\u00A0/g, ' ')
    );
    const joinedText = renderedText.join('\n');

    expect(renderedText).toContain(
      'Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ 65,7 %) ='
    );
    expect(joinedText).toContain('111.444,90');
    expect(joinedText).toContain('1,657');
    expect(joinedText).toContain('184.664,20 kr.');
    expect(joinedText).toContain('=');
    expect(renderedText).not.toContain(
      'Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ 65,7 %): 111.444,90 kr. × 1,657 ='
    );
  });

  it('viser forlig-reduceret differencekrav-label med fuldt krav i parentes', async () => {
    const { generateDifferencekravDocument } = await import('../../../document/generators/differencekrav/differencekravDocument');

    generateDifferencekravDocument(pdfSession, {
      computation: {
        beregningsdato: toISODateString('2026-03-17'),
        skadedato: toISODateString('2011-06-16'),
        dagFoerBeregningsdato: toISODateString('2026-03-16'),
        ealKravOre: fromKroner(100000),
        ealEetPct: 15,
        fradragLoebendeYdelserOre: fromKroner(0),
        fradragKapitaliseretEetOre: fromKroner(0),
        proformaKapitalisering: null,
        proformaBeloebOre: fromKroner(0),
        differencekravFoerForligOre: fromKroner(1095121),
        forligFactor: 2 / 3,
        forligLabel: '2/3',
        differencekravOre: fromKroner(730081),
        afgoerelser: [],
        kapitaliseringerAfgoerelser: [],
        loebendeComputation: null,
        kapComputation: null,
        ealComputation: null,
      } as never,
      bilagSelection: {
        loebendeYdelser: false,
        kapitalisering: false,
        eetEfterEal: false,
        proformaKapitalisering: false,
        merErstatningPensionsalder: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: false,
      },
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) =>
      String(call[0]).replace(new RegExp(String.fromCharCode(160), 'g'), ' ')
    );
    expect(renderedText).toContain('Beregnet differencekrav (2/3 af 1.095.121 kr.)');
    expect(renderedText).toContain('730.081 kr.');
    expect(renderedText).not.toContain('Beregnet differencekrav');
  });

  it('skriver forhøjet pensionsalder som sektionsoverskrift', async () => {
    const { generateDifferencekravDocument } = await import('../../../document/generators/differencekrav/differencekravDocument');

    generateDifferencekravDocument(pdfSession, {
      computation: {
        beregningsdato: toISODateString('2026-03-17'),
        skadedato: toISODateString('2020-01-01'),
        dagFoerBeregningsdato: toISODateString('2026-03-16'),
        ealKravOre: fromKroner(100000),
        ealEetPct: 15,
        fradragLoebendeYdelserOre: fromKroner(0),
        fradragKapitaliseretEetOre: fromKroner(0),
        proformaKapitalisering: null,
        proformaBeloebOre: fromKroner(0),
        differencekravFoerForligOre: fromKroner(100000),
        forligFactor: null,
        forligLabel: null,
        differencekravOre: fromKroner(100000),
        afgoerelser: [],
        kapitaliseringerAfgoerelser: [],
        merErstatningPensionsalder: {
          events: [{
            forhoejelsesdato: toISODateString('2024-01-01'),
            gammelAlderLabel: '67 år',
            nyAlderLabel: '68 år',
            merErstatningOre: fromKroner(4431),
          }],
        },
        loebendeComputation: null,
        kapComputation: null,
        ealComputation: null,
      } as never,
      bilagSelection: {
        loebendeYdelser: false,
        kapitalisering: false,
        eetEfterEal: false,
        proformaKapitalisering: false,
        merErstatningPensionsalder: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: false,
      },
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => String(call[0]));

    expect(renderedText).toContain('Forhøjet pensionsalder');
    expect(renderedText).not.toContain('Mer-erstatning ved forhøjet folkepensionsalder');
  });
});
