import {
  EET_ASL_AARSLOEN_MAX_WARNING,
  EET_EAL_AARSLOEN_MAX_WARNING,
  EET_TITRIN_FRA_2024_WARNING,
  EET_UNDER_15_WARNING,
  KAPITALISERING_UNDER_15_WARNING,
  hasEetAslAarsloenMaxWarning,
  hasEetEalAarsloenMaxWarning,
  kapitaliseringUnder15WarningRowIds,
  formatDatoEfterBeregningsdatoWarning,
  resolveDatoEfterBeregningsdatoWarning,
  resolveEetAslAarsloenMaxWarning,
  resolveEetTitrinWarning,
  resolveKapitaliseringUnder15Warning,
  resolveEetUnder15Warning,
} from '../../../domain/erhvervsevnetab/eetFieldWarnings';
import { aarsloenAslMax } from '../../../data/lovbestemteRates';
import { toISODateString } from '../../../types/branded';

const amount = (value: number) => ({ kind: 'number' as const, value });

describe('resolveEetUnder15Warning', () => {
  it.each([5, 10])('viser den aftalte advarsel ved %s procent', (value) => {
    expect(resolveEetUnder15Warning(value)).toEqual({
      severity: 'warning',
      message: EET_UNDER_15_WARNING,
    });
  });

  it.each([undefined, 0, 15, 20])('viser ingen advarsel ved %s', (value) => {
    expect(resolveEetUnder15Warning(value)).toBeUndefined();
  });
});

describe('kapitaliseringUnder15WarningRowIds', () => {
  it('fremhæver den første kapitalisering under 15 %', () => {
    const rows = [{ rowId: 'foerste', kapitaliseringspct: 10 }];
    expect(kapitaliseringUnder15WarningRowIds(rows)).toEqual(new Set(['foerste']));
    expect(resolveKapitaliseringUnder15Warning('foerste', rows)).toEqual({
      severity: 'warning', message: KAPITALISERING_UNDER_15_WARNING,
    });
  });

  it('fremhæver ikke en lovlig senere delkapitalisering efter en første kapitalisering på mindst 15 %', () => {
    const rows = [
      { rowId: 'foerste', kapitaliseringspct: 20 },
      { rowId: 'forhoejelse', kapitaliseringspct: 10 },
    ];
    expect(kapitaliseringUnder15WarningRowIds(rows)).toEqual(new Set());
    expect(resolveKapitaliseringUnder15Warning('forhoejelse', rows)).toBeUndefined();
  });
});

describe('resolveEetAslAarsloenMaxWarning', () => {
  it('viser en gul feltadvarsel når EAL-årslønnen er tom og ASL-årslønnen er skadesårets maksimum', () => {
    const skadedato = toISODateString('2024-07-01');
    const aslAarsloen = amount(aarsloenAslMax[2024]!);

    expect(hasEetAslAarsloenMaxWarning(aslAarsloen, undefined, skadedato)).toBe(true);
    expect(resolveEetAslAarsloenMaxWarning(aslAarsloen, undefined, skadedato)).toEqual({
      severity: 'warning',
      message: EET_ASL_AARSLOEN_MAX_WARNING,
    });
  });

  it.each([
    ['EAL-årslønnen er udfyldt', amount(aarsloenAslMax[2024]!), amount(500000)],
    ['ASL-årslønnen ikke er maksimum', amount(aarsloenAslMax[2024]! - 1000), undefined],
    ['skadedatoen mangler', amount(aarsloenAslMax[2024]!), undefined],
  ])('viser ingen advarsel når %s', (_reason, aslAarsloen, ealAarsloen) => {
    const skadedato = _reason === 'skadedatoen mangler' ? undefined : toISODateString('2024-07-01');
    expect(resolveEetAslAarsloenMaxWarning(aslAarsloen, ealAarsloen, skadedato)).toBeUndefined();
  });

  // BB-183: den anden halvdel af samme regel. Feltet fik tidligere kun en gul ring, når det var TOMT
  // og ASL-årslønnen stod på maksimum; stod maksimum i feltet SELV, var det neutralt, og advarslen
  // fandtes kun som en linje i «Fejl og advarsler» på to resultatfaner.
  it('viser en gul feltadvarsel når EAL-årslønnen selv er skadesårets ASL-maksimum', () => {
    const skadedato = toISODateString('2024-07-01');
    const maks = amount(aarsloenAslMax[2024]!);

    expect(hasEetEalAarsloenMaxWarning(maks, skadedato)).toBe(true);
    expect(resolveEetAslAarsloenMaxWarning(undefined, maks, skadedato)).toEqual({
      severity: 'warning',
      message: EET_EAL_AARSLOEN_MAX_WARNING,
    });
  });

  it('lader den udfyldte EAL-årsløn vinde, når begge felter står på maksimum', () => {
    const skadedato = toISODateString('2024-07-01');
    const maks = amount(aarsloenAslMax[2024]!);

    // Kun én af de to halvdele må give en ring, og det er den, feltet selv bærer.
    expect(resolveEetAslAarsloenMaxWarning(maks, maks, skadedato)).toEqual({
      severity: 'warning',
      message: EET_EAL_AARSLOEN_MAX_WARNING,
    });
  });

  it.each([
    ['EAL-årslønnen ikke er maksimum', amount(aarsloenAslMax[2024]! - 1000), toISODateString('2024-07-01')],
    ['EAL-årslønnen er tom', undefined, toISODateString('2024-07-01')],
    ['skadedatoen mangler', amount(aarsloenAslMax[2024]!), undefined],
  ])('giver ingen EAL-maksimum-advarsel når %s', (_reason, ealAarsloen, skadedato) => {
    expect(hasEetEalAarsloenMaxWarning(ealAarsloen, skadedato)).toBe(false);
  });
});

describe('resolveEetTitrinWarning', () => {
  const fra2024 = toISODateString('2024-08-01');
  const foer2024 = toISODateString('2024-06-30');

  it.each([25, 35, 45])('advarer ved %s procent for en skade fra 1. juli 2024', (value) => {
    expect(resolveEetTitrinWarning(value, fra2024)).toEqual({
      severity: 'warning',
      message: EET_TITRIN_FRA_2024_WARNING,
    });
  });

  it.each([20, 30, 100])('advarer ikke ved %s procent, som opfylder titrinsreglen', (value) => {
    expect(resolveEetTitrinWarning(value, fra2024)).toBeUndefined();
  });

  it('advarer ikke ved 15 procent, som er lovlig uanset titrinsreglen', () => {
    expect(resolveEetTitrinWarning(15, fra2024)).toBeUndefined();
  });

  it.each([
    ['skaden er før 1. juli 2024', foer2024],
    ['skadedatoen mangler', undefined],
  ])('advarer ikke når %s', (_reason, skadedato) => {
    expect(resolveEetTitrinWarning(25, skadedato)).toBeUndefined();
  });

  it('kalder ikke værdien ugyldig og påstår ikke noget om beregningens lovlighed', () => {
    // BB-158: programmet accepterer værdien, regner på den og trykker den, så «ugyldig» og
    // programmets egen adfærd kunne ikke begge være rigtige.
    // BB-173: halen «– beregningen er derfor ikke lovmæssig» er fjernet igen. Hvad der kan bruges
    // juridisk, er brugerens vurdering; advarslen navngiver grænsen og lader det blive ved det.
    // Halen gav desuden to advarsler om SAMME 15 %-grænse hver sin alvorsgrad.
    for (const warning of [EET_TITRIN_FRA_2024_WARNING, EET_UNDER_15_WARNING, KAPITALISERING_UNDER_15_WARNING]) {
      expect(warning).not.toContain('ugyldig');
      expect(warning).not.toContain('lovmæssig');
    }
  });
});

describe('resolveDatoEfterBeregningsdatoWarning', () => {
  const beregningsdato = toISODateString('2021-01-01');

  it('advarer ved feltet, når datoen ligger efter beregningsdatoen', () => {
    expect(resolveDatoEfterBeregningsdatoWarning(
      toISODateString('2022-06-01'),
      beregningsdato,
      'Afgørelsesdatoen'
    )).toEqual({
      severity: 'warning',
      message: 'Afgørelsesdatoen ligger efter beregningsdatoen (01-01-2021)',
    });
  });

  it.each([
    ['datoen er på beregningsdatoen', toISODateString('2021-01-01'), beregningsdato],
    ['datoen ligger før', toISODateString('2020-01-01'), beregningsdato],
    ['datoen mangler', undefined, beregningsdato],
    ['beregningsdatoen mangler', toISODateString('2022-06-01'), undefined],
  ])('advarer ikke når %s', (_reason, dato, grænse) => {
    expect(resolveDatoEfterBeregningsdatoWarning(dato, grænse, 'Afgørelsesdatoen')).toBeUndefined();
  });

  it('navngiver årsagen én gang i boksens linje', () => {
    // BB-159: tre linjer om ét forhold læses som tre problemer, hvor der er ét.
    expect(formatDatoEfterBeregningsdatoWarning(beregningsdato))
      .toBe('Beregningsdatoen (01-01-2021) ligger før sagens afgørelser.');
  });
});
