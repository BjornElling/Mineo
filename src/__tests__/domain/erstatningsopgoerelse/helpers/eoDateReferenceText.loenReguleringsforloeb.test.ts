import {
  buildLoenGrundlagSaetning,
  resolveLoenReguleringsforloeb,
} from '../../../../domain/erstatningsopgoerelse/helpers/eoDateReferenceText';
import { toISODateString } from '../../../../types/branded';

const iso = (value: string) => toISODateString(value);
const loen = 'lønnen på den manuelt angivne reguleringsdato (01-10-2024)';

// BB-314: sætningen om lønnen følger den faktisk anvendte regulering.
describe('resolveLoenReguleringsforloeb', () => {
  it('siger «tillagt efterfølgende lønstigninger» kun ved regulering efter reguleringsdatoen', () => {
    const forloeb = resolveLoenReguleringsforloeb([
      { fra: iso('2024-10-01'), deltaPct: 0 },
      { fra: iso('2025-04-01'), deltaPct: 2.5 },
    ], iso('2024-10-01'));
    expect(forloeb).toBe('efterfoelgende');
    expect(buildLoenGrundlagSaetning(loen, forloeb))
      .toBe(`Beregnes som ${loen} tillagt efterfølgende lønstigninger.`);
  });

  it('beskriver en nedregulering før reguleringsdatoen', () => {
    const forloeb = resolveLoenReguleringsforloeb([
      { fra: iso('2024-01-01'), deltaPct: -5.08 },
      { fra: iso('2024-10-01'), deltaPct: 0 },
    ], iso('2024-10-01'));
    expect(forloeb).toBe('foerOgEfter');
    expect(buildLoenGrundlagSaetning(loen, forloeb))
      .toBe(`Beregnes som ${loen} reguleret efter lønudviklingen før og efter denne dato.`);
  });

  it('bruger «Ingen»-sætningen, når ingen periode reguleres', () => {
    const forloeb = resolveLoenReguleringsforloeb([{ fra: iso('2024-01-01'), deltaPct: 0 }], iso('2024-10-01'));
    expect(forloeb).toBe('ingen');
    expect(buildLoenGrundlagSaetning(loen, forloeb)).toBe(`Opgøres på baggrund af ${loen}.`);
  });
});
