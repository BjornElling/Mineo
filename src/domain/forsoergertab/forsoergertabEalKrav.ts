import type { ISODateString } from '../../types/branded';
import {
  aarsloenAslMax,
  erhvervsevnetabEalMax,
  foersoergertabEalMin,
  reguleringssats,
} from '../../data/lovbestemteRates';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { computeEetEalCalculation } from '../erhvervsevnetab/eetEalCalculation';
import { round0 } from '../../utils/roundingShortcuts';
import type { ForsoergertabEalKravResult } from './forsoergertabTypes';

type Input = Readonly<{
  beregningsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
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
    skadelidteFodselsdato: input.skadelidteFodselsdato,
    reguleringssats,
    erhvervsevnetabEalMax,
    aarsloenAslMax,
  });

  if (!eetResult.computation) {
    return {
      ...eetResult,
      foersoergertabEalMinSats: null,
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
      foersoergertabEalMinSats: null,
      foersoergertabForhoejtetTilMin: false,
    };
  }
  const foersoergertabEalMinSats = minSats;
  // foersoergertabEalMin[] forventes at indeholde heltal (hele kronebeløb).
  // eetBeregnet er round0-afrundet og dermed også et heltal.
  // Sammenligningen er dermed præcis uden floating-point-usikkerhed.
  const foersoergertabForhoejtetTilMin =
    eetResult.computation.eetBeregnet < foersoergertabEalMinSats;

  if (foersoergertabForhoejtetTilMin) {
    const comp = eetResult.computation;
    return {
      ...eetResult,
      computation: {
        ...comp,
        eetAnvendt: foersoergertabEalMinSats,
        aldersreduktionBeloeb: round0(foersoergertabEalMinSats * (comp.aldersreduktionPct / 100)),
        ealKrav: Math.max(0, round0(foersoergertabEalMinSats - round0(foersoergertabEalMinSats * (comp.aldersreduktionPct / 100)))),
      },
      foersoergertabEalMinSats,
      foersoergertabForhoejtetTilMin: true,
    };
  }

  return {
    ...eetResult,
    foersoergertabEalMinSats,
    foersoergertabForhoejtetTilMin: false,
  };
};
