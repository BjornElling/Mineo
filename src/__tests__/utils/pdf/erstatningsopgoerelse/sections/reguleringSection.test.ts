import { renderReguleringSection } from '../../../../../pdf/domains/eo/sections/reguleringSection';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../../../types/branded';

const { autoTableMock } = vi.hoisted(() => ({
  autoTableMock: vi.fn((doc: Record<string, unknown>, options: { startY?: number }) => {
    doc.lastAutoTable = { finalY: (options.startY ?? 0) + 20 };
  }),
}));

vi.mock('jspdf-autotable', () => ({
  default: autoTableMock,
}));

const iso = (value: string) => toISODateString(value);

const createMockPdfDoc = () => ({
  internal: { pageSize: { width: 210, height: 297 } },
  addPage: vi.fn(),
});

const makeContext = (
  eoValues: ReturnType<typeof createErstatningsopgoerelseInitialValues>,
  stamdataValues = STAMDATA_INITIAL_VALUES
) => {
  const startBilagPage = vi.fn();
  const renderSubheader = vi.fn();
  const safeAddWrappedText = vi.fn();
  const writeLabelValueLine = vi.fn();

  let y = 0;
  const doc = createMockPdfDoc();

  return {
    startBilagPage,
    renderSubheader,
    safeAddWrappedText,
    writeLabelValueLine,
    ctx: {
      eoValues,
      stamdataValues,
      lineHeight: 4,
      modelLoenudviklingPerAnsaettelse: [] as const,
      startBilagPage,
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
        addSpacer: vi.fn(),
        setY: vi.fn((nextY: number) => { y = nextY; }),
        getY: vi.fn(() => y),
        getDoc: vi.fn(() => doc),
        writeUnderlinedSubheader: vi.fn(),
      },
    },
  };
};

describe('renderReguleringSection – startBilagPage', () => {
  it('kalder startBilagPage med "Regulering"', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    const { startBilagPage, ctx } = makeContext(eoValues);

    renderReguleringSection(ctx);

    expect(startBilagPage).toHaveBeenCalledWith('Regulering');
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

    expect(renderSubheader).toHaveBeenCalledWith(
      'Kerteminde Kommune',
      expect.anything(),
      expect.anything()
    );
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

    expect(renderSubheader).toHaveBeenCalledWith(
      'Ansættelsesforhold 1',
      expect.anything(),
      expect.anything()
    );
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

    expect(renderSubheader).toHaveBeenCalledWith(
      'EO-oplysninger',
      expect.anything(),
      expect.anything()
    );
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
  const makeAnsaettelsesforhold = (grundlag: string) => ({
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    id: 'af-stat',
    navnPaaArbejdssted: 'Statistik-sted',
    loenudviklingBeregningsgrundlag: grundlag as never,
    loenudviklingStatistikModel: grundlag === 'Statistik' ? 'ILON12-label' : undefined,
  });

  it('viser ILON12-note når resolveStatistikModelIdFromLabel returnerer "ILON12"', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [makeAnsaettelsesforhold('Statistik')];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);
    ctx.resolveStatistikModelIdFromLabel = vi.fn(() => 'ILON12');

    renderReguleringSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith(expect.stringContaining('ILON12'));
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
    af.loenudviklingStatistikModel = 'ASL-2024';
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
    const headerRow = firstCall?.body[0];

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
});
