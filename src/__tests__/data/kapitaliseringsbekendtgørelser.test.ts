import { describe, expect, it } from 'vitest';
import {
  kapitaliseringsbekendtgoerelser,
  eetKapitaliseringsDatoMaxFraBekendtgoerelser,
} from '../../data/kapitalisering/kapitaliseringsbekendtgørelser';

describe('kapitaliseringsbekendtgørelser', () => {
  it('afleder EET max-dato som 31-12 i laveste seneste kapitaliseringsår på tværs af skadesintervaller', () => {
    const latestPerInterval = kapitaliseringsbekendtgoerelser.map((interval) => {
      const latestFraDate = interval.kapitaliseringer
        .map((entry) => entry.kapitaliseringsdatoFra)
        .reduce((latest, current) => (current > latest ? current : latest));
      return Number.parseInt(latestFraDate.slice(0, 4), 10);
    });

    const expectedYear = Math.min(...latestPerInterval);
    expect(eetKapitaliseringsDatoMaxFraBekendtgoerelser).toBe(`${expectedYear}-12-31`);
  });
});
