import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { buildEODebugTaftRows } from '../../../domain/erstatningsopgoerelse/eoDebugErstatningsopgoerelseModel';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

describe('buildEODebugTaftRows overlap parity', () => {
  it('marks overlapping TAF periods as error rows', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      tafPerioder: [
        { id: 'a', fra: iso('2023-10-09'), til: iso('2023-12-31'), loseFeriedage: undefined },
        { id: 'b', fra: iso('2025-01-01'), til: iso('2025-01-10'), loseFeriedage: undefined },
        { id: 'c', fra: iso('2024-12-01'), til: iso('2025-01-31'), loseFeriedage: undefined },
      ],
      ferieperioder: [],
    };

    const context = {
      skadesdatoISO: iso('2023-01-01'),
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEODebugTaftRows>[1];
    const rows = buildEODebugTaftRows(values, errors, context);
    const periodRows = rows.filter((row) => row.id.startsWith('taf.periode.'));

    const rowB = periodRows.find((row) => row.id === 'taf.periode.b');
    const rowC = periodRows.find((row) => row.id === 'taf.periode.c');

    expect(rowB?.status).toBe('error');
    expect(rowC?.status).toBe('error');
    expect(rowB?.displayValue).toContain('Der er overlappende perioder');
    expect(rowC?.displayValue).toContain('Der er overlappende perioder');
  });
});

