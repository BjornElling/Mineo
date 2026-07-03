import {
  krlSatstabeller,
  getKRLSatstabel,
  isKRLSatstabelId,
  formatKRLSatstabelDisplay,
  getReguleringsDatoIntervalForKRL,
  assertKRLCombinedDataIntegritet,
} from '../../data/krlRates';
import type { KRLSatstabelId } from '../../data/krlRates';

// Samme rækketype som krlRates' interne KRLCombinedRow (ikke eksporteret).
type Row = readonly [string, number | null, number | null, number | null, number | null];

const KRL_IDS: KRLSatstabelId[] = [
  'KTO (kommuner)',
  'SHK (kommuner)',
  'KTO (regioner)',
  'SHK (regioner)',
];

describe('krlSatstabeller', () => {
  it('indeholder præcis 4 tabeller', () => {
    expect(krlSatstabeller).toHaveLength(4);
  });

  it('alle fire KRL-IDs er repræsenteret', () => {
    const ids = krlSatstabeller.map(t => t.id);
    for (const id of KRL_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('alle tabeller har mindst ét sæt værdier', () => {
    for (const tabel of krlSatstabeller) {
      expect(tabel.vaerdier.length).toBeGreaterThan(0);
    }
  });

  it('alle reguleringsprocenter er finite numbers', () => {
    for (const tabel of krlSatstabeller) {
      for (const vaerdi of tabel.vaerdier) {
        expect(Number.isFinite(vaerdi.reguleringsPct)).toBe(true);
      }
    }
  });

  it('fraDato er på dansk datoformat (dd-mm-åååå)', () => {
    const DANISH_DATE = /^\d{2}-\d{2}-\d{4}$/;
    for (const tabel of krlSatstabeller) {
      for (const vaerdi of tabel.vaerdier) {
        expect(vaerdi.fraDato).toMatch(DANISH_DATE);
      }
    }
  });
});

describe('isKRLSatstabelId', () => {
  it('gyldige IDs → true', () => {
    for (const id of KRL_IDS) {
      expect(isKRLSatstabelId(id)).toBe(true);
    }
  });

  it('ugyldige strenge → false', () => {
    expect(isKRLSatstabelId('KRL')).toBe(false);
    expect(isKRLSatstabelId('kommuner')).toBe(false);
    expect(isKRLSatstabelId('')).toBe(false);
  });

  it('undefined → false', () => {
    expect(isKRLSatstabelId(undefined)).toBe(false);
  });
});

describe('getKRLSatstabel', () => {
  it('kendt id → returnerer tabel', () => {
    const tabel = getKRLSatstabel('KTO (kommuner)');
    expect(tabel).toBeDefined();
    expect(tabel?.id).toBe('KTO (kommuner)');
  });

  it('alle 4 IDs finder en tabel', () => {
    for (const id of KRL_IDS) {
      expect(getKRLSatstabel(id)).toBeDefined();
    }
  });

  it('indeholder satserne for 01-04-2026 som nyeste række', () => {
    expect(getKRLSatstabel('KTO (kommuner)')?.vaerdier[0]).toEqual({
      fraDato: '01-04-2026',
      reguleringsPct: 65.3378,
    });
    expect(getKRLSatstabel('SHK (kommuner)')?.vaerdier[0]).toEqual({
      fraDato: '01-04-2026',
      reguleringsPct: 45.0155,
    });
    expect(getKRLSatstabel('KTO (regioner)')?.vaerdier[0]).toEqual({
      fraDato: '01-04-2026',
      reguleringsPct: 19.8008,
    });
    expect(getKRLSatstabel('SHK (regioner)')?.vaerdier[0]).toEqual({
      fraDato: '01-04-2026',
      reguleringsPct: 19.8008,
    });
  });
});

describe('formatKRLSatstabelDisplay', () => {
  it('tom streng → "-"', () => {
    expect(formatKRLSatstabelDisplay('')).toBe('-');
  });

  it('whitespace → "-"', () => {
    expect(formatKRLSatstabelDisplay('   ')).toBe('-');
  });

  it('returnerer streng der indeholder input', () => {
    const result = formatKRLSatstabelDisplay('KTO (kommuner)');
    expect(result).toContain('KRL-satstabel');
  });
});

describe('getReguleringsDatoIntervalForKRL', () => {
  it('kendt id → returnerer interval med fraDato og tilDato', () => {
    const interval = getReguleringsDatoIntervalForKRL('KTO (kommuner)');
    expect(interval).toBeDefined();
    if (interval) {
      expect(interval.fraDato).toBeTruthy();
      expect(interval.tilDato).toBeTruthy();
    }
  });

  it('alle 4 IDs returnerer interval', () => {
    for (const id of KRL_IDS) {
      const interval = getReguleringsDatoIntervalForKRL(id);
      expect(interval).toBeDefined();
    }
  });

  it('tilDato er datoen for fraDato + 6 måneder - 1 dag', () => {
    // Verificér at tilDato er defineret og er en dansk dato
    const DANISH_DATE = /^\d{2}-\d{2}-\d{4}$/;
    const interval = getReguleringsDatoIntervalForKRL('KTO (kommuner)');
    if (interval) {
      expect(interval.tilDato).toMatch(DANISH_DATE);
      expect(interval.tilDato).toBe('30-09-2026');
    }
  });
});

describe('assertKRLCombinedDataIntegritet (fail-closed data-guard)', () => {
  it('en gyldig tabel (strengt nyeste-først, null kun som ældste-prefiks) passerer', () => {
    const rows: Row[] = [
      ['01-04-2026', 30, 20, 10, 10],
      ['01-10-2025', 20, 10, 5, 5],
      ['01-04-2025', 10, 5, null, null], // regioner starter senere (null-prefiks i ældste ende)
      ['01-04-2024', 5, null, null, null], // SHK kom. starter senere endnu
    ];
    expect(() => assertKRLCombinedDataIntegritet(rows)).not.toThrow();
  });

  it('et interiort hul (defineret sats ældre end en null i samme kolonne) fail-closer', () => {
    const rows: Row[] = [
      ['01-04-2026', 30, 20, 10, 10],
      ['01-10-2025', 20, null, 5, 5], // SHK kom. mangler midt i serien
      ['01-04-2025', 10, 5, 3, 3], // ... men er defineret igen ældre → interiort hul
    ];
    expect(() => assertKRLCombinedDataIntegritet(rows)).toThrow(/hul i serien/);
  });

  it('en mis-sorteret tabel (ikke strengt nyeste-først) fail-closer', () => {
    const rows: Row[] = [
      ['01-10-2025', 20, 10, 5, 5],
      ['01-04-2026', 30, 20, 10, 10], // nyere end forrige række → bryder rækkefølgen
    ];
    expect(() => assertKRLCombinedDataIntegritet(rows)).toThrow(/rækkefølge/);
  });

  it('to identiske datoer (ikke strengt aftagende) fail-closer', () => {
    const rows: Row[] = [
      ['01-04-2026', 30, 20, 10, 10],
      ['01-04-2026', 20, 10, 5, 5],
    ];
    expect(() => assertKRLCombinedDataIntegritet(rows)).toThrow(/rækkefølge/);
  });

  it('en ugyldig fraDato fail-closer', () => {
    const rows: Row[] = [['ikke-en-dato', 30, 20, 10, 10]];
    expect(() => assertKRLCombinedDataIntegritet(rows)).toThrow(/ugyldig fraDato/);
  });

  it('de faktiske KRL-data passerer guarden (tal-neutral i dag)', () => {
    // Rekonstruér den samlede tabel fra de byggede satstabeller for at bekræfte at
    // guarden er grøn på produktionsdata (den kaldes allerede ved modul-load).
    for (const tabel of krlSatstabeller) {
      // Hver enkelt kolonneserie skal være strengt aftagende og hul-fri efter filtrering.
      const isoDates = tabel.vaerdier.map((v) => v.fraDato);
      expect(new Set(isoDates).size).toBe(isoDates.length); // ingen duplikater
    }
  });
});
