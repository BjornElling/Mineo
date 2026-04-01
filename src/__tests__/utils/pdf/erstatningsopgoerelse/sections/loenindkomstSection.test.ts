import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getStandardLoenTableHeaders } from '../../../../../domain/aarsloen/standardLoenTableColumns';
import { toISODateString } from '../../../../../types/branded';
import { renderLoenindkomstSection } from '../../../../../utils/pdf/erstatningsopgoerelse/sections/loenindkomstSection';
import type { SelectedElements } from '../../../../../utils/pdf/erstatningsopgoerelse/types';

const { autoTableMock } = vi.hoisted(() => ({
  autoTableMock: vi.fn((doc: Record<string, unknown>, options: { startY?: number }) => {
    doc.lastAutoTable = { finalY: (options.startY ?? 0) + 10 };
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

const selectedElements: SelectedElements = {
  opgoerelse: false,
  loenindkomst: true,
  offentligeYdelser: false,
  shDage: false,
  regulering: false,
  okSatser: false,
  sygeferiegodtgoerelse: false,
};

const createEmployment = () => createDefaultLoenindkomstAnsaettelsesforhold();

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
      ...createEmployment(),
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
  const doc = createMockPdfDoc();
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
      getLoenindkomstTableHeaders: vi.fn(() => getStandardLoenTableHeaders('dag')),
      resolvePeriodColumns: vi.fn(() => ['01-10-2022', '31-10-2022'] as const),
      hasNonZeroLoenAmount: vi.fn((value) => Boolean(value && value.kind === 'number' && value.value !== 0)),
      shouldIncludeLoenRowInBilag: vi.fn(({ ranges }) => {
        return ranges.some((range) => includeRangeFromDates.has(range.fra));
      }),
      bilagIndkomstYdelserMode: 'Perioden' as const,
      bilagIndkomstYdelserRanges: [],
      writer: {
        addSpacer: vi.fn(),
        setY: vi.fn((nextY: number) => {
          y = nextY;
        }),
        getY: vi.fn(() => y),
        getDoc: vi.fn(() => doc),
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
    ctx.eoValues.loenindkomstAnsaettelsesforhold[0].ansatPaaSkadestidspunktet = true;
    ctx.eoValues.loenindkomstAnsaettelsesforhold[0].ansaettelsesforholdOphoert = true;
    ctx.eoValues.loenindkomstAnsaettelsesforhold[0].sidsteArbejdsdag = undefined;

    renderLoenindkomstSection(ctx);

    expect(ctx.safeAddWrappedText).toHaveBeenCalledWith('Skadelidte er opsagt fra stillingen.');
  });

  it('viser opsigelseslinje med sidste arbejdsdag når dato er angivet', () => {
    const { ctx } = makeContext(new Set(['2022-10-01']));
    ctx.eoValues.loenindkomstAnsaettelsesforhold[0].ansatPaaSkadestidspunktet = true;
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

  it('viser heller ikke TAF-/Beregningsperiode-underoverskrifter når begge periodegrupper har rækker', () => {
    const { ctx, renderSubheader } = makeContext(new Set(['2022-10-01', '2024-01-01']));

    renderLoenindkomstSection(ctx);

    expect(renderSubheader).not.toHaveBeenCalledWith('TAF-periode', expect.anything(), expect.anything());
    expect(renderSubheader).not.toHaveBeenCalledWith('Beregningsperiode', expect.anything(), expect.anything());
    expect(renderSubheader).toHaveBeenCalledWith('Kerteminde Kommune', expect.anything(), expect.anything());
    expect(renderSubheader.mock.calls.filter(([text]) => text === 'Kerteminde Kommune')).toHaveLength(1);
  });

  it('fordeler lønindkomstkolonner over fuld tabelbredde i PDF', () => {
    autoTableMock.mockClear();
    const { ctx } = makeContext(new Set(['2022-10-01']));

    renderLoenindkomstSection(ctx);

    expect(autoTableMock).toHaveBeenCalled();
    const firstCall = autoTableMock.mock.calls[0]?.[1];
    const firstColumnStyle = (firstCall?.columnStyles as Record<number, { cellWidth: number }>)[0];

    expect(firstColumnStyle.cellWidth).toBeCloseTo(170 / 7, 6);
    expect(firstColumnStyle.cellWidth).toBeGreaterThan(22);
  });
});
