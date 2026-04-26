import { getFolkepensionAlder } from '../../../data/folkepensionAlderRates';
import { toISODateString } from '../../../types/branded';

// Periodegrænser (opslagsdato):
//   2003-01-01 – 2009-06-30
//   2009-07-01 – 2015-12-28
//   2015-12-29 – 2020-12-30
//   2020-12-31 – 2025-12-30
//   2025-12-31 –

const fp = (f: string, o: string) =>
  getFolkepensionAlder(toISODateString(f), toISODateString(o));

describe('getFolkepensionAlder', () => {
  describe('opslagsdato uden for dækket periode', () => {
    it('returnerer null for opslagsdato før 2003-01-01', () => {
      expect(fp('1960-01-01', '2002-12-31')).toBeNull();
    });
  });

  describe('periode 2003-01-01 – 2009-06-30', () => {
    it('giver 67 år for fødselsdato til og med 1939-06-30', () => {
      expect(fp('1939-06-30', '2005-01-01')).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
    });

    it('giver 65 år for fødselsdato fra og med 1939-07-01', () => {
      expect(fp('1939-07-01', '2005-01-01')).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });

    it('giver 65 år for en typisk yngre årgank', () => {
      expect(fp('1960-01-01', '2008-06-30')).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });

    it('returnerer korrekt resultat på den første dag i perioden', () => {
      expect(fp('1960-01-01', '2003-01-01')).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });

    it('returnerer korrekt resultat på den sidste dag i perioden', () => {
      expect(fp('1960-01-01', '2009-06-30')).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });
  });

  describe('periode 2009-07-01 – 2015-12-28 (L 485/2009)', () => {
    it('første dag i perioden returnerer korrekt', () => {
      // 1960-01-01 er i intervallet 1955-07-01 og frem → 67 år
      expect(fp('1960-01-01', '2009-07-01')).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
      // 1950-01-01 er før 1953-12-31 → 65 år
      expect(fp('1950-01-01', '2009-07-01')).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });

    it('giver 65 år for fødselsdato til og med 1953-12-31', () => {
      expect(fp('1953-12-31', '2010-01-01')).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });

    it('giver 65,5 år for fødselsdato 1954-01-01 – 1954-06-30', () => {
      expect(fp('1954-01-01', '2010-01-01')).toEqual({ alderMaaneder: 786, alderLabel: '65,5 år' });
      expect(fp('1954-06-30', '2010-01-01')).toEqual({ alderMaaneder: 786, alderLabel: '65,5 år' });
    });

    it('giver 66 år for fødselsdato 1954-07-01 – 1954-12-31', () => {
      expect(fp('1954-07-01', '2010-01-01')).toEqual({ alderMaaneder: 792, alderLabel: '66 år' });
      expect(fp('1954-12-31', '2010-01-01')).toEqual({ alderMaaneder: 792, alderLabel: '66 år' });
    });

    it('giver 66,5 år for fødselsdato 1955-01-01 – 1955-06-30', () => {
      expect(fp('1955-01-01', '2010-01-01')).toEqual({ alderMaaneder: 798, alderLabel: '66,5 år' });
      expect(fp('1955-06-30', '2010-01-01')).toEqual({ alderMaaneder: 798, alderLabel: '66,5 år' });
    });

    it('giver 67 år for fødselsdato fra og med 1955-07-01', () => {
      expect(fp('1955-07-01', '2010-01-01')).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
      expect(fp('1980-01-01', '2010-01-01')).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
    });

    it('returnerer korrekt resultat på den sidste dag i perioden', () => {
      expect(fp('1960-01-01', '2015-12-28')).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
    });
  });

  describe('periode 2015-12-29 – 2020-12-30 (L 395/2015)', () => {
    it('første dag i perioden returnerer korrekt', () => {
      expect(fp('1960-01-01', '2015-12-29')).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
    });

    it('giver 68 år for fødselsdato fra og med 1963-01-01', () => {
      expect(fp('1963-01-01', '2016-01-01')).toEqual({ alderMaaneder: 816, alderLabel: '68 år' });
      expect(fp('1980-01-01', '2016-01-01')).toEqual({ alderMaaneder: 816, alderLabel: '68 år' });
    });

    it('giver 67 år for fødselsdato 1955-07-01 – 1962-12-31', () => {
      expect(fp('1955-07-01', '2016-01-01')).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
      expect(fp('1962-12-31', '2016-01-01')).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
    });

    it('returnerer korrekt resultat på den sidste dag i perioden', () => {
      expect(fp('1980-01-01', '2020-12-30')).toEqual({ alderMaaneder: 816, alderLabel: '68 år' });
    });
  });

  describe('periode 2020-12-31 – 2025-12-30 (L 710/2020)', () => {
    it('første dag i perioden returnerer korrekt', () => {
      expect(fp('1980-01-01', '2020-12-31')).toEqual({ alderMaaneder: 828, alderLabel: '69 år' });
    });

    it('giver 69 år for fødselsdato fra og med 1967-01-01', () => {
      expect(fp('1967-01-01', '2021-01-01')).toEqual({ alderMaaneder: 828, alderLabel: '69 år' });
      expect(fp('1990-01-01', '2021-01-01')).toEqual({ alderMaaneder: 828, alderLabel: '69 år' });
    });

    it('giver 68 år for fødselsdato 1963-01-01 – 1966-12-31', () => {
      expect(fp('1963-01-01', '2021-01-01')).toEqual({ alderMaaneder: 816, alderLabel: '68 år' });
      expect(fp('1966-12-31', '2021-01-01')).toEqual({ alderMaaneder: 816, alderLabel: '68 år' });
    });

    it('returnerer korrekt resultat på den sidste dag i perioden', () => {
      expect(fp('1990-01-01', '2025-12-30')).toEqual({ alderMaaneder: 828, alderLabel: '69 år' });
    });
  });

  describe('periode 2025-12-31 og frem (L 710/2020, 70 år)', () => {
    it('første dag i perioden returnerer korrekt', () => {
      expect(fp('1990-01-01', '2025-12-31')).toEqual({ alderMaaneder: 840, alderLabel: '70 år' });
    });

    it('giver 70 år for fødselsdato fra og med 1971-01-01', () => {
      expect(fp('1971-01-01', '2026-01-01')).toEqual({ alderMaaneder: 840, alderLabel: '70 år' });
      expect(fp('2000-01-01', '2026-01-01')).toEqual({ alderMaaneder: 840, alderLabel: '70 år' });
    });

    it('giver 69 år for fødselsdato 1967-01-01 – 1970-12-31', () => {
      expect(fp('1967-01-01', '2026-01-01')).toEqual({ alderMaaneder: 828, alderLabel: '69 år' });
      expect(fp('1970-12-31', '2026-01-01')).toEqual({ alderMaaneder: 828, alderLabel: '69 år' });
    });

    it('giver 65 år for de ældste årgange', () => {
      expect(fp('1940-01-01', '2026-01-01')).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });
  });

  describe('fødselsdatogrænser der afgør aldersklasse', () => {
    const o = '2021-01-01';

    it('1953-12-31 giver 65 år', () => {
      expect(fp('1953-12-31', o)).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });

    it('1954-01-01 giver 65,5 år', () => {
      expect(fp('1954-01-01', o)).toEqual({ alderMaaneder: 786, alderLabel: '65,5 år' });
    });

    it('1962-12-31 giver 67 år', () => {
      expect(fp('1962-12-31', o)).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
    });

    it('1963-01-01 giver 68 år', () => {
      expect(fp('1963-01-01', o)).toEqual({ alderMaaneder: 816, alderLabel: '68 år' });
    });

    it('1966-12-31 giver 68 år', () => {
      expect(fp('1966-12-31', o)).toEqual({ alderMaaneder: 816, alderLabel: '68 år' });
    });

    it('1967-01-01 giver 69 år', () => {
      expect(fp('1967-01-01', o)).toEqual({ alderMaaneder: 828, alderLabel: '69 år' });
    });
  });
});
