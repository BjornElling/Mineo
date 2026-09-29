import {
  resolveForloebForAnsaettelse,
} from '../../../domain/erstatningsopgoerelse/engines/reguleringForloeb';
import type { ReguleringForloeb } from '../../../domain/erstatningsopgoerelse/engines/reguleringForloeb';

const localForloeb: ReguleringForloeb = { kind: 'krl', entries: [] };
const globaltForloeb: ReguleringForloeb = { kind: 'statistik', entries: [], displayDecimals: 1 };

describe('resolveForloebForAnsaettelse', () => {
  it('vælger det matchende per-ansættelsesforløb', () => {
    expect(resolveForloebForAnsaettelse([
      { ansaettelsesforholdId: 'af-1', forloeb: localForloeb },
    ], globaltForloeb, 'af-1')).toBe(localForloeb);
  });

  it('returnerer undefined når matchende ansættelse ikke har et forløb', () => {
    expect(resolveForloebForAnsaettelse([
      { ansaettelsesforholdId: 'af-1' },
    ], globaltForloeb, 'af-1')).toBeUndefined();
  });

  it('bruger det globale forløb for en tom per-ansættelsesliste', () => {
    expect(resolveForloebForAnsaettelse([], globaltForloeb, 'af-1')).toBe(globaltForloeb);
    expect(resolveForloebForAnsaettelse([], undefined, 'af-1')).toBeUndefined();
  });

  it('arver ikke det globale forløb ved en ikke-matchende ansættelse', () => {
    expect(resolveForloebForAnsaettelse([
      { ansaettelsesforholdId: 'af-1', forloeb: localForloeb },
    ], globaltForloeb, 'af-2')).toBeUndefined();
  });
});
