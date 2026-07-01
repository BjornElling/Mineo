// @vitest-environment jsdom
import { renderReguleringSection } from '../../../../../document/generators/eo/sections/reguleringSection';
import { ILON12_DISCONTINUED_NOTE } from '../../../../../document/generators/eo/reguleringNotes';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../../../domain/stamdata/stamdataInitialValues';
import { PDF_CONTENT_WIDTH_MM } from '../../../../../document/layout/pdfConfig';
import { resolveDynamicRightAlignedInset } from '../../../../../document/layout/documentTableRenderer';
import { toISODateString } from '../../../../../types/branded';

// Spejler reguleringSection's REGULERINGSVAERDIER_RIGHT_ALIGNED_INSET_MM (maks-insettet for
// Beregnet regulering med synlig Indeksberegnings-kolonne). Konstanten er modul-privat i
// kilden; den dynamiske skalering verificeres relativt til dette maks.
const REGULERINGSVAERDIER_RIGHT_ALIGNED_INSET_MM_FOR_TEST = 8;

type ReguleringSectionContext = Parameters<typeof renderReguleringSection>[0];
type MutableReguleringSectionContext = {
  -readonly [K in keyof ReguleringSectionContext]: ReguleringSectionContext[K];
};
type AutoTableTestOptions = {
  startY?: number;
  body?: Array<Array<{ content: string; styles?: { halign?: string } }>>;
  columnStyles?: Record<number, { cellWidth?: number; halign?: string }>;
  didParseCell?: (data: { cell: { styles: { halign?: string; cellPadding?: unknown } } }) => void;
};

const { autoTableMock } = vi.hoisted(() => ({
  autoTableMock: vi.fn((doc: Record<string, unknown>, options: AutoTableTestOptions) => {
    doc.lastAutoTable = { finalY: (options.startY ?? 0) + 20 };
  }),
}));

vi.mock('jspdf-autotable', () => ({
  default: autoTableMock,
}));

const iso = (value: string) => toISODateString(value);
type Ansaettelsesforhold = ReturnType<typeof createDefaultLoenindkomstAnsaettelsesforhold>;

const createMockPdfDoc = () => ({
  internal: { pageSize: { width: 210, height: 297 } },
  addPage: vi.fn(),
});

const makeContext = (
  eoValues: ReturnType<typeof createErstatningsopgoerelseInitialValues>,
  stamdataValues = STAMDATA_INITIAL_VALUES
) => {
  const startEoBilagPage = vi.fn();
  const renderSubheader = vi.fn();
  const safeAddWrappedText = vi.fn();
  const writeLabelValueLine = vi.fn();

  let y = 0;
  const doc = createMockPdfDoc();

  const ctx = {
    eoValues,
    stamdataValues,
    lineHeight: 4,
    modelLoenudviklingPerAnsaettelse: [],
    modelLoenudviklingGlobaleSegmenter: [],
    startEoBilagPage,
    renderSubheader,
    safeAddWrappedText,
    writeLabelValueLine,
    resolveValgtReguleringDisplay: vi.fn(() => 'Ingen'),
    resolveAnvendtReguleringsdato: vi.fn(() => undefined),
    parseOptionalIsoDate: vi.fn((v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? iso(v) : undefined)),
    resolveLoenSkadedatoText: vi.fn(
      ({ skadedato }: { subject: 'lønnen'; anvendtReguleringsdato: unknown; skadedato: unknown }) =>
        skadedato ? `lønnen på skadestidspunktet (${String(skadedato)})` : 'lønnen'
    ),
    resolveTafDateBounds: vi.fn(() => null),
    buildReguleringsvaerdierTableData: vi.fn(() => null),
    buildReguleringIndexRows: vi.fn(() => []),
    resolveStatistikModelIdFromLabel: vi.fn(() => undefined),
    writer: {
      addSectionSpacer: vi.fn(),
      addSpacer: vi.fn(),
      setY: vi.fn((nextY: number) => { y = nextY; }),
      getY: vi.fn(() => y),
      getDoc: vi.fn(() => doc),
      writeUnderlinedSubheader: vi.fn(),
    },
  } as unknown as MutableReguleringSectionContext;

  return {
    startEoBilagPage,
    renderSubheader,
    safeAddWrappedText,
    writeLabelValueLine,
    ctx,
  };
};

describe('renderReguleringSection – startEoBilagPage', () => {
  it('kalder startEoBilagPage med "Regulering"', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    const { startEoBilagPage, ctx } = makeContext(eoValues);

    renderReguleringSection(ctx);

    expect(startEoBilagPage).toHaveBeenCalledWith('Regulering');
  });
});

describe('renderReguleringSection – ingen ansættelsesforhold', () => {
  it('viser "Ingen ansættelsesforhold" når der ikke er ansættelsesforhold', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);

    renderReguleringSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith('Ingen ansættelsesforhold.');
  });
});

describe('renderReguleringSection – ansættelsesforhold med ingen regulering', () => {
  it('kalder writeLabelValueLine med "Regulering" for hvert ansættelsesforhold', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-1',
        navnPaaArbejdssted: 'Test Arbejdssted',
        loenudviklingBeregningsgrundlag: 'Ingen',
      },
    ];
    const { writeLabelValueLine, ctx } = makeContext(eoValues);

    renderReguleringSection(ctx);

    expect(writeLabelValueLine).toHaveBeenCalledWith('Regulering', expect.any(String));
  });

  it('bruger ansættelsesstedets navn som underoverskrift', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-2',
        navnPaaArbejdssted: 'Kerteminde Kommune',
        loenudviklingBeregningsgrundlag: 'Ingen',
      },
    ];
    const { renderSubheader, ctx } = makeContext(eoValues);

    renderReguleringSection(ctx);

    expect(renderSubheader).toHaveBeenCalledWith('Kerteminde Kommune', undefined, { addTopSpacing: false });
  });

  it('bruger fallback-navn "Ansættelsesforhold 1" når navnPaaArbejdssted er tomt', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-3',
        navnPaaArbejdssted: '',
        loenudviklingBeregningsgrundlag: 'Ingen',
      },
    ];
    const { renderSubheader, ctx } = makeContext(eoValues);

    renderReguleringSection(ctx);

    expect(renderSubheader).toHaveBeenCalledWith('Ansættelsesforhold 1', undefined, { addTopSpacing: false });
  });

  it('skjuler kun underoverskrift for EO-angivet-løn id, ikke for navnet "EO-oplysninger" alene', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'custom-id',
        navnPaaArbejdssted: 'EO-oplysninger',
        loenudviklingBeregningsgrundlag: 'Ingen',
      },
    ];
    const { renderSubheader, ctx } = makeContext(eoValues);

    renderReguleringSection(ctx);

    expect(renderSubheader).toHaveBeenCalledWith('EO-oplysninger', undefined, { addTopSpacing: false });
  });
});

describe('renderReguleringSection – loenSkadedatoText input', () => {
  it('videresender anvendtReguleringsdato fra resolveAnvendtReguleringsdato til resolveLoenSkadedatoText', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-raw-dato',
        navnPaaArbejdssted: 'Test',
        loenudviklingBeregningsgrundlag: 'Ingen',
        saerligFraDatoRegulering: undefined,
      },
    ];
    const { ctx } = makeContext(eoValues);
    ctx.resolveAnvendtReguleringsdato = vi.fn(() => iso('2024-01-01'));

    renderReguleringSection(ctx);

    expect(ctx.resolveLoenSkadedatoText).toHaveBeenCalledWith(expect.objectContaining({
      anvendtReguleringsdato: iso('2024-01-01'),
    }));
  });

  it('bruger frem-til-tekst for implicit beregningsperiode-slutdato selv om datoen ligger efter EO-perioden', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.vedroererPeriodeFra = iso('2024-01-01');
    eoValues.vedroererPeriodeTil = iso('2024-01-31');
    eoValues.tafBeregningsperiodeFra = iso('2024-01-01');
    eoValues.tafBeregningsperiodeTil = iso('2024-12-31');
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-beregningsperiode-efter-eo',
        navnPaaArbejdssted: 'Test',
        loenudviklingBeregningsgrundlag: 'Ingen',
        saerligFraDatoRegulering: undefined,
      },
    ];
    const { ctx } = makeContext(eoValues);
    ctx.resolveAnvendtReguleringsdato = vi.fn(() => iso('2024-12-31'));

    renderReguleringSection(ctx);

    expect(ctx.resolveLoenSkadedatoText).toHaveBeenCalledWith(expect.objectContaining({
      anvendtReguleringsdato: iso('2024-12-31'),
      useUntilWordingForImplicitBeregningsperiodeDate: true,
    }));
  });
});

describe('renderReguleringSection – KRL satstabel-note', () => {
  it('viser KRL-link for lønudvikling baseret på KRL satstabel', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-krl',
        navnPaaArbejdssted: 'KRL-sted',
        loenudviklingBeregningsgrundlag: 'KRL satstabel',
      },
    ];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);

    renderReguleringSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith(
      expect.stringContaining('https://www.krl.dk/#/sats')
    );
  });
});

describe('renderReguleringSection – statistik-noter', () => {
  const makeAnsaettelsesforhold = (grundlag: 'Statistik'): Ansaettelsesforhold => ({
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    id: 'af-stat',
    navnPaaArbejdssted: 'Statistik-sted',
    loenudviklingBeregningsgrundlag: grundlag,
    loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
  });

  it('viser ILON12-note når resolveStatistikModelIdFromLabel returnerer "ILON12"', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [makeAnsaettelsesforhold('Statistik')];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);
    ctx.resolveStatistikModelIdFromLabel = vi.fn(() => 'ILON12');

    renderReguleringSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith(expect.stringContaining('ILON12'));
    expect(safeAddWrappedText).toHaveBeenCalledWith(ILON12_DISCONTINUED_NOTE);
    const textCalls = safeAddWrappedText.mock.calls.map(([text]) => text);
    const ilon12ExplanationIndex = textCalls.findIndex(
      (text) => typeof text === 'string' && text.startsWith('Det Implicitte Lønindeks')
    );
    expect(ilon12ExplanationIndex).toBeGreaterThanOrEqual(0);
    expect(textCalls[ilon12ExplanationIndex + 1]).toBe(ILON12_DISCONTINUED_NOTE);
  });

  it('viser SBLON2-note når resolveStatistikModelIdFromLabel returnerer "SBLON2"', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [makeAnsaettelsesforhold('Statistik')];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);
    ctx.resolveStatistikModelIdFromLabel = vi.fn(() => 'SBLON2');

    renderReguleringSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith(expect.stringContaining('SBLON2'));
  });

  it('viser ASL-note når statistikLabel starter med "ASL-"', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    const af = makeAnsaettelsesforhold('Statistik');
    af.loenudviklingStatistikModel = 'ASL-årslønsmaksimum';
    eoValues.loenindkomstAnsaettelsesforhold = [af];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);
    // resolveStatistikModelIdFromLabel returnerer undefined → kode tjekker label.startsWith('ASL-')
    ctx.resolveStatistikModelIdFromLabel = vi.fn(() => undefined);

    renderReguleringSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith(
      expect.stringContaining('ASL-årslønsmaksimum')
    );
  });
});

describe('renderReguleringSection – reguleringstekst', () => {
  it('viser reguleringstekst for Manuelt angivet når tafBounds findes', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-manuel',
        navnPaaArbejdssted: 'Manuel regulering',
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      },
    ];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);
    ctx.resolveTafDateBounds = vi.fn(() => ({
      foerste: iso('2023-07-01'),
      sidste: iso('2025-12-21'),
    }));

    renderReguleringSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith(
      expect.stringContaining('Regulering foretages på baggrund af den procentuelle udvikling i grundløn.')
    );
  });

  it('medtager fritvalg og pension for Manuelt angivet når reguleringsværdierne stiger', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-manuel-stigning',
        navnPaaArbejdssted: 'Manuel regulering med stigning',
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      },
    ];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);
    ctx.resolveTafDateBounds = vi.fn(() => ({
      foerste: iso('2023-07-01'),
      sidste: iso('2025-12-21'),
    }));
    ctx.buildReguleringsvaerdierTableData = vi.fn(() => ({
      columns: ['Fra-dato', 'Timeløn', 'Feriepenge', 'SH/SO', 'Fritvalg', 'AG pens. bidrag'],
      rows: [
        ['24-05-2023', '25.174,00', '15 % / 15,00 %', '7,00 %', '7,00 %', '9,00 %'],
        ['01-05-2025', '26.496,00', '15 % / 15,00 %', '9,00 %', '9,00 %', '12,00 %'],
      ],
    }));

    renderReguleringSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith(
      expect.stringContaining('Hertil kommer stigninger i')
    );
    expect(safeAddWrappedText).toHaveBeenCalledWith(
      expect.stringContaining('fritvalg')
    );
    expect(safeAddWrappedText).toHaveBeenCalledWith(
      expect.stringContaining('pension')
    );
  });

  it('afgrænser reguleringstabeller til den konkrete ansættelses segmentspænd og ikke globale tafBounds', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-per-af',
        navnPaaArbejdssted: 'Per-afgrænset regulering',
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      },
    ];
    const { ctx } = makeContext(eoValues);
    ctx.resolveTafDateBounds = vi.fn(() => ({
      foerste: iso('2024-01-26'),
      sidste: iso('2025-05-31'),
    }));
    ctx.modelLoenudviklingPerAnsaettelse = [
      {
        ansaettelsesforholdId: 'af-per-af',
        beregnedeSegmenter: [
          {
            kind: 'maaneder',
            fra: iso('2024-01-26'),
            til: iso('2025-02-01'),
            maaneder: 12,
            maanedsloenOre: 0,
            deltaPct: 0,
            amountOre: 0,
          },
        ],
      },
    ];

    renderReguleringSection(ctx);

    expect(ctx.buildReguleringsvaerdierTableData).toHaveBeenCalledWith(expect.objectContaining({
      tafFra: iso('2024-01-26'),
      tafTil: iso('2025-02-01'),
    }));
    expect(ctx.buildReguleringIndexRows).toHaveBeenCalledWith(expect.objectContaining({
      segments: [
        expect.objectContaining({
          fra: iso('2024-01-26'),
          til: iso('2025-02-01'),
        }),
      ],
    }));
  });
});

describe('renderReguleringSection – reguleringsværdier tabelkolonner', () => {
  it('skjuler kolonner hvor alle værdier er tomme eller "-"', () => {
    autoTableMock.mockClear();
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-kolonnefilter',
        navnPaaArbejdssted: 'Teststed',
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      },
    ];
    const { ctx } = makeContext(eoValues);
    ctx.resolveTafDateBounds = vi.fn(() => ({
      foerste: iso('2023-07-01'),
      sidste: iso('2025-12-21'),
    }));
    ctx.buildReguleringsvaerdierTableData = vi.fn(() => ({
      columns: ['Fra-dato', 'Timeløn', 'Feriepenge', 'SH/SO', 'Fritvalg', 'AG pens. bidrag'],
      rows: [
        ['24-05-2023', '25.174,00', '15,00 %', '-', '7,00 %', '9,00 %'],
        ['01-06-2023', '25.174,00', '15,00 %', '-', '7,00 %', '11,00 %'],
        ['01-03-2024', '25.174,00', '15,00 %', '-', '9,00 %', '11,00 %'],
      ],
    }));

    renderReguleringSection(ctx);

    const firstCall = autoTableMock.mock.calls[0]?.[1];
    const headerRow = firstCall?.body?.[0];

    expect(headerRow).toBeDefined();
    expect(headerRow).toHaveLength(5);
    expect(headerRow?.map((cell) => ('content' in cell ? cell.content : ''))).toEqual([
      'Fra-dato',
      'Timeløn',
      'Feriepenge',
      'Fritvalg',
      'AG pens. bidrag',
    ]);
  });

  it('højre-aligner kun pct-kolonnernes indhold med indrykning', () => {
    autoTableMock.mockClear();
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-alignment',
        navnPaaArbejdssted: 'Teststed',
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      },
    ];
    const { ctx } = makeContext(eoValues);
    ctx.resolveTafDateBounds = vi.fn(() => ({
      foerste: iso('2023-07-01'),
      sidste: iso('2025-12-21'),
    }));
    ctx.buildReguleringsvaerdierTableData = vi.fn(() => ({
      columns: ['Fra-dato', 'Timeløn', 'Feriepenge', 'SH/SO', 'Fritvalg', 'Store Bededag', 'AG pens. bidrag'],
      rows: [
        ['24-05-2023', '25.174,00', '12,50 %', '2,70 %', '0 %', '0 %', '8,15 %'],
      ],
    }));

    renderReguleringSection(ctx);

    const firstCall = autoTableMock.mock.calls[0]?.[1];
    expect(firstCall?.didParseCell).toBeTypeOf('function');

    const expectedInsets = new Map([
      [2, 8],
      [3, 6],
      [4, 8],
      [5, 8],
      [6, 8],
    ]);
    for (const [columnIndex, expectedRightInset] of expectedInsets) {
      const data: Parameters<NonNullable<AutoTableTestOptions['didParseCell']>>[0] & {
        row: { index: number };
        column: { index: number };
      } = {
        row: { index: 1 },
        column: { index: columnIndex },
        cell: { styles: { halign: 'center' } },
      };
      firstCall?.didParseCell?.(data as never);
      expect(data.cell.styles.halign).toBe('right');
      expect(data.cell.styles.cellPadding).toEqual({
        top: 1.5,
        bottom: 1.5,
        left: 1.5,
        right: expectedRightInset,
      });
    }

    const nonPercentageData: Parameters<NonNullable<AutoTableTestOptions['didParseCell']>>[0] & {
      row: { index: number };
      column: { index: number };
    } = {
      row: { index: 1 },
      column: { index: 1 },
      cell: { styles: { halign: 'center' } },
    };
    firstCall?.didParseCell?.(nonPercentageData as never);
    expect(nonPercentageData.cell.styles.halign).toBe('center');
    expect(nonPercentageData.cell.styles.cellPadding).toBeUndefined();

    const headerData: Parameters<NonNullable<AutoTableTestOptions['didParseCell']>>[0] & {
      row: { index: number };
      column: { index: number };
    } = {
      row: { index: 0 },
      column: { index: 2 },
      cell: { styles: { halign: 'center' } },
    };
    firstCall?.didParseCell?.(headerData as never);
    expect(headerData.cell.styles.halign).toBe('center');
    expect(headerData.cell.styles.cellPadding).toBeUndefined();
  });
});

describe('renderReguleringSection – KL-lønaftaler Beregnet regulering', () => {
  it('bruger fire lige brede og centrerede kolonner', () => {
    autoTableMock.mockClear();
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-kl-layout',
        navnPaaArbejdssted: 'KL-sted',
        loenudviklingBeregningsgrundlag: 'KL-lønaftaler',
      },
    ];
    const { ctx } = makeContext(eoValues);
    ctx.resolveTafDateBounds = vi.fn(() => ({
      foerste: iso('2022-06-01'),
      sidste: iso('2025-06-30'),
    }));
    ctx.buildReguleringIndexRows = vi.fn(() => [
      {
        fraDato: '01-06-2022',
        tilDato: '30-09-2022',
        indeksberegning: '',
        indeks: '',
        loenudvikling: '',
        reguleretLoen: '41.593,87',
      },
      {
        fraDato: '01-10-2022',
        tilDato: '31-03-2023',
        indeksberegning: '',
        indeks: '',
        loenudvikling: '2,55 %',
        reguleretLoen: '42.654,51',
      },
    ]);

    renderReguleringSection(ctx);

    const tableCall = autoTableMock.mock.calls.find(([, options]) => {
      const headerRow = options.body?.[0];
      return headerRow?.some((cell) => cell.content === 'Reguleret månedsløn') ?? false;
    })?.[1];

    expect(tableCall).toBeDefined();
    expect(tableCall?.body?.[0]?.map((cell) => cell.styles?.halign)).toEqual([
      'center',
      'center',
      'center',
      'center',
    ]);
    expect(tableCall?.body?.slice(1).flat().map((cell) => cell.styles?.halign)).toEqual([
      'center',
      'center',
      'center',
      'center',
      'center',
      'center',
      'center',
      'center',
    ]);

    const columnStyles = tableCall?.columnStyles;
    expect(columnStyles).toBeDefined();
    const widths = Object.values(columnStyles ?? {}).map((style) => style.cellWidth);
    expect(widths).toHaveLength(4);
    expect(new Set(widths).size).toBe(1);
    expect(Object.values(columnStyles ?? {}).map((style) => style.halign)).toEqual([
      'center',
      'center',
      'center',
      'center',
    ]);
  });
});

describe('renderReguleringSection – Beregnet regulering kolonnefordeling', () => {
  const findBeregnetReguleringCall = () =>
    autoTableMock.mock.calls.find(([, options]) => {
      const headerRow = options.body?.[0];
      return headerRow?.some((cell) => cell.content === 'Lønudvikling') ?? false;
    })?.[1];

  const headerContents = (call: AutoTableTestOptions | undefined) =>
    call?.body?.[0]?.map((cell) => ('content' in cell ? cell.content : ''));

  const orderedWidths = (call: AutoTableTestOptions | undefined): (number | undefined)[] => {
    const styles = call?.columnStyles ?? {};
    return Object.keys(styles)
      .map((key) => Number(key))
      .sort((a, b) => a - b)
      .map((index) => styles[index]?.cellWidth);
  };

  it('manuel procentsats: fire lige brede kolonner, Indeksberegning udeladt', () => {
    autoTableMock.mockClear();
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-mp-layout',
        navnPaaArbejdssted: 'Manuel procentsats',
        loenudviklingBeregningsgrundlag: 'Manuel procentsats',
      },
    ];
    const { ctx } = makeContext(eoValues);
    ctx.resolveTafDateBounds = vi.fn(() => ({ foerste: iso('2024-01-01'), sidste: iso('2025-12-31') }));
    ctx.buildReguleringIndexRows = vi.fn(() => [
      { fraDato: '01-01-2024', tilDato: '31-12-2024', indeksberegning: '', indeks: '100,00', loenudvikling: '' },
      { fraDato: '01-01-2025', tilDato: '31-12-2025', indeksberegning: '', indeks: '110,00', loenudvikling: '+ 10,00 %' },
    ]);

    renderReguleringSection(ctx);

    const call = findBeregnetReguleringCall();
    expect(call).toBeDefined();
    expect(headerContents(call)).toEqual(['Fra-dato', 'Til-dato', 'Indeks', 'Lønudvikling']);
    const widths = orderedWidths(call);
    expect(widths).toHaveLength(4);
    expect(new Set(widths).size).toBe(1); // hele bredden deles ligeligt
  });

  it('øvrige modeller: Indeksberegning er grow-kolonne (bredest), de øvrige deler resten ligeligt', () => {
    autoTableMock.mockClear();
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-manuel-layout',
        navnPaaArbejdssted: 'Manuelt angivet',
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      },
    ];
    const { ctx } = makeContext(eoValues);
    ctx.resolveTafDateBounds = vi.fn(() => ({ foerste: iso('2024-01-01'), sidste: iso('2025-12-31') }));
    ctx.buildReguleringIndexRows = vi.fn(() => [
      { fraDato: '01-01-2024', tilDato: '31-12-2024', indeksberegning: '100,00', indeks: '100,00', loenudvikling: '' },
      { fraDato: '01-01-2025', tilDato: '31-12-2025', indeksberegning: '(27.000,00 / 25.000,00)', indeks: '108,00', loenudvikling: '+ 8,00 %' },
    ]);

    renderReguleringSection(ctx);

    const call = findBeregnetReguleringCall();
    expect(call).toBeDefined();
    expect(headerContents(call)).toEqual(['Fra-dato', 'Til-dato', 'Indeksberegning', 'Indeks', 'Lønudvikling']);
    const widths = orderedWidths(call);
    expect(widths).toHaveLength(5);
    // Indeksberegning (index 2) er grow-kolonnen: den er bredest, mens de øvrige fire deler
    // resten ligeligt. (Denne test-harness kan ikke måle tekst, så den statiske grow-baseline
    // bruges — den indholdsbestemte omfordeling verificeres i pdfTableRenderer.layout-testen.)
    const others = [widths[0], widths[1], widths[3], widths[4]].map((width) => width ?? 0);
    expect(widths[2] ?? 0).toBeGreaterThan(Math.max(...others));
    expect(new Set(others).size).toBe(1); // de fire øvrige er lige brede
    const total = widths.reduce<number>((sum, width) => sum + (width ?? 0), 0);
    expect(total).toBeCloseTo(PDF_CONTENT_WIDTH_MM, 6);
  });

  it('Beregnet regulering: Indeks/Lønudvikling får dynamisk højre-indrykning skaleret efter kolonnebredden', () => {
    autoTableMock.mockClear();
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-inset-dynamik',
        navnPaaArbejdssted: 'Manuelt angivet',
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      },
    ];
    const { ctx } = makeContext(eoValues);
    ctx.resolveTafDateBounds = vi.fn(() => ({ foerste: iso('2024-01-01'), sidste: iso('2025-12-31') }));
    ctx.buildReguleringIndexRows = vi.fn(() => [
      { fraDato: '01-01-2024', tilDato: '31-12-2024', indeksberegning: '100,00', indeks: '100,00', loenudvikling: '' },
      { fraDato: '01-01-2025', tilDato: '31-12-2025', indeksberegning: '(27.000,00 / 25.000,00)', indeks: '108,00', loenudvikling: '+ 8,00 %' },
    ]);

    renderReguleringSection(ctx);

    const call = findBeregnetReguleringCall();
    expect(call).toBeDefined();
    // Indeks (index 3) og Lønudvikling (index 4) er de højrejusterede tal-kolonner.
    const indeksWidth = call?.columnStyles?.[3]?.cellWidth ?? 0;
    const expectedInset = resolveDynamicRightAlignedInset(indeksWidth, REGULERINGSVAERDIER_RIGHT_ALIGNED_INSET_MM_FOR_TEST);

    const data = {
      row: { index: 1 },
      column: { index: 3 },
      cell: { styles: { halign: 'center' } },
    };
    call?.didParseCell?.(data as never);
    expect(data.cell.styles.halign).toBe('right');
    // Den anvendte indrykning matcher den dynamiske beregning ud fra kolonnens faktiske bredde,
    // og er dermed reduceret i forhold til det fulde maks-inset (kolonnen er smallere end grow-kolonnen).
    expect((data.cell.styles as { cellPadding?: { right?: number } }).cellPadding?.right).toBeCloseTo(expectedInset, 6);
    expect(expectedInset).toBeLessThan(REGULERINGSVAERDIER_RIGHT_ALIGNED_INSET_MM_FOR_TEST);
  });
});
