import { toAnyFieldRef, type FieldRef } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import { isISODateString, isoToDanish, type ISODateString } from '../../types/branded';
import {
  eoFravaerPeriodeFraField,
  eoFravaerPeriodeTilField,
  eoOevrigeFravaersdageField,
  eoTafBeregningsperiodeFraField,
  eoTafBeregningsperiodeTilField,
  eoUspecificeredeFerieFridageField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { computeTafBeregningsenhed } from './helpers/tafBeregningsenhed';
import { isFerieRowEmpty } from './helpers/rowEmpty';
import { collectPeriodOverlapIssues } from './periodOverlapIssues';
import {
  evaluateBeregningsgrundlagFradragFejl,
  resolveBeregningsgrundlagFradrag,
  type BeregningsgrundlagFradrag,
} from './validation/beregningsgrundlagFradragRules';

// Beregningsgrundlagets regler, som ikke kan ligge på descriptoren, projekteret til de konkrete felter.
//
// Fire regler spærrede opgørelsen uden en eneste rød celle (BB-264, M-20): ferie uden for beregningsperioden,
// overlappende ferie, for mange løse dage og for mange fraværsdage. Tre lovlige indtastninger førte desuden
// beregningen ud i en intern undtagelse, fordi intet var tilbage at dele lønnen med (BB-258). Reglerne afhænger
// af perioden, af de andre fradrag og af enheden, og projekteres derfor herfra som TAF-afsnittets
// (`tafRowCellIssues.ts`): domænet binder feltadressen, UI'et giver issuet til feltet, og issuet blokerer TAF-
// grenen som enhver rød feltfejl. Værdierne er readerens, så et skjult eller rødt felt allerede er tomt.

const ruleIssue = <T>(field: FieldRef<T>, code: string, message: string): FieldIssue =>
  Object.freeze({
    kind: 'field' as const,
    code: `${field.descriptor.id}.${code}`,
    severity: 'error' as const,
    field: toAnyFieldRef(field),
    reason: 'rule' as const,
    message,
  });

const danish = (iso: ISODateString): string => isoToDanish(iso) ?? iso;

/**
 * En ferie i beregningsperioden skal ligge i beregningsperioden: kun dér fradrages den. Hver dato prøves for
 * sig og bærer sin egen besked – samme form som TAF-afsnittets ferievindue (BB-248).
 */
const collectFerieVindueIssues = (values: ErstatningsopgoerelseValues): readonly FieldIssue[] => {
  const { tafBeregningsperiodeFra: fra, tafBeregningsperiodeTil: til } = values;
  if (!isISODateString(fra) || !isISODateString(til) || fra > til) return [];
  const messageFor = (value: ISODateString): string | undefined => {
    if (value < fra) return `Ferien ligger før beregningsperioden (${danish(fra)})`;
    if (value > til) return `Ferien ligger efter beregningsperioden (${danish(til)})`;
    return undefined;
  };
  return values.fravaerPerioder.flatMap((row) =>
    ([['fra', eoFravaerPeriodeFraField], ['til', eoFravaerPeriodeTilField]] as const).flatMap(([key, descriptor]) => {
      const value = row[key];
      if (!isISODateString(value)) return [];
      const message = messageFor(value);
      return message === undefined ? [] : [ruleIssue(descriptor.bind(row.id), 'beregningsperiodeVindue', message)];
    }));
};

const collectFradragIssues = (
  values: ErstatningsopgoerelseValues,
  fradrag: BeregningsgrundlagFradrag | undefined,
): readonly FieldIssue[] => {
  const fejl = evaluateBeregningsgrundlagFradragFejl(values, fradrag);
  const issues: FieldIssue[] = [];
  if (fejl.periode !== undefined) {
    issues.push(
      ruleIssue(eoTafBeregningsperiodeFraField.bind(), 'ingenArbejdsdage', fejl.periode),
      ruleIssue(eoTafBeregningsperiodeTilField.bind(), 'ingenArbejdsdage', fejl.periode),
    );
  }
  if (fejl.ferie !== undefined) {
    for (const row of values.fravaerPerioder) {
      if (isFerieRowEmpty(row)) continue;
      issues.push(
        ruleIssue(eoFravaerPeriodeFraField.bind(row.id), 'daekkerPerioden', fejl.ferie),
        ruleIssue(eoFravaerPeriodeTilField.bind(row.id), 'daekkerPerioden', fejl.ferie),
      );
    }
  }
  if (fejl.loseFeriedage !== undefined) {
    issues.push(ruleIssue(eoUspecificeredeFerieFridageField.bind(), 'maksimum', fejl.loseFeriedage));
  }
  if (fejl.fravaersdage !== undefined) {
    issues.push(ruleIssue(eoOevrigeFravaersdageField.bind(), 'maksimum', fejl.fravaersdage));
  }
  return issues;
};

/**
 * Alle projekterede regelfejl i beregningsgrundlaget. Tavst, når TAF-kravet ikke er «Ja» eller grundlaget ikke
 * er en beregningsperiode: felterne er da skjulte, og readeren giver dem som tomme.
 */
export const collectBeregningsgrundlagCellIssues = (values: ErstatningsopgoerelseValues): readonly FieldIssue[] => {
  if (values.kravPaaTabtArbejdsfortjeneste !== 'Ja' || values.beregnesUdFra !== 'Beregningsperiode') return [];
  const fradrag = resolveBeregningsgrundlagFradrag(values, computeTafBeregningsenhed(values));
  return [
    ...collectPeriodOverlapIssues(
      values.fravaerPerioder.filter((row) => !isFerieRowEmpty(row)),
      { fra: eoFravaerPeriodeFraField, til: eoFravaerPeriodeTilField },
    ),
    ...collectFerieVindueIssues(values),
    ...collectFradragIssues(values, fradrag),
  ];
};
