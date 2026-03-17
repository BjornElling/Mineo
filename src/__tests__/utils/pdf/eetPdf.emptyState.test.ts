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

describe('EET PDF empty states', () => {
  beforeEach(() => {
    MockJsPDF.instances = [];
  });

  it('generateLoebendeYdelserPdf viser tom-tilstand i stedet for tom titelside', async () => {
    const { generateLoebendeYdelserPdf } = await import('../../../utils/pdf/loebendeYdelserPdf');

    generateLoebendeYdelserPdf({
      computation: {
        beregningsdato: '2026-03-17',
        skadesdato: '2020-01-01',
        maxAarsloenISkadesaar: 500000,
        benyttetAarsloen: 500000,
        grundloen: 400000,
        grundloenNiveau: '2024',
        erstatningsniveauPct: 83,
        afgoerelser: [],
        issues: [],
      } as never,
      visUdvidetSpecifikation: false,
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => String(call[0]));
    expect(renderedText).toContain('Specifikation');
    expect(renderedText).toContain('Der er ingen afgørelser i sagen.');
  });

  it('generateKapitaliseringPdf viser tom-tilstand når der ikke er kapitaliserede afgørelser', async () => {
    const { generateKapitaliseringPdf } = await import('../../../utils/pdf/kapitaliseringPdf');

    generateKapitaliseringPdf({
      computation: {
        afgoerelser: [],
        issues: [],
      } as never,
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => String(call[0]));
    expect(renderedText).toContain('Specifikation');
    expect(renderedText).toContain('Der er ingen kapitaliserede afgørelser i sagen.');
  });

  it('generateKapitaliseringPdf udelader AM-bidrag i grundydelseslinjer for skader foer 2011', async () => {
    const { generateKapitaliseringPdf } = await import('../../../utils/pdf/kapitaliseringPdf');

    generateKapitaliseringPdf({
      computation: {
        afgoerelser: [
          {
            rowId: '1',
            afgoerelsesdato: '2022-07-01',
            kapitaliseringsdato: '2022-11-11',
            kapitaliseringspct: 50,
            grundloen: 351539,
            erstatningsniveauPct: 80,
            amBidragPct: 0,
            grundydelse: 140615.6,
            reguleringsPctRounded4: 0,
            aarsydelse: 140615.6,
            kapitaliseringsbekendtgoerelseLabel: 'Vejl. 9871/2020, tabel A',
            tabelLabel: 'A',
            folkepensionsalderLabel: '69 år',
            saerfaktor: null,
            alderAar: 50,
            alderMaaneder: 10,
            kapitaliseretPgaUnderToAarTilFp: false,
            faktorMaanedsAfhaengig: true,
            kapitaliseringsfaktor: 10,
            kapitalbelob: 1406156,
            koenOpdelt: false,
          },
        ],
      } as never,
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => String(call[0]));
    const joinedText = renderedText.join('\n');

    expect(renderedText).toContain('Grundydelse (50 %): Grundløn × EET × Erstatningsniveau =');
    expect(joinedText).toContain('351.539');
    expect(joinedText).toContain('× 50 % × 80 % =');
    expect(renderedText).not.toContain(
      'Grundydelse (50 %): Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag) ='
    );
  });

  it('generateDifferencekravPdf viser tom-tilstand for tomme bilag i stedet for blanke bilagssider', async () => {
    const { generateDifferencekravPdf } = await import('../../../utils/pdf/differencekravPdf');

    generateDifferencekravPdf({
      computation: {
        beregningsdato: '2026-03-17',
        skadesdato: '2020-01-01',
        dagFoerBeregningsdato: '2026-03-16',
        ealKrav: 100000,
        ealEetPct: 15,
        fradragLoebendeYdelser: 0,
        fradragKapitaliseretEet: 0,
        proformaKapitalisering: null,
        proformaBeloeb: 0,
        differencekrav: 100000,
        afgoerelser: [],
        kapitaliseringerAfgoerelser: [],
        loebendeComputation: {
          beregningsdato: '2026-03-16',
          skadesdato: '2020-01-01',
          maxAarsloenISkadesaar: 500000,
          benyttetAarsloen: 500000,
          grundloen: 400000,
          grundloenNiveau: '2024',
          erstatningsniveauPct: 83,
          afgoerelser: [],
          issues: [],
        },
        kapComputation: {
          afgoerelser: [],
          issues: [],
        },
        ealComputation: null,
      } as never,
      bilagSelection: {
        loebendeYdelser: true,
        kapitalisering: true,
        eetEfterEal: false,
        proformaKapitalisering: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: false,
      },
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => String(call[0]));
    expect(renderedText).toContain('Der er ingen afgørelser i sagen.');
    expect(renderedText).toContain('Der er ingen kapitaliserede afgørelser i sagen.');
  });

  it('generateDifferencekravPdf udelader AM-bidrag i proforma-grundydelseslinjer for skader foer 2011', async () => {
    const { generateDifferencekravPdf } = await import('../../../utils/pdf/differencekravPdf');

    generateDifferencekravPdf({
      computation: {
        beregningsdato: '2026-03-17',
        skadesdato: '2020-01-01',
        dagFoerBeregningsdato: '2026-03-16',
        ealKrav: 100000,
        ealEetPct: 15,
        fradragLoebendeYdelser: 0,
        fradragKapitaliseretEet: 0,
        proformaKapitalisering: {
          loebendeEetPct: 50,
          kapitaliseringsdato: '2026-03-17',
          grundloen: 351539,
          grundydelse: 140615.6,
          erstatningsniveauPct: 80,
          amBidragPct: 0,
          reguleringsPctRounded4: 0,
          aarsydelse: 140615.6,
          kapitaliseringsbekendtgoerelseLabel: 'Vejl. 9871/2020, tabel A',
          folkepensionsalderLabel: '69 år',
          saerfaktor: null,
          alderAar: 50,
          alderMaaneder: 10,
          kapitaliseretPgaUnderToAarTilFp: false,
          kapitaliseringsfaktor: 10,
          proformaBeloeb: 1406156,
          koenOpdelt: false,
          faktorMaanedsAfhaengig: true,
        },
        proformaBeloeb: 1406156,
        afgoerelser: [],
        kapitaliseringerAfgoerelser: [],
        loebendeComputation: {
          beregningsdato: '2026-03-16',
          skadesdato: '2020-01-01',
          maxAarsloenISkadesaar: 500000,
          benyttetAarsloen: 500000,
          grundloen: 400000,
          grundloenNiveau: '2024',
          erstatningsniveauPct: 83,
          afgoerelser: [],
          issues: [],
        },
        kapComputation: {
          afgoerelser: [],
          issues: [],
        },
        ealComputation: null,
        differencekrav: 100000,
      } as never,
      bilagSelection: {
        loebendeYdelser: false,
        kapitalisering: false,
        eetEfterEal: false,
        proformaKapitalisering: true,
        visUdvidetSpecifikationLoebendeYdelserBilag: false,
      },
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => String(call[0]));
    const joinedText = renderedText.join('\n');

    expect(renderedText).toContain('Grundydelse (50 %): Grundløn × EET × Erstatningsniveau =');
    expect(joinedText).toContain('351.539');
    expect(joinedText).toContain('× 50 % × 80 % =');
    expect(renderedText).not.toContain(
      'Grundydelse (50 %): Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag) ='
    );
  });
});
