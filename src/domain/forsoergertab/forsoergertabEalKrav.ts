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

export const computeForsoergertabEalKrav = (input: Input): ForsoergertabEalKravResult => {
  const eetResult = computeEetEalCalculation({
    // EAL-beregningen aftager kun de fem felter, den faktisk læser (EetEalInputValues).
    // Beslutningsnote: skadelidteFodselsdato sendes via toplevel-parameteren (ikke via
    // erhvervsevnetab), hvilket er intentionelt — aldersreduktionen beregnes korrekt herfra.
    erhvervsevnetab: {
      beregningsdato: input.beregningsdato,
      aslAfgoerelser: [],
      ealEetPct: 30,
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
      ...eetResult,
      foersoergertabEalMinSatsOre: null,
      foersoergertabForhoejtetTilMin: false,
    };
  }

  const beregningsaar = eetResult.computation.beregningsaar;
  const minSats = foersoergertabEalMin[beregningsaar];
  if (!Number.isFinite(minSats)) {
    // Fail-closed: forsørgertabets EAL-minimum mangler for beregningsåret. Et forsørgertabskrav
    // må ikke beregnes uden minimumsgaranti (stille gæt) — rapportér eksplicit i stedet.
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
  const toPort = (computation: NonNullable<typeof eetResult.computation>): ForsoergertabEalPort => ({
    beregningsdato: computation.beregningsdato,
    skadedato: computation.skadedato,
    fodselsdato: computation.fodselsdato,
    skadesaar: computation.skadesaar,
    beregningsaar: computation.beregningsaar,
    aarsloenOre: computation.aarsloenOre,
    aarsloenSource: computation.aarsloenSource,
    reguleringsaar: computation.reguleringsaar,
    reguleringsPctRounded4: computation.reguleringsPctRounded4,
    reguleretAarsloenOre: computation.reguleretAarsloenOre,
    eetPct: computation.eetPct,
    eetPctSource: computation.eetPctSource,
    kapitaliseringsfaktor: computation.kapitaliseringsfaktor,
    eetBeregnetOre: computation.eetBeregnetOre,
    eetMaksOre: computation.eetMaksOre,
    eetAnvendtOre: computation.eetAnvendtOre,
    eetReduceretTilMaks: computation.eetReduceretTilMaks,
    alderVedSkade: computation.alderVedSkade,
    alderVedSkadeCapped: computation.alderVedSkadeCapped,
    aldersreduktionPct: computation.aldersreduktionPct,
    aldersreduktionBeloebOre: computation.aldersreduktionBeloebOre,
    ealKravOre: computation.ealKravOre,
  });
  const port = toPort(eetResult.computation);
  const foersoergertabForhoejtetTilMin =
    port.eetBeregnetOre < foersoergertabEalMinSatsOre;

  if (foersoergertabForhoejtetTilMin) {
    // Minimumssatsen afrundes fortsat ved den eksisterende round0-grænse. Derefter foregår
    // subtraktion og nul-clamp udelukkende gennem den kanoniske pengealgebra.
    const aldersreduktionBeloebOre = fromKroner(round0(
      toKroner(foersoergertabEalMinSatsOre) * (port.aldersreduktionPct / 100)
    ));
    return {
      issues: eetResult.issues,
      computation: {
        ...port,
        eetAnvendtOre: foersoergertabEalMinSatsOre,
        aldersreduktionBeloebOre,
        ealKravOre: clampMoneyOreToZero(
          subtractMoneyOre(foersoergertabEalMinSatsOre, aldersreduktionBeloebOre)
        ),
      },
      foersoergertabEalMinSatsOre,
      foersoergertabForhoejtetTilMin: true,
    };
  }

  return {
    issues: eetResult.issues,
    computation: port,
    foersoergertabEalMinSatsOre,
    foersoergertabForhoejtetTilMin: false,
  };
};
