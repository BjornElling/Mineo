import { resolveKildeReguleringsIntervalIso } from '../../../domain/erstatningsopgoerelse/helpers/reguleringKildeCoverage';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString, isISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const baseAf = () => createDefaultLoenindkomstAnsaettelsesforhold();

describe('resolveKildeReguleringsIntervalIso', () => {
  it('returnerer KRL-kildens uscopede coverage-interval i ISO', () => {
    const af = baseAf();
    af.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    af.loenudviklingKRLSatstabel = 'KTO (kommuner)';

    const interval = resolveKildeReguleringsIntervalIso(af);
    // Kilden går reelt tilbage til 01-04-2001 (den tidligste registrerede sats).
    expect(interval?.fraIso).toBe(iso('2001-04-01'));
    // tilDato = nyeste satsdato (01-04-2026) + 6 mdr − 1 dag = 30-09-2026.
    expect(interval?.tilIso).toBe(iso('2026-09-30'));
  });

  it('returnerer coverage-interval for Overenskomst', () => {
    const af = baseAf();
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laasesmedeoverenskomsten';

    const interval = resolveKildeReguleringsIntervalIso(af);
    expect(interval).toBeDefined();
    expect(isISODateString(interval?.fraIso ?? '')).toBe(true);
    expect(isISODateString(interval?.tilIso ?? '')).toBe(true);
  });

  it('returnerer coverage-interval for Statistik', () => {
    const af = baseAf();
    af.loenudviklingBeregningsgrundlag = 'Statistik';
    af.loenudviklingStatistikModel = 'ILON12 (Danmarks Statistik)';

    const interval = resolveKildeReguleringsIntervalIso(af);
    expect(interval).toBeDefined();
    expect(isISODateString(interval?.fraIso ?? '')).toBe(true);
  });

  it('returnerer coverage-interval for KL-lønaftaler', () => {
    const af = baseAf();
    af.loenudviklingBeregningsgrundlag = 'KL-lønaftaler';

    const interval = resolveKildeReguleringsIntervalIso(af);
    expect(interval).toBeDefined();
    expect(isISODateString(interval?.fraIso ?? '')).toBe(true);
  });

  it('returnerer undefined for manuelle modeller og Ingen (intet kilde-interval)', () => {
    const manuelt = baseAf();
    manuelt.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    expect(resolveKildeReguleringsIntervalIso(manuelt)).toBeUndefined();

    const procentsats = baseAf();
    procentsats.loenudviklingBeregningsgrundlag = 'Manuel procentsats';
    expect(resolveKildeReguleringsIntervalIso(procentsats)).toBeUndefined();

    const ingen = baseAf();
    ingen.loenudviklingBeregningsgrundlag = 'Ingen';
    expect(resolveKildeReguleringsIntervalIso(ingen)).toBeUndefined();
  });

  it('returnerer undefined for KRL uden gyldig satstabel', () => {
    const af = baseAf();
    af.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    af.loenudviklingKRLSatstabel = undefined;
    expect(resolveKildeReguleringsIntervalIso(af)).toBeUndefined();
  });
});
