import type { AppSettings } from '../../../settings/appSettingsSchema';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { EoModel } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { EoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import type { EoInspektionViewReady } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToInspektionView';
import { toISODateString } from '../../../types/branded';

const mockBuildOffentligeYdelserReguleringTableData = vi.hoisted(() => vi.fn());

vi.mock('../../../domain/erstatningsopgoerelse/engines/offentligeYdelserUdviklingBeregning', () => ({
  buildOffentligeYdelserReguleringTableData: mockBuildOffentligeYdelserReguleringTableData,
}));

let buildEOInspektionPageViewModel: typeof import('../../../domain/eoInspektion/eoInspektionPageViewModel')['buildEOInspektionPageViewModel'];

const iso = (value: string) => toISODateString(value);

describe('buildEOInspektionPageViewModel', () => {
  beforeAll(async () => {
    ({ buildEOInspektionPageViewModel } = await import('../../../domain/eoInspektion/eoInspektionPageViewModel'));
  });

  beforeEach(() => {
    mockBuildOffentligeYdelserReguleringTableData.mockReset();
  });

  const createViewWithOffentligeYdelserUdvikling = (): EoInspektionViewReady => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Ja';
    const pdfModel = {
      tabtArbejdsfortjeneste: {
        offentligeYdelserUdvikling: {
          reguleringsLabel: 'Statslig regulering per 1. januar',
          reguleringsBaseIso: iso('2024-01-31'),
          beregningsenhed: 'Måneder',
          entries: [{
            typeKey: 'dagpenge',
            label: 'Dagpenge',
            beregnedeSegmenter: [],
            total: { status: 'ok', value: 0 },
          }],
          total: { status: 'ok', value: 0 },
        },
      },
    } as unknown as EoModel;

    return {
      kind: 'ready',
      canonicalOutput: undefined,
      inspektionSnapshot: {} as NonNullable<EoSnapshot['inspektionSnapshot']>,
      stamdataValues: STAMDATA_INITIAL_VALUES,
      erstatningsopgoerelseValues: eoValues,
      rowsBySection: new Map(),
      regulationSections: [],
      pdfModel,
    };
  };

  it('viser reguleringstabel og basisdato for offentlige ydelser når tabeldata kan bygges', () => {
    mockBuildOffentligeYdelserReguleringTableData.mockReturnValue({
      columns: ['Reguleringsdato', 'Regulering', 'Akkumuleret regulering'],
      rows: [['01-01-2025', '3,9 %', '3,9 %']],
    });

    const result = buildEOInspektionPageViewModel(createViewWithOffentligeYdelserUdvikling(), {} as AppSettings);

    expect(result.offentligeYdelserRows).toEqual([expect.objectContaining({
      id: 'offentligeYdelser.regulering.anvendtReguleringsdato',
      displayValue: '31-01-2024',
      status: 'ok',
    })]);
    expect(result.offentligeYdelserTables).toEqual([{
      id: 'offentligeYdelser.regulering.vaerdier',
      title: 'Reguleringsværdier:',
      columns: ['Reguleringsdato', 'Regulering', 'Akkumuleret regulering'],
      rows: [{
        id: 'offentligeYdelser.regulering.vaerdier.0',
        cells: ['01-01-2025', '3,9 %', '3,9 %'],
      }],
    }]);
  });

  it('bevarer kontrolvisningen hvis reguleringstabel for offentlige ydelser ikke kan bygges', () => {
    mockBuildOffentligeYdelserReguleringTableData.mockImplementation(() => {
      throw new Error('Reguleringssats mangler');
    });

    const result = buildEOInspektionPageViewModel(createViewWithOffentligeYdelserUdvikling(), {} as AppSettings);

    expect(result.offentligeYdelserTables).toEqual([]);
    expect(result.offentligeYdelserRows).toEqual([]);
  });
});
