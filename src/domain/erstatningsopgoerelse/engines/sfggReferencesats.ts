import type {
  ErstatningsopgoerelseValues,
  LoenindkomstAnsaettelsesforhold,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../../schemas/formSchemas';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';
import { getDayBeforeIso } from '../../../utils/isoDateHelpers';
import { parseISODate, type ISODateString } from '../../../types/branded';
import { fromKroner, roundKroner, type MoneyOre } from '../../money/money';
import { buildDatoSetInclusiveFromDates, buildFerieDageSet } from './tafDaySets';
import { optaelArbejdsdageBreakdown } from './periodiseringsMotor';
import { computeTafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { getSfggKildeSpec, resolveSfggDayBasis, type SfggSourceKind } from './sfggKilde';
import { buildSfggNoEligibleDaysReason } from '../helpers/sygeferiegodtgoerelseTexts';

export const SFGG_LOVBESTEMT_FERIEPENGE_PCT = 12.5;
export const SFGG_LOVBESTEMT_FERIEPENGE_DECIMAL = SFGG_LOVBESTEMT_FERIEPENGE_PCT / 100;

export type SfggReferencesatsNotCalculableKind =
  | 'missing_rate'
  | 'per_period_rate'
  | 'missing_referenceperiode'
  | 'unresolvable_referenceperiode'
  | 'no_calendar_days'
  | 'no_workdays';

export type SfggReferencesatsCalculable =
  | Readonly<{ status: 'ok'; value: MoneyOre }>
  | Readonly<{ status: 'not_calculable'; kind: SfggReferencesatsNotCalculableKind; reason: string }>;

export type SfggReferencesatsFormula = Readonly<{
  loenPlusLoen2PlusIkkePensLoenKroner: number;
  feriePctDecimal: number;
  feriepengeKroner: number;
  divisorDage: number;
  divisorLabel: 'kalenderdage' | 'arbejdsdage';
  kalenderdage: number;
  hverdage: number;
  shDage: number;
  feriedage: number;
  oevrigeFravaersdage: number;
}>;

const resolveNotCalculableReason = (kind: SfggReferencesatsNotCalculableKind): string => {
  switch (kind) {
    case 'missing_rate': return 'Dagssats mangler';
    case 'per_period_rate': return 'Direkte overenskomstsats beregnes pr. periode';
    case 'missing_referenceperiode': return 'Referenceperiode mangler';
    case 'unresolvable_referenceperiode': return 'Referenceperioden kan ikke opgøres';
    case 'no_calendar_days': return buildSfggNoEligibleDaysReason('kalenderdage');
    case 'no_workdays': return buildSfggNoEligibleDaysReason('arbejdsdage');
  }
};

export const notCalculableSfggReferencesats = (
  kind: SfggReferencesatsNotCalculableKind
): SfggReferencesatsCalculable => ({
  status: 'not_calculable',
  kind,
  reason: resolveNotCalculableReason(kind),
});

const calculableSfggReferencesats = (value: MoneyOre): SfggReferencesatsCalculable => ({ status: 'ok', value });

export const isSfggNoEligibleDaysNotCalculable = (
  value: SfggReferencesatsCalculable
): boolean => value.status === 'not_calculable' && (value.kind === 'no_calendar_days' || value.kind === 'no_workdays');

export const resolveSfggReferenceperiodeDayCount = (
  values: ErstatningsopgoerelseValues,
  row: Pick<
    SygeferiegodtgoerelseAnsaettelsesforholdRow,
    'sfggReferenceperiodeFra' | 'sfggReferenceperiodeTil' | 'sfggReferenceperiodeFravaersdageUdenLoen'
  > | undefined,
  source: Readonly<{ kind: SfggSourceKind }>
): Readonly<{
  divisorDage: number;
  divisorLabel: 'kalenderdage' | 'arbejdsdage';
  kalenderdage: number;
  hverdage: number;
  shDage: number;
  feriedage: number;
  oevrigeFravaersdage: number;
}> | null => {
  if (!row?.sfggReferenceperiodeFra || !row.sfggReferenceperiodeTil || row.sfggReferenceperiodeFra > row.sfggReferenceperiodeTil) return null;
  const breakdown = optaelArbejdsdageBreakdown({
    fra: row.sfggReferenceperiodeFra,
    til: row.sfggReferenceperiodeTil,
    // SFGG-referenceperioden må bruge TAF-forløbets ferieperioder som fradrag, men aldrig
    // TAF-beregningsperiodens datoer som fallback eller input, jf. EO-snapshot-kontrakten §11.
    ferieperioder: values.ferieperioder ?? [],
    loseFeriedage: 0,
    context: { kind: 'beregningsgrundlag', oevrigeFravaersdage: row.sfggReferenceperiodeFravaersdageUdenLoen ?? 0 },
  });
  if (!breakdown) return null;
  const dayBasis = resolveSfggDayBasis(source, computeTafBeregningsenhed(values));
  const fraDate = parseISODate(row.sfggReferenceperiodeFra);
  const tilDate = parseISODate(row.sfggReferenceperiodeTil);
  const kalenderdage = fraDate && tilDate ? countInclusiveUtcDays(fraDate, tilDate) ?? 0 : 0;
  const kalenderFerieDage = fraDate && tilDate
    ? buildFerieDageSet(values.ferieperioder ?? [], buildDatoSetInclusiveFromDates(fraDate, tilDate), { includeWeekends: true }).size
    : 0;
  const divisorDage = dayBasis === 'kalenderdage'
    ? Math.max(0, kalenderdage - kalenderFerieDage - breakdown.oevrigeFravaersdage)
    : Math.max(0, breakdown.tafDage);
  return {
    divisorDage,
    divisorLabel: dayBasis,
    kalenderdage,
    hverdage: breakdown.arbejdsdage,
    shDage: breakdown.shDage,
    feriedage: dayBasis === 'kalenderdage' ? kalenderFerieDage : breakdown.feriedage,
    oevrigeFravaersdage: breakdown.oevrigeFravaersdage,
  };
};

export const getFirstIndtastedeTafFraDato = (
  values: ErstatningsopgoerelseValues
): ISODateString | undefined => {
  const dates = (values.tafPerioder ?? []).map((row) => row.fra).filter((value): value is ISODateString => value !== undefined);
  return dates.length === 0 ? undefined : dates.reduce((earliest, current) => current < earliest ? current : earliest);
};

export const resolveSfggReferenceperiodeMaxDate = (
  values: ErstatningsopgoerelseValues
): ISODateString | undefined => getDayBeforeIso(getFirstIndtastedeTafFraDato(values));

export type SfggReferenceLoenCalculator = Readonly<{
  sumLoenInRangesKroner: (ranges: readonly Readonly<{ fra: ISODateString; til: ISODateString }>[]) => number;
}>;

export const resolveSfggBaseRate = (
  values: ErstatningsopgoerelseValues,
  employment: LoenindkomstAnsaettelsesforhold,
  sfggRow: SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined,
  sfggSource: Readonly<{ kind: SfggSourceKind }>,
  calculator: SfggReferenceLoenCalculator
): Readonly<{
  sfggReferenceperiode: { fra: ISODateString; til: ISODateString } | null;
  sfggReferencesatsOre: SfggReferencesatsCalculable;
  sfggReferencesatsFormula: SfggReferencesatsFormula | null;
}> => {
  const { rateModel } = getSfggKildeSpec(sfggSource.kind);
  if (rateModel === 'manuel') {
    const manual = amountValueToNumber(sfggRow?.sfggManuelDagssats);
    return {
      sfggReferenceperiode: null,
      sfggReferencesatsOre: manual !== undefined ? calculableSfggReferencesats(fromKroner(roundKroner(manual))) : notCalculableSfggReferencesats('missing_rate'),
      sfggReferencesatsFormula: null,
    };
  }
  if (rateModel === 'per_periode_overenskomst') {
    return { sfggReferenceperiode: null, sfggReferencesatsOre: notCalculableSfggReferencesats('per_period_rate'), sfggReferencesatsFormula: null };
  }
  if (
    !sfggRow?.sfggReferenceperiodeFra
    || !sfggRow.sfggReferenceperiodeTil
    || sfggRow.sfggReferenceperiodeFra > sfggRow.sfggReferenceperiodeTil
  ) {
    return { sfggReferenceperiode: null, sfggReferencesatsOre: notCalculableSfggReferencesats('missing_referenceperiode'), sfggReferencesatsFormula: null };
  }
  const dayCount = resolveSfggReferenceperiodeDayCount(values, sfggRow, sfggSource);
  if (!dayCount) {
    return {
      sfggReferenceperiode: { fra: sfggRow.sfggReferenceperiodeFra, til: sfggRow.sfggReferenceperiodeTil },
      sfggReferencesatsOre: notCalculableSfggReferencesats('unresolvable_referenceperiode'),
      sfggReferencesatsFormula: null,
    };
  }
  const loen = roundKroner(calculator.sumLoenInRangesKroner([{ fra: sfggRow.sfggReferenceperiodeFra, til: sfggRow.sfggReferenceperiodeTil }]));
  const feriepengeKroner = loen * SFGG_LOVBESTEMT_FERIEPENGE_DECIMAL;
  if (dayCount.divisorDage <= 0) {
    return {
      sfggReferenceperiode: { fra: sfggRow.sfggReferenceperiodeFra, til: sfggRow.sfggReferenceperiodeTil },
      sfggReferencesatsOre: notCalculableSfggReferencesats(dayCount.divisorLabel === 'kalenderdage' ? 'no_calendar_days' : 'no_workdays'),
      sfggReferencesatsFormula: null,
    };
  }
  return {
    sfggReferenceperiode: { fra: sfggRow.sfggReferenceperiodeFra, til: sfggRow.sfggReferenceperiodeTil },
    sfggReferencesatsOre: calculableSfggReferencesats(fromKroner(roundKroner(feriepengeKroner / dayCount.divisorDage))),
    sfggReferencesatsFormula: {
      loenPlusLoen2PlusIkkePensLoenKroner: loen,
      feriePctDecimal: SFGG_LOVBESTEMT_FERIEPENGE_DECIMAL,
      feriepengeKroner,
      ...dayCount,
    },
  };
};
