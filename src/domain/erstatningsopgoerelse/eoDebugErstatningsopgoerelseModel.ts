import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { FieldErrorBySource } from '../../types/fieldErrors';
import type { ISODateString } from '../../types/branded';
import { dateToISO, isoToDanish, subtractOneDay } from '../../types/branded';
import { svieSmertePrDag, svieSmerteMax } from '../../data/regulationRates';
import { computeSkadesdatoMinRule, dateRanges_erstatningsopgoerelse, TODAY } from '../../config/dateRanges';
import { computeRowDateBounds } from './rowDateBounds';
import { validateISODateRange } from '../../utils/dateValidation';
import { detectConflictingSvieSmerteOverlaps, detectOverlappingPeriods } from './periodOverlapDetection';
import { formatCurrency } from '../../utils/formatUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { buildNoValidDateRangeMessage, collectPresentFieldErrors, isNonEmptyString, resolveDebugDisplay } from './eoDebugCommon';
import type { DebugRowGroup, DebugRowModel, DebugStatus } from '../debug/eoDebugTypes';
import { isoDateToDate } from '../dates/isoDate';
import { countInclusiveUtcDays } from '../../utils/utcDayMath';
import { erDetteFoersteErstatningsopgoerelse } from './eoNummerValidering';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from './tafBeregningsenhed';
import { calculateTafArbejdsdageBreakdown, calculateTafAntalMaaneder } from './tafCalculations';
import { calculateFerieHverdageMinusSHDage } from './ferieCalculations';
import { computeTafOverlapWithBeregningsperiode } from './beregningsperiodeTafOverlap';
import { buildIndkomstSectionStatuses, buildOffentligeYdelserDebugRows } from './eoDebugIndkomstModel';
import { mergeDateRanges } from './periodMerging';
import { clampTafRange, getValidTafRange, resolveTafConstraintBounds } from './tafPeriodConstraints';
import { isOffentligOverenskomstId } from '../../data/overenskomstRates';
import { resolveOffentligLoenTypeFromLabel, toLoentrin } from '../../data/offentligLoenTypes';

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
  | 'forlig.ansvarsgradProcent'
  | 'forlig.ansvarsgradBroek'
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
  | 'taf.beregningsgrundlag.angivetLoenOpreguleresFraDato'
  | 'taf.beregningsgrundlag.arbejdsdage'
  | 'taf.beregningsgrundlag.maaneder'
  | 'taf.beregnesSom'
  | 'taf.ophoerSkyldes'
  | `taf.periode.${string}`
  | `taf.ferie.${string}`
  | 'taf.andelSfggILoenen'
  | 'taf.tidligereModtagetTaf'
  | `loenindkomst.${string}.arbejdsstedNavn`
  | `loenindkomst.${string}.satserSkadestidspunkt`
  | `loenindkomst.${string}.loenoplysninger`
  | `loenindkomst.${string}.regulering.valgt`
  | `loenindkomst.${string}.regulering.navn`
  | `loenindkomst.${string}.regulering.alleVaerdier`
  | `offentligeYdelser.${string}`
  | `oevrigekrav.${string}`
  | 'saerligekommentarer';

type ErstatningsopgoerelseValues = PersistedSectionMap['erstatningsopgoerelse'];
type ErstatningsopgoerelseFieldName = Extract<keyof ErstatningsopgoerelseValues, string>;
type ErstatningsopgoerelseFieldErrorsBySource = Partial<Record<ErstatningsopgoerelseFieldName, FieldErrorBySource>>;

/**
 * Konverterer brøk til procent
 *
 * @param broek - Brøk i format "tæller/nævner" (fx "2/3")
 * @returns Procent afrundet til 0 decimaler, eller undefined hvis ugyldig
 */
const broekTilProcent = (broek: string | undefined): number | undefined => {
  if (!broek || broek.trim() === '') return undefined;

  const parts = broek.trim().split('/');
  if (parts.length !== 2) return undefined;

  const taeller = parseFloat(parts[0]);
  const naevner = parseFloat(parts[1]);

  if (isNaN(taeller) || isNaN(naevner) || naevner === 0) return undefined;

  return Math.round((taeller / naevner) * 100);
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
  // Beregn ansvarsgrad baseret på procent eller brøk
  const procentValue = values.forligAnsvarsgradProcent;
  const broekValue = values.forligAnsvarsgradBroek;

  // Tjek om der er fejl i procent eller brøk felterne
  const procentErrors = collectPresentFieldErrors(errors.forligAnsvarsgradProcent);
  const broekErrors = collectPresentFieldErrors(errors.forligAnsvarsgradBroek);
  const harFejl = procentErrors.length > 0 || broekErrors.length > 0;

  let beregnetAnsvarsgrad: string = '-';
  if (!harFejl) {
    if (typeof procentValue === 'number') {
      beregnetAnsvarsgrad = `${procentValue}%`;
    } else if (isNonEmptyString(broekValue)) {
      const procent = broekTilProcent(broekValue);
      if (procent !== undefined) {
        beregnetAnsvarsgrad = `${procent}%`;
      }
    }
  }

  // Konverter forligDato til dansk format
  const danishForligDato = isoToDanish(values.forligDato);

  // Konverter procent til string for display
  const procentDisplay = typeof procentValue === 'number' ? `${procentValue}%` : undefined;

  return [
    {
      id: 'forlig.ansvarsgradProcent',
      label: 'Forlig om ansvarsgrad, procent',
      ...resolveDebugDisplay({ value: procentDisplay, errors: errors.forligAnsvarsgradProcent, emptyState: 'ok' }),
    },
    {
      id: 'forlig.ansvarsgradBroek',
      label: 'Forlig om ansvarsgrad, brøk',
      ...resolveDebugDisplay({ value: broekValue, errors: errors.forligAnsvarsgradBroek, emptyState: 'ok' }),
    },
    {
      id: 'forlig.beregnetAnsvarsgrad',
      label: 'Beregnet ansvarsgrad',
      displayValue: beregnetAnsvarsgrad,
      status: 'ok',
      dependsOn: [
        { kind: 'id', id: 'forlig.ansvarsgradProcent' },
        { kind: 'id', id: 'forlig.ansvarsgradBroek' },
      ],
    },
    {
      id: 'forlig.dato',
      label: 'Evt. dato for forlig',
      ...resolveDebugDisplay({ value: danishForligDato, errors: errors.forligDato, emptyState: 'ok' }),
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
  }>
): DebugRowModel[] => {
  const rows: DebugRowModel[] = [];

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
        const allMessages = computedRangeMessages.map((m) => m.trim()).filter((m) => m !== '');

        const errorMessages = hasOverlap ? 'Der er overlappende perioder' : allMessages.join('; ');
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
  const satserAarDisplay = satserAarMangler ? 'Fejl (Indtastet sygeperiode men ikke år for sats)' : satserAarResolved.displayValue;
  const satserAarStatus: DebugStatus = satserAarMangler ? 'error' : satserAarResolved.status;

  rows.push({
    id: 'sviesmerte.satserAar',
    label: 'Hvilket års svie/smerte satser lægges til grund?',
    displayValue: satserAarDisplay,
    status: satserAarStatus,
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

  // 3c) Satser per dag/max (opslag fra regulationRates)
  const satserPerDagMax = (() => {
    // Hvis år ikke er valgt eller ugyldigt, returner tom
    if (!isNonEmptyString(satserAarValue) || satserAarResolved.status !== 'ok') {
      return { label: 'Satser per dag/max', displayValue: '-', status: 'ok' as DebugStatus };
    }

    const aar = parseInt(satserAarValue.trim(), 10);
    if (isNaN(aar)) {
      return { label: 'Satser per dag/max', displayValue: '-', status: 'ok' as DebugStatus };
    }

    // Slå satser op
    const satsPerDag = svieSmertePrDag[aar as keyof typeof svieSmertePrDag];
    const satsMax = svieSmerteMax[aar as keyof typeof svieSmerteMax];

    if (!satsPerDag || !satsMax) {
      return { label: 'Satser per dag/max', displayValue: `Fejl (Ingen satser for år ${aar})`, status: 'error' as DebugStatus };
    }

    // Beregn forligsgrad hvis den er udfyldt
    const procentValue = values.forligAnsvarsgradProcent;
    const broekValue = values.forligAnsvarsgradBroek;

    let forligsgrad: number | undefined = undefined;
    let forligLabel = '';

    if (typeof procentValue === 'number') {
      forligsgrad = procentValue / 100;
      forligLabel = ` (forlig på ${procentValue}%)`;
    } else if (isNonEmptyString(broekValue)) {
      // Parse brøk direkte for at undgå afrunding
      const parts = broekValue.trim().split('/');
      if (parts.length === 2) {
        const taeller = parseFloat(parts[0]);
        const naevner = parseFloat(parts[1]);
        if (!isNaN(taeller) && !isNaN(naevner) && naevner !== 0) {
          forligsgrad = taeller / naevner;
          forligLabel = ` (forlig på ${broekValue})`;
        }
      }
    }

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
      { kind: 'id', id: 'forlig.ansvarsgradProcent' },
      { kind: 'id', id: 'forlig.ansvarsgradBroek' },
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
    label: 'Svie/smerteperioder i erstatningsperioden',
    displayValue: beregnetPeriodeResult.displayValue,
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
    // Hvis ingen perioder, returner tom
    if (!harPerioder) {
      return { displayValue: '-', status: 'ok' as DebugStatus };
    }

    // Hvis satser år mangler, returner fejl
    if (satserAarMangler) {
      return { displayValue: 'Fejl (År for sats mangler)', status: 'error' as DebugStatus };
    }

    // Hvis delvis sygemeldings-sats mangler, returner fejl
    if (delvisSygemeldingSatsMangler) {
      return { displayValue: 'Fejl (Sats ved delvis sygemelding mangler)', status: 'error' as DebugStatus };
    }

    // Hvis der er fejl i antal dage, returner fejl
    if (antalDageResult.status === 'error') {
      return { displayValue: 'Fejl (Kan ikke beregne dage)', status: 'error' as DebugStatus };
    }

    // Hvis ingen dage, returner tom
    if (antalDageResult.displayValue === '-') {
      return { displayValue: '-', status: 'ok' as DebugStatus };
    }

    // Parse antal dage fra den nye format
    // Format kan være: "x sygedage", "y delvise sygedage", eller "x sygedage, y delvise sygedage"
    const sygedageMatch = antalDageResult.displayValue.match(/(\d+) sygedage/);
    const delviseMatch = antalDageResult.displayValue.match(/(\d+) delvise sygedage/);

    const antalSygedage = sygedageMatch ? parseInt(sygedageMatch[1], 10) : 0;
    const antalDelviseSygedage = delviseMatch ? parseInt(delviseMatch[1], 10) : 0;

    // Parse år
    const aarString = typeof values.svieSmerteSatserAar === 'number'
      ? String(values.svieSmerteSatserAar)
      : values.svieSmerteSatserAar;
    const aar = parseInt(aarString?.trim() ?? '', 10);
    if (isNaN(aar)) {
      return { displayValue: 'Fejl (Ugyldigt år)', status: 'error' as DebugStatus };
    }

    // Slå sats op
    const satsPerDag = svieSmertePrDag[aar as keyof typeof svieSmertePrDag];
    const satsMax = svieSmerteMax[aar as keyof typeof svieSmerteMax];

    if (!satsPerDag || !satsMax) {
      return { displayValue: `Fejl (Ingen sats for år ${aar})`, status: 'error' as DebugStatus };
    }

    // Beregn forligsgrad hvis den er udfyldt
    const procentValue = values.forligAnsvarsgradProcent;
    const broekValue = values.forligAnsvarsgradBroek;

    let forligsgrad: number | undefined = undefined;

    if (typeof procentValue === 'number') {
      forligsgrad = procentValue / 100;
    } else if (isNonEmptyString(broekValue)) {
      // Parse brøk direkte for at undgå afrunding
      const parts = broekValue.trim().split('/');
      if (parts.length === 2) {
        const taeller = parseFloat(parts[0]);
        const naevner = parseFloat(parts[1]);
        if (!isNaN(taeller) && !isNaN(naevner) && naevner !== 0) {
          forligsgrad = taeller / naevner;
        }
      }
    }

    // Reducer satser hvis der er forlig
    const actualSatsPerDag = forligsgrad !== undefined ? satsPerDag * forligsgrad : satsPerDag;
    const actualSatsMax = forligsgrad !== undefined ? satsMax * forligsgrad : satsMax;

    // Beregn sats for delvise dage (fuld eller halv)
    const delvisSatsFaktor = delvisSygemeldingSatsValue === 'fuld' ? 1 : 0.5;

    // Beregn råbeløb: (sygedage * sats) + (delvise dage * delvisSatsFaktor * sats)
    const raabeloeb = (antalSygedage * actualSatsPerDag) + (antalDelviseSygedage * delvisSatsFaktor * actualSatsPerDag);

    // Hent "Tidligere opgjort" (fra tidligere EO'er)
    const tidligereOpgjort = amountValueToNumber(values.svieSmerteTidligereTotal) ?? 0;

    // Hent "Evt. allerede modtaget i nuværende periode"
    const alleredeModtaget = amountValueToNumber(values.svieSmerteAktuelPeriode) ?? 0;

    // Beregn resterende plads til max (kun tidligere opgjort tæller her)
    const restPlads = actualSatsMax - tidligereOpgjort;

    // Begræns råbeløb til resterende plads
    const beloebFoerFradrag = Math.min(raabeloeb, Math.max(0, restPlads));

    // Fratræk allerede modtaget i denne periode
    let beloeb = beloebFoerFradrag - alleredeModtaget;

    // Hvis negativt, sæt til 0
    if (beloeb < 0) {
      beloeb = 0;
    }

    // Formater til dansk format
    const formatted = beloeb.toLocaleString('da-DK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return { displayValue: `${formatted} kr.`, status: 'ok' as DebugStatus };
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

  return rows;
};

export const buildEODebugTaftRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldErrorsBySource,
  context: Readonly<{
    skadesdatoISO: ISODateString | undefined;
    erErhvervssygdom: boolean;
    endeligEETBeregnetDato: ISODateString | undefined;
    differencekravDato: ISODateString | undefined;
    verserendeKlageEet: boolean;
  }>
): DebugRowModel[] => {
  const rows: DebugRowModel[] = [];

  const tafBounds = resolveTafConstraintBounds(values);
  const clampedTafById = new Map<string, { fra: ISODateString; til: ISODateString }>();

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
    if (!lastTafKravDato) return 'Krav ikke rejst';

    const endeligEetMinus1 = subtractOneDay(context.endeligEETBeregnetDato);
    if (!context.verserendeKlageEet && endeligEetMinus1 && endeligEetMinus1 === lastTafKravDato) {
      return 'Endelig EET-afgørelse';
    }

    const differencekravMinus1 = subtractOneDay(context.differencekravDato);
    if (!context.verserendeKlageEet && differencekravMinus1 && differencekravMinus1 === lastTafKravDato) {
      return 'Differencekrav opgjort';
    }

    if (values.vedroererPeriodeTil && values.vedroererPeriodeTil === lastTafKravDato) {
      return 'Erstatningsperiodens ophør';
    }

    return 'Krav ikke rejst';
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

    if (values.vedroererPeriodeTil && values.vedroererPeriodeTil === lastTafKravDato) {
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
    status: 'ok',
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
  const perioder = values.tafPerioder ?? [];
  const harPerioder = perioder.length > 0 && perioder.some((p) => p.fra || p.til);
  const tafOverlappingIds = detectOverlappingPeriods(values.tafPerioder ?? []);

  const ferieperioder = values.ferieperioder ?? [];

  const formatDaNumber = (n: number): string => n.toLocaleString('da-DK');
  const formatDaNumberFixed2 = (n: number): string =>
    n.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!harPerioder) {
    rows.push({
      id: 'taf.periode.empty',
      label: 'Periode',
      displayValue: '-',
      status: 'ok',
    });
  } else {
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
          label: 'Periode',
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
          label: 'Periode',
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
      const periodeLabel =
        displayFraDanish && displayTilDanish ? `Periode (${displayFraDanish} - ${displayTilDanish})` : 'Periode';

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
      if (hasOverlap || computedRangeMessages.length > 0) {
        const errorMessages = hasOverlap ? 'Der er overlappende perioder' : computedRangeMessages.join('; ');
        rows.push({
          id: `taf.periode.${periode.id}`,
          label: periodeLabel,
          displayValue: `Fejl (${errorMessages})`,
          status: 'error',
        });
        return;
      }

      if (!displayFra || !displayTil || !displayFraDanish || !displayTilDanish) {
        rows.push({
          id: `taf.periode.${periode.id}`,
          label: 'Periode',
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

      const antalMaaneder = calculateTafAntalMaaneder(
        displayFra,
        displayTil,
        ferieperioder,
        loseFeriedage,
        0
      );
      const maanederDisplay = antalMaaneder === null ? '-' : `${formatDaNumberFixed2(antalMaaneder)} måneder`;

      rows.push({
        id: `taf.periode.${periode.id}`,
        label: periodeLabel,
        displayValue:
          breakdown
            ? `${formatDaNumber(breakdown.arbejdsdage)} hverdage - ${formatDaNumber(breakdown.shDage)} SH-dage - ${formatDaNumber(breakdown.feriedage)} feriedage - ${formatDaNumber(breakdown.loseFeriedage)} løse feriedage = ${formatDaNumber(breakdown.tafDage)} TAF-dage\n${maanederDisplay}`
            : '-',
        status: breakdown ? 'ok' : 'error',
      });

      // TODO(b): Tilføj en ekstra debug-linje pr. periode med den tilsvarende månedsberegning (samme princip som EO-oplysninger, men eksplicit i debug-output).
    });
  }

  // 2) Ferieperiode-rækker fra tabellen
  const harFerieperioder = ferieperioder.length > 0 && ferieperioder.some((p) => p.fra || p.til);

  // Detektér overlappende ferieperioder
  const ferieOverlappingIds = detectOverlappingPeriods(ferieperioder);

  if (!harFerieperioder) {
    rows.push({
      id: 'taf.ferie.empty',
      label: 'Ferieperiode',
      displayValue: '-',
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
          label: 'Ferieperiode',
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
          label: 'Ferieperiode',
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
          label: 'Ferieperiode',
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
          label: 'Ferieperiode',
          displayValue: 'Fejl (Ugyldig dato)',
          status: 'error',
        });
        return;
      }

      // Formater displayValue som "fra-dato - til-dato"
      const periodeDisplay = `${fraDanish} - ${tilDanish}`;

      rows.push({
        id: `taf.ferie.${periode.id}`,
        label: 'Ferieperiode',
        displayValue: periodeDisplay,
        status: 'ok',
      });

      // TODO(c): Tilføj en ekstra debug-linje under hver ferieperiode med beregning som både arbejdsdage og måneder (dvs. samme beregningsgrundlag som TAF-perioden, men scoped til ferieperioden).
    });
  }

  // 3) Andel af løn i perioden, der består af SFGG
  const andelSfggDisplay = formatCurrency(amountValueToNumber(values.andelSfggILoenen));
  rows.push({
    id: 'taf.andelSfggILoenen',
    label: 'Andel af løn i perioden, der består af SFGG',
    ...resolveDebugDisplay({ value: andelSfggDisplay, errors: errors.andelSfggILoenen, emptyState: 'ok' }),
  });

  // 4) Evt. allerede modtaget tabt arbejdsfortjeneste for nuværende erstatningsperiode
  const tidligereModtagetTafDisplay = formatCurrency(amountValueToNumber(values.tidligereModtagetTaf));
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
  const tafBeregnesSom = (() => {
    switch (values.beregnesUdFra) {
      case 'Angivet månedsløn':
        return TAF_BEREGNES_SOM.MAANEDER;
      case 'Angivet dagsløn':
        return TAF_BEREGNES_SOM.ARBEJDSDAGE;
      case 'Beregningsperiode':
      default:
        return computeTafBeregningsenhed(values);
    }
  })();

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
  const isAngivetMaanedsloen = beregnesUdFra === 'Angivet månedsløn';
  const isAngivetDagsloen = beregnesUdFra === 'Angivet dagsløn';
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

  rows.push({
    id: 'taf.beregningsgrundlag.beregningsperiode',
    label: 'Periode til beregning af før-løn',
    displayValue: beregningsperiodeDisplay.displayValue,
    status: beregningsperiodeDisplay.status,
  });

  const fravaerPerioder = values.fravaerPerioder ?? [];
  const shouldIncludeFravaer = isBeregningsperiode;
  const harFravaer =
    shouldIncludeFravaer && fravaerPerioder.length > 0 && fravaerPerioder.some((p) => p.fra || p.til);
  const fravaerOverlappingIds = detectOverlappingPeriods(fravaerPerioder);
  const hasValidBeregningsperiodeBounds =
    isBeregningsperiode && periodeFra !== undefined && periodeTil !== undefined && periodeFra <= periodeTil;

  if (!shouldIncludeFravaer || !harFravaer) {
    rows.push({
      id: 'taf.beregningsgrundlag.ferie.empty',
      label: 'Ferieperiode',
      displayValue: '-',
      status: 'ok',
    });
  } else {
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
  rows.push({
    id: 'taf.beregningsgrundlag.uspecificeredeFerieFridage',
    label: 'Uspecificerede ferie-/feriefridage',
    displayValue:
      isBeregningsperiode && typeof uspecificeredeFerie === 'number'
        ? `${formatDaNumber(uspecificeredeFerie)} dage`
        : '-',
    status: 'ok',
  });

  rows.push({
    id: 'taf.beregningsgrundlag.oevrigtFravaerUdenLoen',
    label: 'Øvrigt fravær uden løn',
    displayValue: isBeregningsperiode ? values.oevrigtFravaerUdenLoen : '-',
    status: 'ok',
  });

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

  rows.push({
    id: 'taf.beregningsgrundlag.oevrigeFravaersdage',
    label: 'Antal fraværsdage',
    displayValue: oevrigeFravaersdageDisplay.displayValue,
    status: oevrigeFravaersdageDisplay.status,
  });

  const oevrigeFravaerBeskrivelse = values.oevrigeFravaersdageBeskrivelse?.trim() ?? '';
  const oevrigeFravaerBeskrivelseDisplay = (() => {
    if (!oevrigtFravaerAktivt) return { displayValue: '-', status: 'ok' as DebugStatus };
    if (oevrigeFravaerBeskrivelse === '') {
      return { displayValue: 'Advarsel (Beskrivelse mangler)', status: 'warning' as DebugStatus };
    }
    return { displayValue: oevrigeFravaerBeskrivelse, status: 'ok' as DebugStatus };
  })();

  rows.push({
    id: 'taf.beregningsgrundlag.oevrigeFravaersdageBeskrivelse',
    label: 'Beskrivelse',
    displayValue: oevrigeFravaerBeskrivelseDisplay.displayValue,
    status: oevrigeFravaerBeskrivelseDisplay.status,
  });

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
      values.fravaerPerioder ?? [],
      typeof values.uspecificeredeFerieFridage === 'number' ? values.uspecificeredeFerieFridage : 0,
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
      const rounded = Math.round(value * 100) / 100;
      return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    const fravaerBeskrivelse = values.oevrigeFravaersdageBeskrivelse?.trim();
    const fravaerLabelTekst = fravaerBeskrivelse && fravaerBeskrivelse !== ''
      ? `fraværsdage pga. ${fravaerBeskrivelse}`
      : 'fraværsdage';
    const fravaerLabel = `${formatDaNumber(oevrigeFravaersdageValue)} ${fravaerLabelTekst} uden løn x 4,8 % måned`;
    const label = `${formatMaaneder(totalMaaneder)} - ${formatMaaneder(fravaerMaaneder)} måneder (${fravaerLabel}) =`;
    const roundedTotalMaaneder = Math.round(totalMaaneder * 100) / 100;
    const roundedFravaerMaaneder = Math.round(fravaerMaaneder * 100) / 100;
    const maanederEfterFradrag = Math.max(0, Math.round((roundedTotalMaaneder - roundedFravaerMaaneder) * 100) / 100);
    const formatted = formatMaaneder(maanederEfterFradrag);
    const displayValue = `${formatted} måneder`;

    return { label, displayValue, status: 'ok' as DebugStatus };
  })();

  if (tafBeregnesSom === TAF_BEREGNES_SOM.MAANEDER) {
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
      value: values.loenBaseretPaa,
      errors: errors.loenBaseretPaa,
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

    const opreguleresFraISO = values.angivetLoenOpreguleresFraDato || stamdataValues.skadesdato;
    const opreguleresFraDisplay = opreguleresFraISO ? isoToDanish(opreguleresFraISO) : undefined;

    const hasMissingRequired = !values.angivetLoenOpreguleresFraDato && !stamdataValues.skadesdato;

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

export const buildEODebugIndkomstRows = (
  values: ErstatningsopgoerelseValues,
  skadesdato: ISODateString | undefined,
  manualReguleringInputErrors: Readonly<Record<string, true>> = {}
): DebugRowModel[] => {
  const rows: DebugRowModel[] = [];

  const sections = buildIndkomstSectionStatuses(values.loenindkomstAnsaettelsesforhold ?? [], skadesdato, values.beregnesUdFra);
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
      displayValue: formatStatusMessage(section.satserStatus, section.satserMessage),
      status: section.satserStatus,
    });

    rows.push({
      id: `loenindkomst.${section.id}.loenoplysninger`,
      label: 'Alle lønoplysninger indtastet korrekt',
      displayValue: formatStatusMessage(section.tableStatus, section.tableMessage),
      status: section.tableStatus,
    });
  });

  (values.loenindkomstAnsaettelsesforhold ?? []).forEach((ansaettelsesforhold) => {
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

    const valgtReguleringRowId = `loenindkomst.${ansaettelsesforhold.id}.regulering.valgt` as const;
    rows.push({
      id: valgtReguleringRowId,
      label: 'Valgt regulering',
      displayValue: formatStatusMessage(status, message),
      status,
    });
    const harGyldigValgtRegulering = status === 'ok';
    if (!harGyldigValgtRegulering) {
      return;
    }

    if (
      loenudviklingBasis === 'Overenskomst' &&
      ansaettelsesforhold.overenskomstId &&
      isOffentligOverenskomstId(ansaettelsesforhold.overenskomstId)
    ) {
      const offentligtRowId = `loenindkomst.${ansaettelsesforhold.id}.regulering.offentligLoenoplysninger`;
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
          ? `${typeLabel}, ${trinValue}, ${gruppeValue}`
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
        return { displayValue: 'Nej', status: 'error' as DebugStatus };
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
      return { displayValue: ok ? 'Ja' : 'Nej', status: ok ? 'ok' : 'error' as DebugStatus };
    })();

    if (loenudviklingBasis === 'Manuelt angivet') {
      const manuelNavn = (ansaettelsesforhold.loenudviklingManuelNavn ?? '').trim();
      const harManuelNavn = manuelNavn !== '';
      rows.push({
        id: `loenindkomst.${ansaettelsesforhold.id}.regulering.navn`,
        label: 'Navn på reguleringsform',
        displayValue: formatStatusMessage(
          harManuelNavn ? 'ok' : 'warning',
          harManuelNavn ? manuelNavn : 'Navn på reguleringsform mangler'
        ),
        status: harManuelNavn ? 'ok' : 'warning',
        dependsOn: [{ kind: 'id', id: valgtReguleringRowId }],
      });
    }

    if (loenudviklingBasis !== 'Ingen') {
      rows.push({
        id: `loenindkomst.${ansaettelsesforhold.id}.regulering.alleVaerdier`,
        label: 'Alle reguleringsværdier udfyldt',
        displayValue: alleReguleringsvaerdierRow.displayValue,
        status: alleReguleringsvaerdierRow.status,
        dependsOn: [{ kind: 'id', id: valgtReguleringRowId }],
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
      displayValue: formatStatusMessage(row.status, row.message),
      status: row.status,
    });
  });

  return rows;
};

/**
 * Bygger debug-rækker for Øvrige erstatningskrav
 */
export const buildEODebugOevrigeKravRows = (
  values: ErstatningsopgoerelseValues,
  _errors: ErstatningsopgoerelseFieldErrorsBySource
): DebugRowModel[] => {
  const rows: DebugRowModel[] = [];

  const oevrigeKrav = values.oevrigeKravPerioder ?? [];
  const harKrav = oevrigeKrav.length > 0 && oevrigeKrav.some((k) => k.dato || k.udgiftTil || k.beloeb);

  if (!harKrav) {
    rows.push({
      id: 'oevrigekrav.empty',
      label: '-',
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
      label: harKommentarer ? 'Kommentarer' : '-',
      displayValue: harKommentarer ? kommentarer.trim() : '-',
      status: 'ok',
    },
  ];
};
