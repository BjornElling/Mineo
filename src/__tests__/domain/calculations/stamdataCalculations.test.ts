import {
  resolveStamdataDatoLabel,
  hasStamdataAny,
} from '../../../domain/policies/stamdataCalculations';
import type { StamdataValues } from '../../../domain/policies/stamdataCalculations';
import type { ISODateString } from '../../../types/branded';

// ─── Helpers ──────────────────────────────────────────────────────────────

const iso = (s: string): ISODateString => s as ISODateString;

const stamdata = (patch: Partial<StamdataValues> = {}): StamdataValues => ({
  journalnr: undefined,
  advokat: undefined,
  sagsbehandler: undefined,
  skadelidte: undefined,
  skadelidteFodselsdato: undefined,
  skadestype: undefined,
  skadedato: undefined,
  ...patch,
} as StamdataValues);

// ─── resolveStamdataDatoLabel ──────────────────────────────────────────────

describe('resolveStamdataDatoLabel', () => {
  it('null stamdata → Skadedato (default)', () => {
    expect(resolveStamdataDatoLabel(null)).toBe('Skadedato');
  });

  it('undefined skadestype → Skadedato', () => {
    expect(resolveStamdataDatoLabel(stamdata({ skadestype: undefined }))).toBe('Skadedato');
  });

  it('Arbejdsulykke → Skadedato', () => {
    expect(resolveStamdataDatoLabel(stamdata({ skadestype: 'Arbejdsulykke' }))).toBe('Skadedato');
  });

  it('Erhvervssygdom → Anmeldelsesdato', () => {
    expect(resolveStamdataDatoLabel(stamdata({ skadestype: 'Erhvervssygdom' }))).toBe('Anmeldelsesdato');
  });
});

// ─── hasStamdataAny ───────────────────────────────────────────────────────

describe('hasStamdataAny', () => {
  it('null stamdata → false', () => {
    expect(hasStamdataAny(null)).toBe(false);
  });

  it('alle felter undefined → false', () => {
    expect(hasStamdataAny(stamdata())).toBe(false);
  });

  it('journalnr = tom streng → false', () => {
    expect(hasStamdataAny(stamdata({ journalnr: '' }))).toBe(false);
  });

  it('journalnr = whitespace-only → false', () => {
    expect(hasStamdataAny(stamdata({ journalnr: '   ' }))).toBe(false);
  });

  it('journalnr med indhold → true', () => {
    expect(hasStamdataAny(stamdata({ journalnr: 'J-2024-001' }))).toBe(true);
  });

  it('advokat med indhold → true', () => {
    expect(hasStamdataAny(stamdata({ advokat: 'Adv. Jensen' }))).toBe(true);
  });

  it('sagsbehandler med indhold → true', () => {
    expect(hasStamdataAny(stamdata({ sagsbehandler: 'Ole' }))).toBe(true);
  });

  it('skadelidte med indhold → true', () => {
    expect(hasStamdataAny(stamdata({ skadelidte: 'Jens Hansen' }))).toBe(true);
  });

  it('skadestype sat → true', () => {
    expect(hasStamdataAny(stamdata({ skadestype: 'Arbejdsulykke' }))).toBe(true);
  });

  it('skadedato sat → true', () => {
    expect(hasStamdataAny(stamdata({ skadedato: iso('2024-01-01') }))).toBe(true);
  });

  it('kun skadelidteFodselsdato sat → true', () => {
    expect(hasStamdataAny(stamdata({ skadelidteFodselsdato: iso('1980-05-12') }))).toBe(true);
  });

  it('kun whitespace journalnr + whitespace advokat → false', () => {
    expect(hasStamdataAny(stamdata({ journalnr: '  ', advokat: '  ' }))).toBe(false);
  });
});
