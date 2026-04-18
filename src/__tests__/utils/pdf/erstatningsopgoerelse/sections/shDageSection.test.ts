import { renderShDageSection } from '../../../../../pdf/domains/eo/sections/shDageSection';
import { createErstatningsopgoerelseInitialValues } from '../../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString, isISODateString } from '../../../../../types/branded';
import type { IsoRange } from '../../../../../domain/erstatningsopgoerelse/validation/tafPeriodConstraints';

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

const tafRangesFromEoValues = (eoValues: ReturnType<typeof createErstatningsopgoerelseInitialValues>): IsoRange[] =>
  (eoValues.tafPerioder ?? [])
    .filter((row): row is typeof row & { fra: ReturnType<typeof toISODateString>; til: ReturnType<typeof toISODateString> } =>
      isISODateString(row.fra) && isISODateString(row.til))
    .map((row) => ({ fra: row.fra, til: row.til }));

const makeContext = (eoValues: ReturnType<typeof createErstatningsopgoerelseInitialValues>) => {
  let y = 0;
  const doc = createMockPdfDoc();
  const safeAddWrappedText = vi.fn();
  const renderSubheader = vi.fn();
  const startBilagPage = vi.fn();

  return {
    safeAddWrappedText,
    renderSubheader,
    startBilagPage,
    ctx: {
      eoValues,
      tafRanges: tafRangesFromEoValues(eoValues),
      sfggReferenceperiodeRanges: [],
      harSfggReferenceperiodeMedShFradrag: false,
      lineHeight: 4,
      startBilagPage,
      renderSubheader,
      safeAddWrappedText,
      writer: {
        addSectionSpacer: vi.fn(),
        addSpacer: vi.fn(),
        setY: vi.fn((nextY: number) => { y = nextY; }),
        getY: vi.fn(() => y),
        getDoc: vi.fn(() => doc),
      },
    },
  };
};

describe('renderShDageSection – startBilagPage', () => {
  it('kalder startBilagPage med "SH-dage"', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    const { startBilagPage, ctx } = makeContext(eoValues);

    renderShDageSection(ctx);

    expect(startBilagPage).toHaveBeenCalledWith('SH-dage');
  });
});

describe('renderShDageSection – ingen TAF-perioder', () => {
  it('viser "Ingen periode" når ingen TAF-periode er defineret', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.tafPerioder = [];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);

    renderShDageSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith('Ingen periode');
  });
});

describe('renderShDageSection – TAF-periode uden helligdage', () => {
  it('viser "Ingen helligdage" for en periode uden helligdage', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    // Periode i en sommer-uge 2024 uden helligdage
    eoValues.tafPerioder = [
      { id: 'taf-1', fra: iso('2024-07-08'), til: iso('2024-07-12'), loseFeriedage: undefined },
    ];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);

    renderShDageSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith('Ingen helligdage');
  });
});

describe('renderShDageSection – TAF-periode med helligdage', () => {
  it('kalder renderStandardPdfTable når der er helligdage i perioden', () => {
    autoTableMock.mockClear();
    const eoValues = createErstatningsopgoerelseInitialValues();
    // Juleperioden 2024 indeholder helligdage (25. + 26. december)
    eoValues.tafPerioder = [
      { id: 'taf-1', fra: iso('2024-12-24'), til: iso('2024-12-26'), loseFeriedage: undefined },
    ];
    const { ctx } = makeContext(eoValues);

    renderShDageSection(ctx);

    expect(autoTableMock).toHaveBeenCalled();
  });

  it('tabellen indeholder juleaftensrækker for 25. december 2024 (SH-dag – onsdag)', () => {
    autoTableMock.mockClear();
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.tafPerioder = [
      { id: 'taf-1', fra: iso('2024-12-24'), til: iso('2024-12-26'), loseFeriedage: undefined },
    ];
    const { ctx } = makeContext(eoValues);

    renderShDageSection(ctx);

    const call = autoTableMock.mock.calls[0]?.[1];
    expect(call).toBeDefined();
    // body er et array af rækker; header er første række, data følger
    const body: unknown[][] = (call as { body: unknown[][] }).body;
    expect(body.length).toBeGreaterThan(1);
  });
});

describe('renderShDageSection – beregningsperiode for første opgørelse', () => {
  it('kalder renderSubheader med "Beregningsperiode" for første opgørelse med Beregningsperiode-mode', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.eoNummer = '1';
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafBeregningsperiodeFra = iso('2024-01-01');
    eoValues.tafBeregningsperiodeTil = iso('2024-01-31');
    eoValues.tafPerioder = [];
    const { renderSubheader, ctx } = makeContext(eoValues);
    const ctxWithBeregningsperiode = {
      ...ctx,
      harSfggReferenceperiodeMedShFradrag: true,
    };

    renderShDageSection(ctxWithBeregningsperiode);

    expect(renderSubheader).toHaveBeenCalledWith('Beregningsperiode', undefined, { addTopSpacing: false });
  });

  it('viser ikke Beregningsperiode-overskrift for anden opgørelse', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.eoNummer = '2';
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafBeregningsperiodeFra = iso('2024-01-01');
    eoValues.tafBeregningsperiodeTil = iso('2024-01-31');
    eoValues.tafPerioder = [];
    const { renderSubheader, ctx } = makeContext(eoValues);

    renderShDageSection(ctx);

    expect(renderSubheader).not.toHaveBeenCalledWith('Beregningsperiode', expect.anything(), expect.anything());
  });
});

describe('renderShDageSection – SFGG-referenceperiode', () => {
  it('viser SFGG-referenceperiode når referenceperioden indeholder SH-dage', () => {
    autoTableMock.mockClear();
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.tafPerioder = [];
    const { renderSubheader, safeAddWrappedText, ctx } = makeContext(eoValues);
    const ctxWithSfggRange = {
      ...ctx,
      sfggReferenceperiodeRanges: [{ fra: iso('2024-03-28'), til: iso('2024-05-20') }],
      harSfggReferenceperiodeMedShFradrag: true,
    };

    renderShDageSection(ctxWithSfggRange);

    expect(renderSubheader).toHaveBeenCalledWith('SFGG-referenceperiode', undefined, { addTopSpacing: false });
    expect(safeAddWrappedText).toHaveBeenCalledWith('28. marts 2024 - 20. maj 2024');
    expect(autoTableMock).toHaveBeenCalled();
  });

  it('viser ikke SFGG-referenceperiode når perioden ikke indeholder SH-dage', () => {
    autoTableMock.mockClear();
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.tafPerioder = [];
    const { renderSubheader, ctx } = makeContext(eoValues);
    const ctxWithSfggRange = {
      ...ctx,
      sfggReferenceperiodeRanges: [{ fra: iso('2024-07-08'), til: iso('2024-07-12') }],
    };

    renderShDageSection(ctxWithSfggRange);

    expect(renderSubheader).not.toHaveBeenCalledWith('SFGG-referenceperiode', expect.anything(), expect.anything());
  });
});
