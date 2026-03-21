import {
  getDayAfterIso,
  hasAnyPctSourceOrInput,
  parseOptionalIsoDate,
  parseDanishToIso,
  resolveReguleringsdato,
  resolveStatistikModelId,
  detectDecimalPlaces,
  hasPctSourceOrInput,
  formatDateShort,
  formatDateLong,
  formatPercentFixed2,
  resolvePctDecimalFromSatsOrInput,
  resolvePctPointFromSatsOrInput,
} from '../../../domain/erstatningsopgoerelse/sharedPdfUtils';
import { STORE_BEDEDAG_START } from '../../../config/dateRanges';
import { STORE_BEDEDAG_PCT } from '../../../config/regulatoryRates';
import type { ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => value as ISODateString;

// =============================================================================
// parseOptionalIsoDate
// =============================================================================

describe('parseOptionalIsoDate', () => {
  it('parser gyldige ISO-datoer', () => {
    expect(parseOptionalIsoDate('2024-01-15')).toBe('2024-01-15');
    expect(parseOptionalIsoDate('2000-12-31')).toBe('2000-12-31');
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
    expect(parseOptionalIsoDate('  2024-01-15  ')).toBe('2024-01-15');
  });
});

// =============================================================================
// parseDanishToIso
// =============================================================================

describe('parseDanishToIso', () => {
  it('konverterer dansk dato til ISO', () => {
    expect(parseDanishToIso('15-01-2024')).toBe('2024-01-15');
    expect(parseDanishToIso('31-12-2023')).toBe('2023-12-31');
  });

  it('returnerer undefined for ugyldigt format', () => {
    expect(parseDanishToIso('2024-01-15')).toBeUndefined();
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
    expect(getDayAfterIso(iso('2024-01-15'))).toBe('2024-01-16');
  });

  it('håndterer årsskifte', () => {
    expect(getDayAfterIso(iso('2024-12-31'))).toBe('2025-01-01');
  });

  it('håndterer skudår korrekt', () => {
    expect(getDayAfterIso(iso('2024-02-28'))).toBe('2024-02-29');
    expect(getDayAfterIso(iso('2024-02-29'))).toBe('2024-03-01');
  });
});

// =============================================================================
// resolveReguleringsdato
// =============================================================================

describe('resolveReguleringsdato', () => {
  it('returnerer saerligFraDatoRegulering ved Beregningsperiode', () => {
    const result = resolveReguleringsdato({
      beregnesUdFra: 'Beregningsperiode',
      angivetLoenMetodeOpreguleresFraDato: iso('2024-06-01'),
      saerligFraDatoRegulering: iso('2024-03-01'),
      skadesdato: iso('2024-01-01'),
    });
    expect(result).toBe('2024-03-01');
  });

  it('falder tilbage til skadesdato ved Beregningsperiode uden saerligFraDato', () => {
    const result = resolveReguleringsdato({
      beregnesUdFra: 'Beregningsperiode',
      angivetLoenMetodeOpreguleresFraDato: iso('2024-06-01'),
      saerligFraDatoRegulering: undefined,
      skadesdato: iso('2024-01-01'),
    });
    expect(result).toBe('2024-01-01');
  });

  it('returnerer angivetLoenMetodeOpreguleresFraDato ved andre metoder', () => {
    const result = resolveReguleringsdato({
      beregnesUdFra: 'Angivet månedsløn',
      angivetLoenMetodeOpreguleresFraDato: iso('2024-06-01'),
      saerligFraDatoRegulering: iso('2024-03-01'),
      skadesdato: iso('2024-01-01'),
    });
    expect(result).toBe('2024-06-01');
  });

  it('falder tilbage til skadesdato ved andre metoder uden angivetLoenDato', () => {
    const result = resolveReguleringsdato({
      beregnesUdFra: 'Angivet månedsløn',
      angivetLoenMetodeOpreguleresFraDato: undefined,
      saerligFraDatoRegulering: iso('2024-03-01'),
      skadesdato: iso('2024-01-01'),
    });
    expect(result).toBe('2024-01-01');
  });

  it('returnerer undefined når intet er givet', () => {
    const result = resolveReguleringsdato({
      beregnesUdFra: undefined,
      angivetLoenMetodeOpreguleresFraDato: undefined,
      saerligFraDatoRegulering: undefined,
      skadesdato: undefined,
    });
    expect(result).toBeUndefined();
  });

  it('ignorerer ugyldige datoer', () => {
    const result = resolveReguleringsdato({
      beregnesUdFra: 'Angivet månedsløn',
      angivetLoenMetodeOpreguleresFraDato: undefined,
      saerligFraDatoRegulering: undefined,
      skadesdato: iso('2024-01-01'),
    });
    expect(result).toBe('2024-01-01');
  });
});

// =============================================================================
// resolveStatistikModelId
// =============================================================================

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

// =============================================================================
// formatDateShort / formatDateLong
// =============================================================================

describe('formatDateShort', () => {
  it('formaterer ISO til dansk kort format', () => {
    expect(formatDateShort('2024-01-15' as any)).toBe('15-01-2024');
  });

  it('returnerer tom streng for undefined', () => {
    expect(formatDateShort(undefined)).toBe('');
  });
});

describe('formatDateLong', () => {
  it('formaterer ISO til langt dansk format', () => {
    expect(formatDateLong('2024-01-15' as any)).toBe('15. januar 2024');
  });

  it('returnerer tom streng for undefined', () => {
    expect(formatDateLong(undefined)).toBe('');
  });
});

// =============================================================================
// formatPercentFixed2
// =============================================================================

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
  it('er true når overenskomstsats findes (også 0)', () => {
    expect(hasPctSourceOrInput(0, undefined)).toBe(true);
  });

  it('er true når input pct er ikke-nul og sats mangler', () => {
    expect(hasPctSourceOrInput(null, 15.3)).toBe(true);
  });

  it('er false når sats mangler og input pct er 0/undefined', () => {
    expect(hasPctSourceOrInput(undefined, 0)).toBe(false);
    expect(hasPctSourceOrInput(undefined, undefined)).toBe(false);
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

// =============================================================================
// KONSTANTER
// =============================================================================

describe('konstanter', () => {
  it('STORE_BEDEDAG_START er 2024-01-01', () => {
    expect(STORE_BEDEDAG_START).toBe('2024-01-01');
  });

  it('STORE_BEDEDAG_PCT er 0.45', () => {
    expect(STORE_BEDEDAG_PCT).toBe(0.45);
  });
});
