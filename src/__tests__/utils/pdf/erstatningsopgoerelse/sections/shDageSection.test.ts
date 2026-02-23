import { describe, expect, it, vi } from 'vitest';
import { renderShDageSection } from '../../../../../utils/pdf/erstatningsopgoerelse/sections/shDageSection';
import { createErstatningsopgoerelseInitialValues } from '../../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../../../types/branded';

const iso = (value: string) => toISODateString(value);

const makeContext = (eoValues: ReturnType<typeof createErstatningsopgoerelseInitialValues>) => {
  let y = 0;
  const safeAddWrappedText = vi.fn();
  const renderSubheader = vi.fn();
  const startBilagPage = vi.fn();
  const renderStandardPdfTable = vi.fn(({ startY }: { startY: number }) => startY + 20);

  return {
    safeAddWrappedText,
    renderSubheader,
    startBilagPage,
    renderStandardPdfTable,
    ctx: {
      eoValues,
      lineHeight: 4,
      startBilagPage,
      renderSubheader,
      safeAddWrappedText,
      renderStandardPdfTable,
      writer: {
        addSpacer: vi.fn(),
        setY: vi.fn((nextY: number) => { y = nextY; }),
        getY: vi.fn(() => y),
        getDoc: vi.fn(() => ({})),
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
    const eoValues = createErstatningsopgoerelseInitialValues();
    // Juleperioden 2024 indeholder helligdage (25. + 26. december)
    eoValues.tafPerioder = [
      { id: 'taf-1', fra: iso('2024-12-24'), til: iso('2024-12-26'), loseFeriedage: undefined },
    ];
    const { renderStandardPdfTable, ctx } = makeContext(eoValues);

    renderShDageSection(ctx);

    expect(renderStandardPdfTable).toHaveBeenCalled();
  });

  it('tabellen indeholder juleaftensrækker for 25. december 2024 (SH-dag – onsdag)', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.tafPerioder = [
      { id: 'taf-1', fra: iso('2024-12-24'), til: iso('2024-12-26'), loseFeriedage: undefined },
    ];
    const { renderStandardPdfTable, ctx } = makeContext(eoValues);

    renderShDageSection(ctx);

    const call = renderStandardPdfTable.mock.calls[0]?.[0];
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
    eoValues.periodeTilBeregningFra = iso('2024-01-01');
    eoValues.periodeTilBeregningTil = iso('2024-01-31');
    eoValues.tafPerioder = [];
    const { renderSubheader, ctx } = makeContext(eoValues);

    renderShDageSection(ctx);

    expect(renderSubheader).toHaveBeenCalledWith('Beregningsperiode', expect.anything(), expect.anything());
  });

  it('viser ikke Beregningsperiode-overskrift for anden opgørelse', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.eoNummer = '2';
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.periodeTilBeregningFra = iso('2024-01-01');
    eoValues.periodeTilBeregningTil = iso('2024-01-31');
    eoValues.tafPerioder = [];
    const { renderSubheader, ctx } = makeContext(eoValues);

    renderShDageSection(ctx);

    expect(renderSubheader).not.toHaveBeenCalledWith('Beregningsperiode', expect.anything(), expect.anything());
  });
});
