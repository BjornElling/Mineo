import { createErstatningsopgoerelseInitialValues } from '../../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  buildIncomeForRanges,
  roundIncomeBenefitAmountKroner,
} from '../../../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { roundHeleKroner } from '../../../../../domain/erstatningsopgoerelse/shared/eoMoney';
import {
  buildMidlertidigtEetPdfGroupsForTafRanges,
  renderMidlertidigtEetSection,
  renderOffentligeYdelserSection,
} from '../../../../../pdf/domains/eo/sections/offentligeYdelserSection';
import { toISODateString } from '../../../../../types/branded';

const { autoTableMock } = vi.hoisted(() => ({
  autoTableMock: vi.fn((doc: Record<string, unknown>, options: { startY?: number }) => {
    doc.lastAutoTable = { finalY: (options.startY ?? 0) + 10 };
  }),
}));

vi.mock('jspdf-autotable', () => ({
  default: autoTableMock,
}));

const createMockPdfDoc = () => ({
  internal: { pageSize: { width: 210, height: 297 } },
  addPage: vi.fn(),
});
const iso = (value: string) => toISODateString(value);

const makeCtx = (override: Partial<Parameters<typeof renderOffentligeYdelserSection>[0]> = {}) => {
  let y = 0;
  const eoValues = createErstatningsopgoerelseInitialValues();
  const doc = createMockPdfDoc();
  return {
    startEoBilagPage: vi.fn(),
    renderSubheader: vi.fn(),
    ctx: {
      eoValues,
      lineHeight: 4,
      startEoBilagPage: vi.fn(),
      renderSubheader: vi.fn(),
      shouldIncludeOffentligYdelseRowInEoBilag: vi.fn(() => true),
      eoBilagIndkomstYdelserMode: 'Alle' as const,
      eoBilagIndkomstYdelserRanges: [] as const,
      writeBoldSubheaderWithWrappedText: vi.fn(),
      writer: {
        addSectionSpacer: vi.fn(),
        addSpacer: vi.fn(),
        setY: vi.fn((nextY: number) => { y = nextY; }),
        getY: vi.fn(() => y),
        getDoc: vi.fn(() => doc),
      },
      ...override,
    },
  };
};

// ─── Gate: ingen rækker ────────────────────────────────────────────────────────

describe('renderOffentligeYdelserSection – gate (ingen rækker)', () => {
  it('kalder ikke startEoBilagPage når shouldInclude altid returnerer false', () => {
    const { ctx } = makeCtx({
      shouldIncludeOffentligYdelseRowInEoBilag: vi.fn(() => false),
    });
    const startEoBilagPage = vi.fn();
    ctx.startEoBilagPage = startEoBilagPage;
    ctx.eoValues.offentligeYdelserRows = [
      { id: 'r1', fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2024-01-31'), ydelsestype: 'sygedagpenge', ydelse: undefined, tillaeg: undefined },
    ];

    renderOffentligeYdelserSection(ctx);

    expect(startEoBilagPage).not.toHaveBeenCalled();
  });

  it('kalder ikke startEoBilagPage når offentligeYdelserRows er tom', () => {
    const { ctx } = makeCtx();
    const startEoBilagPage = vi.fn();
    ctx.startEoBilagPage = startEoBilagPage;
    ctx.eoValues.offentligeYdelserRows = [];

    renderOffentligeYdelserSection(ctx);

    expect(startEoBilagPage).not.toHaveBeenCalled();
  });
});

// ─── startEoBilagPage ──────────────────────────────────────────────────────────

describe('renderOffentligeYdelserSection – startEoBilagPage', () => {
  it('kalder startEoBilagPage med "Offentlige ydelser" når der er rækker', () => {
    const { ctx } = makeCtx();
    const startEoBilagPage = vi.fn();
    ctx.startEoBilagPage = startEoBilagPage;
    ctx.eoValues.offentligeYdelserRows = [
      { id: 'r1', fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2024-01-31'), ydelsestype: 'sygedagpenge', ydelse: { kind: 'number', value: 500 }, tillaeg: undefined },
    ];

    renderOffentligeYdelserSection(ctx);

    expect(startEoBilagPage).toHaveBeenCalledWith('Offentlige ydelser');
  });
});

// ─── Gruppering per ydelsestype ───────────────────────────────────────────────

describe('renderOffentligeYdelserSection – gruppering per ydelsestype', () => {
  it('kalder renderSubheader for hvert unikt ydelsestype-label', () => {
    const { ctx } = makeCtx();
    const renderSubheader = vi.fn();
    ctx.renderSubheader = renderSubheader;
    ctx.eoValues.offentligeYdelserRows = [
      { id: 'r1', fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2024-01-31'), ydelsestype: 'sygedagpenge', ydelse: { kind: 'number', value: 500 }, tillaeg: undefined },
      { id: 'r2', fraDato: toISODateString('2024-02-01'), tilDato: toISODateString('2024-02-29'), ydelsestype: 'dagpenge', ydelse: { kind: 'number', value: 300 }, tillaeg: undefined },
    ];

    renderOffentligeYdelserSection(ctx);

    // To unikke ydelsestyper → to subheader-kald
    expect(renderSubheader).toHaveBeenCalledTimes(2);
  });

  it('kalder renderSubheader kun én gang for samme ydelsestype i to rækker', () => {
    const { ctx } = makeCtx();
    const renderSubheader = vi.fn();
    ctx.renderSubheader = renderSubheader;
    ctx.eoValues.offentligeYdelserRows = [
      { id: 'r1', fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2024-01-31'), ydelsestype: 'sygedagpenge', ydelse: { kind: 'number', value: 500 }, tillaeg: undefined },
      { id: 'r2', fraDato: toISODateString('2024-02-01'), tilDato: toISODateString('2024-02-29'), ydelsestype: 'sygedagpenge', ydelse: { kind: 'number', value: 400 }, tillaeg: undefined },
    ];

    renderOffentligeYdelserSection(ctx);

    // Én ydelsestype → ét subheader-kald
    expect(renderSubheader).toHaveBeenCalledTimes(1);
  });
});

// ─── Kommentarer ──────────────────────────────────────────────────────────────

describe('renderOffentligeYdelserSection – kommentarer', () => {
  it('renderer kommentar-underoverskrift når kommentarfeltet er udfyldt', () => {
    const { ctx } = makeCtx();
    const writeBoldSubheaderWithWrappedText = vi.fn();
    ctx.writeBoldSubheaderWithWrappedText = writeBoldSubheaderWithWrappedText;
    ctx.eoValues.offentligeYdelserRows = [
      { id: 'r1', fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2024-01-31'), ydelsestype: 'sygedagpenge', ydelse: { kind: 'number', value: 500 }, tillaeg: undefined },
    ];
    ctx.eoValues.offentligeYdelserKommentarer = '  Bemærkning til ydelserne  ';

    renderOffentligeYdelserSection(ctx);

    expect(writeBoldSubheaderWithWrappedText).toHaveBeenCalledWith('Kommentarer', 'Bemærkning til ydelserne');
  });

  it('renderer ikke kommentar-underoverskrift når feltet er tomt', () => {
    const { ctx } = makeCtx();
    const writeBoldSubheaderWithWrappedText = vi.fn();
    ctx.writeBoldSubheaderWithWrappedText = writeBoldSubheaderWithWrappedText;
    ctx.eoValues.offentligeYdelserRows = [
      { id: 'r1', fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2024-01-31'), ydelsestype: 'sygedagpenge', ydelse: { kind: 'number', value: 500 }, tillaeg: undefined },
    ];
    ctx.eoValues.offentligeYdelserKommentarer = '   ';

    renderOffentligeYdelserSection(ctx);

    expect(writeBoldSubheaderWithWrappedText).not.toHaveBeenCalled();
  });

  it('renderer ikke kommentar-underoverskrift når sektionen er tom (ingen rækker)', () => {
    const { ctx } = makeCtx();
    const writeBoldSubheaderWithWrappedText = vi.fn();
    ctx.writeBoldSubheaderWithWrappedText = writeBoldSubheaderWithWrappedText;
    ctx.eoValues.offentligeYdelserRows = [];
    ctx.eoValues.offentligeYdelserKommentarer = 'Kommentar uden rækker';

    renderOffentligeYdelserSection(ctx);

    expect(writeBoldSubheaderWithWrappedText).not.toHaveBeenCalled();
  });
});

// ─── Tabelbredde ──────────────────────────────────────────────────────────────

describe('renderOffentligeYdelserSection tabelbredde', () => {
  it('fordeler kolonner over fuld tabelbredde i PDF', () => {
    autoTableMock.mockClear();
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.offentligeYdelserRows = [
      {
        id: 'row-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'sygedagpenge',
        ydelse: { kind: 'number', value: 1000 },
        tillaeg: { kind: 'number', value: 100 },
      },
    ];

    let y = 0;
    const doc = createMockPdfDoc();

    renderOffentligeYdelserSection({
      eoValues,
      lineHeight: 4,
      startEoBilagPage: vi.fn(),
      renderSubheader: vi.fn(),
      shouldIncludeOffentligYdelseRowInEoBilag: vi.fn(() => true),
      eoBilagIndkomstYdelserMode: 'Alle',
      eoBilagIndkomstYdelserRanges: [],
      writeBoldSubheaderWithWrappedText: vi.fn(),
      writer: {
        addSectionSpacer: vi.fn(),
        addSpacer: vi.fn(),
        setY: vi.fn((nextY: number) => {
          y = nextY;
        }),
        getY: vi.fn(() => y),
        getDoc: vi.fn(() => doc),
      },
    });

    expect(autoTableMock).toHaveBeenCalled();
    const firstCall = autoTableMock.mock.calls[0]?.[1];
    const columnStyles = firstCall?.columnStyles as Record<number, { cellWidth: number }>;
    const firstColumnStyle = columnStyles[0];
    const totalWidth = Object.values(columnStyles).reduce((sum, style) => sum + style.cellWidth, 0);

    expect(totalWidth).toBeCloseTo(170, 6);
    expect(firstColumnStyle.cellWidth).toBeGreaterThan(0);
  });
});

describe('renderMidlertidigtEetSection TAF-clamping', () => {
  it('bygger PDF-perioder med samme periodiserede total som TAF-fradraget for Midlertidigt EET', () => {
    const tafRanges = [
      { fra: iso('2024-01-01'), til: iso('2024-01-05') },
      { fra: iso('2024-01-11'), til: iso('2024-01-15') },
    ];
    const groups = [{
      afgoerelsesdato: iso('2024-01-01'),
      rows: [],
      perioder: [
        {
          fra: iso('2024-01-01'),
          til: iso('2024-01-10'),
          satsAar: 2024,
          maanederPraecis: 0.101,
          grundydelseAfrundet: 1000,
          reguleringPct: 0,
          maanedligYdelse: 1000,
          beregnetEet: 101,
        },
        {
          fra: iso('2024-01-11'),
          til: iso('2024-01-20'),
          satsAar: 2024,
          maanederPraecis: 0.101,
          grundydelseAfrundet: 1000,
          reguleringPct: 0,
          maanedligYdelse: 1000,
          beregnetEet: 101,
        },
      ],
    }];
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.midlertidigtEetFraEetSiden = 'Ja';
    eoValues.offentligeYdelserRows = [
      {
        id: 'midlertidigt-eet-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-10'),
        ydelsestype: 'midlertidigt_eet',
        ydelse: { kind: 'number', value: 101 },
        tillaeg: undefined,
      },
      {
        id: 'midlertidigt-eet-2',
        fraDato: toISODateString('2024-01-11'),
        tilDato: toISODateString('2024-01-20'),
        ydelsestype: 'midlertidigt_eet',
        ydelse: { kind: 'number', value: 101 },
        tillaeg: undefined,
      },
    ];

    const clampedGroups = buildMidlertidigtEetPdfGroupsForTafRanges(groups, tafRanges);
    const pdfTotal = clampedGroups.flatMap((group) => group.perioder).reduce((sum, row) => sum + row.beregnetEet, 0);
    const tafBenefit = buildIncomeForRanges(eoValues, tafRanges).benefits.find((entry) => entry.typeKey === 'midlertidigt_eet');

    expect(clampedGroups).toHaveLength(1);
    expect(clampedGroups[0]?.perioder.map((row) => [row.fra, row.til])).toEqual([
      [iso('2024-01-01'), iso('2024-01-05')],
      [iso('2024-01-11'), iso('2024-01-15')],
    ]);
    expect(pdfTotal).toBe(roundHeleKroner(tafBenefit?.amount ?? 0));
    expect(pdfTotal).toBe(101);
  });

  it('afrunder Midlertidigt EET i hele kroner ligesom TAF-indtægtslinjen når togglen er slået til', () => {
    const tafRanges = [{ fra: iso('2024-01-01'), til: iso('2024-01-05') }];
    const groups = [{
      afgoerelsesdato: iso('2024-01-01'),
      rows: [],
      perioder: [{
        fra: iso('2024-01-01'),
        til: iso('2024-01-10'),
        satsAar: 2024,
        maanederPraecis: 0.101,
        grundydelseAfrundet: 1000,
        reguleringPct: 0,
        maanedligYdelse: 1000,
        beregnetEet: 101,
      }],
    }];
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.midlertidigtEetFraEetSiden = 'Ja';
    eoValues.offentligeYdelserRows = [{
      id: 'midlertidigt-eet-1',
      fraDato: toISODateString('2024-01-01'),
      tilDato: toISODateString('2024-01-10'),
      ydelsestype: 'midlertidigt_eet',
      ydelse: { kind: 'number', value: 101 },
      tillaeg: undefined,
    }];

    const clampedGroups = buildMidlertidigtEetPdfGroupsForTafRanges(groups, tafRanges);
    const pdfTotal = clampedGroups.flatMap((group) => group.perioder).reduce((sum, row) => sum + row.beregnetEet, 0);
    const tafBenefit = buildIncomeForRanges(eoValues, tafRanges).benefits.find((entry) => entry.typeKey === 'midlertidigt_eet');

    expect(tafBenefit?.amount).toBe(50.5);
    expect(pdfTotal).toBe(51);
    expect(pdfTotal).toBe(roundIncomeBenefitAmountKroner(tafBenefit?.typeKey ?? '', tafBenefit?.amount ?? 0, true));
  });

  it('bevarer 2-decimal-afrunding for manuelt indtastede midlertidigt_eet-rækker når togglen er slået fra', () => {
    const tafBenefitAmount = 50.5;
    const rounded = roundIncomeBenefitAmountKroner('midlertidigt_eet', tafBenefitAmount, false);
    expect(rounded).toBe(50.5);
  });

  it('lægger afrundingsdelta på den største række så små rækker ikke kan blive negative', () => {
    // To rækker med vidt forskellige beløb: lille række (≈ 1 kr) og stor (≈ 1000 kr).
    // Hvis delta blev lagt på sidste række (her: lille), kunne den hypotetisk gå negativ.
    // Strategien "største række modtager delta" garanterer, at delta absorberes uden
    // tab af bilag-rækker.
    const tafRanges = [
      { fra: iso('2024-01-01'), til: iso('2024-01-31') },
      { fra: iso('2024-02-01'), til: iso('2024-02-01') },
    ];
    const groups = [{
      afgoerelsesdato: iso('2024-01-01'),
      rows: [],
      perioder: [
        {
          fra: iso('2024-01-01'),
          til: iso('2024-01-31'),
          satsAar: 2024,
          maanederPraecis: 1,
          grundydelseAfrundet: 1000,
          reguleringPct: 0,
          maanedligYdelse: 1000,
          beregnetEet: 1000.4,
        },
        {
          fra: iso('2024-02-01'),
          til: iso('2024-02-01'),
          satsAar: 2024,
          maanederPraecis: 0.0333,
          grundydelseAfrundet: 1000,
          reguleringPct: 0,
          maanedligYdelse: 1000,
          beregnetEet: 33.3,
        },
      ],
    }];

    const clampedGroups = buildMidlertidigtEetPdfGroupsForTafRanges(groups, tafRanges);
    const allRows = clampedGroups.flatMap((group) => group.perioder);

    // Alle rækker skal være positive (ingen drop pga. delta-håndtering).
    expect(allRows.length).toBe(2);
    expect(allRows.every((row) => row.beregnetEet > 0)).toBe(true);
  });

  it('renderer ikke Midlertidig EET-bilaget når EET-perioder ikke overlapper TAF-perioden', () => {
    autoTableMock.mockClear();
    const doc = createMockPdfDoc();
    let y = 0;

    renderMidlertidigtEetSection({
      groups: [{
        afgoerelsesdato: iso('2024-01-01'),
        rows: [],
        perioder: [{
          fra: iso('2024-01-01'),
          til: iso('2024-01-31'),
          satsAar: 2024,
          maanederPraecis: 1,
          grundydelseAfrundet: 1000,
          reguleringPct: 0,
          maanedligYdelse: 1000,
          beregnetEet: 1000,
        }],
      }],
      tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-29') }],
      startEoBilagPage: vi.fn(),
      renderSubheader: vi.fn(),
      formatAfgoerelsesdato: (date) => date,
      writer: {
        addSectionSpacer: vi.fn(),
        addSpacer: vi.fn(),
        setY: vi.fn((nextY: number) => {
          y = nextY;
        }),
        getY: vi.fn(() => y),
        getDoc: vi.fn(() => doc),
      },
    });

    expect(autoTableMock).not.toHaveBeenCalled();
  });
});
