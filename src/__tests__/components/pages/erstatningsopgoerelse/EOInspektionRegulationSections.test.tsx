// @vitest-environment jsdom
/**
 * UI Tests for EOInspektionRegulationSections (Phase 4.5)
 *
 * SCOPE:
 * - Meget begrænsede tests
 * - Kun struktur, ikke indhold
 * - Ingen beregnings-tests (det er domain-tests)
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EOInspektionRegulationSections from '../../../../components/pages/erstatningsopgoerelse/EOInspektionRegulationSections';
import type { RegulationInspektionSection } from '../../../../domain/eoInspektion/eoInspektionRegulationViewModel';
import { toISODateString } from '../../../../types/branded';

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({ settings: { showContentBoxReportButton: false } }),
}));

describe('EOInspektionRegulationSections - Phase 4.5 UI', () => {
  it('renderer intet når sections er tom', () => {
    const { container } = render(
      <MemoryRouter>
        <EOInspektionRegulationSections sections={[]} />
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renderer sections korrekt (struktur test)', () => {
    const sections: RegulationInspektionSection[] = [
      {
        id: 'regulation.summary',
        header: 'Regulerings-overblik',
        rows: [
          { id: 'test.antal', label: 'Antal reguleringspunkter', value: '1' },
          {
            id: 'test.foerste',
            label: 'Første reguleringsdato',
            value: { rawValue: toISODateString('2024-01-01'), displayValue: '01-01-2024' },
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
                  { rawValue: toISODateString('2024-01-01'), displayValue: '01-01-2024' },
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
        <EOInspektionRegulationSections sections={sections} />
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
    const sections: RegulationInspektionSection[] = [
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
                  { rawValue: toISODateString('2024-01-01'), displayValue: '01-01-2024' },
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
        <EOInspektionRegulationSections sections={sections} />
      </MemoryRouter>
    );

    // Tjek at tabel-header vises
    expect(getByText('Fra-dato')).toBeDefined();
    expect(getByText('Kumulativ faktor')).toBeDefined();

    // Tjek at displayValue vises (ikke rawValue)
    expect(getByText('01-01-2024')).toBeDefined();
    expect(getByText('1,3800')).toBeDefined();
  });

  it('omdøber standard-kolonneoverskrifter i reguleringstabeller', () => {
    const sections: RegulationInspektionSection[] = [
      {
        id: 'regulation.timeline',
        header: 'Regulerings-tidslinje',
        rows: [],
        tables: [
          {
            id: 'regulation.timeline:table1',
            columns: ['Dato', 'Arbejdsdag', 'Måned', 'Pension'],
            rows: [
              {
                id: 'timeline.row1',
                cells: ['01-01-2024', '21', '0,97', '12,50 %'],
              },
            ],
          },
        ],
      },
    ];

    const { queryByText } = render(
      <MemoryRouter>
        <EOInspektionRegulationSections sections={sections} />
      </MemoryRouter>
    );

    expect(screen.getByText('Fra-dato')).toBeInTheDocument();
    expect(screen.getByText('Arbejdsdage')).toBeInTheDocument();
    expect(screen.getByText('Måneder')).toBeInTheDocument();
    expect(screen.getByText('AG pens. bidrag')).toBeInTheDocument();
    expect(queryByText('Arbejdsdag')).not.toBeInTheDocument();
    expect(queryByText('Måned')).not.toBeInTheDocument();
    expect(queryByText('Pension')).not.toBeInTheDocument();
  });

  it('omdøber Grundløn til Timeløn i arbejdsdagsbaseret reguleringstabel', () => {
    const sections: RegulationInspektionSection[] = [
      {
        id: 'regulation.timeline',
        header: 'Regulerings-tidslinje',
        rows: [],
        tables: [
          {
            id: 'regulation.timeline:table1',
            columns: ['Dato', 'Arbejdsdag', 'Grundløn'],
            rows: [
              {
                id: 'timeline.row1',
                cells: ['01-01-2024', '21', '245,50'],
              },
            ],
          },
        ],
      },
    ];

    const { queryByText } = render(
      <MemoryRouter>
        <EOInspektionRegulationSections sections={sections} />
      </MemoryRouter>
    );

    expect(screen.getByText('Timeløn')).toBeInTheDocument();
    expect(queryByText('Grundløn')).not.toBeInTheDocument();
  });

  it('omdøber Grundløn til Månedsløn i månedsbaseret reguleringstabel', () => {
    const sections: RegulationInspektionSection[] = [
      {
        id: 'regulation.timeline',
        header: 'Regulerings-tidslinje',
        rows: [],
        tables: [
          {
            id: 'regulation.timeline:table1',
            columns: ['Dato', 'Måned', 'Grundløn'],
            rows: [
              {
                id: 'timeline.row1',
                cells: ['01-01-2024', '0,97', '32.500,00'],
              },
            ],
          },
        ],
      },
    ];

    const { queryByText } = render(
      <MemoryRouter>
        <EOInspektionRegulationSections sections={sections} />
      </MemoryRouter>
    );

    expect(screen.getByText('Månedsløn')).toBeInTheDocument();
    expect(queryByText('Grundløn')).not.toBeInTheDocument();
  });

  it('indsatter wrap-punkt efter skrastreg i tabelceller', () => {
    const sections: RegulationInspektionSection[] = [
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
        <EOInspektionRegulationSections sections={sections} />
      </MemoryRouter>
    );

    const cell = container.querySelector('tbody td');
    expect(cell?.textContent).toBe('Dansk Industri/HK');
    expect(cell?.querySelectorAll('span[style*="white-space: nowrap"]').length).toBe(3);
    expect(cell?.innerHTML).toContain('<wbr>');
  });

  it('crasher ikke ved missing table', () => {
    const sections: RegulationInspektionSection[] = [
      {
        id: 'regulation.summary',
        header: 'Regulerings-overblik',
        rows: [{ id: 'test.row1', label: 'Test', value: 'Værdi' }],
      },
    ];

    const { getByText } = render(
      <MemoryRouter>
        <EOInspektionRegulationSections sections={sections} />
      </MemoryRouter>
    );

    expect(getByText('Regulerings-overblik')).toBeDefined();
    expect(getByText('Test')).toBeDefined();
    expect(getByText('Værdi')).toBeDefined();
  });
});
