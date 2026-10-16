import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { addMonths } from '../../../utils/dateUtils';
import { dateToISO, parseISODate, type ISODateString } from '../../../types/branded';
import { parseAarsloenRowInterval } from '../helpers/indtaegtPerioder';
import type { SygeferiegodtgoerelseResult } from './sfggResult';
import { hasPositiveSfggIncome } from './sfggPeriodisering';
import { resolveSfggSource, sfggKildeUsesReferenceperiode } from './sfggKilde';
import { resolveLoenudviklingKilde, getAngivetLoenOpreguleresFraDato } from '../helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from '../helpers/eoSharedUtils';

const getLastIncomeDate = (
  employment: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
): ISODateString | null => {
  let latest: ISODateString | null = null;
  for (const row of employment.indtaegtsoplysningerTableData ?? []) {
    if (!hasPositiveSfggIncome(row)) continue;
    const interval = parseAarsloenRowInterval(row, employment.loenperiode);
    if (!interval) continue;
    const iso = dateToISO(interval.end);
    if (iso && (latest === null || iso > latest)) latest = iso;
  }
  return latest;
};

export const findSfggSixMonthWarningEmploymentIds = (args: Readonly<{
  values: ErstatningsopgoerelseValues;
  result: SygeferiegodtgoerelseResult;
}>): readonly string[] => {
  const warningIds: string[] = [];
  for (const employment of args.values.loenindkomstAnsaettelsesforhold ?? []) {
    const calculation = args.result.perAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === employment.id);
    if (!calculation || calculation.segments.length === 0) continue;
    const lastIncomeDate = getLastIncomeDate(employment);
    if (!lastIncomeDate) continue;
    const date = parseISODate(lastIncomeDate);
    if (!date) continue;
    const thresholdIso = dateToISO(addMonths(date, 6));
    const latestSegmentDate = calculation.segments[calculation.segments.length - 1]?.til;
    if (thresholdIso && latestSegmentDate && latestSegmentDate > thresholdIso) warningIds.push(employment.id);
  }
  return warningIds;
};

/** Referenceperioder over 12 måneder før et manuelt grundlag kræver en synlig advarsel. */
export const findSfggManualReferenceWarningEmploymentIds = (args: Readonly<{
  values: ErstatningsopgoerelseValues;
  stamdata: StamdataValues;
}>): readonly string[] => {
  const { values, stamdata } = args;
  const kilder = resolveLoenudviklingKilde(values);
  return values.loenindkomstAnsaettelsesforhold.flatMap((employment) => {
    const row = values.sfggAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === employment.id);
    if (!sfggKildeUsesReferenceperiode(resolveSfggSource(row, employment).kind)) return [];
    const kilde = values.beregnesUdFra === 'Beregningsperiode'
      ? kilder.find((entry) => entry.id === employment.id) : kilder[0];
    if (kilde?.loenudviklingBeregningsgrundlag !== 'Manuelt angivet'
      && kilde?.loenudviklingBeregningsgrundlag !== 'Manuel procentsats') return [];
    const reguleringsdato = resolveAnvendtReguleringsdato({
      beregnesUdFra: values.beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
      saerligFraDatoRegulering: kilde.saerligFraDatoRegulering,
      beregningsperiodeTil: values.tafBeregningsperiodeTil,
      skadedato: stamdata.skadedato,
    });
    const referenceDate = row?.sfggReferenceperiodeTil && parseISODate(row.sfggReferenceperiodeTil);
    const threshold = referenceDate ? dateToISO(addMonths(referenceDate, 12)) : undefined;
    return threshold && reguleringsdato && threshold < reguleringsdato ? [employment.id] : [];
  });
};
