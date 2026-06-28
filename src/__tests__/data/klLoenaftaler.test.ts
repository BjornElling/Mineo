import {
  klLoenaftalerRaekker,
  getKlLoenaftalerReguleringPctForDato,
  getReguleringsDatoIntervalForKlLoenaftaler,
} from '../../data/klLoenaftaler';
import { toDanishDateString } from '../../types/branded';

const DANISH_DATE = /^\d{2}-\d{2}-\d{4}$/;

describe('klLoenaftalerRaekker (periode-reguleringssatser, kilde til dokument)', () => {
  it('indeholder alle periode-satser fra 1.4.2005 og frem (39 rækker)', () => {
    expect(klLoenaftalerRaekker).toHaveLength(39);
  });

  it('starter ved basisdatoen 1.4.2005 (0,00 %) og slutter ved 1.10.2026 (0,50 %)', () => {
    expect(klLoenaftalerRaekker[0]).toEqual({ fraDato: '01-04-2005', reguleringPct: 0 });
    expect(klLoenaftalerRaekker[klLoenaftalerRaekker.length - 1]).toEqual({
      fraDato: '01-10-2026',
      reguleringPct: 0.5,
    });
  });

  it('lagrer udelukkende periode-procent (ingen akkumuleret regulering i kilden)', () => {
    for (const row of klLoenaftalerRaekker) {
      expect(Object.keys(row).sort()).toEqual(['fraDato', 'reguleringPct']);
    }
  });

  it('har én entydig række pr. dato (ingen delkomponenter på samme dato)', () => {
    const datoer = klLoenaftalerRaekker.map((row) => row.fraDato);
    expect(new Set(datoer).size).toBe(datoer.length);
  });

  it('alle datoer er på dansk datoformat og procenter er finite', () => {
    for (const row of klLoenaftalerRaekker) {
      expect(row.fraDato).toMatch(DANISH_DATE);
      expect(Number.isFinite(row.reguleringPct)).toBe(true);
    }
  });
});

describe('getKlLoenaftalerReguleringPctForDato (indtastet periode-reguleringsprocent)', () => {
  const d = (s: string) => toDanishDateString(s);

  it('returnerer kilde-værdien (periode-procent) for kendte datoer', () => {
    expect(getKlLoenaftalerReguleringPctForDato(d('01-04-2005'))).toBe(0);
    expect(getKlLoenaftalerReguleringPctForDato(d('01-01-2006'))).toBe(1.4);
    expect(getKlLoenaftalerReguleringPctForDato(d('01-10-2022'))).toBe(2.55);
    expect(getKlLoenaftalerReguleringPctForDato(d('01-04-2024'))).toBe(4.0);
    expect(getKlLoenaftalerReguleringPctForDato(d('01-10-2024'))).toBe(1.3);
    expect(getKlLoenaftalerReguleringPctForDato(d('01-04-2026'))).toBe(2.4);
    expect(getKlLoenaftalerReguleringPctForDato(d('01-10-2026'))).toBe(0.5);
  });

  it('giver undefined for datoer der ikke er en regulerende dato', () => {
    expect(getKlLoenaftalerReguleringPctForDato(d('01-04-2019'))).toBeUndefined();
    expect(getKlLoenaftalerReguleringPctForDato(d('15-07-2021'))).toBeUndefined();
  });
});

describe('getReguleringsDatoIntervalForKlLoenaftaler', () => {
  it('fraDato = ældste, tilDato = nyeste + 6 måneder − 1 dag', () => {
    const interval = getReguleringsDatoIntervalForKlLoenaftaler();
    expect(interval).toBeDefined();
    expect(interval?.fraDato).toBe('01-04-2005');
    expect(interval?.tilDato).toBe('31-03-2027');
  });
});
