import {
  sygedagpengeRates,
  resolveObligatoriskPensionProcent,
  resolveEgetAtpBidragPrKalenderuge,
  resolveKommunaltAtpBidragPrKalenderuge,
  SYGEDAGPENGE_RATE_MIN_DATE,
  SYGEDAGPENGE_RATE_MAX_DATE,
  type DatedSygedagpengeRate,
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

  it('kommunalt ATP-bidrag er altid dobbelt af eget ATP-bidrag', () => {
    for (const rate of sygedagpengeRates) {
      expect(rate.kommunaltAtpPrKalenderuge).toBe(rate.egetAtpPrKalenderuge * 2);
    }
  });

  it('eksponerer min/max-datoer fra første og sidste satsår', () => {
    expect(SYGEDAGPENGE_RATE_MIN_DATE).toBe(toISODateString('2005-01-03'));
    expect(SYGEDAGPENGE_RATE_MAX_DATE).toBe(toISODateString('2027-01-03'));
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
      expect(eget).toBe(rate.egetAtpPrKalenderuge);
      expect(kommunalt).toBe(eget * 2);
    }
  });

  it('fail-closed: kaster hvis kommunalt ATP ikke er dobbelt af eget', () => {
    const ugyldigt: DatedSygedagpengeRate = {
      fraDato: toISODateString('2024-01-01'),
      tilDato: toISODateString('2025-01-05'),
      sygedagpengePrDagMax: 939,
      egetAtpPrKalenderuge: 53,
      kommunaltAtpPrKalenderuge: 100, // ikke 2 × 53
      obligatoriskPensionProcent: 1.5,
    };
    expect(() => resolveKommunaltAtpBidragPrKalenderuge(ugyldigt)).toThrow(/dobbelt/);
  });
});
