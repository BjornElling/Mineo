import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import EODebug from '../../../../components/pages/erstatningsopgoerelse/EODebug';

const { eoSnapshotToDebugViewMock } = vi.hoisted(() => ({
  eoSnapshotToDebugViewMock: vi.fn(),
}));

vi.mock('../../../../hooks/useEOLoenindkomstInputErrors', () => ({
  useEOLoenindkomstInputErrors: () => ({}),
}));

vi.mock('../../../../contexts/AppSettingsContext', () => ({
  useAppSettings: () => ({ settings: {} }),
}));

vi.mock('../../../../domain/erstatningsopgoerelse/eoSnapshotToDebugView', () => ({
  eoSnapshotToDebugView: eoSnapshotToDebugViewMock,
}));

describe('EODebug', () => {
  const renderComponent = (snapshot: React.ComponentProps<typeof EODebug>['eoSnapshot']) => {
    return render(
      <MemoryRouter>
        <EODebug eoSnapshot={snapshot} />
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    eoSnapshotToDebugViewMock.mockReset();
  });

  it('viser blocked-alert fra debug-view-projektionen', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'blocked',
      severity: 'info',
      title: 'EO debug kræver et friskt snapshot',
      message: 'Åbn debug-fanen igen fra Erstatningsopgørelse for at bygge snapshot på committed data.',
    });

    renderComponent(null);

    expect(screen.getByText('EO debug kræver et friskt snapshot')).toBeInTheDocument();
    expect(screen.getByText('Åbn debug-fanen igen fra Erstatningsopgørelse for at bygge snapshot på committed data.')).toBeInTheDocument();
  });

  it('renderer projekterede sektioner og sammentælling', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'ready',
      canonicalOutput: undefined,
      debugSnapshot: {
        sammentaellingRows: [
          {
            key: 'taf',
            label: 'TAF-periode 1',
            control: {
              beregnetDisplay: '10',
              tabelDisplay: '10',
              beregnetValue: 10,
              tabelValue: 10,
              loseFeriedage: 0,
              oevrigeFravaersdage: 0,
              warningEligible: false,
            },
          },
        ],
      },
      stamdataValues: {},
      erstatningsopgoerelseValues: {
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      rowsBySection: new Map([
        ['stamdata', [{ id: 'stamdata.skadesdato', label: 'Skadesdato', displayValue: '01-01-2024', status: 'ok' }]],
        ['aes', [{ id: 'aes.varigeMen', label: 'Varigt mén', displayValue: 'Nej', status: 'ok', group: 'aes.varigeMen' }]],
      ]),
      loenSections: [
        {
          id: 'loen.summary',
          header: 'Lønoversigt',
          table: {
            columns: ['Komponent', 'Samlet beløb'],
            rows: [{ id: 'loen.summary:grundloen', cells: ['Grundløn', '10.000,00'] }],
          },
        },
      ],
      regulationSections: [
        {
          id: 'regulation.1',
          header: 'Ansættelsesforhold 1',
          rows: [{ id: 'regulation.1:overenskomst', label: 'Overenskomst', value: '3F' }],
        },
      ],
    });

    renderComponent({ revision: 'rev-1' } as never);

    expect(screen.getByText('Stamdata')).toBeInTheDocument();
    expect(screen.getByText('Skadesdato')).toBeInTheDocument();
    expect(screen.getByText('Lønoversigter')).toBeInTheDocument();
    expect(screen.getByText('Ansættelsesforhold 1')).toBeInTheDocument();
    expect(screen.getByText('Sammentælling')).toBeInTheDocument();
    expect(screen.getByText('Beregnet: 10 | Tabel: 10')).toBeInTheDocument();
  });
});
