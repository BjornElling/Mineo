import type { ErstatningsopgoerelseValues, StandardLoenTableRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { dateToISO } from '../../../types/branded';
import {
  calculateStandardLoenProjectedAmounts,
  calculateStandardLoenRowDerived,
  roundStandardLoenAmountToTwoDecimals,
  type StandardLoenRowDerived,
} from '../../aarsloen/standardLoenRowCalculations';
import { buildLoenArbejdsdageSet } from '../engines/periodiseringsMotor';
import { parseAarsloenRowInterval } from '../../aarsloen/aarsloenRowInterval';
import { buildLoenindkomstRateSegments } from './loenindkomstSatser';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from './tafBeregningsenhed';
import { iterateDatesInclusive } from '../../../utils/isoDateHelpers';

type LoenindkomstAnsaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
type LoenindkomstDerivedContext = Pick<
  ErstatningsopgoerelseValues,
  'beregnesUdFra' | 'tafBeregningsperiodeFra' | 'tafBeregningsperiodeTil' | 'loenindkomstAnsaettelsesforhold' | 'ferieperioder' | 'fravaerPerioder'
>;

const buildKalenderdage = (row: StandardLoenTableRow, ansaettelsesforhold: LoenindkomstAnsaettelsesforhold): readonly ISODateString[] => {
  const interval = parseAarsloenRowInterval(row, ansaettelsesforhold.loenperiode);
  if (!interval) return [];

  const dates: ISODateString[] = [];
  iterateDatesInclusive(interval.start, interval.end, (date) => {
    const iso = dateToISO(date);
    if (iso) dates.push(iso);
  });
  return dates;
};

const buildAllocationDates = (
  row: StandardLoenTableRow,
  ansaettelsesforhold: LoenindkomstAnsaettelsesforhold,
  context: LoenindkomstDerivedContext
): readonly ISODateString[] => {
  const interval = parseAarsloenRowInterval(row, ansaettelsesforhold.loenperiode);
  if (!interval) return [];

  const fra = dateToISO(interval.start);
  const til = dateToISO(interval.end);
  if (!fra || !til) return [];

  const tafBeregningsenhed = computeTafBeregningsenhed({
    beregnesUdFra: context.beregnesUdFra,
    tafBeregningsperiodeFra: context.tafBeregningsperiodeFra,
    tafBeregningsperiodeTil: context.tafBeregningsperiodeTil,
    loenindkomstAnsaettelsesforhold: context.loenindkomstAnsaettelsesforhold ?? [],
  });

  if (tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE) {
    return Array.from(
      buildLoenArbejdsdageSet(
        { fra, til },
        [...(context.ferieperioder ?? []), ...(context.fravaerPerioder ?? [])]
      )
    ).sort();
  }

  return buildKalenderdage(row, ansaettelsesforhold);
};

export const calculateLoenindkomstRowDerived = (args: Readonly<{
  row: StandardLoenTableRow;
  ansaettelsesforhold: LoenindkomstAnsaettelsesforhold;
  context: LoenindkomstDerivedContext;
  skadedato?: ISODateString;
}>): StandardLoenRowDerived => {
  const { row, ansaettelsesforhold, context, skadedato } = args;
  const mode = ansaettelsesforhold.tillaegAngivesSom;
  const satser = {
    feriePct: ansaettelsesforhold.feriePct,
    fritvalgPct: ansaettelsesforhold.fritvalgPct,
    shSoPct: ansaettelsesforhold.shSoPct,
    storeBededagPct: ansaettelsesforhold.storeBededagPct,
    pensionPct: ansaettelsesforhold.pensionPct,
  };
  const interval = parseAarsloenRowInterval(row, ansaettelsesforhold.loenperiode);
  const fra = interval ? dateToISO(interval.start) : undefined;
  const til = interval ? dateToISO(interval.end) : undefined;
  const rateSegments = fra && til
    ? buildLoenindkomstRateSegments({
      ansaettelsesforhold,
      skadedato,
      fra,
      til,
    })
    : [];

  if (!interval || rateSegments.length === 0) {
    return calculateStandardLoenRowDerived(row, satser, { mode });
  }

  const allocationDates = buildAllocationDates(row, ansaettelsesforhold, context);
  if (allocationDates.length === 0) {
    return {
      loenPlusLoen2: 0,
      loenPlusLoen2PlusIkkePensLoen: 0,
      fpFvShSo: 0,
      pension: 0,
      samlet: 0,
    };
  }

  const projected = calculateStandardLoenProjectedAmounts(row, satser, {
    loenperiode: ansaettelsesforhold.loenperiode,
    allocationDates,
    rateSegments,
    mode,
  });

  return {
    loenPlusLoen2: roundStandardLoenAmountToTwoDecimals(projected.loenPlusLoen2),
    loenPlusLoen2PlusIkkePensLoen: roundStandardLoenAmountToTwoDecimals(projected.loenPlusLoen2PlusIkkePensLoen),
    fpFvShSo: roundStandardLoenAmountToTwoDecimals(projected.fpFvShSo),
    pension: roundStandardLoenAmountToTwoDecimals(projected.pension),
    samlet: roundStandardLoenAmountToTwoDecimals(projected.samlet),
  };
};
