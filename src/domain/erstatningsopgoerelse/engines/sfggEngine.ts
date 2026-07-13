import { TODAY } from '../../../config/dateRanges';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { sortIsoDates } from '../../../utils/isoDateHelpers';
import type { ISODateString } from '../../../types/branded';
import { addMoneyOre, sumMoneyOre, zeroMoneyOre, type MoneyOre } from '../../money/money';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from '../helpers/tafBeregningsenhed';
import type { IsoRange } from '../validation/tafPeriodConstraints';
import { erDetteFoersteErstatningsopgoerelse } from '../validation/eoNummerValidering';
import { computeSfggForAnsaettelsesforhold } from './sfggAnsaettelsesforhold';
import { buildDateSetFromRanges } from './isoRangeAlgebra';
import { buildLoenArbejdsdageSet } from './periodiseringsMotor';
import { resolveSfggCapCutoffDate } from './sfggPeriodisering';
import { buildEmploymentSfggCalculator, type PerEmploymentLoenudvikling } from './sfggSegmentering';
import type {
  SygeferiegodtgoerelseAnsaettelsesforholdResult,
  SygeferiegodtgoerelseResult,
} from './sfggResult';

const EMPTY_RESULT: SygeferiegodtgoerelseResult = {
  totalOre: zeroMoneyOre(),
  perAnsaettelsesforhold: [],
  perYear: [],
  firstExcludedDate: null,
};

export const computeSygeferiegodtgoerelse = (args: Readonly<{
  values: ErstatningsopgoerelseValues;
  stamdata: StamdataValues;
  tafRanges: readonly IsoRange[];
  loenudviklingPerAnsaettelse?: ReadonlyMap<string, PerEmploymentLoenudvikling>;
}>): SygeferiegodtgoerelseResult => {
  const { values, stamdata, tafRanges } = args;
  if (tafRanges.length === 0) return EMPTY_RESULT;

  const tafDateSetIncludingFirstExcluded = buildDateSetFromRanges(tafRanges);
  const firstExcludedDate =
    stamdata.skadedato !== undefined
    && stamdata.skadedato >= '2015-01-01'
    && erDetteFoersteErstatningsopgoerelse(values.eoNummer)
      ? sortIsoDates(tafDateSetIncludingFirstExcluded)[0] ?? null
      : null;
  const tafDateSet = new Set<ISODateString>(tafDateSetIncludingFirstExcluded);
  if (firstExcludedDate) tafDateSet.delete(firstExcludedDate);

  const tafBeregningsenhed = computeTafBeregningsenhed(values);
  const tafArbejdsdageSetIncludingFirstExcluded = new Set<ISODateString>();
  for (const range of tafRanges) {
    for (const iso of buildLoenArbejdsdageSet(range, values.ferieperioder ?? [])) {
      if (tafDateSetIncludingFirstExcluded.has(iso)) tafArbejdsdageSetIncludingFirstExcluded.add(iso);
    }
  }
  const capReachedDate =
    stamdata.skadedato !== undefined && stamdata.skadedato < '2015-01-01'
      ? resolveSfggCapCutoffDate(
        tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER
          ? sortIsoDates(tafDateSetIncludingFirstExcluded)
          : sortIsoDates(tafArbejdsdageSetIncludingFirstExcluded),
        tafBeregningsenhed
      )
      : null;
  if (tafDateSet.size === 0) return { ...EMPTY_RESULT, firstExcludedDate };

  // Fradraget "feriepenge modtaget" bruger alle arbejdsgivere. Kalkulatorerne etableres én gang
  // globalt og gives eksplicit til hver ansættelsesberegning, så reglen ikke kan blive lokal.
  const alleAnsaettelserKalkulatorer = (values.loenindkomstAnsaettelsesforhold ?? []).map(
    (employment) => buildEmploymentSfggCalculator(employment, values.ferieperioder ?? [])
  );
  const perAnsaettelsesforhold: SygeferiegodtgoerelseAnsaettelsesforholdResult[] = [];
  const perYear = new Map<number, MoneyOre>();

  for (const employment of (values.loenindkomstAnsaettelsesforhold ?? []).filter((entry) => entry.ansatPaaSkadestidspunktet)) {
    const computation = computeSfggForAnsaettelsesforhold({
      values,
      employment,
      tafRanges,
      opgoerelsesdato: values.opgørelseLavetDen ?? TODAY,
      tafBeregningsenhed,
      firstExcludedDate,
      capReachedDate,
      tafDateSetIncludingFirstExcluded,
      tafArbejdsdageSetIncludingFirstExcluded,
      employmentCalculator: buildEmploymentSfggCalculator(employment, values.ferieperioder ?? []),
      alleAnsaettelserKalkulatorer,
      loenudvikling: args.loenudviklingPerAnsaettelse?.get(employment.id),
    });
    if (computation.status === 'skipped') continue;

    perAnsaettelsesforhold.push(computation.result);
    for (const entry of computation.result.perYear) {
      perYear.set(entry.year, addMoneyOre(perYear.get(entry.year) ?? zeroMoneyOre(), entry.amountOre));
    }
  }

  return {
    totalOre: sumMoneyOre(perAnsaettelsesforhold.map((entry) => entry.totalOre)),
    perAnsaettelsesforhold,
    perYear: [...perYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, amountOre]) => ({ year, amountOre })),
    firstExcludedDate,
  };
};
