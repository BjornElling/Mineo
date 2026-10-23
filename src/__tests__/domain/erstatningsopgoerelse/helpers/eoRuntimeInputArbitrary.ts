import { overenskomster } from '../../../../data/overenskomstRates';
import { ydelsestyper } from '../../../../data/ydelsestyper';
import type { AmountValue } from '../../../../schemas/amountExpressionSchema';
import {
  afsluttesMedEnum,
  anciennitetSatsPerEnum,
  arbejdsstatusEnum,
  beregningsmetodeEnum,
  eoBilagLoenindkomstOgOffentligeYdelserIndgaarSchema,
  helbredsstatusEnum,
  jaNejEnum,
  jaNejSkjulEnum,
  krlSatstabelEnum,
  loenPaaHelligdageEnum,
  loenperiodeEnum,
  loenudviklingBeregningsgrundlagEnum,
  loenudviklingStatistikModelEnum,
  offentligLoenTypeEnum,
  skadestypeEnum,
  svieSmerteDelvisSygemeldingSatsEnum,
  sygeferiegodtgoerelseBeregningskildeEnum,
  sygeferiegodtgoerelseSatsvalgEnum,
  tilstandEnum,
  tillaegAngivesSomEnum,
} from '../../../../schemas/formSchemas/enumSchemas';
import { persistedErstatningsopgoerelseSchema, stamdataSchema } from '../../../../schemas/formSchemas';
import type {
  PersistedErstatningsopgoerelseValues,
  PersistedLoenindkomstAnsaettelsesforhold,
  StamdataValues,
} from '../../../../schemas/formSchemas';
import type { StandardLoenTableRow } from '../../../../schemas/formSchemas/sections/aarsloenSchemas';
import { toISODateString, type ISODateString } from '../../../../types/branded';

/**
 * Seedet generator af schema-gyldige Stamdata- og EO-sektioner til runtime-fuzzing af hele EO-siden.
 *
 * Generatoren dækker HVERT persisteret EO-felt (enum-værdier hentes direkte fra schemaernes egne enums, så en ny
 * option automatisk kommer med) og blander tomme, delvise, omvendte og grænseværdier. Datoer trækkes omkring en
 * tilfældig skadedato, så perioder rammer hinanden, skæringsdatoer og dataserier i stedet for at sprede sig
 * tilfældigt over et århundrede. Hverken generatoren eller testene antager, at en kombination er beregnelig – de
 * kræver kun, at siden afviser den kontrolleret frem for at kaste.
 */

export type Rng = Readonly<{
  next: () => number;
  int: (min: number, max: number) => number;
  chance: (probability: number) => boolean;
  pick: <T>(values: readonly T[]) => T;
}>;

/** mulberry32: lille, deterministisk og tilstrækkelig til fuzzing. */
export const createRng = (seed: number): Rng => {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return Object.freeze({
    next,
    int,
    chance: (probability: number) => next() < probability,
    pick: <T,>(values: readonly T[]): T => {
      if (values.length === 0) throw new Error('pick() på tom liste');
      return values[Math.floor(next() * values.length)] as T;
    },
  });
};

const SKADEDATO_ANKRE = [
  '2008-02-29', '2010-12-31', '2011-01-01', '2012-01-01', '2015-06-15', '2019-12-31', '2020-02-29',
  '2021-07-01', '2022-03-01', '2023-01-31', '2024-01-01', '2025-07-11', '2026-09-20', '2027-06-30',
] as const;

const DAG_OFFSETS = [-1500, -800, -400, -366, -365, -183, -31, -30, -1, 0, 1, 2, 30, 31, 90, 183, 365, 366, 400, 800, 1500];

const EKSTREME_DATOER = ['1900-01-01', '1999-12-31', '2099-12-31'] as const;

const addDays = (iso: string, days: number): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

type Context = Readonly<{
  rng: Rng;
  anchor: string;
  /** Sandsynlighed for at et valgfrit felt efterlades tomt. */
  emptyRate: number;
  /** Kun værdier inden for feltgrænserne (ingen negative beløb, procenter over 100 eller ekstreme datoer). */
  inBounds: boolean;
}>;

const maybe = <T,>(ctx: Context, produce: () => T): T | undefined =>
  ctx.rng.chance(ctx.emptyRate) ? undefined : produce();

const date = (ctx: Context): ISODateString => {
  const { rng } = ctx;
  if (!ctx.inBounds && rng.chance(0.03)) return toISODateString(rng.pick(EKSTREME_DATOER));
  const offset = rng.chance(0.6) ? rng.pick(DAG_OFFSETS) : rng.int(-1500, 1500);
  return toISODateString(addDays(ctx.anchor, offset));
};

const optDate = (ctx: Context) => maybe(ctx, () => date(ctx));

const AMOUNTS = [0, 0.01, 1, 100, 999.99, 1000, 12_345.67, 35_000, 250_000, 1_000_000, 99_999_999, -1, -500];
const AMOUNTS_IN_BOUNDS = [100, 999.99, 1000, 12_345.67, 35_000];

const amount = (ctx: Context): AmountValue => {
  const value = ctx.inBounds
    ? ctx.rng.pick(AMOUNTS_IN_BOUNDS)
    : ctx.rng.chance(0.75) ? ctx.rng.pick(AMOUNTS) : Math.round(ctx.rng.int(0, 5_000_000)) / 100;
  return ctx.rng.chance(0.15)
    ? { kind: 'expression', expression: `${String(value).replace('.', ',')}+0`, value }
    : { kind: 'number', value };
};

const optAmount = (ctx: Context) => maybe(ctx, () => amount(ctx));

const PROCENTER = [0, 0.5, 1, 2.5, 4.5, 7.43, 12, 12.5, 15, 20, 50, 100, 150, -1];
const PROCENTER_IN_BOUNDS = [0, 1, 2.5, 4.5, 7.43, 12, 12.5];

const optPct = (ctx: Context) => maybe(ctx, () => ctx.rng.pick(ctx.inBounds ? PROCENTER_IN_BOUNDS : PROCENTER));

/** Den første værdi i listen er den, der bruges i grænsetro tilstand; resten er grænse- og fejlværdier. */
const optWhole = (ctx: Context, values: readonly number[]) =>
  maybe(ctx, () => (ctx.inBounds ? values[0] as number : ctx.rng.pick(values)));

const optEnum = <T,>(ctx: Context, values: readonly T[]) => maybe(ctx, () => ctx.rng.pick(values));

const optText = (ctx: Context) => maybe(ctx, () => ctx.rng.pick(['Tekst', 'Æøå – lang tekst med tegn', 'x']));

const rows = <T,>(ctx: Context, max: number, build: (index: number) => T): T[] => {
  const count = ctx.rng.chance(0.2) ? 0 : ctx.rng.int(1, max);
  return Array.from({ length: count }, (_, index) => build(index));
};

const anchorYear = (ctx: Context) => Number(ctx.anchor.slice(0, 4));

// De offentlige overenskomster ligger i et separat, ikke-eksporteret register; deres id'er står derfor her.
export const OVERENSKOMST_IDS = [
  ...overenskomster.map((overenskomst) => String(overenskomst.meta.id)),
  'kl-overenskomst',
  'rltn-overenskomst',
  'laerer-overenskomsten',
];

const loenRow = (ctx: Context, id: string): StandardLoenTableRow => {
  const { rng } = ctx;
  const year = String(anchorYear(ctx) + rng.int(-3, 1));
  const strangeText = () => rng.pick(['13', '0', 'abc', '2024,5']);
  return {
    id,
    col0_maaned: rng.chance(0.15) ? '' : rng.chance(0.03) ? strangeText() : String(rng.int(1, 12)),
    col1_maaned: rng.chance(0.15) ? '' : year,
    col0_uge: rng.chance(0.2) ? '' : rng.chance(0.03) ? strangeText() : String(rng.int(1, 53)),
    col1_uge: rng.chance(0.2) ? '' : year,
    col0_dag: optDate(ctx),
    col1_dag: optDate(ctx),
    col2: optAmount(ctx),
    col3: optAmount(ctx),
    col4: optAmount(ctx),
    col5: optAmount(ctx),
    fpFvShSoBeloeb: optAmount(ctx),
    pensionBeloeb: optAmount(ctx),
  };
};

const loenudviklingOgSatser = (ctx: Context, idPrefix: string) => {
  const { rng } = ctx;
  // Trækkene sker i præcis samme rækkefølge som før `offentligLoenEkstraGrundloenAngivesPer` kom til.
  const foerOffentligLoen = {
    feriePct: optPct(ctx),
    loenPaaHelligdage: rng.pick(loenPaaHelligdageEnum.options),
    beregnStoreBededagstillaeg: rng.chance(0.5),
    saerligFraDatoRegulering: optDate(ctx),
    loenudviklingBeregningsgrundlag: optEnum(ctx, loenudviklingBeregningsgrundlagEnum.options),
    loenudviklingStatistikModel: optEnum(ctx, loenudviklingStatistikModelEnum.options),
    loenudviklingKRLSatstabel: optEnum(ctx, krlSatstabelEnum.options),
    loenudviklingManuelNavn: optText(ctx),
    loenudviklingManuelTableData: rows(ctx, 4, (index) => ({
      id: `${idPrefix}-manuel-${String(index)}`,
      dato: optDate(ctx),
      grundloen: optAmount(ctx),
      feriepenge: optPct(ctx),
      shSoSats: optPct(ctx),
      fritvalg: optPct(ctx),
      agPension: optPct(ctx),
    })),
    loenudviklingManuelProcentsatsTableData: rows(ctx, 4, (index) => ({
      id: `${idPrefix}-procent-${String(index)}`,
      dato: optDate(ctx),
      procent: optEnum(ctx, ctx.inBounds ? [0, 0.75, 2, 3.5] : [-5, -0.5, 0, 0.75, 2, 3.5, 10, 100]),
    })),
  };
  const offentligLoenTypeTraek = optEnum(ctx, offentligLoenTypeEnum.options);
  return {
    ...foerOffentligLoen,
    // «Ansættelse» kan ikke være tom (BB-300); et tomt træk er schemaets standardværdi. Trækket bevares, så de
    // eksisterende seeds genererer de samme sager.
    offentligLoenType: offentligLoenTypeTraek ?? 'Månedsløn',
    offentligLoenTrin: optWhole(ctx, [26, 0, 1, 11, 15, 20, 30, 35, 41, 50, 99]),
    offentligLoenGruppe: optWhole(ctx, [1, 0, 2, 3, 4, 5, 9]),
    offentligLoenEkstraGrundloen: optAmount(ctx),
    // Afledt uden et ekstra RNG-træk, så de eksisterende seeds genererer de samme sager som før feltet kom
    // til. Enheden er bevidst den modsatte af «Ansættelse», så omregningsvejen altid gennemløbes.
    offentligLoenEkstraGrundloenAngivesPer: offentligLoenTypeTraek === 'Månedsløn' ? 'Time' as const : 'Måned' as const,
    overenskomstFilter: {
      loenmodtager: optText(ctx),
      arbejdsgiver: optText(ctx),
    },
  };
};

const anciennitet = (ctx: Context) => ({
  harAnciennitetstillaegEfterSkadedatoen: ctx.rng.chance(0.3),
  anciennitetstillaegDato: optDate(ctx),
  anciennitetstillaegSatsAngivesPer: ctx.rng.pick(anciennitetSatsPerEnum.options),
  anciennitetstillaegSats: optAmount(ctx),
});

const overenskomstId = (ctx: Context) => maybe(ctx, () => (
  ctx.rng.chance(0.05) ? 'ukendt-overenskomst' : ctx.rng.pick(OVERENSKOMST_IDS)
));

const employment = (ctx: Context, id: string): PersistedLoenindkomstAnsaettelsesforhold => {
  const { rng } = ctx;
  return {
    id,
    navnPaaArbejdssted: optText(ctx),
    harOverenskomst: rng.chance(0.6),
    overenskomstId: overenskomstId(ctx),
    ansatPaaSkadestidspunktet: rng.chance(0.7),
    ansaettelsesforholdOphoert: rng.chance(0.3),
    sidsteArbejdsdag: optDate(ctx),
    fritvalgPct: optPct(ctx),
    shSoPct: optPct(ctx),
    pensionPct: optPct(ctx),
    tillaegAngivesSom: rng.pick(tillaegAngivesSomEnum.options),
    loenperiode: rng.pick(loenperiodeEnum.options),
    indtaegtsoplysningerTableData: rows(ctx, 6, (index) => loenRow(ctx, `${id}-loen-${String(index)}`)),
    fuldLoenUnderFerie: rng.pick(jaNejEnum.options),
    ...anciennitet(ctx),
    ...loenudviklingOgSatser(ctx, id),
  };
};

const periodRows = (ctx: Context, prefix: string, max: number) => rows(ctx, max, (index) => ({
  id: `${prefix}-${String(index)}`,
  fra: optDate(ctx),
  til: optDate(ctx),
}));

export const generateStamdata = (ctx: Context): StamdataValues => ({
  journalnr: optText(ctx),
  advokat: optText(ctx),
  sagsbehandler: optText(ctx),
  skadelidte: optText(ctx),
  skadelidteFodselsdato: maybe(ctx, () => toISODateString(addDays(ctx.anchor, -ctx.rng.int(16, 70) * 365))),
  skadestype: optEnum(ctx, skadestypeEnum.options),
  // Skadedatoen er ankeret; den efterlades kun tom sjældnere end andre felter, så de afhængige grene rammes.
  skadedato: ctx.rng.chance(ctx.emptyRate / 2) ? undefined : toISODateString(ctx.anchor),
});

export const generateErstatningsopgoerelse = (ctx: Context): PersistedErstatningsopgoerelseValues => {
  const { rng } = ctx;
  const employments = rows(ctx, 3, (index) => employment(ctx, `af-${String(index + 1)}`));
  // SFGG-rækken er nøglet på ansættelsesforholdet og skal derfor være unik; en enkelt forældreløs reference
  // (et slettet ansættelsesforhold) er en tilstand, siden skal tåle.
  const sfggEmploymentIds = [
    ...employments.map((row) => row.id).filter(() => rng.chance(0.8)),
    ...(rng.chance(0.08) ? ['af-forsvundet'] : []),
  ];

  return {
    eoNummer: optEnum(ctx, ['1', '2', 'EO-42', '0']),
    eoLedsagetekst: optText(ctx),
    opgørelseLavetDen: optDate(ctx),
    indsaetUdkastStempel: rng.pick(jaNejEnum.options),
    vedroererPeriodeFra: optDate(ctx),
    vedroererPeriodeTil: optDate(ctx),
    revideretOpgoerelse: rng.pick(jaNejEnum.options),
    midlertidigtEetFraEetSiden: rng.pick(jaNejEnum.options),
    regulerOffentligeYdelser: rng.pick(jaNejEnum.options),
    erstatningsopgoerelseAfsluttesMed: rng.pick(afsluttesMedEnum.options),
    forligAnsvarsgradProcent: optEnum(ctx, ctx.inBounds ? [50, 100] : [0, 1, 33.33, 50, 66.67, 100, 150, -10]),
    forligAnsvarsgradBroek: optEnum(ctx, ctx.inBounds ? ['1/2'] : ['1/2', '2/3', '3/2', '0/1', '1/0', 'abc', '']),
    forligDato: optDate(ctx),
    kravPaaOevrigeErstatningskrav: rng.pick(jaNejSkjulEnum.options),
    oevrigeKravPerioder: rows(ctx, 3, (index) => ({
      id: `ok-${String(index)}`,
      dato: optDate(ctx),
      udgiftTil: optText(ctx),
      beloeb: optAmount(ctx),
    })),
    offentligeYdelserRows: rows(ctx, 5, (index) => ({
      id: `oy-${String(index)}`,
      fraDato: optDate(ctx),
      tilDato: optDate(ctx),
      ydelse: optAmount(ctx),
      tillaeg: optAmount(ctx),
      ydelsestype: rng.chance(ctx.emptyRate) ? '' : rng.chance(0.03) ? 'ukendt-type' : rng.pick(Object.keys(ydelsestyper)),
    })),
    offentligeYdelserKommentarer: optText(ctx),
    saerligeKommentarer: optText(ctx),
    eoBilagSelection: {
      opgoerelse: rng.chance(0.7),
      loenindkomst: rng.chance(0.7),
      offentligeYdelser: rng.chance(0.7),
      midlertidigEet: rng.chance(0.7),
      shDage: rng.chance(0.3),
      regulering: rng.chance(0.7),
      okSatser: rng.chance(0.7),
      sygeferiegodtgoerelse: rng.chance(0.3),
    },
    eoBilagLoenindkomstOgOffentligeYdelserIndgaar: rng.pick(eoBilagLoenindkomstOgOffentligeYdelserIndgaarSchema.options),

    varigeMenAfgorelse: rng.pick(jaNejEnum.options),
    menAfgoerelseDato: optDate(ctx),
    verserendeKlageMen: rng.pick(jaNejEnum.options),
    midlertidigtEETAfgorelse: rng.pick(jaNejEnum.options),
    midlertidigEETAfgoerelseDato: optDate(ctx),
    midlertidigEETVirkningsdato: optDate(ctx),
    endeligtEETAfgorelse: rng.pick(jaNejEnum.options),
    endeligEETAfgoerelseDato: optDate(ctx),
    endeligEETVirkningsdato: optDate(ctx),
    verserendeKlageEet: rng.pick(jaNejEnum.options),
    differencekravDato: optDate(ctx),

    kravPaaSvieSmerteGodtgoerelse: rng.pick(jaNejSkjulEnum.options),
    svieSmerteHelbredsstatus: optEnum(ctx, helbredsstatusEnum.options),
    tidligereSsMax: rng.pick(jaNejEnum.options),
    svieSmertePerioder: rows(ctx, 4, (index) => ({
      id: `ss-${String(index)}`,
      fra: optDate(ctx),
      til: optDate(ctx),
      tilstand: optEnum(ctx, tilstandEnum.options),
    })),
    svieSmerteSatserAar: optWhole(ctx, [anchorYear(ctx), 1990, 2003, 2010, anchorYear(ctx) + 1, 2050]),
    svieSmerteDelvisSygemeldingSats: rng.pick(svieSmerteDelvisSygemeldingSatsEnum.options),
    svieSmerteTidligereTotal: optAmount(ctx),
    svieSmerteAktuelPeriode: optAmount(ctx),

    kravPaaTabtArbejdsfortjeneste: rng.pick(jaNejSkjulEnum.options),
    tafArbejdsstatus: optEnum(ctx, arbejdsstatusEnum.options),
    tafPerioder: rows(ctx, 4, (index) => ({
      id: `taf-${String(index)}`,
      fra: optDate(ctx),
      til: optDate(ctx),
      loseFeriedage: optWhole(ctx, [1, 0, 5, 25, 400]),
    })),
    ferieperioder: periodRows(ctx, 'ferie', 3),
    sidsteDagAnsaettelsesforhold: optDate(ctx),
    tidligereModtagetTaf: optAmount(ctx),

    komprimerBeregningEfterFoersteOpgoerelse: rng.pick(jaNejEnum.options),
    beregnesUdFra: rng.pick(beregningsmetodeEnum.options),
    tafBeregningsperiodeFra: optDate(ctx),
    tafBeregningsperiodeTil: optDate(ctx),
    fravaerPerioder: periodRows(ctx, 'fravaer', 3),
    uspecificeredeFerieFridage: optWhole(ctx, [1, 0, 5, 25, 400]),
    oevrigtFravaerUdenLoen: rng.pick(jaNejEnum.options),
    oevrigeFravaersdage: optWhole(ctx, [1, 0, 10, 260, 10_000]),
    oevrigeFravaersdageBeskrivelse: optText(ctx),
    maanedsloenenUdgoer: optAmount(ctx),
    dagsloenenUdgoer: optAmount(ctx),
    angivetMaanedsloenBaseretPaa: optText(ctx),
    angivetMaanedsloenOpreguleresFraDato: optDate(ctx),
    angivetDagsloenBaseretPaa: optText(ctx),
    angivetDagsloenOpreguleresFraDato: optDate(ctx),

    sfggAnsaettelsesforhold: sfggEmploymentIds.map((ansaettelsesforholdId) => ({
      ansaettelsesforholdId,
      sfggBeregningskilde: optEnum(ctx, sygeferiegodtgoerelseBeregningskildeEnum.options),
      sfggReferenceperiodeFra: optDate(ctx),
      sfggReferenceperiodeTil: optDate(ctx),
      sfggReferenceperiodeFravaersdageUdenLoen: optWhole(ctx, [1, 0, 30, 400]),
      sfggManuelDagssats: optAmount(ctx),
      sfggManuelBeloebIHenholdTil: optText(ctx),
      sfggManuelFoerstEfterSygeloen: rng.pick(jaNejEnum.options),
      sfggSatsvalg: optEnum(ctx, sygeferiegodtgoerelseSatsvalgEnum.options),
      sfggAlleredeBetaltBeloeb: optAmount(ctx),
    })),

    loenindkomstAnsaettelsesforhold: employments,

    eoAngivetLoenLoenudvikling: {
      overenskomstId: overenskomstId(ctx),
      ...anciennitet(ctx),
      ...loenudviklingOgSatser(ctx, 'angivet'),
    },

    visBilagsnumre: rng.pick(jaNejEnum.options),
    bilagsnumreMenAfgoerelse: optText(ctx),
    bilagsnumreEetAfgoerelser: optText(ctx),
    bilagsnumreSvieSmerteDokumentation: optText(ctx),
    bilagsnumreBeregningsgrundlagTaf: optText(ctx),
    bilagsnumreLoenISygeperioden: optText(ctx),
    bilagsnumreOffentligeYdelser: optText(ctx),
    bilagsnumreOevrigeErstatningskrav: optText(ctx),
  };
};

export type GeneratedEoCase = Readonly<{
  seed: number;
  stamdata: StamdataValues;
  erstatningsopgoerelse: PersistedErstatningsopgoerelseValues;
}>;

const isoAt = (ctx: Context, days: number) => toISODateString(addDays(ctx.anchor, days));

const orderedPeriod = (ctx: Context, fromDays: number, toDays: number) => {
  const a = ctx.rng.int(fromDays, toDays);
  const b = ctx.rng.int(a, toDays);
  return { fra: isoAt(ctx, a), til: isoAt(ctx, b) };
};

/** Fortløbende, ikke-overlappende perioder inden for [fromDays, toDays]. */
const consecutivePeriods = (ctx: Context, count: number, fromDays: number, toDays: number) => {
  const span = Math.floor((toDays - fromDays) / Math.max(count, 1));
  return Array.from({ length: count }, (_, index) => {
    const start = fromDays + index * span;
    return orderedPeriod(ctx, start, start + Math.max(span - 1, 0));
  });
};

/**
 * Retter en tilfældig sag til en SAMMENHÆNGENDE sag: ordnede perioder på de steder, beregningen forventer dem
 * (beregningsperiode før skaden, TAF efter, lønrækker i beregningsperioden), gyldige satser og typer. Den slags
 * sag når hele vejen gennem motorerne; tilfældige sager stopper typisk i valideringen og rammer derfor ikke de
 * dybe grene, hvor den oprindelige runtimefejl lå. Bagefter fjerner `knockOut` enkelte felter igen.
 */
const makeCoherent = (ctx: Context, generated: GeneratedEoCase): GeneratedEoCase => {
  const { rng } = ctx;
  const eo = structuredClone(generated.erstatningsopgoerelse);
  const tafCount = rng.int(1, 3);
  const beregningsperiode = { fra: isoAt(ctx, -365), til: isoAt(ctx, -1) };
  const monthsInBeregningsperiode = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(`${addDays(ctx.anchor, -365 + index * 30 + 15)}T00:00:00Z`);
    return { month: String(month.getUTCMonth() + 1), year: String(month.getUTCFullYear()) };
  });

  eo.kravPaaTabtArbejdsfortjeneste = rng.chance(0.85) ? 'Ja' : rng.pick(jaNejSkjulEnum.options);
  // Uden en EET-kilde i sagen er «hent fra EET-siden» altid en blokerende kildefejl.
  eo.midlertidigtEetFraEetSiden = 'Nej';
  eo.opgørelseLavetDen = isoAt(ctx, rng.int(400, 900));
  eo.vedroererPeriodeFra = isoAt(ctx, 0);
  eo.vedroererPeriodeTil = isoAt(ctx, 365);
  eo.tafBeregningsperiodeFra = beregningsperiode.fra;
  eo.tafBeregningsperiodeTil = beregningsperiode.til;
  eo.tafPerioder = consecutivePeriods(ctx, tafCount, 0, 365).map((period, index) => ({
    id: `taf-${String(index)}`,
    ...period,
    loseFeriedage: rng.chance(0.5) ? undefined : rng.int(0, 3),
  }));
  eo.ferieperioder = rng.chance(0.6) ? [] : [{ id: 'ferie-0', ...orderedPeriod(ctx, 10, 60) }];
  eo.fravaerPerioder = rng.chance(0.6) ? [] : [{ id: 'fravaer-0', ...orderedPeriod(ctx, -300, -250) }];
  eo.uspecificeredeFerieFridage = rng.chance(0.6) ? undefined : rng.int(0, 5);
  eo.oevrigeFravaersdage = rng.chance(0.7) ? undefined : rng.int(0, 5);
  eo.maanedsloenenUdgoer = { kind: 'number', value: 35_000 };
  eo.dagsloenenUdgoer = { kind: 'number', value: 1_600 };
  eo.angivetMaanedsloenOpreguleresFraDato = rng.chance(0.5) ? undefined : isoAt(ctx, -30);
  eo.angivetDagsloenOpreguleresFraDato = rng.chance(0.5) ? undefined : isoAt(ctx, -30);
  eo.tidligereModtagetTaf = rng.chance(0.7) ? undefined : { kind: 'number', value: 1_000 };
  eo.sidsteDagAnsaettelsesforhold = rng.chance(0.8) ? undefined : isoAt(ctx, rng.int(30, 300));

  eo.svieSmertePerioder = consecutivePeriods(ctx, rng.int(0, 2), 0, 300).map((period, index) => ({
    id: `ss-${String(index)}`,
    ...period,
    tilstand: rng.pick(tilstandEnum.options),
  }));
  eo.oevrigeKravPerioder = eo.oevrigeKravPerioder.map((row) => ({
    ...row,
    dato: isoAt(ctx, rng.int(0, 365)),
    udgiftTil: 'Transport',
    beloeb: { kind: 'number', value: 500 },
  }));
  eo.offentligeYdelserRows = consecutivePeriods(ctx, rng.int(0, 3), 0, 365).map((period, index) => ({
    id: `oy-${String(index)}`,
    fraDato: period.fra,
    tilDato: period.til,
    ydelse: { kind: 'number', value: 15_000 },
    tillaeg: rng.chance(0.5) ? undefined : { kind: 'number', value: 500 },
    ydelsestype: rng.pick(['sygedagpenge', 'dagpenge', 'feriepenge', 'midlertidigt_eet', 'andet']),
  }));
  eo.forligAnsvarsgradProcent = rng.chance(0.7) ? undefined : rng.pick([50, 100]);
  eo.forligAnsvarsgradBroek = undefined;
  eo.forligDato = eo.forligAnsvarsgradProcent === undefined ? undefined : isoAt(ctx, rng.int(100, 365));
  const coherentLoenudvikling = <T extends { saerligFraDatoRegulering?: ISODateString | undefined;
    anciennitetstillaegDato?: ISODateString | undefined; }>(row: T): T => ({
    ...row,
    saerligFraDatoRegulering: rng.chance(0.8) ? undefined : isoAt(ctx, -rng.int(0, 200)),
    anciennitetstillaegDato: rng.chance(0.5) ? undefined : isoAt(ctx, rng.int(30, 300)),
  });
  eo.eoAngivetLoenLoenudvikling = coherentLoenudvikling(eo.eoAngivetLoenLoenudvikling);

  const aesDate = (afgoerelse: 'Ja' | 'Nej', days: number) => (afgoerelse === 'Ja' ? isoAt(ctx, days) : undefined);
  eo.menAfgoerelseDato = aesDate(eo.varigeMenAfgorelse, rng.int(100, 400));
  eo.midlertidigEETAfgoerelseDato = aesDate(eo.midlertidigtEETAfgorelse, rng.int(100, 400));
  eo.midlertidigEETVirkningsdato = aesDate(eo.midlertidigtEETAfgorelse, rng.int(60, 300));
  eo.endeligEETAfgoerelseDato = aesDate(eo.endeligtEETAfgorelse, rng.int(200, 500));
  eo.endeligEETVirkningsdato = aesDate(eo.endeligtEETAfgorelse, rng.int(100, 400));
  eo.differencekravDato = rng.chance(0.8) ? undefined : isoAt(ctx, rng.int(100, 400));

  eo.loenindkomstAnsaettelsesforhold = eo.loenindkomstAnsaettelsesforhold.map((employment) => ({
    ...coherentLoenudvikling(employment),
    ansatPaaSkadestidspunktet: rng.chance(0.85),
    sidsteArbejdsdag: employment.ansaettelsesforholdOphoert ? isoAt(ctx, rng.int(-200, 200)) : undefined,
    feriePct: rng.pick([undefined, 12, 12.5]),
    fritvalgPct: rng.pick([undefined, 0, 4, 7.43]),
    shSoPct: rng.pick([undefined, 0, 2.25]),
    pensionPct: rng.pick([undefined, 0, 8, 12]),
    loenperiode: rng.chance(0.75) ? 'maaned' as const : rng.pick(loenperiodeEnum.options),
    indtaegtsoplysningerTableData: monthsInBeregningsperiode
      .filter(() => rng.chance(0.85))
      .map(({ month, year }, index) => ({
        id: `${employment.id}-loen-${String(index)}`,
        col0_maaned: month,
        col1_maaned: year,
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: { kind: 'number' as const, value: rng.pick([28_000, 35_000.5, 41_250]) },
        col3: rng.chance(0.8) ? undefined : { kind: 'number' as const, value: 1_000 },
        col4: undefined,
        col5: undefined,
        fpFvShSoBeloeb: employment.tillaegAngivesSom === 'beloeb' ? { kind: 'number' as const, value: 3_000 } : undefined,
        pensionBeloeb: employment.tillaegAngivesSom === 'beloeb' ? { kind: 'number' as const, value: 2_000 } : undefined,
      })),
    loenudviklingManuelTableData: employment.loenudviklingManuelTableData.map((row, index) => ({
      ...row,
      dato: index === 0 ? undefined : isoAt(ctx, index * 120),
      grundloen: { kind: 'number' as const, value: 35_000 + index * 500 },
    })),
    loenudviklingManuelProcentsatsTableData: employment.loenudviklingManuelProcentsatsTableData.map((row, index) => ({
      ...row,
      dato: isoAt(ctx, (index + 1) * 120),
      procent: rng.pick([0, 1.5, 2.5]),
    })),
  }));

  const sfggOrdered = orderedPeriod(ctx, -365, -1);
  eo.sfggAnsaettelsesforhold = eo.sfggAnsaettelsesforhold.map((row) => ({
    ...row,
    sfggReferenceperiodeFra: rng.chance(0.7) ? sfggOrdered.fra : row.sfggReferenceperiodeFra,
    sfggReferenceperiodeTil: rng.chance(0.7) ? sfggOrdered.til : row.sfggReferenceperiodeTil,
  }));

  return {
    seed: generated.seed,
    stamdata: {
      ...generated.stamdata,
      skadedato: toISODateString(ctx.anchor),
      skadestype: rng.pick(skadestypeEnum.options),
      skadelidteFodselsdato: isoAt(ctx, -40 * 365),
    },
    erstatningsopgoerelse: eo,
  };
};

type Leaf = Readonly<{ path: readonly (string | number)[] }>;

const collectLeaves = (value: unknown, path: readonly (string | number)[], into: Leaf[]): void => {
  if (Array.isArray(value)) {
    into.push({ path });
    value.forEach((item, index) => collectLeaves(item, [...path, index], into));
    return;
  }
  if (value !== null && typeof value === 'object' && !('kind' in value)) {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'id' || key === 'ansaettelsesforholdId') continue;
      collectLeaves(child, [...path, key], into);
    }
    return;
  }
  if (value !== undefined) into.push({ path });
};

const clearAt = (root: Record<string, unknown>, path: readonly (string | number)[]) => {
  const parent = path.slice(0, -1).reduce<unknown>((node, key) => (node as Record<string | number, unknown>)[key], root);
  const last = path[path.length - 1];
  if (last === undefined) return;
  if (Array.isArray(parent) && typeof last === 'number') {
    parent.splice(last, 1);
    return;
  }
  const record = parent as Record<string, unknown>;
  const current = record[String(last)];
  if (Array.isArray(current)) record[String(last)] = [];
  else if (typeof current === 'string' && /^col\d_(maaned|uge)$|^ydelsestype$/.test(String(last))) record[String(last)] = '';
  else delete record[String(last)];
};

/**
 * Den oprindelige fejlklasse: en ellers udfyldt sag, hvor ét eller nogle få felter står tomme. Felter, hvis
 * schema ikke tillader tom (fx påkrævede valg med default), springes over af kalderen gennem schemavalideringen.
 */
const knockOut = (ctx: Context, generated: GeneratedEoCase, count: number): GeneratedEoCase => {
  const stamdata = structuredClone(generated.stamdata) as Record<string, unknown>;
  const eo = structuredClone(generated.erstatningsopgoerelse) as unknown as Record<string, unknown>;
  for (let index = 0; index < count; index += 1) {
    const target = ctx.rng.chance(0.1) ? stamdata : eo;
    const leaves: Leaf[] = [];
    collectLeaves(target, [], leaves);
    if (leaves.length === 0) continue;
    clearAt(target, ctx.rng.pick(leaves).path);
  }
  return {
    seed: generated.seed,
    stamdata: stamdata as StamdataValues,
    erstatningsopgoerelse: eo as unknown as PersistedErstatningsopgoerelseValues,
  };
};

export type EoCaseMode = 'tilfaeldig' | 'sammenhaengende';

/**
 * Én sag pr. seed. I tilfældig tilstand varierer tomraten pr. sag, så både næsten tomme og næsten fulde sager
 * rammes. I sammenhængende tilstand rettes sagen til en beregnelig sag, hvorefter 0-3 felter tømmes igen – den
 * oprindelige fejlklasse (beregningsgrundlag og TAF udfyldt, andre felter tomme).
 */
export const generateEoCase = (seed: number, mode: EoCaseMode = 'tilfaeldig'): GeneratedEoCase => {
  const rng = createRng(seed);
  const ctx: Context = {
    rng,
    anchor: rng.pick(SKADEDATO_ANKRE),
    emptyRate: mode === 'tilfaeldig' ? rng.pick([0.05, 0.2, 0.4, 0.7, 0.9]) : rng.pick([0.05, 0.2, 0.4]),
    inBounds: mode === 'sammenhaengende',
  };
  const random: GeneratedEoCase = {
    seed,
    stamdata: generateStamdata(ctx),
    erstatningsopgoerelse: generateErstatningsopgoerelse(ctx),
  };
  if (mode === 'tilfaeldig') return random;
  const coherent = makeCoherent(ctx, random);
  const candidate = knockOut(ctx, coherent, rng.pick([0, 1, 1, 2, 3]));
  // Påkrævede valg kan ikke tømmes i feltmotoren. Bevar grundsagen, hvis netop et sådant felt blev valgt.
  return persistedErstatningsopgoerelseSchema.safeParse(candidate.erstatningsopgoerelse).success
    && stamdataSchema.safeParse(candidate.stamdata).success ? candidate : coherent;
};
