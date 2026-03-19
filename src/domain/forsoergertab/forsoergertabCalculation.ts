import { dedupeIssuesBySeverityAndMessage } from '../../utils/issueUtils';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../types/branded';
import type { Koen } from '../../schemas/formSchemas';
import { computeForsoergertabAslYdelser } from './forsoergertabAslYdelser';
import { computeForsoergertabEalKrav } from './forsoergertabEalKrav';
import type { ForsoergertabCalculationResult } from './forsoergertabTypes';

type Input = Readonly<{
  skadesdato: ISODateString | undefined;
  skadelidteFodselsdato: ISODateString | undefined;
  efterladteFodselsdato: ISODateString | undefined;
  beregningsdato: ISODateString | undefined;
  virkningsdato: ISODateString | undefined;
  koen: Koen | undefined;
  tilkendtForPeriodeAar: number | undefined;
  aslAarsloen: AmountValue | undefined;
  ealAarsloen: AmountValue | undefined;
}>;

export const computeForsoergertabCalculation = (input: Input): ForsoergertabCalculationResult => {
  const ealResult = computeForsoergertabEalKrav({
    beregningsdato: input.beregningsdato,
    skadesdato: input.skadesdato,
    skadelidteFodselsdato: input.skadelidteFodselsdato,
    aslAarsloen: input.aslAarsloen,
    ealAarsloen: input.ealAarsloen,
  });
  const aslResult = computeForsoergertabAslYdelser({
    skadesdato: input.skadesdato,
    beregningsdato: input.beregningsdato,
    virkningsdato: input.virkningsdato,
    efterladteFodselsdato: input.efterladteFodselsdato,
    koen: input.koen,
    tilkendtForPeriodeAar: input.tilkendtForPeriodeAar,
    aslAarsloen: input.aslAarsloen,
  });

  const issues = dedupeIssuesBySeverityAndMessage([...ealResult.issues, ...aslResult.issues]);
  if (!ealResult.computation || !aslResult.computation) {
    return {
      issues,
      ealComputation: ealResult.computation,
      aslComputation: aslResult.computation,
      result: null,
    };
  }

  const ealKrav = ealResult.computation.ealKrav;
  const aslKapitalbelob = aslResult.computation.kapitalbelob;
  const nettokrav = Math.max(0, ealKrav - aslKapitalbelob);

  return {
    issues,
    ealComputation: ealResult.computation,
    aslComputation: aslResult.computation,
    result: {
      ealKrav,
      aslKapitalbelob,
      nettokrav,
    },
  };
};
