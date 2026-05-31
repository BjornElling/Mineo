import {
  nonNegativeInteger,
  dayCount,
  yearInteger,
  percentageDecimal,
  optionalIsoDateString,
  DAY_COUNT_MAX,
} from '../../schemas/formSchemas/baseSchemas';

// Fokuserede regressionstests for de numeriske og dato-combinatorer i schema-fundamentet.
// Coercion-semantikken er trust-kritisk (forkert tal = forkert beregning) og var tidligere
// kun indirekte dækket via section-schemas. Jf. docs/review/3.1-schema-fundament.md fund 3.

describe('nonNegativeInteger', () => {
  it('coercer dansk tusindtalsformat og trunkerer decimaler', () => {
    expect(nonNegativeInteger.parse('1.234')).toBe(1234);
    expect(nonNegativeInteger.parse('30,9')).toBe(30); // trunkering, ikke afrunding
    expect(nonNegativeInteger.parse(30.9)).toBe(30);
  });

  it('accepterer 0 og tomt/undefined', () => {
    expect(nonNegativeInteger.parse(0)).toBe(0);
    expect(nonNegativeInteger.parse('')).toBeUndefined();
    expect(nonNegativeInteger.parse(undefined)).toBeUndefined();
    expect(nonNegativeInteger.parse(null)).toBeUndefined();
  });

  it('afviser negative og non-finite værdier', () => {
    expect(nonNegativeInteger.safeParse(-1).success).toBe(false);
    expect(nonNegativeInteger.safeParse(Infinity).success).toBe(false);
    expect(nonNegativeInteger.safeParse(NaN).success).toBe(false);
  });
});

describe('dayCount', () => {
  it('håndhæver 0..DAY_COUNT_MAX-intervallet', () => {
    expect(dayCount.parse(0)).toBe(0);
    expect(dayCount.parse(DAY_COUNT_MAX)).toBe(DAY_COUNT_MAX);
    expect(dayCount.safeParse(DAY_COUNT_MAX + 1).success).toBe(false);
    expect(dayCount.safeParse(-1).success).toBe(false);
  });
});

describe('yearInteger', () => {
  it('håndhæver 1900..2100-intervallet og trunkerer', () => {
    expect(yearInteger.parse(2024)).toBe(2024);
    expect(yearInteger.parse('2024,5')).toBe(2024);
    expect(yearInteger.safeParse(1899).success).toBe(false);
    expect(yearInteger.safeParse(2101).success).toBe(false);
    expect(yearInteger.safeParse(999999).success).toBe(false);
  });
});

describe('percentageDecimal', () => {
  it('coercer komma som decimal og dot som tusindtal (kanonisk dansk format)', () => {
    expect(percentageDecimal.parse('1,5')).toBe(1.5);
    // Dokumenteret skarp kant: dot fortolkes som tusindtalsseparator.
    expect(percentageDecimal.parse('1.5')).toBe(15);
  });

  it('håndhæver 0..100-intervallet', () => {
    expect(percentageDecimal.parse(0)).toBe(0);
    expect(percentageDecimal.parse(100)).toBe(100);
    expect(percentageDecimal.safeParse(100.01).success).toBe(false);
    expect(percentageDecimal.safeParse(-0.01).success).toBe(false);
  });

  it('afviser ikke-numerisk og non-finite input', () => {
    expect(percentageDecimal.safeParse('abc').success).toBe(false);
    expect(percentageDecimal.safeParse(Infinity).success).toBe(false);
    expect(percentageDecimal.safeParse(NaN).success).toBe(false);
  });

  it('tomt/undefined giver undefined', () => {
    expect(percentageDecimal.parse('')).toBeUndefined();
    expect(percentageDecimal.parse(undefined)).toBeUndefined();
  });
});

describe('optionalIsoDateString', () => {
  it('validerer kalenderdage, ikke kun formatet', () => {
    expect(optionalIsoDateString.parse('2024-01-31')).toBe('2024-01-31');
    expect(optionalIsoDateString.safeParse('2024-02-30').success).toBe(false);
    expect(optionalIsoDateString.safeParse('2024-13-40').success).toBe(false);
    expect(optionalIsoDateString.safeParse('31-01-2024').success).toBe(false); // dansk format afvises
  });

  it('tom streng/null normaliseres til undefined', () => {
    expect(optionalIsoDateString.parse('')).toBeUndefined();
    expect(optionalIsoDateString.parse(null)).toBeUndefined();
    expect(optionalIsoDateString.parse(undefined)).toBeUndefined();
  });
});
