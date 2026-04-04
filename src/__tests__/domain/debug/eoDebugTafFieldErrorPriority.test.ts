import { buildEODebugTaftRows } from '../../../domain/debug/eoDebugErstatningsopgoerelseModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

describe('buildEODebugTaftRows field error priority', () => {
  it('foretrækker konkret cutoff-fejl frem for generisk dato-range-fejl', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      tafPerioder: [
        {
          id: 'taf-1',
          fra: iso('2025-06-01'),
          til: iso('2025-07-15'),
          loseFeriedage: undefined,
        },
      ],
      ferieperioder: [],
    };

    const rows = buildEODebugTaftRows(
      values,
      {},
      {
        skadesdatoISO: iso('2023-06-01'),
        skadelidteFodselsdato: undefined,
        erErhvervssygdom: false,
        endeligEETBeregnetDato: iso('2025-07-01'),
        midlertidigEETBeregnetDato: undefined,
        differencekravDato: undefined,
        verserendeKlageEet: false,
      }
    );

    const row = rows.find((candidate) => candidate.id === 'taf.periode.taf-1');

    expect(row?.status).toBe('error');
    expect(row?.displayValue).toBe(
      'Fejl (Der er angivet tabt arbejdsfortjeneste efter afgørelse om endeligt erhvervsevnetab (01-07-2025))'
    );
    expect(row?.displayValue).not.toContain('Dato skal være mellem');
  });
});
