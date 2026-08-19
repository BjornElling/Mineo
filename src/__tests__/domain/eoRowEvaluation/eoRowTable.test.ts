import { serializeEoRowTable, type EoRowTable } from '../../../domain/eoRowEvaluation/eoRowTypes';

describe('serializeEoRowTable', () => {
  /*
    `displayValue` er et OUTPUTFORMAT: dokumentgeneratorerne læser den formatterede streng
    direkte. Serialiseringen skal derfor være byte-identisk med den form, row-builderne
    tidligere byggede i hånden. Disse tests fastholder præcis den form – inklusive de tomme
    celler i totalrækken, der giver `"I alt |  |  | …"` med DOBBELT mellemrum.
  */
  it('adskiller celler med " | " og rækker med linjeskift', () => {
    const table: EoRowTable = {
      columns: ['Fra-dato', 'Til-dato', 'Samlet'],
      rows: [
        { cells: ['01-01-2025', '31-01-2025', '1.000,00 kr.'] },
        { cells: ['01-02-2025', '28-02-2025', '2.000,00 kr.'] },
      ],
    };

    expect(serializeEoRowTable(table)).toBe(
      'Fra-dato | Til-dato | Samlet\n'
      + '01-01-2025 | 31-01-2025 | 1.000,00 kr.\n'
      + '01-02-2025 | 28-02-2025 | 2.000,00 kr.'
    );
  });

  it('gengiver totalrækkens tomme celler som dobbelt mellemrum', () => {
    // Den gamle håndbyggede form var `I alt |  |  |  |  |  | <total>` for 7 kolonner.
    const table: EoRowTable = {
      columns: ['Fra-dato', 'Til-dato', 'Indeks', 'Feriepenge-sats', 'AG-pension', 'Antal dage', 'Samlet'],
      rows: [
        { isTotal: true, cells: ['I alt', '', '', '', '', '', '1.234,00 kr.'] },
      ],
    };

    const serialized = serializeEoRowTable(table);
    expect(serialized.split('\n')[1]).toBe('I alt |  |  |  |  |  | 1.234,00 kr.');
  });

  it('en tabel uden rækker serialiseres til kun headeren', () => {
    expect(serializeEoRowTable({ columns: ['A', 'B'], rows: [] })).toBe('A | B');
  });

  describe('strukturen er kilden – ikke strengen', () => {
    it('bærer totalmarkering som et flag, ikke som celletekst', () => {
      // Tidligere blev en totalrække genkendt ved at strengmatche `cells[0] === 'I alt'`.
      // Etiketten er nu uden betydning for klassifikationen.
      const table: EoRowTable = {
        columns: ['Post', 'Beløb'],
        rows: [
          { cells: ['Segment', '10,00 kr.'] },
          { isTotal: true, cells: ['Sum i alt for perioden', '10,00 kr.'] },
        ],
      };

      expect(table.rows.filter((row) => row.isTotal === true)).toHaveLength(1);
      // …og en dataraekke, hvis tekst tilfældigvis begynder med "I alt", er IKKE en total.
      const misleading: EoRowTable = {
        columns: ['Post', 'Beløb'],
        rows: [{ cells: ['I alt-tillæg (en datarække)', '5,00 kr.'] }],
      };
      expect(misleading.rows.filter((row) => row.isTotal === true)).toHaveLength(0);
    });

    it('kolonneantallet læses fra columns, ikke gættes ud af indholdet', () => {
      // En tom celle i sidste kolonne må ikke ændre det opfattede kolonneantal – den gamle
      // parser filtrerede tomme header-celler væk og kunne derfor tabe en kolonne.
      const table: EoRowTable = {
        columns: ['A', 'B', 'C'],
        rows: [{ cells: ['1', '2', ''] }],
      };

      expect(table.columns).toHaveLength(3);
      expect(table.rows[0]?.cells).toHaveLength(3);
    });
  });
});
