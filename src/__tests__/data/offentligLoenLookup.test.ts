import { toDanishDateString } from '../../types/branded';
import { addDays, formatDanishDate, parseDanishDate } from '../../utils/dateUtils';
import {
  getOffentligLoenForDato,
  getOffentligLoenTabelForDato,
  getOffentligLoenForPeriode,
  getReguleringsDatoer,
  getReguleringsDatoIntervalForOffentligLoen,
  assertOffentligLoenDataIntegritet,
  assertOffentligLoenTabelIkkeTom,
} from '../../data/offentligLoenLookup';
import { klLoenSatser } from '../../data/KL/klLoenSatser';
import { rltnLoenSatser } from '../../data/RLTN/rltnLoenSatser';
import { toLoentrin } from '../../data/offentligLoenTypes';
import type { OffentligOverenskomstType } from '../../data/offentligLoenTypes';

const d = (s: string) => toDanishDateString(s);
const lt = toLoentrin;

describe('offentligLoenLookup', () => {
  // ===== DATASTRUKTUR =====

  describe('datastruktur', () => {
    it.each<OffentligOverenskomstType>(['KL', 'RLTN'])(
      '%s: har mindst én reguleringsperiode',
      (type) => {
        const satser = type === 'KL' ? klLoenSatser : rltnLoenSatser;
        expect(satser.length).toBeGreaterThan(0);
      }
    );

    describe('assertOffentligLoenTabelIkkeTom (fail-closed data-guard)', () => {
      it('de faktiske KL/RLTN-tabeller passerer guarden (tal-neutral i dag)', () => {
        expect(() => assertOffentligLoenTabelIkkeTom(klLoenSatser, 'KL')).not.toThrow();
        expect(() => assertOffentligLoenTabelIkkeTom(rltnLoenSatser, 'RLTN')).not.toThrow();
      });

      it('en tom løntabel fail-closer', () => {
        expect(() => assertOffentligLoenTabelIkkeTom([], 'KL')).toThrow(/tom/);
      });
    });

    describe('assertOffentligLoenDataIntegritet (samlet load-guard)', () => {
      it('de faktiske KL/RLTN-tabeller passerer den samlede guard', () => {
        expect(() => assertOffentligLoenDataIntegritet(klLoenSatser, 'KL')).not.toThrow();
        expect(() => assertOffentligLoenDataIntegritet(rltnLoenSatser, 'RLTN')).not.toThrow();
      });

      it('fail-closer ved tom, mis-sorteret eller duplikeret løntabel', () => {
        expect(() => assertOffentligLoenDataIntegritet([], 'KL')).toThrow(/tom/);
        expect(() => assertOffentligLoenDataIntegritet(klLoenSatser.slice().reverse(), 'KL')).toThrow(/rækkefølgen/);
        expect(() => assertOffentligLoenDataIntegritet([klLoenSatser[0], klLoenSatser[0]], 'KL')).toThrow(/rækkefølgen/);
      });
    });

    it.each<OffentligOverenskomstType>(['KL', 'RLTN'])(
      '%s: hver regulering har 56 løntrin',
      (type) => {
        const satser = type === 'KL' ? klLoenSatser : rltnLoenSatser;
        for (const reg of satser) {
          expect(reg.entries).toHaveLength(56);
        }
      }
    );

    it.each<OffentligOverenskomstType>(['KL', 'RLTN'])(
      '%s: indeholder alle løntrin 1-55 og 55+',
      (type) => {
        const satser = type === 'KL' ? klLoenSatser : rltnLoenSatser;
        for (const reg of satser) {
          const trin = reg.entries.map((e) => e.loentrin);
          for (let t = 1; t <= 55; t++) {
            expect(trin).toContain(t);
          }
          expect(trin).toContain('55+');
        }
      }
    );

    it.each<OffentligOverenskomstType>(['KL', 'RLTN'])(
      '%s: løntrin 42+ har identiske gruppeværdier',
      (type) => {
        const satser = type === 'KL' ? klLoenSatser : rltnLoenSatser;
        for (const reg of satser) {
          for (const entry of reg.entries) {
            const is42Plus = entry.loentrin === '55+' || (typeof entry.loentrin === 'number' && entry.loentrin >= 42);
            if (is42Plus) {
              const mVals = Object.values(entry.maanedsLoen);
              const tVals = Object.values(entry.timeLoen);
              expect(new Set(mVals).size).toBe(1);
              expect(new Set(tVals).size).toBe(1);
            }
          }
        }
      }
    );

    it.each<OffentligOverenskomstType>(['KL', 'RLTN'])(
      '%s: alle værdier er positive tal',
      (type) => {
        const satser = type === 'KL' ? klLoenSatser : rltnLoenSatser;
        for (const reg of satser) {
          for (const entry of reg.entries) {
            for (const g of [0, 1, 2, 3, 4] as const) {
              expect(entry.maanedsLoen[g]).toBeGreaterThan(0);
              expect(entry.timeLoen[g]).toBeGreaterThan(0);
            }
          }
        }
      }
    );
  });

  // ===== STIKPRØVE: KENDTE VÆRDIER FRA EXCEL =====

  describe('stikprøve mod Excel-kilde', () => {
    it('KL 01-04-2024, løntrin 1, Gruppe 0', () => {
      const result = getOffentligLoenForDato('KL', d('01-04-2024'), lt(1), 0);
      expect(result).toBeDefined();
      expect(result!.maanedsLoen).toBe(19351.75);
      expect(result!.timeLoen).toBe(120.7);
    });

    it('KL 01-04-2024, løntrin 42, Gruppe 0 (identisk på tværs af grupper)', () => {
      const result = getOffentligLoenForDato('KL', d('01-04-2024'), lt(42), 0);
      expect(result).toBeDefined();
      expect(result!.maanedsLoen).toBe(38050);
      expect(result!.timeLoen).toBe(237.32);
    });

    it('KL 01-04-2024, løntrin 42, Gruppe 4 (identisk med Gruppe 0)', () => {
      const result = getOffentligLoenForDato('KL', d('01-04-2024'), lt(42), 4);
      expect(result).toBeDefined();
      expect(result!.maanedsLoen).toBe(38050);
      expect(result!.timeLoen).toBe(237.32);
    });

    it('KL 01-04-2024, løntrin 55+, Gruppe 0', () => {
      const result = getOffentligLoenForDato('KL', d('01-04-2024'), '55+', 0);
      expect(result).toBeDefined();
      expect(result!.maanedsLoen).toBe(99169.67);
      expect(result!.timeLoen).toBe(618.52);
    });

    it('RLTN 01-04-2024, løntrin 10, Gruppe 2', () => {
      const result = getOffentligLoenForDato('RLTN', d('01-04-2024'), lt(10), 2);
      expect(result).toBeDefined();
      expect(result!.maanedsLoen).toBe(22396.67);
      expect(result!.timeLoen).toBe(139.69);
    });
  });

  // ===== DATOBASERET OPSLAG =====

  describe('getOffentligLoenForDato', () => {
    it('returnerer korrekt regulering for præcis match på dato', () => {
      const result = getOffentligLoenForDato('KL', d('01-10-2024'), lt(1), 0);
      expect(result).toBeDefined();
      expect(result!.effectiveDate).toBe(d('01-10-2024'));
    });

    it('returnerer gældende regulering for dato mellem to reguleringer', () => {
      // 15-06-2024 er mellem 01-04-2024 og 01-10-2024
      const result = getOffentligLoenForDato('KL', d('15-06-2024'), lt(1), 0);
      expect(result).toBeDefined();
      expect(result!.effectiveDate).toBe(d('01-04-2024'));
    });

    it('returnerer nyeste regulering for dato efter sidste regulering', () => {
      const result = getOffentligLoenForDato('KL', d('01-03-2026'), lt(1), 0);
      expect(result).toBeDefined();
      expect(result!.effectiveDate).toBe(d('01-11-2025'));
    });

    it('returnerer undefined for dato før første regulering', () => {
      const result = getOffentligLoenForDato('KL', d('01-06-2011'), lt(1), 0);
      expect(result).toBeUndefined();
    });

    it('toLoentrin kaster ved ugyldigt løntrin', () => {
      expect(() => toLoentrin(99)).toThrow('Ugyldigt løntrin');
      expect(() => toLoentrin(0)).toThrow('Ugyldigt løntrin');
      expect(() => toLoentrin(-1)).toThrow('Ugyldigt løntrin');
      expect(() => toLoentrin(56)).toThrow('Ugyldigt løntrin');
      expect(() => toLoentrin(1.5)).toThrow('Ugyldigt løntrin');
    });

    it('toLoentrin accepterer numeriske strenge ("1".."55")', () => {
      expect(toLoentrin('1')).toBe(1);
      expect(toLoentrin('55')).toBe(55);
      expect(toLoentrin('42')).toBe(42);
    });

    it('toLoentrin kaster ved ugyldige strenge', () => {
      expect(() => toLoentrin('0')).toThrow('Ugyldigt løntrin');
      expect(() => toLoentrin('56')).toThrow('Ugyldigt løntrin');
      expect(() => toLoentrin('abc')).toThrow('Ugyldigt løntrin');
      expect(() => toLoentrin('1.5')).toThrow('Ugyldigt løntrin');
      expect(() => toLoentrin('')).toThrow('Ugyldigt løntrin');
    });

    it('håndterer 55+ som løntrin korrekt', () => {
      const result = getOffentligLoenForDato('RLTN', d('01-10-2025'), '55+', 3);
      expect(result).toBeDefined();
      expect(result!.loentrin).toBe('55+');
      expect(result!.loengruppe).toBe(3);
    });

    it('returnerer korrekt løngruppe-specifik værdi', () => {
      // Løntrin 1 har forskellige værdier for forskellige grupper
      const gr0 = getOffentligLoenForDato('KL', d('01-04-2024'), lt(1), 0);
      const gr4 = getOffentligLoenForDato('KL', d('01-04-2024'), lt(1), 4);
      expect(gr0).toBeDefined();
      expect(gr4).toBeDefined();
      expect(gr0!.maanedsLoen).not.toBe(gr4!.maanedsLoen);
      expect(gr4!.maanedsLoen).toBeGreaterThan(gr0!.maanedsLoen);
    });
  });

  describe('getOffentligLoenTabelForDato', () => {
    it('returnerer gældende tabel med 56 løntrin og korrekt effekt-dato', () => {
      const tabel = getOffentligLoenTabelForDato('KL', d('15-06-2024'));
      expect(tabel).toBeDefined();
      expect(tabel!.effectiveDate).toBe(d('01-04-2024'));
      expect(tabel!.entries).toHaveLength(56);
      expect(tabel!.entries[0].loentrin).toBe(1);
      expect(tabel!.entries[tabel!.entries.length - 1].loentrin).toBe('55+');
    });

    it('returnerer undefined for dato før første regulering', () => {
      const tabel = getOffentligLoenTabelForDato('KL', d('01-06-2011'));
      expect(tabel).toBeUndefined();
    });
  });

  // ===== PERIODE-OPSLAG =====

  describe('getOffentligLoenForPeriode', () => {
    it('returnerer alle reguleringer i en periode', () => {
      // Periode 01-03-2024 til 01-12-2024 dækker 01-10-2023 (gældende), 01-04-2024 og 01-10-2024
      const resultater = getOffentligLoenForPeriode(
        'KL', d('01-03-2024'), d('01-12-2024'), lt(1), 0
      );
      expect(resultater.length).toBe(3);
      expect(resultater[0].effectiveDate).toBe(d('01-10-2023'));
      expect(resultater[1].effectiveDate).toBe(d('01-04-2024'));
      expect(resultater[2].effectiveDate).toBe(d('01-10-2024'));
    });

    it('inkluderer gældende regulering ved periodens start', () => {
      // Start 15-05-2024 → gældende er 01-04-2024, plus 01-10-2024
      const resultater = getOffentligLoenForPeriode(
        'KL', d('15-05-2024'), d('01-12-2024'), lt(1), 0
      );
      expect(resultater.length).toBe(2);
      expect(resultater[0].effectiveDate).toBe(d('01-04-2024'));
      expect(resultater[1].effectiveDate).toBe(d('01-10-2024'));
    });

    it('returnerer tom liste for periode før første regulering', () => {
      const resultater = getOffentligLoenForPeriode(
        'KL', d('01-01-2010'), d('01-06-2011'), lt(1), 0
      );
      expect(resultater).toHaveLength(0);
    });

    it('returnerer tom liste for omvendt periode', () => {
      const resultater = getOffentligLoenForPeriode(
        'KL', d('01-12-2024'), d('01-04-2024'), lt(1), 0
      );
      expect(resultater).toHaveLength(0);
    });

    it('er sorteret kronologisk (ældste først)', () => {
      const resultater = getOffentligLoenForPeriode(
        'RLTN', d('01-04-2024'), d('01-12-2025'), lt(10), 2
      );
      expect(resultater.length).toBeGreaterThanOrEqual(2);
      // DanishDateStrings er DD-MM-YYYY, kan ikke sammenlignes med > direkte
      const toNum = (dato: string) => {
        const [dd, mm, yyyy] = dato.split('-').map(Number);
        return yyyy * 10000 + mm * 100 + dd;
      };
      for (let i = 1; i < resultater.length; i++) {
        expect(toNum(resultater[i].effectiveDate)).toBeGreaterThan(
          toNum(resultater[i - 1].effectiveDate)
        );
      }
    });

    it('inkluderer regulering når fraDato er præcis effectiveDate', () => {
      const datoer = getReguleringsDatoer('KL');
      expect(datoer.length).toBeGreaterThan(1);
      const target = datoer[1];
      const resultater = getOffentligLoenForPeriode('KL', target, target, lt(1), 0);
      expect(resultater.length).toBeGreaterThanOrEqual(1);
      expect(resultater[0].effectiveDate).toBe(target);
    });

    it('inkluderer regulering når tilDato er præcis effectiveDate', () => {
      const datoer = getReguleringsDatoer('KL');
      expect(datoer.length).toBeGreaterThan(1);
      const target = datoer[1];
      const resultater = getOffentligLoenForPeriode('KL', datoer[0], target, lt(1), 0);
      expect(resultater[resultater.length - 1].effectiveDate).toBe(target);
    });

    it('ekskluderer regulering hvis perioden slutter dagen før effectiveDate', () => {
      const datoer = getReguleringsDatoer('KL');
      expect(datoer.length).toBeGreaterThan(1);
      const next = datoer[1];
      const nextDate = parseDanishDate(next);
      expect(nextDate).toBeDefined();
      const dayBefore = formatDanishDate(addDays(nextDate!, -1));

      const resultater = getOffentligLoenForPeriode('KL', datoer[0], dayBefore, lt(1), 0);
      expect(resultater).toHaveLength(1);
      expect(resultater[0].effectiveDate).toBe(datoer[0]);
    });
  });

  // ===== HJÆLPEFUNKTIONER =====

  describe('getReguleringsDatoer', () => {
    it.each<OffentligOverenskomstType>(['KL', 'RLTN'])(
      '%s: returnerer mindst én dato',
      (type) => {
        const datoer = getReguleringsDatoer(type);
        expect(datoer.length).toBeGreaterThan(0);
      }
    );

    it.each<OffentligOverenskomstType>(['KL', 'RLTN'])(
      '%s: antal datoer matcher antal reguleringer',
      (type) => {
        const satser = type === 'KL' ? klLoenSatser : rltnLoenSatser;
        const datoer = getReguleringsDatoer(type);
        expect(datoer).toHaveLength(satser.length);
      }
    );

    it('er sorteret kronologisk (ældste først)', () => {
      const datoer = getReguleringsDatoer('KL');
      const toNum = (dato: string) => {
        const [dd, mm, yyyy] = dato.split('-').map(Number);
        return yyyy * 10000 + mm * 100 + dd;
      };
      for (let i = 1; i < datoer.length; i++) {
        expect(toNum(datoer[i])).toBeGreaterThan(toNum(datoer[i - 1]));
      }
    });
  });

  describe('getReguleringsDatoIntervalForOffentligLoen', () => {
    it.each<OffentligOverenskomstType>(['KL', 'RLTN'])(
      '%s: returnerer interval med fraDato = ældste og tilDato efter nyeste',
      (type) => {
        const interval = getReguleringsDatoIntervalForOffentligLoen(type);
        expect(interval).toBeDefined();
        const datoer = getReguleringsDatoer(type);
        // fraDato = ældste regulering
        expect(interval!.fraDato).toBe(datoer[0]);
        // tilDato skal være strengt efter nyeste regulering
        const toNum = (dato: string) => {
          const [dd, mm, yyyy] = dato.split('-').map(Number);
          return yyyy * 10000 + mm * 100 + dd;
        };
        expect(toNum(interval!.tilDato)).toBeGreaterThan(toNum(datoer[datoer.length - 1]));
      }
    );
  });
});
