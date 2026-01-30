/**
 * UI Tests for EODebugRegulationSections (Phase 4.5)
 *
 * SCOPE:
 * - Meget begrænsede tests
 * - Kun struktur, ikke indhold
 * - Ingen beregnings-tests (det er domain-tests)
 */

import { render } from '@testing-library/react';
import EODebugRegulationSections from '../../../../components/pages/erstatningsopgoerelse/EODebugRegulationSections';
import type { RegulationDebugSection } from '../../../../domain/debug/eoDebugRegulationViewModel';

describe('EODebugRegulationSections - Phase 4.5 UI', () => {
  it('viser "Ingen reguleringsdata" når sections er tom', () => {
    const { getByText } = render(<EODebugRegulationSections sections={[]} />);

    expect(getByText('Ingen reguleringsdata')).toBeDefined();
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
        table: {
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

    const { getByText, getAllByText } = render(<EODebugRegulationSections sections={sections} />);

    // Tjek at headers vises
    expect(getByText('Regulerings-overblik')).toBeDefined();
    expect(getByText('Regulerings-tidslinje')).toBeDefined();
    expect(getByText('Store Bededag')).toBeDefined();

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
        table: {
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
      },
    ];

    const { getByText } = render(<EODebugRegulationSections sections={sections} />);

    // Tjek at tabel-header vises
    expect(getByText('Dato')).toBeDefined();
    expect(getByText('Kumulativ faktor')).toBeDefined();

    // Tjek at displayValue vises (ikke rawValue)
    expect(getByText('01-01-2024')).toBeDefined();
    expect(getByText('1,3800')).toBeDefined();
  });

  it('crasher ikke ved missing table', () => {
    const sections: RegulationDebugSection[] = [
      {
        id: 'regulation.summary',
        header: 'Regulerings-overblik',
        rows: [{ id: 'test.row1', label: 'Test', value: 'Værdi' }],
      },
    ];

    const { getByText } = render(<EODebugRegulationSections sections={sections} />);

    expect(getByText('Regulerings-overblik')).toBeDefined();
    expect(getByText('Test')).toBeDefined();
    expect(getByText('Værdi')).toBeDefined();
  });
});
