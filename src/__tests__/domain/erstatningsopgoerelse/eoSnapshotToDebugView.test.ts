import { describe, expect, it, vi } from 'vitest';

const {
  buildRegulationTimelineMock,
  buildRegulationDebugSectionsMock,
} = vi.hoisted(() => ({
  buildRegulationTimelineMock: vi.fn(() => ({ ansaettelser: [] })),
  buildRegulationDebugSectionsMock: vi.fn(() => []),
}));

vi.mock('../../../domain/debug/eoDebugBuilderRegistry', () => ({
  EO_DEBUG_BUILDERS: [
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
}));

vi.mock('../../../domain/debug/eoDebugRegulationCore', () => ({
  buildRegulationTimeline: buildRegulationTimelineMock,
}));

vi.mock('../../../domain/debug/eoDebugRegulationViewModel', () => ({
  buildRegulationDebugSections: buildRegulationDebugSectionsMock,
}));

import { eoSnapshotToDebugView } from '../../../domain/erstatningsopgoerelse/eoSnapshotToDebugView';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';

describe('eoSnapshotToDebugView', () => {
  it('bruger strukturerede snapshot-data og isolerer builder-fejl pr. sektion', () => {
    const debugSnapshot = {
      model: {
        tableData: {
          dates: ['2024-01-01'],
          weekdayIndexByRow: [1],
          isSognehelligdagByIndex: [true],
          isWorkdayByIndex: [false],
          ssStatusByIndex: ['Ja'],
          svieSmerteByIndex: ['Fuld'],
          tafColumnIds: ['base:taf_day'],
          tafFlagsByIndex: [new Set(['base:taf_day'])],
        },
      },
      debugDays: [
        {
          iso: '2024-01-01',
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
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      fieldErrors: {
        stamdata: {},
        erstatningsopgoerelse: {},
      },
    } as never;

    const staleInputValues = {
      journalnr: 'STALE',
    };

    const view = eoSnapshotToDebugView({
      snapshot: {
        revision: 'rev-1',
        status: 'ok',
        invariants: [],
        debugSnapshot,
        data: {
          canonicalOutput: { marker: 'canonical' },
          debugSnapshot,
        },
        input: {
          stamdata: staleInputValues,
          erstatningsopgoerelse: { stale: true },
        },
      } as never,
      appSettings: DEFAULT_APP_SETTINGS,
      loenindkomstManuelReguleringInputErrors: {},
    });

    expect(view.kind).toBe('ready');
    if (view.kind !== 'ready') return;

    expect(view.rowsBySection.get('stamdata')).toEqual([
      { id: 'stamdata.journalnr', label: 'Journalnr', displayValue: 'J-1', status: 'ok' },
    ]);
    expect(view.rowsBySection.get('taf')).toEqual([
      {
        id: 'debug.builder.taf.exception',
        label: 'Fejl i debug-builder (taf)',
        displayValue: 'Fejl (Builder-fejl: Builder sprængte)',
        status: 'error',
      },
    ]);
    expect(buildRegulationTimelineMock).toHaveBeenCalledWith({
      debugDays: debugSnapshot.debugDays,
      eoValues: debugSnapshot.eoValues,
      stamdataValues: debugSnapshot.stamdataValues,
    });
  });

  it('returnerer blocked-view ved fail_closed snapshot uden debug-data', () => {
    const view = eoSnapshotToDebugView({
      snapshot: {
        revision: 'rev-fail',
        status: 'fail_closed',
        invariants: [{
          id: 'runtime_exception',
          passed: false,
          severity: 'error',
          message: 'Intern fejl',
        }],
        data: null,
        debugSnapshot: null,
        input: {
          stamdata: null,
          erstatningsopgoerelse: null,
        },
      } as never,
      appSettings: DEFAULT_APP_SETTINGS,
      loenindkomstManuelReguleringInputErrors: {},
    });

    expect(view).toEqual({
      kind: 'blocked',
      severity: 'error',
      title: 'EO debug er blokeret',
      message: 'Intern fejl',
    });
  });

  it('returnerer ready-view når snapshot har valideringsfejl men debugSnapshot findes', () => {
    const debugSnapshot = {
      model: {
        tableData: {
          dates: ['2024-01-01'],
          weekdayIndexByRow: [1],
          isSognehelligdagByIndex: [false],
          isWorkdayByIndex: [true],
          ssStatusByIndex: ['Nej'],
          svieSmerteByIndex: ['Ingen'],
          tafColumnIds: [],
          tafFlagsByIndex: [new Set<string>()],
        },
      },
      debugDays: [],
      sammentaellingRows: [],
      stamdataValues: {
        journalnr: 'J-2',
        skadesdato: '2024-01-01',
        skadestype: 'Arbejdsulykke',
      },
      eoValues: {
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      fieldErrors: {
        stamdata: {},
        erstatningsopgoerelse: {},
      },
    } as never;

    const view = eoSnapshotToDebugView({
      snapshot: {
        revision: 'rev-error',
        status: 'error',
        invariants: [{
          id: 'validation:loenindkomstAnsaettelsesforhold[0].loenudviklingBeregningsgrundlag',
          passed: false,
          severity: 'error',
          message: 'Lønregulering skal vælges, evt. "Ingen"',
        }],
        data: null,
        debugSnapshot,
        input: {
          stamdata: {
            journalnr: 'J-2',
            skadesdato: '2024-01-01',
            skadestype: 'Arbejdsulykke',
          },
          erstatningsopgoerelse: {
            midlertidigtEetAfgorelse: 'Nej',
            endeligtEetAfgorelse: 'Nej',
          },
        },
      } as never,
      appSettings: DEFAULT_APP_SETTINGS,
      loenindkomstManuelReguleringInputErrors: {},
    });

    expect(view.kind).toBe('ready');
  });
});
