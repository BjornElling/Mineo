import { describe, expect, it } from 'vitest';
import {
  resolveStamdataDatoLabel,
  hasStamdataAny,
} from '../../../domain/calculations/stamdataCalculations';
import type { StamdataValues } from '../../../domain/calculations/stamdataCalculations';
import type { ISODateString } from '../../../types/branded';

// ─── Helpers ──────────────────────────────────────────────────────────────

const iso = (s: string): ISODateString => s as ISODateString;

const stamdata = (patch: Partial<StamdataValues> = {}): StamdataValues => ({
  journalnr: undefined,
  advokat: undefined,
  sagsbehandler: undefined,
  skadelidte: undefined,
  skadestype: undefined,
  skadesdato: undefined,
  ...patch,
} as StamdataValues);

// ─── resolveStamdataDatoLabel ──────────────────────────────────────────────

describe('resolveStamdataDatoLabel', () => {
  it('null stamdata → Skadesdato (default)', () => {
    expect(resolveStamdataDatoLabel(null)).toBe('Skadesdato');
  });

  it('undefined skadestype → Skadesdato', () => {
    expect(resolveStamdataDatoLabel(stamdata({ skadestype: undefined }))).toBe('Skadesdato');
  });

  it('Arbejdsulykke → Skadesdato', () => {
    expect(resolveStamdataDatoLabel(stamdata({ skadestype: 'Arbejdsulykke' }))).toBe('Skadesdato');
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

  it('skadesdato sat → true', () => {
    expect(hasStamdataAny(stamdata({ skadesdato: iso('2024-01-01') }))).toBe(true);
  });

  it('kun whitespace journalnr + whitespace advokat → false', () => {
    expect(hasStamdataAny(stamdata({ journalnr: '  ', advokat: '  ' }))).toBe(false);
  });
});
