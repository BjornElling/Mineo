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

describe('EET PDF empty states', () => {
  beforeEach(() => {
    MockJsPDF.instances = [];
  });

  it('generateLoebendeYdelserPdf viser tom-tilstand i stedet for tom titelside', async () => {
    const { generateLoebendeYdelserPdf } = await import('../../../pdf/domains/loebendeYdelser/loebendeYdelserPdf');

    generateLoebendeYdelserPdf({
      computation: {
        beregningsdato: toISODateString('2026-03-17'),
        skadedato: toISODateString('2020-01-01'),
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
    const { generateKapitaliseringPdf } = await import('../../../pdf/domains/kapitalisering/kapitaliseringPdf');

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
    const { generateKapitaliseringPdf } = await import('../../../pdf/domains/kapitalisering/kapitaliseringPdf');

    generateKapitaliseringPdf({
      computation: {
        afgoerelser: [
          {
            rowId: '1',
            afgoerelsesdato: toISODateString('2022-07-01'),
            kapitaliseringsdato: toISODateString('2022-11-11'),
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
    expect(renderedText).toContain('Kapitaliseret pga. < 2 år til folkepension?');
    expect(renderedText).not.toContain(
      'Grundydelse (50 %): Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag) ='
    );
  });

  it('generateDifferencekravPdf viser tom-tilstand for tomme bilag i stedet for blanke bilagssider', async () => {
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
        proformaKapitalisering: null,
        proformaBeloeb: 0,
        differencekrav: 100000,
        afgoerelser: [],
        kapitaliseringerAfgoerelser: [],
        loebendeComputation: {
          beregningsdato: toISODateString('2026-03-16'),
          skadedato: toISODateString('2020-01-01'),
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
    merErstatningPensionsalder: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: false,
      },
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => String(call[0]));
    expect(renderedText).toContain('Der er ingen afgørelser i sagen.');
    expect(renderedText).toContain('Der er ingen kapitaliserede afgørelser i sagen.');
  });

  it('generateDifferencekravPdf udelader AM-bidrag i proforma-grundydelseslinjer for skader foer 2011', async () => {
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
          beregningsdato: toISODateString('2026-03-16'),
          skadedato: toISODateString('2020-01-01'),
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
    merErstatningPensionsalder: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: false,
      },
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => String(call[0]));
    const joinedText = renderedText.join('\n');

    expect(renderedText).toContain('Grundydelse (50 %): Grundløn × EET × Erstatningsniveau =');
    expect(joinedText).toContain('351.539');
    expect(joinedText).toContain('× 50 % × 80 % =');
    expect(renderedText).toContain('Kapitaliseret pga. < 2 år til folkepension?');
    expect(renderedText).not.toContain(
      'Grundydelse (50 %): Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag) ='
    );
  });

  it('generateDifferencekravPdf bruger løbende-bilagets computation med dagen før beregningsdatoen', async () => {
    const { generateDifferencekravPdf } = await import('../../../pdf/domains/differencekrav/differencekravPdf');

    generateDifferencekravPdf({
      computation: {
        beregningsdato: toISODateString('2026-01-15'),
        skadedato: toISODateString('2022-09-17'),
        dagFoerBeregningsdato: toISODateString('2026-01-14'),
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
          beregningsdato: toISODateString('2026-01-14'),
          skadedato: toISODateString('2022-09-17'),
          maxAarsloenISkadesaar: 500000,
          benyttetAarsloen: 339000,
          grundloen: 300000,
          grundloenNiveau: '2024',
          erstatningsniveauPct: 83,
          amBidragPct: 8,
          reguleringFoer2024Pct: 0,
          fodselsdato: toISODateString('1978-05-03'),
          skadesaar: 2022,
          afgoerelser: [{
            rowId: 'a1',
            afgoerelsesdato: toISODateString('2026-01-15'),
            virkningsdato: toISODateString('2026-01-15'),
            kapitaliseringsdato: toISODateString('2026-01-15'),
            afgoerelseType: 'Endelig',
            eetPct: 15,
            priorKapPct: 0,
            eetPctFoerAktuelKap: 15,
            kapPctAktuel: 15,
            kapPctKumulativ: 15,
            restEetPct: 0,
            harKapitalisering: true,
            harRestSektion: false,
            tilbagevirkendeKraft: false,
            ophoerDato: toISODateString('2026-01-14'),
            ophoerAarsag: 'beregningsdato',
            grundydelseFuld: 0,
            grundydelseRest: null,
            grundydelse2024Fuld: 0,
            grundydelse2024Rest: null,
            perioder: [],
            iAltBeregnetEet: 0,
          }],
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
        kapitalisering: false,
        eetEfterEal: false,
        proformaKapitalisering: false,
    merErstatningPensionsalder: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: false,
      },
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => String(call[0]));
    expect(renderedText).toContain('Beregningsdato');
    expect(renderedText).toContain('15-01-2026');
    expect(renderedText).toContain('Løbende ydelse ophører');
    expect(renderedText).toContain('14-01-2026');
    expect(renderedText).toContain('Afgørelsen giver ingen løbende ydelse i den valgte periode.');
    expect(renderedText).not.toContain('Fra o.m.');
    expect(renderedText).not.toContain('Til o.m.');
    expect(renderedText).not.toContain('Mdr.');
    expect(renderedText).not.toContain('Grundydelse');
    expect(renderedText).not.toContain('Regulering');
    expect(renderedText).not.toContain('Ydelse/md.');
    expect(renderedText).not.toContain('Beregnet EET');
    expect(renderedText).not.toContain('I alt');
  });

  it('generateLoebendeYdelserPdf bruger opdateret AM-bidrag-tekst i udvidet specifikation for post-2010-skader', async () => {
    const { generateLoebendeYdelserPdf } = await import('../../../pdf/domains/loebendeYdelser/loebendeYdelserPdf');

    generateLoebendeYdelserPdf({
      computation: {
        beregningsdato: toISODateString('2026-03-17'),
        skadedato: toISODateString('2020-01-01'),
        maxAarsloenISkadesaar: 500000,
        benyttetAarsloen: 500000,
        grundloen: 400000,
        grundloenNiveau: '2024',
        erstatningsniveauPct: 83,
        afgoerelser: [],
        issues: [],
      } as never,
      visUdvidetSpecifikation: true,
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => String(call[0]));

    expect(renderedText).toContain('Da skaden er sket 1/1-2011 eller senere, udgør erstatningsniveauet');
    expect(renderedText).toContain(
      'Der fratrækkes AM-bidrag (8 %) svarende til en yderligere regulering med'
    );
    expect(renderedText).not.toContain(
      'Der trækkes AM-bidrag (8 %) fra årslønnen og sker dermed yderligere regulering til'
    );
  });

  it('generateDifferencekravPdf bruger samme opdaterede AM-bidrag-tekst i udvidet specifikation-bilaget', async () => {
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
        proformaKapitalisering: null,
        proformaBeloeb: 0,
        differencekrav: 100000,
        afgoerelser: [],
        kapitaliseringerAfgoerelser: [],
        loebendeComputation: {
          beregningsdato: toISODateString('2026-03-16'),
          skadedato: toISODateString('2020-01-01'),
          maxAarsloenISkadesaar: 500000,
          benyttetAarsloen: 500000,
          grundloen: 400000,
          grundloenNiveau: '2024',
          erstatningsniveauPct: 83,
          afgoerelser: [],
          issues: [],
        },
        kapComputation: null,
        ealComputation: null,
      } as never,
      bilagSelection: {
        loebendeYdelser: true,
        kapitalisering: false,
        eetEfterEal: false,
        proformaKapitalisering: false,
    merErstatningPensionsalder: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: true,
      },
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => String(call[0]));

    expect(renderedText).toContain('Udvidet specifikation');
    expect(renderedText).toContain(
      'Der fratrækkes AM-bidrag (8 %) svarende til en yderligere regulering med'
    );
    expect(renderedText).not.toContain(
      'Der trækkes AM-bidrag (8 %) fra årslønnen og sker dermed yderligere regulering til'
    );
  });
});
