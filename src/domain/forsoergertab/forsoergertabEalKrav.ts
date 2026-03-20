import type { ISODateString } from '../../types/branded';
import {
  aarsloenAslMax,
  erhvervsevnetabEalMax,
  foersoergertabEalMin,
  reguleringssats,
} from '../../data/regulationRates';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { computeEetEalCalculation } from '../erhvervsevnetab/eetEalCalculation';
import { round0 } from '../erhvervsevnetab/eetRounding';
import type { ForsoergertabEalKravResult } from './forsoergertabTypes';

type Input = Readonly<{
  beregningsdato: ISODateString | undefined;
  skadesdato: ISODateString | undefined;
  skadelidteFodselsdato: ISODateString | undefined;
  aslAarsloen: AmountValue | undefined;
  ealAarsloen: AmountValue | undefined;
}>;

export const computeForsoergertabEalKrav = (input: Input): ForsoergertabEalKravResult => {
  const eetResult = computeEetEalCalculation({
    erhvervsevnetab: {
      beregningsdato: input.beregningsdato,
      skadelidteFodselsdato: undefined,
      // Beslutningsnote: Forsørgertab bruger EAL-beregningen som fast 30 %-pipeline uden kønsafhængigt tabelvalg.
      // Risiko: hvis EET-EAL senere får kønsafhængig betydning, skal denne integration revurderes.
      koen: undefined,
      aslAfgoerelser: [],
      ealEetPct: 30,
      eetDifferencekravBilagSelection: {
        loebendeYdelser: false,
        kapitalisering: false,
        eetEfterEal: false,
        proformaKapitalisering: false,
        visUdvidetSpecifikation: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: false,
      },
      aslAarsloen: input.aslAarsloen,
      ealAarsloen: input.ealAarsloen,
    },
    skadesdato: input.skadesdato,
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
  const foersoergertabEalMinSats = Number.isFinite(minSats) ? minSats : null;
  const foersoergertabForhoejtetTilMin =
    foersoergertabEalMinSats !== null && eetResult.computation.eetBeregnet < foersoergertabEalMinSats;

  if (foersoergertabForhoejtetTilMin && foersoergertabEalMinSats !== null) {
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
