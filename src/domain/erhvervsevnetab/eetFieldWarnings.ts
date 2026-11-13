import { createFieldWarning, type FieldWarning } from '../../inputCore/fieldWarning';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { coerceToISODateString, type ISODateString } from '../../types/branded';
import type { AslAfgoerelseRow } from '../../schemas/formSchemas';
import { isEndeligUnderToAarTilFp } from './eetAslAfgoerelser';
import { isoYear } from '../../utils/isoDateHelpers';
import { aarsloenAslMax, type YearlyRate } from '../../data/lovbestemteRates';
import { resolveAslAarsloensmaksimumForAar } from '../satser/aslAarsloensmaksimum';
import { ASL_AARSLOEN_MAX_NOTICE } from '../aslEalAarsloen/aslAarsloenMaxNotice';
import { SKADELIDTES_AARSLOEN_EAL_LABEL } from '../aslEalAarsloen/aarsloenLabels';
import { SKAERING_2024_07_01 } from './eetSkaeringsdatoer';
import { formatISOToDanish } from '../../utils/dateFormatting';
import { getToAarsgraenseFoerFolkepension } from '../../data/folkepensionAlderRates';
import { KAP_DATO_EFTER_AFGOERELSESDATO_WARNING_ID, KAP_DATO_INDEN_FOR_TO_AAR_WARNING_ID } from './eetIssueCatalog';

type KapitaliseringsPctRow = Readonly<{ rowId: string; kapitaliseringspct: number }>;

/**
 * De EET-procenter, loven ikke tillader, men programmet alligevel regner på, advares gult – ikke rødt.
 *
 * Mindstegrænserne og de faste procentsatser kan juridisk ikke fraviges, men en teoretisk beregning
 * af en sådan værdi skal være mulig. Derfor advares der i stedet for at kalde en værdi «ugyldig», som
 * programmet i samme åndedrag regner på og trykker (BB-158).
 *
 * Advarslerne bærer bevidst INGEN hale om, at «beregningen derfor ikke er lovmæssig» (BB-173):
 * hvad der kan bruges juridisk, er brugerens vurdering, ikke programmets, og halen gav to advarsler
 * om samme grænse hver sin alvorsgrad. Advarslen navngiver grænsen; konsekvensen kender brugeren.
 * Tilføj den ikke igen – heller ikke for en enkelt advarsel.
 *
 * Kun EET-procentens FORM er en rød fejl: den skal være delelig med 5, større end 0 og højst 100.
 */

/** Kanonisk, ikke-blokerende feltadvarsel for EET-procenter under lovens minimum. */
export const EET_UNDER_15_WARNING = 'Der kan ikke tilkendes erhvervsevnetab under 15 %';

export const resolveEetUnder15Warning = (value: number | undefined): FieldWarning | undefined =>
  value !== undefined && value > 0 && value < 15 ? createFieldWarning(EET_UNDER_15_WARNING) : undefined;

/**
 * Kanonisk advarsel for en EET-procent uden for de faste trin, der gælder skader fra 1. juli 2024.
 *
 * Fra den dato fastsættes erhvervsevnetabet i trin af 10 %. Reglen afhænger af SKADEDATOEN, som ikke
 * står i den celle, brugeren taster i, så advarslen skal stå ved feltet – ellers får han en neutral
 * celle og opdager det først på en anden fane (BB-158). 15 % er lovligt uanset trinreglen.
 */
export const EET_TITRIN_FRA_2024_WARNING =
  'Erhvervsevnetab fastsættes i trin af 10 % for skader fra 1. juli 2024';

export const harEetTitrinAfvigelse = (
  value: number | undefined,
  skadedato: ISODateString | undefined
): boolean =>
  value !== undefined &&
  skadedato !== undefined &&
  skadedato >= SKAERING_2024_07_01 &&
  value > 15 &&
  value % 10 !== 0;

export const resolveEetTitrinWarning = (
  value: number | undefined,
  skadedato: ISODateString | undefined
): FieldWarning | undefined =>
  harEetTitrinAfvigelse(value, skadedato) ? createFieldWarning(EET_TITRIN_FRA_2024_WARNING) : undefined;

/**
 * Advarslen når en af sagens datoer ligger efter beregningsdatoen.
 *
 * Tidligere stod tre linjer over hinanden – en pr. datotype – i en boks på de faner, brugeren IKKE
 * taster på, mens alle tre celler stod neutrale. Tre linjer om én årsag læses som tre problemer, og
 * den ene rettelse (beregningsdatoen) blev ikke navngivet (BB-159). Nu siger boksen årsagen én
 * gang, og hver af de tre datoceller bærer sin egen gule feltadvarsel, hvor brugeren sidder.
 */
export const formatDatoEfterBeregningsdatoWarning = (beregningsdato: ISODateString): string =>
  `En eller flere datoer i ASL-afgørelserne ligger efter beregningsdatoen (${formatISOToDanish(beregningsdato)}).`;

export const formatDatoEfterBeregningsdatoFeltWarning = (
  datoLabel: string,
  beregningsdato: ISODateString
): string => `${datoLabel} ligger efter beregningsdatoen (${formatISOToDanish(beregningsdato)})`;

export const resolveDatoEfterBeregningsdatoWarning = (
  dato: ISODateString | undefined,
  beregningsdato: ISODateString | undefined,
  datoLabel: string
): FieldWarning | undefined =>
  dato !== undefined && beregningsdato !== undefined && dato > beregningsdato
    ? createFieldWarning(formatDatoEfterBeregningsdatoFeltWarning(datoLabel, beregningsdato))
    : undefined;

/**
 * Kanonisk advarsel for en kapitaliseringsdato efter afgørelsesdatoen.
 *
 * Kapitalisering sker her som udgangspunkt på afgørelsesdatoen, men en senere dato er tilladt og lægges til
 * grund i beregningen (udviklerafgørelse 2026-11-13). Derfor gul, ikke rød.
 */
export const KAP_DATO_EFTER_AFGOERELSESDATO_UNDER_TO_AAR_WARNING =
  'Ved ≤ 2 år til folkepension sker kapitalisering som udgangspunkt på afgørelsesdatoen';

export const KAP_DATO_EFTER_AFGOERELSESDATO_GENOPTAGELSE_WARNING =
  'Ved genoptagelse fra 1. juli 2024 sker kapitalisering som udgangspunkt på afgørelsesdatoen';

const resolveKapDatoEfterAfgoerelsesdatoText = (
  row: AslAfgoerelseRow,
  skadedato: ISODateString | undefined,
  fodselsdato: ISODateString | undefined
): string | undefined => {
  const kapDato = coerceToISODateString(row.kapDato);
  const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato);
  if (kapDato === undefined || afgoerelsesdato === undefined || kapDato <= afgoerelsesdato) return undefined;
  // Genoptagelsesreglen gælder også uden for 2-årsvinduet og ved delvist endelige afgørelser.
  if ((row.afgoerelseType === 'Endelig' || row.afgoerelseType === 'Delvist endelig')
    && coerceToISODateString(row.tidlKapDato) !== undefined && afgoerelsesdato >= SKAERING_2024_07_01) {
    return KAP_DATO_EFTER_AFGOERELSESDATO_GENOPTAGELSE_WARNING;
  }
  return isEndeligUnderToAarTilFp(row, skadedato, fodselsdato)
    ? KAP_DATO_EFTER_AFGOERELSESDATO_UNDER_TO_AAR_WARNING
    : undefined;
};

/**
 * Advarsel for en kapitaliseringsdato inden for de sidste to år før folkepensionsalderen.
 *
 * Kapitalisering er her som udgangspunkt udelukket, men advarslen blokerer ikke (udviklerafgørelse
 * 2026-11-13). Den vises IKKE, når kapitaliseringen netop er påkrævet efter toårsreglen – så ville
 * brugeren både få et krav om at udfylde feltet og en advarsel om, at det er udelukket. Ukendt
 * skadedato giver ingen advarsel, fordi det så ikke kan afgøres, om kapitaliseringen er påkrævet.
 */
export const KAP_DATO_INDEN_FOR_TO_AAR_WARNING =
  'Kapitalisering inden for de sidste to år før folkepensionsalderen er som udgangspunkt udelukket';

const resolveKapDatoIndenForToAarText = (
  row: AslAfgoerelseRow,
  skadedato: ISODateString | undefined,
  fodselsdato: ISODateString | undefined
): string | undefined => {
  const kapDato = coerceToISODateString(row.kapDato);
  if (kapDato === undefined || skadedato === undefined || fodselsdato === undefined
    || (row.afgoerelseType !== 'Endelig' && row.afgoerelseType !== 'Delvist endelig')
    || isEndeligUnderToAarTilFp(row, skadedato, fodselsdato)) return undefined;
  const graensedato = getToAarsgraenseFoerFolkepension(fodselsdato, kapDato);
  return graensedato !== undefined && kapDato >= graensedato
    ? `Kapitalisering inden for de sidste to år før folkepensionsalderen (fra ${formatISOToDanish(graensedato)}) er som udgangspunkt udelukket`
    : undefined;
};

/**
 * Kap.dato-cellens ene gule advarsel. Rækkefølgen er bevidst: reglen om datovalget ved afgørelsen
 * vinder over toårsvinduet, som vinder over beregningsdatoen – de to første angår selve kapitaliseringen.
 */
export const resolveKapDatoFeltWarning = (
  row: AslAfgoerelseRow,
  skadedato: ISODateString | undefined,
  fodselsdato: ISODateString | undefined,
  beregningsdato: ISODateString | undefined
): FieldWarning | undefined => {
  const text = resolveKapDatoEfterAfgoerelsesdatoText(row, skadedato, fodselsdato)
    ?? resolveKapDatoIndenForToAarText(row, skadedato, fodselsdato);
  return text !== undefined
    ? createFieldWarning(text)
    : resolveDatoEfterBeregningsdatoWarning(coerceToISODateString(row.kapDato), beregningsdato, 'Kapitaliseringsdatoen');
};

/**
 * Fanernes advarselslinjer for de to kapitaliseringsdato-advarsler, med den første berørte række som
 * fokusmål. Samme regler som cellen, så linje og gul ring altid følges ad.
 */
export const collectKapDatoWarnings = (
  rows: readonly AslAfgoerelseRow[],
  skadedato: ISODateString | undefined,
  fodselsdato: ISODateString | undefined
): readonly Readonly<{ id: string; message: string; rowId: string }>[] => {
  const result: Readonly<{ id: string; message: string; rowId: string }>[] = [];
  const efter = rows.find((row) => resolveKapDatoEfterAfgoerelsesdatoText(row, skadedato, fodselsdato) !== undefined);
  if (efter) {
    result.push({
      id: KAP_DATO_EFTER_AFGOERELSESDATO_WARNING_ID,
      message: resolveKapDatoEfterAfgoerelsesdatoText(efter, skadedato, fodselsdato)!,
      rowId: efter.id,
    });
  }
  const indenFor = rows.find((row) => resolveKapDatoIndenForToAarText(row, skadedato, fodselsdato) !== undefined);
  if (indenFor) {
    result.push({ id: KAP_DATO_INDEN_FOR_TO_AAR_WARNING_ID, message: KAP_DATO_INDEN_FOR_TO_AAR_WARNING, rowId: indenFor.id });
  }
  return result;
};

/** Kanonisk advarsel for en selvstændig kapitalisering under den lovbestemte tærskel. */
export const KAPITALISERING_UNDER_15_WARNING = 'Der er angivet kapitalisering med mindre end 15 %';

/**
 * Returnerer de kapitaliseringsrækker, der skal fremhæves.
 *
 * En forhøjelse fra fx 20 % til 30 % kan lovligt kapitalisere de yderligere 10 %. Derfor gælder
 * advarslen alene den første kapitalisering og den samlede kapitalisering – aldrig en senere
 * delkapitalisering isoleret. Rækkerne kommer fra kapitaliseringsmotorens færdige rækkefølge, så
 * feltadvarslen og resultatfanen vurderer nøjagtigt den samme kapitalisering.
 */
export const kapitaliseringUnder15WarningRowIds = (
  rows: readonly KapitaliseringsPctRow[]
): ReadonlySet<string> => {
  const first = rows[0];
  if (first === undefined) return new Set();
  const total = rows.reduce((sum, row) => sum + row.kapitaliseringspct, 0);
  if (first.kapitaliseringspct >= 15 && total >= 15) return new Set();
  // Summen under 15 indebærer altid også en første kapitalisering under 15, fordi alle kapitaliseringer
  // er positive. Begge betingelser står med vilje eksplicit, så den juridiske regel ikke forsvinder i en
  // senere refaktorering af rækkernes repræsentation.
  return new Set([first.rowId]);
};

export const resolveKapitaliseringUnder15Warning = (
  rowId: string,
  rows: readonly KapitaliseringsPctRow[]
): FieldWarning | undefined => kapitaliseringUnder15WarningRowIds(rows).has(rowId)
  ? createFieldWarning(KAPITALISERING_UNDER_15_WARNING)
  : undefined;

/**
 * Feltbeskeden når ASL-årslønnen står på skadesårets maksimum.
 *
 * Teksten ejes af det DELTE årslønsfelt, ikke af denne flade (BB-124): Forsørgertab havde sin egen,
 * handlingsanvisende formulering for præcis samme situation, og de to nåede hver sin halvdel af brugerne.
 * Skriv ikke en flade-lokal variant igen – ret den fælles konstant.
 */
export const EET_ASL_AARSLOEN_MAX_WARNING = ASL_AARSLOEN_MAX_NOTICE;

/**
 * Samme trigger som beregningens `warn-asl-aarsloen-is-max`, samlet så feltvisningen og beregningen ikke kan drifte.
 * EAL-feltet skal være tomt, fordi en allerede indtastet EAL-årsløn er det eksplicitte valg, advarslen skal opfordre
 * brugeren til at træffe.
 */
export const hasEetAslAarsloenMaxWarning = (
  aslAarsloen: AmountValue | undefined,
  ealAarsloen: AmountValue | undefined,
  skadedato: ISODateString | undefined,
  aslAarsloenMax: YearlyRate = aarsloenAslMax,
): boolean => {
  const aslAarsloenValue = amountValueToNumber(aslAarsloen);
  const ealAarsloenValue = amountValueToNumber(ealAarsloen);
  if (ealAarsloenValue !== undefined || aslAarsloenValue === undefined || skadedato === undefined) {
    return false;
  }

  const maxAarsloen = resolveAslAarsloensmaksimumForAar(isoYear(skadedato), aslAarsloenMax);
  return maxAarsloen !== undefined && aslAarsloenValue === maxAarsloen;
};

/**
 * Feltbeskeden når EAL-årslønnen SELV står på skadesårets ASL-maksimum.
 *
 * Den er den anden halvdel af samme regel som `hasEetAslAarsloenMaxWarning` (BB-183): dér er
 * EAL-feltet tomt, og ASL-årslønnen står på maksimum, så advarslen opfordrer til at udfylde
 * EAL-feltet med den fulde årsløn. Her HAR brugeren udfyldt det – men med netop maks. årslønnen
 * efter ASL, altså det tal, advarslen bad ham om ikke at bruge. De to tilstande er lige forkerte og
 * skal derfor se lige ens ud på feltet; før BB-183 fik kun den første en gul ring, mens den anden
 * kun stod som en linje i «Fejl og advarsler» på to resultatfaner, brugeren ikke behøver åbne.
 *
 * Teksten er beregningens egen (`warn-eal-aarsloen-is-max`), ikke ASL-halvdelens: den navngiver det
 * felt, ringen sidder på, og siger hvad der skal stå i det.
 */
export const EET_EAL_AARSLOEN_MAX_WARNING =
  `${SKADELIDTES_AARSLOEN_EAL_LABEL} skal udfyldes med den fulde årsløn – ikke maks. årslønnen efter ASL`;

export const hasEetEalAarsloenMaxWarning = (
  ealAarsloen: AmountValue | undefined,
  skadedato: ISODateString | undefined,
  aslAarsloenMax: YearlyRate = aarsloenAslMax,
): boolean => {
  const ealAarsloenValue = amountValueToNumber(ealAarsloen);
  if (ealAarsloenValue === undefined || !Number.isFinite(ealAarsloenValue) || skadedato === undefined) {
    return false;
  }

  const maxAarsloen = resolveAslAarsloensmaksimumForAar(isoYear(skadedato), aslAarsloenMax);
  return maxAarsloen !== undefined && ealAarsloenValue === maxAarsloen;
};

/**
 * Den gule ring på EAL-årslønsfeltet – én af de to halvdele af maksimum-reglen, aldrig begge.
 *
 * Rækkefølgen spejler beregningens (`eetEalCalculation.ts`): en udfyldt EAL-årsløn på maksimum er
 * det konkrete problem, og først når feltet er tomt, handler advarslen om ASL-årslønnen. Ringen
 * sidder på EAL-feltet i begge tilfælde, fordi det er der, rettelsen skal foretages.
 */
export const resolveEetAslAarsloenMaxWarning = (
  aslAarsloen: AmountValue | undefined,
  ealAarsloen: AmountValue | undefined,
  skadedato: ISODateString | undefined,
): FieldWarning | undefined => {
  if (hasEetEalAarsloenMaxWarning(ealAarsloen, skadedato)) {
    return createFieldWarning(EET_EAL_AARSLOEN_MAX_WARNING);
  }
  return hasEetAslAarsloenMaxWarning(aslAarsloen, ealAarsloen, skadedato)
    ? createFieldWarning(EET_ASL_AARSLOEN_MAX_WARNING)
    : undefined;
};
