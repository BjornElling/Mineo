import {
  EET_ASL_AARSLOEN_MAX_WARNING,
  EET_EAL_AARSLOEN_MAX_WARNING,
  EET_TITRIN_FRA_2024_WARNING,
  EET_UNDER_15_WARNING,
  KAPITALISERING_UNDER_15_WARNING,
  KAP_DATO_EFTER_AFGOERELSESDATO_GENOPTAGELSE_WARNING,
  KAP_DATO_EFTER_AFGOERELSESDATO_UNDER_TO_AAR_WARNING,
  KAP_DATO_INDEN_FOR_TO_AAR_WARNING,
  collectKapDatoWarnings,
  hasEetAslAarsloenMaxWarning,
  hasEetEalAarsloenMaxWarning,
  kapitaliseringUnder15WarningRowIds,
  formatDatoEfterBeregningsdatoWarning,
  resolveDatoEfterBeregningsdatoWarning,
  resolveKapDatoFeltWarning,
  resolveEetAslAarsloenMaxWarning,
  resolveEetTitrinWarning,
  resolveKapitaliseringUnder15Warning,
  resolveEetUnder15Warning,
} from '../../../domain/erhvervsevnetab/eetFieldWarnings';
import {
  KAP_DATO_EFTER_AFGOERELSESDATO_WARNING_ID,
  KAP_DATO_INDEN_FOR_TO_AAR_WARNING_ID,
} from '../../../domain/erhvervsevnetab/eetIssueCatalog';
import { aarsloenAslMax } from '../../../data/lovbestemteRates';
import { toISODateString } from '../../../types/branded';
import type { AslAfgoerelseRow } from '../../../schemas/formSchemas';

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
  it('viser ingen rækker når kapitaliseringslisten er tom', () => {
    expect(kapitaliseringUnder15WarningRowIds([])).toEqual(new Set());
  });

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
      .toBe('En eller flere datoer i ASL-afgørelserne ligger efter beregningsdatoen (01-01-2021).');
  });
});

describe('resolveKapDatoFeltWarning – kapitaliseringsdato efter afgørelsesdatoen', () => {
  const row: AslAfgoerelseRow = {
    id: 'genoptaget',
    afgoerelsesDato: toISODateString('2024-07-01'),
    virkningsDato: toISODateString('2019-06-01'),
    eetPct: 60,
    kapDato: toISODateString('2024-10-01'),
    kapPct: 30,
    afgoerelseType: 'Endelig',
    tidlKapDato: toISODateString('2019-06-01'),
    fsTilbageholdtEet: 'Nej',
  };
  const skadedato = toISODateString('2019-04-01');
  const fodselsdato = toISODateString('1980-01-01');

  it.each(['Endelig', 'Delvist endelig'] as const)('advarer ved senere kapitalisering efter genoptagelse fra 1. juli 2024 (%s), også uden for 2-årsvinduet', (afgoerelseType) => {
    expect(resolveKapDatoFeltWarning({ ...row, afgoerelseType }, skadedato, fodselsdato, undefined))
      .toEqual({ severity: 'warning', message: KAP_DATO_EFTER_AFGOERELSESDATO_GENOPTAGELSE_WARNING });
  });

  it.each([
    { afgoerelsesDato: toISODateString('2024-06-30') },
    { tidlKapDato: undefined },
    { afgoerelseType: 'Midlertidig' as const },
    { afgoerelseType: undefined },
    { kapDato: toISODateString('2024-07-01') },
    { kapDato: toISODateString('2024-06-30') },
    { kapDato: undefined },
    { afgoerelsesDato: undefined },
  ])('advarer ikke uden en senere dato under genoptagelsesreglen (%j)', (overrides) => {
    expect(resolveKapDatoFeltWarning({ ...row, ...overrides }, skadedato, fodselsdato, undefined)).toBeUndefined();
  });

  it('bevarer advarslen for en endelig afgørelse i 2-årsvinduet uden genoptagelse', () => {
    expect(resolveKapDatoFeltWarning({ ...row, tidlKapDato: undefined }, skadedato, toISODateString('1959-01-01'), undefined))
      .toEqual({ severity: 'warning', message: KAP_DATO_EFTER_AFGOERELSESDATO_UNDER_TO_AAR_WARNING });
  });
});

// Født 01-07-1955: folkepension 01-07-2022, toårsgrænse 01-07-2020 (udviklerafgørelse 2026-11-13).
describe('resolveKapDatoFeltWarning – kapitalisering inden for de sidste to år før folkepension', () => {
  const skadedato = toISODateString('2019-04-01');
  const fodselsdato = toISODateString('1955-07-01');
  const endelig: AslAfgoerelseRow = {
    id: 'b',
    afgoerelsesDato: toISODateString('2019-06-01'),
    virkningsDato: toISODateString('2019-06-01'),
    eetPct: 30,
    kapDato: toISODateString('2020-10-01'),
    kapPct: 30,
    afgoerelseType: 'Endelig',
    fsTilbageholdtEet: 'Nej',
  };
  const graenseTekst = 'Kapitalisering inden for de sidste to år før folkepensionsalderen (fra 01-07-2020) er som udgangspunkt udelukket';

  it('advarer ved en endelig afgørelse over to år før, kapitaliseret inden for vinduet', () => {
    expect(resolveKapDatoFeltWarning(endelig, skadedato, fodselsdato, undefined))
      .toEqual({ severity: 'warning', message: graenseTekst });
  });

  it('advarer ved en delvist endelig afgørelse kapitaliseret inden for vinduet', () => {
    const delvist = { ...endelig, afgoerelseType: 'Delvist endelig' as const, afgoerelsesDato: toISODateString('2021-10-01'), kapDato: toISODateString('2021-10-01'), kapPct: 25 };
    expect(resolveKapDatoFeltWarning(delvist, skadedato, fodselsdato, undefined))
      .toEqual({ severity: 'warning', message: graenseTekst });
  });

  it('advarer præcis på grænsen, men ikke dagen før', () => {
    expect(resolveKapDatoFeltWarning({ ...endelig, kapDato: toISODateString('2020-07-01') }, skadedato, fodselsdato, undefined))
      .toEqual({ severity: 'warning', message: graenseTekst });
    expect(resolveKapDatoFeltWarning({ ...endelig, kapDato: toISODateString('2020-06-30') }, skadedato, fodselsdato, undefined))
      .toBeUndefined();
  });

  it('advarer ikke, når toårsreglen netop kræver kapitaliseringen', () => {
    const tvungen = { ...endelig, afgoerelsesDato: toISODateString('2021-10-01'), kapDato: toISODateString('2021-10-01'), eetPct: 60, kapPct: 60 };
    expect(resolveKapDatoFeltWarning(tvungen, skadedato, fodselsdato, undefined)).toBeUndefined();
    expect(collectKapDatoWarnings([tvungen], skadedato, fodselsdato)).toEqual([]);
  });

  it('advarer ikke ved ukendt skadedato eller fødselsdato', () => {
    expect(resolveKapDatoFeltWarning(endelig, undefined, fodselsdato, undefined)).toBeUndefined();
    expect(resolveKapDatoFeltWarning(endelig, skadedato, undefined, undefined)).toBeUndefined();
  });

  it('har forrang for beregningsdatoens advarsel, men viger for genoptagelsesreglen', () => {
    expect(resolveKapDatoFeltWarning(endelig, skadedato, fodselsdato, toISODateString('2020-08-01'))?.message)
      .toBe(graenseTekst);
    expect(resolveKapDatoFeltWarning(
      { ...endelig, eetPct: 60, kapPct: 30, afgoerelsesDato: toISODateString('2024-07-01'), kapDato: toISODateString('2024-10-01'), tidlKapDato: toISODateString('2019-06-01') },
      skadedato, toISODateString('1960-01-01'), undefined,
    )?.message).toBe(KAP_DATO_EFTER_AFGOERELSESDATO_GENOPTAGELSE_WARNING);
  });

  it('samler fanernes advarselslinjer med den første berørte række', () => {
    const senere = {
      ...endelig, id: 'tvungen', afgoerelsesDato: toISODateString('2021-10-01'), kapDato: toISODateString('2021-12-01'),
      eetPct: 60, kapPct: 30,
    };
    expect(collectKapDatoWarnings([endelig, senere], skadedato, fodselsdato)).toEqual([
      { id: KAP_DATO_EFTER_AFGOERELSESDATO_WARNING_ID, message: KAP_DATO_EFTER_AFGOERELSESDATO_UNDER_TO_AAR_WARNING, rowId: 'tvungen' },
      { id: KAP_DATO_INDEN_FOR_TO_AAR_WARNING_ID, message: KAP_DATO_INDEN_FOR_TO_AAR_WARNING, rowId: 'b' },
    ]);
  });
});
