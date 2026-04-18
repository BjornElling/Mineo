import { createErstatningsopgoerelseInitialValues } from '../../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { renderOffentligeYdelserSection } from '../../../../../pdf/domains/eo/sections/offentligeYdelserSection';

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

const makeCtx = (override: Partial<Parameters<typeof renderOffentligeYdelserSection>[0]> = {}) => {
  let y = 0;
  const eoValues = createErstatningsopgoerelseInitialValues();
  const doc = createMockPdfDoc();
  return {
    startBilagPage: vi.fn(),
    renderSubheader: vi.fn(),
    ctx: {
      eoValues,
      lineHeight: 4,
      startBilagPage: vi.fn(),
      renderSubheader: vi.fn(),
      shouldIncludeOffentligYdelseRowInBilag: vi.fn(() => true),
      bilagIndkomstYdelserMode: 'Alle' as const,
      bilagIndkomstYdelserRanges: [] as const,
      writer: {
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
  it('kalder ikke startBilagPage når shouldInclude altid returnerer false', () => {
    const { ctx } = makeCtx({
      shouldIncludeOffentligYdelseRowInBilag: vi.fn(() => false),
    });
    const startBilagPage = vi.fn();
    ctx.startBilagPage = startBilagPage;
    ctx.eoValues.offentligeYdelserRows = [
      { id: 'r1', fraDato: '01-01-2024', tilDato: '31-01-2024', ydelsestype: 'sygedagpenge', ydelse: undefined, tillaeg: undefined },
    ];

    renderOffentligeYdelserSection(ctx);

    expect(startBilagPage).not.toHaveBeenCalled();
  });

  it('kalder ikke startBilagPage når offentligeYdelserRows er tom', () => {
    const { ctx } = makeCtx();
    const startBilagPage = vi.fn();
    ctx.startBilagPage = startBilagPage;
    ctx.eoValues.offentligeYdelserRows = [];

    renderOffentligeYdelserSection(ctx);

    expect(startBilagPage).not.toHaveBeenCalled();
  });
});

// ─── startBilagPage ────────────────────────────────────────────────────────────

describe('renderOffentligeYdelserSection – startBilagPage', () => {
  it('kalder startBilagPage med "Offentlige ydelser" når der er rækker', () => {
    const { ctx } = makeCtx();
    const startBilagPage = vi.fn();
    ctx.startBilagPage = startBilagPage;
    ctx.eoValues.offentligeYdelserRows = [
      { id: 'r1', fraDato: '01-01-2024', tilDato: '31-01-2024', ydelsestype: 'sygedagpenge', ydelse: { kind: 'number', value: 500 }, tillaeg: undefined },
    ];

    renderOffentligeYdelserSection(ctx);

    expect(startBilagPage).toHaveBeenCalledWith('Offentlige ydelser');
  });
});

// ─── Gruppering per ydelsestype ───────────────────────────────────────────────

describe('renderOffentligeYdelserSection – gruppering per ydelsestype', () => {
  it('kalder renderSubheader for hvert unikt ydelsestype-label', () => {
    const { ctx } = makeCtx();
    const renderSubheader = vi.fn();
    ctx.renderSubheader = renderSubheader;
    ctx.eoValues.offentligeYdelserRows = [
      { id: 'r1', fraDato: '01-01-2024', tilDato: '31-01-2024', ydelsestype: 'sygedagpenge', ydelse: { kind: 'number', value: 500 }, tillaeg: undefined },
      { id: 'r2', fraDato: '01-02-2024', tilDato: '29-02-2024', ydelsestype: 'dagpenge', ydelse: { kind: 'number', value: 300 }, tillaeg: undefined },
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
      { id: 'r1', fraDato: '01-01-2024', tilDato: '31-01-2024', ydelsestype: 'sygedagpenge', ydelse: { kind: 'number', value: 500 }, tillaeg: undefined },
      { id: 'r2', fraDato: '01-02-2024', tilDato: '29-02-2024', ydelsestype: 'sygedagpenge', ydelse: { kind: 'number', value: 400 }, tillaeg: undefined },
    ];

    renderOffentligeYdelserSection(ctx);

    // Én ydelsestype → ét subheader-kald
    expect(renderSubheader).toHaveBeenCalledTimes(1);
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
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
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
      startBilagPage: vi.fn(),
      renderSubheader: vi.fn(),
      shouldIncludeOffentligYdelseRowInBilag: vi.fn(() => true),
      bilagIndkomstYdelserMode: 'Alle',
      bilagIndkomstYdelserRanges: [],
      writer: {
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
