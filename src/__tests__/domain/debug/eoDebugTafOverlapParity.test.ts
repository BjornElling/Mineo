import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { buildEODebugTaftRows } from '../../../domain/debug/eoDebugErstatningsopgoerelseModel';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

describe('buildEODebugTaftRows overlap parity', () => {
  // Regression note:
  // Denne suite dækker tidligere kendt overlap-regression og skal forblive grøn (ingen skip).
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

  it('does not warn when TAF period extends beyond vedrører-periodens til-dato', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: iso('2024-06-01'),
      vedroererPeriodeTil: iso('2024-06-15'),
      tafPerioder: [
        { id: 'a', fra: iso('2024-06-01'), til: iso('2024-08-31'), loseFeriedage: undefined },
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
    const ophoerRow = rows.find((row) => row.id === 'taf.ophoerSkyldes');

    expect(ophoerRow?.status).toBe('ok');
    expect(ophoerRow?.displayValue).toContain('Erstatningsperiodens ophør');
  });

  it('uses plural label for ferie rows when more than one ferieperiode is filled', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      tafPerioder: [
        { id: 'a', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      ferieperioder: [
        { id: 'f1', fra: iso('2024-01-05'), til: iso('2024-01-10') },
        { id: 'f2', fra: iso('2024-01-15'), til: iso('2024-01-20') },
      ],
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
    const ferieRows = rows.filter((row) => row.id.startsWith('taf.ferie.'));

    expect(ferieRows).toHaveLength(2);
    expect(ferieRows.every((row) => row.label === 'Ferieperioder')).toBe(true);
  });
});
