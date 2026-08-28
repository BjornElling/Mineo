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

describe('EET PDF empty states', () => {
  beforeEach(async () => {
    pdfSession = await createPdfDocumentSessionForTest();
  });

  beforeEach(() => {
    MockJsPDF.instances = [];
  });

  it('generateLoebendeYdelserDocument viser tom-tilstand i stedet for tom titelside', async () => {
    const { generateLoebendeYdelserDocument } = await import('../../../document/generators/loebendeYdelser/loebendeYdelserDocument');

    generateLoebendeYdelserDocument(pdfSession, {
      computation: {
        beregningsdato: toISODateString('2026-03-17'),
        skadedato: toISODateString('2020-01-01'),
        maxAarsloenISkadesaarOre: fromKroner(500000),
        benyttetAarsloenOre: fromKroner(500000),
        grundloenOre: fromKroner(400000),
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

  it('generateKapitaliseringDocument viser tom-tilstand når der ikke er kapitaliserede afgørelser', async () => {
    const { generateKapitaliseringDocument } = await import('../../../document/generators/kapitalisering/kapitaliseringDocument');

    generateKapitaliseringDocument(pdfSession, {
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

  it('generateKapitaliseringDocument udelader AM-bidrag i grundydelseslinjer for skader foer 2011', async () => {
    const { generateKapitaliseringDocument } = await import('../../../document/generators/kapitalisering/kapitaliseringDocument');

    generateKapitaliseringDocument(pdfSession, {
      computation: {
        afgoerelser: [
          {
            rowId: '1',
            afgoerelsesdato: toISODateString('2022-07-01'),
            kapitaliseringsdato: toISODateString('2022-11-11'),
            kapitaliseringspct: 50,
            grundloenOre: fromKroner(351539),
            erstatningsniveauPct: 80,
            amBidragPct: 0,
            grundydelseOre: fromKroner(140615.6),
            reguleringsPctRounded4: 0,
            aarsydelseOre: fromKroner(140615.6),
            kapitaliseringsbekendtgoerelseLabel: 'Vejl. 9871/2020, tabel A',
            tabelLabel: 'A',
            folkepensionsalderLabel: '69 år',
            saerfaktor: null,
            alderAar: 50,
            alderMaaneder: 10,
            kapitaliseretPgaUnderToAarTilFp: false,
            faktorMaanedsAfhaengig: true,
            kapitaliseringsfaktor: 10,
            kapitalbelobOre: fromKroner(1406156),
            koenOpdelt: false,
          },
        ],
      } as never,
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => String(call[0]));
    const joinedText = renderedText.join('\n');

    expect(renderedText).toContain('Grundydelse (50 %): Grundløn x EET x Erstatningsniveau =');
    expect(joinedText).toContain('351.539');
    expect(joinedText).toContain('x 50 % x 80 % =');
    expect(renderedText).toContain('Kapitaliseret pga. < 2 år til folkepension?');
    expect(renderedText).not.toContain(
      'Grundydelse (50 %): Grundløn x EET x Erstatningsniveau x (100 % − AM-bidrag) ='
    );
  });

  it('generateDifferencekravDocument viser tom-tilstand for tomme bilag i stedet for blanke bilagssider', async () => {
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
        differencekravOre: fromKroner(100000),
        afgoerelser: [],
        kapitaliseringerAfgoerelser: [],
        loebendeComputation: {
          beregningsdato: toISODateString('2026-03-16'),
          skadedato: toISODateString('2020-01-01'),
          maxAarsloenISkadesaarOre: fromKroner(500000),
          benyttetAarsloenOre: fromKroner(500000),
          grundloenOre: fromKroner(400000),
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

  it('generateDifferencekravDocument udelader AM-bidrag i proforma-grundydelseslinjer for skader foer 2011', async () => {
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
          grundydelseOre: fromKroner(140615.6),
          erstatningsniveauPct: 80,
          amBidragPct: 0,
          reguleringsPctRounded4: 0,
          aarsydelseOre: fromKroner(140615.6),
          kapitaliseringsbekendtgoerelseLabel: 'Vejl. 9871/2020, tabel A',
          folkepensionsalderLabel: '69 år',
          saerfaktor: null,
          alderAar: 50,
          alderMaaneder: 10,
          kapitaliseretPgaUnderToAarTilFp: false,
          kapitaliseringsfaktor: 10,
          proformaBeloebOre: fromKroner(1406156),
          koenOpdelt: false,
          faktorMaanedsAfhaengig: true,
        },
        proformaBeloebOre: fromKroner(1406156),
        afgoerelser: [],
        kapitaliseringerAfgoerelser: [],
        loebendeComputation: {
          beregningsdato: toISODateString('2026-03-16'),
          skadedato: toISODateString('2020-01-01'),
          maxAarsloenISkadesaarOre: fromKroner(500000),
          benyttetAarsloenOre: fromKroner(500000),
          grundloenOre: fromKroner(400000),
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
        differencekravOre: fromKroner(100000),
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

    expect(renderedText).toContain('Grundydelse (50 %): Grundløn x EET x Erstatningsniveau =');
    expect(joinedText).toContain('351.539');
    expect(joinedText).toContain('x 50 % x 80 % =');
    expect(renderedText).toContain('Kapitaliseret pga. < 2 år til folkepension?');
    expect(renderedText).not.toContain(
      'Grundydelse (50 %): Grundløn x EET x Erstatningsniveau x (100 % − AM-bidrag) ='
    );
  });

  it('generateDifferencekravDocument bruger løbende-bilagets computation med dagen før beregningsdatoen', async () => {
    const { generateDifferencekravDocument } = await import('../../../document/generators/differencekrav/differencekravDocument');

    generateDifferencekravDocument(pdfSession, {
      computation: {
        beregningsdato: toISODateString('2026-01-15'),
        skadedato: toISODateString('2022-09-17'),
        dagFoerBeregningsdato: toISODateString('2026-01-14'),
        ealKravOre: fromKroner(100000),
        ealEetPct: 15,
        fradragLoebendeYdelserOre: fromKroner(0),
        fradragKapitaliseretEetOre: fromKroner(0),
        proformaKapitalisering: null,
        proformaBeloebOre: fromKroner(0),
        differencekravOre: fromKroner(100000),
        afgoerelser: [],
        kapitaliseringerAfgoerelser: [],
        loebendeComputation: {
          beregningsdato: toISODateString('2026-01-14'),
          skadedato: toISODateString('2022-09-17'),
          maxAarsloenISkadesaarOre: fromKroner(500000),
          benyttetAarsloenOre: fromKroner(339000),
          grundloenOre: fromKroner(300000),
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
            grundydelseFuldOre: fromKroner(0),
            grundydelseRestOre: null,
            grundydelse2024FuldOre: fromKroner(0),
            grundydelse2024RestOre: null,
            perioder: [],
            iAltBeregnetEetOre: fromKroner(0),
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

  it('generateLoebendeYdelserDocument bruger opdateret AM-bidrag-tekst i udvidet specifikation for post-2010-skader', async () => {
    const { generateLoebendeYdelserDocument } = await import('../../../document/generators/loebendeYdelser/loebendeYdelserDocument');

    generateLoebendeYdelserDocument(pdfSession, {
      computation: {
        beregningsdato: toISODateString('2026-03-17'),
        skadedato: toISODateString('2020-01-01'),
        maxAarsloenISkadesaarOre: fromKroner(500000),
        benyttetAarsloenOre: fromKroner(500000),
        grundloenOre: fromKroner(400000),
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

  it('generateDifferencekravDocument bruger samme opdaterede AM-bidrag-tekst i udvidet specifikation-bilaget', async () => {
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
        differencekravOre: fromKroner(100000),
        afgoerelser: [],
        kapitaliseringerAfgoerelser: [],
        loebendeComputation: {
          beregningsdato: toISODateString('2026-03-16'),
          skadedato: toISODateString('2020-01-01'),
          maxAarsloenISkadesaarOre: fromKroner(500000),
          benyttetAarsloenOre: fromKroner(500000),
          grundloenOre: fromKroner(400000),
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
