import type { ISODateString } from '../../types/branded';
import {
  aarsloenMax,
  erhvervsevnetabMax,
  reguleringssats,
} from '../../data/regulationRates';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { computeEetEalCalculation } from '../erhvervsevnetab/eetEalCalculation';
import type { ForsoergertabEalKravResult } from './forsoergertabTypes';

type Input = Readonly<{
  beregningsdato: ISODateString | undefined;
  skadesdato: ISODateString | undefined;
  skadelidteFodselsdato: ISODateString | undefined;
  aslAarsloen: AmountValue | undefined;
  ealAarsloen: AmountValue | undefined;
}>;

export const computeForsoergertabEalKrav = (input: Input): ForsoergertabEalKravResult => {
  return computeEetEalCalculation({
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
    erhvervsevnetabMax,
    aarsloenMax,
  });
};
