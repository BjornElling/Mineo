import { dedupeIssuesByIdentity } from '../../utils/issueUtils';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../types/branded';
import type { Koen } from '../../schemas/formSchemas';
import type { Skadestype } from '../../schemas/formSchemas/enumSchemas';
import { computeForsoergertabAslYdelser } from './forsoergertabAslYdelser';
import { computeForsoergertabEalKrav } from './forsoergertabEalKrav';
import type { ForsoergertabCalculationResult } from './forsoergertabTypes';
import { toKroner } from '../money/money';

type Input = Readonly<{
  skadedato: ISODateString | undefined;
  skadestype?: Skadestype;
  skadelidteFodselsdato: ISODateString | undefined;
  efterladteFodselsdato: ISODateString | undefined;
  beregningsdato: ISODateString | undefined;
  virkningsdato: ISODateString | undefined;
  koen: Koen | undefined;
  tilkendtForPeriodeAar: number | undefined;
  aslAarsloen: AmountValue | undefined;
  ealAarsloen: AmountValue | undefined;
  /**
   * Dependency-gate pr. gruppe (§1.10 + `error-contract.md` §5). `true` = mindst én af DENNE gruppes
   * afhængigheder har en rød feltfejl, og gruppens motor må derfor IKKE kaldes.
   *
   * Uden gaten ville readerens maskering af en rød værdi til `undefined` få motoren til at regne på et
   * FALSK input – konkret kan en rød `ealAarsloen` ellers falde tilbage til `aslAarsloen`
   * (`eetEalCalculation.ts:184-193`) og rapportere `source: 'asl'`, som om brugeren havde ladet feltet tomt.
   * Grupperne gates hver for sig, så en rød ASL-afhængighed bevarer EAL-delen og omvendt.
   *
   * Begge flag er PÅKRÆVEDE: var de valgfrie, ville et udeladt flag lydløst åbne motoren igen, og gaten
   * ville kunne forsvinde ved en fremtidig ændring uden at compileren protesterede.
   */
  ealBlocked: boolean;
  aslBlocked: boolean;
}>;

const BLOCKED_EAL: ForsoergertabCalculationResult['ealComputation'] = null;

export const computeForsoergertabCalculation = (input: Input): ForsoergertabCalculationResult => {
  // Motoren kaldes KUN, når dens egen dependency-gruppe er ready – aldrig med et maskeret input.
  const ealResult = input.ealBlocked
    ? { issues: [], computation: BLOCKED_EAL, foersoergertabEalMinSatsOre: null, foersoergertabForhoejtetTilMin: false }
    : computeForsoergertabEalKrav({
      beregningsdato: input.beregningsdato,
      skadedato: input.skadedato,
      skadestype: input.skadestype,
      skadelidteFodselsdato: input.skadelidteFodselsdato,
      aslAarsloen: input.aslAarsloen,
      ealAarsloen: input.ealAarsloen,
    });
  const aslResult = input.aslBlocked
    ? { issues: [], computation: null }
    : computeForsoergertabAslYdelser({
      skadedato: input.skadedato,
      skadestype: input.skadestype,
      beregningsdato: input.beregningsdato,
      virkningsdato: input.virkningsdato,
      efterladteFodselsdato: input.efterladteFodselsdato,
      koen: input.koen,
      tilkendtForPeriodeAar: input.tilkendtForPeriodeAar,
      aslAarsloen: input.aslAarsloen,
    });

  const issues = dedupeIssuesByIdentity([...ealResult.issues, ...aslResult.issues]);
  if (!ealResult.computation || !aslResult.computation) {
    return {
      issues,
      ealComputation: ealResult.computation,
      aslComputation: aslResult.computation,
      foersoergertabEalMinSatsOre: ealResult.foersoergertabEalMinSatsOre,
      foersoergertabForhoejtetTilMin: ealResult.foersoergertabForhoejtetTilMin,
      result: null,
    };
  }

  // Forsørgertabs samlede ASL-resultat er endnu et krone-output. Konverteringen ligger derfor
  // eksplicit ved denne portgrænse; EAL-outputtet selv forbliver MoneyOre.
  const ealKrav = toKroner(ealResult.computation.ealKravOre);
  const aslKapitalbelob = aslResult.computation.kapitalbelob;
  const aslLobendeYdelserTotal = aslResult.computation.aslLobendeYdelserTotal;
  const nettokrav = Math.max(0, ealKrav - aslKapitalbelob - aslLobendeYdelserTotal);

  return {
    issues,
    ealComputation: ealResult.computation,
    aslComputation: aslResult.computation,
    foersoergertabEalMinSatsOre: ealResult.foersoergertabEalMinSatsOre,
    foersoergertabForhoejtetTilMin: ealResult.foersoergertabForhoejtetTilMin,
    result: {
      ealKrav,
      aslKapitalbelob,
      aslLobendeYdelserTotal,
      nettokrav,
    },
  };
};
