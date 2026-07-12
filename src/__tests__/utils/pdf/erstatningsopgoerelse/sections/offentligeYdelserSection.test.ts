// @vitest-environment jsdom
import { createErstatningsopgoerelseInitialValues } from '../../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  buildIncomeForRanges,
  roundIncomeBenefitAmountKroner,
} from '../../../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { buildEoValuesWithTransientMidlertidigtEet } from '../../../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetTransientInjection';
import { buildMidlertidigtEetPdfGroupsForTafRanges } from '../../../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetBilagGroups';
import {
  renderMidlertidigtEetSection,
  renderOffentligeYdelserSection,
} from '../../../../../document/generators/eo/sections/offentligeYdelserSection';
import { toISODateString } from '../../../../../types/branded';
import { renderTableSpec, type TableSpec } from '../../../../../document/layout/tableSpec';
import { fromKroner, toKroner } from '../../../../../domain/money/money';

const { autoTableMock } = vi.hoisted(() => ({
  autoTableMock: vi.fn((doc: Record<string, unknown>, options: { startY?: number; columnStyles?: Record<number, { cellWidth: number }> }) => {
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
      startEoBilagPage: vi.fn(),
      renderSubheader: vi.fn(),
      shouldIncludeOffentligYdelseRowInEoBilag: vi.fn(() => true),
      eoBilagIndkomstYdelserMode: 'Alle' as const,
      eoBilagIndkomstYdelserRanges: [] as const,
      writeBoldSubheaderWithWrappedText: vi.fn(),
      writer: {
        addSectionSpacer: vi.fn(),
        addSpacer: vi.fn(),
        addTable: vi.fn((spec: TableSpec) => {
          y = renderTableSpec(doc as never, y, spec).endY;
        }),
        writeUnderlinedSubheader: vi.fn(),
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
  it('kalder writeUnderlinedSubheader for hvert unikt ydelsestype-label', () => {
    const { ctx } = makeCtx();
    const writeUnderlinedSubheader = vi.fn();
    ctx.writer.writeUnderlinedSubheader = writeUnderlinedSubheader;
    ctx.eoValues.offentligeYdelserRows = [
      { id: 'r1', fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2024-01-31'), ydelsestype: 'sygedagpenge', ydelse: { kind: 'number', value: 500 }, tillaeg: undefined },
      { id: 'r2', fraDato: toISODateString('2024-02-01'), tilDato: toISODateString('2024-02-29'), ydelsestype: 'dagpenge', ydelse: { kind: 'number', value: 300 }, tillaeg: undefined },
    ];

    renderOffentligeYdelserSection(ctx);

    // To unikke ydelsestyper → to understregede underoverskrifts-kald
    expect(writeUnderlinedSubheader).toHaveBeenCalledTimes(2);
  });

  it('kalder writeUnderlinedSubheader kun én gang for samme ydelsestype i to rækker', () => {
    const { ctx } = makeCtx();
    const writeUnderlinedSubheader = vi.fn();
    ctx.writer.writeUnderlinedSubheader = writeUnderlinedSubheader;
    ctx.eoValues.offentligeYdelserRows = [
      { id: 'r1', fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2024-01-31'), ydelsestype: 'sygedagpenge', ydelse: { kind: 'number', value: 500 }, tillaeg: undefined },
      { id: 'r2', fraDato: toISODateString('2024-02-01'), tilDato: toISODateString('2024-02-29'), ydelsestype: 'sygedagpenge', ydelse: { kind: 'number', value: 400 }, tillaeg: undefined },
    ];

    renderOffentligeYdelserSection(ctx);

    // Én ydelsestype → ét understreget underoverskrifts-kald
    expect(writeUnderlinedSubheader).toHaveBeenCalledTimes(1);
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
      startEoBilagPage: vi.fn(),
      renderSubheader: vi.fn(),
      shouldIncludeOffentligYdelseRowInEoBilag: vi.fn(() => true),
      eoBilagIndkomstYdelserMode: 'Alle',
      eoBilagIndkomstYdelserRanges: [],
      writeBoldSubheaderWithWrappedText: vi.fn(),
      writer: {
        addSectionSpacer: vi.fn(),
        addSpacer: vi.fn(),
        addTable: vi.fn((spec: TableSpec) => {
          y = renderTableSpec(doc as never, y, spec).endY;
        }),
        writeUnderlinedSubheader: vi.fn(),
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
  it('afrunder hver Midlertidig EET-PDF-række efter rækkens egen månedsbrøk', () => {
    const tafRanges = [
      { fra: iso('2024-01-01'), til: iso('2024-01-05') },
      { fra: iso('2024-01-11'), til: iso('2024-01-15') },
    ];
    const groups = [{
      afgoerelsesdato: iso('2024-01-01'),
      eetPct: 20,
      rows: [],
      perioder: [
        {
          fra: iso('2024-01-01'),
          til: iso('2024-01-10'),
          satsAar: 2024,
          maanederPraecis: 10 / 31,
          grundydelseAfrundetOre: fromKroner(1000),
          reguleringPct: 0,
          maanedligYdelseOre: fromKroner(1000),
          beregnetEetOre: fromKroner(323),
        },
        {
          fra: iso('2024-01-11'),
          til: iso('2024-01-20'),
          satsAar: 2024,
          maanederPraecis: 10 / 31,
          grundydelseAfrundetOre: fromKroner(1000),
          reguleringPct: 0,
          maanedligYdelseOre: fromKroner(1000),
          beregnetEetOre: fromKroner(323),
        },
      ],
    }];

    const clampedGroups = buildMidlertidigtEetPdfGroupsForTafRanges(groups, tafRanges);
    const rows = clampedGroups.flatMap((group) => group.perioder);

    expect(clampedGroups).toHaveLength(1);
    expect(rows.map((row) => [row.fra, row.til, toKroner(row.beregnetEetOre)])).toEqual([
      [iso('2024-01-01'), iso('2024-01-05'), 161],
      [iso('2024-01-11'), iso('2024-01-15'), 161],
    ]);
  });

  it('afrunder Midlertidigt EET i hele kroner ligesom TAF-indtægtslinjen når togglen er slået til', () => {
    const tafRanges = [{ fra: iso('2024-01-01'), til: iso('2024-01-05') }];
    const groups = [{
      afgoerelsesdato: iso('2024-01-01'),
      eetPct: 20,
      rows: [],
      perioder: [{
        fra: iso('2024-01-01'),
        til: iso('2024-01-10'),
        satsAar: 2024,
        maanederPraecis: 10 / 31,
        grundydelseAfrundetOre: fromKroner(1000),
        reguleringPct: 0,
        maanedligYdelseOre: fromKroner(1000),
        beregnetEetOre: fromKroner(323),
      }],
    }];
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.midlertidigtEetFraEetSiden = 'Ja';

    const clampedGroups = buildMidlertidigtEetPdfGroupsForTafRanges(groups, tafRanges);
    const pdfTotal = clampedGroups
      .flatMap((group) => group.perioder)
      .reduce((sum, row) => sum + toKroner(row.beregnetEetOre), 0);
    const effectiveValues = buildEoValuesWithTransientMidlertidigtEet(eoValues, groups);
    const tafBenefit = buildIncomeForRanges(effectiveValues, tafRanges).benefits.find((entry) => entry.typeKey === 'midlertidigt_eet');

    expect(tafBenefit?.amount).toBeCloseTo(1000 * (5 / 31), 10);
    expect(pdfTotal).toBe(161);
    expect(pdfTotal).toBe(roundIncomeBenefitAmountKroner(tafBenefit?.typeKey ?? '', tafBenefit?.amount ?? 0, true));
  });

  it('viser 11-12 januar som 2/31 måned i Midlertidig EET-bilaget', () => {
    const groups = [{
      afgoerelsesdato: iso('2025-07-16'),
      eetPct: 60,
      rows: [],
      perioder: [{
        fra: iso('2025-01-01'),
        til: iso('2025-12-31'),
        satsAar: 2025,
        maanederPraecis: 12,
        grundydelseAfrundetOre: fromKroner(248764.43),
        reguleringPct: 3.9,
        maanedligYdelseOre: fromKroner(21539),
        beregnetEetOre: fromKroner(258468),
      }],
    }];

    const clampedGroups = buildMidlertidigtEetPdfGroupsForTafRanges(groups, [
      { fra: iso('2025-01-11'), til: iso('2025-01-12') },
    ]);
    const row = clampedGroups[0]?.perioder[0];

    expect(row?.maanederPraecis).toBeCloseTo(2 / 31, 10);
    expect(row && toKroner(row.beregnetEetOre)).toBe(1390);
  });

  it('afrunder 13. januar til 31. maj 2025 med 8.975 kr./md. til 41.401 kr.', () => {
    const groups = [{
      afgoerelsesdato: iso('2025-08-29'),
      eetPct: 25,
      rows: [],
      perioder: [{
        fra: iso('2025-01-13'),
        til: iso('2025-05-31'),
        satsAar: 2025,
        maanederPraecis: 4.612903225806452,
        grundydelseAfrundetOre: fromKroner(103651.85),
        reguleringPct: 3.9,
        maanedligYdelseOre: fromKroner(8975),
        beregnetEetOre: fromKroner(41401),
      }],
    }];

    const clampedGroups = buildMidlertidigtEetPdfGroupsForTafRanges(groups, [
      { fra: iso('2025-01-13'), til: iso('2025-05-31') },
    ]);
    const row = clampedGroups[0]?.perioder[0];

    expect(row?.maanederPraecis).toBeCloseTo((19 / 31) + 4, 10);
    expect(row && toKroner(row.beregnetEetOre)).toBe(41401);
  });

  it('bevarer 2-decimal-afrunding for manuelt indtastede midlertidigt_eet-rækker når togglen er slået fra', () => {
    const tafBenefitAmount = 50.5;
    const rounded = roundIncomeBenefitAmountKroner('midlertidigt_eet', tafBenefitAmount, false);
    expect(rounded).toBe(50.5);
  });

  it('omfordeler ikke afrundingsdifference mellem synlige Midlertidig EET-rækker', () => {
    const tafRanges = [
      { fra: iso('2025-01-11'), til: iso('2025-01-12') },
      { fra: iso('2025-01-13'), til: iso('2025-05-31') },
    ];
    const groups = [{
      afgoerelsesdato: iso('2025-08-29'),
      eetPct: 25,
      rows: [],
      perioder: [
        {
          fra: iso('2025-01-11'),
          til: iso('2025-01-12'),
          satsAar: 2025,
          maanederPraecis: 2 / 31,
          grundydelseAfrundetOre: fromKroner(248764.43),
          reguleringPct: 3.9,
          maanedligYdelseOre: fromKroner(21539),
          beregnetEetOre: fromKroner(1390),
        },
        {
          fra: iso('2025-01-13'),
          til: iso('2025-05-31'),
          satsAar: 2025,
          maanederPraecis: 4.612903225806452,
          grundydelseAfrundetOre: fromKroner(103651.85),
          reguleringPct: 3.9,
          maanedligYdelseOre: fromKroner(8975),
          beregnetEetOre: fromKroner(41401),
        },
      ],
    }];

    const clampedGroups = buildMidlertidigtEetPdfGroupsForTafRanges(groups, tafRanges);
    const allRows = clampedGroups.flatMap((group) => group.perioder);

    expect(allRows.map((row) => toKroner(row.beregnetEetOre))).toEqual([1390, 41401]);
  });

  it('renderer ikke Midlertidig EET-bilaget når EET-perioder ikke overlapper TAF-perioden', () => {
    autoTableMock.mockClear();
    const doc = createMockPdfDoc();
    let y = 0;

    renderMidlertidigtEetSection({
      groups: [{
        afgoerelsesdato: iso('2024-01-01'),
        eetPct: 20,
        rows: [],
        perioder: [{
          fra: iso('2024-01-01'),
          til: iso('2024-01-31'),
          satsAar: 2024,
          maanederPraecis: 1,
          grundydelseAfrundetOre: fromKroner(1000),
          reguleringPct: 0,
          maanedligYdelseOre: fromKroner(1000),
          beregnetEetOre: fromKroner(1000),
        }],
      }],
      tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-29') }],
      startEoBilagPage: vi.fn(),
      renderSubheader: vi.fn(),
      formatAfgoerelsesdato: (date) => date,
      writer: {
        addSectionSpacer: vi.fn(),
        addSpacer: vi.fn(),
        addTable: vi.fn((spec: TableSpec) => {
          y = renderTableSpec(doc as never, y, spec).endY;
        }),
      },
    });

    expect(autoTableMock).not.toHaveBeenCalled();
  });

  it('viser EET-procenten i parentes efter afgørelsesdatoen', () => {
    autoTableMock.mockClear();
    const doc = createMockPdfDoc();
    let y = 0;
    const renderSubheader = vi.fn();

    renderMidlertidigtEetSection({
      groups: [{
        afgoerelsesdato: iso('2025-07-16'),
        eetPct: 60,
        rows: [],
        perioder: [{
          fra: iso('2025-01-11'),
          til: iso('2025-01-12'),
          satsAar: 2025,
          maanederPraecis: 2 / 31,
          grundydelseAfrundetOre: fromKroner(248764.43),
          reguleringPct: 3.9,
          maanedligYdelseOre: fromKroner(21539),
          beregnetEetOre: fromKroner(1390),
        }],
      }],
      tafRanges: [{ fra: iso('2025-01-11'), til: iso('2025-01-12') }],
      startEoBilagPage: vi.fn(),
      renderSubheader,
      formatAfgoerelsesdato: () => '16. juli 2025',
      writer: {
        addSectionSpacer: vi.fn(),
        addSpacer: vi.fn(),
        addTable: vi.fn((spec: TableSpec) => {
          y = renderTableSpec(doc as never, y, spec).endY;
        }),
      },
    });

    expect(renderSubheader).toHaveBeenCalledWith('Afgørelse 16. juli 2025 (60 %)', undefined, { addTopSpacing: false });
  });
});
