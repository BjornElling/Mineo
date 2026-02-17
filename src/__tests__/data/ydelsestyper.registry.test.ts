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
});
