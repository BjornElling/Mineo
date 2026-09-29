import { collectSvieSmerteCutoffDateIssues } from '../../../domain/erstatningsopgoerelse/svieSmerteCutoffDateIssues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { evaluateSvieSmertePerioder } from '../../../domain/erstatningsopgoerelse/validation/svieSmertePeriodeValidation';
import {
  buildSvieSmerteCutoffErrorMessage,
  buildSvieSmertePeriodeCutoffErrorMessage,
  clampSvieSmerteRange,
} from '../../../domain/erstatningsopgoerelse/validation/svieSmerteConstraints';
import { resolveFieldIssueTooltip } from '../../../inputCore/inputIssue';
import { toISODateString, type ISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

const eoWith = (overrides: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  kravPaaSvieSmerteGodtgoerelse: 'Ja',
  tidligereSsMax: 'Nej',
  varigeMenAfgorelse: 'Ja',
  verserendeKlageMen: 'Nej',
  menAfgoerelseDato: toISODateString('2024-09-16'),
  svieSmertePerioder: [
    {
      id: 'ss-1',
      fra: toISODateString('2024-09-17'),
      til: toISODateString('2024-10-01'),
      tilstand: 'sygemeldt',
    },
  ],
  ...overrides,
});

const invalidIso = (value: string): ISODateString => value as unknown as ISODateString;

describe('collectSvieSmerteCutoffDateIssues', () => {
  it('markerer begge datofelter i en periode efter ménafgørelsen med samme konkrete besked', () => {
    const issues = collectSvieSmerteCutoffDateIssues(eoWith({}));

    expect(issues.map((issue) => issue.field.address.field).sort()).toEqual(['fra', 'til']);
    expect(new Set(issues.map((issue) => issue.message))).toEqual(new Set([
      'Der er angivet svie/smerte efter datoen for en ménafgørelse (16-09-2024)',
    ]));
    expect(issues.every((issue) => issue.reason === 'rule' && issue.priority === 'context')).toBe(true);
    expect(resolveFieldIssueTooltip(issues[0]!)).toBe(
      'Der er angivet svie/smerte efter datoen for en ménafgørelse (16-09-2024)'
    );
  });

  it('markerer kun til-datoen når perioden begynder før cutoffen og slutter på cutoffen', () => {
    const issues = collectSvieSmerteCutoffDateIssues(eoWith({
      svieSmertePerioder: [{
        id: 'ss-1',
        fra: toISODateString('2024-09-15'),
        til: toISODateString('2024-09-16'),
        tilstand: 'sygemeldt',
      }],
    }));

    expect(issues).toHaveLength(1);
    expect(issues[0]?.field.address.field).toBe('til');
  });

  const cutoffContext = {
    skadedatoISO: toISODateString('2020-01-01'),
    erErhvervssygdom: false,
    menAfgoerelseDatoForTabel: toISODateString('2024-09-15'),
    menAfgoerelseDato: toISODateString('2024-09-16'),
    verserendeKlageMen: false,
  };

  it('bruger feltets besked i række-evalueringen, når kun til-datoen ligger efter ménafgørelsen', () => {
    const evaluation = evaluateSvieSmertePerioder([{
      id: 'ss-1',
      fra: toISODateString('2024-09-01'),
      til: toISODateString('2024-10-01'),
      tilstand: 'sygemeldt',
    }], cutoffContext).get('ss-1');

    expect(evaluation).toEqual({
      kind: 'error',
      message: 'Der er angivet svie/smerte efter datoen for en ménafgørelse (16-09-2024)',
      field: 'til',
    });
  });

  it('siger i række-evalueringen, at hele perioden ligger efter ménafgørelsen, når fra-datoen gør det', () => {
    const evaluation = evaluateSvieSmertePerioder(eoWith({}).svieSmertePerioder, cutoffContext).get('ss-1');

    expect(evaluation).toEqual({
      kind: 'error',
      message: 'Hele perioden ligger efter datoen for ménafgørelsen (16-09-2024)',
      field: 'fra',
    });
  });

  it('navngiver anmeldelsesdatoen som årsag, når et erhvervssygdomsinterval er umuligt', () => {
    const evaluation = evaluateSvieSmertePerioder([{
      id: 'ss-1',
      fra: toISODateString('2020-01-01'),
      til: toISODateString('2099-01-01'),
      tilstand: 'sygemeldt',
    }], {
      skadedatoISO: toISODateString('2099-01-01'),
      erErhvervssygdom: true,
      menAfgoerelseDatoForTabel: undefined,
      menAfgoerelseDato: undefined,
      verserendeKlageMen: false,
    }).get('ss-1');

    expect(evaluation?.kind).toBe('error');
    expect(evaluation && 'message' in evaluation ? evaluation.message : '').toContain('Anmeldelsesdato');
    expect(evaluation && 'message' in evaluation ? evaluation.message : '').not.toContain('skadedato');
  });

  it.each([
    ['verserende klage', { verserendeKlageMen: 'Ja' as const }],
    ['ingen ménafgørelse', { varigeMenAfgorelse: 'Nej' as const }],
    ['skjult periode', { tidligereSsMax: 'Ja' as const }],
    ['intet svie/smerte-krav', { kravPaaSvieSmerteGodtgoerelse: 'Nej' as const }],
  ])('er tavs ved %s', (_name, overrides) => {
    expect(collectSvieSmerteCutoffDateIssues(eoWith(overrides))).toHaveLength(0);
  });

  it('navngiver én manglende celle og vælger fra-feltet', () => {
    const evaluation = evaluateSvieSmertePerioder([{
      id: 'ss-1',
      fra: undefined,
      til: toISODateString('2024-10-01'),
      tilstand: 'sygemeldt',
    }], cutoffContext).get('ss-1');

    expect(evaluation).toEqual({
      kind: 'error',
      message: 'Fra-dato er ikke angivet',
      field: 'fra',
    });
  });

  it('navngiver flere manglende celler med dansk listeformat', () => {
    const evaluation = evaluateSvieSmertePerioder([{
      id: 'ss-1',
      fra: toISODateString('2024-09-01'),
      til: undefined,
      tilstand: undefined,
    }], cutoffContext).get('ss-1');

    expect(evaluation).toEqual({
      kind: 'error',
      message: 'Til-dato og tilstand er ikke angivet',
      field: 'til',
    });
  });

  it('viser den konkrete umulige fra-dato-range med den afgørende grænse', () => {
    const evaluation = evaluateSvieSmertePerioder([{
      id: 'ss-1',
      fra: toISODateString('2024-01-01'),
      til: toISODateString('2024-01-02'),
      tilstand: 'sygemeldt',
    }], {
      ...cutoffContext,
      skadedatoISO: toISODateString('2025-01-01'),
      menAfgoerelseDatoForTabel: undefined,
      menAfgoerelseDato: undefined,
    }).get('ss-1');

    expect(evaluation?.kind).toBe('error');
    expect(evaluation && 'message' in evaluation ? evaluation.message : '').toContain(
      'Ingen gyldige datoer: min-dato (01-01-2025) er efter max-dato (02-01-2024)'
    );
    expect(evaluation && 'field' in evaluation ? evaluation.field : undefined).toBe('fra');
  });

  it('forankrer en omvendt datoorden i til-feltet', () => {
    const evaluation = evaluateSvieSmertePerioder([{
      id: 'ss-1',
      fra: toISODateString('2024-02-01'),
      til: toISODateString('2024-01-01'),
      tilstand: 'sygemeldt',
    }], {
      ...cutoffContext,
      menAfgoerelseDatoForTabel: undefined,
      menAfgoerelseDato: undefined,
    }).get('ss-1');

    expect(evaluation).toEqual({
      kind: 'error',
      message: 'Til-dato skal være efter fra-dato',
      field: 'til',
    });
  });

  it('falder tilbage til rå dato-tekst ved runtime-ugyldig cutoff-dato', () => {
    const invalidDate = invalidIso('2024-99-99');

    expect(buildSvieSmerteCutoffErrorMessage({
      value: invalidDate,
      menAfgoerelseDato: invalidDate,
    })).toBe('Der er angivet svie/smerte efter datoen for en ménafgørelse (2024-99-99)');
    expect(buildSvieSmertePeriodeCutoffErrorMessage({
      fra: invalidDate,
      til: invalidDate,
      menAfgoerelseDato: invalidDate,
    })).toBe('Hele perioden ligger efter datoen for ménafgørelsen (2024-99-99)');
  });

  it('viser hele-perioden-beskeden når fra-datoen ligger på cutoff-siden', () => {
    expect(buildSvieSmertePeriodeCutoffErrorMessage({
      fra: toISODateString('2024-09-17'),
      til: toISODateString('2024-09-20'),
      menAfgoerelseDato: toISODateString('2024-09-16'),
    })).toBe('Hele perioden ligger efter datoen for ménafgørelsen (16-09-2024)');
  });

  it('returnerer null når clamping reducerer perioden til ingenting', () => {
    expect(clampSvieSmerteRange({
      fra: toISODateString('2024-01-01'),
      til: toISODateString('2024-01-10'),
    }, {
      minStart: toISODateString('2024-01-11'),
    })).toBeNull();
  });
});
