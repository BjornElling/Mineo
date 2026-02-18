import { describe, expect, it, vi } from 'vitest';
import { createErstatningsopgoerelseInitialValues } from '../../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { renderOffentligeYdelserSection } from '../../../../../utils/pdf/erstatningsopgoerelse/sections/offentligeYdelserSection';

describe('renderOffentligeYdelserSection tabelbredde', () => {
  it('fordeler kolonner over fuld tabelbredde i PDF', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.offentligeYdelserRows = [
      {
        id: 'row-1',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelsestype: 'sygedagpenge',
        ydelse: { kind: 'number', value: 1000 },
        tillaeg: { kind: 'number', value: 100 },
      },
    ];

    let y = 0;
    const renderStandardPdfTable = vi.fn(({ startY }) => startY + 10);

    renderOffentligeYdelserSection({
      eoValues,
      lineHeight: 4,
      startBilagPage: vi.fn(),
      renderSubheader: vi.fn(),
      shouldIncludeOffentligYdelseRowInBilag: vi.fn(() => true),
      bilagIndkomstYdelserMode: 'Alle',
      bilagIndkomstYdelserRanges: [],
      renderStandardPdfTable,
      writer: {
        addSpacer: vi.fn(),
        setY: vi.fn((nextY: number) => {
          y = nextY;
        }),
        getY: vi.fn(() => y),
        getDoc: vi.fn(() => ({})),
      },
    });

    expect(renderStandardPdfTable).toHaveBeenCalled();
    const firstCall = renderStandardPdfTable.mock.calls[0]?.[0];
    const firstColumnStyle = (firstCall?.columnStyles as Record<number, { cellWidth: number }>)[0];

    expect(firstColumnStyle.cellWidth).toBeCloseTo(170 / 5, 6);
  });
});
