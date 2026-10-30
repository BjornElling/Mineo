import type { StamdataValues } from '../../../schemas/formSchemas';
import type { TafCalculationValues } from './tafCalculationInput';
import type { ISODateString } from '../../../types/branded';
import { isISODateString } from '../../../types/branded';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { buildBeregningsperiodeRange, buildIncomeForRanges, resolveAnsaettelsesforholdNavn, type IncomePeriodResult, type IsoRange } from '../helpers/indtaegtPerioder';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { beregnArbejdsdageOgMaaneder } from './arbejdsdageMaaneder';
import { resolveBeregningsperiodeEmployerAtReguleringsdato } from './indkomstSkadestidspunktBeregning';
import { getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde, type LoenudviklingSource } from '../helpers/angivetLoenHelpers';
import { buildTafArbejdsdageSetFromRows } from './tafDaySets';
import { hasIndtastetLoenoplysninger } from '../../standardLoen/loenoplysningerInput';
import type { Calculable, IndkomstSkadestidspunktModel, LoenudviklingModel, LoenudviklingSegment } from '../shared/eoTypes';
import type { MoneyOre } from '../../money/money';
import { clampMoneyOreToZero, fromKroner, roundKroner, sumMoneyOre, toKroner, zeroMoneyOre } from '../../money/money';
import { asCalculable } from '../shared/eoTypes';
import { resolveAnvendtReguleringsdato as resolveAnvendtReguleringsdatoShared } from '../helpers/eoSharedUtils';
import type { ReguleringForloeb } from './reguleringForloeb';
import { assertUniform } from './regulering/reguleringFormPrimitives';
import { FORM_REGISTRY } from './regulering/reguleringFormRegistry';
import type { FormKonsoliderContext, KildeReguleringsInterval, ResolvedStrategi } from './regulering/reguleringForm';
import { buildReguleringOpslag, buildUreguleretOpslag, type ReguleringOpslag } from './regulering/reguleringOpslag';
import { resolveSfggSource, sfggKildeUsesReferenceperiode } from './sfggKilde';

// =============================================================================
// INVARIANT-NOTE: Alle throw new Error() i denne fil er defensive invarianter.
// De kan kun nås hvis erstatningsopgoerelseValidator har fejlet i at afvise
// input, der burde have blokeret beregningen. Under normal udførelse er samtlige
// throw-stier dækket af validator-/preflight-checks i snapshot-orchestreringen.
// Uventede throws fanges af computeEoSnapshot og resulterer i fail_closed med
// failClosedReason: 'runtime_exception'. Se eo-snapshot-contract.md §3.4.
// =============================================================================

export const resolveLoenudviklingRows = (
  values: TafCalculationValues
): ReadonlyArray<LoenudviklingSource> => {
  return resolveLoenudviklingKilde(values);
};

export const segmentAmountOre = (baseLoenKronerRounded: number, quantity: number, deltaPct: number): MoneyOre => {
  const amountKroner = baseLoenKronerRounded * quantity * (1 + deltaPct / 100);
  return fromKroner(roundKroner(amountKroner));
};

export const buildTafArbejdsdageSet = (
  values: TafCalculationValues,
  tafRanges: readonly IsoRange[]
): ReadonlySet<ISODateString> => {
  return buildTafArbejdsdageSetFromRows(values.tafPerioder ?? [], values.ferieperioder ?? [], {
    authoritativeRanges: tafRanges,
  });
};

// Scanner hele sættet pr. kald (O(sæt)). Kaldes i segment-løkker, men sættet er præbygget (ikke
// gen-materialiseret pr. segment, jf. docs/architecture/date-interval-performance-architecture.md), og
// segmenter stammer fra regulerings-brudpunkter (få pr. år) – en amortiseret binær-søgnings-tæller
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
// Den resolvede strategi og kildens dækning (til reguleringsopslaget uden for TAF-perioden).
type ResolvedReguleringsgrundlag = Readonly<{
  strategiData: ResolvedStrategi;
  kildeDaekning: KildeReguleringsInterval | undefined;
}>;

const resolveReguleringsStrategi = (
  values: TafCalculationValues,
  stamdataValues: StamdataValues,
  options: Readonly<{ tafRanges: readonly IsoRange[] }>
): ResolvedReguleringsgrundlag => {
  const ansaettelser = resolveLoenudviklingRows(values);
  const alleIngen = ansaettelser.length > 0 && ansaettelser.every((af) => af.loenudviklingBeregningsgrundlag === 'Ingen');
  if (alleIngen) return { strategiData: { strategi: 'ingen', label: 'Ingen', konsolideret: null }, kildeDaekning: undefined };

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
    kraeverFeriePctVedBeregningsperiode,
    activeMedSynligeSatserOgLoenoplysninger,
  };
  const form = FORM_REGISTRY[basis];
  return { strategiData: form.konsolider(ctx), kildeDaekning: form.coverageInterval(active[0]) };
};

type LoenudviklingOptions = Readonly<{
  tafRanges: readonly IsoRange[];
  incomeForBeregningsperiode?: IncomePeriodResult | null;
}>;

/**
 * Lønudviklingens samlede resultat: TAF-modellen og reguleringsopslaget pr. dato (AP2), som TAF-segmenterne
 * er bygget af, og som sygeferiegodtgørelsen slår op i.
 */
export type LoenudviklingBeregning = Readonly<{
  model: LoenudviklingModel;
  reguleringOpslag: Readonly<{
    /**
     * Ét opslag pr. ansættelsesforhold ved «Beregningsperiode». SFGG kan kræve et opslag,
     * selv om jobbet kun har løn i SFGG-referenceperioden og ikke i beregningsperioden.
     */
    perAnsaettelse: ReadonlyMap<string, ReguleringOpslag>;
    /**
     * Et fælles opslag, når lønudviklingen ikke er opdelt pr. ansættelsesforhold: angivet løn, eller
     * «Beregningsperiode» uden lønindkomst i perioden.
     */
    faelles: ReguleringOpslag | null;
  }>;
}>;

export const buildLoenudviklingBeregning = (
  values: TafCalculationValues,
  stamdataValues: StamdataValues,
  tafBeregningsenhed: TafBeregningsenhed,
  indkomstSkadestidspunkt: IndkomstSkadestidspunktModel | null,
  options: LoenudviklingOptions
): LoenudviklingBeregning => {
  const tafRanges = options.tafRanges;
  const buildFromStrategiAndBase = (
    grundlag: ResolvedReguleringsgrundlag,
    baseLoen: number
  ): Readonly<{
    loenudviklingLabel: string;
    beregnedeSegmenter: readonly LoenudviklingSegment[];
    loenudviklingTotal: Calculable<MoneyOre>;
    forloeb?: ReguleringForloeb;
    reguleringOpslag: ReguleringOpslag;
  }> => {
    if (!Number.isFinite(baseLoen) || baseLoen <= 0 || tafRanges.length === 0) {
      throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
    }

    const baseLoenRounded = roundKroner(baseLoen);
    const baseLoenOre = fromKroner(baseLoenRounded);
    const tafArbejdageSet = tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
      ? buildTafArbejdsdageSet(values, tafRanges)
      : null;
    const loenudviklingLabel = grundlag.strategiData.label;

    // Reguleringsopslaget evaluerer formen ét sted: satser, reference, periode og (for KL-lønaftaler)
    // kædelønnen. Det rummer ALLE reguleringstrin i TAF-perioden – også trin uden TAF-arbejdsdage, som
    // sygeferiegodtgørelsen fortsat skal kunne slå op i (fund A4). TAF-beløbet nedenfor frasorterer først
    // bagefter de trin, der har mængde 0. Reguleringsbeviset følger det anvendte delta til alle visninger;
    // forløbet bærer kun de selvstændige kildeserier.
    const reguleringOpslag = buildReguleringOpslag({
      strategi: grundlag.strategiData,
      baseLoenRounded,
      tafRanges,
      kildeDaekning: grundlag.kildeDaekning,
    });
    const forloeb = reguleringOpslag.forloeb;

    const beregnedeSegmenter: Array<LoenudviklingModel['beregnedeSegmenter'][number]> = [];
    for (const segment of reguleringOpslag.segmenter) {
      const { regulering, klKaedeloen } = segment.vaerdi;
      const deltaPct = regulering.appliedDeltaPct;
      // KL-lønaftaler: den opregulerede, afrundede enhedsløn for perioden – bæres med på segmentet,
      // så indkomst-linjerne kan vise "antal á reguleret løn = beløb" uden faktor-tekst.
      const klLoenaftalerReguleretLoenOre = klKaedeloen?.reguleretLoenOre;
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
          deltaPct,
          regulering,
          amountOre: segmentAmountOre(baseLoenRounded, maanederRaw, deltaPct),
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
        // Kun TAF-beløbet frasorterer trin uden arbejdsdage; reguleringsopslaget beholder dem.
        if (arbejdsdage <= 0) continue;
        beregnedeSegmenter.push({
          kind: 'arbejdsdage',
          fra: segment.fra,
          til: segment.til,
          arbejdsdage,
          dagsloenOre: baseLoenOre,
          deltaPct,
          regulering,
          amountOre: segmentAmountOre(baseLoenRounded, arbejdsdage, deltaPct),
          ...(klLoenaftalerReguleretLoenOre !== undefined ? { reguleretLoenOre: klLoenaftalerReguleretLoenOre } : {}),
        });
      }
    }

    if (beregnedeSegmenter.length === 0) {
      return {
        loenudviklingLabel,
        loenudviklingTotal: asCalculable(zeroMoneyOre()),
        beregnedeSegmenter,
        forloeb,
        reguleringOpslag,
      };
    }

    const totalOre = clampMoneyOreToZero(
      sumMoneyOre(beregnedeSegmenter.map((segment) => segment.amountOre))
    );
    return { loenudviklingLabel, loenudviklingTotal: asCalculable(totalOre), beregnedeSegmenter, forloeb, reguleringOpslag };
  };

  const buildPerAnsaettelseModel = (): LoenudviklingBeregning => {
    const beregningsperiodeRange = buildBeregningsperiodeRange(values);
    if (!beregningsperiodeRange) {
      throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
    }
    const ansaettelser = values.loenindkomstAnsaettelsesforhold ?? [];
    const grundlagByIndex = ansaettelser.map((ansaettelsesforhold) => resolveReguleringsStrategi({
      ...values,
      loenindkomstAnsaettelsesforhold: [ansaettelsesforhold],
    }, stamdataValues, { tafRanges }));
    const income =
      options.incomeForBeregningsperiode
      ?? buildIncomeForRanges(values, [beregningsperiodeRange], undefined, stamdataValues.skadedato);
    const opslagPerAnsaettelse = new Map<string, ReguleringOpslag>();
    const medLoenIGrundlaget = new Set(income.employers.map((employer) => employer.index));
    ansaettelser.forEach((employment, index) => {
      if (medLoenIGrundlaget.has(index)) return;
      const grundlag = grundlagByIndex[index];
      const sfggRow = values.sfggAnsaettelsesforhold.find((row) => row.ansaettelsesforholdId === employment.id);
      if (sfggKildeUsesReferenceperiode(resolveSfggSource(sfggRow, employment).kind)) {
        // Indeks- og pakkeformer afhænger kun af kildens forhold, ikke af lønbeløbet.
        // SFGG følger derfor jobbets valgte form, også uden løn i TAF-beregningsperioden.
        opslagPerAnsaettelse.set(employment.id, buildReguleringOpslag({
          // KL har ingen TAF-løn her. SFGG regulerer sin egen referencesats i en selvstændig KL-kæde.
          strategi: grundlag.strategiData, baseLoenRounded: 0, tafRanges, kildeDaekning: grundlag.kildeDaekning,
        }));
      } else {
        opslagPerAnsaettelse.set(employment.id, buildUreguleretOpslag(tafRanges,
          grundlag.strategiData.strategi === 'ingen' ? 'ikke-valgt' : 'intet-loengrundlag'));
      }
    });
    if (income.employers.length === 0) {
      const alleIngen = grundlagByIndex.every((grundlag) => grundlag.strategiData.strategi === 'ingen');
      if (alleIngen || income.benefits.length > 0) {
        // Uden lønindkomst i beregningsperioden er der ingen TAF-løn at regulere.
        // SFGG beholder sine selvstændige opslag pr. job ovenfor.
        const reguleringOpslag = buildUreguleretOpslag(tafRanges, alleIngen ? 'ikke-valgt' : 'intet-loengrundlag');
        // Arbejdsdage-grundlaget afhænger kun af (values, tafRanges) og er dermed loop-invariant.
        // Byg det ÉN gang frem for pr. range – ellers gen-materialiseres hele arbejdsdage-sættet
        // (som selv itererer alle ranges) for hver eneste range = O(ranges² × dage).
        const ingenArbejdsdageSet =
          tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER
            ? null
            : buildTafArbejdsdageSet(values, tafRanges);
        const beregnedeSegmenter = reguleringOpslag.segmenter.map<LoenudviklingSegment>((segment) => (
          tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER || ingenArbejdsdageSet === null
            ? {
              kind: 'maaneder',
              fra: segment.fra,
              til: segment.til,
              maaneder: beregnArbejdsdageOgMaaneder(
                segment.fra,
                segment.til,
                new Set<ISODateString>(),
                new Set<ISODateString>()
              ).maaneder,
              maanedsloenOre: zeroMoneyOre(),
              deltaPct: segment.vaerdi.regulering.appliedDeltaPct,
              regulering: segment.vaerdi.regulering,
              amountOre: zeroMoneyOre(),
            }
            : {
              kind: 'arbejdsdage',
              fra: segment.fra,
              til: segment.til,
              arbejdsdage: countTafArbejdsdageInRange(
                ingenArbejdsdageSet,
                segment.fra,
                segment.til
              ),
              dagsloenOre: zeroMoneyOre(),
              deltaPct: segment.vaerdi.regulering.appliedDeltaPct,
              regulering: segment.vaerdi.regulering,
              amountOre: zeroMoneyOre(),
            }
        ));
        return {
          model: {
            loenudviklingLabel: 'Ingen',
            loenudviklingTotal: asCalculable(zeroMoneyOre()),
            beregningsenhed: tafBeregningsenhed,
            beregnedeSegmenter,
            perAnsaettelse: [],
          },
          reguleringOpslag: { perAnsaettelse: opslagPerAnsaettelse, faelles: reguleringOpslag },
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
      // Grundlønnen bruger samme reguleringsdato-satser som visningen af «Indtægt før skadedatoen».
      const baseLoen = resolveBeregningsperiodeEmployerAtReguleringsdato(
        values,
        ansaettelsesforhold,
        employer,
        isISODateString(stamdataValues.skadedato) ? stamdataValues.skadedato : null
      ).breakdown.samlet / divisor;
      const grundlag = grundlagByIndex[employer.index];
      if (!grundlag) continue;
      const modelForAf = buildFromStrategiAndBase(grundlag, baseLoen);
      const ansaettelsesforholdNavn = resolveAnsaettelsesforholdNavn(ansaettelsesforhold.navnPaaArbejdssted, employer.index);

      perAnsaettelse.push({
        ansaettelsesforholdId: ansaettelsesforhold.id,
        ansaettelsesforholdNavn,
        loenudviklingLabel: modelForAf.loenudviklingLabel,
        loenudviklingTotal: modelForAf.loenudviklingTotal,
        beregnedeSegmenter: modelForAf.beregnedeSegmenter,
        forloeb: modelForAf.forloeb,
      });
      opslagPerAnsaettelse.set(ansaettelsesforhold.id, modelForAf.reguleringOpslag);
    }

    if (perAnsaettelse.length === 0) {
      throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
    }

    const beregnedeSegmenter = perAnsaettelse
      .flatMap((entry) => entry.beregnedeSegmenter)
      .slice()
      .sort((a, b) => (a.fra < b.fra ? -1 : a.fra > b.fra ? 1 : 0));
    const totalOre = clampMoneyOreToZero(sumMoneyOre(perAnsaettelse.map((entry) => {
      if (entry.loenudviklingTotal.status !== 'ok') {
        throw new Error('Loenudvikling kan ikke beregnes for den valgte opsætning.');
      }
      return entry.loenudviklingTotal.value;
    })));
    const labels = Array.from(new Set(perAnsaettelse.map((entry) => entry.loenudviklingLabel)));
    const loenudviklingLabel = labels.length === 1 ? labels[0] : 'Flere reguleringstyper';

    return {
      model: {
        loenudviklingLabel,
        loenudviklingTotal: asCalculable(totalOre),
        beregningsenhed: tafBeregningsenhed,
        beregnedeSegmenter,
        perAnsaettelse,
      },
      reguleringOpslag: { perAnsaettelse: opslagPerAnsaettelse, faelles: null },
    };
  };

  if (values.beregnesUdFra === 'Beregningsperiode') {
    return buildPerAnsaettelseModel();
  }

  const grundlag = resolveReguleringsStrategi(values, stamdataValues, { tafRanges });
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
  const model = buildFromStrategiAndBase(grundlag, baseLoen);
  return {
    model: {
      loenudviklingLabel: model.loenudviklingLabel,
      loenudviklingTotal: model.loenudviklingTotal,
      beregningsenhed: tafBeregningsenhed,
      beregnedeSegmenter: model.beregnedeSegmenter,
      forloeb: model.forloeb,
      perAnsaettelse: [],
    },
    // Angivet løn har ét fælles lønudviklingsgrundlag for alle ansættelsesforhold.
    reguleringOpslag: { perAnsaettelse: new Map(), faelles: model.reguleringOpslag },
  };
};

/** TAF-modellen alene, når reguleringsopslaget ikke skal bruges. */
export const buildLoenudviklingModel = (
  values: TafCalculationValues,
  stamdataValues: StamdataValues,
  tafBeregningsenhed: TafBeregningsenhed,
  indkomstSkadestidspunkt: IndkomstSkadestidspunktModel | null,
  options: LoenudviklingOptions
): LoenudviklingModel => buildLoenudviklingBeregning(
  values,
  stamdataValues,
  tafBeregningsenhed,
  indkomstSkadestidspunkt,
  options
).model;

const resolveAnvendtReguleringsdato = (
  eoValues: TafCalculationValues,
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
  eoValues: TafCalculationValues,
  indkomstSkadestidspunkt: IndkomstSkadestidspunktModel | null
): number | null => {
  if (eoValues.beregnesUdFra === 'Angivet månedsløn') {
    const value = amountValueToNumber(eoValues.maanedsloenenUdgoer);
    return value !== undefined ? value : null;
  }
  if (eoValues.beregnesUdFra !== 'Beregningsperiode') return null;
  if (!indkomstSkadestidspunkt) return null;
  if (indkomstSkadestidspunkt.maanedsloen.status !== 'ok') return null;
  return toKroner(indkomstSkadestidspunkt.maanedsloen.value);
};

const resolveDagsloenBase = (
  eoValues: TafCalculationValues,
  indkomstSkadestidspunkt: IndkomstSkadestidspunktModel | null
): number | null => {
  if (eoValues.beregnesUdFra === 'Angivet dagsløn') {
    const value = amountValueToNumber(eoValues.dagsloenenUdgoer);
    return value !== undefined ? value : null;
  }
  if (eoValues.beregnesUdFra !== 'Beregningsperiode') return null;
  if (!indkomstSkadestidspunkt) return null;
  if (indkomstSkadestidspunkt.dagsloen.status !== 'ok') return null;
  return toKroner(indkomstSkadestidspunkt.dagsloen.value);
};
