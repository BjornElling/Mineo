import {
  parseOptionalIsoDate,
  parseDanishToIso,
  resolveReguleringsdato,
  resolveStatistikModelId,
  formatDateShort,
  formatDateLong,
  formatPercentFixed2,
  STORE_BEDEDAG_START,
  STORE_BEDEDAG_PCT,
} from '../../../domain/erstatningsopgoerelse/sharedPdfUtils';

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

// =============================================================================
// resolveReguleringsdato
// =============================================================================

describe('resolveReguleringsdato', () => {
  it('returnerer saerligFraDatoRegulering ved Beregningsperiode', () => {
    const result = resolveReguleringsdato({
      beregnesUdFra: 'Beregningsperiode',
      angivetLoenOpreguleresFraDato: '2024-06-01',
      saerligFraDatoRegulering: '2024-03-01',
      skadesdato: '2024-01-01',
    });
    expect(result).toBe('2024-03-01');
  });

  it('falder tilbage til skadesdato ved Beregningsperiode uden saerligFraDato', () => {
    const result = resolveReguleringsdato({
      beregnesUdFra: 'Beregningsperiode',
      angivetLoenOpreguleresFraDato: '2024-06-01',
      saerligFraDatoRegulering: undefined,
      skadesdato: '2024-01-01',
    });
    expect(result).toBe('2024-01-01');
  });

  it('returnerer angivetLoenOpreguleresFraDato ved andre metoder', () => {
    const result = resolveReguleringsdato({
      beregnesUdFra: 'Angivet månedsløn',
      angivetLoenOpreguleresFraDato: '2024-06-01',
      saerligFraDatoRegulering: '2024-03-01',
      skadesdato: '2024-01-01',
    });
    expect(result).toBe('2024-06-01');
  });

  it('falder tilbage til skadesdato ved andre metoder uden angivetLoenDato', () => {
    const result = resolveReguleringsdato({
      beregnesUdFra: 'Angivet månedsløn',
      angivetLoenOpreguleresFraDato: undefined,
      saerligFraDatoRegulering: '2024-03-01',
      skadesdato: '2024-01-01',
    });
    expect(result).toBe('2024-01-01');
  });

  it('returnerer undefined når intet er givet', () => {
    const result = resolveReguleringsdato({
      beregnesUdFra: undefined,
      angivetLoenOpreguleresFraDato: undefined,
      saerligFraDatoRegulering: undefined,
      skadesdato: undefined,
    });
    expect(result).toBeUndefined();
  });

  it('ignorerer ugyldige datoer', () => {
    const result = resolveReguleringsdato({
      beregnesUdFra: 'Angivet månedsløn',
      angivetLoenOpreguleresFraDato: 'not-a-date',
      saerligFraDatoRegulering: undefined,
      skadesdato: '2024-01-01',
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
