import {
  resolveOverenskomstCoverageStartIso,
  resolveOverenskomstEffectiveStartIso,
} from '../../../domain/erstatningsopgoerelse/engines/reguleringCoverage';
import { getReguleringsDatoIntervalForOverenskomst } from '../../../data/overenskomstRates';
import { parseDanishToIso } from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { toISODateString } from '../../../types/branded';

// Kanonisk fælles fundament: coverage-opløsningen som
// alle overenskomst-baserede former deler. Vi tester den observerbare kontrakt
// (undefined-håndtering, interval-parsing, `>`-clamp), ikke datatabellens
// konkrete tal — coverage-startdatoen udledes derfor dynamisk fra datakilden.

const KNOWN_OVERENSKOMST_ID = 'bygge-anlaeg';

const resolveKnownCoverageIso = () => {
  const interval = getReguleringsDatoIntervalForOverenskomst(KNOWN_OVERENSKOMST_ID);
  if (!interval) throw new Error('testforudsætning: kendt overenskomst mangler interval');
  const iso = parseDanishToIso(interval.fraDato);
  if (!iso) throw new Error('testforudsætning: coverage-fraDato kunne ikke parses');
  return iso;
};

describe('resolveOverenskomstCoverageStartIso', () => {
  it('undefined overenskomst-id → undefined (fail-closed, ingen gætt dækning)', () => {
    expect(resolveOverenskomstCoverageStartIso(undefined)).toBeUndefined();
  });

  it('ukendt overenskomst-id → undefined', () => {
    expect(resolveOverenskomstCoverageStartIso('findes-ikke')).toBeUndefined();
  });

  it('tom streng → undefined', () => {
    expect(resolveOverenskomstCoverageStartIso('')).toBeUndefined();
  });

  it('kendt id → coverage-start parset til ISO fra intervallets fraDato', () => {
    const iso = resolveOverenskomstCoverageStartIso(KNOWN_OVERENSKOMST_ID);
    const interval = getReguleringsDatoIntervalForOverenskomst(KNOWN_OVERENSKOMST_ID);
    expect(iso).toBeDefined();
    expect(iso).toBe(parseDanishToIso(interval?.fraDato));
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('resolveOverenskomstEffectiveStartIso', () => {
  it('ingen coverage (undefined id) → tabel-start uændret', () => {
    const tableStart = toISODateString('2015-06-01');
    expect(resolveOverenskomstEffectiveStartIso(undefined, tableStart)).toBe(tableStart);
  });

  it('ingen coverage (ukendt id) → tabel-start uændret', () => {
    const tableStart = toISODateString('2015-06-01');
    expect(resolveOverenskomstEffectiveStartIso('findes-ikke', tableStart)).toBe(tableStart);
  });

  it('coverage-start efter tabel-start → clamper frem til coverage-start', () => {
    const coverageIso = resolveKnownCoverageIso();
    // Tabel-start bevidst langt før enhver overenskomst-dækning.
    const tableStart = toISODateString('1990-01-01');
    expect(resolveOverenskomstEffectiveStartIso(KNOWN_OVERENSKOMST_ID, tableStart)).toBe(coverageIso);
  });

  it('coverage-start før tabel-start → beholder tabel-start (ingen tilbage-clamp)', () => {
    // Tabel-start bevidst langt efter enhver overenskomst-dækningsstart.
    const tableStart = toISODateString('2099-12-31');
    expect(resolveOverenskomstEffectiveStartIso(KNOWN_OVERENSKOMST_ID, tableStart)).toBe(tableStart);
  });

  it('coverage-start = tabel-start → beholder tabel-start (`>` er streng, ingen off-by-one)', () => {
    const coverageIso = resolveKnownCoverageIso();
    // Grænsetilfælde: præcis lig med coverage-start. `minCoverageIso > tableStart`
    // er falsk, så tabel-start (identisk værdi) returneres.
    expect(resolveOverenskomstEffectiveStartIso(KNOWN_OVERENSKOMST_ID, coverageIso)).toBe(coverageIso);
  });
});
