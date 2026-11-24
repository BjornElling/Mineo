import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { addMonths } from '../../../utils/dateUtils';
import { dateToISO, isoToDanish, parseISODate, type ISODateString } from '../../../types/branded';
import { parseAarsloenRowInterval, ansaettelsesforholdNavne, resolveAnsaettelsesforholdNavn } from '../helpers/indtaegtPerioder';
import { erSfggFeltRelevant } from '../helpers/eoLoenindkomstRelevance';
import { shouldRequireSygeferiegodtgoerelseInput } from '../helpers/sygeferiegodtgoerelseEligibility';
import type { SygeferiegodtgoerelseAnsaettelsesforholdResult, SygeferiegodtgoerelseResult } from './sfggResult';
import { hasPositiveSfggIncome } from './sfggPeriodisering';
import { resolveSfggSource, sfggKildeUsesReferenceperiode } from './sfggKilde';
import { resolveLoenudviklingKilde, getAngivetLoenOpreguleresFraDato } from '../helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from '../helpers/eoSharedUtils';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { formatCurrency } from '../../../utils/formatUtils';
import { roundKroner } from '../../money/money';
import { buildEmploymentSfggCalculator } from './sfggSegmentering';
import { optaelArbejdsdageBreakdown } from './periodiseringsMotor';
import { mergeIsoDateRanges } from './isoRangeAlgebra';

type Employment = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

/**
 * Seksmånedersadvarslen skal afspejle, at der ikke længere er NOGEN form for lønydelse fra arbejdsgiveren
 * (udvikleren 2026-10-30, BB-325). Ud over lønkolonnerne tæller derfor også tillæg og arbejdsgiverpension, men
 * kun i Beløb-tilstand, hvor de er indtastede beløb; i Procent-tilstand er de afledt af lønkolonnerne. Bevidst
 * bredere end `hasPositiveSfggIncome`, som afgrænser selve beregningen og ikke ændres af advarslen.
 */
const hasPositiveEmployerPayment = (row: Employment['indtaegtsoplysningerTableData'][number], employment: Employment): boolean =>
  hasPositiveSfggIncome(row)
  || (employment.tillaegAngivesSom === 'beloeb'
    && [row.fpFvShSoBeloeb, row.pensionBeloeb].some((value) => (amountValueToNumber(value) ?? 0) > 0));

const getLastIncomeDate = (employment: Employment): ISODateString | null => {
  let latest: ISODateString | null = null;
  for (const row of employment.indtaegtsoplysningerTableData ?? []) {
    if (!hasPositiveEmployerPayment(row, employment)) continue;
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
    // Uden registreret løn regnes de seks måneder fra sygeferiegodtgørelsens første dag (BB-325, 2026-10-30).
    const anchor = getLastIncomeDate(employment) ?? calculation.segments[0]?.fra;
    if (!anchor) continue;
    const date = parseISODate(anchor);
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

/**
 * En dags løn efter ansættelsesforholdets registrerede lønrækker, opgjort som SFGG-referencesatsen deler løn med
 * dage (`resolveSfggBaseRate`): motorens løn (`buildEmploymentSfggCalculator`) over lønrækkernes samlede
 * periode delt med periodens arbejdsdage efter søgnehelligdage og ferie. Den manuelle dagssats gælder pr.
 * arbejdsdag («mandag-fredag»; `resolveSfggDayBasis` giver altid arbejdsdage ved manuel kilde). `undefined`, når
 * lønrækkerne ikke giver en positiv løn over mindst én arbejdsdag.
 */
export const resolveSfggRegistreretDagloen = (
  employment: Employment,
  ferieperioder: ErstatningsopgoerelseValues['ferieperioder'],
): number | undefined => {
  const ranges = mergeIsoDateRanges(
    (employment.indtaegtsoplysningerTableData ?? []).flatMap((row) => {
      const interval = parseAarsloenRowInterval(row, employment.loenperiode);
      const fra = interval ? dateToISO(interval.start) : undefined;
      const til = interval ? dateToISO(interval.end) : undefined;
      return fra && til && fra <= til ? [{ fra, til }] : [];
    }),
    { mergeAdjacent: true },
  );
  if (ranges.length === 0) return undefined;
  const loen = buildEmploymentSfggCalculator(employment, ferieperioder).sumLoenInRangesKroner(ranges);
  const dage = ranges.reduce((sum, range) => sum + (optaelArbejdsdageBreakdown({
    fra: range.fra,
    til: range.til,
    ferieperioder: ferieperioder ?? [],
    loseFeriedage: 0,
    context: { kind: 'taf' },
  })?.tafDage ?? 0), 0);
  if (!Number.isFinite(loen) || loen <= 0 || dage <= 0) return undefined;
  return roundKroner(loen / dage);
};

export type SfggManuelDagssatsAdvarsel = Readonly<{
  employmentId: string;
  dagssats: number;
  dagloen: number;
}>;

/**
 * Udviklerafgørelse 2026-11-24 (BB-450): en manuelt angivet dagssats over en dags registreret løn fra samme
 * ansættelsesforhold er usædvanlig – typisk en ekstra nulgruppe. Gul ring og gul linje; satsen kan fortsat bruges.
 */
export const resolveSfggManuelDagssatsAdvarsler = (
  values: ErstatningsopgoerelseValues,
): readonly SfggManuelDagssatsAdvarsel[] =>
  values.loenindkomstAnsaettelsesforhold.flatMap((employment) => {
    if (!shouldRequireSygeferiegodtgoerelseInput(values, employment)) return [];
    const row = values.sfggAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === employment.id);
    if (resolveSfggSource(row, employment).kind !== 'manuel') return [];
    if (!erSfggFeltRelevant('manuel', {
      kravPaaTabtArbejdsfortjeneste: values.kravPaaTabtArbejdsfortjeneste,
      employment,
      sfggBeregningskilde: row?.sfggBeregningskilde,
    })) return [];
    const indtastet = amountValueToNumber(row?.sfggManuelDagssats);
    if (indtastet === undefined || !Number.isFinite(indtastet) || indtastet <= 0) return [];
    // Samme afrunding som motorens sats (`resolveSfggBaseRate`), så det viste beløb er det sammenlignede.
    const dagssats = roundKroner(indtastet);
    const dagloen = resolveSfggRegistreretDagloen(employment, values.ferieperioder);
    return dagloen !== undefined && dagssats > dagloen ? [{ employmentId: employment.id, dagssats, dagloen }] : [];
  });

export const buildSfggManuelDagssatsBesked = (advarsel: Pick<SfggManuelDagssatsAdvarsel, 'dagssats' | 'dagloen'>): string =>
  `Dagssatsen (${formatCurrency(advarsel.dagssats)} kr.) er højere end en dags løn (${formatCurrency(advarsel.dagloen)} kr.)`
  + ' – kontrollér beløbet';

export const buildSfggGammelReferenceperiodeBesked =(reguleringsdato: ISODateString): string =>
  `Referenceperioden slutter mere end 12 måneder før reguleringsdatoen (${isoToDanish(reguleringsdato) ?? reguleringsdato})`
  + ' – satsen er regnet med lønnen på reguleringsdatoen uden regulering';

/**
 * Seksmånedersadvarslen siger, hvad der er sket, og hvad brugeren kan gøre: ingen løn efter en dato, og at et
 * ophør angives under «Opsagt fra stillingen», hvor retten da ophører. Den gamle tekst nævnte hverken ophør eller
 * hvilken periode, der skulle kontrolleres, og stod med hver sin ordlyd på kortet og i boksen (BB-325).
 */
export const buildSfggSeksMaanederBesked = (
  values: Pick<ErstatningsopgoerelseValues, 'loenindkomstAnsaettelsesforhold'>,
  employment: Employment,
): string => {
  const lastIncomeDate = getLastIncomeDate(employment);
  const navn = resolveAnsaettelsesforholdNavn(
    employment.navnPaaArbejdssted,
    values.loenindkomstAnsaettelsesforhold.findIndex((entry) => entry.id === employment.id),
    ansaettelsesforholdNavne(values.loenindkomstAnsaettelsesforhold),
  );
  const efter = lastIncomeDate ? ` efter ${isoToDanish(lastIncomeDate) ?? lastIncomeDate}` : '';
  return `Der er ikke registreret løn fra ${navn}${efter}. `
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
