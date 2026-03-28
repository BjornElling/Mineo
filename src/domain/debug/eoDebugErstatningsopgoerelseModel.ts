import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { FieldErrorBySource } from '../../types/fieldErrors';
import type { ISODateString } from '../../types/branded';
import { dateToISO, isISODateString, isoToDanish, parseISODate, subtractOneDay } from '../../types/branded';
import { svieSmertePrDag, svieSmerteMax } from '../../data/lovbestemteRates';
import { computeSkadesdatoMinRule, dateRanges_erstatningsopgoerelse, TODAY } from '../../config/dateRanges';
import { computeRowDateBounds } from '../erstatningsopgoerelse/rowDateBounds';
import { validateISODateRange } from '../../utils/isoDateHelpers';
import { detectConflictingSvieSmerteOverlaps, detectOverlappingPeriods } from '../erstatningsopgoerelse/periodOverlapDetection';
import { formatAsAmount, formatCurrency, formatPercent } from '../../utils/formatUtils';
import { addDays, addMonths, parseDanishDate } from '../../utils/dateUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { buildNoValidDateRangeMessage, collectPresentFieldErrors, isNonEmptyString, resolveDebugDisplay } from './eoDebugCommon';
import type { DebugRowModel, DebugStatus } from './eoDebugTypes';
import { isoDateToDate } from '../dates/isoDate';
import { countInclusiveUtcDays } from '../../utils/utcDayMath';
import { roundByMethod } from '../../utils/rounding';
import { erDetteFoersteErstatningsopgoerelse } from '../erstatningsopgoerelse/eoNummerValidering';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from '../erstatningsopgoerelse/tafBeregningsenhed';
import { calculateTafArbejdsdageBreakdown, calculateTafAntalMaaneder, calculateTafAntalMaanederPraecis } from '../erstatningsopgoerelse/tafCalculations';
import { calculateFerieHverdageMinusSHDage } from '../erstatningsopgoerelse/ferieCalculations';
import { computeTafOverlapWithBeregningsperiode } from '../erstatningsopgoerelse/beregningsperiodeTafOverlap';
import { buildIndkomstSectionStatuses, buildOffentligeYdelserDebugRows } from './eoDebugIndkomstModel';
import { mergeDateRanges, mergeIsoDateRanges } from '../erstatningsopgoerelse/periodMerging';
import { buildTafCutoffErrorMessage, clampTafRange, getValidTafRange, resolveTafConstraintBounds } from '../erstatningsopgoerelse/tafPeriodConstraints';
import {
  getOverenskomstMetaById,
  getOverenskomstSfggPolicy,
  getReguleringsDatoIntervalForOverenskomst,
  isOffentligOverenskomstId,
} from '../../data/overenskomstRates';
import { getReguleringsDatoIntervalForStatistikModel } from '../../data/statistiskeRates';
import { getReguleringsDatoIntervalForKRL, type KRLSatstabelId } from '../../data/krlRates';
import { resolveOffentligLoenTypeFromLabel, toLoentrin } from '../../data/offentligLoenTypes';
import { getAngivetLoenBaseretPaa, getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde } from '../erstatningsopgoerelse/angivetLoenHelpers';
import { resolveValgtReguleringDisplay } from '../erstatningsopgoerelse/loenudviklingDisplay';
import { buildBeregningsperiodeRange, buildIncomeForRanges, buildTafRanges } from '../erstatningsopgoerelse/indtaegtPerioder';
import { buildIndkomstSkadestidspunkt } from '../erstatningsopgoerelse/eoPdfIndkomstSkadestidspunkt';
import { buildLoenudviklingModel } from '../erstatningsopgoerelse/eoPdfLoenudvikling';
import {
  computeSygeferiegodtgoerelse,
  findSfggSixMonthWarningEmploymentIds,
  resolveSfggDayBasis,
  SFGG_NO_CALENDAR_DAYS_REASON,
  SFGG_NO_WORKDAYS_REASON,
  sumFerieberettigetLoenInRangesKroner,
  EMPTY_RESULT,
  hasSfggSelectedOverenskomst,
  resolveSfggSource,
} from '../erstatningsopgoerelse/sygeferiegodtgoerelse';
import { resolveOevrigeKravIntroLinjer } from '../erstatningsopgoerelse/oevrigeKravIntro';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../../settings/appSettingsSchema';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/eoCanonicalOutput';
import { parseForligsgrad } from '../erstatningsopgoerelse/forligsgrad';
import { resolveBilagWarning } from '../erstatningsopgoerelse/bilagWarnings';
import { ensureMoneyOre } from '../erstatningsopgoerelse/eoPdfMoneyUtils';

/**
 * Debug row id must be stable and semantically tied to field identity (not label text or array order).
 *
 * This protects React key stability and makes debug output auditable.
 */
export type DebugRowId =
  | 'erstatningsopgoerelse.eoNummer'
  | 'erstatningsopgoerelse.foersteErstatningsopgoerelse'
  | 'erstatningsopgoerelse.eoLedsagetekst'
  | 'erstatningsopgoerelse.revideretOpgoerelse'
  | 'erstatningsopgoerelse.vedroererPeriode'
  | 'erstatningsopgoerelse.opgørelseLavetDen'
  | 'erstatningsopgoerelse.helbredsstatus'
  | 'erstatningsopgoerelse.arbejdsstatus'
  | 'forlig.ansvarsgrad'
  | 'forlig.beregnetAnsvarsgrad'
  | 'forlig.dato'
  | 'aes.varigeMenAfgorelse'
  | 'aes.menAfgoerelseDato'
  | 'aes.midlertidigtEetAfgorelse'
  | 'aes.midlertidigEETAfgoerelseDato'
  | 'aes.midlertidigEETVirkningsdato'
  | 'aes.beregnetMidlertidigEETStartdato'
  | 'aes.endeligtEetAfgorelse'
  | 'aes.endeligEETAfgoerelseDato'
  | 'aes.endeligEETVirkningsdato'
  | 'aes.beregnetEndeligEETStartdato'
  | 'aes.verserendeKlageEet'
  | 'aes.differencekravDato'
  | 'sviesmerte.tidligereSsMax'
  | `sviesmerte.periode.${string}`
  | 'sviesmerte.satserAar'
  | 'sviesmerte.delvisSygemeldingSats'
  | 'sviesmerte.satserPerDagMax'
  | 'sviesmerte.tidligereTotal'
  | 'sviesmerte.aktuelPeriode'
  | 'sviesmerte.beregnetPeriode'
  | 'sviesmerte.antalDage'
  | 'sviesmerte.beregnetBeloeb'
  | 'sviesmerte.ophoerSkyldes'
  | 'taf.beregningsgrundlag.beregnesUdFra'
  | 'taf.beregningsgrundlag.beregningsperiode'
  | `taf.beregningsgrundlag.ferie.${string}`
  | 'taf.beregningsgrundlag.uspecificeredeFerieFridage'
  | 'taf.beregningsgrundlag.oevrigtFravaerUdenLoen'
  | 'taf.beregningsgrundlag.oevrigeFravaersdage'
  | 'taf.beregningsgrundlag.oevrigeFravaersdageBeskrivelse'
  | 'taf.beregningsgrundlag.maanedsloen'
  | 'taf.beregningsgrundlag.dagsloen'
  | 'taf.beregningsgrundlag.loenBaseretPaa'
  | 'taf.beregningsgrundlag.indkomst'
  | 'taf.beregningsgrundlag.angivetLoenOpreguleresFraDato'
  | 'taf.beregningsgrundlag.arbejdsdage'
  | 'taf.beregningsgrundlag.maaneder'
  | 'taf.beregnesSom'
  | 'taf.ophoerSkyldes'
  | `taf.periode.${string}`
  | `taf.ferie.${string}`
  | 'taf.tidligereModtagetTaf'
  | `loenindkomst.${string}.arbejdsstedNavn`
  | `loenindkomst.${string}.satserSkadestidspunkt`
  | `loenindkomst.${string}.loenoplysninger`
  | `loenindkomst.${string}.regulering.valgt`
  | `loenindkomst.${string}.regulering.navn`
  | `loenindkomst.${string}.regulering.alleVaerdier`
  | `offentligeYdelser.${string}`
  | `sfgg.beregningskilde.${string}`
  | `sfgg.overenskomst.${string}`
  | `sfgg.bemaerkningFoer2015.${string}`
  | `sfgg.overenskomstensReferenceperiode.${string}`
  | `sfgg.satsvalg.${string}`
  | `sfgg.foerstEfterSygeloen.${string}`
  | `sfgg.referenceperiode.${string}`
  | `sfgg.referenceperiodeantal.${string}`
  | `sfgg.referencesats.${string}`
  | `sfgg.dagssats.${string}`
  | `sfgg.tabel.${string}`
  | `sfgg.eftertabel.feriepengeHvisIkkeSkade.${string}`
  | `sfgg.eftertabel.feriepengeModtaget.${string}`
  | `sfgg.eftertabel.alleredeBetalt.${string}`
  | `sfgg.eftertabel.beregnet.${string}`
  | `sfgg.firemaanedertabel.${string}`
  | `sfgg.forklaring.${string}`
  | `sfgg.advarsel.seksmaaneder.${string}`
  | `oevrigekrav.${string}`
  | 'saerligekommentarer'
  | 'bilagsnumre.ingen'
  | 'bilagsnumre.menAfgoerelse'
  | 'bilagsnumre.eetAfgoerelser'
  | 'bilagsnumre.svieSmerteDokumentation'
  | 'bilagsnumre.beregningsgrundlagTaf'
  | 'bilagsnumre.loenISygeperioden'
  | 'bilagsnumre.offentligeYdelser'
  | 'bilagsnumre.oevrigeErstatningskrav';

type ErstatningsopgoerelseValues = PersistedSectionMap['erstatningsopgoerelse'];
type ErstatningsopgoerelseFieldName = Extract<keyof ErstatningsopgoerelseValues, string>;
type ErstatningsopgoerelseFieldErrorsBySource = Partial<Record<ErstatningsopgoerelseFieldName, FieldErrorBySource>>;
type StamdataValues = PersistedSectionMap['stamdata'];

const formatPercentUpToTwoDecimals = (value: number): string =>
  `${value.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;

const SFGG_DEBUG_SUPPRESSED_EXPLANATORY_LINES = new Set<string>([
  'Den første TAF-dag er undtaget, fordi skaden er fra 1. januar 2015 eller senere, og dette er første erstatningsopgørelse.',
  'Der beregnes først sygeferiegodtgørelse efter ophør af arbejdsgiverbetalt sygeløn.',
]);

const getYearAfterAddingOneMonth = (isoDate: ISODateString | undefined): number | undefined => {
  if (!isoDate) return undefined;
  const date = isoDateToDate(isoDate);
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  shifted.setUTCMonth(shifted.getUTCMonth() + 1);
  return shifted.getUTCFullYear();
};

export const buildEODebugErstatningsopgoerelseRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldErrorsBySource
): DebugRowModel[] => {
  // Vedrører periode - begge felter skal være udfyldt
  const hasPeriodeFra = isNonEmptyString(values.vedroererPeriodeFra);
  const hasPeriodeTil = isNonEmptyString(values.vedroererPeriodeTil);
  const bothPeriodsFilled = hasPeriodeFra && hasPeriodeTil;

  // Konverter datoer til dansk format for visning
  const danishPeriodeFra = isoToDanish(values.vedroererPeriodeFra);
  const danishPeriodeTil = isoToDanish(values.vedroererPeriodeTil);

  const periodeDisplay = bothPeriodsFilled && danishPeriodeFra && danishPeriodeTil
    ? `${danishPeriodeFra} - ${danishPeriodeTil}`
    : '-';

  const periodeFraErrors = collectPresentFieldErrors(errors.vedroererPeriodeFra);
  const periodeTilErrors = collectPresentFieldErrors(errors.vedroererPeriodeTil);
  const hasPeriodeErrors = periodeFraErrors.length > 0 || periodeTilErrors.length > 0;

  const periodeStatus: DebugStatus =
    hasPeriodeErrors ? (periodeFraErrors.concat(periodeTilErrors).some((e) => e.severity === 'error') ? 'error' : 'warning')
    : bothPeriodsFilled ? 'ok'
    : 'error';

  // Konverter opgørelseLavetDen til dansk format
  const danishOpgoerelseDato = isoToDanish(values.opgørelseLavetDen);

  const periodeErrorValue = (() => {
    if (!hasPeriodeErrors) return undefined;

    const parts: string[] = [];
    for (const e of periodeFraErrors) {
      parts.push(`Fra og med: ${e.message.trim()}`);
    }
    for (const e of periodeTilErrors) {
      parts.push(`Til og med: ${e.message.trim()}`);
    }
    const hasError = periodeFraErrors.concat(periodeTilErrors).some((e) => e.severity === 'error');
    return `${hasError ? 'Fejl' : 'Advarsel'} (${parts.join('; ')})`;
  })();

  const erFoersteOpgoerelse = erDetteFoersteErstatningsopgoerelse(values.eoNummer);

  return [
    {
      id: 'erstatningsopgoerelse.eoNummer',
      label: 'Erstatningsopgørelse, nummer',
      ...resolveDebugDisplay({ value: values.eoNummer, errors: errors.eoNummer, emptyState: 'warning' }),
    },
    {
      id: 'erstatningsopgoerelse.foersteErstatningsopgoerelse',
      label: 'Første erstatningsopgørelse?',
      displayValue: erFoersteOpgoerelse ? 'Ja' : 'Nej',
      status: 'ok',
    },
    {
      id: 'erstatningsopgoerelse.eoLedsagetekst',
      label: 'Erstatningsopgørelse, evt. tillægstekst',
      ...resolveDebugDisplay({ value: values.eoLedsagetekst, errors: errors.eoLedsagetekst, emptyState: 'ok' }),
    },
    {
      id: 'erstatningsopgoerelse.revideretOpgoerelse',
      label: 'Revideret opgørelse',
      ...resolveDebugDisplay({
        value: values.revideretOpgoerelse,
        errors: errors.revideretOpgoerelse,
        emptyState: 'error',
      }),
    },
    {
      id: 'erstatningsopgoerelse.vedroererPeriode',
      label: 'Vedrører perioden',
      displayValue: periodeErrorValue ?? periodeDisplay,
      status: periodeStatus,
    },
    {
      id: 'erstatningsopgoerelse.opgørelseLavetDen',
      label: 'Opgørelse lavet den',
      ...resolveDebugDisplay({ value: danishOpgoerelseDato, errors: errors.opgørelseLavetDen, emptyState: 'warning' }),
    },
    {
      id: 'erstatningsopgoerelse.helbredsstatus',
      label: 'Helbredsforhold',
      ...resolveDebugDisplay({
        value: values.svieSmerteHelbredsstatus,
        errors: errors.svieSmerteHelbredsstatus,
        emptyState: 'error',
      }),
    },
    {
      id: 'erstatningsopgoerelse.arbejdsstatus',
      label: 'Arbejdssituation',
      ...resolveDebugDisplay({ value: values.tafArbejdsstatus, errors: errors.tafArbejdsstatus, emptyState: 'error' }),
    },
  ];
};

export const buildEODebugForligRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldErrorsBySource
): DebugRowModel[] => {
  const procentValue = values.forligAnsvarsgradProcent;
  const broekValue = values.forligAnsvarsgradBroek;
  const harProcent = typeof procentValue === 'number';
  const harBroek = isNonEmptyString(broekValue);
  const procentErrors = collectPresentFieldErrors(errors.forligAnsvarsgradProcent);
  const broekErrors = collectPresentFieldErrors(errors.forligAnsvarsgradBroek);
  const forligDatoErrors = collectPresentFieldErrors(errors.forligDato);
  const samledeForligErrors = procentErrors.concat(broekErrors);
  const harPraecisEnUdfyldt = harProcent !== harBroek;
  const harBeggeUdfyldt = harProcent && harBroek;
  const parsedForligsgrad = harPraecisEnUdfyldt ? parseForligsgrad(values) : null;
  const samletForligDisplay = harProcent
    ? `${procentValue}%`
    : (harBroek ? broekValue.trim() : undefined);
  const danishForligDato = isoToDanish(values.forligDato);
  const combinedForligMessages = Array.from(new Set(samledeForligErrors.map((error) => error.message.trim())));
  const fallbackBothFilledMessage = 'Angiv enten procent eller brøk – ikke begge';
  const forligErrorMessages = harBeggeUdfyldt && combinedForligMessages.length === 0
    ? [fallbackBothFilledMessage]
    : combinedForligMessages;
  const forligRow: DebugRowModel = forligErrorMessages.length > 0
    ? {
      id: 'forlig.ansvarsgrad',
      label: 'Forlig om ansvarsgrad',
      displayValue: `Fejl (${forligErrorMessages.join('; ')})`,
      status:
        harBeggeUdfyldt || samledeForligErrors.some((error) => error.severity === 'error')
          ? 'error'
          : 'warning',
      message: forligErrorMessages.join('; '),
      summaryDisplay: 'messageOnly',
    }
    : {
      id: 'forlig.ansvarsgrad',
      label: 'Forlig om ansvarsgrad',
      ...resolveDebugDisplay({ value: samletForligDisplay, errors: undefined, emptyState: 'ok' }),
    };
  const forligDatoRow: DebugRowModel = {
    id: 'forlig.dato',
    label: 'Evt. dato for forlig',
    ...resolveDebugDisplay({
      value: danishForligDato,
      errors: errors.forligDato,
      emptyState: 'ok',
    }),
  };

  if (!harPraecisEnUdfyldt) {
    const skalViseForligDatoRow = danishForligDato !== undefined || forligDatoErrors.length > 0;
    return skalViseForligDatoRow
      ? [forligRow, forligDatoRow]
      : [forligRow];
  }

  return [
    forligRow,
    {
      id: 'forlig.beregnetAnsvarsgrad',
      label: 'Beregnet ansvarsgrad',
      displayValue:
        parsedForligsgrad === null
          ? '-'
          : formatPercentUpToTwoDecimals(parsedForligsgrad.factor * 100),
      status: 'ok',
      dependsOn: [
        { kind: 'id', id: 'forlig.ansvarsgrad' },
        { kind: 'id', id: 'forlig.dato' },
      ],
    },
    {
      ...forligDatoRow,
    },
  ];
};

export const buildEODebugAesRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldErrorsBySource
): DebugRowModel[] => {
  // Tjek hvilke felter der er synlige baseret på toggle-værdier
  const varigeMenErSynlig = values.varigeMenAfgorelse === 'Ja';
  const midlertidigEetErSynlig = values.midlertidigtEetAfgorelse === 'Ja';
  const endeligEetErSynlig = values.endeligtEetAfgorelse === 'Ja';

  // Konverter datoer til dansk format - men kun hvis feltet er synligt
  const danishMenAfgoerelseDato = varigeMenErSynlig ? isoToDanish(values.menAfgoerelseDato) : undefined;
  const danishMidlertidigEETAfgoerelseDato = midlertidigEetErSynlig ? isoToDanish(values.midlertidigEETAfgoerelseDato) : undefined;
  const danishMidlertidigEETVirkningsdato = midlertidigEetErSynlig ? isoToDanish(values.midlertidigEETVirkningsdato) : undefined;
  const danishEndeligEETAfgoerelseDato = endeligEetErSynlig ? isoToDanish(values.endeligEETAfgoerelseDato) : undefined;
  const danishEndeligEETVirkningsdato = endeligEetErSynlig ? isoToDanish(values.endeligEETVirkningsdato) : undefined;
  const danishDifferencekravDato = isoToDanish(values.differencekravDato);

  // Tjek om varige mén toggle er Ja men dato mangler
  const menAfgoerelseDatoMangler = varigeMenErSynlig && !isNonEmptyString(danishMenAfgoerelseDato);

  const harMidlertidigEETVirkningsdato = isNonEmptyString(danishMidlertidigEETVirkningsdato);
  const harMidlertidigEETAfgoerelseDato = isNonEmptyString(danishMidlertidigEETAfgoerelseDato);

  // Tjek om midlertidig EET toggle er Ja men der mangler dato (hverken afgørelsesdato eller virkningsdato)
  const midlertidigEETAfgoerelseDatoMangler =
    midlertidigEetErSynlig && !harMidlertidigEETAfgoerelseDato && !harMidlertidigEETVirkningsdato;

  const harEndeligEETVirkningsdato = isNonEmptyString(danishEndeligEETVirkningsdato);
  const harEndeligEETAfgoerelseDato = isNonEmptyString(danishEndeligEETAfgoerelseDato);

  // Tjek om endelig EET toggle er Ja men der mangler dato (hverken afgørelsesdato eller virkningsdato)
  const endeligEETAfgoerelseDatoMangler = endeligEetErSynlig && !harEndeligEETAfgoerelseDato && !harEndeligEETVirkningsdato;

  // Varige mén afgørelsesdato - vis fejl hvis toggle er Ja men dato mangler
  const menAfgoerelseDatoResolved = resolveDebugDisplay({
    value: danishMenAfgoerelseDato,
    errors: errors.menAfgoerelseDato,
    emptyState: 'ok',
  });
  const menAfgoerelseDatoDisplay = menAfgoerelseDatoMangler ? 'Fejl (Afgørelsesdato mangler)' : menAfgoerelseDatoResolved.displayValue;
  const menAfgoerelseDatoStatus: DebugStatus = menAfgoerelseDatoMangler ? 'error' : menAfgoerelseDatoResolved.status;

  // Midlertidig EET afgørelsesdato - vis fejl hvis toggle er Ja men dato mangler
  const midlertidigEETAfgoerelseDatoResolved = resolveDebugDisplay({
    value: danishMidlertidigEETAfgoerelseDato,
    errors: errors.midlertidigEETAfgoerelseDato,
    emptyState: 'ok',
  });
  const midlertidigEETAfgoerelseDatoDisplay = midlertidigEETAfgoerelseDatoMangler
    ? 'Fejl (Afgørelsesdato eller virkningsdato mangler)'
    : midlertidigEETAfgoerelseDatoResolved.displayValue;
  const midlertidigEETAfgoerelseDatoStatus: DebugStatus = midlertidigEETAfgoerelseDatoMangler
    ? 'error'
    : midlertidigEETAfgoerelseDatoResolved.status;

  // Endelig EET afgørelsesdato - vis fejl hvis toggle er Ja men dato mangler
  const endeligEETAfgoerelseDatoResolved = resolveDebugDisplay({
    value: danishEndeligEETAfgoerelseDato,
    errors: errors.endeligEETAfgoerelseDato,
    emptyState: 'ok',
  });
  const endeligEETAfgoerelseDatoDisplay = endeligEETAfgoerelseDatoMangler
    ? 'Fejl (Afgørelsesdato eller virkningsdato mangler)'
    : endeligEETAfgoerelseDatoResolved.displayValue;
  const endeligEETAfgoerelseDatoStatus: DebugStatus = endeligEETAfgoerelseDatoMangler ? 'error' : endeligEETAfgoerelseDatoResolved.status;

  // Beregnet startdato for midlertidigt EET - kun hvis felterne er synlige
  const midlertidigEETAfgoerelseDatoErrors = collectPresentFieldErrors(errors.midlertidigEETAfgoerelseDato);
  const midlertidigEETVirkningsdatoErrors = collectPresentFieldErrors(errors.midlertidigEETVirkningsdato);
  const harMidlertidigVirkningsdatoFejl = midlertidigEetErSynlig && midlertidigEETVirkningsdatoErrors.length > 0;
  const harMidlertidigAfgoerelsesdatoFejl =
    midlertidigEetErSynlig && (midlertidigEETAfgoerelseDatoErrors.length > 0 || midlertidigEETAfgoerelseDatoMangler);

  const beregnetMidlertidigEETStartdato = (() => {
    // Hvis felterne ikke er synlige, vis tom
    if (!midlertidigEetErSynlig) {
      return { displayValue: '-', status: 'ok' as DebugStatus };
    }

    if (harMidlertidigVirkningsdatoFejl || harMidlertidigAfgoerelsesdatoFejl) {
      const parts: string[] = [];
      if (harMidlertidigVirkningsdatoFejl) {
        parts.push(...midlertidigEETVirkningsdatoErrors.map((e) => e.message.trim()));
      }
      if (harMidlertidigAfgoerelsesdatoFejl) {
        if (midlertidigEETAfgoerelseDatoMangler) {
          parts.push('Afgørelsesdato eller virkningsdato mangler');
        } else {
          parts.push(...midlertidigEETAfgoerelseDatoErrors.map((e) => e.message.trim()));
        }
      }
      return { displayValue: `Fejl (${parts.join('; ')})`, status: 'error' as DebugStatus };
    }

    // Hvis virkningsdato er udfyldt, brug den
    if (harMidlertidigEETVirkningsdato) {
      return { displayValue: danishMidlertidigEETVirkningsdato.trim(), status: 'ok' as DebugStatus };
    }

    // Hvis kun afgørelsesdato er udfyldt, brug den
    if (harMidlertidigEETAfgoerelseDato) {
      return { displayValue: danishMidlertidigEETAfgoerelseDato.trim(), status: 'ok' as DebugStatus };
    }

    // Ingen dato udfyldt
    return { displayValue: '-', status: 'ok' as DebugStatus };
  })();

  // Beregnet startdato for endeligt EET - kun hvis felterne er synlige
  const endeligEETVirkningsdatoErrors = collectPresentFieldErrors(errors.endeligEETVirkningsdato);
  const endeligEETAfgoerelseDatoErrors = collectPresentFieldErrors(errors.endeligEETAfgoerelseDato);
  const harEndeligVirkningsdatoFejl = endeligEetErSynlig && endeligEETVirkningsdatoErrors.length > 0;
  const harEndeligAfgoerelsesdatoFejl =
    endeligEetErSynlig && (endeligEETAfgoerelseDatoErrors.length > 0 || endeligEETAfgoerelseDatoMangler);

  const beregnetEndeligEETStartdato = (() => {
    // Hvis felterne ikke er synlige, vis tom
    if (!endeligEetErSynlig) {
      return { displayValue: '-', status: 'ok' as DebugStatus };
    }

    if (harEndeligVirkningsdatoFejl || harEndeligAfgoerelsesdatoFejl) {
      const parts: string[] = [];
      if (harEndeligVirkningsdatoFejl) {
        parts.push(...endeligEETVirkningsdatoErrors.map((e) => e.message.trim()));
      }
      if (harEndeligAfgoerelsesdatoFejl) {
        if (endeligEETAfgoerelseDatoMangler) {
          parts.push('Afgørelsesdato eller virkningsdato mangler');
        } else {
          parts.push(...endeligEETAfgoerelseDatoErrors.map((e) => e.message.trim()));
        }
      }
      return { displayValue: `Fejl (${parts.join('; ')})`, status: 'error' as DebugStatus };
    }

    // Hvis virkningsdato er udfyldt, brug den
    if (harEndeligEETVirkningsdato) {
      return { displayValue: danishEndeligEETVirkningsdato.trim(), status: 'ok' as DebugStatus };
    }

    // Hvis kun afgørelsesdato er udfyldt, brug den
    if (harEndeligEETAfgoerelseDato) {
      return { displayValue: danishEndeligEETAfgoerelseDato.trim(), status: 'ok' as DebugStatus };
    }

    // Ingen dato udfyldt
    return { displayValue: '-', status: 'ok' as DebugStatus };
  })();

  return [
    {
      id: 'aes.varigeMenAfgorelse',
      label: 'Afgørelse om varige mén 5+ %',
      ...resolveDebugDisplay({ value: values.varigeMenAfgorelse, errors: errors.varigeMenAfgorelse, emptyState: 'error' }),
      group: 'aes.varigeMen',
    },
    {
      id: 'aes.menAfgoerelseDato',
      label: 'Mén-afgørelsesdato',
      displayValue: menAfgoerelseDatoDisplay,
      status: menAfgoerelseDatoStatus,
      group: 'aes.varigeMen',
    },
    {
      id: 'aes.midlertidigtEetAfgorelse',
      label: 'Midlertidigt EET-afgørelse 15+ %',
      ...resolveDebugDisplay({
        value: values.midlertidigtEetAfgorelse,
        errors: errors.midlertidigtEetAfgorelse,
        emptyState: 'error',
      }),
      group: 'aes.midlertidigtEet',
    },
    {
      id: 'aes.midlertidigEETAfgoerelseDato',
      label: 'Dato for midlertidig EET-afgørelse',
      displayValue: midlertidigEETAfgoerelseDatoDisplay,
      status: midlertidigEETAfgoerelseDatoStatus,
      group: 'aes.midlertidigtEet',
    },
    {
      id: 'aes.midlertidigEETVirkningsdato',
      label: 'Virkningsdato for midlertidig EET-afgørelse',
      ...resolveDebugDisplay({
        value: danishMidlertidigEETVirkningsdato,
        errors: errors.midlertidigEETVirkningsdato,
        emptyState: 'ok',
      }),
      group: 'aes.midlertidigtEet',
    },
    {
      id: 'aes.beregnetMidlertidigEETStartdato',
      label: 'Beregnet startdato for midlertidigt EET',
      displayValue: beregnetMidlertidigEETStartdato.displayValue,
      status: beregnetMidlertidigEETStartdato.status,
      group: 'aes.midlertidigtEet',
      dependsOn: [
        { kind: 'id', id: 'aes.midlertidigtEetAfgorelse' },
        { kind: 'id', id: 'aes.midlertidigEETAfgoerelseDato' },
        { kind: 'id', id: 'aes.midlertidigEETVirkningsdato' },
      ],
    },
    {
      id: 'aes.endeligtEetAfgorelse',
      label: 'Endelig EET-afgørelse 15+ %',
      ...resolveDebugDisplay({ value: values.endeligtEetAfgorelse, errors: errors.endeligtEetAfgorelse, emptyState: 'error' }),
      group: 'aes.endeligtEet',
    },
    {
      id: 'aes.endeligEETAfgoerelseDato',
      label: 'Dato for endelig EET-afgørelse',
      displayValue: endeligEETAfgoerelseDatoDisplay,
      status: endeligEETAfgoerelseDatoStatus,
      group: 'aes.endeligtEet',
    },
    {
      id: 'aes.endeligEETVirkningsdato',
      label: 'Virkningsdato for endelig EET-afgørelse',
      ...resolveDebugDisplay({ value: danishEndeligEETVirkningsdato, errors: errors.endeligEETVirkningsdato, emptyState: 'ok' }),
      group: 'aes.endeligtEet',
    },
    {
      id: 'aes.beregnetEndeligEETStartdato',
      label: 'Beregnet startdato for endeligt EET',
      displayValue: beregnetEndeligEETStartdato.displayValue,
      status: beregnetEndeligEETStartdato.status,
      group: 'aes.endeligtEet',
      dependsOn: [
        { kind: 'id', id: 'aes.endeligtEetAfgorelse' },
        { kind: 'id', id: 'aes.endeligEETAfgoerelseDato' },
        { kind: 'id', id: 'aes.endeligEETVirkningsdato' },
      ],
    },
    {
      id: 'aes.verserendeKlageEet',
      label: 'Verserende klage over EET',
      ...resolveDebugDisplay({ value: values.verserendeKlageEet, errors: errors.verserendeKlageEet, emptyState: 'error' }),
      group: 'aes.oevrigt',
    },
    {
      id: 'aes.differencekravDato',
      label: 'Dato for differencekrav',
      ...resolveDebugDisplay({ value: danishDifferencekravDato, errors: errors.differencekravDato, emptyState: 'ok' }),
      group: 'aes.differencekrav',
    },
  ];
};

export const buildEODebugSvieSmerteRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldErrorsBySource,
  context: Readonly<{
    skadesdatoISO: ISODateString | undefined;
    erErhvervssygdom: boolean;
    menAfgoerelseDatoForTabel: ISODateString | undefined;
    verserendeKlageMen: boolean;
  }>,
  canonicalOutput?: EoCanonicalOutput
): DebugRowModel[] => {
  const rows: DebugRowModel[] = [];
  const svieSmerteIkkeRejstLabel = 'Ikke rejst svie/smerte-krav for hele perioden';

  // Tjek om periode-tabellen er synlig (kun synlig hvis tidligereSsMax er 'Nej')
  const periodeErSynlig = values.tidligereSsMax === 'Nej';

  const skadesdatoMinRule = computeSkadesdatoMinRule({
    skadesdatoISO: context.skadesdatoISO,
    erErhvervssygdom: context.erErhvervssygdom,
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMin,
  });

  // 1) Tidligere beregnet S/S til max. (fejl ved tom)
  rows.push({
    id: 'sviesmerte.tidligereSsMax',
    label: 'Tidligere beregnet S/S til max.',
    ...resolveDebugDisplay({ value: values.tidligereSsMax, errors: errors.tidligereSsMax, emptyState: 'error' }),
  });

  // 2) Periode rows fra tabellen - kun hvis synlig
  const perioder = periodeErSynlig ? (values.svieSmertePerioder ?? []) : [];
  const harPerioder = perioder.length > 0 && perioder.some((p) => p.fra || p.til || p.tilstand);
  const svieSmerteOverlappingIds = detectConflictingSvieSmerteOverlaps(perioder);

  // Samler alle periode-fejl til senere brug
  const periodeFejlBeskeder: string[] = [];

  if (!harPerioder) {
    rows.push({
      id: 'sviesmerte.periode.empty',
      label: 'Periode',
      displayValue: '-',
      status: 'ok',
    });
  } else {
    perioder.forEach((periode) => {
      const hasFra = isNonEmptyString(periode.fra);
      const hasTil = isNonEmptyString(periode.til);
      const hasTilstand = isNonEmptyString(periode.tilstand);

      // Tjek om alle tre felter er udfyldt eller alle tre er tomme
      const filledCount = [hasFra, hasTil, hasTilstand].filter(Boolean).length;
      const allFilled = filledCount === 3;
      const noneFilled = filledCount === 0;

      // Spring over rækker hvor intet er udfyldt
      if (noneFilled) return;

      // Tjek for fejl i felterne
      //
      // NOTE (debug parity):
      // Svie/Smerte-tabellen bruger StyledDateField's lokale range-validation (min/max),
      // men tabelceller rapporterer ikke disse fejl som producer-owned runtime field errors.
      // Derfor vil `errors` typisk være tom for disse felter, selv om UI viser en tooltip-fejl.
      //
      // For at undgå falske grønne hak i EODebug beregner vi derfor de samme range-fejl her,
      // baseret på samme bounds som tabellen (computeRowDateBounds + validateISODateRange).
      const fraISO = periode.fra;
      const tilISO = periode.til;
      const periodeLabel = (() => {
        if (!fraISO || !tilISO) return 'Periode';
        const fraDanishLabel = isoToDanish(fraISO);
        const tilDanishLabel = isoToDanish(tilISO);
        return fraDanishLabel && tilDanishLabel ? `Periode (${fraDanishLabel} - ${tilDanishLabel})` : 'Periode';
      })();

      const bounds = computeRowDateBounds({
        skadesdatoMinDate: skadesdatoMinRule.minDate,
        rowFra: fraISO,
        rowTil: tilISO,
        fallbackMin: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMin,
        fallbackMax: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMax,
        tilFallbackMax: dateRanges_erstatningsopgoerelse.tabelSvieSmerteTil.max,
        tilExtraMaxDate: context.menAfgoerelseDatoForTabel,
        useTilExtraMaxDate: !context.verserendeKlageMen,
      });

      const fraNoValidRangeCause = (() => {
        const parts: string[] = [];
        if (skadesdatoMinRule.minBoundKind) parts.push('skadesdato');
        if (tilISO) parts.push('til-dato i samme række');
        return parts.length > 0 ? parts.join(', ') : undefined;
      })();

      const tilNoValidRangeCause = (() => {
        const parts: string[] = [];
        if (!fraISO && skadesdatoMinRule.minBoundKind) parts.push('skadesdato');
        if (fraISO) parts.push('fra-dato i samme række');
        parts.push('dags dato');
        if (!context.verserendeKlageMen && context.menAfgoerelseDatoForTabel) parts.push('dato for ménafgørelse');
        return parts.join(', ');
      })();

      const fraRangeErrorMessage = (() => {
        if (bounds.fra.min > bounds.fra.max) {
          return buildNoValidDateRangeMessage({
            minDate: bounds.fra.min,
            maxDate: bounds.fra.max,
            noValidRangeCause: fraNoValidRangeCause,
          });
        }
        if (!fraISO) return undefined;
        const result = validateISODateRange(fraISO, bounds.fra.min, bounds.fra.max);
        return result.isValid ? undefined : result.errorMessage;
      })();

      const tilRangeErrorMessage = (() => {
        if (bounds.til.min > bounds.til.max) {
          return buildNoValidDateRangeMessage({
            minDate: bounds.til.min,
            maxDate: bounds.til.max,
            noValidRangeCause: tilNoValidRangeCause,
          });
        }
        if (!tilISO) return undefined;
        const result = validateISODateRange(tilISO, bounds.til.min, bounds.til.max);
        return result.isValid ? undefined : result.errorMessage;
      })();

      const computedRangeMessages = [fraRangeErrorMessage, tilRangeErrorMessage].filter(
        (m): m is string => typeof m === 'string' && m.trim() !== ''
      );

      const hasOverlap = svieSmerteOverlappingIds.has(periode.id);
      const harFejl = computedRangeMessages.length > 0 || hasOverlap;

      // Hvis ikke alle felter er udfyldt, vis fejl
      if (!allFilled) {
        const displayValue = 'Fejl (Ikke alle felter udfyldt)';
        periodeFejlBeskeder.push(displayValue);
        rows.push({
          id: `sviesmerte.periode.${periode.id}`,
          label: periodeLabel,
          displayValue,
          status: 'error',
        });
        return;
      }

      // Hvis der er fejl i felterne, vis fejlmeddelelsen
      if (harFejl) {
        const fraFoerTilError = fraISO && tilISO && fraISO > tilISO
          ? 'Der er indtastet en til-dato, som ligger før fra-datoen'
          : undefined;
        const allMessages = computedRangeMessages.map((m) => m.trim()).filter((m) => m !== '');

        const errorMessages = hasOverlap ? 'Der er overlappende perioder' : (fraFoerTilError ?? allMessages.join('; '));
        const displayValue = `Fejl (${errorMessages})`;
        periodeFejlBeskeder.push(displayValue);
        rows.push({
          id: `sviesmerte.periode.${periode.id}`,
          label: periodeLabel,
          displayValue,
          status: 'error',
        });
        return;
      }

      // Beregn antal dage og formater output
      // Note: periode.fra og periode.til er i ISO-format

      // Tjek at begge datoer er udfyldt
      if (!fraISO || !tilISO) {
        const displayValue = 'Fejl (Ugyldig dato)';
        periodeFejlBeskeder.push(displayValue);
        rows.push({
          id: `sviesmerte.periode.${periode.id}`,
          label: periodeLabel,
          displayValue,
          status: 'error',
        });
        return;
      }

      try {
        // Konverter til dansk format for visning
        const fraDanish = isoToDanish(fraISO);
        const tilDanish = isoToDanish(tilISO);

        if (!fraDanish || !tilDanish) {
          const displayValue = 'Fejl (Ugyldig dato)';
          periodeFejlBeskeder.push(displayValue);
          rows.push({
            id: `sviesmerte.periode.${periode.id}`,
            label: periodeLabel,
            displayValue,
            status: 'error',
          });
          return;
        }

        // Formater tilstand
        const tilstandDisplay =
          periode.tilstand === 'sygemeldt' ? 'Sygemeldt' :
          periode.tilstand === 'delvist-sygemeldt' ? 'Delvist sygemeldt' :
          '';

        // Formater displayValue som "fra-dato - til-dato (tilstand)"
        const periodeDisplay = `${fraDanish} - ${tilDanish} (${tilstandDisplay})`;

        rows.push({
          id: `sviesmerte.periode.${periode.id}`,
          label: 'Periode',
          displayValue: periodeDisplay,
          status: 'ok',
        });
      } catch {
        const displayValue = 'Fejl (Ugyldig dato)';
        periodeFejlBeskeder.push(displayValue);
        rows.push({
          id: `sviesmerte.periode.${periode.id}`,
          label: periodeLabel,
          displayValue,
          status: 'error',
        });
      }
    });
  }

  const harPeriodeFejl = periodeFejlBeskeder.length > 0;

  // 3) Hvilket års svie/smerte satser lægges til grund?
  const satserAarValue = values.svieSmerteSatserAar !== undefined ? String(values.svieSmerteSatserAar) : undefined;
  const satserAarResolved = resolveDebugDisplay({
    value: satserAarValue,
    errors: errors.svieSmerteSatserAar,
    emptyState: 'ok',
  });
  const satserAarMangler = harPerioder && !isNonEmptyString(satserAarValue);
  const satserAarParsed = Number.parseInt(satserAarValue?.trim() ?? '', 10);
  const hasValidSatserAar = Number.isInteger(satserAarParsed);
  const opgoerelsePlusOneMonthYear = getYearAfterAddingOneMonth(values.opgørelseLavetDen);
  const hasSatserForOpgoerelsePlusOneMonthYear =
    typeof opgoerelsePlusOneMonthYear === 'number' &&
    typeof svieSmertePrDag[opgoerelsePlusOneMonthYear] === 'number' &&
    typeof svieSmerteMax[opgoerelsePlusOneMonthYear] === 'number';
  const shouldShowSatsYearSuggestionWarning =
    satserAarResolved.status !== 'error' &&
    !satserAarMangler &&
    values.revideretOpgoerelse !== 'Ja' &&
    hasValidSatserAar &&
    typeof opgoerelsePlusOneMonthYear === 'number' &&
    opgoerelsePlusOneMonthYear > satserAarParsed &&
    hasSatserForOpgoerelsePlusOneMonthYear;

  const satserAarDisplay = (() => {
    if (satserAarMangler) return 'Fejl (Indtastet sygeperiode men ikke år for sats)';
    if (shouldShowSatsYearSuggestionWarning && opgoerelsePlusOneMonthYear !== undefined) {
      return `Svie/smerte satsen for ${opgoerelsePlusOneMonthYear} kan anvendes.`;
    }
    return satserAarResolved.displayValue;
  })();
  const satserAarStatus: DebugStatus = satserAarMangler
    ? 'error'
    : shouldShowSatsYearSuggestionWarning
      ? 'warning'
      : satserAarResolved.status;

  rows.push({
    id: 'sviesmerte.satserAar',
    label: 'Hvilket års svie/smerte satser lægges til grund?',
    displayValue: satserAarDisplay,
    status: satserAarStatus,
    message:
      satserAarMangler
        ? 'Indtastet sygeperiode men ikke år for sats'
        : shouldShowSatsYearSuggestionWarning
          ? satserAarDisplay
          : undefined,
    summaryDisplay: satserAarStatus !== 'ok' ? 'messageOnly' : undefined,
  });

  // 3b) Svie/smerte sats ved delvis sygemelding
  const delvisSygemeldingSatsValue = values.svieSmerteDelvisSygemeldingSats;
  const delvisSygemeldingSatsErrors = collectPresentFieldErrors(errors.svieSmerteDelvisSygemeldingSats);
  const harDelvisSygemeldingSatsFejl = delvisSygemeldingSatsErrors.length > 0;
  const delvisSygemeldingSatsMangler = !delvisSygemeldingSatsValue || delvisSygemeldingSatsValue.trim() === '';

  const delvisSygemeldingSatsDisplay = (() => {
    if (harDelvisSygemeldingSatsFejl) {
      const parts = delvisSygemeldingSatsErrors.map((e) => e.message.trim());
      return `Fejl (${parts.join('; ')})`;
    }
    if (delvisSygemeldingSatsMangler) {
      return 'Fejl (Sats ved delvis sygemelding mangler)';
    }
    return delvisSygemeldingSatsValue === 'fuld' ? 'Fuld sats' : 'Halv sats';
  })();

  const delvisSygemeldingSatsStatus: DebugStatus =
    harDelvisSygemeldingSatsFejl || delvisSygemeldingSatsMangler ? 'error' :
    isNonEmptyString(delvisSygemeldingSatsValue) ? 'ok' : 'ok';

  rows.push({
    id: 'sviesmerte.delvisSygemeldingSats',
    label: 'Svie/smerte sats ved delvis sygemelding',
    displayValue: delvisSygemeldingSatsDisplay,
    status: delvisSygemeldingSatsStatus,
  });

  // 3c) Satser per dag/max (opslag fra lovbestemteRates)
  const satserPerDagMax = (() => {
    // Hvis år ikke er valgt eller ugyldigt, returner tom
    if (!isNonEmptyString(satserAarValue) || satserAarResolved.status !== 'ok') {
      return { label: 'Satser per dag/max', displayValue: '-', status: 'ok' as DebugStatus };
    }

    const aar = parseInt(satserAarValue.trim(), 10);
    if (Number.isNaN(aar)) {
      return { label: 'Satser per dag/max', displayValue: '-', status: 'ok' as DebugStatus };
    }

    // Slå satser op
    const satsPerDag = svieSmertePrDag[aar as keyof typeof svieSmertePrDag];
    const satsMax = svieSmerteMax[aar as keyof typeof svieSmerteMax];

    if (!satsPerDag || !satsMax) {
      return { label: 'Satser per dag/max', displayValue: `Fejl (Ingen satser for år ${aar})`, status: 'error' as DebugStatus };
    }

    const parsedForlig = parseForligsgrad(values);
    const forligsgrad = parsedForlig?.factor;
    const forligLabel = parsedForlig ? ` (forlig på ${parsedForlig.label})` : '';

    // Reducer satser hvis der er forlig
    const actualSatsPerDag = forligsgrad !== undefined ? satsPerDag * forligsgrad : satsPerDag;
    const actualSatsMax = forligsgrad !== undefined ? satsMax * forligsgrad : satsMax;

    const perDagFormatted = formatCurrency(actualSatsPerDag);
    const maxFormatted = formatCurrency(actualSatsMax);

    return {
      label: `Satser per dag/max${forligLabel}`,
      displayValue: `${perDagFormatted} kr. / ${maxFormatted} kr.`,
      status: 'ok' as DebugStatus
    };
  })();

  rows.push({
    id: 'sviesmerte.satserPerDagMax',
    label: satserPerDagMax.label,
    displayValue: satserPerDagMax.displayValue,
    status: satserPerDagMax.status,
    dependsOn: [
      { kind: 'id', id: 'sviesmerte.satserAar' },
      { kind: 'id', id: 'forlig.ansvarsgrad' },
    ],
  });

  // 4) Svie/smerte krav i tidligere erstatningsopgørelser (ok hvis tomt)
  const tidligereTotalValue = formatCurrency(amountValueToNumber(values.svieSmerteTidligereTotal));
  rows.push({
    id: 'sviesmerte.tidligereTotal',
    label: 'Svie/smerte krav i tidligere erstatningsopgørelser',
    ...resolveDebugDisplay({ value: tidligereTotalValue, errors: errors.svieSmerteTidligereTotal, emptyState: 'ok' }),
  });

  // 5) Evt. allerede modtaget svie/smerte for nuværende erstatningsperiode (ok hvis tomt)
  const aktuelPeriodeValue = formatCurrency(amountValueToNumber(values.svieSmerteAktuelPeriode));
  rows.push({
    id: 'sviesmerte.aktuelPeriode',
    label: 'Evt. allerede modtaget svie/smerte for nuværende erstatningsperiode',
    ...resolveDebugDisplay({ value: aktuelPeriodeValue, errors: errors.svieSmerteAktuelPeriode, emptyState: 'ok' }),
  });

  // 6) Beregnet periode (sammenflettede perioder afgrænset af vedroererPeriode og menAfgoerelseDato)
  const beregnetPeriodeResult = (() => {
    // Hvis ingen perioder indtastet, returner tom
    if (!harPerioder) {
      return { displayValue: '-', status: 'ok' as DebugStatus };
    }

    // Hvis der er fejl i periode-felterne, returner samme fejl som periode
    if (harPeriodeFejl) {
      return { displayValue: periodeFejlBeskeder[0], status: 'error' as DebugStatus };
    }

    // Parse vedroererPeriode
    const periodeFra = values.vedroererPeriodeFra;
    const periodeTil = values.vedroererPeriodeTil;

    if (!periodeFra || !periodeTil) {
      return { displayValue: 'Fejl (Vedrører perioden mangler)', status: 'error' as DebugStatus };
    }

    // Parse menAfgoerelseDato hvis udfyldt - men kun hvis feltet er synligt og der ikke er verserende klage
    const varigeMenErSynlig = values.varigeMenAfgorelse === 'Ja';
    const shouldApplyMenCutoff = varigeMenErSynlig && !context.verserendeKlageMen;
    const menAfgoerelseDato = shouldApplyMenCutoff ? values.menAfgoerelseDato : undefined;

    try {
      // Konverter svie/smerte perioder til Date objekter, grupperet efter tilstand
      const sygemeldtPeriods: { fra: Date; til: Date }[] = [];
      const delvistSygemeldtPeriods: { fra: Date; til: Date }[] = [];

      for (const periode of perioder) {
        const hasFra = isNonEmptyString(periode.fra);
        const hasTil = isNonEmptyString(periode.til);
        const hasTilstand = isNonEmptyString(periode.tilstand);

        // Spring over tomme eller ufuldstændige rækker
        if (!hasFra || !hasTil || !hasTilstand) continue;

        // Note: periode.fra og periode.til er allerede i ISO-format
        const fraISO = periode.fra;
        const tilISO = periode.til;

        if (!fraISO || !tilISO) continue;

        const periodObj = {
          fra: isoDateToDate(fraISO),
          til: isoDateToDate(tilISO),
        };

        // Gruppér efter tilstand
        if (periode.tilstand === 'delvist-sygemeldt') {
          delvistSygemeldtPeriods.push(periodObj);
        } else if (periode.tilstand === 'sygemeldt') {
          sygemeldtPeriods.push(periodObj);
        }
      }

      if (sygemeldtPeriods.length === 0 && delvistSygemeldtPeriods.length === 0) {
        return { displayValue: '-', status: 'ok' as DebugStatus };
      }

      // Begræns til vedroererPeriode
      const vedroererFra = isoDateToDate(periodeFra);
      const vedroererTil = isoDateToDate(periodeTil);

      // Begræns også til menAfgoerelseDato (dagen før) hvis udfyldt
      let maxDate = vedroererTil;
      const dayBeforeMenISO = subtractOneDay(menAfgoerelseDato);
      if (dayBeforeMenISO) {
        const dayBeforeMen = isoDateToDate(dayBeforeMenISO);
        if (dayBeforeMen < maxDate) maxDate = dayBeforeMen;
      }

      // Funktion til at behandle en gruppe perioder
      const processPeriodGroup = (periods: { fra: Date; til: Date }[]): { fra: Date; til: Date }[] => {
        if (periods.length === 0) return [];

        // Flet perioder sammen
        const merged = mergeDateRanges(periods, { mergeAdjacent: true });

        // Klip perioder til afgrænsningerne
        return merged
          .map((p) => {
            const fra = p.fra < vedroererFra ? vedroererFra : p.fra;
            const til = p.til > maxDate ? maxDate : p.til;

            // Hvis perioden er helt uden for rammerne, skip
            if (fra > maxDate || til < vedroererFra) return null;

            return { fra, til };
          })
          .filter((p): p is { fra: Date; til: Date } => p !== null);
      };

      const constrainedSygemeldt = processPeriodGroup(sygemeldtPeriods);
      const constrainedDelvistSygemeldt = processPeriodGroup(delvistSygemeldtPeriods);

      if (constrainedSygemeldt.length === 0 && constrainedDelvistSygemeldt.length === 0) {
        return { displayValue: '-', status: 'ok' as DebugStatus };
      }

      // Kombiner alle perioder med tilstandsmarkering
      type PeriodWithType = { fra: Date; til: Date; isDelvistSyg: boolean };
      const allPeriods: PeriodWithType[] = [
        ...constrainedSygemeldt.map(p => ({ ...p, isDelvistSyg: false })),
        ...constrainedDelvistSygemeldt.map(p => ({ ...p, isDelvistSyg: true })),
      ];

      // Sortér kronologisk efter fra-dato
      allPeriods.sort((a, b) => a.fra.getTime() - b.fra.getTime());

      // Formater resultat - hver periode på sin egen linje
      const formatted = allPeriods
        .map((p) => {
          const fraISO = dateToISO(p.fra);
          const tilISO = dateToISO(p.til);
          if (!fraISO || !tilISO) {
            throw new Error('Kunne ikke formatere dato');
          }
          const fraDisplay = isoToDanish(fraISO);
          const tilDisplay = isoToDanish(tilISO);
          if (!fraDisplay || !tilDisplay) {
            throw new Error('Kunne ikke formatere dato');
          }
          const suffix = p.isDelvistSyg ? ' (delvist syg)' : '';

          // Hvis fra og til er samme dag, vis kun én dato
          if (fraDisplay === tilDisplay) {
            return `${fraDisplay}${suffix}`;
          }

          return `${fraDisplay} - ${tilDisplay}${suffix}`;
        })
        .join('\n');

      return { displayValue: formatted, status: 'ok' as DebugStatus };
    } catch {
      return { displayValue: 'Fejl (Ugyldig dato i beregning)', status: 'error' as DebugStatus };
    }
  })();

  rows.push({
    id: 'sviesmerte.beregnetPeriode',
    label: 'Svie/smerte-perioder i erstatningsperioden',
    displayValue: beregnetPeriodeResult.displayValue === '-' ? 'Nej' : beregnetPeriodeResult.displayValue,
    status: beregnetPeriodeResult.status,
    dependsOn: [
      { kind: 'id', id: 'erstatningsopgoerelse.vedroererPeriode' },
      { kind: 'prefix', prefix: 'sviesmerte.periode.' },
    ],
  });

  // 7) Antal svie/smerte dage i erstatningsperioden
  const antalDageResult = (() => {
    // Hvis ingen perioder eller beregnet periode har fejl/tom, returner tilsvarende
    if (!harPerioder) {
      return { displayValue: '-', status: 'ok' as DebugStatus };
    }

    // Hvis der er fejl i periode-felterne, returner samme fejl som periode
    if (harPeriodeFejl) {
      return { displayValue: periodeFejlBeskeder[0], status: 'error' as DebugStatus };
    }

    if (beregnetPeriodeResult.status === 'error' || beregnetPeriodeResult.displayValue === '-') {
      return { displayValue: '-', status: 'ok' as DebugStatus };
    }

    // Genberegn for at få de faktiske perioder
    const periodeFra = values.vedroererPeriodeFra;
    const periodeTil = values.vedroererPeriodeTil;

    if (!periodeFra || !periodeTil) {
      return { displayValue: '-', status: 'ok' as DebugStatus };
    }

    // Kun brug menAfgoerelseDato hvis feltet er synligt og der ikke er verserende klage
    const varigeMenErSynlig = values.varigeMenAfgorelse === 'Ja';
    const shouldApplyMenCutoff = varigeMenErSynlig && !context.verserendeKlageMen;
    const menAfgoerelseDato = shouldApplyMenCutoff ? values.menAfgoerelseDato : undefined;

    try {
      // Gruppér perioder efter tilstand
      const sygemeldtPeriods: { fra: Date; til: Date }[] = [];
      const delvistSygemeldtPeriods: { fra: Date; til: Date }[] = [];

      for (const periode of perioder) {
        const hasFra = isNonEmptyString(periode.fra);
        const hasTil = isNonEmptyString(periode.til);
        const hasTilstand = isNonEmptyString(periode.tilstand);

        if (!hasFra || !hasTil || !hasTilstand) continue;

        // Note: periode.fra og periode.til er allerede i ISO-format
        const fraISO = periode.fra;
        const tilISO = periode.til;

        if (!fraISO || !tilISO) continue;

        const periodObj = {
          fra: isoDateToDate(fraISO),
          til: isoDateToDate(tilISO),
        };

        // Gruppér efter tilstand
        if (periode.tilstand === 'delvist-sygemeldt') {
          delvistSygemeldtPeriods.push(periodObj);
        } else if (periode.tilstand === 'sygemeldt') {
          sygemeldtPeriods.push(periodObj);
        }
      }

      if (sygemeldtPeriods.length === 0 && delvistSygemeldtPeriods.length === 0) {
        return { displayValue: '-', status: 'ok' as DebugStatus };
      }

      const vedroererFra = isoDateToDate(periodeFra);
      const vedroererTil = isoDateToDate(periodeTil);

      let maxDate = vedroererTil;
      const dayBeforeMenISO2 = subtractOneDay(menAfgoerelseDato);
      if (dayBeforeMenISO2) {
        const dayBeforeMen = isoDateToDate(dayBeforeMenISO2);
        if (dayBeforeMen < maxDate) maxDate = dayBeforeMen;
      }

      // Funktion til at behandle og tælle dage for en gruppe perioder
      const processPeriodGroupDays = (periods: { fra: Date; til: Date }[]): number => {
        if (periods.length === 0) return 0;

        const merged = mergeDateRanges(periods, { mergeAdjacent: true });

        const constrained = merged
          .map((p) => {
            const fra = p.fra < vedroererFra ? vedroererFra : p.fra;
            const til = p.til > maxDate ? maxDate : p.til;

            if (fra > maxDate || til < vedroererFra) return null;

            return { fra, til };
          })
          .filter((p): p is { fra: Date; til: Date } => p !== null);

        return constrained.reduce((sum, p) => {
          const days = countInclusiveUtcDays(p.fra, p.til);
          if (days === null) {
            throw new Error('processPeriodGroupDays expected til >= fra');
          }
          return sum + days;
        }, 0);
      };

      const sygemeldtDage = processPeriodGroupDays(sygemeldtPeriods);
      const delvistSygemeldtDage = processPeriodGroupDays(delvistSygemeldtPeriods);

      if (sygemeldtDage === 0 && delvistSygemeldtDage === 0) {
        return { displayValue: '-', status: 'ok' as DebugStatus };
      }

      // Formater output
      const parts: string[] = [];
      if (sygemeldtDage > 0) {
        parts.push(`${sygemeldtDage} sygedage`);
      }
      if (delvistSygemeldtDage > 0) {
        parts.push(`${delvistSygemeldtDage} delvise sygedage`);
      }

      return { displayValue: parts.join(', '), status: 'ok' as DebugStatus };
    } catch {
      return { displayValue: 'Fejl (Ugyldig dato i beregning)', status: 'error' as DebugStatus };
    }
  })();

  rows.push({
    id: 'sviesmerte.antalDage',
    label: 'Antal svie/smerte dage i erstatningsperioden',
    displayValue: antalDageResult.displayValue,
    status: antalDageResult.status,
    dependsOn: [
      { kind: 'id', id: 'sviesmerte.beregnetPeriode' },
    ],
  });

  // 8) Beregnet svie/smerte beløb
  const beregnetBeloebResult = (() => {
    if (!canonicalOutput) {
      return {
        displayValue: '-',
        status: 'ok' as DebugStatus,
        naetMaxIPerioden: false,
      };
    }

    return {
      displayValue: `${formatCurrency(canonicalOutput.totals.svieSmerteOre / 100)} kr.`,
      status: 'ok' as DebugStatus,
      naetMaxIPerioden: canonicalOutput.svieSmerte.maxApplied,
    };
  })();

  rows.push({
    id: 'sviesmerte.beregnetBeloeb',
    label: 'Beregnet svie/smerte',
    displayValue: beregnetBeloebResult.displayValue,
    status: beregnetBeloebResult.status,
    dependsOn: [
      { kind: 'id', id: 'sviesmerte.antalDage' },
      { kind: 'id', id: 'sviesmerte.satserAar' },
      { kind: 'id', id: 'sviesmerte.delvisSygemeldingSats' },
    ],
  });

  const lastSvieSmerteKravDato = (() => {
    let latest: ISODateString | undefined = undefined;
    for (const periode of values.svieSmertePerioder ?? []) {
      const hasFra = isNonEmptyString(periode.fra);
      const hasTil = isNonEmptyString(periode.til);
      const hasTilstand = isNonEmptyString(periode.tilstand);
      if (!hasFra || !hasTil || !hasTilstand) continue;
      if (periode.fra && periode.til && periode.fra <= periode.til) {
        if (!latest || periode.til > latest) latest = periode.til;
      }
    }
    return latest;
  })();

  const svieSmerteOphoerSkyldes = (() => {
    if (values.beregnesSvieSmerteGodtgoerelse === 'Nej') {
      return { displayValue: 'Ingen krav i perioden', status: 'ok' as DebugStatus };
    }

    if (values.tidligereSsMax === 'Ja') {
      return { displayValue: 'Tidligere beregnet til max', status: 'ok' as DebugStatus };
    }

    if (lastSvieSmerteKravDato && values.vedroererPeriodeTil && lastSvieSmerteKravDato >= values.vedroererPeriodeTil) {
      const vedroererPeriodeTilDanish = isoToDanish(values.vedroererPeriodeTil);
      return {
        displayValue: vedroererPeriodeTilDanish
          ? `Erstatningsperiodens ophør (${vedroererPeriodeTilDanish})`
          : 'Erstatningsperiodens ophør',
        status: 'ok' as DebugStatus,
      };
    }

    if (
      lastSvieSmerteKravDato &&
      values.varigeMenAfgorelse === 'Ja' &&
      values.verserendeKlageMen === 'Nej' &&
      values.menAfgoerelseDato &&
      subtractOneDay(values.menAfgoerelseDato) === lastSvieSmerteKravDato
    ) {
      return { displayValue: 'Ménafgørelse', status: 'ok' as DebugStatus };
    }

    if (beregnetBeloebResult.naetMaxIPerioden) {
      return { displayValue: 'Nået max i denne periode', status: 'ok' as DebugStatus };
    }

    if (values.svieSmerteHelbredsstatus === 'Raskmeldt') {
      return { displayValue: 'Raskmeldt', status: 'ok' as DebugStatus };
    }

    return { displayValue: svieSmerteIkkeRejstLabel, status: 'warning' as DebugStatus };
  })();

  rows.push({
    id: 'sviesmerte.ophoerSkyldes',
    label: 'Svie/smerte ophør skyldes',
    displayValue: svieSmerteOphoerSkyldes.displayValue,
    status: svieSmerteOphoerSkyldes.status,
  });

  return rows;
};

export const buildEODebugTaftRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldErrorsBySource,
  context: Readonly<{
    skadesdatoISO: ISODateString | undefined;
    erErhvervssygdom: boolean;
    endeligEETBeregnetDato: ISODateString | undefined;
    midlertidigEETBeregnetDato: ISODateString | undefined;
    differencekravDato: ISODateString | undefined;
    verserendeKlageEet: boolean;
  }>,
  canonicalOutput?: EoCanonicalOutput
): DebugRowModel[] => {
  const rows: DebugRowModel[] = [];
  const tafBeregnesSom = computeTafBeregningsenhed(values);
  const perioder = values.tafPerioder ?? [];
  const synligeTafPerioder = perioder.filter((periode) => periode.fra || periode.til);
  const harPerioder = synligeTafPerioder.length > 0;
  const periodeLabel = synligeTafPerioder.length === 1 ? 'Periode' : 'Perioder';

  if (!harPerioder) {
    return [{
      id: 'taf.periode.empty',
      label: periodeLabel,
      displayValue: 'Ingen',
      status: 'ok',
    }];
  }

  const tafBounds = resolveTafConstraintBounds(values);
  const clampedTafById = new Map<string, { fra: ISODateString; til: ISODateString }>();
  const tafIkkeRejstLabel = 'Ikke rejst TAF-krav for hele perioden';

  const lastTafKravDato = (() => {
    let latest: ISODateString | undefined = undefined;
    for (const periode of values.tafPerioder ?? []) {
      const valid = getValidTafRange(periode);
      if (!valid) continue;
      const clamped = clampTafRange(valid, tafBounds);
      if (!clamped) continue;
      clampedTafById.set(periode.id, clamped);
      if (!latest || clamped.til > latest) latest = clamped.til;
    }
    return latest;
  })();

  const tafOphoerSkyldes = (() => {
    if (!lastTafKravDato) return tafIkkeRejstLabel;

    const endeligEetMinus1 = subtractOneDay(context.endeligEETBeregnetDato);
    if (!context.verserendeKlageEet && endeligEetMinus1 && endeligEetMinus1 === lastTafKravDato) {
      return 'Endelig EET-afgørelse';
    }

    const differencekravMinus1 = subtractOneDay(context.differencekravDato);
    if (!context.verserendeKlageEet && differencekravMinus1 && differencekravMinus1 === lastTafKravDato) {
      return 'Differencekrav opgjort';
    }

    if (values.vedroererPeriodeTil && values.vedroererPeriodeTil <= lastTafKravDato) {
      return 'Erstatningsperiodens ophør';
    }

    return tafIkkeRejstLabel;
  })();

  const tafOphoerSkyldesDatoISO = (() => {
    if (!lastTafKravDato) return undefined;

    const endeligEetMinus1 = subtractOneDay(context.endeligEETBeregnetDato);
    if (!context.verserendeKlageEet && endeligEetMinus1 && endeligEetMinus1 === lastTafKravDato) {
      return context.endeligEETBeregnetDato;
    }

    const differencekravMinus1 = subtractOneDay(context.differencekravDato);
    if (!context.verserendeKlageEet && differencekravMinus1 && differencekravMinus1 === lastTafKravDato) {
      return context.differencekravDato;
    }

    if (values.vedroererPeriodeTil && values.vedroererPeriodeTil <= lastTafKravDato) {
      return values.vedroererPeriodeTil;
    }

    return undefined;
  })();

  const tafOphoerSkyldesDisplayValue = (() => {
    const dateDanish = tafOphoerSkyldesDatoISO ? isoToDanish(tafOphoerSkyldesDatoISO) : undefined;
    return dateDanish ? `${tafOphoerSkyldes} (${dateDanish})` : tafOphoerSkyldes;
  })();

  rows.push({
    id: 'taf.ophoerSkyldes',
    label: 'TAF-ophør skyldes',
    displayValue: tafOphoerSkyldesDisplayValue,
    status: tafOphoerSkyldes === tafIkkeRejstLabel ? 'warning' : 'ok',
  });

  const endeligEETMinus1 = subtractOneDay(context.endeligEETBeregnetDato);
  const differencekravMinus1 = subtractOneDay(context.differencekravDato);

  let combinedExtraMaxDate: ISODateString | undefined = undefined;
  if (differencekravMinus1) {
    combinedExtraMaxDate = differencekravMinus1;
  }
  if (!context.verserendeKlageEet && endeligEETMinus1) {
    if (!combinedExtraMaxDate || endeligEETMinus1 < combinedExtraMaxDate) {
      combinedExtraMaxDate = endeligEETMinus1;
    }
  }

  const skadesdatoMinRule = computeSkadesdatoMinRule({
    skadesdatoISO: context.skadesdatoISO,
    erErhvervssygdom: context.erErhvervssygdom,
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMin,
  });

  const validateRowDate = (args: {
    iso: ISODateString | undefined;
    minDate: ISODateString;
    maxDate: ISODateString;
    noValidRangeCause?: string | undefined;
  }): string | undefined => {
    if (args.minDate > args.maxDate) {
      return buildNoValidDateRangeMessage({
        minDate: args.minDate,
        maxDate: args.maxDate,
        noValidRangeCause: args.noValidRangeCause,
      });
    }
    if (!args.iso) return undefined;
    const result = validateISODateRange(args.iso, args.minDate, args.maxDate);
    return result.isValid ? undefined : result.errorMessage;
  };

  // 1) Periode-rækker fra tabellen
  const tafOverlappingIds = detectOverlappingPeriods(values.tafPerioder ?? []);

  const ferieperioder = values.ferieperioder ?? [];

  const formatDaNumber = (n: number): string => n.toLocaleString('da-DK');
  const formatMaaneder = (n: number): string => {
    const rounded = roundByMethod(n, 4, 'halfAwayFromZero');
    return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  };

  perioder.forEach((periode) => {
    const hasFra = isNonEmptyString(periode.fra);
    const hasTil = isNonEmptyString(periode.til);

    // Tjek om begge felter er udfyldt eller begge er tomme
    const filledCount = [hasFra, hasTil].filter(Boolean).length;
    const allFilled = filledCount === 2;
    const noneFilled = filledCount === 0;

    // Spring over rækker hvor intet er udfyldt
    if (noneFilled) return;

    // Hvis ikke alle felter er udfyldt, vis fejl
    if (!allFilled) {
      const displayValue = 'Fejl (Ikke alle felter udfyldt)';
      rows.push({
        id: `taf.periode.${periode.id}`,
        label: periodeLabel,
        displayValue,
        status: 'error',
      });
      return;
    }

    // Konverter til dansk format for visning
    const fraISO = periode.fra;
    const tilISO = periode.til;

    if (!fraISO || !tilISO) {
      const displayValue = 'Fejl (Ugyldig dato)';
      rows.push({
        id: `taf.periode.${periode.id}`,
        label: periodeLabel,
        displayValue,
        status: 'error',
      });
      return;
    }

    const clamped = clampedTafById.get(periode.id);
    const displayFra = clamped?.fra;
    const displayTil = clamped?.til;
    const displayFraDanish = displayFra ? isoToDanish(displayFra) : undefined;
    const displayTilDanish = displayTil ? isoToDanish(displayTil) : undefined;
    const periodeRowLabel =
      displayFraDanish && displayTilDanish ? `${periodeLabel} (${displayFraDanish} - ${displayTilDanish})` : periodeLabel;

    const bounds = computeRowDateBounds({
      skadesdatoMinDate: skadesdatoMinRule.minDate,
      rowFra: fraISO,
      rowTil: tilISO,
      fallbackMin: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMin,
      fallbackMax: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMax,
      tilFallbackMax: TODAY,
      tilExtraMaxDate: combinedExtraMaxDate,
      useTilExtraMaxDate: true,
    });

    const fraNoValidRangeCause = (() => {
      const parts: string[] = [];
      if (skadesdatoMinRule.minBoundKind) parts.push('skadesdato');
      if (tilISO) parts.push('til-dato i samme række');
      return parts.length > 0 ? parts.join(', ') : undefined;
    })();

    const tilNoValidRangeCause = (() => {
      const parts: string[] = [];
      if (!fraISO && skadesdatoMinRule.minBoundKind) parts.push('skadesdato');
      if (fraISO) parts.push('fra-dato i samme række');
      parts.push('dags dato');
      if (context.differencekravDato) parts.push('differencekrav-dato');
      if (!context.verserendeKlageEet && context.endeligEETBeregnetDato) parts.push('beregnet dato for endeligt EET');
      return parts.join(', ');
    })();

    const fraRangeErrorMessage = validateRowDate({
      iso: fraISO,
      minDate: bounds.fra.min,
      maxDate: bounds.fra.max,
      noValidRangeCause: fraNoValidRangeCause,
    });
    const tilRangeErrorMessage = validateRowDate({
      iso: tilISO,
      minDate: bounds.til.min,
      maxDate: bounds.til.max,
      noValidRangeCause: tilNoValidRangeCause,
    });
    const computedRangeMessages = [fraRangeErrorMessage, tilRangeErrorMessage].filter(
      (m): m is string => typeof m === 'string' && m.trim() !== ''
    );

    const hasOverlap = tafOverlappingIds.has(periode.id);
    const endeligEetCutoff = !context.verserendeKlageEet ? context.endeligEETBeregnetDato : undefined;
    const midlertidigEetCutoff = !context.verserendeKlageEet ? context.midlertidigEETBeregnetDato : undefined;
    const fraCutoffError = buildTafCutoffErrorMessage({
      value: fraISO,
      differencekravDato: context.differencekravDato,
      endeligEETDato: endeligEetCutoff,
      midlertidigEETDato: midlertidigEetCutoff,
    });
    const tilCutoffError = buildTafCutoffErrorMessage({
      value: tilISO,
      differencekravDato: context.differencekravDato,
      endeligEETDato: endeligEetCutoff,
      midlertidigEETDato: midlertidigEetCutoff,
    });
    const preferredFieldErrorMessages = [fraCutoffError, tilCutoffError].filter(
      (message): message is string => typeof message === 'string' && message.trim() !== ''
    );

    if (hasOverlap || preferredFieldErrorMessages.length > 0 || computedRangeMessages.length > 0) {
      const fraFoerTilError = fraISO > tilISO
        ? 'Der er indtastet en til-dato, som ligger før fra-datoen'
        : undefined;
      const rangeOrCutoffErrorMessage =
        preferredFieldErrorMessages.length > 0
          ? preferredFieldErrorMessages.join('; ')
          : (fraFoerTilError ?? computedRangeMessages.join('; '));
      const errorMessages =
        hasOverlap && rangeOrCutoffErrorMessage
          ? `${rangeOrCutoffErrorMessage}; Der er overlappende perioder`
          : (rangeOrCutoffErrorMessage || 'Der er overlappende perioder');
      rows.push({
        id: `taf.periode.${periode.id}`,
        label: periodeRowLabel,
        displayValue: `Fejl (${errorMessages})`,
        status: 'error',
      });
      return;
    }

    if (!displayFra || !displayTil || !displayFraDanish || !displayTilDanish) {
      rows.push({
        id: `taf.periode.${periode.id}`,
        label: periodeRowLabel,
        displayValue: '-',
        status: 'ok',
      });
      return;
    }

    const loseFeriedage = typeof periode.loseFeriedage === 'number' ? periode.loseFeriedage : 0;
    const breakdown = calculateTafArbejdsdageBreakdown(
      displayFra,
      displayTil,
      ferieperioder,
      loseFeriedage,
      { kind: 'taf' }
    );

    const antalMaaneder = calculateTafAntalMaanederPraecis(
      displayFra,
      displayTil,
      0
    );
    const maanederDisplay = antalMaaneder === null ? '-' : `${formatMaaneder(antalMaaneder)} måneder`;
    const arbejdsdageDisplay = breakdown
      ? `${formatDaNumber(breakdown.arbejdsdage)} hverdage - ${formatDaNumber(breakdown.shDage)} SH-dage - ${formatDaNumber(breakdown.feriedage)} feriedage - ${formatDaNumber(breakdown.loseFeriedage)} løse feriedage = ${formatDaNumber(breakdown.tafDage)} arbejdsdage`
      : '-';

    const visMaaneder = tafBeregnesSom === TAF_BEREGNES_SOM.MAANEDER;
    const displayValue = visMaaneder ? maanederDisplay : arbejdsdageDisplay;
    const status: DebugStatus = visMaaneder
      ? (antalMaaneder === null ? 'error' : 'ok')
      : (breakdown ? 'ok' : 'error');

    rows.push({
      id: `taf.periode.${periode.id}`,
      label: periodeRowLabel,
      displayValue,
      status,
    });

    // TODO(b): Tilføj en ekstra debug-linje pr. periode med den tilsvarende månedsberegning (samme princip som EO-oplysninger, men eksplicit i debug-output).
  });

  // 2) Ferieperiode-rækker fra tabellen
  const harFerieperioder = ferieperioder.length > 0 && ferieperioder.some((p) => p.fra || p.til);
  const ferieperiodeLabel = ferieperioder.filter((p) => p.fra || p.til).length === 1 ? 'Ferieperiode' : 'Ferieperioder';

  // Detektér overlappende ferieperioder
  const ferieOverlappingIds = detectOverlappingPeriods(ferieperioder);

  if (!harFerieperioder) {
    rows.push({
      id: 'taf.ferie.empty',
      label: ferieperiodeLabel,
      displayValue: 'Ingen',
      status: 'ok',
    });
  } else {
    ferieperioder.forEach((periode) => {
      const hasFra = isNonEmptyString(periode.fra);
      const hasTil = isNonEmptyString(periode.til);

      // Tjek om begge felter er udfyldt eller begge er tomme
      const filledCount = [hasFra, hasTil].filter(Boolean).length;
      const allFilled = filledCount === 2;
      const noneFilled = filledCount === 0;

      // Spring over rækker hvor intet er udfyldt
      if (noneFilled) return;

      // Tjek for overlappende periode
      const hasOverlap = ferieOverlappingIds.has(periode.id);

      // Hvis ikke alle felter er udfyldt, vis fejl
      if (!allFilled) {
        const displayValue = 'Fejl (Ikke alle felter udfyldt)';
        rows.push({
          id: `taf.ferie.${periode.id}`,
          label: ferieperiodeLabel,
          displayValue,
          status: 'error',
        });
        return;
      }

      // Konverter til dansk format for visning
      const fraISO = periode.fra;
      const tilISO = periode.til;

      if (!fraISO || !tilISO) {
        const displayValue = 'Fejl (Ugyldig dato)';
        rows.push({
          id: `taf.ferie.${periode.id}`,
          label: ferieperiodeLabel,
          displayValue,
          status: 'error',
        });
        return;
      }

      const bounds = computeRowDateBounds({
        skadesdatoMinDate: skadesdatoMinRule.minDate,
        rowFra: fraISO,
        rowTil: tilISO,
        fallbackMin: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMin,
        fallbackMax: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMax,
        tilFallbackMax: TODAY,
        tilExtraMaxDate: combinedExtraMaxDate,
        useTilExtraMaxDate: true,
      });

      const fraNoValidRangeCause = (() => {
        const parts: string[] = [];
        if (skadesdatoMinRule.minBoundKind) parts.push('skadesdato');
        if (tilISO) parts.push('til-dato i samme række');
        return parts.length > 0 ? parts.join(', ') : undefined;
      })();

      const tilNoValidRangeCause = (() => {
        const parts: string[] = [];
        if (!fraISO && skadesdatoMinRule.minBoundKind) parts.push('skadesdato');
        if (fraISO) parts.push('fra-dato i samme række');
        parts.push('dags dato');
        if (context.differencekravDato) parts.push('differencekrav-dato');
        if (!context.verserendeKlageEet && context.endeligEETBeregnetDato) parts.push('beregnet dato for endeligt EET');
        return parts.join(', ');
      })();

      const fraRangeErrorMessage = validateRowDate({
        iso: fraISO,
        minDate: bounds.fra.min,
        maxDate: bounds.fra.max,
        noValidRangeCause: fraNoValidRangeCause,
      });
      const tilRangeErrorMessage = validateRowDate({
        iso: tilISO,
        minDate: bounds.til.min,
        maxDate: bounds.til.max,
        noValidRangeCause: tilNoValidRangeCause,
      });
      const computedRangeMessages = [fraRangeErrorMessage, tilRangeErrorMessage].filter(
        (m): m is string => typeof m === 'string' && m.trim() !== ''
      );

      if (hasOverlap || computedRangeMessages.length > 0) {
        const errorMessages = hasOverlap ? 'Der er overlappende perioder' : computedRangeMessages.join('; ');
        rows.push({
          id: `taf.ferie.${periode.id}`,
          label: ferieperiodeLabel,
          displayValue: `Fejl (${errorMessages})`,
          status: 'error',
        });
        return;
      }

      const fraDanish = isoToDanish(fraISO);
      const tilDanish = isoToDanish(tilISO);
      if (!fraDanish || !tilDanish) {
        rows.push({
          id: `taf.ferie.${periode.id}`,
          label: ferieperiodeLabel,
          displayValue: 'Fejl (Ugyldig dato)',
          status: 'error',
        });
        return;
      }

      // Formater displayValue som "fra-dato - til-dato"
      const periodeDisplay = `${fraDanish} - ${tilDanish}`;

      rows.push({
        id: `taf.ferie.${periode.id}`,
        label: ferieperiodeLabel,
        displayValue: periodeDisplay,
        status: 'ok',
      });

      // TODO(c): Tilføj en ekstra debug-linje under hver ferieperiode med beregning som både arbejdsdage og måneder (dvs. samme beregningsgrundlag som TAF-perioden, men scoped til ferieperioden).
    });
  }

  // 3) Evt. allerede modtaget tabt arbejdsfortjeneste for nuværende erstatningsperiode
  const tidligereModtagetTafDisplay =
    canonicalOutput?.taf.tidligereModtagetTafOre !== null &&
    canonicalOutput?.taf.tidligereModtagetTafOre !== undefined
      ? formatCurrency(canonicalOutput.taf.tidligereModtagetTafOre / 100)
      : formatCurrency(amountValueToNumber(values.tidligereModtagetTaf));
  rows.push({
    id: 'taf.tidligereModtagetTaf',
    label: 'Evt. allerede modtaget tabt arbejdsfortjeneste for nuværende erstatningsperiode',
    ...resolveDebugDisplay({ value: tidligereModtagetTafDisplay, errors: errors.tidligereModtagetTaf, emptyState: 'ok' }),
  });

  return rows;
};

export const buildEODebugTafBeregningsgrundlagRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldErrorsBySource,
  stamdataValues: PersistedSectionMap['stamdata']
): DebugRowModel[] => {
  const rows: DebugRowModel[] = [];

  const formatDaNumber = (n: number): string => n.toLocaleString('da-DK');
  const tafBeregnesSom = computeTafBeregningsenhed(values);

  rows.push({
    id: 'taf.beregningsgrundlag.beregnesUdFra',
    label: 'Beregnes ud fra',
    ...resolveDebugDisplay({
      value: values.beregnesUdFra,
      errors: errors.beregnesUdFra,
      emptyState: 'error',
    }),
  });

  rows.push({
    id: 'taf.beregnesSom',
    label: 'TAF beregnes som',
    displayValue: tafBeregnesSom,
    status: 'ok',
    dependsOn: [
      { kind: 'id', id: 'taf.beregningsgrundlag.beregnesUdFra' },
    ],
  });

  const beregnesUdFra = values.beregnesUdFra;
  const isBeregningsperiode = beregnesUdFra === 'Beregningsperiode';
  const periodeFra = values.periodeTilBeregningFra;
  const periodeTil = values.periodeTilBeregningTil;

  const periodeFraErrors = collectPresentFieldErrors(errors.periodeTilBeregningFra);
  const periodeTilErrors = collectPresentFieldErrors(errors.periodeTilBeregningTil);
  const hasPeriodeErrors = periodeFraErrors.length > 0 || periodeTilErrors.length > 0;
  const hasPeriodeErrorSeverity = periodeFraErrors.concat(periodeTilErrors).some((e) => e.severity === 'error');

  const periodeErrorValue = (() => {
    if (!hasPeriodeErrors) return undefined;

    const parts: string[] = [];
    for (const e of periodeFraErrors) {
      parts.push(`Fra og med: ${e.message.trim()}`);
    }
    for (const e of periodeTilErrors) {
      parts.push(`Til og med: ${e.message.trim()}`);
    }
    const hasError = periodeFraErrors.concat(periodeTilErrors).some((e) => e.severity === 'error');
    return `${hasError ? 'Fejl' : 'Advarsel'} (${parts.join('; ')})`;
  })();

  const beregningsperiodeDisplay = (() => {
    const hasFra = isNonEmptyString(periodeFra);
    const hasTil = isNonEmptyString(periodeTil);
    const filledCount = [hasFra, hasTil].filter(Boolean).length;

    if (!isBeregningsperiode) {
      return { displayValue: '-', status: 'ok' as DebugStatus };
    }
    if (periodeErrorValue) {
      return { displayValue: periodeErrorValue, status: hasPeriodeErrorSeverity ? 'error' as DebugStatus : 'warning' as DebugStatus };
    }

    if (filledCount !== 2) {
      return { displayValue: 'Fejl (Ikke alle felter udfyldt)', status: 'error' as DebugStatus };
    }
    if (!periodeFra || !periodeTil) {
      return { displayValue: 'Fejl (Ugyldig dato)', status: 'error' as DebugStatus };
    }
    if (periodeFra > periodeTil) {
      return { displayValue: 'Fejl (Fra-dato er efter til-dato)', status: 'error' as DebugStatus };
    }

    const overlap = computeTafOverlapWithBeregningsperiode({
      beregningsperiode: { fra: periodeFra, til: periodeTil },
      tafPerioder: (values.tafPerioder ?? []).map((periode) => ({
        id: periode.id,
        fra: periode.fra,
        til: periode.til,
      })),
    });
    if (overlap.firstOverlapMessage) {
      return { displayValue: `Fejl (${overlap.firstOverlapMessage})`, status: 'error' as DebugStatus };
    }

    const fraDanish = isoToDanish(periodeFra);
    const tilDanish = isoToDanish(periodeTil);
    if (!fraDanish || !tilDanish) {
      return { displayValue: 'Fejl (Ugyldig dato)', status: 'error' as DebugStatus };
    }

    return { displayValue: `${fraDanish} - ${tilDanish}`, status: 'ok' as DebugStatus };
  })();

  const beregningsperiodeOverlap = computeTafOverlapWithBeregningsperiode({
    beregningsperiode: { fra: periodeFra, til: periodeTil },
    tafPerioder: (values.tafPerioder ?? []).map((periode) => ({
      id: periode.id,
      fra: periode.fra,
      til: periode.til,
    })),
  });
  const beregningsperiodeRangeOk =
    Boolean(periodeFra && periodeTil && periodeFra <= periodeTil) &&
    !hasPeriodeErrorSeverity &&
    !beregningsperiodeOverlap.firstOverlapMessage;

  if (isBeregningsperiode) {
    rows.push({
      id: 'taf.beregningsgrundlag.beregningsperiode',
      label: 'Periode til beregning af før-løn',
      displayValue: beregningsperiodeDisplay.displayValue,
      status: beregningsperiodeDisplay.status,
    });
  }

  const indkomstIBeregningsperiodenDisplay = (() => {
    if (!isBeregningsperiode) return null;
    const beregningsperiodeRange = buildBeregningsperiodeRange(values);
    if (!beregningsperiodeRange) return null;
    const income = buildIncomeForRanges(values, [beregningsperiodeRange]);
    const hasIncome = income.employers.length > 0 || income.benefits.length > 0;
    if (hasIncome) return null;

    const fraDanish = isoToDanish(beregningsperiodeRange.fra);
    const tilDanish = isoToDanish(beregningsperiodeRange.til);
    if (!fraDanish || !tilDanish) {
      return {
        label: 'Indkomst',
        displayValue: '-',
        message: 'Ingen indkomst i beregningsperioden',
        status: 'error' as DebugStatus,
      };
    }
    return {
      label: 'Indkomst',
      displayValue: '-',
      message: `Ingen indkomst i beregningsperioden (${fraDanish} - ${tilDanish})`,
      status: 'error' as DebugStatus,
    };
  })();

  const beregningsperiodeRangeForIncomeWarning = isBeregningsperiode
    ? buildBeregningsperiodeRange(values)
    : undefined;
  const beregningsperiodeIncomeForWarning = beregningsperiodeRangeForIncomeWarning
    ? buildIncomeForRanges(values, [beregningsperiodeRangeForIncomeWarning])
    : null;
  const employersWithIncomeInBeregningsperiode = beregningsperiodeIncomeForWarning?.employers ?? [];
  const hasEmployerIncomeWithoutFuldLoenUnderFerie = employersWithIncomeInBeregningsperiode.some((employer) => {
    const ansaettelsesforhold = (values.loenindkomstAnsaettelsesforhold ?? []).find((af) => af.id === employer.id);
    return ansaettelsesforhold?.fuldLoenUnderFerie === 'Nej';
  });
  const hasSixPlusMaanederBeregningsperiode = (() => {
    if (!isBeregningsperiode) return false;
    if (!isISODateString(periodeFra) || !isISODateString(periodeTil) || periodeFra > periodeTil) return false;
    const periodeTilDate = parseISODate(periodeTil);
    if (!periodeTilDate) return false;
    const inclusivePeriodeEnd = dateToISO(addDays(periodeTilDate, 1));
    if (!inclusivePeriodeEnd) return false;
    return calculateElapsedWholeMonthsDebug(periodeFra, inclusivePeriodeEnd) >= 6;
  })();
  const hasNoUspecificeredeFerieFridageValue = values.uspecificeredeFerieFridage === undefined;

  if (indkomstIBeregningsperiodenDisplay) {
    rows.push({
      id: 'taf.beregningsgrundlag.indkomst',
      label: indkomstIBeregningsperiodenDisplay.label,
      displayValue: indkomstIBeregningsperiodenDisplay.displayValue,
      message: indkomstIBeregningsperiodenDisplay.message,
      status: indkomstIBeregningsperiodenDisplay.status,
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregningsperiode' },
      ],
    });
  }

  const fravaerPerioder = values.fravaerPerioder ?? [];
  const shouldIncludeFravaer = isBeregningsperiode;
  const harFravaer =
    shouldIncludeFravaer && fravaerPerioder.length > 0 && fravaerPerioder.some((p) => p.fra || p.til);
  const fravaerOverlappingIds = detectOverlappingPeriods(fravaerPerioder);
  const hasValidBeregningsperiodeBounds =
    isBeregningsperiode && periodeFra !== undefined && periodeTil !== undefined && periodeFra <= periodeTil;
  const shouldShowLongBeregningsperiodeNoFerieWarning =
    shouldIncludeFravaer &&
    !harFravaer &&
    hasNoUspecificeredeFerieFridageValue &&
    hasEmployerIncomeWithoutFuldLoenUnderFerie &&
    hasSixPlusMaanederBeregningsperiode;

  if (shouldIncludeFravaer && !harFravaer) {
    rows.push({
      id: 'taf.beregningsgrundlag.ferie.empty',
      label: 'Ferieperiode',
      displayValue: shouldShowLongBeregningsperiodeNoFerieWarning ? '> 6 måneders beregningsperiode uden ferie' : '-',
      status: shouldShowLongBeregningsperiodeNoFerieWarning ? 'warning' : 'ok',
      message: shouldShowLongBeregningsperiodeNoFerieWarning
        ? 'Ingen ferie i beregningsperiode på > 6 måneder forekommer tvivlsomt'
        : undefined,
      summaryDisplay: shouldShowLongBeregningsperiodeNoFerieWarning ? 'messageOnly' : undefined,
    });
  } else if (shouldIncludeFravaer) {
    fravaerPerioder.forEach((periode) => {
      const hasFra = isNonEmptyString(periode.fra);
      const hasTil = isNonEmptyString(periode.til);
      const filledCount = [hasFra, hasTil].filter(Boolean).length;
      const allFilled = filledCount === 2;
      const noneFilled = filledCount === 0;

      if (noneFilled) return;

      if (!allFilled) {
        rows.push({
          id: `taf.beregningsgrundlag.ferie.${periode.id}`,
          label: 'Ferieperiode',
          displayValue: 'Fejl (Ikke alle felter udfyldt)',
          status: 'error',
        });
        return;
      }

      const fraISO = periode.fra;
      const tilISO = periode.til;
      if (!fraISO || !tilISO) {
        rows.push({
          id: `taf.beregningsgrundlag.ferie.${periode.id}`,
          label: 'Ferieperiode',
          displayValue: 'Fejl (Ugyldig dato)',
          status: 'error',
        });
        return;
      }

      if (fraISO > tilISO) {
        rows.push({
          id: `taf.beregningsgrundlag.ferie.${periode.id}`,
          label: 'Ferieperiode',
          displayValue: 'Fejl (Fra-dato er efter til-dato)',
          status: 'error',
        });
        return;
      }

      if (fravaerOverlappingIds.has(periode.id)) {
        rows.push({
          id: `taf.beregningsgrundlag.ferie.${periode.id}`,
          label: 'Ferieperiode',
          displayValue: 'Fejl (Der er overlappende perioder)',
          status: 'error',
        });
        return;
      }

      if (hasValidBeregningsperiodeBounds && (fraISO < periodeFra || tilISO > periodeTil)) {
        rows.push({
          id: `taf.beregningsgrundlag.ferie.${periode.id}`,
          label: 'Ferieperiode',
          displayValue: 'Fejl (Ferieperioden ligger uden for beregningsperioden)',
          status: 'error',
        });
        return;
      }

      const fraDanish = isoToDanish(fraISO);
      const tilDanish = isoToDanish(tilISO);
      if (!fraDanish || !tilDanish) {
        rows.push({
          id: `taf.beregningsgrundlag.ferie.${periode.id}`,
          label: 'Ferieperiode',
          displayValue: 'Fejl (Ugyldig dato)',
          status: 'error',
        });
        return;
      }

      const feriedage = calculateFerieHverdageMinusSHDage(fraISO, tilISO);
      const periodeLabel = `Ferieperiode (${fraDanish} - ${tilDanish})`;
      rows.push({
        id: `taf.beregningsgrundlag.ferie.${periode.id}`,
        label: periodeLabel,
        displayValue: feriedage === null ? '-' : `${formatDaNumber(feriedage)} feriedage`,
        status: feriedage === null ? 'error' : 'ok',
      });
    });
  }

  const uspecificeredeFerie = values.uspecificeredeFerieFridage;
  if (isBeregningsperiode) {
    rows.push({
      id: 'taf.beregningsgrundlag.uspecificeredeFerieFridage',
      label: 'Uspecificerede ferie-/feriefridage',
      displayValue:
        typeof uspecificeredeFerie === 'number'
          ? `${formatDaNumber(uspecificeredeFerie)} dage`
          : '-',
      status: 'ok',
    });

    rows.push({
      id: 'taf.beregningsgrundlag.oevrigtFravaerUdenLoen',
      label: 'Øvrigt fravær uden løn',
      displayValue: values.oevrigtFravaerUdenLoen,
      status: 'ok',
    });
  }

  const oevrigeFravaersdage = values.oevrigeFravaersdage;
  const oevrigtFravaerAktivt = isBeregningsperiode && values.oevrigtFravaerUdenLoen === 'Ja';
  const oevrigeFravaersdageDisplay = (() => {
    if (!oevrigtFravaerAktivt) return { displayValue: '-', status: 'ok' as DebugStatus };
    if (oevrigeFravaersdage === undefined) {
      return { displayValue: 'Fejl (Antal fraværsdage mangler)', status: 'error' as DebugStatus };
    }
    if (oevrigeFravaersdage === 0) {
      return { displayValue: 'Advarsel (Antal fraværsdage er 0)', status: 'warning' as DebugStatus };
    }
    return { displayValue: `${formatDaNumber(oevrigeFravaersdage)} dage`, status: 'ok' as DebugStatus };
  })();

  if (isBeregningsperiode) {
    rows.push({
      id: 'taf.beregningsgrundlag.oevrigeFravaersdage',
      label: 'Antal fraværsdage',
      displayValue: oevrigeFravaersdageDisplay.displayValue,
      status: oevrigeFravaersdageDisplay.status,
    });
  }

  const oevrigeFravaerBeskrivelse = values.oevrigeFravaersdageBeskrivelse?.trim() ?? '';
  const oevrigeFravaerBeskrivelseDisplay = (() => {
    if (!oevrigtFravaerAktivt) return { displayValue: '-', status: 'ok' as DebugStatus };
    if (oevrigeFravaerBeskrivelse === '') {
      return { displayValue: 'Advarsel (Beskrivelse mangler)', status: 'warning' as DebugStatus };
    }
    return { displayValue: oevrigeFravaerBeskrivelse, status: 'ok' as DebugStatus };
  })();

  if (isBeregningsperiode) {
    rows.push({
      id: 'taf.beregningsgrundlag.oevrigeFravaersdageBeskrivelse',
      label: 'Beskrivelse',
      displayValue: oevrigeFravaerBeskrivelseDisplay.displayValue,
      status: oevrigeFravaerBeskrivelseDisplay.status,
    });
  }

  const arbejdsdageRow = (() => {
    if (!isBeregningsperiode) {
      return { label: 'Arbejdsdage', displayValue: '-', status: 'ok' as DebugStatus };
    }
    if (!beregningsperiodeRangeOk || !periodeFra || !periodeTil) {
      return { label: 'Arbejdsdage', displayValue: 'Fejl (Beregningsperioden er ugyldig)', status: 'error' as DebugStatus };
    }
    if (values.oevrigtFravaerUdenLoen === 'Ja' && values.oevrigeFravaersdage === undefined) {
      return { label: 'Arbejdsdage', displayValue: 'Fejl (Antal fraværsdage mangler)', status: 'error' as DebugStatus };
    }

    const beregningsFerieperioder = values.fravaerPerioder ?? [];
    const loseFeriedage = typeof values.uspecificeredeFerieFridage === 'number' ? values.uspecificeredeFerieFridage : 0;
    const oevrigeFravaersdageValue =
      values.oevrigtFravaerUdenLoen === 'Ja' && typeof values.oevrigeFravaersdage === 'number'
        ? values.oevrigeFravaersdage
        : 0;
    const breakdown = calculateTafArbejdsdageBreakdown(
      periodeFra,
      periodeTil,
      beregningsFerieperioder,
      loseFeriedage,
      { kind: 'beregningsgrundlag', oevrigeFravaersdage: oevrigeFravaersdageValue }
    );
    if (!breakdown) {
      return { label: 'Arbejdsdage', displayValue: 'Fejl (Ugyldig periode)', status: 'error' as DebugStatus };
    }

    const samletArbejdsdage = Math.max(0, breakdown.tafDage);

    const components: Array<{ value: number; label: string }> = [
      { value: breakdown.arbejdsdage, label: 'hverdage' },
      { value: breakdown.shDage, label: 'SH-dage' },
      { value: breakdown.feriedage, label: 'feriedage' },
      { value: breakdown.loseFeriedage, label: 'løse feriedage' },
      { value: breakdown.oevrigeFravaersdage, label: 'øvrige fraværsdage' },
    ];
    const parts = components
      .map((component) => `${formatDaNumber(component.value)} ${component.label}`);
    const label = `${parts.join(' - ')} =`;
    const displayValue = `${formatDaNumber(samletArbejdsdage)} arbejdsdage`;

    return { label, displayValue, status: 'ok' as DebugStatus };
  })();

  if (tafBeregnesSom === TAF_BEREGNES_SOM.ARBEJDSDAGE) {
    rows.push({
      id: 'taf.beregningsgrundlag.arbejdsdage',
      label: arbejdsdageRow.label,
      displayValue: arbejdsdageRow.displayValue,
      status: arbejdsdageRow.status,
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregningsperiode' },
        { kind: 'id', id: 'taf.beregningsgrundlag.oevrigeFravaersdage' },
      ],
    });
  }

  const maanederRow = (() => {
    if (!isBeregningsperiode) {
      return { label: 'Måneder', displayValue: '-', status: 'ok' as DebugStatus };
    }
    if (!beregningsperiodeRangeOk || !periodeFra || !periodeTil) {
      return { label: 'Måneder', displayValue: 'Fejl (Beregningsperioden er ugyldig)', status: 'error' as DebugStatus };
    }

    const oevrigeFravaersdageValue =
      values.oevrigtFravaerUdenLoen === 'Ja' && typeof values.oevrigeFravaersdage === 'number'
        ? values.oevrigeFravaersdage
        : 0;
    const maaneder = calculateTafAntalMaaneder(
      periodeFra,
      periodeTil,
      oevrigeFravaersdageValue
    );
    if (maaneder === null) {
      return { label: 'Måneder', displayValue: 'Fejl (Ugyldig periode)', status: 'error' as DebugStatus };
    }

    if (values.oevrigtFravaerUdenLoen === 'Ja' && values.oevrigeFravaersdage === undefined) {
      return { label: 'Måneder', displayValue: 'Fejl (Antal fraværsdage mangler)', status: 'error' as DebugStatus };
    }

    const periodeDage = new Set<ISODateString>();
    const fraDate = isoDateToDate(periodeFra);
    const tilDate = isoDateToDate(periodeTil);
    const currentDate = new Date(fraDate);
    while (currentDate <= tilDate) {
      const iso = dateToISO(currentDate);
      if (iso) periodeDage.add(iso);
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    const beregnMaanederForDage = (dage: ReadonlySet<ISODateString>): number => {
      let total = 0;
      for (const isoStr of dage) {
        const year = Number.parseInt(isoStr.slice(0, 4), 10);
        const month = Number.parseInt(isoStr.slice(5, 7), 10);
        const dageIMaaned = new Date(Date.UTC(year, month, 0)).getUTCDate();
        total += 1 / dageIMaaned;
      }
      return total;
    };

    const totalMaaneder = beregnMaanederForDage(periodeDage);
    const fravaerMaaneder = oevrigeFravaersdageValue * 0.048;

    const formatMaaneder = (value: number): string => {
      const rounded = roundByMethod(value, 4, 'halfAwayFromZero');
      return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
    };

    const fravaerBeskrivelse = values.oevrigeFravaersdageBeskrivelse?.trim();
    const fravaerLabelTekst = fravaerBeskrivelse && fravaerBeskrivelse !== ''
      ? `fraværsdage pga. ${fravaerBeskrivelse}`
      : 'fraværsdage';
    const fravaerLabel = `${formatDaNumber(oevrigeFravaersdageValue)} ${fravaerLabelTekst} uden løn x 4,8 % måned`;
    const label = `${formatMaaneder(totalMaaneder)} - ${formatMaaneder(fravaerMaaneder)} måneder (${fravaerLabel}) =`;
    const maanederEfterFradrag = Math.max(0, totalMaaneder - fravaerMaaneder);
    const formatted = formatMaaneder(maanederEfterFradrag);
    const displayValue = `${formatted} måneder`;

    return { label, displayValue, status: 'ok' as DebugStatus };
  })();

  if (isBeregningsperiode && tafBeregnesSom === TAF_BEREGNES_SOM.MAANEDER) {
    rows.push({
      id: 'taf.beregningsgrundlag.maaneder',
      label: maanederRow.label,
      displayValue: maanederRow.displayValue,
      status: maanederRow.status,
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregningsperiode' },
      ],
    });
  }

  if (beregnesUdFra === 'Angivet månedsløn') {
    const maanedsloenDisplay = (() => {
      const display = formatCurrency(amountValueToNumber(values.maanedsloenenUdgoer));
      if (display.trim() === '') {
        return { displayValue: 'Fejl (Månedsløn mangler)', status: 'error' as DebugStatus };
      }
      return { displayValue: display, status: 'ok' as DebugStatus };
    })();

    rows.push({
      id: 'taf.beregningsgrundlag.maanedsloen',
      label: 'Månedslønnen udgør',
      displayValue: maanedsloenDisplay.displayValue,
      status: maanedsloenDisplay.status,
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregnesUdFra' },
      ],
    });
  }

  if (beregnesUdFra === 'Angivet dagsløn') {
    const dagsloenDisplay = (() => {
      const display = formatCurrency(amountValueToNumber(values.dagsloenenUdgoer));
      if (display.trim() === '') {
        return { displayValue: 'Fejl (Dagsløn mangler)', status: 'error' as DebugStatus };
      }
      return { displayValue: display, status: 'ok' as DebugStatus };
    })();

    rows.push({
      id: 'taf.beregningsgrundlag.dagsloen',
      label: 'Dagslønnen udgør',
      displayValue: dagsloenDisplay.displayValue,
      status: dagsloenDisplay.status,
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregnesUdFra' },
      ],
    });
  }

  if (beregnesUdFra === 'Angivet månedsløn' || beregnesUdFra === 'Angivet dagsløn') {
    const loenBaseretPaaDisplay = resolveDebugDisplay({
      value: getAngivetLoenBaseretPaa(values),
      errors:
        beregnesUdFra === 'Angivet månedsløn'
          ? errors.angivetMaanedsloenBaseretPaa
          : errors.angivetDagsloenBaseretPaa,
      emptyState: 'warning',
    });

    rows.push({
      id: 'taf.beregningsgrundlag.loenBaseretPaa',
      label: '- baseret på',
      displayValue: loenBaseretPaaDisplay.displayValue,
      status: loenBaseretPaaDisplay.status,
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregnesUdFra' },
      ],
    });
  }

  if (beregnesUdFra === 'Angivet månedsløn' || beregnesUdFra === 'Angivet dagsløn') {
    const loenLabel = beregnesUdFra === 'Angivet månedsløn' ? 'månedsløn' : 'dagsløn';
    const opreguleresLabel = `Det angivne beløb afspejler ${loenLabel}en den`;

    const opreguleresFraISO = getAngivetLoenOpreguleresFraDato(values) || stamdataValues.skadesdato;
    const opreguleresFraDisplay = opreguleresFraISO ? isoToDanish(opreguleresFraISO) : undefined;

    const hasMissingRequired = !getAngivetLoenOpreguleresFraDato(values) && !stamdataValues.skadesdato;

    rows.push({
      id: 'taf.beregningsgrundlag.angivetLoenOpreguleresFraDato',
      label: opreguleresLabel,
      displayValue: opreguleresFraDisplay ?? '-',
      status: hasMissingRequired ? 'error' : 'ok',
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregnesUdFra' },
      ],
    });
  }

  return rows;
};

const formatStatusMessage = (status: DebugStatus, message: string): string => {
  if (status === 'ok') return '-';
  const trimmed = message.trim();
  if (trimmed === '' || trimmed === '-') {
    return status === 'error' ? 'Fejl (Indtastning mangler)' : 'Advarsel (Indtastning mangler)';
  }
  return `${status === 'error' ? 'Fejl' : 'Advarsel'} (${trimmed})`;
};

type ReguleringsRange = Readonly<{
  min?: ISODateString;
  max?: ISODateString;
}>;

const parseDanishToIsoDebug = (value: string | undefined): ISODateString | undefined => {
  if (!value || value.trim() === '') return undefined;
  const parsed = parseDanishDate(value.trim());
  if (!parsed) return undefined;
  return dateToISO(parsed);
};

const getRangeForManualReguleringDebug = (
  baseIso: ISODateString | undefined,
  rows: ReadonlyArray<{ dato?: string | undefined }>
): ReguleringsRange => {
  const dates: ISODateString[] = [];
  if (baseIso) dates.push(baseIso);

  rows.forEach((row) => {
    const iso = parseDanishToIsoDebug(row.dato);
    if (iso) dates.push(iso);
  });

  if (dates.length === 0) return {};

  let min = dates[0];
  let max = dates[0];
  for (const iso of dates) {
    if (iso < min) min = iso;
    if (iso > max) max = iso;
  }

  const maxDate = parseISODate(max);
  if (!maxDate) return { min };

  const adjustedMax = dateToISO(addDays(addMonths(maxDate, 12), -1));
  return { min, max: adjustedMax };
};

const calculateElapsedWholeMonthsDebug = (fromIso: ISODateString, toIso: ISODateString): number => {
  if (toIso <= fromIso) return 0;
  const fromDate = parseISODate(fromIso);
  const toDate = parseISODate(toIso);
  if (!fromDate || !toDate) return 0;

  let months =
    (toDate.getUTCFullYear() - fromDate.getUTCFullYear()) * 12 +
    (toDate.getUTCMonth() - fromDate.getUTCMonth());
  if (toDate.getUTCDate() < fromDate.getUTCDate()) {
    months -= 1;
  }

  return Math.max(0, months);
};

const buildReguleringsMangelMessage = (
  status: DebugStatus,
  displayValue: string
): string | undefined => {
  if (status === 'ok') return undefined;
  const trimmed = displayValue.trim();
  if (trimmed === '' || trimmed === '-' || trimmed === 'Nej') return 'mangler';
  if (trimmed.startsWith('Nej')) return `mangler${trimmed.slice(3)}`;
  return trimmed;
};

const resolveTafBoundaryDatesInSkadetPeriode = (
  values: ErstatningsopgoerelseValues
): Readonly<{ first?: ISODateString; last?: ISODateString }> => {
  const periodeTil = isISODateString(values.vedroererPeriodeTil) ? values.vedroererPeriodeTil : undefined;
  if (!periodeTil) return {};
  const periodeFra = isISODateString(values.vedroererPeriodeFra) ? values.vedroererPeriodeFra : undefined;
  const periodRange = periodeFra && periodeFra <= periodeTil ? { fra: periodeFra, til: periodeTil } : null;

  let first: ISODateString | undefined;
  let last: ISODateString | undefined;

  for (const row of values.tafPerioder ?? []) {
    if (!isISODateString(row.fra) || !isISODateString(row.til)) continue;
    if (row.fra > row.til) continue;

    if (periodRange) {
      if (row.til < periodRange.fra || row.fra > periodRange.til) continue;
      const firstCandidate = row.fra < periodRange.fra ? periodRange.fra : row.fra;
      const lastCandidate = row.til > periodRange.til ? periodRange.til : row.til;
      if (!first || firstCandidate < first) first = firstCandidate;
      if (!last || lastCandidate > last) last = lastCandidate;
      continue;
    }

    if (!first || row.fra < first) first = row.fra;
    if (!last || row.til > last) last = row.til;
  }

  return { first, last };
};

export const buildEODebugIndkomstRows = (
  values: ErstatningsopgoerelseValues,
  skadesdato: ISODateString | undefined,
  manualReguleringInputErrors: Readonly<Record<string, true>> = {},
  appSettings: AppSettings = DEFAULT_APP_SETTINGS
): DebugRowModel[] => {
  const rows: DebugRowModel[] = [];
  const allowIncompleteOverenskomst = appSettings.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden;
  const overenskomstUdloebMaanederGraense = appSettings.allowReguleringMedUdloebMedMaaneder;
  const tafBoundaryDates = resolveTafBoundaryDatesInSkadetPeriode(values);

  const sections = buildIndkomstSectionStatuses(values, skadesdato);
  sections.forEach((section) => {
    rows.push({
      id: `loenindkomst.${section.id}.arbejdsstedNavn`,
      label: 'Navn på arbejdssted',
      displayValue: section.arbejdsstedNavnDisplay,
      status: section.arbejdsstedNavnStatus,
    });

    rows.push({
      id: `loenindkomst.${section.id}.satserSkadestidspunkt`,
      label: 'Satser på skadestidspunktet',
      displayValue: section.satserStatus === 'ok' ? 'Ja' : formatStatusMessage(section.satserStatus, section.satserMessage),
      status: section.satserStatus,
    });

    rows.push({
      id: `loenindkomst.${section.id}.loenoplysninger`,
      label: 'Alle lønoplysninger indtastet korrekt',
      displayValue: section.tableStatus === 'ok' ? 'Ja' : formatStatusMessage(section.tableStatus, section.tableMessage),
      status: section.tableStatus,
      summaryDisplay: 'messageOnly',
    });
  });

  const loenudviklingsKilde = resolveLoenudviklingKilde(values);

  loenudviklingsKilde.forEach((ansaettelsesforhold) => {
    const loenudviklingRowPrefix =
      values.beregnesUdFra === 'Beregningsperiode'
        ? `loenindkomst.${ansaettelsesforhold.id}.regulering`
        : `taf.beregningsgrundlag.loenudvikling.${ansaettelsesforhold.id}`;
    const loenudviklingBasis = ansaettelsesforhold.loenudviklingBeregningsgrundlag;
    let status: DebugStatus = 'ok';
    let message = '-';

    if (!loenudviklingBasis) {
      status = 'error';
      message = 'Lønudvikling beregnes ud fra er ikke valgt';
    } else if (loenudviklingBasis === 'Overenskomst' && !ansaettelsesforhold.overenskomstId) {
      status = 'error';
      message = 'Overenskomst er ikke valgt';
    } else if (loenudviklingBasis === 'Statistik' && !ansaettelsesforhold.loenudviklingStatistikModel) {
      status = 'error';
      message = 'Statistisk beregningsmodel er ikke valgt';
    } else if (loenudviklingBasis === 'KRL satstabel' && !ansaettelsesforhold.loenudviklingKRLSatstabel) {
      status = 'error';
      message = 'KRL satstabel er ikke valgt';
    }

    const valgtReguleringRowId = `${loenudviklingRowPrefix}.valgt`;
    rows.push({
      id: valgtReguleringRowId,
      label: 'Valgt regulering',
      displayValue: status === 'ok' ? 'Ja' : formatStatusMessage(status, message),
      status,
    });
    const harGyldigValgtRegulering = status === 'ok';
    if (!harGyldigValgtRegulering) {
      return;
    }

    rows.push({
      id: `${loenudviklingRowPrefix}.navn`,
      label: 'Navn på reguleringsform',
      displayValue: resolveValgtReguleringDisplay(ansaettelsesforhold),
      status: 'ok',
      dependsOn: [{ kind: 'id', id: valgtReguleringRowId }],
    });

    if (
      loenudviklingBasis === 'Overenskomst' &&
      ansaettelsesforhold.overenskomstId &&
      isOffentligOverenskomstId(ansaettelsesforhold.overenskomstId)
    ) {
      const offentligtRowId = `${loenudviklingRowPrefix}.offentligLoenoplysninger`;
      const typeLabel = ansaettelsesforhold.offentligLoenType;
      const trinValue = ansaettelsesforhold.offentligLoenTrin;
      const gruppeValue = ansaettelsesforhold.offentligLoenGruppe;

      let offentligStatus: DebugStatus = 'ok';
      let offentligMessage = '';

      if (!typeLabel || !resolveOffentligLoenTypeFromLabel(typeLabel)) {
        offentligStatus = 'error';
        offentligMessage = 'Ansættelse er ikke valgt';
      } else if (typeof trinValue !== 'number') {
        offentligStatus = 'error';
        offentligMessage = 'Løntrin mangler';
      } else {
        try {
          toLoentrin(trinValue);
        } catch {
          offentligStatus = 'error';
          offentligMessage = 'Løntrin skal være mellem 1 og 55';
        }
      }

      if (offentligStatus === 'ok') {
        if (typeof gruppeValue !== 'number') {
          offentligStatus = 'error';
          offentligMessage = 'Gruppe mangler';
        } else if (gruppeValue < 0 || gruppeValue > 4) {
          offentligStatus = 'error';
          offentligMessage = 'Gruppe skal være mellem 0 og 4';
        }
      }

      const offentligDisplayValue =
        offentligStatus === 'ok'
          ? `${typeLabel}, løntrin ${String(trinValue)}, gruppe ${String(gruppeValue)}`
          : formatStatusMessage('error', offentligMessage);

      rows.push({
        id: offentligtRowId,
        label: 'KL-/RLTN-oplysninger',
        displayValue: offentligDisplayValue,
        status: offentligStatus,
        dependsOn: [{ kind: 'id', id: valgtReguleringRowId }],
      });
    }

    const alleReguleringsvaerdierRow = (() => {
      if (loenudviklingBasis === 'Ingen') {
        return { displayValue: 'Ingen', status: 'ok' as DebugStatus };
      }
      if (!loenudviklingBasis) {
        return { displayValue: 'Nej', status: 'error' as DebugStatus };
      }
      if (loenudviklingBasis !== 'Manuelt angivet') {
        return { displayValue: 'Ja', status: 'ok' as DebugStatus };
      }

      if (manualReguleringInputErrors[ansaettelsesforhold.id]) {
        return {
          displayValue: formatStatusMessage('error', 'Ugyldig indtastning'),
          message: 'Værdier mangler at blive udfyldt for manuel regulering',
          status: 'error' as DebugStatus,
        };
      }

      const manuelRows = ansaettelsesforhold.loenudviklingManuelTableData ?? [];
      const aktiveRows = manuelRows.filter((row) => {
        const dato = row.dato ?? '';
        const feriepenge = row.feriepenge ?? '';
        const shSoSats = row.shSoSats ?? '';
        const fritvalg = row.fritvalg ?? '';
        const agPension = row.agPension ?? '';
        return (
          dato.trim() !== '' ||
          feriepenge.trim() !== '' ||
          shSoSats.trim() !== '' ||
          fritvalg.trim() !== '' ||
          agPension.trim() !== '' ||
          row.grundloen !== undefined
        );
      });

      if (aktiveRows.length === 0) {
        return {
          displayValue: 'Nej',
          message: 'Værdier mangler at blive udfyldt for manuel regulering',
          status: 'error' as DebugStatus,
        };
      }

      const grundloenOk = aktiveRows.every((row) => row.grundloen !== undefined);

      const supplementFields = [
        'feriepenge',
        'shSoSats',
        'fritvalg',
        'agPension',
      ] as const;

      const usedSupplements = supplementFields.filter((field) =>
        aktiveRows.some((row) => (row[field] ?? '').trim() !== '')
      );
      const supplementsOk = usedSupplements.every((field) =>
        aktiveRows.every((row) => (row[field] ?? '').trim() !== '')
      );

      const ok = grundloenOk && supplementsOk;
      return {
        displayValue: ok ? 'Ja' : 'Nej',
        message: ok ? undefined : 'Værdier mangler at blive udfyldt for manuel regulering',
        status: ok ? 'ok' : 'error' as DebugStatus,
      };
    })();

    if (loenudviklingBasis !== 'Ingen') {
      rows.push({
        id: `${loenudviklingRowPrefix}.alleVaerdier`,
        label: 'Alle reguleringsværdier udfyldt',
        displayValue: alleReguleringsvaerdierRow.displayValue,
        message: alleReguleringsvaerdierRow.message,
        summaryDisplay: alleReguleringsvaerdierRow.status === 'error' && !!alleReguleringsvaerdierRow.message
          ? 'messageOnly'
          : undefined,
        status: alleReguleringsvaerdierRow.status,
        dependsOn: [{ kind: 'id', id: valgtReguleringRowId }],
      });
    }

    const showReguleringDetails =
      harGyldigValgtRegulering &&
      alleReguleringsvaerdierRow.status === 'ok' &&
      alleReguleringsvaerdierRow.displayValue === 'Ja';

    if (!showReguleringDetails || !loenudviklingBasis || loenudviklingBasis === 'Ingen') {
      return;
    }

    const reguleringsdato = values.beregnesUdFra !== 'Beregningsperiode'
      ? (getAngivetLoenOpreguleresFraDato(values) ?? skadesdato)
      : (isISODateString(ansaettelsesforhold.saerligFraDatoRegulering) ? ansaettelsesforhold.saerligFraDatoRegulering : skadesdato);

    const reguleringsRange = (() => {
      if (loenudviklingBasis === 'Overenskomst') {
        const interval = getReguleringsDatoIntervalForOverenskomst(ansaettelsesforhold.overenskomstId ?? '');
        if (!interval) return {} as ReguleringsRange;
        return {
          min: parseDanishToIsoDebug(interval.fraDato),
          max: parseDanishToIsoDebug(interval.tilDato),
        };
      }
      if (loenudviklingBasis === 'Statistik') {
        const interval = getReguleringsDatoIntervalForStatistikModel(ansaettelsesforhold.loenudviklingStatistikModel ?? '');
        if (!interval) return {} as ReguleringsRange;
        return {
          min: parseDanishToIsoDebug(interval.fraDato),
          max: parseDanishToIsoDebug(interval.tilDato),
        };
      }
      if (loenudviklingBasis === 'KRL satstabel') {
        const krlId = ansaettelsesforhold.loenudviklingKRLSatstabel as KRLSatstabelId | undefined;
        if (!krlId) return {} as ReguleringsRange;
        const interval = getReguleringsDatoIntervalForKRL(krlId);
        if (!interval) return {} as ReguleringsRange;
        return {
          min: parseDanishToIsoDebug(interval.fraDato),
          max: parseDanishToIsoDebug(interval.tilDato),
        };
      }
      if (loenudviklingBasis === 'Manuelt angivet') {
        return getRangeForManualReguleringDebug(reguleringsdato, ansaettelsesforhold.loenudviklingManuelTableData ?? []);
      }
      return {} as ReguleringsRange;
    })();

    const reguleringsvaerdiRowStatus = (() => {
      if (!reguleringsdato) return { displayValue: '-', status: 'error' as DebugStatus };
      if (!reguleringsRange.min) {
        return {
          displayValue: 'Nej',
          status: allowIncompleteOverenskomst ? 'warning' as DebugStatus : 'error' as DebugStatus,
        };
      }
      if (reguleringsdato < reguleringsRange.min) {
        return {
          displayValue: `Nej (først fra ${isoToDanish(reguleringsRange.min) ?? reguleringsRange.min})`,
          status: allowIncompleteOverenskomst ? 'warning' as DebugStatus : 'error' as DebugStatus,
        };
      }
      return { displayValue: 'Ja', status: 'ok' as DebugStatus };
    })();

    const startDateRowStatus = (() => {
      const tafStartIso = tafBoundaryDates.first;
      if (!tafStartIso || !reguleringsRange.min) return { displayValue: '-', status: 'error' as DebugStatus };
      if (reguleringsRange.min <= tafStartIso) return { displayValue: 'Ja', status: 'ok' as DebugStatus };
      return {
        displayValue: `Nej (først fra ${isoToDanish(reguleringsRange.min) ?? reguleringsRange.min})`,
        status: allowIncompleteOverenskomst ? 'warning' as DebugStatus : 'error' as DebugStatus,
      };
    })();

    const endDateRowStatus = (() => {
      const tafEndIso = tafBoundaryDates.last;
      if (!tafEndIso || !reguleringsRange.max) return { displayValue: '-', status: 'error' as DebugStatus };
      if (reguleringsRange.max >= tafEndIso) return { displayValue: 'Ja', status: 'ok' as DebugStatus };

      const maanederSidenUdloeb = calculateElapsedWholeMonthsDebug(reguleringsRange.max, tafEndIso);
      if (maanederSidenUdloeb < overenskomstUdloebMaanederGraense) {
        return {
          displayValue: `(< ${overenskomstUdloebMaanederGraense} måneder)`,
          status: 'ok' as DebugStatus,
        };
      }

      return {
        displayValue: `Nej (kun indtil ${isoToDanish(reguleringsRange.max) ?? reguleringsRange.max})`,
        status: allowIncompleteOverenskomst ? 'warning' as DebugStatus : 'error' as DebugStatus,
      };
    })();
    const harTafDatointerval = Boolean(tafBoundaryDates.first && tafBoundaryDates.last);

    rows.push({
      id: `${loenudviklingRowPrefix}.reguleringsvaerdi`,
      label: 'Reguleringsværdi på reguleringsdato for TAF',
      displayValue: reguleringsvaerdiRowStatus.displayValue,
      status: reguleringsvaerdiRowStatus.status,
      message: buildReguleringsMangelMessage(
        reguleringsvaerdiRowStatus.status,
        reguleringsvaerdiRowStatus.displayValue
      ),
      dependsOn: [{ kind: 'id', id: `${loenudviklingRowPrefix}.alleVaerdier` }],
    });

    if (harTafDatointerval) {
      rows.push({
        id: `${loenudviklingRowPrefix}.startvaerdi`,
        label: 'Reguleringsværdi på start-dato for TAF',
        displayValue: startDateRowStatus.displayValue,
        status: startDateRowStatus.status,
        message: buildReguleringsMangelMessage(
          startDateRowStatus.status,
          startDateRowStatus.displayValue
        ),
        dependsOn: [{ kind: 'id', id: `${loenudviklingRowPrefix}.alleVaerdier` }],
      });

      rows.push({
        id: `${loenudviklingRowPrefix}.slutvaerdi`,
        label: 'Reguleringsværdi på slut-dato for TAF',
        displayValue: endDateRowStatus.displayValue,
        status: endDateRowStatus.status,
        message: buildReguleringsMangelMessage(
          endDateRowStatus.status,
          endDateRowStatus.displayValue
        ),
        dependsOn: [{ kind: 'id', id: `${loenudviklingRowPrefix}.alleVaerdier` }],
      });
    }
  });

  return rows;
};

export const buildEODebugOffentligeYdelserRows = (
  values: ErstatningsopgoerelseValues
): DebugRowModel[] => {
  const rows: DebugRowModel[] = [];
  const debugRows = buildOffentligeYdelserDebugRows(values.offentligeYdelserRows ?? []);

  debugRows.forEach((row) => {
    rows.push({
      id: `offentligeYdelser.${row.id}`,
      label: row.label,
      displayValue: row.status === 'ok' ? 'ok' : formatStatusMessage(row.status, row.message),
      status: row.status,
      summaryDisplay: row.summaryDisplay ?? 'default',
    });
  });

  return rows;
};

export const buildEODebugSygeferiegodtgoerelseRows = (
  values: ErstatningsopgoerelseValues,
  stamdata: StamdataValues,
  canonicalOutput?: EoCanonicalOutput
): DebugRowModel[] => {
  const rows: DebugRowModel[] = [];
  const tafRanges = canonicalOutput?.periodiseringer.tafPerioder ?? buildTafRanges(values);
  const tafBeregnesSom = computeTafBeregningsenhed(values);
  const hasActiveSfggSource = (values.loenindkomstAnsaettelsesforhold ?? []).some((employment) => {
    const row = values.sfggAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === employment.id);
    return row?.beregnesUdFra !== undefined && row.beregnesUdFra !== 'Ingen';
  });
  const requiresLoenudviklingModel = (values.loenindkomstAnsaettelsesforhold ?? []).some((employment) => {
    const row = values.sfggAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === employment.id);
    if (row?.beregnesUdFra !== 'Overenskomst') return false;
    if (!employment.overenskomstId || isOffentligOverenskomstId(employment.overenskomstId)) return false;
    const sfggPolicy = getOverenskomstSfggPolicy(employment.overenskomstId);
    // Debug må kun kalde lønudviklingsmotoren for SFGG, når policyen faktisk følger referenceperiode/ferielov-sporet.
    // Direkte SFGG-sats kan godt sameksistere med reguleringsdata på overenskomsten, men kræver ikke lønudviklingsmodellen.
    if (sfggPolicy?.model === 'direkte_sats') return false;
    return getReguleringsDatoIntervalForOverenskomst(employment.overenskomstId) !== undefined;
  });

  const loenudvikling = (() => {
    if (!(hasActiveSfggSource && requiresLoenudviklingModel)) {
      return null;
    }

    try {
      const tafBeregningsenhed = computeTafBeregningsenhed(values);
      const indkomstSkadestidspunkt = buildIndkomstSkadestidspunkt(values, stamdata, tafBeregningsenhed);
      return buildLoenudviklingModel(values, stamdata, tafBeregningsenhed, indkomstSkadestidspunkt, {
        tafRanges,
      });
    } catch (error) {
      // Debug er et visningslag. Hvis lønudviklingsmodellen ikke kan bygges pga.
      // manglende reguleringsforudsætninger, skal SFGG-debug ikke fejle hele sektionen.
      // I den situation falder debug tilbage til beregning uden lønudviklingsjustering.
      if (error instanceof Error && error.message.startsWith('Loenudvikling kan ikke beregnes:')) {
        return null;
      }
      throw error;
    }
  })();
  const sfgg = hasActiveSfggSource
    ? computeSygeferiegodtgoerelse({
      values,
      stamdata,
      tafRanges,
      loenudviklingPerAnsaettelse: new Map((loenudvikling?.perAnsaettelse ?? []).map((entry) => [entry.ansaettelsesforholdId, entry])),
    })
    : EMPTY_RESULT;
  const seksMaanedersWarnings = hasActiveSfggSource
    ? new Set(findSfggSixMonthWarningEmploymentIds({
      values,
      result: sfgg,
    }))
    : new Set<string>();

  for (const employment of values.loenindkomstAnsaettelsesforhold ?? []) {
    const row = values.sfggAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === employment.id);
    const result = sfgg.perAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === employment.id);
    const kilde = row?.beregnesUdFra;
    const source = resolveSfggSource(row, employment);
    const hasSelectedOverenskomst = hasSfggSelectedOverenskomst(row, employment);
    const overenskomstDisplay = hasSelectedOverenskomst
      ? (getOverenskomstMetaById(employment.overenskomstId!)?.navn ?? employment.overenskomstId!.trim())
      : 'Ingen overenskomst valgt';
    const hasKnownPublicOverenskomst = Boolean(employment.overenskomstId && isOffentligOverenskomstId(employment.overenskomstId));
    const hasKnownPrivateOverenskomstPolicy = Boolean(employment.overenskomstId && getOverenskomstSfggPolicy(employment.overenskomstId));
    // Når harOverenskomst=false, behandler både beregning og debug bevidst valget "Overenskomst"
    // som et ferielov-spor uden policy-opslag. Et hængende eller frit tekst-ID skal derfor ikke
    // udløse "ukendt overenskomst-ID" i det spor.
    const hasActivePrivateOverenskomst = employment.harOverenskomst && !!employment.overenskomstId && !hasKnownPublicOverenskomst;
    const overenskomstPolicy = employment.overenskomstId
      ? getOverenskomstSfggPolicy(employment.overenskomstId)
      : undefined;
    const hasUnknownOverenskomstId =
      kilde === 'Overenskomst'
      && hasActivePrivateOverenskomst
      && !hasKnownPrivateOverenskomstPolicy;
    const beregningskildeMessage = !kilde
      ? 'Intet valgt'
      : hasUnknownOverenskomstId
        ? 'Ukendt overenskomst-ID'
        : undefined;
    const beregningskildeStatus: DebugStatus = !kilde || hasUnknownOverenskomstId ? 'error' : 'ok';

    rows.push({
      id: `sfgg.beregningskilde.${employment.id}`,
      label: 'Sygeferiegodtgørelse beregnes ud fra',
      displayValue: kilde ?? 'Intet valgt',
      status: beregningskildeStatus,
      message: beregningskildeMessage,
    });

    if (kilde === 'Overenskomst') {
      rows.push({
        id: `sfgg.overenskomst.${employment.id}`,
        label: 'Overenskomst (angivet ovenfor)',
        displayValue: overenskomstDisplay,
        status: hasSelectedOverenskomst ? 'ok' : 'error',
        message: hasSelectedOverenskomst ? undefined : 'Ingen overenskomst valgt',
      });
    }

    // Når brugeren har valgt "Overenskomst" uden faktisk overenskomst-ID, stopper debug-sporet her.
    // Det er bevidst: alle efterfølgende overenskomstafledte rækker, inkl. før-2015-bemærkningen,
    // ville ellers fremstå som om beregningssporet var konfigureret.
    if (kilde === 'Overenskomst' && !hasSelectedOverenskomst) {
      continue;
    }

    if (stamdata.skadesdato && stamdata.skadesdato < '2015-01-01') {
      rows.push({
        id: `sfgg.bemaerkningFoer2015.${employment.id}`,
        label: 'Bemærk',
        displayValue: 'Bemærk, at da skaden er før 01-01-2015, er det afgørende for beregningen af sygeferiegodtgørelse, at samtlige TAF-perioder er indtastet ovenfor.',
        status: 'ok',
      });
    }

    if (kilde === 'Overenskomst') {
      if (overenskomstPolicy && overenskomstPolicy.model !== 'direkte_sats') {
        rows.push({
          id: `sfgg.overenskomstensReferenceperiode.${employment.id}`,
          label: 'Overenskomstens referenceperiode',
          displayValue: `Følger ferieloven${overenskomstPolicy.referenceperiodeLabel ? ` (${overenskomstPolicy.referenceperiodeLabel})` : ''}`,
          status: 'ok',
        });
      }

      if (source.kind === 'overenskomst_direkte' && overenskomstPolicy?.direkteSatsErDifferentieret) {
        const satsvalgDisplay = row?.satsvalg === 'Faglaert-Koebenhavn'
          ? 'Faglært-København'
          : row?.satsvalg === 'Faglaert-Provinsen'
            ? 'Faglært-Provinsen'
            : row?.satsvalg === 'Ufaglaert-Koebenhavn'
              ? 'Ufaglært-København'
              : row?.satsvalg === 'Ufaglaert-Provinsen'
                ? 'Ufaglært-Provinsen'
                : 'Intet valgt';
        rows.push({
          id: `sfgg.satsvalg.${employment.id}`,
          label: 'Uddannelse og arbejdssted',
          displayValue: satsvalgDisplay,
          status: row?.satsvalg ? 'ok' : 'error',
          message: row?.satsvalg ? undefined : 'Intet valgt',
        });
      }
    }

    if (!kilde || kilde === 'Ingen') {
      continue;
    }
    const sfggDayBasis = resolveSfggDayBasis(source, tafBeregnesSom);

    const foerstEfterSygeloen =
      (source.kind === 'manuel' && row?.manuelFoerstEfterSygeloen === 'Ja')
      || (source.kind !== 'manuel' && overenskomstPolicy?.bortfalderUnderArbejdsgiverbetaltSygeloen === true);

    rows.push({
      id: `sfgg.foerstEfterSygeloen.${employment.id}`,
      label: 'Først sygeferiegodtgørelse efter ophør af sygeløn',
      displayValue: foerstEfterSygeloen ? 'Ja' : 'Nej',
      status: 'ok',
    });

    if (source.kind === 'overenskomst_direkte') {
      rows.push({
        id: `sfgg.referencesats.${employment.id}`,
        label: 'Referencesats',
        displayValue: 'Fastsættes i overenskomsten',
        status: 'ok',
      });
    }

    let manuelDagssatsMangler: string | undefined;
    if (source.kind === 'manuel' && result && result.referenceSats.status !== 'ok') {
      manuelDagssatsMangler = result.referenceSats.reason;
    } else if (source.kind === 'manuel' && !result && amountValueToNumber(row?.manuelDagssats) === undefined) {
      manuelDagssatsMangler = 'Dagssats mangler';
    }

    let direkteOverenskomstDagssatsMangler: string | undefined;
    if (
      source.kind === 'overenskomst_direkte'
      && result
      && result.segments.length === 0
      && result.referenceSats.status === 'not_calculable'
      && result.referenceSats.reason !== SFGG_NO_WORKDAYS_REASON
      && result.referenceSats.reason !== SFGG_NO_CALENDAR_DAYS_REASON
    ) {
      direkteOverenskomstDagssatsMangler = 'Dagssats kunne ikke fastsættes for den valgte overenskomst i TAF-perioden';
    }

    if (manuelDagssatsMangler) {
      rows.push({
        id: `sfgg.dagssats.${employment.id}`,
        label: 'Dagssats',
        displayValue: formatStatusMessage('error', manuelDagssatsMangler),
        status: 'error',
        summaryDisplay: 'messageOnly',
        message: manuelDagssatsMangler,
      });
    }

    if (direkteOverenskomstDagssatsMangler) {
      rows.push({
        id: `sfgg.dagssats.${employment.id}`,
        label: 'Dagssats',
        displayValue: formatStatusMessage('error', direkteOverenskomstDagssatsMangler),
        status: 'error',
        summaryDisplay: 'messageOnly',
        message: direkteOverenskomstDagssatsMangler,
      });
    }

    if (result?.referenceperiode) {
      const referenceDisplay =
        `${isoToDanish(result.referenceperiode.fra) ?? result.referenceperiode.fra} - ${isoToDanish(result.referenceperiode.til) ?? result.referenceperiode.til}`;
      rows.push({
        id: `sfgg.referenceperiode.${employment.id}`,
        label: 'Referenceperiode',
        displayValue: referenceDisplay,
        status: result.referenceSats.status === 'ok' ? 'ok' : 'error',
        message: result.referenceSats.status === 'ok' ? undefined : result.referenceSats.reason,
      });
    }

    if (result?.referenceSatsFormula) {
      const arbejdsdageLabel = (() => {
        if (result.referenceSatsFormula.divisorLabel === 'kalenderdage') {
          if (result.referenceSatsFormula.oevrigeFravaersdage > 0) {
            return `Antal kalenderdage i perioden (${result.referenceSatsFormula.kalenderdage.toLocaleString('da-DK')} kalenderdage - ${result.referenceSatsFormula.oevrigeFravaersdage.toLocaleString('da-DK')} fraværsdage u. løn) =`;
          }
          return 'Antal kalenderdage i perioden';
        }

        const ferieOgFravaersdage = result.referenceSatsFormula.feriedage + result.referenceSatsFormula.oevrigeFravaersdage;
        if (result.referenceSatsFormula.shDage + ferieOgFravaersdage > 0) {
          const parts = [`${result.referenceSatsFormula.hverdage.toLocaleString('da-DK')} hverdage`];
          if (result.referenceSatsFormula.shDage > 0) {
            parts.push(`${result.referenceSatsFormula.shDage.toLocaleString('da-DK')} SH-dage`);
          }
          if (ferieOgFravaersdage > 0) {
            parts.push(`${ferieOgFravaersdage.toLocaleString('da-DK')} ferie- og fraværsdage`);
          }
          return `Antal arbejdsdage (${parts.join(' - ')}) =`;
        }
        return 'Antal arbejdsdage';
      })();

      rows.push({
        id: `sfgg.referenceperiodeantal.${employment.id}`,
        label: arbejdsdageLabel,
        displayValue: `${result.referenceSatsFormula.divisorDage.toLocaleString('da-DK')} ${result.referenceSatsFormula.divisorLabel}`,
        status: 'ok',
      });
    }

    if (result?.referenceSats.status === 'ok') {
      const divisorText = result.referenceSatsFormula
        ? `${result.referenceSatsFormula.divisorDage.toLocaleString('da-DK')} ${result.referenceSatsFormula.divisorLabel}`
        : 'arbejdsdage';
      const referenceSatsLabel = result.referenceSatsFormula
        ? `Referencesats (${formatCurrency(result.referenceSatsFormula.ferieberettigetLoenKroner)} x ${formatPercent(result.referenceSatsFormula.feriePctDecimal * 100)} / ${divisorText}) =`
        : 'Referencesats';
      const referenceSatsUnit = sfggDayBasis === 'kalenderdage' ? 'kr./dag' : 'kr./arbejdsdag';
      rows.push({
        id: `sfgg.referencesats.${employment.id}`,
        label: referenceSatsLabel,
        displayValue: `${formatCurrency(result.referenceSats.value / 100)} ${referenceSatsUnit}`,
        status: 'ok',
      });
    } else if (result && result.referenceperiode) {
      rows.push({
        id: `sfgg.referencesats.${employment.id}`,
        label: 'Referencesats',
        displayValue: formatStatusMessage('error', result.referenceSats.reason),
        status: 'error',
        summaryDisplay: 'messageOnly',
        message: result.referenceSats.reason,
      });
    }

    if (result?.segments.length) {
      const antalDageHeader = sfggDayBasis === 'kalenderdage'
        ? 'Antal kalenderdage'
        : 'Antal arbejdsdage';
      const hasReguleringsindeks = result.segments.some((segment) => segment.reguleringsindeks !== null);
      const lines = [
        hasReguleringsindeks
          ? `Fra-dato | Til-dato | Indeks | Sats | ${antalDageHeader} | Feriepengekrav`
          : `Fra-dato | Til-dato | Sats | ${antalDageHeader} | Feriepengekrav`,
        ...result.segments.map((segment) =>
          hasReguleringsindeks
            ? `${isoToDanish(segment.fra) ?? segment.fra} | ${isoToDanish(segment.til) ?? segment.til} | ${segment.reguleringsindeks === null ? '-' : formatAsAmount(segment.reguleringsindeks, 2)} | ${formatCurrency(segment.satsOre / 100)} | ${String(segment.antalDage)} | ${formatCurrency(segment.feriepengekravOre / 100)}`
            : `${isoToDanish(segment.fra) ?? segment.fra} | ${isoToDanish(segment.til) ?? segment.til} | ${formatCurrency(segment.satsOre / 100)} | ${String(segment.antalDage)} | ${formatCurrency(segment.feriepengekravOre / 100)}`
        ),
        hasReguleringsindeks
          ? `I alt |  |  |  |  | ${formatCurrency(result.feriepengekravTotalOre / 100)}`
          : `I alt |  |  |  | ${formatCurrency(result.feriepengekravTotalOre / 100)}`,
      ];
      rows.push({
        id: `sfgg.tabel.${employment.id}`,
        label: 'SFGG-beregning',
        displayValue: lines.join('\n'),
        status: 'ok',
      });

      const feriepengeHvisIkkeSkadeOre = result.feriepengekravTotalOre;
      const feriepengeModtagetOre = ensureMoneyOre(
        result.segments.reduce((sum, segment) => sum + segment.feriepengeAfSygeloenOre, 0)
      );
      const alleredeBetaltOre = result.alleredeBetaltOre;
      // result.totalOre er summen af beregnetSfggoereOre pr. segment (netto efter feriepenge og allerede betalt, inkl. pensionsandel tillagt).
      const beregnetSygeferiegodtgoerelseOre = result.totalOre;
      const tafPeriodeRanges = mergeIsoDateRanges(
        result.segments.map((segment) => ({ fra: segment.fra, til: segment.til }))
      );
      const ferieberettigetIndkomstIKroner = sumFerieberettigetLoenInRangesKroner(
        employment,
        tafPeriodeRanges,
        values.ferieperioder ?? []
      );
      const feriepengeModtagetLabel =
        ferieberettigetIndkomstIKroner > 0
          ? `Feriepenge modtaget i perioden (${formatCurrency(ferieberettigetIndkomstIKroner)} x ${formatPercent((employment.feriePct ?? 0))}) =`
          : 'Feriepenge modtaget i perioden';

      rows.push({
        id: `sfgg.eftertabel.feriepengeHvisIkkeSkade.${employment.id}`,
        label: 'Feriepenge, hvis skaden ikke var sket',
        displayValue: formatCurrency(feriepengeHvisIkkeSkadeOre / 100),
        status: 'ok',
      });
      rows.push({
        id: `sfgg.eftertabel.feriepengeModtaget.${employment.id}`,
        label: feriepengeModtagetLabel,
        displayValue: formatCurrency(-(feriepengeModtagetOre / 100)),
        status: 'ok',
      });
      rows.push({
        id: `sfgg.eftertabel.alleredeBetalt.${employment.id}`,
        label: 'Allerede betalt sygeferiegodtgørelse i perioden',
        displayValue: formatCurrency(-(alleredeBetaltOre / 100)),
        status: 'ok',
      });
      rows.push({
        id: `sfgg.eftertabel.beregnet.${employment.id}`,
        label: 'Beregnet sygeferiegodtgørelse',
        displayValue: formatCurrency(beregnetSygeferiegodtgoerelseOre / 100),
        status: 'ok',
      });

      if (result.perYear.length > 0) {
        const lines = [
          'Sygeferiegodtgørelse fordelt på år | År | Beløb',
          ...result.perYear.map((entry) => ` | ${String(entry.year)} | ${formatCurrency(entry.amountOre / 100)}`),
        ];
        rows.push({
          id: `sfgg.aarsfordeling.${employment.id}`,
          label: 'Sygeferiegodtgørelse fordelt på år (til TAF pr. år)',
          displayValue: lines.join('\n'),
          status: 'ok',
        });
      }
    }

    if (result?.capRows.length) {
      const lines = [
        'Fra-dato | Til-dato | Antal dage | Antal måneder',
        ...result.capRows.map((capRow) =>
          `${isoToDanish(capRow.fra) ?? capRow.fra} | ${isoToDanish(capRow.til) ?? capRow.til} | ${String(capRow.antalDage)} | ${capRow.maanederPraecis.toLocaleString('da-DK', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
        ),
      ];
      rows.push({
        id: `sfgg.firemaanedertabel.${employment.id}`,
        label: '4-månedersgrænse',
        displayValue: lines.join('\n'),
        status: 'ok',
      });
    }

    result?.explanatoryLines
      .filter((line) => !SFGG_DEBUG_SUPPRESSED_EXPLANATORY_LINES.has(line))
      .forEach((line, index) => {
      rows.push({
        id: `sfgg.forklaring.${employment.id}.${index + 1}`,
        label: 'Forklaring',
        displayValue: line,
        status: 'ok',
      });
      });

    if (seksMaanedersWarnings.has(employment.id)) {
      rows.push({
        id: `sfgg.advarsel.seksmaaneder.${employment.id}`,
        label: 'Advarsel',
        displayValue: 'Advarsel (Der beregnes fortsat sygeferiegodtgørelse mere end 6 måneder efter sidste registrerede lønindkomst.)',
        status: 'warning',
        summaryDisplay: 'messageOnly',
        message: 'Der beregnes fortsat sygeferiegodtgørelse mere end 6 måneder efter sidste registrerede lønindkomst.',
      });
    }
  }

  return rows;
};

/**
 * Bygger debug-rækker for Øvrige erstatningskrav
 */
export const buildEODebugOevrigeKravRows = (
  values: ErstatningsopgoerelseValues,
  _errors: ErstatningsopgoerelseFieldErrorsBySource,
  canonicalOutput?: EoCanonicalOutput
): DebugRowModel[] => {
  const rows: DebugRowModel[] = [];
  const tafRanges = canonicalOutput?.periodiseringer.tafPerioder ?? buildTafRanges(values);
  const oevrigeKravForbeholdYdelsestyper = Array.from(
    new Set(
      buildIncomeForRanges(values, tafRanges).benefits
        .map((entry) => entry.typeKey)
        .filter((typeKey) => typeKey === 'kontanthjaelp' || typeKey === 'ressourceforloebsydelse')
    )
  );
  const introLinjer = resolveOevrigeKravIntroLinjer({
    eoValues: values,
    ydelser: oevrigeKravForbeholdYdelsestyper,
  });

  introLinjer.forEach((linje, index) => {
    rows.push({
      id: `oevrigekrav.intro.${index + 1}`,
      label: linje,
      displayValue: '-',
      status: 'ok',
    });
  });

  const oevrigeKrav = values.oevrigeKravPerioder ?? [];
  const harKrav = oevrigeKrav.length > 0 && oevrigeKrav.some((k) => k.dato || k.udgiftTil || k.beloeb);

  if (!harKrav && introLinjer.length === 0) {
    rows.push({
      id: 'oevrigekrav.empty',
      label: 'Ingen',
      displayValue: '-',
      status: 'ok',
    });
  } else {
    oevrigeKrav.forEach((krav) => {
      const hasDato = isNonEmptyString(krav.dato);
      const hasUdgiftTil = isNonEmptyString(krav.udgiftTil);
      const hasBeloeb = krav.beloeb !== undefined;

      // Tæl hvor mange felter der er udfyldt
      const filledCount = [hasDato, hasUdgiftTil, hasBeloeb].filter(Boolean).length;
      const noneFilled = filledCount === 0;

      // Spring over rækker hvor intet er udfyldt
      if (noneFilled) return;

      // Konverter dato til dansk format
      const datoDanish = hasDato ? isoToDanish(krav.dato) : undefined;

      // Tjek om udgiftTil og beløb begge er udfyldt
      const udgiftOgBeloebUdfyldt = hasUdgiftTil && hasBeloeb;

      // Status er fejl hvis udgiftTil ELLER beløb mangler (når der er noget udfyldt i rækken)
      // Status er advarsel hvis kun dato mangler
      let status: DebugStatus = 'ok';
      let label = '';
      let displayValue = '';

      if (!udgiftOgBeloebUdfyldt) {
        // Fejl: Enten beskrivelse eller beløb mangler
        status = 'error';

        if (!hasUdgiftTil && !hasBeloeb) {
          // Begge mangler
          label = 'Fejl: Beskrivelse mangler';
          displayValue = 'Fejl: Beløb mangler';
        } else if (!hasUdgiftTil) {
          // Kun beskrivelse mangler
          label = 'Fejl: Beskrivelse mangler';
          displayValue = formatCurrency(amountValueToNumber(krav.beloeb));
        } else {
          // Kun beløb mangler
          label = krav.udgiftTil ?? '';
          displayValue = 'Fejl: Beløb mangler';
        }
      } else if (!hasDato) {
        // Advarsel: Kun dato mangler
        status = 'warning';
        label = `${krav.udgiftTil} (dato mangler)`;
        displayValue = formatCurrency(amountValueToNumber(krav.beloeb));
      } else {
        // Alt udfyldt korrekt
        label = `${krav.udgiftTil} (${datoDanish})`;
        displayValue = formatCurrency(amountValueToNumber(krav.beloeb));
      }

      rows.push({
        id: `oevrigekrav.${krav.id}`,
        label,
        displayValue,
        status,
      });
    });
  }

  return rows;
};

/**
 * Bygger debug-række for Særlige kommentarer
 */
export const buildEODebugSaerligeKommentarerRows = (
  values: ErstatningsopgoerelseValues,
  _errors: ErstatningsopgoerelseFieldErrorsBySource
): DebugRowModel[] => {
  const kommentarer = values.saerligeKommentarer;
  const harKommentarer = isNonEmptyString(kommentarer);

  return [
    {
      id: 'saerligekommentarer',
      label: harKommentarer ? '' : 'Ingen',
      displayValue: harKommentarer ? kommentarer.trim() : '-',
      status: 'ok',
    },
  ];
};

// =============================================================================
// BILAGSNUMRE
// =============================================================================

type BilagEntry = {
  id: string;
  fieldName: string;
  label: string;
  value: string | undefined;
};

/**
 * Bygger debug-rækker for Bilagsnumre.
 * Returnerer tom liste hvis visBilagsnumre !== 'Ja'.
 */
export const buildEODebugBilagsnumreRows = (
  values: ErstatningsopgoerelseValues
): DebugRowModel[] => {
  if (values.visBilagsnumre !== 'Ja') return [];

  const entries: BilagEntry[] = [
    { id: 'bilagsnumre.menAfgoerelse', fieldName: 'bilagsnumreMenAfgoerelse', label: 'Ménafgørelse', value: values.bilagsnumreMenAfgoerelse },
    { id: 'bilagsnumre.eetAfgoerelser', fieldName: 'bilagsnumreEetAfgoerelser', label: 'EET-afgørelser', value: values.bilagsnumreEetAfgoerelser },
    { id: 'bilagsnumre.svieSmerteDokumentation', fieldName: 'bilagsnumreSvieSmerteDokumentation', label: 'Svie/smerte dokumentation', value: values.bilagsnumreSvieSmerteDokumentation },
    { id: 'bilagsnumre.beregningsgrundlagTaf', fieldName: 'bilagsnumreBeregningsgrundlagTaf', label: 'Beregningsgrundlag for TAF', value: values.bilagsnumreBeregningsgrundlagTaf },
    { id: 'bilagsnumre.loenISygeperioden', fieldName: 'bilagsnumreLoenISygeperioden', label: 'Løn i sygeperioden', value: values.bilagsnumreLoenISygeperioden },
    { id: 'bilagsnumre.offentligeYdelser', fieldName: 'bilagsnumreOffentligeYdelser', label: 'Offentlige ydelser', value: values.bilagsnumreOffentligeYdelser },
    { id: 'bilagsnumre.oevrigeErstatningskrav', fieldName: 'bilagsnumreOevrigeErstatningskrav', label: 'Øvrige erstatningskrav', value: values.bilagsnumreOevrigeErstatningskrav },
  ];

  const filledEntries = entries.filter((e) => isNonEmptyString(e.value));

  if (filledEntries.length === 0) {
    return [{ id: 'bilagsnumre.ingen', label: 'Ingen', displayValue: '-', status: 'ok' }];
  }

  return filledEntries.map((entry) => {
    const warning = resolveBilagWarning(values, entry.fieldName, entry.value);
    if (warning) {
      return {
        id: entry.id,
        label: entry.label,
        displayValue: warning,
        status: 'warning' as DebugStatus,
        message: warning,
        summaryDisplay: 'messageOnly' as const,
      };
    }
    return {
      id: entry.id,
      label: entry.label,
      displayValue: entry.value!.trim(),
      status: 'ok' as DebugStatus,
    };
  });
};
