import { toISODateString } from '../../types/branded';
import { isValidClosedDateRange, rangesOverlap } from '../../utils/closedDateRange';

// Det kanoniske LUKKEDE datointerval (GM-F15). Primitivet lå tidligere i fire udgaver — én eksporteret fra
// EO's overlapsmodul, to lokale kopier i TAF-motoren/dagsæt-modulet og én inlinet ulighed. Testene her flyttede
// med primitivet, så det ikke er EO's testfil, der er hjemsted for en generel intervalregel.

describe('isValidClosedDateRange', () => {
  it('returnerer true for gyldigt range (fra <= til)', () => {
    expect(isValidClosedDateRange({ fra: toISODateString('2024-01-01'), til: toISODateString('2024-12-31') })).toBe(true);
  });

  it('returnerer true for range på én dag (fra === til)', () => {
    expect(isValidClosedDateRange({ fra: toISODateString('2024-06-15'), til: toISODateString('2024-06-15') })).toBe(true);
  });

  it('returnerer false når fra > til (omvendt rækkefølge)', () => {
    expect(isValidClosedDateRange({ fra: toISODateString('2024-12-31'), til: toISODateString('2024-01-01') })).toBe(false);
  });

  it('returnerer false når fra er undefined', () => {
    expect(isValidClosedDateRange({ fra: undefined, til: toISODateString('2024-12-31') })).toBe(false);
  });

  it('returnerer false når til er undefined', () => {
    expect(isValidClosedDateRange({ fra: toISODateString('2024-01-01'), til: undefined })).toBe(false);
  });

  it('returnerer false når begge er undefined', () => {
    expect(isValidClosedDateRange({ fra: undefined, til: undefined })).toBe(false);
  });
});

describe('rangesOverlap', () => {
  it('returnerer true for overlappende ranges', () => {
    expect(rangesOverlap(
      { fra: toISODateString('2024-01-01'), til: toISODateString('2024-06-30') },
      { fra: toISODateString('2024-06-01'), til: toISODateString('2024-12-31') }
    )).toBe(true);
  });

  it('returnerer true for identiske ranges', () => {
    expect(rangesOverlap(
      { fra: toISODateString('2024-03-01'), til: toISODateString('2024-03-31') },
      { fra: toISODateString('2024-03-01'), til: toISODateString('2024-03-31') }
    )).toBe(true);
  });

  it('returnerer true for ranges der rører hinanden præcis på grænsen (touching = overlap)', () => {
    // a.til === b.fra: 2024-06-30 === 2024-06-30 → overlapper (inklusive grænser)
    expect(rangesOverlap(
      { fra: toISODateString('2024-01-01'), til: toISODateString('2024-06-30') },
      { fra: toISODateString('2024-06-30'), til: toISODateString('2024-12-31') }
    )).toBe(true);
  });

  it('returnerer false for adjacente ranges der ikke overlapper', () => {
    // a slutter 2024-06-29, b starter 2024-06-30 → ingen overlap
    expect(rangesOverlap(
      { fra: toISODateString('2024-01-01'), til: toISODateString('2024-06-29') },
      { fra: toISODateString('2024-06-30'), til: toISODateString('2024-12-31') }
    )).toBe(false);
  });

  it('returnerer false for separate ranges', () => {
    expect(rangesOverlap(
      { fra: toISODateString('2023-01-01'), til: toISODateString('2023-06-30') },
      { fra: toISODateString('2024-01-01'), til: toISODateString('2024-12-31') }
    )).toBe(false);
  });
});

