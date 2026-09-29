import { parseInboundPersistedSection } from '../../utils/inboundPersistedSection';

describe('parseInboundPersistedSection', () => {
  it('parser gyldig data og rapporterer ukendte felter uden at beholde dem', () => {
    const result = parseInboundPersistedSection('stamdata', {
      journalnr: 'J-1',
      skadelidte: 'Testperson',
      ukendtFelt: 'fjern mig',
    }, '3.13');

    expect(result).toEqual({
      migratedValue: {
        journalnr: 'J-1',
        skadelidte: 'Testperson',
        ukendtFelt: 'fjern mig',
      },
      unknownPaths: [['ukendtFelt']],
      invalidPaths: [],
      preflightMissingFields: [],
      ok: true,
      data: {
        journalnr: 'J-1',
        skadelidte: 'Testperson',
      },
    });
  });

  it('normaliserer null før schema-parse og bevarer kun canonical data', () => {
    const result = parseInboundPersistedSection('stamdata', {
      journalnr: null,
      skadelidte: 'Testperson',
      skadedato: null,
    }, '3.13');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migratedValue).toEqual({
      journalnr: undefined,
      skadelidte: 'Testperson',
      skadedato: undefined,
    });
    expect(result.data).toEqual({
      journalnr: undefined,
      skadelidte: 'Testperson',
      skadedato: undefined,
    });
    expect(result.unknownPaths).toEqual([]);
    expect(result.invalidPaths).toEqual([]);
  });

  it('salvager flere ugyldige felter og rapporterer deres stier', () => {
    const result = parseInboundPersistedSection('stamdata', {
      journalnr: 'J-1',
      skadetype: 'ukendt skadestype',
      skadedato: 'ikke-en-dato',
    }, '3.13');

    expect(result).toEqual({
      migratedValue: {
        journalnr: 'J-1',
        skadetype: 'ukendt skadestype',
        skadedato: 'ikke-en-dato',
      },
      unknownPaths: [['skadetype']],
      invalidPaths: [['skadedato']],
      preflightMissingFields: [],
      ok: true,
      data: { journalnr: 'J-1' },
    });
  });

  it('fjerner en hel ugyldig tabelrække ved et nested schema-issue', () => {
    const result = parseInboundPersistedSection('renteberegning', {
      rentekravRows: [{
        id: '',
        belob: undefined,
        renterFra: undefined,
        tillaegstid: 0,
        enhed: 'dage',
      }],
    }, '3.13');

    expect(result).toEqual({
      migratedValue: {
        rentekravRows: [{
          id: '',
          belob: undefined,
          renterFra: undefined,
          tillaegstid: 0,
          enhed: 'dage',
        }],
      },
      unknownPaths: [],
      invalidPaths: [['rentekravRows', 0, 'id']],
      preflightMissingFields: [],
      ok: true,
      data: { rentekravRows: [] },
    });
  });

  it('kombinerer unknown- og invalid-paths i samme salvage-resultat', () => {
    const result = parseInboundPersistedSection('stamdata', {
      journalnr: 'J-1',
      skadedato: 'ikke-en-dato',
      ukendtFelt: 'fjern mig',
    }, '3.13');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.unknownPaths).toEqual([['ukendtFelt']]);
    expect(result.invalidPaths).toEqual([['skadedato']]);
    expect(result.data).toEqual({ journalnr: 'J-1' });
  });

  it('afviser en ugyldig root-værdi fail-closed, når ingen path kan fjernes', () => {
    const result = parseInboundPersistedSection('stamdata', 'forkert root', '3.13');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.migratedValue).toBe('forkert root');
    expect(result.unknownPaths).toEqual([]);
    expect(result.invalidPaths).toEqual([]);
    expect(result.preflightMissingFields).toEqual([]);
    expect(result.error.issues[0]?.path).toEqual([]);
  });
});
