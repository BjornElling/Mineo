import { getFolkepensionAlder, isWithinTwoYearsOfFolkepension } from '../../../data/folkepensionAlderRates';
import { toISODateString } from '../../../types/branded';

describe('isWithinTwoYearsOfFolkepension', () => {
  it.each([
    ['1955-07-15', '2020-07-14', '2020-07-15', '2020-07-16', '2022-07-15'],
    ['1954-03-31', '2017-09-29', '2017-09-30', '2017-10-01', '2019-09-30'],
    ['1954-05-31', '2017-11-29', '2017-11-30', '2017-12-01', '2019-11-30'],
    ['1960-02-29', '2025-02-27', '2025-02-28', '2025-03-01', '2027-02-28'],
  ])('bruger den faktiske pensionsdato ved fødselsdato %s', (birth, before, boundary, after, pension) => {
    const fodselsdato = toISODateString(birth);
    expect(isWithinTwoYearsOfFolkepension(fodselsdato, toISODateString(before))).toBe(false);
    for (const date of [boundary, after, pension]) {
      expect(isWithinTwoYearsOfFolkepension(fodselsdato, toISODateString(date))).toBe(true);
    }
  });

  it('returnerer false når pensionsalderen ikke kan bestemmes', () => {
    expect(isWithinTwoYearsOfFolkepension(toISODateString('1940-01-01'), toISODateString('2002-12-31'))).toBe(false);
  });
});

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
      expect(fp(toISODateString('1960-01-01'), toISODateString('2002-12-31'))).toBeNull();
    });
  });

  describe('periode 2003-01-01 – 2009-06-30', () => {
    it('giver 67 år for fødselsdato til og med 1939-06-30', () => {
      expect(fp(toISODateString('1939-06-30'), toISODateString('2005-01-01'))).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
    });

    it('giver 65 år for fødselsdato fra og med 1939-07-01', () => {
      expect(fp(toISODateString('1939-07-01'), toISODateString('2005-01-01'))).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });

    it('giver 65 år for en typisk yngre årgank', () => {
      expect(fp(toISODateString('1960-01-01'), toISODateString('2008-06-30'))).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });

    it('returnerer korrekt resultat på den første dag i perioden', () => {
      expect(fp(toISODateString('1960-01-01'), toISODateString('2003-01-01'))).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });

    it('returnerer korrekt resultat på den sidste dag i perioden', () => {
      expect(fp(toISODateString('1960-01-01'), toISODateString('2009-06-30'))).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });
  });

  describe('periode 2009-07-01 – 2015-12-28 (L 485/2009)', () => {
    it('første dag i perioden returnerer korrekt', () => {
      // 1960-01-01 er i intervallet 1955-07-01 og frem → 67 år
      expect(fp(toISODateString('1960-01-01'), toISODateString('2009-07-01'))).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
      // 1950-01-01 er før 1953-12-31 → 65 år
      expect(fp(toISODateString('1950-01-01'), toISODateString('2009-07-01'))).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });

    it('giver 65 år for fødselsdato til og med 1953-12-31', () => {
      expect(fp(toISODateString('1953-12-31'), toISODateString('2010-01-01'))).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });

    it('giver 65,5 år for fødselsdato 1954-01-01 – 1954-06-30', () => {
      expect(fp(toISODateString('1954-01-01'), toISODateString('2010-01-01'))).toEqual({ alderMaaneder: 786, alderLabel: '65,5 år' });
      expect(fp(toISODateString('1954-06-30'), toISODateString('2010-01-01'))).toEqual({ alderMaaneder: 786, alderLabel: '65,5 år' });
    });

    it('giver 66 år for fødselsdato 1954-07-01 – 1954-12-31', () => {
      expect(fp(toISODateString('1954-07-01'), toISODateString('2010-01-01'))).toEqual({ alderMaaneder: 792, alderLabel: '66 år' });
      expect(fp(toISODateString('1954-12-31'), toISODateString('2010-01-01'))).toEqual({ alderMaaneder: 792, alderLabel: '66 år' });
    });

    it('giver 66,5 år for fødselsdato 1955-01-01 – 1955-06-30', () => {
      expect(fp(toISODateString('1955-01-01'), toISODateString('2010-01-01'))).toEqual({ alderMaaneder: 798, alderLabel: '66,5 år' });
      expect(fp(toISODateString('1955-06-30'), toISODateString('2010-01-01'))).toEqual({ alderMaaneder: 798, alderLabel: '66,5 år' });
    });

    it('giver 67 år for fødselsdato fra og med 1955-07-01', () => {
      expect(fp(toISODateString('1955-07-01'), toISODateString('2010-01-01'))).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
      expect(fp(toISODateString('1980-01-01'), toISODateString('2010-01-01'))).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
    });

    it('returnerer korrekt resultat på den sidste dag i perioden', () => {
      expect(fp(toISODateString('1960-01-01'), toISODateString('2015-12-28'))).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
    });
  });

  describe('periode 2015-12-29 – 2020-12-30 (L 395/2015)', () => {
    it('første dag i perioden returnerer korrekt', () => {
      expect(fp(toISODateString('1960-01-01'), toISODateString('2015-12-29'))).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
    });

    it('giver 68 år for fødselsdato fra og med 1963-01-01', () => {
      expect(fp(toISODateString('1963-01-01'), toISODateString('2016-01-01'))).toEqual({ alderMaaneder: 816, alderLabel: '68 år' });
      expect(fp(toISODateString('1980-01-01'), toISODateString('2016-01-01'))).toEqual({ alderMaaneder: 816, alderLabel: '68 år' });
    });

    it('giver 67 år for fødselsdato 1955-07-01 – 1962-12-31', () => {
      expect(fp(toISODateString('1955-07-01'), toISODateString('2016-01-01'))).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
      expect(fp(toISODateString('1962-12-31'), toISODateString('2016-01-01'))).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
    });

    it('returnerer korrekt resultat på den sidste dag i perioden', () => {
      expect(fp(toISODateString('1980-01-01'), toISODateString('2020-12-30'))).toEqual({ alderMaaneder: 816, alderLabel: '68 år' });
    });
  });

  describe('periode 2020-12-31 – 2025-12-30 (L 710/2020)', () => {
    it('første dag i perioden returnerer korrekt', () => {
      expect(fp(toISODateString('1980-01-01'), toISODateString('2020-12-31'))).toEqual({ alderMaaneder: 828, alderLabel: '69 år' });
    });

    it('giver 69 år for fødselsdato fra og med 1967-01-01', () => {
      expect(fp(toISODateString('1967-01-01'), toISODateString('2021-01-01'))).toEqual({ alderMaaneder: 828, alderLabel: '69 år' });
      expect(fp(toISODateString('1990-01-01'), toISODateString('2021-01-01'))).toEqual({ alderMaaneder: 828, alderLabel: '69 år' });
    });

    it('giver 68 år for fødselsdato 1963-01-01 – 1966-12-31', () => {
      expect(fp(toISODateString('1963-01-01'), toISODateString('2021-01-01'))).toEqual({ alderMaaneder: 816, alderLabel: '68 år' });
      expect(fp(toISODateString('1966-12-31'), toISODateString('2021-01-01'))).toEqual({ alderMaaneder: 816, alderLabel: '68 år' });
    });

    it('returnerer korrekt resultat på den sidste dag i perioden', () => {
      expect(fp(toISODateString('1990-01-01'), toISODateString('2025-12-30'))).toEqual({ alderMaaneder: 828, alderLabel: '69 år' });
    });
  });

  describe('periode 2025-12-31 og frem (L 710/2020, 70 år)', () => {
    it('første dag i perioden returnerer korrekt', () => {
      expect(fp(toISODateString('1990-01-01'), toISODateString('2025-12-31'))).toEqual({ alderMaaneder: 840, alderLabel: '70 år' });
    });

    it('giver 70 år for fødselsdato fra og med 1971-01-01', () => {
      expect(fp(toISODateString('1971-01-01'), toISODateString('2026-01-01'))).toEqual({ alderMaaneder: 840, alderLabel: '70 år' });
      expect(fp(toISODateString('2000-01-01'), toISODateString('2026-01-01'))).toEqual({ alderMaaneder: 840, alderLabel: '70 år' });
    });

    it('giver 69 år for fødselsdato 1967-01-01 – 1970-12-31', () => {
      expect(fp(toISODateString('1967-01-01'), toISODateString('2026-01-01'))).toEqual({ alderMaaneder: 828, alderLabel: '69 år' });
      expect(fp(toISODateString('1970-12-31'), toISODateString('2026-01-01'))).toEqual({ alderMaaneder: 828, alderLabel: '69 år' });
    });

    it('giver 65 år for de ældste årgange', () => {
      expect(fp(toISODateString('1940-01-01'), toISODateString('2026-01-01'))).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });
  });

  describe('fødselsdatogrænser der afgør aldersklasse', () => {
    const o = toISODateString('2021-01-01');

    it('1953-12-31 giver 65 år', () => {
      expect(fp(toISODateString('1953-12-31'), o)).toEqual({ alderMaaneder: 780, alderLabel: '65 år' });
    });

    it('1954-01-01 giver 65,5 år', () => {
      expect(fp(toISODateString('1954-01-01'), o)).toEqual({ alderMaaneder: 786, alderLabel: '65,5 år' });
    });

    it('1962-12-31 giver 67 år', () => {
      expect(fp(toISODateString('1962-12-31'), o)).toEqual({ alderMaaneder: 804, alderLabel: '67 år' });
    });

    it('1963-01-01 giver 68 år', () => {
      expect(fp(toISODateString('1963-01-01'), o)).toEqual({ alderMaaneder: 816, alderLabel: '68 år' });
    });

    it('1966-12-31 giver 68 år', () => {
      expect(fp(toISODateString('1966-12-31'), o)).toEqual({ alderMaaneder: 816, alderLabel: '68 år' });
    });

    it('1967-01-01 giver 69 år', () => {
      expect(fp(toISODateString('1967-01-01'), o)).toEqual({ alderMaaneder: 828, alderLabel: '69 år' });
    });
  });
});
