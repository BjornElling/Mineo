import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { addMonths } from '../../../utils/dateUtils';
import { dateToISO, isoToDanish, parseISODate, type ISODateString } from '../../../types/branded';
import { parseAarsloenRowInterval, resolveAnsaettelsesforholdNavn } from '../helpers/indtaegtPerioder';
import { erSfggFeltRelevant } from '../helpers/eoLoenindkomstRelevance';
import { shouldRequireSygeferiegodtgoerelseInput } from '../helpers/sygeferiegodtgoerelseEligibility';
import type { SygeferiegodtgoerelseAnsaettelsesforholdResult, SygeferiegodtgoerelseResult } from './sfggResult';
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

export type SfggGammelReferenceperiodeAdvarsel = Readonly<{
  employmentId: string;
  reguleringsdato: ISODateString;
}>;

/**
 * Afklaringslog 8a (2026-10-13): ved de manuelle reguleringsformer regnes referenceperiodens løn som lønnen på
 * reguleringsdatoen. Slutter perioden mere end 12 måneder før, står satsen ureguleret over et år, og brugeren skal
 * advares (gul ring og gul linje). Reglen fandtes kun som en testet funktion, intet kaldte (BB-324).
 */
export const resolveSfggGamleReferenceperiodeAdvarsler = (args: Readonly<{
  values: ErstatningsopgoerelseValues;
  stamdata: Pick<StamdataValues, 'skadedato'>;
}>): readonly SfggGammelReferenceperiodeAdvarsel[] => {
  const { values, stamdata } = args;
  const kilder = resolveLoenudviklingKilde(values);
  return values.loenindkomstAnsaettelsesforhold.flatMap((employment) => {
    if (!shouldRequireSygeferiegodtgoerelseInput(values, employment)) return [];
    const row = values.sfggAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === employment.id);
    if (!sfggKildeUsesReferenceperiode(resolveSfggSource(row, employment).kind)) return [];
    if (!erSfggFeltRelevant('referenceperiode', {
      kravPaaTabtArbejdsfortjeneste: values.kravPaaTabtArbejdsfortjeneste,
      employment,
      sfggBeregningskilde: row?.sfggBeregningskilde,
    })) return [];
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
    return threshold && reguleringsdato && threshold < reguleringsdato
      ? [{ employmentId: employment.id, reguleringsdato }]
      : [];
  });
};

export const buildSfggGammelReferenceperiodeBesked = (reguleringsdato: ISODateString): string =>
  `Referenceperioden slutter mere end 12 måneder før reguleringsdatoen (${isoToDanish(reguleringsdato) ?? reguleringsdato})`
  + ' – satsen er regnet med lønnen på reguleringsdatoen uden regulering';

/**
 * Seksmånedersadvarslen siger, hvad der er sket, og hvad brugeren kan gøre: ingen løn efter en dato, og at et
 * ophør angives under «Opsagt fra stillingen», hvor retten da ophører. Den gamle tekst nævnte hverken ophør eller
 * hvilken periode, der skulle kontrolleres, og stod med hver sin ordlyd på kortet og i boksen (BB-325).
 */
export const buildSfggSeksMaanederBesked = (
  values: Pick<ErstatningsopgoerelseValues, 'loenindkomstAnsaettelsesforhold'>,
  employment: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number],
): string | undefined => {
  const lastIncomeDate = getLastIncomeDate(employment);
  if (!lastIncomeDate) return undefined;
  const navn = resolveAnsaettelsesforholdNavn(
    employment.navnPaaArbejdssted,
    values.loenindkomstAnsaettelsesforhold.findIndex((entry) => entry.id === employment.id),
  );
  return `Der er ikke registreret løn fra ${navn} efter ${isoToDanish(lastIncomeDate) ?? lastIncomeDate}. `
    + "Er skadelidte opsagt, angives det under 'Opsagt fra stillingen' – retten til sygeferiegodtgørelse ophører da.";
};

/**
 * «Først sygeferiegodtgørelse efter ophør af sygeløn» virker kun gennem lønrækker i erstatningsperioden: uden dem
 * beregnes perioden fuldt, og valget gør intet synligt (BB-326).
 */
export const SFGG_SYGELOEN_UDEN_LOENRAEKKER_BESKED =
  'Der er ikke registreret sygeløn i EO-perioden – angiv sygelønnen som lønrækker, ellers beregnes sygeferiegodtgørelse for hele perioden';

export const harSfggSygeloenUdenLoenraekker = (result: SygeferiegodtgoerelseAnsaettelsesforholdResult): boolean =>
  result.foerstEfterSygeloen && !result.sygeloenFratrukket && result.segments.length > 0;
