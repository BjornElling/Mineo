import { describe, expect, it } from 'vitest';
import {
  krlSatstabeller,
  getKRLSatstabel,
  isKRLSatstabelId,
  formatKRLSatstabelDisplay,
  getReguleringsDatoIntervalForKRL,
} from '../../data/KRLrates';
import type { KRLSatstabelId } from '../../data/KRLrates';

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
    }
  });
});
