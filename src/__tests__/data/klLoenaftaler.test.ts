import {
  klLoenaftaleRaekker,
  klSatstabelVaerdier,
  getKLSatstabelVaerdier,
  getKLReguleringPctForDato,
  getReguleringsDatoIntervalForKL,
} from '../../data/klLoenaftaler';
import { toDanishDateString } from '../../types/branded';

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

  it('bevarer delkomponenter på samme dato som separate linjer med adskilt procent', () => {
    const denFoersteJanuar2006 = klLoenaftaleRaekker.filter((row) => row.fraDato === '01-01-2006');
    expect(denFoersteJanuar2006).toHaveLength(2);
    expect(denFoersteJanuar2006[0]).toMatchObject({ regulering: 'Generelle stigninger', procent: '0,69%' });
    expect(denFoersteJanuar2006[1]).toMatchObject({ regulering: 'Særlig aftalt regulering', procent: '0,70%' });
  });

  it('regulering og procent holdes i hver sin kolonne (ingen procent i regulerings-teksten)', () => {
    const okt2018 = klLoenaftaleRaekker.find((row) => row.fraDato === '01-10-2018' && row.regulering === 'Generelle stigninger');
    expect(okt2018?.procent).toBe('1,30%');
    expect(okt2018?.regulering).not.toContain('%');
  });

  it('linjer uden regulering har tom procent', () => {
    for (const row of klLoenaftaleRaekker) {
      if (row.regulering.startsWith('Ingen regulering')) {
        expect(row.procent).toBe('');
      }
    }
  });

  it('reguleringsteksten indeholder ikke "pr. den" (datoen står i egen kolonne)', () => {
    for (const row of klLoenaftaleRaekker) {
      expect(row.regulering).not.toContain('pr. den');
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

describe('getKLReguleringPctForDato (periodevis regulering afledt af akkumuleret indeks)', () => {
  const d = (s: string) => toDanishDateString(s);

  it('beregner perioderegulering som indeksforhold, ikke som sum af dagens trin', () => {
    // 1.10.2021: nominelt 1,01 % + (−0,02 %) = 0,99 %, men det akkumulerede indeks
    // gik 1,442796 → 1,456933, dvs. den realiserede regulering er +0,98 %.
    expect(getKLReguleringPctForDato(d('01-10-2021'))).toBe(0.98);
    // 1.10.2022: nominelt 1,90 % + 0,67 % = 2,57 %, indeks 1,456933 → 1,494018 = +2,55 %.
    expect(getKLReguleringPctForDato(d('01-10-2022'))).toBe(2.55);
    // 1.10.2023: nominelt 0,81 % + 0,47 % = 1,28 %, indeks 1,498304 → 1,516971 = +1,25 %.
    expect(getKLReguleringPctForDato(d('01-10-2023'))).toBe(1.25);
  });

  it('afviger også fra det nominelle aftaletal på dage med kun én regulering', () => {
    // Det nominelle aftaletal ganger ikke rent op til det akkumulerede indeks.
    // 1.4.2023: nominelt 0,30 %, indeks 1,494018 → 1,498304 = +0,29 %.
    expect(getKLReguleringPctForDato(d('01-04-2023'))).toBe(0.29);
    // 1.4.2007: nominelt 0,80 %, indeks 1,151539 → 1,160535 = +0,78 %.
    expect(getKLReguleringPctForDato(d('01-04-2007'))).toBe(0.78);
    // Dage hvor indeksforholdet tilfældigvis rammer det nominelle tal på 2 decimaler.
    expect(getKLReguleringPctForDato(d('01-04-2024'))).toBe(4.0);
    expect(getKLReguleringPctForDato(d('01-10-2024'))).toBe(1.3);
  });

  it('giver undefined for basisdatoen, rene ikke-regulerende datoer og ukendte datoer', () => {
    // Basisdatoen har ingen forudgående periode.
    expect(getKLReguleringPctForDato(d('01-04-2005'))).toBeUndefined();
    // Rene ikke-regulerende datoer er ikke en regulerende dato (udeladt af serien).
    expect(getKLReguleringPctForDato(d('01-04-2019'))).toBeUndefined();
    expect(getKLReguleringPctForDato(d('15-07-2021'))).toBeUndefined();
  });
});

describe('perioderegulering rekonstruerer den autoritative akkumulerede regulering', () => {
  // Den deduplikerede indeksserie (endeligt indeks pr. dato, ikke-regulerende datoer
  // udeladt), bygget direkte fra kilde-rækkerne brugeren kan downloade.
  const dedupedSerie: Array<readonly [string, number]> = (() => {
    const finalByDate = new Map<string, number>();
    for (const row of klLoenaftaleRaekker) finalByDate.set(row.fraDato, row.indeks);
    const serie: Array<readonly [string, number]> = [];
    let prev: number | undefined;
    for (const [dato, indeks] of finalByDate) {
      if (prev !== undefined && indeks === prev) continue;
      serie.push([dato, indeks] as const);
      prev = indeks;
    }
    return serie;
  })();

  it('hver periodes regulering reproducerer det akkumulerede indeks fra det forrige (inden for 2-decimal-afrunding)', () => {
    for (let i = 1; i < dedupedSerie.length; i += 1) {
      const [, prevIndeks] = dedupedSerie[i - 1];
      const [dato, indeks] = dedupedSerie[i];
      const pct = getKLReguleringPctForDato(toDanishDateString(dato));
      expect(pct).toBeDefined();
      const rekonstrueret = prevIndeks * (1 + pct! / 100);
      // En 2-decimal-procent kan afvige op til 0,005 pp; på et indeks omkring 1,6
      // svarer det til < 1e-4 absolut. Indekset selv er den autoritative kilde.
      expect(Math.abs(rekonstrueret - indeks)).toBeLessThan(1e-4);
    }
  });

  it('summen af de nominelle dagstrin ville IKKE ramme indekset (dokumenterer den rettede fejl)', () => {
    // 1.10.2022: den gamle additive metode gav 2,57 %, som anvendt på 1,456933 giver
    // 1,494381 — ikke det autoritative 1,494018. Indeksforholdet (2,55 %) rammer.
    const naivAdditiv = 1.456933 * (1 + 2.57 / 100);
    expect(Math.abs(naivAdditiv - 1.494018)).toBeGreaterThan(1e-4);
    const korrekt = 1.456933 * (1 + getKLReguleringPctForDato(toDanishDateString('01-10-2022'))! / 100);
    expect(Math.abs(korrekt - 1.494018)).toBeLessThan(1e-4);
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
