import {
  detectDecimalPlaces,
  formatOverenskomstAmount,
  formatOverenskomstPercent,
  formatPercentFixed2,
  getDayAfterIso,
  hasAnyPctSourceOrInput,
  hasExactDisplayedAmountMatch,
  hasPctSourceOrInput,
  normalizeOptionalFreeText,
  parseDanishToIso,
  parseOptionalIsoDate,
  resolveAnvendtReguleringsdato,
  resolvePctDecimalFromSatsOrInput,
  resolvePctPointFromSatsOrInput,
  resolveStatistikModelId,
} from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { formatISOToDanish as formatDateShort, formatIsoDateLong as formatDateLong } from '../../../utils/dateFormatting';
import { STORE_BEDEDAG_START, STORE_BEDEDAG_PCT } from '../../../data/indskudteLoentillaeg';
import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => value as ISODateString;

describe('eoSharedUtils', () => {
  describe('normalizeOptionalFreeText', () => {
    it('trimmer udfyldt tekst', () => {
      expect(normalizeOptionalFreeText('  Test  ')).toBe('Test');
    });

    it('returnerer undefined for tom eller whitespace-only tekst', () => {
      expect(normalizeOptionalFreeText('   ')).toBeUndefined();
      expect(normalizeOptionalFreeText(undefined)).toBeUndefined();
    });
  });

  describe('hasExactDisplayedAmountMatch', () => {
    it('matcher værdier når den danske beløbsvisning er identisk', () => {
      expect(hasExactDisplayedAmountMatch(1000, 1000)).toBe(true);
      expect(hasExactDisplayedAmountMatch(1000.004, 1000)).toBe(true);
    });

    it('afviser værdier når den danske beløbsvisning afviger', () => {
      expect(hasExactDisplayedAmountMatch(1000.01, 1000.02)).toBe(false);
    });
  });

  describe('formatOverenskomstPercent', () => {
    it('returnerer bindestreg for tom værdi', () => {
      expect(formatOverenskomstPercent(null)).toBe('-');
      expect(formatOverenskomstPercent(undefined)).toBe('-');
    });

    it('formatterer decimalværdi som procent med to decimaler', () => {
      expect(formatOverenskomstPercent(0.1234)).toBe('12,34 %');
      expect(formatOverenskomstPercent(0)).toBe('0,00 %');
    });
  });

  describe('formatOverenskomstAmount', () => {
    it('returnerer bindestreg for tom værdi', () => {
      expect(formatOverenskomstAmount(null)).toBe('-');
      expect(formatOverenskomstAmount(undefined)).toBe('-');
    });

    it('formatterer beløb i dansk format', () => {
      expect(formatOverenskomstAmount(1234.5)).toBe('1.234,50');
    });
  });

  describe('parseOptionalIsoDate', () => {
    it('parser gyldige ISO-datoer', () => {
      expect(parseOptionalIsoDate(toISODateString('2024-01-15'))).toBe(toISODateString('2024-01-15'));
      expect(parseOptionalIsoDate(toISODateString('2000-12-31'))).toBe(toISODateString('2000-12-31'));
    });

    it('returnerer undefined for ugyldigt format', () => {
      expect(parseOptionalIsoDate('15-01-2024')).toBeUndefined();
      expect(parseOptionalIsoDate('2024/01/15')).toBeUndefined();
      expect(parseOptionalIsoDate('abc')).toBeUndefined();
      expect(parseOptionalIsoDate('')).toBeUndefined();
    });

    it('returnerer undefined for ikke-streng input', () => {
      expect(parseOptionalIsoDate(undefined)).toBeUndefined();
      expect(parseOptionalIsoDate(null)).toBeUndefined();
      expect(parseOptionalIsoDate(42)).toBeUndefined();
    });

    it('returnerer undefined for ugyldig dato (f.eks. 31. februar)', () => {
      expect(parseOptionalIsoDate('2024-02-30')).toBeUndefined();
      expect(parseOptionalIsoDate('2024-13-01')).toBeUndefined();
      expect(parseOptionalIsoDate('2024-00-15')).toBeUndefined();
    });

    it('trimmer whitespace', () => {
      expect(parseOptionalIsoDate('  2024-01-15  ')).toBe(toISODateString('2024-01-15'));
    });
  });

  describe('parseDanishToIso', () => {
    it('konverterer dansk dato til ISO', () => {
      expect(parseDanishToIso('15-01-2024')).toBe(toISODateString('2024-01-15'));
      expect(parseDanishToIso('31-12-2023')).toBe(toISODateString('2023-12-31'));
    });

    it('accepterer allerede-kanonisk ISO-format', () => {
      expect(parseDanishToIso(toISODateString('2024-01-15'))).toBe(toISODateString('2024-01-15'));
    });

    it('returnerer undefined for ugyldige datoer', () => {
      expect(parseDanishToIso('abc')).toBeUndefined();
      expect(parseDanishToIso('')).toBeUndefined();
      expect(parseDanishToIso(undefined)).toBeUndefined();
    });

    it('returnerer undefined for ugyldig dato', () => {
      expect(parseDanishToIso('30-02-2024')).toBeUndefined();
    });
  });

  describe('getDayAfterIso', () => {
    it('lægger én dag til en almindelig dato', () => {
      expect(getDayAfterIso(iso('2024-01-15'))).toBe(toISODateString('2024-01-16'));
    });

    it('håndterer årsskifte', () => {
      expect(getDayAfterIso(iso('2024-12-31'))).toBe(toISODateString('2025-01-01'));
    });

    it('håndterer skudår korrekt', () => {
      expect(getDayAfterIso(iso('2024-02-28'))).toBe(toISODateString('2024-02-29'));
      expect(getDayAfterIso(iso('2024-02-29'))).toBe(toISODateString('2024-03-01'));
    });
  });

  describe('resolveAnvendtReguleringsdato', () => {
    it('bruger skadedato når beregningsperiodens slutdato endnu mangler', () => {
      expect(resolveAnvendtReguleringsdato({
        beregnesUdFra: 'Beregningsperiode',
        angivetLoenMetodeOpreguleresFraDato: undefined,
        saerligFraDatoRegulering: undefined,
        beregningsperiodeTil: undefined,
        skadedato: iso('2024-03-14'),
      })).toBe(iso('2024-03-14'));
    });

    it('returnerer saerligFraDatoRegulering ved Beregningsperiode', () => {
      const result = resolveAnvendtReguleringsdato({
        beregnesUdFra: 'Beregningsperiode',
        angivetLoenMetodeOpreguleresFraDato: iso('2024-06-01'),
        saerligFraDatoRegulering: iso('2024-03-01'),
        beregningsperiodeTil: iso('2024-12-31'),
        skadedato: iso('2024-01-01'),
      });
      expect(result).toBe(toISODateString('2024-03-01'));
    });

    it('falder tilbage til beregningsperiodens slutdato ved Beregningsperiode uden saerligFraDato', () => {
      const result = resolveAnvendtReguleringsdato({
        beregnesUdFra: 'Beregningsperiode',
        angivetLoenMetodeOpreguleresFraDato: iso('2024-06-01'),
        saerligFraDatoRegulering: undefined,
        beregningsperiodeTil: iso('2024-12-31'),
        skadedato: iso('2024-01-01'),
      });
      expect(result).toBe(toISODateString('2024-12-31'));
    });

    it('returnerer angivetLoenMetodeOpreguleresFraDato ved andre metoder', () => {
      const result = resolveAnvendtReguleringsdato({
        beregnesUdFra: 'Angivet månedsløn',
        angivetLoenMetodeOpreguleresFraDato: iso('2024-06-01'),
        saerligFraDatoRegulering: iso('2024-03-01'),
        beregningsperiodeTil: iso('2024-12-31'),
        skadedato: iso('2024-01-01'),
      });
      expect(result).toBe(toISODateString('2024-06-01'));
    });

    it('falder tilbage til skadedato ved andre metoder uden angivetLoenDato', () => {
      const result = resolveAnvendtReguleringsdato({
        beregnesUdFra: 'Angivet månedsløn',
        angivetLoenMetodeOpreguleresFraDato: undefined,
        saerligFraDatoRegulering: iso('2024-03-01'),
        beregningsperiodeTil: iso('2024-12-31'),
        skadedato: iso('2024-01-01'),
      });
      expect(result).toBe(toISODateString('2024-01-01'));
    });

    it('returnerer undefined når intet er givet', () => {
      const result = resolveAnvendtReguleringsdato({
        beregnesUdFra: undefined,
        angivetLoenMetodeOpreguleresFraDato: undefined,
        saerligFraDatoRegulering: undefined,
        beregningsperiodeTil: undefined,
        skadedato: undefined,
      });
      expect(result).toBeUndefined();
    });

    it('ignorerer ugyldige datoer', () => {
      const result = resolveAnvendtReguleringsdato({
        beregnesUdFra: 'Angivet månedsløn',
        angivetLoenMetodeOpreguleresFraDato: undefined,
        saerligFraDatoRegulering: undefined,
        beregningsperiodeTil: undefined,
        skadedato: iso('2024-01-01'),
      });
      expect(result).toBe(toISODateString('2024-01-01'));
    });
  });

  describe('resolveStatistikModelId', () => {
    it('resolver ILON12', () => {
      expect(resolveStatistikModelId('ILON12 - Samlet lønindeks')).toBe('ILON12');
    });

    it('resolver SBLON2', () => {
      expect(resolveStatistikModelId('SBLON2 - Lønindeks privat')).toBe('SBLON2');
    });

    it('returnerer undefined for ukendt model', () => {
      expect(resolveStatistikModelId('UNKNOWN')).toBeUndefined();
      expect(resolveStatistikModelId(undefined)).toBeUndefined();
      expect(resolveStatistikModelId('')).toBeUndefined();
    });
  });

  describe('formatDateShort', () => {
    it('formaterer ISO til dansk kort format', () => {
      expect(formatDateShort(toISODateString('2024-01-15'))).toBe('15-01-2024');
    });

    it('returnerer tom streng for undefined', () => {
      expect(formatDateShort(undefined)).toBe('');
    });
  });

  describe('formatDateLong', () => {
    it('formaterer ISO til langt dansk format', () => {
      expect(formatDateLong(toISODateString('2024-01-15'))).toBe('15. januar 2024');
    });

    it('returnerer tom streng for undefined', () => {
      expect(formatDateLong(undefined)).toBe('');
    });
  });

  describe('formatPercentFixed2', () => {
    it('formaterer med 2 decimaler', () => {
      const result = formatPercentFixed2(12.5);
      expect(result).toContain('12,50');
      expect(result).toContain('%');
    });

    it('returnerer - for NaN', () => {
      expect(formatPercentFixed2(NaN)).toBe('-');
    });

    it('returnerer - for Infinity', () => {
      expect(formatPercentFixed2(Infinity)).toBe('-');
    });
  });

  describe('detectDecimalPlaces', () => {
    it('finder decimaler op til maxPlaces', () => {
      expect(detectDecimalPlaces([1, 1.2, 1.23, 1.2345], 4)).toBe(4);
    });
  });

  describe('resolvePctPointFromSatsOrInput', () => {
    it('bruger overenskomstsats når den findes', () => {
      expect(resolvePctPointFromSatsOrInput(0.153, 9.9)).toBe(15.3);
    });

    it('bevarer overenskomstsats 0 frem for fallback til input', () => {
      expect(resolvePctPointFromSatsOrInput(0, 15.3)).toBe(0);
    });

    it('falder tilbage til input pct når overenskomstsats mangler', () => {
      expect(resolvePctPointFromSatsOrInput(null, 15.3)).toBe(15.3);
    });

    it('returnerer 0 når begge kilder mangler', () => {
      expect(resolvePctPointFromSatsOrInput(undefined, undefined)).toBe(0);
    });
  });

  describe('resolvePctDecimalFromSatsOrInput', () => {
    it('returnerer decimal fra overenskomstsats', () => {
      expect(resolvePctDecimalFromSatsOrInput(0.153, 9.9)).toBeCloseTo(0.153, 6);
    });

    it('bevarer overenskomstsats 0 frem for fallback til input', () => {
      expect(resolvePctDecimalFromSatsOrInput(0, 15.3)).toBe(0);
    });

    it('falder tilbage til input pct konverteret til decimal', () => {
      expect(resolvePctDecimalFromSatsOrInput(undefined, 15.3)).toBeCloseTo(0.153, 6);
    });
  });

  describe('hasPctSourceOrInput', () => {
    it('er true når overenskomstsats er større end 0', () => {
      expect(hasPctSourceOrInput(0.01, undefined)).toBe(true);
      expect(hasPctSourceOrInput(0.129, undefined)).toBe(true);
    });

    it('er false når overenskomstsats er 0 – 0 fra overenskomst er "ingen sats" ligesom undefined', () => {
      expect(hasPctSourceOrInput(0, undefined)).toBe(false);
    });

    it('er true når input pct er ikke-nul og sats mangler', () => {
      expect(hasPctSourceOrInput(null, 15.3)).toBe(true);
    });

    it('er false når sats mangler og input pct er 0/undefined', () => {
      expect(hasPctSourceOrInput(undefined, 0)).toBe(false);
      expect(hasPctSourceOrInput(undefined, undefined)).toBe(false);
    });

    it('er false når sats er null og input er 0', () => {
      expect(hasPctSourceOrInput(null, 0)).toBe(false);
    });
  });

  describe('hasAnyPctSourceOrInput', () => {
    it('er true når mindst én sats har kilde', () => {
      const satser = [{ shSoSats: null }, { shSoSats: 0.01 }];
      expect(hasAnyPctSourceOrInput(satser, (s) => s.shSoSats, undefined)).toBe(true);
    });

    it('er true ved tom liste når input er ikke-nul', () => {
      expect(hasAnyPctSourceOrInput([], () => null, 15.3)).toBe(true);
    });

    it('er false ved tom liste når input er 0/undefined', () => {
      expect(hasAnyPctSourceOrInput([], () => null, 0)).toBe(false);
      expect(hasAnyPctSourceOrInput([], () => null, undefined)).toBe(false);
    });
  });

  describe('konstanter', () => {
    it('STORE_BEDEDAG_START er 2024-01-01', () => {
      expect(STORE_BEDEDAG_START).toBe(toISODateString('2024-01-01'));
    });

    it('STORE_BEDEDAG_PCT er 0.45', () => {
      expect(STORE_BEDEDAG_PCT).toBe(0.45);
    });
  });
});
