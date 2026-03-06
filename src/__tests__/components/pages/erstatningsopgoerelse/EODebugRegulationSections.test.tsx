/**
 * UI Tests for EODebugRegulationSections (Phase 4.5)
 *
 * SCOPE:
 * - Meget begrænsede tests
 * - Kun struktur, ikke indhold
 * - Ingen beregnings-tests (det er domain-tests)
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import EODebugRegulationSections from '../../../../components/pages/erstatningsopgoerelse/EODebugRegulationSections';
import type { RegulationDebugSection } from '../../../../domain/debug/eoDebugRegulationViewModel';

vi.mock('../../../../contexts/AppSettingsContext', () => ({
  useAppSettings: () => ({ settings: { showContentBoxReportButton: false } }),
}));

describe('EODebugRegulationSections - Phase 4.5 UI', () => {
  it('renderer intet når sections er tom', () => {
    const { container } = render(
      <MemoryRouter>
        <EODebugRegulationSections sections={[]} />
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renderer sections korrekt (struktur test)', () => {
    const sections: RegulationDebugSection[] = [
      {
        id: 'regulation.summary',
        header: 'Regulerings-overblik',
        rows: [
          { id: 'test.antal', label: 'Antal reguleringspunkter', value: '1' },
          {
            id: 'test.foerste',
            label: 'Første reguleringsdato',
            value: { rawValue: '2024-01-01', displayValue: '01-01-2024' },
          },
        ],
      },
      {
        id: 'regulation.timeline',
        header: 'Regulerings-tidslinje',
        rows: [],
        tables: [
          {
            id: 'regulation.timeline:table1',
            columns: ['Dato', 'Kumulativ faktor', 'Årsag', 'Steps'],
            rows: [
              {
                id: 'timeline.row1',
                cells: [
                  { rawValue: '2024-01-01', displayValue: '01-01-2024' },
                  { rawValue: 1.38, displayValue: '1,3800' },
                  'Årlig indeks',
                  'Årlig indeks=1,3800',
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'regulation.storebededag',
        header: 'Store Bededag',
        rows: [
          { id: 'sb.aktiv', label: 'Aktiv', value: 'Nej' },
          { id: 'sb.dato', label: 'Ikrafttrædelsesdato', value: '-' },
        ],
      },
    ];

    const { container, getByText, getAllByText } = render(
      <MemoryRouter>
        <EODebugRegulationSections sections={sections} />
      </MemoryRouter>
    );

    // Tjek at headers vises
    expect(getByText('Regulerings-overblik')).toBeDefined();
    expect(getByText('Regulerings-tidslinje')).toBeDefined();
    expect(getByText('Store Bededag')).toBeDefined();
    expect(container.querySelectorAll('.content-box')).toHaveLength(3);

    // Tjek at displayValue vises (kan være flere steder)
    expect(getAllByText('01-01-2024').length).toBeGreaterThan(0);
    expect(getAllByText('1,3800').length).toBeGreaterThan(0);
  });

  it('renderer timeline table korrekt', () => {
    const sections: RegulationDebugSection[] = [
      {
        id: 'regulation.timeline',
        header: 'Regulerings-tidslinje',
        rows: [],
        tables: [
          {
            id: 'regulation.timeline:table1',
            columns: ['Dato', 'Kumulativ faktor'],
            rows: [
              {
                id: 'timeline.row1',
                cells: [
                  { rawValue: '2024-01-01', displayValue: '01-01-2024' },
                  { rawValue: 1.38, displayValue: '1,3800' },
                ],
              },
            ],
          },
        ],
      },
    ];

    const { getByText } = render(
      <MemoryRouter>
        <EODebugRegulationSections sections={sections} />
      </MemoryRouter>
    );

    // Tjek at tabel-header vises
    expect(getByText('Dato')).toBeDefined();
    expect(getByText('Kumulativ faktor')).toBeDefined();

    // Tjek at displayValue vises (ikke rawValue)
    expect(getByText('01-01-2024')).toBeDefined();
    expect(getByText('1,3800')).toBeDefined();
  });

  it('indsatter wrap-punkt efter skrastreg i tabelceller', () => {
    const sections: RegulationDebugSection[] = [
      {
        id: 'regulation.timeline',
        header: 'Regulerings-tidslinje',
        rows: [],
        tables: [
          {
            id: 'regulation.timeline:table1',
            columns: ['Indeksberegning'],
            rows: [
              {
                id: 'timeline.row1',
                cells: ['Dansk Industri/HK'],
              },
            ],
          },
        ],
      },
    ];

    const { container } = render(
      <MemoryRouter>
        <EODebugRegulationSections sections={sections} />
      </MemoryRouter>
    );

    const cell = container.querySelector('tbody td');
    expect(cell?.textContent).toBe('Dansk Industri/HK');
    expect(cell?.querySelectorAll('span[style*="white-space: nowrap"]').length).toBe(3);
    expect(cell?.innerHTML).toContain('<wbr>');
  });

  it('crasher ikke ved missing table', () => {
    const sections: RegulationDebugSection[] = [
      {
        id: 'regulation.summary',
        header: 'Regulerings-overblik',
        rows: [{ id: 'test.row1', label: 'Test', value: 'Værdi' }],
      },
    ];

    const { getByText } = render(
      <MemoryRouter>
        <EODebugRegulationSections sections={sections} />
      </MemoryRouter>
    );

    expect(getByText('Regulerings-overblik')).toBeDefined();
    expect(getByText('Test')).toBeDefined();
    expect(getByText('Værdi')).toBeDefined();
  });
});
