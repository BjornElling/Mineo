import {
  klLoenaftaleRaekker,
  klSatstabelVaerdier,
  getKLSatstabelVaerdier,
  getKLReguleringPctForDato,
  getReguleringsDatoIntervalForKL,
} from '../../data/klLoenaftaler';
import { toDanishDateString } from '../../types/branded';
import { roundByMethod } from '../../utils/rounding';

const DANISH_DATE = /^\d{2}-\d{2}-\d{4}$/;

describe('klLoenaftaleRaekker (periode-reguleringssatser, kilde til dokument)', () => {
  it('indeholder alle periode-satser fra 1.4.2005 og frem (39 rækker)', () => {
    expect(klLoenaftaleRaekker).toHaveLength(39);
  });

  it('starter ved basisdatoen 1.4.2005 (0,00 %) og slutter ved 1.10.2026 (0,50 %)', () => {
    expect(klLoenaftaleRaekker[0]).toEqual({ fraDato: '01-04-2005', reguleringPct: 0 });
    expect(klLoenaftaleRaekker[klLoenaftaleRaekker.length - 1]).toEqual({
      fraDato: '01-10-2026',
      reguleringPct: 0.5,
    });
  });

  it('lagrer udelukkende periode-procent (ingen akkumuleret regulering i kilden)', () => {
    for (const row of klLoenaftaleRaekker) {
      expect(Object.keys(row).sort()).toEqual(['fraDato', 'reguleringPct']);
    }
  });

  it('har én entydig række pr. dato (ingen delkomponenter på samme dato)', () => {
    const datoer = klLoenaftaleRaekker.map((row) => row.fraDato);
    expect(new Set(datoer).size).toBe(datoer.length);
  });

  it('alle datoer er på dansk datoformat og procenter er finite', () => {
    for (const row of klLoenaftaleRaekker) {
      expect(row.fraDato).toMatch(DANISH_DATE);
      expect(Number.isFinite(row.reguleringPct)).toBe(true);
    }
  });
});

describe('klSatstabelVaerdier (afledt, akkumuleret satstabel beregnet af programmet)', () => {
  // Uafhængig genberegning af den akkumulerede serie ved at kæde periode-satserne.
  const forventetAkkumuleretPctByDato = (() => {
    const map = new Map<string, number>();
    let acc = 1;
    for (const row of klLoenaftaleRaekker) {
      acc *= 1 + row.reguleringPct / 100;
      map.set(row.fraDato, roundByMethod((acc - 1) * 100, 4, 'halfAwayFromZero'));
    }
    return map;
  })();

  it('er sorteret nyeste først', () => {
    expect(klSatstabelVaerdier[0].fraDato).toBe('01-10-2026');
    expect(klSatstabelVaerdier[klSatstabelVaerdier.length - 1]).toEqual({
      fraDato: '01-04-2005',
      reguleringsPct: 0,
    });
  });

  it('basisdatoen har akkumuleret regulering 0 %', () => {
    const byDato = new Map<string, number>(klSatstabelVaerdier.map((v) => [v.fraDato, v.reguleringsPct]));
    expect(byDato.get('01-04-2005')).toBe(0);
  });

  it('reguleringsPct er den akkumulerede regulering kædet fra periode-satserne', () => {
    const byDato = new Map<string, number>(klSatstabelVaerdier.map((v) => [v.fraDato, v.reguleringsPct]));
    for (const [dato, forventet] of forventetAkkumuleretPctByDato) {
      expect(byDato.get(dato)).toBe(forventet);
    }
  });

  it('forholdet mellem to på hinanden følgende akkumulerede satser reproducerer periode-satsen', () => {
    const kronologisk = [...klSatstabelVaerdier].reverse();
    for (let i = 1; i < kronologisk.length; i += 1) {
      const forrige = kronologisk[i - 1];
      const naa = kronologisk[i];
      const periodePct = (((100 + naa.reguleringsPct) / (100 + forrige.reguleringsPct)) - 1) * 100;
      const kilde = getKLReguleringPctForDato(toDanishDateString(naa.fraDato));
      expect(kilde).toBeDefined();
      // En 4-decimal-afrunding af de akkumulerede satser kan afvige marginalt fra kilden.
      expect(Math.abs(periodePct - kilde!)).toBeLessThan(5e-3);
    }
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

describe('getKLReguleringPctForDato (indtastet periode-reguleringsprocent)', () => {
  const d = (s: string) => toDanishDateString(s);

  it('returnerer kilde-værdien (periode-procent) for kendte datoer', () => {
    expect(getKLReguleringPctForDato(d('01-04-2005'))).toBe(0);
    expect(getKLReguleringPctForDato(d('01-01-2006'))).toBe(1.4);
    expect(getKLReguleringPctForDato(d('01-10-2022'))).toBe(2.55);
    expect(getKLReguleringPctForDato(d('01-04-2024'))).toBe(4.0);
    expect(getKLReguleringPctForDato(d('01-10-2024'))).toBe(1.3);
    expect(getKLReguleringPctForDato(d('01-04-2026'))).toBe(2.4);
    expect(getKLReguleringPctForDato(d('01-10-2026'))).toBe(0.5);
  });

  it('giver undefined for datoer der ikke er en regulerende dato', () => {
    expect(getKLReguleringPctForDato(d('01-04-2019'))).toBeUndefined();
    expect(getKLReguleringPctForDato(d('15-07-2021'))).toBeUndefined();
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
