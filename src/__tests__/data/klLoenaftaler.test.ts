import {
  klLoenaftaleRaekker,
  klSatstabelVaerdier,
  getKLSatstabelVaerdier,
  getReguleringsDatoIntervalForKL,
} from '../../data/klLoenaftaler';

const DANISH_DATE = /^\d{2}-\d{2}-\d{4}$/;

describe('klLoenaftaleRaekker (kilde-rækker til dokument)', () => {
  it('indeholder alle linjer fra 1.4.2005 og frem (64 rækker)', () => {
    expect(klLoenaftaleRaekker).toHaveLength(64);
  });

  it('starter ved 1.4.2005 og slutter ved 1.4.2027 (kronologisk)', () => {
    expect(klLoenaftaleRaekker[0]).toMatchObject({ fraDato: '01-04-2005', indeks: 1.124454 });
    expect(klLoenaftaleRaekker[klLoenaftaleRaekker.length - 1]).toMatchObject({
      fraDato: '01-04-2027',
      indeks: 1.662017,
    });
  });

  it('bevarer delkomponenter på samme dato som separate linjer', () => {
    const denFoersteJanuar2006 = klLoenaftaleRaekker.filter((row) => row.fraDato === '01-01-2006');
    expect(denFoersteJanuar2006).toHaveLength(2);
    expect(denFoersteJanuar2006[0].tekst).toContain('generelle stigninger');
    expect(denFoersteJanuar2006[1].tekst).toContain('særlig aftalt regulering');
  });

  it('teksten indeholder ikke "pr. den" (datoen står i egen kolonne)', () => {
    for (const row of klLoenaftaleRaekker) {
      expect(row.tekst).not.toContain('pr. den');
    }
  });

  it('alle datoer er på dansk datoformat og indeks er finite', () => {
    for (const row of klLoenaftaleRaekker) {
      expect(row.fraDato).toMatch(DANISH_DATE);
      expect(Number.isFinite(row.indeks)).toBe(true);
    }
  });
});

describe('klSatstabelVaerdier (afledt beregnings-satstabel)', () => {
  it('er sorteret nyeste først', () => {
    expect(klSatstabelVaerdier[0]).toEqual({ fraDato: '01-10-2026', reguleringsPct: 66.2017 });
    expect(klSatstabelVaerdier[klSatstabelVaerdier.length - 1]).toEqual({
      fraDato: '01-04-2005',
      reguleringsPct: 12.4454,
    });
  });

  it('reguleringsPct = (indeks − 1) × 100 for udvalgte datoer', () => {
    const byDato = new Map<string, number>(klSatstabelVaerdier.map((v) => [v.fraDato, v.reguleringsPct]));
    expect(byDato.get('01-01-2012')).toBe(26.8904);
    expect(byDato.get('01-10-2025')).toBe(60.2921);
    expect(byDato.get('01-11-2025')).toBe(61.4627);
    expect(byDato.get('01-04-2026')).toBe(65.3378);
  });

  it('udelader rene ikke-regulerende datoer (uændret akkumuleret indeks)', () => {
    const datoer = new Set<string>(klSatstabelVaerdier.map((v) => v.fraDato));
    for (const ikkeRegulerende of ['01-10-2010', '01-04-2011', '01-04-2019', '01-04-2022', '01-04-2025', '01-04-2027']) {
      expect(datoer.has(ikkeRegulerende)).toBe(false);
    }
  });

  it('slår flere reguleringer på samme dato sammen til den endelige værdi', () => {
    const byDato = new Map<string, number>(klSatstabelVaerdier.map((v) => [v.fraDato, v.reguleringsPct]));
    // 1.1.2006: 0,69 % + 0,70 % → endelig indeks 1,140138.
    expect(byDato.get('01-01-2006')).toBe(14.0138);
    // 1.4.2010: +0,50 % derefter −0,32 % → endelig indeks 1,248812.
    expect(byDato.get('01-04-2010')).toBe(24.8812);
  });

  it('alle reguleringsprocenter er finite og datoer på dansk format', () => {
    for (const v of klSatstabelVaerdier) {
      expect(v.fraDato).toMatch(DANISH_DATE);
      expect(Number.isFinite(v.reguleringsPct)).toBe(true);
    }
  });

  it('getKLSatstabelVaerdier returnerer den samme tabel', () => {
    expect(getKLSatstabelVaerdier()).toBe(klSatstabelVaerdier);
  });
});

describe('getReguleringsDatoIntervalForKL', () => {
  it('fraDato = ældste, tilDato = nyeste + 6 måneder − 1 dag', () => {
    const interval = getReguleringsDatoIntervalForKL();
    expect(interval).toBeDefined();
    expect(interval?.fraDato).toBe('01-04-2005');
    expect(interval?.tilDato).toBe('31-03-2027');
  });
});
