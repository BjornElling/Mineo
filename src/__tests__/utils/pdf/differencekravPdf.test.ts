import { toISODateString } from '../../../types/branded';
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

describe('generateDifferencekravPdf', () => {
  beforeEach(() => {
    MockJsPDF.instances = [];
  });

  it('udelader overflødig løbende-ydelser-linje for midlertidig afgørelse ved skadedato den 16. juni 2011 eller senere', async () => {
    const { generateDifferencekravPdf } = await import('../../../pdf/domains/differencekrav/differencekravPdf');

    generateDifferencekravPdf({
      computation: {
        beregningsdato: toISODateString('2026-03-17'),
        skadedato: toISODateString('2011-06-16'),
        dagFoerBeregningsdato: toISODateString('2026-03-16'),
        ealKrav: 100000,
        ealEetPct: 15,
        fradragLoebendeYdelser: 0,
        fradragKapitaliseretEet: 0,
        proformaKapitalisering: null,
        proformaBeloeb: 0,
        differencekrav: 100000,
        afgoerelser: [{
          afgoerelsesdato: toISODateString('2020-01-01'),
          virkningsdato: toISODateString('2020-02-01'),
          afgoerelseType: 'Midlertidig',
          eetPct: 15,
          beloeb: 0,
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
    const { generateDifferencekravPdf } = await import('../../../pdf/domains/differencekrav/differencekravPdf');

    generateDifferencekravPdf({
      computation: {
        beregningsdato: toISODateString('2026-03-17'),
        skadedato: toISODateString('2020-01-01'),
        dagFoerBeregningsdato: toISODateString('2026-03-16'),
        ealKrav: 100000,
        ealEetPct: 15,
        fradragLoebendeYdelser: 0,
        fradragKapitaliseretEet: 0,
        proformaKapitalisering: {
          loebendeEetPct: 50,
          kapitaliseringsdato: toISODateString('2026-03-17'),
          grundloen: 351539,
          grundydelse: 111444.9,
          grundydelse2024: 184664.2,
          opreguleringTil2024PctRounded4: 65.7,
          erstatningsniveauPct: 80,
          amBidragPct: 0,
          aarsydelseReguleringsPctRounded4: 0,
          aarsydelseGrundlag: 184664.2,
          aarsydelse: 184664.2,
          kapitaliseringsbekendtgoerelseLabel: 'Vejl. 9871/2020, tabel A',
          folkepensionsalderLabel: '69 år',
          saerfaktor: null,
          alderAar: 50,
          alderMaaneder: 10,
          kapitaliseretPgaUnderToAarTilFp: false,
          kapitaliseringsfaktor: 10,
          proformaBeloeb: 1846642,
          koenOpdelt: false,
          faktorMaanedsAfhaengig: true,
        },
        proformaBeloeb: 1846642,
        differencekrav: 100000,
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
});
