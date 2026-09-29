import {
  assertUniform,
  buildSegmentsFromStartDates,
  buildZeroDeltaSegment,
  ensurePositiveFiniteNumber,
  resolveEffectiveBaseEntry,
  resolveOffentligLoenSelection,
  toKildeReguleringsIntervalIso,
} from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringFormPrimitives';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

describe('reguleringFormPrimitives', () => {
  it('sorterer og afgrænser startdatoer samt bygger zero-delta-segmenter', () => {
    const range = { fra: iso('2024-01-01'), til: iso('2024-01-10') };
    const segments = buildSegmentsFromStartDates(range, new Set([
      iso('2023-12-01'),
      iso('2024-01-05'),
      iso('2024-01-07'),
      iso('2024-02-01'),
    ]));

    expect(segments).toEqual([
      { fra: iso('2024-01-01'), til: iso('2024-01-04') },
      { fra: iso('2024-01-05'), til: iso('2024-01-06') },
      { fra: iso('2024-01-07'), til: iso('2024-01-10') },
    ]);
    expect(buildZeroDeltaSegment(segments[0]!)).toEqual({
      fra: iso('2024-01-01'),
      til: iso('2024-01-04'),
      deltaPct: 0,
    });
  });

  it('ignorerer et omvendt interval uden at bygge et ugyldigt segment', () => {
    expect(buildSegmentsFromStartDates(
      { fra: iso('2024-02-01'), til: iso('2024-01-31') },
      new Set()
    )).toEqual([]);
  });

  it('projicerer et dansk satsinterval til ISO og bevarer tomt input som undefined', () => {
    expect(toKildeReguleringsIntervalIso({ fraDato: '01-01-2024', tilDato: '31-12-2024' })).toEqual({
      fraIso: iso('2024-01-01'),
      tilIso: iso('2024-12-31'),
    });
    expect(toKildeReguleringsIntervalIso(undefined)).toBeUndefined();
  });

  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY, 0, -1])(
    'afviser en ikke-positiv eller ikke-finit lønværdi (%s)',
    (value) => {
      expect(() => ensurePositiveFiniteNumber(value, 'Ugyldig lønværdi')).toThrow('Ugyldig lønværdi');
    },
  );

  it('returnerer en positiv finit lønværdi uændret', () => {
    expect(ensurePositiveFiniteNumber(1.25, 'Ugyldig lønværdi')).toBe(1.25);
  });

  it('vælger seneste basispost, falder tilbage til første post og fejler ved tom serie', () => {
    const entries = [
      { startIso: iso('2024-01-01'), value: 'første' },
      { startIso: iso('2024-07-01'), value: 'anden' },
    ] as const;

    expect(resolveEffectiveBaseEntry(entries, iso('2024-08-01'), 'test', 'mangler')).toEqual(entries[1]);
    expect(resolveEffectiveBaseEntry(entries, iso('2023-12-01'), 'test', 'mangler')).toEqual(entries[0]);
    expect(() => resolveEffectiveBaseEntry([], iso('2024-01-01'), 'test', 'mangler')).toThrow('mangler');
  });

  it('kræver ens indstillinger på tværs af aktive ansættelser', () => {
    const first = createDefaultLoenindkomstAnsaettelsesforhold();
    const same = { ...first };
    const different = { ...first, loenudviklingBeregningsgrundlag: 'Statistik' as const };

    expect(() => assertUniform([first], (af) => af.loenudviklingBeregningsgrundlag ?? '', 'grundlag')).not.toThrow();
    expect(() => assertUniform([first, same], (af) => af.loenudviklingBeregningsgrundlag ?? '', 'grundlag')).not.toThrow();
    expect(() => assertUniform([first, different], (af) => af.loenudviklingBeregningsgrundlag ?? '', 'grundlag'))
      .toThrow('Inkonsistente loenudviklingsindstillinger: grundlag');
  });

  it('parser offentlig lønindplacering og mapper de fem fail-closed-fejl', () => {
    const valid = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      offentligLoenType: 'Månedsløn' as const,
      offentligLoenTrin: 7,
      offentligLoenGruppe: 2,
    };

    expect(resolveOffentligLoenSelection(valid, 'KL')).toEqual({
      overenskomstType: 'KL',
      loenType: 'maanedsLoen',
      loentrin: 7,
      loengruppe: 2,
    });

    expect(() => resolveOffentligLoenSelection({ ...valid, offentligLoenType: undefined }, 'KL'))
      .toThrow('ansættelse er ikke valgt');
    expect(() => resolveOffentligLoenSelection({ ...valid, offentligLoenTrin: undefined }, 'KL'))
      .toThrow('løntrin mangler');
    expect(() => resolveOffentligLoenSelection({ ...valid, offentligLoenTrin: 0 }, 'KL'))
      .toThrow('løntrin skal være mellem 1 og 55');
    expect(() => resolveOffentligLoenSelection({ ...valid, offentligLoenGruppe: undefined }, 'KL'))
      .toThrow('gruppe mangler');
    expect(() => resolveOffentligLoenSelection({ ...valid, offentligLoenGruppe: 5 }, 'KL'))
      .toThrow('gruppe skal være mellem 0 og 4');
  });
});
