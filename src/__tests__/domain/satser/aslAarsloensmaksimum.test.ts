import { describe, it, expect } from 'vitest';
import {
  aarsloenAslMax,
  getYearBoundsForYearlyRate,
  type YearlyRate,
} from '../../../data/lovbestemteRates';
import {
  aslAarsloensmaksimumBoundsSuffix,
  formatAslAarsloensmaksimumMissing,
  formatAslAarsloensmaksimumMissingForYears,
  resolveAslAarsloensmaksimumForAar,
} from '../../../domain/satser/aslAarsloensmaksimum';

describe('resolveAslAarsloensmaksimumForAar (kanonisk ASL-maks-opslag)', () => {
  it('returnerer beløbet for et dækket år (identisk med rå tabelopslag)', () => {
    const bounds = getYearBoundsForYearlyRate(aarsloenAslMax);
    expect(bounds).not.toBeNull();
    const year = bounds!.maxYear;
    expect(resolveAslAarsloensmaksimumForAar(year)).toBe(aarsloenAslMax[year]);
  });

  it('returnerer undefined for et udækket år (før/efter tabellen)', () => {
    expect(resolveAslAarsloensmaksimumForAar(1900)).toBeUndefined();
    expect(resolveAslAarsloensmaksimumForAar(2099)).toBeUndefined();
  });

  it('fail-closer på ikke-heltal, ikke-finit og ikke-positiv sats', () => {
    expect(resolveAslAarsloensmaksimumForAar(2024.5)).toBeUndefined();
    expect(resolveAslAarsloensmaksimumForAar(Number.NaN)).toBeUndefined();
    const injiceret: YearlyRate = { 2024: 0, 2025: -5, 2026: 608000 };
    expect(resolveAslAarsloensmaksimumForAar(2024, injiceret)).toBeUndefined();
    expect(resolveAslAarsloensmaksimumForAar(2025, injiceret)).toBeUndefined();
    expect(resolveAslAarsloensmaksimumForAar(2026, injiceret)).toBe(608000);
  });

  it('respekterer et injiceret indeks-map (deles med opreguleringsmotoren)', () => {
    const injiceret: YearlyRate = { 2030: 700000 };
    expect(resolveAslAarsloensmaksimumForAar(2030, injiceret)).toBe(700000);
    expect(resolveAslAarsloensmaksimumForAar(2031, injiceret)).toBeUndefined();
  });
});

describe('kanonisk "mangler"-ordlyd (ensartet på tværs af faner)', () => {
  it('enkelt-år: betegnelse + årstal + dækningsgrænser', () => {
    const bounds = getYearBoundsForYearlyRate(aarsloenAslMax)!;
    const msg = formatAslAarsloensmaksimumMissing(2099);
    expect(msg).toBe(`ASL-maks-sats mangler for år 2099 (satser findes kun for ${bounds.minYear}–${bounds.maxYear}).`);
  });

  it('liste-variant: ét år uden "år"-ord, flere år komma-separeret', () => {
    const suffix = aslAarsloensmaksimumBoundsSuffix();
    expect(formatAslAarsloensmaksimumMissingForYears([2004])).toBe(`ASL-maks-sats mangler for 2004${suffix}.`);
    expect(formatAslAarsloensmaksimumMissingForYears([2004, 2005])).toBe(`ASL-maks-sats mangler for 2004, 2005${suffix}.`);
  });

  // Selv-test af værnet: bevis at den kanoniske betegnelse faktisk udskiftede de gamle,
  // afvigende ordlyde (vacuous-pass-værn). Ingen af de fem tidligere formuleringer må
  // optræde i de kanoniske beskeder.
  it('bærer den kanoniske betegnelse og ingen af de forældede', () => {
    const samples = [
      formatAslAarsloensmaksimumMissing(2099),
      formatAslAarsloensmaksimumMissingForYears([2004]),
    ];
    for (const msg of samples) {
      expect(msg).toContain('ASL-maks-sats');
      expect(msg).not.toContain('ASL-årslønsmaksimum');
      expect(msg).not.toContain('Maksimum årsløn');
      expect(msg).not.toContain('Maks-årsløn');
      expect(msg).not.toMatch(/^Årslønsmaksimum/);
    }
  });
});
