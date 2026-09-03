import type { ISODateString } from '../../types/branded';
import type { Skadestype } from '../../schemas/formSchemas/enumSchemas';
import {
  aarsloenAslMax,
  erhvervsevnetabEalMax,
  foersoergertabEalMin,
  reguleringssats,
} from '../../data/lovbestemteRates';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { computeEetEalCalculation } from '../erhvervsevnetab/eetEalCalculation';
import { round0 } from '../../utils/roundingShortcuts';
import {
  clampMoneyOreToZero,
  fromKroner,
  subtractMoneyOre,
  toKroner,
} from '../money/money';
import type { ForsoergertabEalKravResult, ForsoergertabEalPort } from './forsoergertabTypes';

type Input = Readonly<{
  beregningsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  skadestype?: Skadestype;
  skadelidteFodselsdato: ISODateString | undefined;
  aslAarsloen: AmountValue | undefined;
  ealAarsloen: AmountValue | undefined;
}>;

/**
 * Erhvervsevnetabsprocenten, forsørgertabskravet regnes af. Forsørgertabet udgør 30 % af det
 * erhvervsevnetab, afdøde ville have haft ved et FULDT tab – ikke et erhvervsevnetab på 30 %. Derfor
 * er det det fulde tab, der holdes op mod erhvervsevnetabets lovbestemte maksimum, før andelen tages.
 */
const EET_PCT_FULDT_TAB = 100;

/** Forsørgertabets andel af erhvervsevnetabet, jf. erstatningsansvarslovens § 13. */
const FORSOERGERTAB_PCT = 30;

export const computeForsoergertabEalKrav = (input: Input): ForsoergertabEalKravResult => {
  const eetResult = computeEetEalCalculation({
    // EAL-beregningen aftager kun de fem felter, den faktisk læser (EetEalInputValues).
    // Beslutningsnote: skadelidteFodselsdato sendes via toplevel-parameteren (ikke via
    // erhvervsevnetab), hvilket er intentionelt – aldersreduktionen beregnes korrekt herfra.
    erhvervsevnetab: {
      beregningsdato: input.beregningsdato,
      aslAfgoerelser: [],
      ealEetPct: EET_PCT_FULDT_TAB,
      aslAarsloen: input.aslAarsloen,
      ealAarsloen: input.ealAarsloen,
    },
    skadedato: input.skadedato,
    skadestype: input.skadestype,
    skadelidteFodselsdato: input.skadelidteFodselsdato,
    reguleringssats,
    erhvervsevnetabEalMax,
    aarsloenAslMax,
  });

  if (!eetResult.computation) {
    return {
      issues: eetResult.issues,
      computation: null,
      foersoergertabEalMinSatsOre: null,
      foersoergertabForhoejtetTilMin: false,
    };
  }

  const beregningsaar = eetResult.computation.beregningsaar;
  const minSats = foersoergertabEalMin[beregningsaar];
  if (!Number.isFinite(minSats)) {
    // Fail-closed: forsørgertabets EAL-minimum mangler for beregningsåret. Et forsørgertabskrav
    // må ikke beregnes uden minimumsgaranti (stille gæt) – rapportér eksplicit i stedet.
    // Uopnåelig med nuværende datadækning (getSatserCompleteYearBounds inkluderer min-satsen),
    // men hærdet for at undgå en tavs gren ved fremtidige datahuller. Jf. 4.5-review.
    return {
      ...eetResult,
      issues: [
        ...eetResult.issues,
        {
          id: 'foersoergertab-eal-min-missing',
          severity: 'error',
          message: `Forsørgertabets minimumsbeløb mangler for år ${beregningsaar}.`,
        },
      ],
      computation: null,
      foersoergertabEalMinSatsOre: null,
      foersoergertabForhoejtetTilMin: false,
    };
  }

  const foersoergertabEalMinSatsOre = fromKroner(minSats);
  const eet = eetResult.computation;

  // Andelen tages af erhvervsevnetabet EFTER maksimumsreduktionen. De lovbestemte round0-grænser
  // ligger fortsat i kroner; først derefter bliver beløbet brandet.
  const forsoergertabBeregnetOre = fromKroner(round0(
    toKroner(eet.eetAnvendtOre) * (FORSOERGERTAB_PCT / 100)
  ));

  // Mindstebeløbet holdes op mod den FÆRDIGE andelsberegning – ikke mod det fulde erhvervsevnetab.
  const foersoergertabForhoejtetTilMin = forsoergertabBeregnetOre < foersoergertabEalMinSatsOre;
  const forsoergertabAnvendtOre = foersoergertabForhoejtetTilMin
    ? foersoergertabEalMinSatsOre
    : forsoergertabBeregnetOre;

  const aldersreduktionBeloebOre = fromKroner(round0(
    toKroner(forsoergertabAnvendtOre) * (eet.aldersreduktionPct / 100)
  ));

  const computation: ForsoergertabEalPort = {
    beregningsdato: eet.beregningsdato,
    skadedato: eet.skadedato,
    fodselsdato: eet.fodselsdato,
    skadesaar: eet.skadesaar,
    beregningsaar: eet.beregningsaar,
    aarsloenOre: eet.aarsloenOre,
    aarsloenSource: eet.aarsloenSource,
    reguleringsaar: eet.reguleringsaar,
    reguleringsPctRounded4: eet.reguleringsPctRounded4,
    reguleretAarsloenOre: eet.reguleretAarsloenOre,
    eetPct: eet.eetPct,
    kapitaliseringsfaktor: eet.kapitaliseringsfaktor,
    eetBeregnetOre: eet.eetBeregnetOre,
    eetMaksOre: eet.eetMaksOre,
    eetAnvendtOre: eet.eetAnvendtOre,
    eetReduceretTilMaks: eet.eetReduceretTilMaks,
    forsoergertabPct: FORSOERGERTAB_PCT,
    forsoergertabBeregnetOre,
    forsoergertabAnvendtOre,
    alderVedSkade: eet.alderVedSkade,
    alderVedSkadeCapped: eet.alderVedSkadeCapped,
    aldersreduktionPct: eet.aldersreduktionPct,
    aldersreduktionBeloebOre,
    // Subtraktion og nul-clamp foregår udelukkende gennem den kanoniske pengealgebra.
    ealKravOre: clampMoneyOreToZero(
      subtractMoneyOre(forsoergertabAnvendtOre, aldersreduktionBeloebOre)
    ),
  };

  return {
    issues: eetResult.issues,
    computation,
    foersoergertabEalMinSatsOre,
    foersoergertabForhoejtetTilMin,
  };
};
