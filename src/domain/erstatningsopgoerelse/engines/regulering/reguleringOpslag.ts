import type { ISODateString } from '../../../../types/branded';
import { fromKroner, type MoneyOre } from '../../../money/money';
import type { IsoRange } from '../../helpers/indtaegtPerioder';
import { roundReguleringDeltaPct } from '../reguleringFormulaUtils';
import { buildKlLoenaftalerReguleretLoenResolver } from '../klLoenaftalerReguleretLoen';
import type { ReguleringForloeb } from '../reguleringForloeb';
import { buildReguleringsbevis, type Reguleringsbevis } from './reguleringsbevis';
import { byggReguleringsResultat } from './reguleringFormRegistry';
import type { KildeReguleringsInterval, LoenreguleringsSegment, ResolvedStrategi } from './reguleringForm';

// =============================================================================
// Reguleringsopslag pr. dato (AP2 i docs/review/regulering-taf-gennemgang-2026-10-13.md).
//
// Ét opslag pr. ansættelsesforhold, `regulering(d)`, som TAF-segmenterne og sygeferiegodtgørelsen
// (SFGG) begge læser. Opslaget er bygget af reguleringsformens egen evaluering (FORM_REGISTRY) og
// er uafhængigt af TAF-arbejdsdage: TAF filtrerer først bagefter de segmenter fra, der har mængde 0.
// Før lå SFGG's regulering i netop de overlevende TAF-segmenter, så en SFGG-dag i et segment uden
// TAF-arbejdsdage (fx fyldt af løse feriedage) fik basissatsen uden regulering og uden fejl (fund A4).
//
// Udfaldet er altid typed: en værdi med reguleringsbeviset, et udtrykkeligt «ingen regulering» med
// grund, eller «uden for dækning». Der findes ingen stille basissats og intet tavst 0 %.
// =============================================================================

/** KL-lønaftalers kædeløn på datoen (den trinvist afrundede løn) og basislønnen, den er regnet fra. */
export type KlKaedeloen = Readonly<{ basisLoenOre: MoneyOre; reguleretLoenOre: MoneyOre }>;

/**
 * Hvorfor en dato ikke reguleres.
 * - `ikke-valgt`: reguleringsformen er «Ingen» – et lovligt fravalg, ikke en fejl.
 * - `intet-loengrundlag`: ved «Beregningsperiode» uden lønindkomst i perioden findes ingen løn at regulere.
 */
export type IngenReguleringGrund = 'ikke-valgt' | 'intet-loengrundlag';

/** Reguleringen på en dato, opslaget dækker. `regulering.appliedDeltaPct` er den anvendte regulering. */
export type ReguleringsVaerdi =
  | Readonly<{ udfald: 'reguleret'; regulering: Reguleringsbevis; klKaedeloen?: KlKaedeloen }>
  | Readonly<{
    udfald: 'ingen-regulering';
    grund: IngenReguleringGrund;
    regulering: Reguleringsbevis;
    klKaedeloen?: KlKaedeloen;
  }>;

export type ReguleringPaaDato =
  | ReguleringsVaerdi
  | Readonly<{ udfald: 'uden-for-daekning'; dato: ISODateString; daekning: KildeReguleringsInterval }>;

export type ReguleringOpslagSegment = Readonly<IsoRange & { vaerdi: ReguleringsVaerdi }>;

export type ReguleringOpslag = Readonly<{
  /** Manuelle former har intet niveau før denne dato; SFGG bruger basisniveau for en tidligere reference. */
  manuelBasisDato?: ISODateString;
  /**
   * Reguleringsforløbet i TAF-perioden: ét segment pr. reguleringstrin, også trin uden TAF-arbejdsdage.
   * Segmentstarterne er reguleringens brudpunkter; TAF-beløbet og SFGG-segmenteringen bygger på dem.
   */
  segmenter: readonly ReguleringOpslagSegment[];
  /** Formens autoritative kildeserie (kun former med en selvstændig serie). */
  forloeb?: ReguleringForloeb;
  /**
   * `regulering(d)` for en vilkårlig dato. I TAF-perioden er svaret TAF-segmentets værdi. Uden for den
   * evalueres formen på datoen, når datoen ligger i kildens dækning; ellers `uden-for-daekning`.
   */
  paaDato: (dato: ISODateString) => ReguleringPaaDato;
}>;

const UREGULERET_BEVIS: Reguleringsbevis = buildReguleringsbevis(1, 1, { kind: 'ingen' });

const findSegment = (
  segmenter: readonly ReguleringOpslagSegment[],
  dato: ISODateString
): ReguleringOpslagSegment | undefined => segmenter.find((segment) => dato >= segment.fra && dato <= segment.til);

/**
 * Opslag uden regulering: «Ingen» eller intet lønmateriale at regulere. Gælder for enhver dato, fordi et
 * fravalg ikke har en kilde, der kan slippe op.
 */
export const buildUreguleretOpslag = (
  tafRanges: readonly IsoRange[],
  grund: IngenReguleringGrund
): ReguleringOpslag => {
  const vaerdi: ReguleringsVaerdi = { udfald: 'ingen-regulering', grund, regulering: UREGULERET_BEVIS };
  return {
    segmenter: tafRanges.map((range) => ({ fra: range.fra, til: range.til, vaerdi })),
    paaDato: () => vaerdi,
  };
};

export type ReguleringOpslagInput = Readonly<{
  strategi: ResolvedStrategi;
  /** Den afrundede basisløn. Kun KL-lønaftalers kædeløn afhænger af den; de øvrige former er forhold. */
  baseLoenRounded: number;
  tafRanges: readonly IsoRange[];
  /** Kildens dækning (formens `coverageInterval`); `undefined` for de manuelle former. */
  kildeDaekning: KildeReguleringsInterval | undefined;
}>;

export const buildReguleringOpslag = (input: ReguleringOpslagInput): ReguleringOpslag => {
  const { strategi, baseLoenRounded, tafRanges } = input;
  if (strategi.strategi === 'ingen') {
    return buildUreguleretOpslag(tafRanges, 'ikke-valgt');
  }
  const konsolideret = strategi.konsolideret;
  if (!konsolideret) {
    throw new Error('Loenudvikling kan ikke beregnes: strategi mangler');
  }
  const reguleringsdato = konsolideret.reguleringsdato;
  if ((konsolideret.strategi === 'manual' || konsolideret.strategi === 'manualProcentsats')
    && reguleringsdato && tafRanges.some((range) => range.fra < reguleringsdato)) {
    throw new Error('Loenudvikling kan ikke beregnes: manuel regulering har ingen værdier før reguleringsdatoen');
  }

  const { segmenter: formSegmenter, forloeb } = byggReguleringsResultat(konsolideret, tafRanges);
  if (formSegmenter.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen reguleringssegmenter');
  }

  // KL-lønaftaler regulerer trinvist med afrunding på hvert trin (jf. klLoenaftalerReguleretLoen.ts
  // og docs/domain/taf/kl-loenaftaler-regulering.md), modsat det enkelt-indeksforhold de øvrige former
  // bruger. Formens segmenter ejer kun brudpunkterne; reguleringen sættes her af kædeløn ÷ basisløn i
  // fuld præcision, så TAF-beløbet bliver præcis afrund(løn × antal). Den vises aldrig som akkumuleret.
  const kl = konsolideret.strategi === 'klLoenaftaler' && konsolideret.reguleringsdato
    ? {
      resolver: buildKlLoenaftalerReguleretLoenResolver(baseLoenRounded, konsolideret.reguleringsdato),
      reguleringsdato: konsolideret.reguleringsdato,
    }
    : null;

  // Én evaluering pr. formsegment, delt af TAF-perioden og opslag uden for den.
  const evaluer = (segment: LoenreguleringsSegment): ReguleringsVaerdi => {
    if (kl) {
      const loen = kl.resolver.loenAt(segment.fra);
      const regulering: Reguleringsbevis = {
        ...buildReguleringsbevis(baseLoenRounded, loen, {
          kind: 'klLoenaftaler', referenceDate: kl.reguleringsdato,
          periodRateDate: segment.fra,
          klTrin: kl.resolver.trin.filter((trin) => trin.retning === 'frem'
            ? segment.fra >= kl.reguleringsdato && trin.dato <= segment.fra
            : segment.fra < kl.reguleringsdato && trin.dato > segment.fra),
          periodePct: segment.fra > kl.reguleringsdato && forloeb?.kind === 'klLoenaftaler'
            ? forloeb.entries.find((entry) => entry.startIso === segment.fra)?.reguleringsPct
            : undefined,
        }),
        appliedDeltaPct: kl.resolver.deltaPctAt(segment.fra),
      };
      const klKaedeloen: KlKaedeloen = { basisLoenOre: fromKroner(baseLoenRounded), reguleretLoenOre: fromKroner(loen) };
      return { udfald: 'reguleret', regulering, klKaedeloen };
    }
    const regulering: Reguleringsbevis = { ...segment.regulering, appliedDeltaPct: roundReguleringDeltaPct(segment.deltaPct) };
    return { udfald: 'reguleret', regulering };
  };

  const segmenter: ReguleringOpslagSegment[] = formSegmenter.map((segment) => ({
    fra: segment.fra,
    til: segment.til,
    vaerdi: evaluer(segment),
  }));

  // De manuelle former har intet kildeinterval; brugerens rækker begynder på reguleringsdatoen, og
  // de har ingen værdier før den.
  const daekning: KildeReguleringsInterval = input.kildeDaekning ?? { fraIso: konsolideret.reguleringsdato };
  const tafSlut = tafRanges.reduce<ISODateString | undefined>(
    (senest, range) => !senest || range.til > senest ? range.til : senest, undefined,
  );
  // TAF-gaten afgør, om sidste kendte niveau må fremføres efter kildens udløb.
  // En SFGG-reference inden samme godkendte slutdato skal bruge det samme niveau,
  // også hvis referenceperioden ligger før første TAF-dag.
  const opslagTil = daekning.tilIso && tafSlut && tafSlut > daekning.tilIso ? tafSlut : daekning.tilIso;
  const udenforTafCache = new Map<ISODateString, ReguleringPaaDato>();

  // Uden for TAF-perioden er der ingen dækningsgate, der har taget stilling til datoen (rækkerne
  // «Reguleringsværdi på …»/«start-dato for TAF» vurderer kun TAF-perioden og reguleringsdatoen).
  // Opslaget svarer derfor kun inden for kildens dækning og er ellers udtrykkeligt uden for dækning.
  // I TAF-perioden gælder TAF-segmentets værdi, så TAF og SFGG aldrig kan afvige for samme dato.
  const evaluerUdenforTaf = (dato: ISODateString): ReguleringPaaDato => {
    if ((daekning.fraIso && dato < daekning.fraIso) || (opslagTil && dato > opslagTil)) {
      return { udfald: 'uden-for-daekning', dato, daekning };
    }
    const [segment] = byggReguleringsResultat(konsolideret, [{ fra: dato, til: dato }]).segmenter;
    if (!segment) {
      throw new Error('Intern fejl: reguleringsformen gav intet segment for datoen');
    }
    return evaluer(segment);
  };

  return {
    manuelBasisDato: konsolideret.strategi === 'manual' || konsolideret.strategi === 'manualProcentsats'
      ? konsolideret.reguleringsdato
      : undefined,
    segmenter,
    forloeb,
    paaDato: (dato) => {
      const segment = findSegment(segmenter, dato);
      if (segment) return segment.vaerdi;
      const cached = udenforTafCache.get(dato);
      if (cached) return cached;
      const result = evaluerUdenforTaf(dato);
      udenforTafCache.set(dato, result);
      return result;
    },
  };
};

/**
 * Fail-closed opslag for en dato, som en valgt beregning faktisk kræver. Et lovligt fravalg («Ingen»)
 * er en værdi og passerer; kun en dato uden for kildens dækning er en fejl.
 */
export const kraevReguleringPaaDato = (opslag: ReguleringOpslag, dato: ISODateString): ReguleringsVaerdi => {
  const resultat = opslag.paaDato(dato);
  if (resultat.udfald === 'uden-for-daekning') {
    throw new Error(
      `Regulering kan ikke beregnes for ${dato}: datoen ligger uden for reguleringskildens dækning `
      + `(${resultat.daekning.fraIso ?? '–'} til ${resultat.daekning.tilIso ?? '–'})`
    );
  }
  return resultat;
};
