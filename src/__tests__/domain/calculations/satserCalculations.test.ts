import {
  resolveSatserEffectiveAargang,
  resolveSatserAargangErrorMessage,
  canDownloadSatser,
  hasSatserAny,
} from '../../../domain/policies/satserCalculations';
import type { SatserValues } from '../../../domain/policies/satserCalculations';
import { satserAngivAarYearBounds } from '../../../data/lovbestemteRates';

// ─── Helpers ──────────────────────────────────────────────────────────────

const MIN = satserAngivAarYearBounds.minYear;
const MAX = satserAngivAarYearBounds.maxYear;

const satser = (aargang: number | undefined): SatserValues => ({ aargang } as SatserValues);

// ─── resolveSatserEffectiveAargang ─────────────────────────────────────────

describe('resolveSatserEffectiveAargang', () => {
  it('null satser → undefined', () => {
    expect(resolveSatserEffectiveAargang(null, MIN, MAX)).toBeUndefined();
  });

  it('undefined aargang → undefined', () => {
    expect(resolveSatserEffectiveAargang(satser(undefined), MIN, MAX)).toBeUndefined();
  });

  it('gyldig aargang indenfor range → returnerer årgangen', () => {
    expect(resolveSatserEffectiveAargang(satser(2024), MIN, MAX)).toBe(2024);
  });

  it('aargang = minYear → returnerer årgangen (grænseværdi)', () => {
    expect(resolveSatserEffectiveAargang(satser(MIN), MIN, MAX)).toBe(MIN);
  });

  it('aargang = maxYear → returnerer årgangen (grænseværdi)', () => {
    expect(resolveSatserEffectiveAargang(satser(MAX), MIN, MAX)).toBe(MAX);
  });

  it('aargang < minYear → undefined', () => {
    expect(resolveSatserEffectiveAargang(satser(MIN - 1), MIN, MAX)).toBeUndefined();
  });

  it('aargang > maxYear → undefined', () => {
    expect(resolveSatserEffectiveAargang(satser(MAX + 1), MIN, MAX)).toBeUndefined();
  });
});

// ─── resolveSatserAargangErrorMessage ─────────────────────────────────────

describe('resolveSatserAargangErrorMessage', () => {
  it('null satser → fejlbesked', () => {
    const msg = resolveSatserAargangErrorMessage(null, MIN, MAX);
    expect(msg).toBeDefined();
    expect(msg).toContain(String(MIN));
    expect(msg).toContain(String(MAX));
  });

  it('undefined aargang → fejlbesked', () => {
    const msg = resolveSatserAargangErrorMessage(satser(undefined), MIN, MAX);
    expect(msg).toBeDefined();
  });

  it('gyldig aargang → undefined (ingen fejl)', () => {
    expect(resolveSatserAargangErrorMessage(satser(2024), MIN, MAX)).toBeUndefined();
  });

  it('aargang = minYear → undefined', () => {
    expect(resolveSatserAargangErrorMessage(satser(MIN), MIN, MAX)).toBeUndefined();
  });

  it('aargang = maxYear → undefined', () => {
    expect(resolveSatserAargangErrorMessage(satser(MAX), MIN, MAX)).toBeUndefined();
  });

  it('aargang < minYear → fejlbesked med range', () => {
    const msg = resolveSatserAargangErrorMessage(satser(MIN - 1), MIN, MAX);
    expect(msg).toBeDefined();
    expect(msg).toContain(String(MIN));
    expect(msg).toContain(String(MAX));
  });

  it('aargang > maxYear → fejlbesked', () => {
    const msg = resolveSatserAargangErrorMessage(satser(MAX + 1), MIN, MAX);
    expect(msg).toBeDefined();
  });

  it('fejlbesked for undefined og out-of-range er ens (samme besked)', () => {
    const msgUndef = resolveSatserAargangErrorMessage(satser(undefined), MIN, MAX);
    const msgOor = resolveSatserAargangErrorMessage(satser(MIN - 1), MIN, MAX);
    expect(msgUndef).toBe(msgOor);
  });
});

// ─── canDownloadSatser ────────────────────────────────────────────────────

describe('canDownloadSatser', () => {
  it('gyldig aargang → true', () => {
    expect(canDownloadSatser(satser(2024), MIN, MAX)).toBe(true);
  });

  it('ugyldig aargang (< minYear) → false', () => {
    expect(canDownloadSatser(satser(MIN - 1), MIN, MAX)).toBe(false);
  });

  it('ugyldig aargang (> maxYear) → false', () => {
    expect(canDownloadSatser(satser(MAX + 1), MIN, MAX)).toBe(false);
  });

  it('undefined aargang → false', () => {
    expect(canDownloadSatser(satser(undefined), MIN, MAX)).toBe(false);
  });

  it('null satser → false', () => {
    expect(canDownloadSatser(null, MIN, MAX)).toBe(false);
  });
});

// ─── hasSatserAny ─────────────────────────────────────────────────────────

describe('hasSatserAny', () => {
  it('null satser → false', () => {
    expect(hasSatserAny(null)).toBe(false);
  });

  it('undefined aargang → false', () => {
    expect(hasSatserAny(satser(undefined))).toBe(false);
  });

  it('aargang = 2024 → true', () => {
    expect(hasSatserAny(satser(2024))).toBe(true);
  });

  it('out-of-range aargang → true (eksistens tjekkes, ikke gyldighed)', () => {
    expect(hasSatserAny(satser(1900))).toBe(true);
  });
});
