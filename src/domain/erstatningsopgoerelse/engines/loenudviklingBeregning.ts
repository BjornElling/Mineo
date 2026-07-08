import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isISODateString } from '../../../types/branded';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { roundReguleringDeltaPct } from './reguleringFormulaUtils';
import { buildBeregningsperiodeRange, buildIncomeForRanges, type IncomePeriodResult, type IsoRange } from '../helpers/indtaegtPerioder';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { beregnArbejdsdageOgMaaneder } from './arbejdsdageMaaneder';
import { getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde, type LoenudviklingSource } from '../helpers/angivetLoenHelpers';
import { buildTafArbejdsdageSetFromRows } from './tafDaySets';
import { hasIndtastetLoenoplysninger } from '../helpers/loenoplysningerInput';
import type { Calculable, IndkomstSkadestidspunktModel, LoenudviklingModel, LoenudviklingSegment, MoneyOre } from '../shared/eoTypes';
import { asCalculable, clampMoneyOreToZero, ensureMoneyOre, fromOre, roundKroner, toOre } from '../shared/eoMoney';
import { resolveAnvendtReguleringsdato as resolveAnvendtReguleringsdatoShared } from '../helpers/eoSharedUtils';
import { buildKlLoenaftalerReguleretLoenResolver } from './klLoenaftalerReguleretLoen';
import type { ReguleringForloeb } from './reguleringForloeb';
import { assertUniform } from './regulering/reguleringFormPrimitives';
import { FORM_REGISTRY, byggReguleringsResultat } from './regulering/reguleringFormRegistry';
import type { FormKonsoliderContext, ReguleringResultat, ResolvedStrategi } from './regulering/reguleringForm';

// =============================================================================
// INVARIANT-NOTE: Alle throw new Error() i denne fil er defensive invarianter.
// De kan kun nås hvis erstatningsopgoerelseValidator har fejlet i at afvise
// input, der burde have blokeret beregningen. Under normal udførelse er samtlige
// throw-stier dækket af validator-/preflight-checks i snapshot-orchestreringen.
// Uventede throws fanges af computeEoSnapshot og resulterer i fail_closed med
// failClosedReason: 'runtime_exception'. Se eo-snapshot-contract.md §3.3.
// =============================================================================

export const resolveLoenudviklingRows = (
  values: ErstatningsopgoerelseValues
): ReadonlyArray<LoenudviklingSource> => {
  return resolveLoenudviklingKilde(values);
};

export const segmentAmountOre = (baseLoenKronerRounded: number, quantity: number, deltaPct: number): MoneyOre => {
  const amountKroner = baseLoenKronerRounded * quantity * (1 + deltaPct / 100);
  return toOre(roundKroner(amountKroner));
};

export const buildTafArbejdsdageSet = (
  values: ErstatningsopgoerelseValues,
  tafRanges: readonly IsoRange[]
): ReadonlySet<ISODateString> => {
  return buildTafArbejdsdageSetFromRows(values.tafPerioder ?? [], values.ferieperioder ?? [], {
    authoritativeRanges: tafRanges,
  });
};

// Scanner hele sættet pr. kald (O(sæt)). Kaldes i segment-løkker, men sættet er præbygget (ikke
// gen-materialiseret pr. segment, jf. docs/architecture/date-interval-performance-architecture.md), og
// segmenter stammer fra regulerings-brudpunkter (få pr. år) — en amortiseret binær-søgnings-tæller
// ville kræve threading gennem alle kaldsteder for marginal gevinst og er bevidst undladt.
export const countTafArbejdsdageInRange = (arbejdsdage: ReadonlySet<ISODateString>, fra: ISODateString, til: ISODateString): number => {
  let count = 0;
  for (const iso of arbejdsdage) {
    if (iso >= fra && iso <= til) {
      count += 1;
    }
  }
  return count;
};

type AnvendtReguleringsdatoInput = Readonly<{ saerligFraDatoRegulering?: string }>;

// Reguleringsformen "er" defineret ét sted pr. form (FORM_REGISTRY / engines/regulering/), der
// samler konsolidering + segment-byggeri + dæknings-interval. Orkestratoren her udregner de
// fælles, form-agnostiske værdier én gang og dispatcher til formens `konsolider`; de per-form
// grene (uniformitet, konsolideret-konstruktion, segment-byggeri) bor i form-modulet (jf. R1).
const resolveReguleringsStrategi = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues,
  tafBeregningsenhed: TafBeregningsenhed,
  options: Readonly<{ tafRanges: readonly IsoRange[] }>
): ResolvedStrategi => {
  const ansaettelser = resolveLoenudviklingRows(values);
  const alleIngen = ansaettelser.length > 0 && ansaettelser.every((af) => af.loenudviklingBeregningsgrundlag === 'Ingen');
  if (alleIngen) return { strategi: 'ingen', label: 'Ingen', konsolideret: null };

  const active = ansaettelser.filter((af) => af.loenudviklingBeregningsgrundlag && af.loenudviklingBeregningsgrundlag !== 'Ingen');
  if (active.length === 0) {
    throw new Error('Loenudviklingsstrategi er ikke valgt');
  }
  const angivetLoen =
    values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn';

  assertUniform(active, (af) => af.loenudviklingBeregningsgrundlag ?? '', 'beregningsgrundlag');
  const basis = active[0].loenudviklingBeregningsgrundlag;
  if (!basis) {
    throw new Error('Loenudviklingsstrategi er ikke valgt');
  }

  const kraeverFeriePctVedBeregningsperiode =
    values.beregnesUdFra === 'Beregningsperiode'
    && active.some((af) => af.tillaegAngivesSom !== 'beloeb' && hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []));

  const activeMedLoenoplysninger = active.filter((af) => hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []));
  const activeMedSynligeSatserOgLoenoplysninger = activeMedLoenoplysninger.filter((af) => af.tillaegAngivesSom !== 'beloeb');

  const skadedato = isISODateString(stamdataValues.skadedato) ? stamdataValues.skadedato : undefined;
  const anvendtReguleringsdato = resolveAnvendtReguleringsdato(
    values,
    { saerligFraDatoRegulering: active[0].saerligFraDatoRegulering },
    skadedato
  );

  const ctx: FormKonsoliderContext = {
    active,
    angivetLoen,
    anvendtReguleringsdato,
    tafRanges: options.tafRanges,
    tafBeregningsenhed,
    kraeverFeriePctVedBeregningsperiode,
    activeMedSynligeSatserOgLoenoplysninger,
  };
  return FORM_REGISTRY[basis].konsolider(ctx);
};

export const buildLoenudviklingModel = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues,
  tafBeregningsenhed: TafBeregningsenhed,
  indkomstSkadestidspunkt: IndkomstSkadestidspunktModel | null,
  options: Readonly<{
    tafRanges: readonly IsoRange[];
    incomeForBeregningsperiode?: IncomePeriodResult | null;
  }>
): LoenudviklingModel => {
  const tafRanges = options.tafRanges;
  const buildFromStrategiAndBase = (
    strategiData: ResolvedStrategi,
    baseLoen: number
  ): Readonly<{
    loenudviklingLabel: string;
    beregnedeSegmenter: readonly LoenudviklingSegment[];
    loenudviklingTotal: Calculable<MoneyOre>;
    forloeb?: ReguleringForloeb;
  }> => {
    if (!Number.isFinite(baseLoen) || baseLoen <= 0 || tafRanges.length === 0) {
      throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
    }

    const baseLoenRounded = roundKroner(baseLoen);
    const baseLoenOre = toOre(baseLoenRounded);
    const tafArbejdageSet = tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
      ? buildTafArbejdsdageSet(values, tafRanges)
      : null;
    const loenudviklingLabel = strategiData.label;

    // Ét dispatch gennem registeret: formen bygger sine deltaPct-segmenter OG sit autoritative
    // visnings-forløb (R2) fra samme kilde-entries i ét kald. "Ingen" bygges direkte her (zero-
    // delta med fuld basisløn) og når aldrig registeret. Forløbet emitteres på modellen, så
    // præsentation/inspektion formatterer samme entries som motoren afleder deltaPct fra (ingen
    // re-derivation → ingen drift). Former uden migreret forløb bærer forloeb = undefined.
    const { segmenter: loenreguleringssegmenter, forloeb } = ((): ReguleringResultat => {
      if (strategiData.strategi === 'ingen') {
        return { segmenter: tafRanges.map((range) => ({ ...range, deltaPct: 0 })) };
      }
      const konsolideret = strategiData.konsolideret;
      if (!konsolideret) {
        throw new Error('Loenudvikling kan ikke beregnes: strategi mangler');
      }
      return byggReguleringsResultat(konsolideret);
    })();

    if (loenreguleringssegmenter.length === 0) {
      throw new Error('Loenudvikling kan ikke beregnes: ingen reguleringssegmenter');
    }

    // KL-lønaftaler regulerer trinvist med afrunding på hvert trin (jf. klLoenaftalerReguleretLoen.ts
    // og docs/domain/taf/kl-loenaftaler-regulering.md), modsat det enkelt-indeksforhold de
    // øvrige modeller bruger. For KL-lønaftaler erstattes segmentets deltaPct derfor med den akkumulerede
    // regulering afledt af den kæde-opregulerede, afrundede løn — i fuld præcision, så
    // TAF-beløbet bliver præcis afrund(løn × antal). deltaPct holdes som intern repræsentation
    // (korrekt for tafPerYearDerived og sygeferiegodtgørelse); den vises aldrig som akkumuleret.
    const konsolideretForBase = strategiData.konsolideret;
    const klLoenaftalerReguleretLoenResolver =
      konsolideretForBase?.strategi === 'klLoenaftaler' && konsolideretForBase.reguleringsdato
        ? buildKlLoenaftalerReguleretLoenResolver(baseLoenRounded, konsolideretForBase.reguleringsdato)
        : null;

    const beregnedeSegmenter: Array<LoenudviklingModel['beregnedeSegmenter'][number]> = [];
    for (const segment of loenreguleringssegmenter) {
      const roundedDeltaPct = klLoenaftalerReguleretLoenResolver
        ? klLoenaftalerReguleretLoenResolver.deltaPctAt(segment.fra)
        : roundReguleringDeltaPct(segment.deltaPct);
      // KL-lønaftaler: den opregulerede, afrundede enhedsløn for perioden — bæres med på segmentet,
      // så indkomst-linjerne kan vise "antal á reguleret løn = beløb" uden faktor-tekst.
      const klLoenaftalerReguleretLoenOre = klLoenaftalerReguleretLoenResolver
        ? toOre(klLoenaftalerReguleretLoenResolver.loenAt(segment.fra))
        : undefined;
      if (tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER) {
        const maanederStats = beregnArbejdsdageOgMaaneder(
          segment.fra,
          segment.til,
          new Set<ISODateString>(),
          new Set<ISODateString>()
        );
        const maanederRaw = maanederStats.maaneder;
        if (!Number.isFinite(maanederRaw) || maanederRaw <= 0) {
          throw new Error('Loenudvikling kan ikke beregnes: ugyldigt maanedssegment');
        }
        beregnedeSegmenter.push({
          kind: 'maaneder',
          fra: segment.fra,
          til: segment.til,
          maaneder: maanederRaw,
          maanedsloenOre: baseLoenOre,
          deltaPct: roundedDeltaPct,
          amountOre: segmentAmountOre(baseLoenRounded, maanederRaw, roundedDeltaPct),
          ...(klLoenaftalerReguleretLoenOre !== undefined ? { reguleretLoenOre: klLoenaftalerReguleretLoenOre } : {}),
        });
      } else {
        if (!tafArbejdageSet) {
          throw new Error('Loenudvikling kan ikke beregnes: arbejdsdagegrundlag mangler');
        }
        const arbejdsdage = countTafArbejdsdageInRange(tafArbejdageSet, segment.fra, segment.til);
        if (!Number.isFinite(arbejdsdage)) {
          throw new Error('Loenudvikling kan ikke beregnes: ugyldigt arbejdsdagesegment');
        }
        if (arbejdsdage <= 0) continue;
        beregnedeSegmenter.push({
          kind: 'arbejdsdage',
          fra: segment.fra,
          til: segment.til,
          arbejdsdage,
          dagsloenOre: baseLoenOre,
          deltaPct: roundedDeltaPct,
          amountOre: segmentAmountOre(baseLoenRounded, arbejdsdage, roundedDeltaPct),
          ...(klLoenaftalerReguleretLoenOre !== undefined ? { reguleretLoenOre: klLoenaftalerReguleretLoenOre } : {}),
        });
      }
    }

    if (beregnedeSegmenter.length === 0) {
      return {
        loenudviklingLabel,
        loenudviklingTotal: asCalculable(ensureMoneyOre(0)),
        beregnedeSegmenter,
        forloeb,
      };
    }

    const totalOre = clampMoneyOreToZero(
      ensureMoneyOre(beregnedeSegmenter.reduce((sum, segment) => sum + segment.amountOre, 0))
    );
    return { loenudviklingLabel, loenudviklingTotal: asCalculable(totalOre), beregnedeSegmenter, forloeb };
  };

  const buildPerAnsaettelseModel = (): LoenudviklingModel => {
    const beregningsperiodeRange = buildBeregningsperiodeRange(values);
    if (!beregningsperiodeRange) {
      throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
    }
    const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
    const strategiDataByIndex = ansaettelser.map((ansaettelsesforhold) => resolveReguleringsStrategi({
      ...values,
      loenindkomstAnsaettelsesforhold: [ansaettelsesforhold],
    }, stamdataValues, tafBeregningsenhed, { tafRanges }));
    const income =
      options.incomeForBeregningsperiode
      ?? buildIncomeForRanges(values, [beregningsperiodeRange], undefined, stamdataValues.skadedato);
    if (income.employers.length === 0) {
      const alleIngen = strategiDataByIndex.every((strategiData) => strategiData.strategi === 'ingen');
      if (alleIngen || income.benefits.length > 0) {
        // Arbejdsdage-grundlaget afhænger kun af (values, tafRanges) og er dermed loop-invariant.
        // Byg det ÉN gang frem for pr. range — ellers gen-materialiseres hele arbejdsdage-sættet
        // (som selv itererer alle ranges) for hver eneste range = O(ranges² × dage).
        const ingenArbejdsdageSet =
          tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER
            ? null
            : buildTafArbejdsdageSet(values, tafRanges);
        const beregnedeSegmenter = tafRanges.map<LoenudviklingSegment>((range) => (
          tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER || ingenArbejdsdageSet === null
            ? {
              kind: 'maaneder',
              fra: range.fra,
              til: range.til,
              maaneder: beregnArbejdsdageOgMaaneder(
                range.fra,
                range.til,
                new Set<ISODateString>(),
                new Set<ISODateString>()
              ).maaneder,
              maanedsloenOre: 0,
              deltaPct: 0,
              amountOre: 0,
            }
            : {
              kind: 'arbejdsdage',
              fra: range.fra,
              til: range.til,
              arbejdsdage: countTafArbejdsdageInRange(
                ingenArbejdsdageSet,
                range.fra,
                range.til
              ),
              dagsloenOre: 0,
              deltaPct: 0,
              amountOre: 0,
            }
        ));
        return {
          loenudviklingLabel: 'Ingen',
          loenudviklingTotal: asCalculable(0),
          beregningsenhed: tafBeregningsenhed,
          beregnedeSegmenter,
          perAnsaettelse: [],
        };
      }
      throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
    }

    const divisor = tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER
      ? indkomstSkadestidspunkt?.maaneder
      : indkomstSkadestidspunkt?.arbejdsdage;
    if (!Number.isFinite(divisor) || !divisor || divisor <= 0) {
      throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
    }

    const perAnsaettelse: Array<LoenudviklingModel['perAnsaettelse'][number]> = [];

    for (const employer of income.employers) {
      const ansaettelsesforhold = ansaettelser[employer.index];
      if (!ansaettelsesforhold) continue;
      const baseLoen = employer.amount / divisor;
      const strategiData = strategiDataByIndex[employer.index];
      if (!strategiData) continue;
      const modelForAf = buildFromStrategiAndBase(strategiData, baseLoen);
      const ansaettelsesforholdNavn = employer.name !== ''
        ? employer.name
        : (ansaettelsesforhold.navnPaaArbejdssted?.trim() || 'Arbejdssted');

      perAnsaettelse.push({
        ansaettelsesforholdId: ansaettelsesforhold.id,
        ansaettelsesforholdNavn,
        loenudviklingLabel: modelForAf.loenudviklingLabel,
        loenudviklingTotal: modelForAf.loenudviklingTotal,
        beregnedeSegmenter: modelForAf.beregnedeSegmenter,
        forloeb: modelForAf.forloeb,
      });
    }

    if (perAnsaettelse.length === 0) {
      throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
    }

    const beregnedeSegmenter = perAnsaettelse
      .flatMap((entry) => entry.beregnedeSegmenter)
      .slice()
      .sort((a, b) => (a.fra < b.fra ? -1 : a.fra > b.fra ? 1 : 0));
    const totalOre = clampMoneyOreToZero(
      ensureMoneyOre(
        perAnsaettelse.reduce((sum, entry) => {
          if (entry.loenudviklingTotal.status !== 'ok') {
            throw new Error('Loenudvikling kan ikke beregnes for den valgte opsætning.');
          }
          return sum + entry.loenudviklingTotal.value;
        }, 0)
      )
    );
    const labels = Array.from(new Set(perAnsaettelse.map((entry) => entry.loenudviklingLabel)));
    const loenudviklingLabel = labels.length === 1 ? labels[0] : 'Flere reguleringstyper';

    return {
      loenudviklingLabel,
      loenudviklingTotal: asCalculable(totalOre),
      beregningsenhed: tafBeregningsenhed,
      beregnedeSegmenter,
      perAnsaettelse,
    };
  };

  if (values.beregnesUdFra === 'Beregningsperiode') {
    return buildPerAnsaettelseModel();
  }

  const strategiData = resolveReguleringsStrategi(values, stamdataValues, tafBeregningsenhed, { tafRanges });
  const maanedsloenBase = tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER
    ? resolveMaanedsloenBase(values, indkomstSkadestidspunkt)
    : null;
  const dagsloenBase = tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
    ? resolveDagsloenBase(values, indkomstSkadestidspunkt)
    : null;
  const baseLoen = tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? maanedsloenBase : dagsloenBase;
  if (typeof baseLoen !== 'number') {
    throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
  }
  const model = buildFromStrategiAndBase(strategiData, baseLoen);
  return {
    loenudviklingLabel: model.loenudviklingLabel,
    loenudviklingTotal: model.loenudviklingTotal,
    beregningsenhed: tafBeregningsenhed,
    beregnedeSegmenter: model.beregnedeSegmenter,
    forloeb: model.forloeb,
    perAnsaettelse: [],
  };
};

const resolveAnvendtReguleringsdato = (
  eoValues: ErstatningsopgoerelseValues,
  af: AnvendtReguleringsdatoInput | undefined,
  skadedato: ISODateString | undefined
): ISODateString | undefined => resolveAnvendtReguleringsdatoShared({
  beregnesUdFra: eoValues.beregnesUdFra,
  angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(eoValues),
  saerligFraDatoRegulering: isISODateString(af?.saerligFraDatoRegulering) ? af.saerligFraDatoRegulering : undefined,
  beregningsperiodeTil: eoValues.tafBeregningsperiodeTil,
  skadedato,
});

const resolveMaanedsloenBase = (
  eoValues: ErstatningsopgoerelseValues,
  indkomstSkadestidspunkt: IndkomstSkadestidspunktModel | null
): number | null => {
  if (eoValues.beregnesUdFra === 'Angivet månedsløn') {
    const value = amountValueToNumber(eoValues.maanedsloenenUdgoer);
    return value !== undefined ? value : null;
  }
  if (eoValues.beregnesUdFra !== 'Beregningsperiode') return null;
  if (!indkomstSkadestidspunkt) return null;
  if (indkomstSkadestidspunkt.maanedsloen.status !== 'ok') return null;
  return fromOre(indkomstSkadestidspunkt.maanedsloen.value);
};

const resolveDagsloenBase = (
  eoValues: ErstatningsopgoerelseValues,
  indkomstSkadestidspunkt: IndkomstSkadestidspunktModel | null
): number | null => {
  if (eoValues.beregnesUdFra === 'Angivet dagsløn') {
    const value = amountValueToNumber(eoValues.dagsloenenUdgoer);
    return value !== undefined ? value : null;
  }
  if (eoValues.beregnesUdFra !== 'Beregningsperiode') return null;
  if (!indkomstSkadestidspunkt) return null;
  if (indkomstSkadestidspunkt.dagsloen.status !== 'ok') return null;
  return fromOre(indkomstSkadestidspunkt.dagsloen.value);
};
