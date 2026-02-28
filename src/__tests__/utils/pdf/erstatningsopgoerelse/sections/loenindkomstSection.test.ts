import { describe, expect, it, vi } from 'vitest';
import { createErstatningsopgoerelseInitialValues } from '../../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../../../types/branded';
import { renderLoenindkomstSection } from '../../../../../utils/pdf/erstatningsopgoerelse/sections/loenindkomstSection';
import type { SelectedElements } from '../../../../../utils/pdf/erstatningsopgoerelse/types';

const iso = (value: string) => toISODateString(value);

const selectedElements: SelectedElements = {
  opgoerelse: false,
  loenindkomst: true,
  offentligeYdelser: false,
  shDage: false,
  regulering: false,
  okSatser: false,
  sygeferiegodtgoerelse: false,
};

const makeContext = (includeRangeFromDates: ReadonlySet<string>) => {
  const eoValues = createErstatningsopgoerelseInitialValues();
  eoValues.beregnesUdFra = 'Beregningsperiode';
  eoValues.eoNummer = '1';
  eoValues.periodeTilBeregningFra = iso('2024-01-01');
  eoValues.periodeTilBeregningTil = iso('2024-01-31');
  eoValues.tafPerioder = [
    {
      id: 'taf-1',
      fra: iso('2022-10-01'),
      til: iso('2022-12-31'),
      loseFeriedage: undefined,
    },
  ];
  eoValues.loenindkomstAnsaettelsesforhold = [
    {
      ...eoValues.loenindkomstAnsaettelsesforhold[0],
      id: 'af-1',
      navnPaaArbejdssted: 'Kerteminde Kommune',
      ansatPaaSkadestidspunktet: false,
      indtaegtsoplysningerTableData: [
        {
          id: 'row-1',
          col0_maaned: '10',
          col1_maaned: '2022',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: { kind: 'number', value: 1000 },
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
    },
  ];

  let y = 0;
  const renderSubheader = vi.fn();
  const startBilagPage = vi.fn();

  return {
    renderSubheader,
    startBilagPage,
    ctx: {
      selectedElements,
      eoValues,
      lineHeight: 4,
      startBilagPage,
      renderSubheader,
      safeAddWrappedText: vi.fn(),
      writeLabelValueLine: vi.fn(),
      formatDateLong: vi.fn(() => ''),
      resolveOverenskomstDisplay: vi.fn(() => ''),
      formatPctFromInput: vi.fn(() => ''),
      isZeroPct: vi.fn(() => true),
      getLoenindkomstTableHeaders: vi.fn(() => ['Dato fra', 'Dato til', 'Grundløn', 'A', 'B', 'C', 'Ferie', 'FP/FV', 'Pension', 'Samlet']),
      resolvePeriodColumns: vi.fn(() => ['01-10-2022', '31-10-2022'] as const),
      hasNonZeroLoenAmount: vi.fn((value) => Boolean(value && value.kind === 'number' && value.value !== 0)),
      shouldIncludeLoenRowInBilag: vi.fn(({ ranges }) => {
        const firstRange = ranges[0];
        if (!firstRange) return false;
        return includeRangeFromDates.has(firstRange.fra);
      }),
      bilagIndkomstYdelserMode: 'Perioden' as const,
      bilagIndkomstYdelserRanges: [],
      renderStandardPdfTable: vi.fn(({ startY }) => startY + 10),
      writer: {
        addSpacer: vi.fn(),
        setY: vi.fn((nextY: number) => {
          y = nextY;
        }),
        getY: vi.fn(() => y),
        getDoc: vi.fn(() => ({})),
      },
    },
  };
};

// ─── Gate: selectedElements.loenindkomst = false ──────────────────────────────

describe('renderLoenindkomstSection – gate', () => {
  it('returnerer tidligt uden at kalde startBilagPage når loenindkomst=false', () => {
    const { ctx, startBilagPage } = makeContext(new Set(['2022-10-01']));
    ctx.selectedElements = { ...selectedElements, loenindkomst: false };

    renderLoenindkomstSection(ctx);

    expect(startBilagPage).not.toHaveBeenCalled();
  });

  it('returnerer tidligt uden at kalde startBilagPage når ingen rækker opfylder filteret', () => {
    // shouldIncludeLoenRowInBilag returnerer altid false (tom includeSet)
    const { ctx, startBilagPage } = makeContext(new Set());

    renderLoenindkomstSection(ctx);

    expect(startBilagPage).not.toHaveBeenCalled();
  });
});

describe('renderLoenindkomstSection opsigelseslinje', () => {
  it('viser opsigelseslinje efter lønindkomsttabellen når ansættelsesforhold er opsagt', () => {
    const { ctx } = makeContext(new Set(['2022-10-01']));
    ctx.eoValues.loenindkomstAnsaettelsesforhold[0].ansaettelsesforholdOphoert = true;
    ctx.eoValues.loenindkomstAnsaettelsesforhold[0].sidsteArbejdsdag = undefined;

    renderLoenindkomstSection(ctx);

    expect(ctx.safeAddWrappedText).toHaveBeenCalledWith('Skadelidte er opsagt fra stillingen.');
  });

  it('viser opsigelseslinje med sidste arbejdsdag når dato er angivet', () => {
    const { ctx } = makeContext(new Set(['2022-10-01']));
    ctx.eoValues.loenindkomstAnsaettelsesforhold[0].ansaettelsesforholdOphoert = true;
    ctx.eoValues.loenindkomstAnsaettelsesforhold[0].sidsteArbejdsdag = iso('2024-04-30');
    ctx.formatDateLong = vi.fn(() => '30. april 2024');

    renderLoenindkomstSection(ctx);

    expect(ctx.safeAddWrappedText).toHaveBeenCalledWith(
      'Skadelidte er opsagt fra stillingen med sidste arbejdsdag 30. april 2024.'
    );
  });
});

// ─── Periode-underoverskrifter ─────────────────────────────────────────────────

describe('renderLoenindkomstSection periode-underoverskrifter', () => {
  it('viser ikke TAF-/Beregningsperiode-underoverskrift når kun én periodegruppe har rækker', () => {
    const { ctx, renderSubheader } = makeContext(new Set(['2022-10-01']));

    renderLoenindkomstSection(ctx);

    expect(renderSubheader).not.toHaveBeenCalledWith('TAF-periode', expect.anything(), expect.anything());
    expect(renderSubheader).not.toHaveBeenCalledWith('Beregningsperiode', expect.anything(), expect.anything());
    expect(renderSubheader).toHaveBeenCalledWith('Kerteminde Kommune', expect.anything(), expect.anything());
  });

  it('viser både TAF-/Beregningsperiode-underoverskrifter når begge periodegrupper har rækker', () => {
    const { ctx, renderSubheader } = makeContext(new Set(['2022-10-01', '2024-01-01']));

    renderLoenindkomstSection(ctx);

    expect(renderSubheader).toHaveBeenCalledWith('TAF-periode', expect.anything(), expect.anything());
    expect(renderSubheader).toHaveBeenCalledWith('Beregningsperiode', expect.anything(), expect.anything());
  });

  it('fordeler lønindkomstkolonner over fuld tabelbredde i PDF', () => {
    const { ctx } = makeContext(new Set(['2022-10-01']));

    renderLoenindkomstSection(ctx);

    const renderTableMock = vi.mocked(ctx.renderStandardPdfTable);
    expect(renderTableMock).toHaveBeenCalled();

    const firstCall = renderTableMock.mock.calls[0]?.[0];
    const firstColumnStyle = (firstCall?.columnStyles as Record<number, { cellWidth: number }>)[0];

    expect(firstColumnStyle.cellWidth).toBeCloseTo(170 / 7, 6);
    expect(firstColumnStyle.cellWidth).toBeGreaterThan(22);
  });
});
