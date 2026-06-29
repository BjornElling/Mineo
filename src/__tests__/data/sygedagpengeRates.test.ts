import {
  beregnEgetAtpBidragForTimer,
  beregnKommunaltAtpBidragForTimer,
  beregnSygedagpengeForTimer,
  sygedagpengeRates,
  resolveObligatoriskPensionProcent,
  resolveEgetAtpBidragPrKalenderuge,
  resolveKommunaltAtpBidragPrKalenderuge,
  resolveSygedagpengeTimerForUtcWeekday,
  SYGEDAGPENGE_TIMER_PR_FULD_UGE,
  SYGEDAGPENGE_RATE_MIN_DATE,
  SYGEDAGPENGE_RATE_MAX_DATE,
} from '../../data/sygedagpengeRates';
import { toISODateString } from '../../types/branded';
import { getDayAfterIso } from '../../utils/isoDateHelpers';

const dagEfter = (iso: string): string => getDayAfterIso(toISODateString(iso));

/** Første satsår med obligatorisk pension (6. januar 2020). */
const OP_START = '2020-01-06';

describe('sygedagpengeRates – samlet satstabel', () => {
  it('har ingen huller eller overlap mellem satsår (næste fraDato = dagen efter tilDato)', () => {
    for (let i = 1; i < sygedagpengeRates.length; i += 1) {
      const forrige = sygedagpengeRates[i - 1]!;
      const naeste = sygedagpengeRates[i]!;
      expect(naeste.fraDato).toBe(dagEfter(forrige.tilDato));
    }
  });

  it('hvert satsår har fraDato <= tilDato', () => {
    for (const rate of sygedagpengeRates) {
      expect(rate.fraDato <= rate.tilDato).toBe(true);
    }
  });

  it('kommunalt ATP-bidrag er altid dobbelt af eget afrundede ATP-bidrag', () => {
    for (const rate of sygedagpengeRates) {
      expect(resolveKommunaltAtpBidragPrKalenderuge(rate)).toBe(resolveEgetAtpBidragPrKalenderuge(rate) * 2);
    }
  });

  it('eksponerer min/max-datoer fra første og sidste satsår', () => {
    expect(SYGEDAGPENGE_RATE_MIN_DATE).toBe(toISODateString('2005-01-03'));
    expect(SYGEDAGPENGE_RATE_MAX_DATE).toBe(toISODateString('2027-01-03'));
  });
});

describe('sygedagpengeRates – timegrundlag og ugeafrunding', () => {
  it('fordeler fuld uge som 8 timer mandag-torsdag og 5 timer fredag', () => {
    expect(resolveSygedagpengeTimerForUtcWeekday(1)).toBe(8);
    expect(resolveSygedagpengeTimerForUtcWeekday(2)).toBe(8);
    expect(resolveSygedagpengeTimerForUtcWeekday(3)).toBe(8);
    expect(resolveSygedagpengeTimerForUtcWeekday(4)).toBe(8);
    expect(resolveSygedagpengeTimerForUtcWeekday(5)).toBe(5);
    expect(resolveSygedagpengeTimerForUtcWeekday(6)).toBe(0);
    expect(resolveSygedagpengeTimerForUtcWeekday(0)).toBe(0);
    expect([1, 2, 3, 4, 5].reduce((sum, weekday) => sum + resolveSygedagpengeTimerForUtcWeekday(weekday), 0))
      .toBe(SYGEDAGPENGE_TIMER_PR_FULD_UGE);
  });

  it('fuld uge beregnes som round(37 × timesats) for kendte satsår', () => {
    const expectedWeeklyRates: Record<string, number> = {
      '2005-01-03': 3275,
      '2018-01-01': 4300,
      '2025-01-06': 4865,
      '2026-01-05': 5085,
    };

    for (const [fraDato, expected] of Object.entries(expectedWeeklyRates)) {
      const rate = sygedagpengeRates.find((candidate) => candidate.fraDato === toISODateString(fraDato));
      expect(rate).toBeDefined();
      expect(beregnSygedagpengeForTimer(rate!, SYGEDAGPENGE_TIMER_PR_FULD_UGE)).toBe(expected);
    }
  });

  it('delvis uge afrundes på ugens timer, ikke på enkeltdage', () => {
    const rate2025 = sygedagpengeRates.find((rate) => rate.fraDato === toISODateString('2025-01-06'));
    expect(rate2025).toBeDefined();
    // Torsdag + fredag er 13 timer: round(13 × 131,49) = 1.709.
    expect(beregnSygedagpengeForTimer(rate2025!, 13)).toBe(1709);
  });
});

describe('sygedagpengeRates – obligatorisk pension som kolonne', () => {
  it('OP er 0 for alle satsår før ordningens ikrafttræden (6. januar 2020)', () => {
    const foerOP = sygedagpengeRates.filter((rate) => rate.fraDato < OP_START);
    expect(foerOP.length).toBeGreaterThan(0);
    for (const rate of foerOP) {
      expect(rate.obligatoriskPensionProcent).toBe(0);
    }
  });

  it('OP er positiv for alle satsår fra og med ikrafttrædelsen', () => {
    const fraOP = sygedagpengeRates.filter((rate) => rate.fraDato >= OP_START);
    expect(fraOP.length).toBeGreaterThan(0);
    for (const rate of fraOP) {
      expect(rate.obligatoriskPensionProcent).toBeGreaterThan(0);
    }
  });

  it('satsåret 2020-01-06 starter OP på 0,3 pct.', () => {
    const rate2020 = sygedagpengeRates.find((rate) => rate.fraDato === OP_START);
    expect(rate2020?.obligatoriskPensionProcent).toBe(0.3);
  });
});

describe('resolveObligatoriskPensionProcent', () => {
  it('returnerer 0 for et satsår før OP-ordningen', () => {
    const foerOP = sygedagpengeRates.find((rate) => rate.fraDato < OP_START);
    expect(foerOP).toBeDefined();
    expect(resolveObligatoriskPensionProcent(foerOP!)).toBe(0);
  });

  it('returnerer den korrekte sats for et kendt satsår (2024 → 1,5 pct.)', () => {
    const rate2024 = sygedagpengeRates.find((rate) => rate.fraDato === '2024-01-01');
    expect(rate2024).toBeDefined();
    expect(resolveObligatoriskPensionProcent(rate2024!)).toBe(1.5);
  });
});

describe('resolveEgetAtpBidragPrKalenderuge / resolveKommunaltAtpBidragPrKalenderuge', () => {
  it('returnerer satsårets ATP, og kommunalt = 2 × eget', () => {
    for (const rate of sygedagpengeRates) {
      const eget = resolveEgetAtpBidragPrKalenderuge(rate);
      const kommunalt = resolveKommunaltAtpBidragPrKalenderuge(rate);
      expect(kommunalt).toBe(eget * 2);
      expect(eget).toBe(beregnEgetAtpBidragForTimer(rate, SYGEDAGPENGE_TIMER_PR_FULD_UGE));
      expect(kommunalt).toBe(beregnKommunaltAtpBidragForTimer(rate, SYGEDAGPENGE_TIMER_PR_FULD_UGE));
    }
  });

  it('beregner delvis ATP på timer og afrunder eget-bidrag før kommunal fordobling', () => {
    const rate2025 = sygedagpengeRates.find((rate) => rate.fraDato === toISODateString('2025-01-06'));
    expect(rate2025).toBeDefined();
    // Torsdag + fredag er 13 timer: eget = round(13 × 4,26 × 1/3) = 18, kommunalt = 36.
    expect(beregnEgetAtpBidragForTimer(rate2025!, 13)).toBe(18);
    expect(beregnKommunaltAtpBidragForTimer(rate2025!, 13)).toBe(36);
  });
});
