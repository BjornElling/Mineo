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
});
