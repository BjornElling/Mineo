import { describe, expect, it } from 'vitest';
import { ydelsestyper, ydelsestypeKeys } from '../../data/ydelsestyper';

describe('ydelsestyper registry', () => {
  it('har periodisering og periodiseringslabel for alle ydelsestyper', () => {
    for (const key of ydelsestypeKeys) {
      const config = ydelsestyper[key];
      expect(config).toBeDefined();
      expect(config.periodisering === 'kalenderdage' || config.periodisering === 'arbejdsdage').toBe(true);
      expect(config.periodiseringLabel.trim().length).toBeGreaterThan(0);
    }
  });

  it('har Efterløn med kalenderdage-periodisering', () => {
    const config = ydelsestyper.efterloen;
    expect(config).toBeDefined();
    expect(config.label).toBe('Efterløn');
    expect(config.periodisering).toBe('kalenderdage');
    expect(config.periodiseringLabel).toBe('Kalenderdage');
  });

  it('placerer Uddannelseshjælp efter SU og før Andet', () => {
    const suIndex = ydelsestypeKeys.indexOf('su');
    const uddannelseshjaelpIndex = ydelsestypeKeys.indexOf('uddannelseshjaelp');
    const andetIndex = ydelsestypeKeys.indexOf('andet');

    expect(suIndex).toBeGreaterThanOrEqual(0);
    expect(uddannelseshjaelpIndex).toBeGreaterThanOrEqual(0);
    expect(andetIndex).toBeGreaterThanOrEqual(0);
    expect(uddannelseshjaelpIndex).toBe(suIndex + 1);
    expect(andetIndex).toBe(uddannelseshjaelpIndex + 1);
  });

  it('alle 13 forventede ydelsestyper er registreret', () => {
    const expected = [
      'dagpenge', 'efterloen', 'flextilskud', 'kontanthjaelp', 'ledighedsydelse',
      'midlertidigt_eet', 'pension', 'ressourceforloebsydelse', 'revalideringsydelse',
      'sygedagpenge', 'su', 'uddannelseshjaelp', 'andet',
    ];
    expect(ydelsestypeKeys).toHaveLength(expected.length);
    for (const key of expected) {
      expect(ydelsestypeKeys).toContain(key);
    }
  });

  it('alle labels er unikke', () => {
    const labels = ydelsestypeKeys.map((k) => ydelsestyper[k].label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it('kun sygedagpenge bruger arbejdsdage-periodisering', () => {
    const arbejdsdageKeys = ydelsestypeKeys.filter(
      (k) => ydelsestyper[k].periodisering === 'arbejdsdage'
    );
    expect(arbejdsdageKeys).toEqual(['sygedagpenge']);
  });

  it('debugLabel er kun sat for ydelsestyper med lange labels (ledighedsydelse, revalideringsydelse, uddannelseshjaelp)', () => {
    expect(ydelsestyper.ledighedsydelse.debugLabel).toBeDefined();
    expect(ydelsestyper.revalideringsydelse.debugLabel).toBeDefined();
    expect(ydelsestyper.uddannelseshjaelp.debugLabel).toBeDefined();
    // Andre har ingen debugLabel
    expect(ydelsestyper.dagpenge.debugLabel).toBeUndefined();
    expect(ydelsestyper.efterloen.debugLabel).toBeUndefined();
    expect(ydelsestyper.sygedagpenge.debugLabel).toBeUndefined();
  });
});
