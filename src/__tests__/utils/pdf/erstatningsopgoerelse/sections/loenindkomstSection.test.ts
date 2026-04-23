import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getStandardLoenTableHeaders } from '../../../../../domain/aarsloen/standardLoenTableColumns';
import { toISODateString } from '../../../../../types/branded';
import { renderLoenindkomstSection } from '../../../../../pdf/domains/eo/sections/loenindkomstSection';
import type { SelectedElements } from '../../../../../pdf/domains/eo/types';

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
  eoValues.tafBeregningsperiodeFra = iso('2024-01-01');
  eoValues.tafBeregningsperiodeTil = iso('2024-01-31');
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
  const startEoBilagPage = vi.fn();

  return {
    renderSubheader,
    startEoBilagPage,
    ctx: {
      selectedElements,
      eoValues,
      lineHeight: 4,
      startEoBilagPage,
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
      shouldIncludeLoenRowInEoBilag: vi.fn(({ ranges }) => {
        return ranges.some((range) => includeRangeFromDates.has(range.fra));
      }),
      eoBilagIndkomstYdelserMode: 'Perioden' as const,
      eoBilagIndkomstYdelserRanges: [],
      writer: {
        addSectionSpacer: vi.fn(),
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
  it('returnerer tidligt uden at kalde startEoBilagPage når loenindkomst=false', () => {
    const { ctx, startEoBilagPage } = makeContext(new Set(['2022-10-01']));
    ctx.selectedElements = { ...selectedElements, loenindkomst: false };

    renderLoenindkomstSection(ctx);

    expect(startEoBilagPage).not.toHaveBeenCalled();
  });

  it('returnerer tidligt uden at kalde startEoBilagPage når ingen rækker opfylder filteret', () => {
    // shouldIncludeLoenRowInEoBilag returnerer altid false (tom includeSet)
    const { ctx, startEoBilagPage } = makeContext(new Set());

    renderLoenindkomstSection(ctx);

    expect(startEoBilagPage).not.toHaveBeenCalled();
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

    expect(renderSubheader).not.toHaveBeenCalledWith('TAF-periode', undefined, { addTopSpacing: false });
    expect(renderSubheader).not.toHaveBeenCalledWith('Beregningsperiode', undefined, { addTopSpacing: false });
    expect(renderSubheader).toHaveBeenCalledWith('Kerteminde Kommune', undefined, { addTopSpacing: false });
  });

  it('viser heller ikke TAF-/Beregningsperiode-underoverskrifter når begge periodegrupper har rækker', () => {
    const { ctx, renderSubheader } = makeContext(new Set(['2022-10-01', '2024-01-01']));

    renderLoenindkomstSection(ctx);

    expect(renderSubheader).not.toHaveBeenCalledWith('TAF-periode', undefined, { addTopSpacing: false });
    expect(renderSubheader).not.toHaveBeenCalledWith('Beregningsperiode', undefined, { addTopSpacing: false });
    expect(renderSubheader).toHaveBeenCalledWith('Kerteminde Kommune', undefined, { addTopSpacing: false });
    expect(renderSubheader.mock.calls.filter(([text]) => text === 'Kerteminde Kommune')).toHaveLength(1);
  });

  it('fordeler lønindkomstkolonner over fuld tabelbredde i PDF', () => {
    autoTableMock.mockClear();
    const { ctx } = makeContext(new Set(['2022-10-01']));

    renderLoenindkomstSection(ctx);

    expect(autoTableMock).toHaveBeenCalled();
    const firstCall = autoTableMock.mock.calls[0]?.[1];
    const columnStyles = firstCall?.columnStyles as Record<number, { cellWidth: number }>;
    const firstColumnStyle = columnStyles[0];
    const totalWidth = Object.values(columnStyles).reduce((sum, style) => sum + style.cellWidth, 0);

    expect(totalWidth).toBeCloseTo(170, 6);
    expect(firstColumnStyle.cellWidth).toBeGreaterThan(22);
  });

  it('beregner FP/FV/SH/SO/St.B. i PDF-tabellen efter satsen i den enkelte lønrække', () => {
    autoTableMock.mockClear();
    const { ctx } = makeContext(new Set(['2022-10-01']));
    ctx.eoValues.beregnesUdFra = 'Angivet månedsløn';
    ctx.eoValues.loenindkomstAnsaettelsesforhold[0] = {
      ...ctx.eoValues.loenindkomstAnsaettelsesforhold[0],
      loenperiode: 'dag',
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      shSoPct: 0,
      indtaegtsoplysningerTableData: [
        {
          id: 'row-1',
          col0_maaned: '',
          col1_maaned: '',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '01-01-2024',
          col1_dag: '31-01-2024',
          col2: { kind: 'number', value: 3100 },
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
      loenudviklingManuelTableData: [
        { id: 'base', dato: '', grundloen: { kind: 'number', value: 0 }, feriepenge: '', shSoSats: '0', fritvalg: '', agPension: '' },
        { id: 'step', dato: '15-01-2024', grundloen: { kind: 'number', value: 0 }, feriepenge: '', shSoSats: '10', fritvalg: '', agPension: '' },
      ],
    };
    ctx.getLoenindkomstTableHeaders = vi.fn(() => getStandardLoenTableHeaders('dag'));
    ctx.resolvePeriodColumns = vi.fn(() => ['01-01-2024', '31-01-2024'] as const);

    renderLoenindkomstSection(ctx);

    expect(autoTableMock).toHaveBeenCalled();
    const firstCall = autoTableMock.mock.calls[0]?.[1];
    const body = firstCall?.body as Array<Array<{ content: string }>>;
    expect(body[1]?.some((cell) => cell.content === '183,95')).toBe(true);
    expect(body[1]?.some((cell) => cell.content === '3.283,95')).toBe(true);
  });

  it('respekterer arbejdsdagsfradrag i PDF-tabellen ved manuel satsfordeling', () => {
    autoTableMock.mockClear();
    const { ctx } = makeContext(new Set(['2022-10-01']));
    ctx.eoValues.beregnesUdFra = 'Angivet dagsløn';
    ctx.eoValues.ferieperioder = [{ id: 'ferie-1', fra: iso('2024-01-11'), til: iso('2024-01-11') }];
    ctx.eoValues.fravaerPerioder = [{ id: 'fravaer-1', fra: iso('2024-01-12'), til: iso('2024-01-12') }];
    ctx.eoValues.loenindkomstAnsaettelsesforhold[0] = {
      ...ctx.eoValues.loenindkomstAnsaettelsesforhold[0],
      loenperiode: 'dag',
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      shSoPct: 0,
      indtaegtsoplysningerTableData: [
        {
          id: 'row-1',
          col0_maaned: '',
          col1_maaned: '',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '08-01-2024',
          col1_dag: '12-01-2024',
          col2: { kind: 'number', value: 1000 },
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
      loenudviklingManuelTableData: [
        { id: 'base', dato: '', grundloen: { kind: 'number', value: 0 }, feriepenge: '', shSoSats: '0', fritvalg: '', agPension: '' },
        { id: 'step', dato: '10-01-2024', grundloen: { kind: 'number', value: 0 }, feriepenge: '', shSoSats: '10', fritvalg: '', agPension: '' },
      ],
    };
    ctx.getLoenindkomstTableHeaders = vi.fn(() => getStandardLoenTableHeaders('dag'));
    ctx.resolvePeriodColumns = vi.fn(() => ['08-01-2024', '12-01-2024'] as const);

    renderLoenindkomstSection(ctx);

    expect(autoTableMock).toHaveBeenCalled();
    const firstCall = autoTableMock.mock.calls[0]?.[1];
    const body = firstCall?.body as Array<Array<{ content: string }>>;
    expect(body[1]?.some((cell) => cell.content === '37,83')).toBe(true);
    expect(body[1]?.some((cell) => cell.content === '1.037,83')).toBe(true);
  });
});
