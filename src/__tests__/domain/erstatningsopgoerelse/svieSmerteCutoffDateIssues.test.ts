import { collectSvieSmerteCutoffDateIssues } from '../../../domain/erstatningsopgoerelse/svieSmerteCutoffDateIssues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { evaluateSvieSmertePerioder } from '../../../domain/erstatningsopgoerelse/validation/svieSmertePeriodeValidation';
import { resolveFieldIssueTooltip } from '../../../inputCore/inputIssue';
import { toISODateString } from '../../../types/branded';
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

  it('bruger den samme specifikke besked i række-evalueringen som ved feltet', () => {
    const evaluation = evaluateSvieSmertePerioder(eoWith({}).svieSmertePerioder, {
      skadedatoISO: toISODateString('2020-01-01'),
      erErhvervssygdom: false,
      menAfgoerelseDatoForTabel: toISODateString('2024-09-15'),
      menAfgoerelseDato: toISODateString('2024-09-16'),
      verserendeKlageMen: false,
    }).get('ss-1');

    expect(evaluation).toEqual({
      kind: 'error',
      message: 'Der er angivet svie/smerte efter datoen for en ménafgørelse (16-09-2024)',
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
});
