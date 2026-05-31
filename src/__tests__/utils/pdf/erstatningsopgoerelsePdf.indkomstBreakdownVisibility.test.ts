import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { formatCurrencyFromOre } from '../../../pdf/shared/pdfFormatUtils';
import { PDF_BASE_LINE_HEIGHT_MM, PDF_LINE_BOTTOM_SPACING_MM } from '../../../pdf/infrastructure/pdfConfig';

// Minimum Y-afstand mellem to teksters baselines når der skal være mindst én tom linje imellem:
// linje + trailing + linje. Bruges til at håndhæve læsbarheds-luft mellem forbeholdstekst og krav.
const MIN_AFSTAND_MED_TOM_LINJE = 2 * PDF_BASE_LINE_HEIGHT_MM + PDF_LINE_BOTTOM_SPACING_MM;

const MockJsPDF = vi.hoisted(() =>
  class MockJsPDF {
    static lastInstance: MockJsPDF | null = null;
    internal = { pageSize: { width: 210, height: 297 } };
    text = vi.fn();
    private currentFontName = 'helvetica';
    private currentFontStyle = 'normal';
    setFont = vi.fn((fontName: string, fontStyle: string) => {
      this.currentFontName = fontName;
      this.currentFontStyle = fontStyle;
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
    save = vi.fn();

    constructor() {
      MockJsPDF.lastInstance = this;
    }
  }
);

const { autoTableMock } = vi.hoisted(() => ({
  autoTableMock: vi.fn((doc: Record<string, unknown>, options: { startY?: number }) => {
    doc.lastAutoTable = { finalY: (options.startY ?? 0) + 20 };
  }),
}));

vi.mock('jspdf-autotable', () => ({
  default: autoTableMock,
}));

vi.mock('jspdf', () => ({ default: MockJsPDF }));

const iso = (value: string) => toISODateString(value);
const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const selected = {
  opgoerelse: true,
  loenindkomst: false,
  offentligeYdelser: false,
  shDage: false,
  regulering: false,
  okSatser: false,
  sygeferiegodtgoerelse: false,
};

let generateErstatningsopgoerelsePdf: typeof import('../../../pdf/domains/eo/erstatningsopgoerelsePdf').generateErstatningsopgoerelsePdf;

const buildProjectedDocument = (
  stamdata: typeof STAMDATA_INITIAL_VALUES,
  eo: ReturnType<typeof createErstatningsopgoerelseInitialValues>
) => {
  const snapshot = computeEoSnapshot({
    revision: 'test-erstatningsopgoerelsePdf.indkomstBreakdownVisibility',
    stamdataValues: stamdata,
    eoValues: eo,
  });

  if (!snapshot.data) {
    throw new Error('Kunne ikke bygge testdokument til EO-PDF');
  }

  return snapshot.data.pdfModel;
};

const renderPdf = (
  stamdata: typeof STAMDATA_INITIAL_VALUES,
  eo: ReturnType<typeof createErstatningsopgoerelseInitialValues>
) => {
  generateErstatningsopgoerelsePdf(stamdata, eo, selected, {
    visUdkastStempel: false,
    document: buildProjectedDocument(stamdata, eo),
  });
};

const renderPdfWithSelected = (
  stamdata: typeof STAMDATA_INITIAL_VALUES,
  eo: ReturnType<typeof createErstatningsopgoerelseInitialValues>,
  selectedElements: typeof selected
) => {
  generateErstatningsopgoerelsePdf(stamdata, eo, selectedElements, {
    visUdkastStempel: false,
    document: buildProjectedDocument(stamdata, eo),
  });
};

const collectTextStrings = (instance: MockJsPDF | null): string[] => {
  if (!instance) return [];
  const values: string[] = [];
  for (const call of instance.text.mock.calls) {
    const [firstArg] = call;
    if (typeof firstArg === 'string') {
      values.push(firstArg);
      continue;
    }
    if (Array.isArray(firstArg)) {
      for (const item of firstArg) {
        if (typeof item === 'string') values.push(item);
      }
    }
  }
  return values;
};

const hasTextAfterHeader = (texts: readonly string[], header: string, expected: string): boolean => {
  const index = texts.indexOf(header);
  if (index === -1) return false;
  return texts.slice(index + 1).some((text) => text === expected);
};

const getTextsBetween = (texts: readonly string[], startHeader: string, endHeader: string): string[] => {
  const startIndex = texts.indexOf(startHeader);
  if (startIndex === -1) return [];
  const endIndex = texts.indexOf(endHeader);
  const sliceEnd = endIndex === -1 ? texts.length : endIndex;
  return texts.slice(startIndex + 1, sliceEnd);
};

const findTextY = (instance: MockJsPDF | null, text: string): number | null => {
  if (!instance) return null;
  for (const call of instance.text.mock.calls) {
    const [firstArg, , y] = call;
    if (firstArg === text && typeof y === 'number') return y;
  }
  return null;
};

const EET_KLAGE_REGULERINGSLINJE =
  'Hvis der som følge af den verserende klagesag over erhvervsevnetab sker ændringer i ydelse eller virkningstidspunkt, vil kravet blive reguleret tilsvarende.';

const createEmployment = (overrides: Record<string, unknown> = {}) => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: 'af-base',
  ...overrides,
});

const buildBaseInput = () => {
  const stamdata = {
    ...structuredClone(STAMDATA_INITIAL_VALUES),
    skadestype: 'Arbejdsulykke' as const,
    skadedato: iso('2024-01-01'),
  };

  const eo = createErstatningsopgoerelseInitialValues();
  eo.beregnesUdFra = 'Beregningsperiode';
  eo.vedroererPeriodeFra = iso('2024-01-01');
  eo.vedroererPeriodeTil = iso('2024-01-31');
  eo.tafBeregningsperiodeFra = iso('2024-01-01');
  eo.tafBeregningsperiodeTil = iso('2024-01-31');
  eo.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined }];

  eo.loenindkomstAnsaettelsesforhold = [
    createEmployment({
      id: 'af-1',
      navnPaaArbejdssted: 'AAB',
      loenudviklingBeregningsgrundlag: 'Ingen',
      indtaegtsoplysningerTableData: [
        {
          id: 'row-1',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmountValue(10000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
    }),
  ];

  return { stamdata, eo };
};

describe('erstatningsopgoerelsePdf indkomst-breakdown synlighed', () => {
  beforeAll(async () => {
    const pdfModule = await import('../../../pdf/domains/eo/erstatningsopgoerelsePdf');
    generateErstatningsopgoerelsePdf = pdfModule.generateErstatningsopgoerelsePdf;
  }, 30000);

  it('viser ferieoplysning under indkomst uden skade for daterede og løse feriedage i TAF-perioden', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.beregnesUdFra = 'Angivet dagsløn';
    eo.dagsloenenUdgoer = asAmountValue(1500);
    eo.eoAngivetLoenLoenudvikling.loenPaaHelligdage = 'Almindelig løn';
    eo.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Ingen';
    eo.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: 2 }];
    eo.ferieperioder = [
      { id: 'ferie-1', fra: iso('2023-12-29'), til: iso('2024-01-03') },
      { id: 'ferie-2', fra: iso('2024-01-04'), til: iso('2024-01-05') },
    ];

    renderPdf(stamdata, eo);

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    expect(texts).toContain(
      'I perioden blev der afholdt ferie i perioden 01-01-2024 - 05-01-2024 samt 2 løse ferie-/feriefridage.'
    );
  });

  it('tilpasser ferieoplysning under indkomst uden skade når der kun er løse feriedage i erstatningsperioden', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.beregnesUdFra = 'Angivet dagsløn';
    eo.dagsloenenUdgoer = asAmountValue(1500);
    eo.eoAngivetLoenLoenudvikling.loenPaaHelligdage = 'Almindelig løn';
    eo.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Ingen';
    eo.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: 2 }];

    renderPdf(stamdata, eo);

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    expect(texts).toContain('I perioden blev der afholdt 2 løse ferie-/feriefridage.');
  });

  it('tilpasser ferieoplysning under indkomst uden skade når der er flere ferieperioder uden løse feriedage', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.beregnesUdFra = 'Angivet dagsløn';
    eo.dagsloenenUdgoer = asAmountValue(1500);
    eo.eoAngivetLoenLoenudvikling.loenPaaHelligdage = 'Almindelig løn';
    eo.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Ingen';
    eo.ferieperioder = [
      { id: 'ferie-1', fra: iso('2024-01-02'), til: iso('2024-01-03') },
      { id: 'ferie-2', fra: iso('2024-01-08'), til: iso('2024-01-09') },
    ];

    renderPdf(stamdata, eo);

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    expect(texts).toContain(
      'I perioden blev der afholdt ferie i perioderne 02-01-2024 - 03-01-2024 og 08-01-2024 - 09-01-2024.'
    );
  });

  it('udelader ferieoplysning under indkomst uden skade når TAF beregnes som måneder', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.beregnesUdFra = 'Angivet månedsløn';
    eo.maanedsloenenUdgoer = asAmountValue(30000);
    eo.eoAngivetLoenLoenudvikling.loenPaaHelligdage = 'Almindelig løn';
    eo.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Ingen';
    eo.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined }];
    eo.ferieperioder = [{ id: 'ferie-1', fra: iso('2024-01-02'), til: iso('2024-01-03') }];

    renderPdf(stamdata, eo);

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    expect(texts.some((text) => text.startsWith('I perioden blev der afholdt'))).toBe(false);
  });

  it('udelader ferieoplysning under indkomst uden skade når ferie ikke ligger i TAF- og erstatningsperioden', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.ferieperioder = [{ id: 'ferie-udenfor', fra: iso('2024-02-01'), til: iso('2024-02-02') }];

    renderPdf(stamdata, eo);

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    expect(texts.some((text) => text.startsWith('I perioden blev der afholdt ferie'))).toBe(false);
  });

  it('skjuler pensionslinje når beregnet værdi er 0 kr.', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.loenindkomstAnsaettelsesforhold[0].feriePct = 15;
    eo.loenindkomstAnsaettelsesforhold[0].pensionPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].indtaegtsoplysningerTableData[0].col5 = asAmountValue(1500);

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).not.toContain('Arbejdsgivers pensionsbidrag');
    expect(texts).toContain('Arbejdsgivers ATP-bidrag og anden indkomst uden tillæg');
  });

  it('skriver kombineret bilagslinje for løn i sygeperioden og offentlige ydelser', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.visBilagsnumre = 'Ja';
    eo.bilagsnumreLoenISygeperioden = '1';
    eo.bilagsnumreOffentligeYdelser = '2';
    eo.offentligeYdelserRows = [
      {
        id: 'oy-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'Sygedagpenge',
        ydelse: asAmountValue(1000),
        tillaeg: undefined,
      },
    ];

    renderPdf(stamdata, eo);

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    expect(texts).toContain('Dokumentation vedlægges som ');
    expect(texts).toContain('bilag\u00A01 og 2.');
    expect(texts).not.toContain('bilag\u00A01.');
    expect(texts).not.toContain('bilag\u00A02.');
  });

  it('viser kun "Ingen" i TAF-sektionen når tabt arbejdsfortjeneste er fravalgt trods stale felter', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.beregnesTabtArbejdsfortjeneste = 'Nej';
    eo.tafArbejdsstatus = 'Førtidspension';
    eo.differencekravDato = iso('2024-02-01');

    renderPdf(stamdata, eo);

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    const tafBlock = getTextsBetween(texts, 'Tabt arbejdsfortjeneste', 'Øvrige krav');

    expect(tafBlock).toContain('Ingen');
    expect(tafBlock).not.toContain('Den 1. februar 2024 var skadelidte på førtidspension og således fortsat uarbejdsdygtig.');
    expect(tafBlock).not.toContain('Erstatningsperiode, hvor der beregnes tabt arbejdsfortjeneste');
    expect(tafBlock).not.toContain('01-01-2024 - 31-01-2024');
  });

  it('viser kun "Ingen" i svie/smerte-sektionen når tidligere S/S max er valgt trods stale felter', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.beregnesSvieSmerteGodtgoerelse = 'Ja';
    eo.tidligereSsMax = 'Ja';
    eo.svieSmerteHelbredsstatus = 'Sygemeldt';
    eo.svieSmerteSatserAar = 2026;
    eo.svieSmerteDelvisSygemeldingSats = 'fuld';
    eo.svieSmertePerioder = [
      { id: 'ss-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), tilstand: 'sygemeldt' },
    ];

    renderPdf(stamdata, eo);

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    const svieBlock = getTextsBetween(texts, 'Svie- og smertegodtgørelse', 'Tabt arbejdsfortjeneste');

    expect(svieBlock).toContain('Ingen');
    expect(svieBlock).not.toContain('Den 1. februar 2024 var skadelidte fortsat sygemeldt.');
    expect(svieBlock).not.toContain('Sygeperiode, hvor der beregnes svie- og smertegodtgørelse');
    expect(svieBlock).not.toContain('01-01-2024 - 31-01-2024');
  });

  it('skjuler "I alt:" når kun én del-linje vises', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.loenindkomstAnsaettelsesforhold[0].loenPaaHelligdage = 'SH-udbetaling';
    eo.loenindkomstAnsaettelsesforhold[0].feriePct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].fritvalgPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].shSoPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].storeBededagPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].pensionPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].indtaegtsoplysningerTableData[0].col5 = undefined;

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);
    const arbejdsstedStartIndex = texts.indexOf('AAB');
    const dagsindkomstIndex = texts.findIndex((text) => text.startsWith('Dagsindkomst:'));
    const arbejdsstedBlock = arbejdsstedStartIndex === -1
      ? []
      : texts.slice(arbejdsstedStartIndex + 1, dagsindkomstIndex === -1 ? texts.length : dagsindkomstIndex);

    expect(arbejdsstedBlock).toContain('Løn i beregningsperioden');
    expect(arbejdsstedBlock).not.toContain('I alt:');
  });

  it('viser sektionen "Tidligere betalt erstatning" når tidligere modtaget TAF er indtastet', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.tidligereModtagetTaf = asAmountValue(5000);

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain('Tidligere betalt erstatning');
    expect(texts).toContain('Der er allerede betalt tabt arbejdsfortjeneste for perioden med');
  });

  it('viser TAF-formlen med tidligere betalt beløb uden for forligsparantesen', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.forligAnsvarsgradBroek = '1/3';
    eo.tidligereModtagetTaf = asAmountValue(25000);

    const model = buildProjectedDocument(stamdata, eo);
    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);
    const beregnetKravHeaderIndex = texts.indexOf('Beregnet krav på tabt arbejdsfortjeneste');
    const beregnetKravLinje = beregnetKravHeaderIndex === -1 ? null : texts[beregnetKravHeaderIndex + 1];
    const loenTotalOre =
      model.tabtArbejdsfortjeneste.loenudvikling?.loenudviklingTotal.status === 'ok'
        ? model.tabtArbejdsfortjeneste.loenudvikling.loenudviklingTotal.value
        : 0;
    const tafTotalOre =
      model.tabtArbejdsfortjeneste.tafIndtaegter?.total.status === 'ok'
        ? model.tabtArbejdsfortjeneste.tafIndtaegter.total.value
        : 0;

    expect(beregnetKravLinje).toBe(
      `1/3 x (${formatCurrencyFromOre(loenTotalOre)} - ${formatCurrencyFromOre(tafTotalOre)}\u00A0kr.) - 25.000,00\u00A0kr. =`
    );
  });

  it('skjuler sektionen "Tidligere betalt erstatning" når tidligere modtaget TAF ikke er indtastet', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.tidligereModtagetTaf = undefined;

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).not.toContain('Tidligere betalt erstatning');
    expect(texts).not.toContain('Der er allerede betalt tabt arbejdsfortjeneste for perioden med');
  });

  it('viser kun "kr." på sidste led i TAF-regnestykket før lighedstegnet', () => {
    const { stamdata, eo } = buildBaseInput();

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    const regnestykkeLinje = texts.find((text) => /^[\d.]+,\d{2} - [\d.]+,\d{2}/.test(text) && text.includes(' =') && text.includes('kr.'));
    expect(regnestykkeLinje).toBeDefined();
    expect(regnestykkeLinje).not.toContain('kr. -');
    expect(regnestykkeLinje).toMatch(/ - [\d.]+,\d{2}\s*kr\. =/);
    const krForekomsterFoerLigmed = (regnestykkeLinje ?? '').split('=')[0]?.match(/kr\./g)?.length ?? 0;
    expect(krForekomsterFoerLigmed).toBe(1);
  });

  it('viser ikke ansættelsesforhold-subtotal når et ansættelsesforhold kun har én lønudviklingslinje', () => {
    const { stamdata, eo } = buildBaseInput();
    stamdata.skadedato = iso('2023-07-01');
    eo.vedroererPeriodeFra = iso('2023-07-01');
    eo.vedroererPeriodeTil = iso('2025-12-21');
    eo.tafBeregningsperiodeFra = iso('2023-07-01');
    eo.tafBeregningsperiodeTil = iso('2023-07-31');
    eo.tafPerioder = [{ id: 'taf-1', fra: iso('2023-07-01'), til: iso('2025-12-21'), loseFeriedage: undefined }];
    eo.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        navnPaaArbejdssted: 'Tandlægerne Toft og Vedsted',
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        overenskomstId: 'bygge-anlaeg',
        feriePct: 12.5,
        loenPaaHelligdage: 'Almindelig løn',
        indtaegtsoplysningerTableData: [
          {
            id: 'af-1-row-1',
            col0_maaned: '7',
            col1_maaned: '2023',
            col0_uge: '',
            col1_uge: '',
            col0_dag: '',
            col1_dag: '',
            col2: asAmountValue(31829.38),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
      }),
      createEmployment({
        id: 'af-2',
        navnPaaArbejdssted: 'Nillers Nisseforretning',
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [
          {
            id: 'af-2-row-1',
            col0_maaned: '7',
            col1_maaned: '2023',
            col0_uge: '',
            col1_uge: '',
            col0_dag: '',
            col1_dag: '',
            col2: asAmountValue(32642.83),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
      }),
    ];

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);
    const loenudviklingBlock = getTextsBetween(
      texts,
      'Indkomst, hvis skaden ikke var indtrådt',
      'Indtægter i erstatningsperioden'
    );

    const nillersHeaderIndex = loenudviklingBlock.indexOf('Nillers Nisseforretning');
    expect(nillersHeaderIndex).toBeGreaterThanOrEqual(0);

    expect(loenudviklingBlock.filter((text) => text === 'I alt').length).toBe(2);
  });

  it('formaterer hypotetiske offentlige ydelser med ydelses-subtotaler i indkomst uden skade', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.vedroererPeriodeFra = iso('2024-12-01');
    eo.vedroererPeriodeTil = iso('2025-01-31');
    eo.tafBeregningsperiodeFra = iso('2024-12-01');
    eo.tafBeregningsperiodeTil = iso('2024-12-31');
    eo.tafPerioder = [{ id: 'taf-1', fra: iso('2024-12-01'), til: iso('2025-01-31'), loseFeriedage: undefined }];
    eo.regulerOffentligeYdelser = 'Ja';
    eo.offentligeYdelserRows = [
      {
        id: 'oy-1',
        fraDato: toISODateString('2024-12-01'),
        tilDato: toISODateString('2024-12-31'),
        ydelsestype: 'dagpenge',
        ydelse: asAmountValue(1000),
        tillaeg: undefined,
      },
      {
        id: 'oy-2',
        fraDato: toISODateString('2024-12-01'),
        tilDato: toISODateString('2024-12-31'),
        ydelsestype: 'sygedagpenge',
        ydelse: asAmountValue(500),
        tillaeg: undefined,
      },
    ];

    renderPdf(stamdata, eo);

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    const loenudviklingBlock = getTextsBetween(
      texts,
      'Indkomst, hvis skaden ikke var indtrådt',
      'Indtægter i erstatningsperioden'
    );

    expect(loenudviklingBlock).toContain('Opgøres på baggrund af lønnen opgjort frem til 31. december 2024.');
    expect(loenudviklingBlock).toContain('Offentlige ydelser beregnes per 31. december 2024 med statslig regulering per 1. januar.');
    expect(loenudviklingBlock).toContain('Dagpenge');
    expect(loenudviklingBlock).toContain('Sygedagpenge');
    expect(loenudviklingBlock.some((text) => text.includes('ydelse pr. arbejdsdag'))).toBe(false);
    expect(loenudviklingBlock.some((text) => text.includes('ydelse pr. måned'))).toBe(false);
    expect(loenudviklingBlock).toContain('I alt Dagpenge');
    expect(loenudviklingBlock).toContain('I alt Sygedagpenge');
    expect(loenudviklingBlock).toContain('Samlet offentlige ydelser (hypotetisk)');
    expect(loenudviklingBlock.filter((text) => /^I alt \d/.test(text))).toHaveLength(0);
    expect(loenudviklingBlock.filter((text) => text === 'I alt')).toHaveLength(0);
  });

  it('formaterer bilaget for regulering af offentlige ydelser med periode, skadelidte og segmenttotaler', () => {
    const { stamdata, eo } = buildBaseInput();
    stamdata.skadelidte = 'Testi Testesen';
    eo.vedroererPeriodeFra = iso('2024-12-01');
    eo.vedroererPeriodeTil = iso('2025-01-31');
    eo.tafBeregningsperiodeFra = iso('2024-12-01');
    eo.tafBeregningsperiodeTil = iso('2024-12-31');
    eo.tafPerioder = [{ id: 'taf-1', fra: iso('2024-12-01'), til: iso('2025-01-31'), loseFeriedage: undefined }];
    eo.regulerOffentligeYdelser = 'Ja';
    eo.offentligeYdelserRows = [
      {
        id: 'oy-1',
        fraDato: toISODateString('2024-12-01'),
        tilDato: toISODateString('2024-12-31'),
        ydelsestype: 'dagpenge',
        ydelse: asAmountValue(1000),
        tillaeg: undefined,
      },
      {
        id: 'oy-2',
        fraDato: toISODateString('2024-12-01'),
        tilDato: toISODateString('2024-12-31'),
        ydelsestype: 'sygedagpenge',
        ydelse: asAmountValue(500),
        tillaeg: undefined,
      },
    ];

    renderPdfWithSelected(stamdata, eo, {
      ...selected,
      regulering: true,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    const bilagStartIndex = texts.indexOf('Regulering af offentlige ydelser');
    const bilagBlock = bilagStartIndex === -1 ? [] : texts.slice(bilagStartIndex + 1);

    expect(bilagBlock).toContain('Regulering foretages med afsæt i værdier den');
    expect(bilagBlock).toContain('31-12-2024');
    expect(bilagBlock).toContain('Periode');
    expect(bilagBlock).toContain('01-12-2024 - 31-01-2025');
    expect(bilagBlock).toContain('Skadelidte');
    expect(bilagBlock).toContain('Testi Testesen');
    expect(bilagBlock).toContain('Dagpenge');
    expect(bilagBlock).toContain('Sygedagpenge');
    expect(bilagBlock.some((text) => text.includes('regulering fra'))).toBe(false);
    expect(bilagBlock).toContain('I alt Dagpenge');
    expect(bilagBlock).toContain('I alt Sygedagpenge');
    expect(bilagBlock).toContain('Samlet offentlige ydelser (hypotetisk)');
    expect(bilagBlock).toContain(
      'Offentlige ydelser fremskrives årligt per 1. januar med tilpasningsprocenten + 2 %, svarende til den almene statslige regulering af offentlige ydelser.'
    );
  });

  it('viser forbeholdstekst i "Øvrige krav" ved kontanthjælp i indtægter i erstatningsperioden', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.offentligeYdelserRows = [
      {
        id: 'oy-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'kontanthjaelp',
        ydelse: asAmountValue(5000),
        tillaeg: undefined,
      },
    ];

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain(
      'Skadelidte har modtaget kontanthjælp i erstatningsperioden. Kræves ydelsen tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.'
    );
    expect(hasTextAfterHeader(texts, 'Øvrige krav', 'Ingen')).toBe(false);
  });

  it('viser sygeferiegodtgørelse som særskilt indtægt og fradrag i beregnet TAF-krav', () => {
    const { stamdata, eo } = buildBaseInput();
    stamdata.skadedato = iso('2025-01-06');
    eo.vedroererPeriodeFra = iso('2025-01-06');
    eo.vedroererPeriodeTil = iso('2025-01-10');
    eo.tafPerioder = [{ id: 'taf-1', fra: iso('2025-01-06'), til: iso('2025-01-10'), loseFeriedage: undefined }];
    eo.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        navnPaaArbejdssted: 'AAB',
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [
          {
            id: 'row-1',
            col0_maaned: '1',
            col1_maaned: '2025',
            col0_uge: '',
            col1_uge: '',
            col0_dag: '',
            col1_dag: '',
            col2: asAmountValue(10000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
      }),
    ];
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmountValue(100),
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const model = buildProjectedDocument(stamdata, eo);
    const loenudviklingTotal = model.tabtArbejdsfortjeneste.loenudvikling?.loenudviklingTotal;
    const tafIndtaegterTotal = model.tabtArbejdsfortjeneste.tafIndtaegter?.total;
    const sygeferiegodtgoerelseOre = model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.totalOre;

    expect(sygeferiegodtgoerelseOre).toBe(40000);
    expect(loenudviklingTotal?.status).toBe('ok');
    expect(tafIndtaegterTotal?.status).toBe('ok');
    if (loenudviklingTotal?.status !== 'ok' || tafIndtaegterTotal?.status !== 'ok') {
      throw new Error('Forventede beregnelige TAF-totaler i EO-PDF-test');
    }

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain('Sygeferiegodtgørelse');
    expect(texts.some((text) => text.includes(formatCurrencyFromOre(sygeferiegodtgoerelseOre)))).toBe(true);
    expect(texts).toContain(
      `${formatCurrencyFromOre(loenudviklingTotal.value)} - ${formatCurrencyFromOre(tafIndtaegterTotal.value + sygeferiegodtgoerelseOre)}\u00A0kr. =`
    );
  });

  it('skjuler sygeferiegodtgørelse i EO-pdf når alle relevante ansættelsesforhold står til Ingen', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Ingen',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const model = buildProjectedDocument(stamdata, eo);
    expect(model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold).toEqual([]);

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);
    const beregnetKravHeaderIndex = texts.indexOf('Beregnet krav på tabt arbejdsfortjeneste');
    const beregnetKravLinje = beregnetKravHeaderIndex === -1 ? null : texts[beregnetKravHeaderIndex + 1];

    expect(texts).not.toContain('Sygeferiegodtgørelse');
    expect(beregnetKravLinje).not.toContain(' - 0,00');
  });

  it('viser ikke bilagssiden for sygeferiegodtgørelse når PDF-elementet er valgt men alle relevante ansættelsesforhold står til Ingen', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Ingen',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    renderPdfWithSelected(stamdata, eo, {
      ...selected,
      sygeferiegodtgoerelse: true,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).not.toContain('Sygeferiegodtgørelse');
    expect(texts).not.toContain('Beregnes ud fra:');
    expect(texts).not.toContain('Fra-dato | Til-dato | Sats | Antal dage | Feriepengekrav');
  });

  it('viser manuel SFGG-tekst med brugerens "Beløbet er i henhold til"-tekst', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmountValue(100),
      sfggManuelBeloebIHenholdTil: 'kollegas lønoplysninger',
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    renderPdfWithSelected(stamdata, eo, {
      ...selected,
      sygeferiegodtgoerelse: true,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain('Sygeferiegodtgørelse beregnes i henhold til');
    expect(texts).toContain('Kollegas lønoplysninger');
    expect(texts).not.toContain('Beregnes ud fra: Manuelt angivet');
  });

  it('viser referencesats-blok med referenceperiodeoplysninger ved referenceperiodebaseret SFGG', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Ferieloven',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2024-01-01'),
      sfggReferenceperiodeTil: iso('2024-01-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const document = buildProjectedDocument(stamdata, eo);
    const renderValues = structuredClone(eo);
    renderValues.beregnesUdFra = 'Angivet dagsløn';
    renderValues.dagsloenenUdgoer = asAmountValue(1500);

    generateErstatningsopgoerelsePdf(stamdata, renderValues, {
      ...selected,
      sygeferiegodtgoerelse: true,
    }, {
      visUdkastStempel: false,
      document,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain('Referencesats');
    expect(texts).toContain('Opgøres som den gennemsnitlige feriepengebetaling i 4 uger før sygeforløbet.');
    expect(texts).toContain('Referenceperiode');
    expect(texts).toContain('01-01-2024 - 31-01-2024');
    expect(texts).toContain('Lønnen i referenceperioden udgør');
    expect(texts).toContain('01-01-2024 - 31-01-2024');
    expect(texts).not.toContain('Beregningsgrundlag');
    expect(texts).not.toContain('Der beregnes sygeferiegodtgørelse i perioden');
    expect(texts).not.toContain('Der beregnes sygeferiegodtgørelse i TAF-perioden');
    expect(texts).toContain('Periode med sygeferiegodtgørelse');
    expect(texts).toContain('02-01-2024 - 31-01-2024');
    expect(texts.some((text) =>
      text.startsWith('Kravet beregnes per ')
      && text.includes('med referencesatsen')
      && text.endsWith('med referencesatsen.')
    )).toBe(true);
    expect(texts.some((text) =>
      text === 'Der beregnes ikke sygeferiegodtgørelse på SH-dage, under ferie og på andre fraværsdage uden løn. Da skaden er fra 1. januar 2015, er der desuden først krav på sygeferiegodtgørelse fra anden sygedag.'
      || text === 'Der beregnes ikke sygeferiegodtgørelse under ferie og på eventuelle andre fraværsdage uden løn. Da skaden er fra 1. januar 2015, er der desuden først krav på sygeferiegodtgørelse fra anden sygedag.'
      || text === 'Der beregnes ikke sygeferiegodtgørelse på SH-dage, under ferie og på andre fraværsdage uden løn.'
      || text === 'Der beregnes ikke sygeferiegodtgørelse under ferie og på eventuelle andre fraværsdage uden løn.'
    )).toBe(true);
    expect(texts.some((text) => text.includes('Referencesats ('))).toBe(true);
    const lastAutoTableCall = autoTableMock.mock.calls.at(-1);
    const tableBody = lastAutoTableCall?.[1]?.body as Array<Array<{ content: string }>> | undefined;
    expect(tableBody?.[0]?.map((cell) => cell.content)).toEqual([
      'Fra-dato',
      'Til-dato',
      'Feriepenge-sats',
      'AG-pension',
      expect.stringMatching(/^Antal (arbejds|kalender)dage$/),
      'Samlet',
    ]);
    expect(tableBody?.[1]).toHaveLength(6);
    const hasTotalRow = tableBody?.some((row) => row[0]?.content === 'I alt') ?? false;
    expect(hasTotalRow).toBe(false);
    expect(texts).toContain('Beregnet krav');
    expect(texts).toContain('Feriepenge, hvis skaden ikke var sket (+ AG-pension)');
    expect(texts.some((text) => text.startsWith('Feriepenge modtaget i perioden'))).toBe(true);
    expect(texts).toContain('Allerede betalt sygeferiegodtgørelse i perioden');
    expect(texts).toContain('Beregnet sygeferiegodtgørelse');
    expect(texts.every((text) => text !== 'Referencesats: 40,32 kr.')).toBe(true);

    const sfggPeriodeHeadingIndex = texts.findIndex((text) => text === 'Periode med sygeferiegodtgørelse');
    const sfggPeriodeIndex = texts.findIndex((text) => text === '02-01-2024 - 31-01-2024');
    const feriepengeHvisIkkeSkadeIndex = texts.findIndex((text) => text === 'Feriepenge, hvis skaden ikke var sket (+ AG-pension)');
    expect(sfggPeriodeHeadingIndex).toBeGreaterThanOrEqual(0);
    expect(sfggPeriodeIndex).toBe(sfggPeriodeHeadingIndex + 1);
    expect(feriepengeHvisIkkeSkadeIndex).toBeGreaterThan(sfggPeriodeIndex);
  });

  it('viser flere SFGG-perioder som separate linjer', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.tafPerioder = [
      { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-05'), loseFeriedage: undefined },
      { id: 'taf-2', fra: iso('2024-01-10'), til: iso('2024-01-12'), loseFeriedage: undefined },
    ];
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmountValue(100),
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    renderPdfWithSelected(stamdata, eo, {
      ...selected,
      sygeferiegodtgoerelse: true,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    const headingIndex = texts.findIndex((text) => text === 'Perioder med sygeferiegodtgørelse');
    const firstPeriodIndex = texts.findIndex((text, index) =>
      index > headingIndex && text === '01-01-2024 - 05-01-2024'
    );
    const secondPeriodIndex = texts.findIndex((text, index) =>
      index > firstPeriodIndex && text === '10-01-2024 - 12-01-2024'
    );

    expect(headingIndex).toBeGreaterThanOrEqual(0);
    expect(firstPeriodIndex).toBe(headingIndex + 1);
    expect(secondPeriodIndex).toBe(firstPeriodIndex + 1);
    expect(texts).not.toContain('01-01-2024 - 05-01-2024; 10-01-2024 - 12-01-2024');
  });

  it('viser ikke SH-dage i SFGG-referenceperiodeblokken når referenceperioden opgøres på kalenderdage', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Ferieloven',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2024-01-01'),
      sfggReferenceperiodeTil: iso('2024-01-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 1,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const document = buildProjectedDocument(stamdata, eo);
    const renderValues = structuredClone(eo);
    renderValues.beregnesUdFra = 'Angivet månedsløn';

    generateErstatningsopgoerelsePdf(stamdata, renderValues, {
      ...selected,
      sygeferiegodtgoerelse: true,
    }, {
      visUdkastStempel: false,
      document,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    const kalenderdagTekst = texts.find((text) => text.includes('Antal kalenderdage i perioden'));

    expect(texts).toContain('Kravet beregnes per kalenderdag med referencesatsen.');
    expect(texts.some((text) => text.startsWith('Der beregnes ikke sygeferiegodtgørelse under ferie og på eventuelle andre fraværsdage uden løn.'))).toBe(true);
    expect(kalenderdagTekst).toContain('31 kalenderdage - 1 fraværsdage u. løn');
    expect(kalenderdagTekst).not.toContain('SH-dage');
    expect(texts).toContain('30 kalenderdage');
  });

  it('placerer SFGG-ophørslinjen direkte under introen i pdf', () => {
    const { stamdata, eo } = buildBaseInput();
    stamdata.skadedato = iso('2014-01-01');
    eo.beregnesUdFra = 'Angivet dagsløn';
    eo.dagsloenenUdgoer = asAmountValue(1500);
    eo.eoAngivetLoenLoenudvikling.loenPaaHelligdage = 'Almindelig løn';
    eo.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Ingen';
    eo.opgørelseLavetDen = iso('2014-02-01');
    eo.vedroererPeriodeFra = iso('2014-01-01');
    eo.vedroererPeriodeTil = iso('2014-12-31');
    eo.tafBeregningsperiodeFra = iso('2014-01-01');
    eo.tafBeregningsperiodeTil = iso('2014-01-31');
    eo.tafPerioder = [{
      id: 'taf-1',
      fra: iso('2014-01-01'),
      til: iso('2014-12-31'),
      loseFeriedage: undefined,
    }];
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmountValue(100),
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    renderPdfWithSelected(stamdata, eo, {
      ...selected,
      sygeferiegodtgoerelse: true,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    const introIndex = texts.findIndex((text) => text === 'Sygeferiegodtgørelse beregnes på baggrund af en manuelt angivet sats.');
    const ophoerLabelIndex = texts.findIndex((text) => text === 'Skaden er før 01-01-2015 og retten er begrænset til 4 måneder, som ophørte');
    const ophoerDatoIndex = texts.findIndex((text) => text === '30-04-2014');
    const feriepengeHvisIkkeSkadeIndex = texts.findIndex((text) => text === 'Feriepenge, hvis skaden ikke var sket (+ AG-pension)');
    const kravIndex = texts.findIndex((text) => text.startsWith('Kravet beregnes per '));

    const referencesatsenUdgoerIndex = texts.findIndex((text) => text === 'Referencesatsen udgør');

    expect(introIndex).toBeGreaterThanOrEqual(0);
    // Referencesatsen udgør vises umiddelbart efter intro (to entries: label + værdi)
    expect(referencesatsenUdgoerIndex).toBe(introIndex + 1);
    // Ophørslinjen kommer efter referencesats-blokken (label + værdi = 2 entries)
    expect(ophoerLabelIndex).toBeGreaterThan(referencesatsenUdgoerIndex + 1);
    expect(ophoerDatoIndex).toBe(ophoerLabelIndex + 1);
    expect(feriepengeHvisIkkeSkadeIndex).toBeGreaterThan(ophoerDatoIndex);
    expect(kravIndex).toBe(feriepengeHvisIkkeSkadeIndex + 1);
  });

  it('viser ikke længere SFGG-periodelabel når beregningen afkortes ved ansættelsesophør', () => {
    const { stamdata, eo } = buildBaseInput();
    stamdata.skadedato = iso('2012-05-01');
    eo.eoNummer = '2';
    eo.vedroererPeriodeFra = iso('2012-05-01');
    eo.vedroererPeriodeTil = iso('2012-10-31');
    eo.tafBeregningsperiodeFra = iso('2012-05-01');
    eo.tafBeregningsperiodeTil = iso('2012-05-31');
    eo.tafPerioder = [{ id: 'taf-1', fra: iso('2012-05-01'), til: iso('2012-10-31'), loseFeriedage: undefined }];
    eo.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        navnPaaArbejdssted: 'Viggos Værksted',
        ansaettelsesforholdOphoert: true,
        sidsteArbejdsdag: iso('2012-07-15'),
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [
          {
            id: 'row-1',
            col0_maaned: '5',
            col1_maaned: '2012',
            col0_uge: '',
            col1_uge: '',
            col0_dag: '',
            col1_dag: '',
            col2: asAmountValue(10000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
      }),
    ];
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmountValue(100),
      sfggManuelBeloebIHenholdTil: 'Bygge-/anlægsoverenskomsten',
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    renderPdfWithSelected(stamdata, eo, {
      ...selected,
      sygeferiegodtgoerelse: true,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    expect(texts).not.toContain('Beregningsgrundlag');
    expect(texts).not.toContain('Der beregnes sygeferiegodtgørelse i perioden');
    expect(texts).not.toContain('Der beregnes sygeferiegodtgørelse i TAF-perioden');
  });

  it('viser ikke SFGG-referenceperiode på SH-dage-siden når aktuelt SFGG-grundlag ikke er referenceperiode, selv om dokumentet indeholder gammel referenceperiode', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-29'), til: iso('2025-01-31'), loseFeriedage: undefined }];
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Ferieloven',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2023-12-01'),
      sfggReferenceperiodeTil: iso('2023-12-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const document = buildProjectedDocument(stamdata, eo);
    const renderValues = structuredClone(eo);
    renderValues.loenindkomstAnsaettelsesforhold[0] = createEmployment({
      id: 'af-1',
      navnPaaArbejdssted: 'Byggearbejde',
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      loenPaaHelligdage: 'Almindelig løn',
      indtaegtsoplysningerTableData: [
        {
          id: 'row-1',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmountValue(10000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
    });
    renderValues.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Overenskomst',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2023-12-01'),
      sfggReferenceperiodeTil: iso('2023-12-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: 'Ufaglaert-Koebenhavn',
      sfggAlleredeBetaltBeloeb: asAmountValue(1234.56),
    }];

    generateErstatningsopgoerelsePdf(stamdata, renderValues, {
      ...selected,
      shDage: true,
    }, {
      visUdkastStempel: false,
      document,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain('SH-dage');
    expect(texts).not.toContain('SFGG-referenceperiode');
  });

  it('viser overenskomstens navn og ferielovsnote for overenskomster der følger ferieloven', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.loenindkomstAnsaettelsesforhold[0] = createEmployment({
      id: 'af-1',
      navnPaaArbejdssted: 'KL-arbejdssted',
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      loenudviklingBeregningsgrundlag: 'Ingen',
      indtaegtsoplysningerTableData: [
        {
          id: 'row-1',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmountValue(10000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
    });
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Overenskomst',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2024-01-01'),
      sfggReferenceperiodeTil: iso('2024-01-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    renderPdfWithSelected(stamdata, eo, {
      ...selected,
      sygeferiegodtgoerelse: true,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain('Sygeferiegodtgørelse beregnes i henhold til');
    expect(texts).toContain('KL-overenskomsten, der følger ferielovens regler');
    expect(texts).toContain('Opgøres som den gennemsnitlige feriepengebetaling i 4 uger før sygeforløbet.');
    expect(texts).toContain('Kravet beregnes per kalenderdag med referencesatsen.');
  });

  it('viser ikke fallback-sats for differentieret overenskomst når der ikke findes beregnede segmenter', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.loenindkomstAnsaettelsesforhold[0] = createEmployment({
      id: 'af-1',
      navnPaaArbejdssted: 'BKL',
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenudviklingBeregningsgrundlag: 'Ingen',
      loenPaaHelligdage: 'Almindelig løn',
      indtaegtsoplysningerTableData: [
        {
          id: 'row-1',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmountValue(10000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
    });
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Overenskomst',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: 'Faglaert-Koebenhavn',
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    renderPdfWithSelected(stamdata, eo, {
      ...selected,
      sygeferiegodtgoerelse: true,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).not.toContain('Referencesats');
    expect(texts.some((text) => text.includes('207,90'))).toBe(false);
    expect(texts).not.toContain('Referencesats: 207,90 kr.');
  });

  it('viser ikke SFGG-kolonner i reguleringsbilaget for differentieret overenskomst', () => {
    autoTableMock.mockClear();
    const { stamdata, eo } = buildBaseInput();
    const document = buildProjectedDocument(stamdata, eo);
    const renderValues = structuredClone(eo);
    renderValues.vedroererPeriodeTil = iso('2025-02-01');
    renderValues.tafBeregningsperiodeTil = iso('2025-02-01');
    renderValues.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-26'), til: iso('2025-02-01'), loseFeriedage: undefined }];
    renderValues.loenindkomstAnsaettelsesforhold[0] = createEmployment({
      id: 'af-1',
      navnPaaArbejdssted: 'Byggearbejde',
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      loenPaaHelligdage: 'SH-udbetaling',
      feriePct: 16.95,
      indtaegtsoplysningerTableData: [
        {
          id: 'row-1',
          col0_maaned: '',
          col1_maaned: '',
          col0_uge: '4',
          col1_uge: '2024',
          col0_dag: '',
          col1_dag: '',
          col2: asAmountValue(10000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
    });
    renderValues.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Overenskomst',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: 'Ufaglaert-Koebenhavn',
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    generateErstatningsopgoerelsePdf(stamdata, renderValues, {
      opgoerelse: true,
      loenindkomst: false,
      offentligeYdelser: false,
      shDage: false,
      regulering: true,
      okSatser: false,
      sygeferiegodtgoerelse: false,
    }, {
      visUdkastStempel: false,
      document,
    });

    const firstTableCall = autoTableMock.mock.calls[0]?.[1];
    const headerRow = firstTableCall?.body?.[0];
    expect(headerRow?.map((cell: { content: string }) => cell.content).filter((content) => content.includes('SFGG'))).toEqual([]);
  });

  it('viser manuel sats i referencesats-blokken ved beregningsperiode', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmountValue(123.45),
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    renderPdfWithSelected(stamdata, eo, {
      ...selected,
      sygeferiegodtgoerelse: true,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).not.toContain('Referencesats');
    expect(texts).toContain('Referencesatsen udgør');
    expect(texts).not.toContain('Referencesats: 123,45 kr.');
  });

  it('viser kun SFGG-ansættelser der ikke står til Ingen', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        navnPaaArbejdssted: 'Hårup Ungdomsklub',
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [
          {
            id: 'row-1',
            col0_maaned: '1',
            col1_maaned: '2024',
            col0_uge: '',
            col1_uge: '',
            col0_dag: '',
            col1_dag: '',
            col2: asAmountValue(10000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
      }),
      createEmployment({
        id: 'af-2',
        navnPaaArbejdssted: 'Skjult arbejdssted',
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [
          {
            id: 'row-2',
            col0_maaned: '1',
            col1_maaned: '2024',
            col0_uge: '',
            col1_uge: '',
            col0_dag: '',
            col1_dag: '',
            col2: asAmountValue(5000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
      }),
    ];
    eo.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: asAmountValue(100),
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      },
      {
        ansaettelsesforholdId: 'af-2',
        sfggBeregningskilde: 'Ingen',
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      },
    ];

    renderPdfWithSelected(stamdata, eo, {
      ...selected,
      sygeferiegodtgoerelse: true,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    const sfggSectionTexts = texts.slice(Math.max(0, texts.indexOf('Sygeferiegodtgørelse')));

    expect(sfggSectionTexts).toContain('Hårup Ungdomsklub');
    expect(sfggSectionTexts).not.toContain('Skjult arbejdssted');
  });

  it('viser arbejdsdags-SFGG med kalenderdagsstart efter årsskifte i pdf-tabellen når 1. januar ikke er arbejdsdag', () => {
    autoTableMock.mockClear();
    const { stamdata, eo } = buildBaseInput();
    eo.eoNummer = '2';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.vedroererPeriodeFra = iso('2024-12-30');
    eo.vedroererPeriodeTil = iso('2025-01-03');
    eo.tafBeregningsperiodeFra = iso('2024-12-01');
    eo.tafBeregningsperiodeTil = iso('2024-12-31');
    eo.tafPerioder = [{ id: 'taf-1', fra: iso('2024-12-30'), til: iso('2025-01-03'), loseFeriedage: undefined }];
    eo.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        navnPaaArbejdssted: 'Byggearbejde',
        harOverenskomst: true,
        overenskomstId: 'bygge-anlaeg',
        feriePct: 12.5,
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        loenPaaHelligdage: 'Almindelig løn',
        indtaegtsoplysningerTableData: [
          {
            id: 'row-1',
            col0_maaned: '12',
            col1_maaned: '2024',
            col0_uge: '',
            col1_uge: '',
            col0_dag: '',
            col1_dag: '',
            col2: asAmountValue(10000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
      }),
    ];
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Overenskomst',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: 'Ufaglaert-Koebenhavn',
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    renderPdfWithSelected(stamdata, eo, {
      ...selected,
      sygeferiegodtgoerelse: true,
    });

    const sfggTableCall = autoTableMock.mock.calls
      .map((call) => call[1])
      .find((options: { body?: Array<Array<{ content: string }>> }) =>
        options.body?.[0]?.some((cell) => cell.content === 'Fra-dato')
      );
    const sfggRows = sfggTableCall?.body?.map((row: Array<{ content: string }>) => row.map((cell) => cell.content)) ?? [];

    expect(sfggRows).toContainEqual(['Fra-dato', 'Til-dato', 'Feriepenge-sats', 'AG-pension', 'Antal arbejdsdage', 'Samlet']);
    expect(sfggRows).toContainEqual(['01-01-2025', '03-01-2025', '191,40', '+ 10,15 %', '2', '421,65']);
    expect(sfggRows).not.toContainEqual(['02-01-2025', '03-01-2025', '191,40', '+ 10,15 %', '2', '421,65']);
  });

  it('viser overenskomstforklaring om sygeløn i pdf for overenskomster med bortfald under sygeløn', () => {
    autoTableMock.mockClear();
    const { stamdata, eo } = buildBaseInput();
    eo.eoNummer = '2';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.vedroererPeriodeFra = iso('2024-01-29');
    eo.vedroererPeriodeTil = iso('2024-02-06');
    eo.tafBeregningsperiodeFra = iso('2024-01-01');
    eo.tafBeregningsperiodeTil = iso('2024-01-31');
    eo.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-29'), til: iso('2024-02-06'), loseFeriedage: undefined }];
    eo.ferieperioder = [{ id: 'ferie-1', fra: iso('2024-02-01'), til: iso('2024-02-02') }];
    eo.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        navnPaaArbejdssted: 'Byggearbejde',
        harOverenskomst: true,
        overenskomstId: 'bygge-anlaeg',
        feriePct: 12.5,
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        loenPaaHelligdage: 'Almindelig løn',
        indtaegtsoplysningerTableData: [
          {
            id: 'row-1',
            col0_maaned: '1',
            col1_maaned: '2024',
            col0_uge: '',
            col1_uge: '',
            col0_dag: '',
            col1_dag: '',
            col2: asAmountValue(10000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
      }),
    ];
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Overenskomst',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: 'Ufaglaert-Koebenhavn',
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    renderPdfWithSelected(stamdata, eo, {
      ...selected,
      sygeferiegodtgoerelse: true,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    expect(texts).toContain('I medfør af overenskomsten beregnes ikke sygeferiegodtgørelse på dage, hvor der betales sygeløn.');

    const sfggTableCall = autoTableMock.mock.calls
      .map((call) => call[1])
      .find((options: { body?: Array<Array<{ content: string }>> }) =>
        options.body?.[0]?.some((cell) => cell.content === 'Fra-dato')
      );
    const sfggRows = sfggTableCall?.body?.map((row: Array<{ content: string }>) => row.map((cell) => cell.content)) ?? [];

    expect(sfggRows).toContainEqual(['03-02-2024', '06-02-2024', '184,45', '+ 10,15 %', '2', '406,34']);
  });

  it('viser "Beregnet krav" med forklaring når hele SFGG-perioden bortfalder på grund af sygeløn', () => {
    autoTableMock.mockClear();
    const { stamdata, eo } = buildBaseInput();
    stamdata.skadedato = iso('2025-01-01');
    eo.eoNummer = '2';
    eo.vedroererPeriodeFra = iso('2025-01-01');
    eo.vedroererPeriodeTil = iso('2025-01-31');
    eo.tafPerioder = [{ id: 'taf-1', fra: iso('2025-01-01'), til: iso('2025-01-31'), loseFeriedage: undefined }];
    eo.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        navnPaaArbejdssted: 'AAB',
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [
          {
            id: 'row-1',
            col0_maaned: '1',
            col1_maaned: '2025',
            col0_uge: '',
            col1_uge: '',
            col0_dag: '',
            col1_dag: '',
            col2: asAmountValue(10000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
      }),
    ];
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmountValue(100),
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Ja',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    renderPdfWithSelected(stamdata, eo, {
      ...selected,
      sygeferiegodtgoerelse: true,
    });

    const texts = collectTextStrings(MockJsPDF.lastInstance);
    expect(texts).not.toContain('Beregningsgrundlag');
    expect(texts).not.toContain('Der beregnes sygeferiegodtgørelse i perioden');
    expect(texts).not.toContain('Der beregnes sygeferiegodtgørelse i TAF-perioden');
    expect(texts).toContain('Perioder med sygeferiegodtgørelse');
    expect(texts).toContain('Ingen');
    expect(texts).toContain('Beregnet krav');
    expect(texts).toContain('Der er betalt sygeløn i hele perioden og derfor ikke krav på sygeferiegodtgørelse.');

    const sfggPeriodeHeadingIndex = texts.findIndex((text) => text === 'Perioder med sygeferiegodtgørelse');
    const ingenIndex = texts.findIndex((text, index) => index > sfggPeriodeHeadingIndex && text === 'Ingen');
    const feriepengeHvisIkkeSkadeIndex = texts.findIndex((text) => text === 'Feriepenge, hvis skaden ikke var sket (+ AG-pension)');
    expect(sfggPeriodeHeadingIndex).toBeGreaterThanOrEqual(0);
    expect(ingenIndex).toBe(sfggPeriodeHeadingIndex + 1);
    expect(feriepengeHvisIkkeSkadeIndex).toBeGreaterThan(ingenIndex);

    const sfggTableCall = autoTableMock.mock.calls
      .map((call) => call[1])
      .find((options: { body?: Array<Array<{ content: string }>> }) =>
        options.body?.[0]?.some((cell) => cell.content === 'Fra-dato')
      );
    expect(sfggTableCall).toBeUndefined();
  });

  it('splitter arbejdsdags-SFGG-tabellen ved daterede feriedage i pdf', () => {
    autoTableMock.mockClear();
    const { stamdata, eo } = buildBaseInput();
    eo.eoNummer = '2';
    eo.beregnesUdFra = 'Beregningsperiode';
    eo.vedroererPeriodeFra = iso('2024-01-29');
    eo.vedroererPeriodeTil = iso('2024-02-06');
    eo.tafBeregningsperiodeFra = iso('2024-01-01');
    eo.tafBeregningsperiodeTil = iso('2024-01-31');
    eo.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-29'), til: iso('2024-02-06'), loseFeriedage: undefined }];
    eo.ferieperioder = [{ id: 'ferie-1', fra: iso('2024-02-01'), til: iso('2024-02-02') }];
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmountValue(100),
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    renderPdfWithSelected(stamdata, eo, {
      ...selected,
      sygeferiegodtgoerelse: true,
    });

    const sfggTableCall = autoTableMock.mock.calls
      .map((call) => call[1])
      .find((options: { body?: Array<Array<{ content: string }>> }) =>
        options.body?.[0]?.some((cell) => cell.content === 'Fra-dato')
      );
    const sfggRows = sfggTableCall?.body?.map((row: Array<{ content: string }>) => row.map((cell) => cell.content)) ?? [];

    expect(sfggRows).toContainEqual(['29-01-2024', '31-01-2024', '100', '+ 0 %', '3', '300']);
    expect(sfggRows).toContainEqual(['03-02-2024', '06-02-2024', '100', '+ 0 %', '2', '200']);
  });

  it('viser sygeferiegodtgørelse med 0 kr. i indtægter men udelader 0-fradrag i TAF-mellemregningen', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.eoNummer = '2';
    eo.vedroererPeriodeFra = iso('2024-01-29');
    eo.vedroererPeriodeTil = iso('2024-01-29');
    eo.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-29'), til: iso('2024-01-29'), loseFeriedage: undefined }];
    eo.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmountValue(100),
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: asAmountValue(1000),
    }];

    const model = buildProjectedDocument(stamdata, eo);
    expect(model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold).toHaveLength(1);
    expect(model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.totalOre).toBe(0);

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);
    const beregnetKravHeaderIndex = texts.indexOf('Beregnet krav på tabt arbejdsfortjeneste');
    const beregnetKravLinje = beregnetKravHeaderIndex === -1 ? null : texts[beregnetKravHeaderIndex + 1];

    expect(texts).toContain('Sygeferiegodtgørelse');
    expect(texts.some((text) => text.includes('0,00'))).toBe(true);
    expect(beregnetKravLinje).toBe(`${formatCurrencyFromOre(model.tabtArbejdsfortjeneste.loenudvikling?.loenudviklingTotal.status === 'ok' ? model.tabtArbejdsfortjeneste.loenudvikling.loenudviklingTotal.value : 0)} - ${formatCurrencyFromOre(model.tabtArbejdsfortjeneste.tafIndtaegter?.total.status === 'ok' ? model.tabtArbejdsfortjeneste.tafIndtaegter.total.value : 0)}\u00A0kr. =`);
    expect(beregnetKravLinje).not.toContain(' - 0,00');
  });

  it('viser begge ydelser adskilt med "og" i forbeholdsteksten', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.offentligeYdelserRows = [
      {
        id: 'oy-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'kontanthjaelp',
        ydelse: asAmountValue(3000),
        tillaeg: undefined,
      },
      {
        id: 'oy-2',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'ressourceforloebsydelse',
        ydelse: asAmountValue(2000),
        tillaeg: undefined,
      },
    ];

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain(
      'Skadelidte har modtaget kontanthjælp og ressourceforløbsydelse i erstatningsperioden. Kræves ydelserne tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.'
    );
  });

  it('viser både forbeholdstekst og brugerindtastede øvrige krav', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.offentligeYdelserRows = [
      {
        id: 'oy-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'kontanthjaelp',
        ydelse: asAmountValue(5000),
        tillaeg: undefined,
      },
    ];
    eo.oevrigeKravPerioder = [
      {
        id: 'krav-1',
        dato: iso('2024-01-15'),
        udgiftTil: 'Transport',
        beloeb: asAmountValue(1200),
      },
    ];

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain(
      'Skadelidte har modtaget kontanthjælp i erstatningsperioden. Kræves ydelsen tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.'
    );
    expect(texts).toContain('15-01-2024: Transport');

    const forbeholdY = findTextY(
      MockJsPDF.lastInstance,
      'Skadelidte har modtaget kontanthjælp i erstatningsperioden. Kræves ydelsen tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.'
    );
    const kravY = findTextY(MockJsPDF.lastInstance, '15-01-2024: Transport');
    expect(forbeholdY).not.toBeNull();
    expect(kravY).not.toBeNull();
    expect((kravY as number) - (forbeholdY as number)).toBeGreaterThanOrEqual(MIN_AFSTAND_MED_TOM_LINJE);
  });

  it('viser klage-reguleringslinje i "Øvrige krav" ved midlertidig EET med verserende klage', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.offentligeYdelserRows = [
      {
        id: 'oy-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'kontanthjaelp',
        ydelse: asAmountValue(5000),
        tillaeg: undefined,
      },
    ];
    eo.midlertidigtEETAfgorelse = 'Ja';
    eo.midlertidigEETVirkningsdato = iso('2024-02-01');
    eo.verserendeKlageEet = 'Ja';
    eo.oevrigeKravPerioder = [
      {
        id: 'krav-1',
        dato: iso('2024-01-15'),
        udgiftTil: 'Transport',
        beloeb: asAmountValue(1200),
      },
    ];

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain(EET_KLAGE_REGULERINGSLINJE);
  });

  it('viser klage-reguleringslinje i "Øvrige krav" også uden ydelsesforbehold', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.endeligtEETAfgorelse = 'Ja';
    eo.endeligEETVirkningsdato = iso('2024-03-01');
    eo.verserendeKlageEet = 'Ja';

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain(EET_KLAGE_REGULERINGSLINJE);
    expect(hasTextAfterHeader(texts, 'Øvrige krav', 'Ingen')).toBe(false);
  });

  it('placerer klage-reguleringslinje mellem ydelsesforbehold og øvrige krav med én linjeafstand', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.offentligeYdelserRows = [
      {
        id: 'oy-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'kontanthjaelp',
        ydelse: asAmountValue(5000),
        tillaeg: undefined,
      },
    ];
    eo.endeligtEETAfgorelse = 'Ja';
    eo.endeligEETVirkningsdato = iso('2024-03-01');
    eo.verserendeKlageEet = 'Ja';
    eo.oevrigeKravPerioder = [
      {
        id: 'krav-1',
        dato: iso('2024-01-15'),
        udgiftTil: 'Transport',
        beloeb: asAmountValue(1200),
      },
    ];

    renderPdf(stamdata, eo);
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    const ydelsesforbehold =
      'Skadelidte har modtaget kontanthjælp i erstatningsperioden. Kræves ydelsen tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.';
    const kravLinje = '15-01-2024: Transport';
    const forbeholdIndex = texts.indexOf(ydelsesforbehold);
    const klageIndex = texts.indexOf(EET_KLAGE_REGULERINGSLINJE);
    const kravIndex = texts.indexOf(kravLinje);
    expect(forbeholdIndex).toBeGreaterThanOrEqual(0);
    expect(klageIndex).toBeGreaterThan(forbeholdIndex);
    expect(kravIndex).toBeGreaterThan(klageIndex);

    const forbeholdY = findTextY(MockJsPDF.lastInstance, ydelsesforbehold);
    const klageY = findTextY(MockJsPDF.lastInstance, EET_KLAGE_REGULERINGSLINJE);
    const kravY = findTextY(MockJsPDF.lastInstance, kravLinje);
    expect(forbeholdY).not.toBeNull();
    expect(klageY).not.toBeNull();
    expect(kravY).not.toBeNull();
    const afstandForbeholdTilKlage = (klageY as number) - (forbeholdY as number);
    const afstandKlageTilKrav = (kravY as number) - (klageY as number);
    expect(afstandForbeholdTilKlage).toBe(afstandKlageTilKrav);
    expect(afstandForbeholdTilKlage).toBeGreaterThanOrEqual(MIN_AFSTAND_MED_TOM_LINJE - 0.001);
  });
});
