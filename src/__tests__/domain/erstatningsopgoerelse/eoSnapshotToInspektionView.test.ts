
const {
  buildRegulationTimelineMock,
  buildRegulationInspektionSectionsMock,
  executeEoRowBuilderEntriesBySectionMock,
} = vi.hoisted(() => ({
  buildRegulationTimelineMock: vi.fn(() => ({ ansaettelser: [] })),
  buildRegulationInspektionSectionsMock: vi.fn(() => []),
  executeEoRowBuilderEntriesBySectionMock: vi.fn((..._args: unknown[]) => new Map()),
}));

vi.mock('../../../domain/eoRowEvaluation/eoRowBuilderRegistry', () => ({
  EO_ROW_BUILDERS: [
    {
      section: 'stamdata',
      run: (ctx: { stamdataValues: { journalnr?: string } }) => [
        { id: 'stamdata.journalnr', label: 'Journalnr', displayValue: ctx.stamdataValues.journalnr ?? '-', status: 'ok' },
      ],
    },
    {
      section: 'taf',
      run: () => {
        throw new Error('Builder sprængte');
      },
    },
  ],
  executeEoRowBuilderEntriesBySection: executeEoRowBuilderEntriesBySectionMock,
}));

vi.mock('../../../domain/eoInspektion/eoInspektionRegulationCore', () => ({
  buildRegulationTimeline: buildRegulationTimelineMock,
}));

vi.mock('../../../domain/eoInspektion/eoInspektionRegulationViewModel', () => ({
  buildRegulationInspektionSections: buildRegulationInspektionSectionsMock,
}));

import { eoSnapshotToInspektionView } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToInspektionView';
import type { EoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import type { EOInspektionSnapshot } from '../../../domain/eoInspektion/eoInspektionSnapshot';
import { DEFAULT_EO_ROW_POLICY } from '../../../settings/sourceSettings';
import { toISODateString } from '../../../types/branded';

describe('eoSnapshotToInspektionView', () => {
  beforeEach(() => {
    executeEoRowBuilderEntriesBySectionMock.mockReset();
    executeEoRowBuilderEntriesBySectionMock.mockReturnValue(new Map());
    buildRegulationTimelineMock.mockClear();
    buildRegulationTimelineMock.mockReturnValue({ ansaettelser: [] });
    buildRegulationInspektionSectionsMock.mockClear();
    buildRegulationInspektionSectionsMock.mockReturnValue([]);
  });

  it('bruger strukturerede snapshot-data og delegerer builder-kørslen til registry', () => {
    executeEoRowBuilderEntriesBySectionMock.mockReturnValue(new Map([
      ['stamdata', [
        { id: 'stamdata.journalnr', label: 'Journalnr', displayValue: 'J-1', status: 'ok' },
      ]],
      ['taf', [
        {
          id: 'eo.rowBuilder.taf.exception',
          label: 'Fejl i række-builder (taf)',
          displayValue: 'Fejl (Række-builder-fejl: Builder sprængte)',
          status: 'error',
        },
      ]],
    ]));

    const inspektionSnapshot = {
      model: {
        tableData: {
          dates: [toISODateString('2024-01-01')],
          weekdayIndexByRow: [1],
          isSognehelligdagByIndex: [true],
          isWorkdayByIndex: [false],
          ssStatusByIndex: ['Ja'],
          svieSmerteByIndex: ['Fuld'],
          tafDayStatusByIndex: ['Ja'],
          tafColumnIds: ['base:taf_day'],
          tafFlagsByIndex: [new Set(['base:taf_day'])],
        },
      },
      inspektionDays: [
        {
          iso: toISODateString('2024-01-01'),
          weekday: 1,
          isWeekend: false,
          isSognehelligdag: true,
          isArbejdsdag: false,
          tafFlags: new Set(['base:taf_day']),
          svieSmerte: 'Fuld',
        },
      ],
      sammentaellingRows: [],
      stamdataValues: { journalnr: 'J-1' },
      eoValues: {
        midlertidigtEETAfgorelse: 'Nej',
        endeligtEETAfgorelse: 'Nej',
      },
      fieldErrors: {
        stamdata: {},
        erstatningsopgoerelse: {},
      },
    } as unknown as EOInspektionSnapshot;

    const staleInputValues = {
      journalnr: 'STALE',
    };

    const view = eoSnapshotToInspektionView({
      snapshot: {
        revision: 'rev-1',
        status: 'ok',
        invariants: [],
        inspektionSnapshot,
        data: {
          canonicalOutput: { marker: 'canonical' },
          inspektionSnapshot,
        },
        input: {
          stamdata: staleInputValues,
          erstatningsopgoerelse: { stale: true },
        },
      } as unknown as EoSnapshot,
      rowPolicy: DEFAULT_EO_ROW_POLICY,
      loenindkomstManuelReguleringInputErrors: {},
    });

    expect(view.kind).toBe('ready');
    if (view.kind !== 'ready') return;

    expect(view.rowsBySection.get('stamdata')).toEqual([
      { id: 'stamdata.journalnr', label: 'Journalnr', displayValue: 'J-1', status: 'ok' },
    ]);
    expect(view.rowsBySection.get('taf')).toEqual([
      {
        id: 'eo.rowBuilder.taf.exception',
        label: 'Fejl i række-builder (taf)',
        displayValue: 'Fejl (Række-builder-fejl: Builder sprængte)',
        status: 'error',
      },
    ]);
    expect(executeEoRowBuilderEntriesBySectionMock).toHaveBeenCalledTimes(1);
    const [entriesArg, ctxArg] = executeEoRowBuilderEntriesBySectionMock.mock.calls[0] ?? [];
    expect(entriesArg).toEqual(expect.any(Array));
    expect(ctxArg).toMatchObject({
      stamdataValues: inspektionSnapshot.stamdataValues,
      eoValues: inspektionSnapshot.eoValues,
      stamdataErrors: inspektionSnapshot.fieldErrors.stamdata,
      eoErrors: inspektionSnapshot.fieldErrors.erstatningsopgoerelse,
      loenindkomstManuelReguleringInputErrors: {},
      rowPolicy: DEFAULT_EO_ROW_POLICY,
      canonicalOutput: { marker: 'canonical' },
    });
    expect(buildRegulationTimelineMock).toHaveBeenCalledWith({
      eoValues: inspektionSnapshot.eoValues,
      stamdataValues: inspektionSnapshot.stamdataValues,
      loenudvikling: null,
    });
  });

  it('returnerer blocked-view ved fail_closed snapshot uden kontrol-data', () => {
    const view = eoSnapshotToInspektionView({
      snapshot: {
        revision: 'rev-fail',
        status: 'fail_closed',
        invariants: [{
          id: 'runtime_exception',
          passed: false,
          severity: 'error',
          source: 'system' as const,
          message: 'Intern fejl',
        }],
        data: null,
        inspektionSnapshot: null,
        input: {
          stamdata: null,
          erstatningsopgoerelse: null,
        },
      } as unknown as EoSnapshot,
      rowPolicy: DEFAULT_EO_ROW_POLICY,
      loenindkomstManuelReguleringInputErrors: {},
    });

    expect(view).toEqual({
      kind: 'blocked',
      severity: 'error',
      title: 'EO-kontrol er blokeret',
      message: 'Intern fejl',
    });
  });

  it('fail-closer reguleringsforløbet (loenudvikling=null) i validerings-fejl-stien selv om inspektionSnapshot findes', () => {
    // Brugerbeslutning (greenfield #23-review): når autoritativ beregning er blokeret af en
    // valideringsfejl, bygges pdfModel ikke, og reguleringsafsnittet må derfor IKKE re-derivere en
    // serie. Kontrollaget modtager `loenudvikling: null`/`undefined`, så reguleringstabellerne
    // fail-closer til placeholders. Genindfør ikke et fejl-tilstands-forløb uden en ny beslutning.
    const inspektionSnapshot = {
      model: {
        tableData: {
          dates: [toISODateString('2024-01-01')],
          weekdayIndexByRow: [1],
          isSognehelligdagByIndex: [false],
          isWorkdayByIndex: [true],
          ssStatusByIndex: ['Nej'],
          svieSmerteByIndex: ['Ingen'],
          tafDayStatusByIndex: [''],
          tafColumnIds: [],
          tafFlagsByIndex: [new Set<string>()],
        },
      },
      inspektionDays: [],
      sammentaellingRows: [],
      stamdataValues: {
        journalnr: 'J-2',
        skadedato: toISODateString('2024-01-01'),
        skadestype: 'Arbejdsulykke',
      },
      eoValues: {
        midlertidigtEETAfgorelse: 'Nej',
        endeligtEETAfgorelse: 'Nej',
      },
      fieldErrors: {
        stamdata: {},
        erstatningsopgoerelse: {},
      },
    } as never;

    const view = eoSnapshotToInspektionView({
      snapshot: {
        revision: 'rev-error',
        status: 'error',
        invariants: [{
          id: 'validation:loenindkomstAnsaettelsesforhold[0].loenudviklingBeregningsgrundlag',
          passed: false,
          severity: 'error',
          source: 'validation' as const,
          message: 'Lønregulering skal vælges, evt. "Ingen"',
        }],
        data: null,
        inspektionSnapshot,
        input: {
          stamdata: {
            journalnr: 'J-2',
            skadedato: toISODateString('2024-01-01'),
            skadestype: 'Arbejdsulykke',
          },
          erstatningsopgoerelse: {
            midlertidigtEETAfgorelse: 'Nej',
            endeligtEETAfgorelse: 'Nej',
          },
        },
      } as never,
      rowPolicy: DEFAULT_EO_ROW_POLICY,
      loenindkomstManuelReguleringInputErrors: {},
    });

    expect(view.kind).toBe('ready');
    if (view.kind !== 'ready') return;

    // Reguleringsforløbet får ingen autoritativ serie i fejl-tilstand → fail-closed placeholders.
    expect(buildRegulationTimelineMock).toHaveBeenCalledWith(
      expect.objectContaining({ loenudvikling: null }),
    );
    const sectionsArg = (buildRegulationInspektionSectionsMock.mock.calls[0] as unknown[] | undefined)?.[0] as
      | { loenudvikling?: unknown }
      | undefined;
    expect(sectionsArg?.loenudvikling).toBeUndefined();
  });
});
