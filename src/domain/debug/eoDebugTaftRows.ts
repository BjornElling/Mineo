import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import { formatCurrency } from '../../utils/formatUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { buildNoValidDateRangeMessage, isNonEmptyString, resolveDebugDisplay } from './eoDebugCommon';
import type { DebugRowModel, DebugStatus } from './eoDebugTypes';
import { computeRowDateBounds } from '../erstatningsopgoerelse/helpers/rowDateBounds';
import { getDayBeforeIso, validateISODateRange } from '../../utils/isoDateHelpers';
import { detectOverlappingPeriods } from '../erstatningsopgoerelse/engines/periodOverlapDetection';
import { computeSkadedatoMinRule, dateRanges_erstatningsopgoerelse, TODAY } from '../../config/dateRanges';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from '../erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { calculateTafArbejdsdageBreakdown, calculateTafAntalMaanederPraecis } from '../erstatningsopgoerelse/engines/tafCalculations';
import { clampTafRange, getValidTafRange, resolveTafConstraintBounds, resolveMidlertidigEetDatoHvisAktiv } from '../erstatningsopgoerelse/validation/tafPeriodConstraints';
import { evaluateTafPerioder } from '../erstatningsopgoerelse/validation/tafPeriodeValidation';
import { getFolkepensionsdato } from '../../data/folkepensionAlderRates';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import type { ErstatningsopgoerelseValues, ErstatningsopgoerelseFieldErrorsBySource } from './eoDebugEoShared';
import { formatDebugCount, formatDebugMonths } from './eoDebugEoShared';

const resolveFolkepensionsdato = (
  fodselsdato: ISODateString | undefined,
  controlDate: ISODateString | undefined
): ISODateString | undefined => {
  if (!fodselsdato || !controlDate) return undefined;
  return getFolkepensionsdato(fodselsdato, controlDate);
};


export const buildEODebugTaftRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldErrorsBySource,
  context: Readonly<{
    skadedatoISO: ISODateString | undefined;
    skadelidteFodselsdato: ISODateString | undefined;
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

  const tafBounds = resolveTafConstraintBounds(values, { skadedatoISO: context.skadedatoISO });
  const aktivMidlertidigEETBeregnetDato = resolveMidlertidigEetDatoHvisAktiv({
    ...values,
    skadedatoISO: context.skadedatoISO,
  });
  const clampedTafById = new Map<string, { fra: ISODateString; til: ISODateString }>();
  const tafIkkeRejstLabel = 'Ikke rejst TAF-krav for hele perioden';
  const authoritativeTafRanges = canonicalOutput?.periodiseringer.tafPerioder;
  const hasValidTafPerioder = perioder.some((periode) => Boolean(getValidTafRange(periode)));
  if (authoritativeTafRanges && authoritativeTafRanges.length === 0 && hasValidTafPerioder) {
    rows.push({
      id: 'taf.perioder.clampedAway',
      label: 'Advarsel',
      displayValue: 'Advarsel (Der er indtastet TAF-perioder, men ingen af perioderne ligger inden for erstatningsperioden. TAF beregnes derfor til 0 kr.)',
      status: 'warning',
      summaryDisplay: 'messageOnly',
    });
  }
  const folkepensionsdato = resolveFolkepensionsdato(
    context.skadelidteFodselsdato,
    values.opgørelseLavetDen
  );

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

    const endeligEetMinus1 = getDayBeforeIso(context.endeligEETBeregnetDato);
    if (!context.verserendeKlageEet && endeligEetMinus1 && endeligEetMinus1 === lastTafKravDato) {
      return 'Endelig EET-afgørelse';
    }

    const midlertidigEetMinus1 = getDayBeforeIso(aktivMidlertidigEETBeregnetDato);
    if (!context.verserendeKlageEet && midlertidigEetMinus1 && midlertidigEetMinus1 === lastTafKravDato) {
      return 'Midlertidig EET-afgørelse';
    }

    const differencekravMinus1 = getDayBeforeIso(context.differencekravDato);
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

    const endeligEetMinus1 = getDayBeforeIso(context.endeligEETBeregnetDato);
    if (!context.verserendeKlageEet && endeligEetMinus1 && endeligEetMinus1 === lastTafKravDato) {
      return context.endeligEETBeregnetDato;
    }

    const midlertidigEetMinus1 = getDayBeforeIso(aktivMidlertidigEETBeregnetDato);
    if (!context.verserendeKlageEet && midlertidigEetMinus1 && midlertidigEetMinus1 === lastTafKravDato) {
      return aktivMidlertidigEETBeregnetDato;
    }

    const differencekravMinus1 = getDayBeforeIso(context.differencekravDato);
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

  const endeligEETMinus1 = getDayBeforeIso(context.endeligEETBeregnetDato);
  const midlertidigEETMinus1 = getDayBeforeIso(aktivMidlertidigEETBeregnetDato);
  const differencekravMinus1 = getDayBeforeIso(context.differencekravDato);

  let combinedExtraMaxDate: ISODateString | undefined = undefined;
  if (differencekravMinus1) {
    combinedExtraMaxDate = differencekravMinus1;
  }
  if (!context.verserendeKlageEet && endeligEETMinus1) {
    if (!combinedExtraMaxDate || endeligEETMinus1 < combinedExtraMaxDate) {
      combinedExtraMaxDate = endeligEETMinus1;
    }
  }
  if (!context.verserendeKlageEet && midlertidigEETMinus1) {
    if (!combinedExtraMaxDate || midlertidigEETMinus1 < combinedExtraMaxDate) {
      combinedExtraMaxDate = midlertidigEETMinus1;
    }
  }

  const skadedatoMinRule = computeSkadedatoMinRule({
    skadedatoISO: context.skadedatoISO,
    erErhvervssygdom: context.erErhvervssygdom,
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMin,
  });

  const validateRowDate = (args: {
    iso: ISODateString | undefined;
    minDate: ISODateString;
    maxDate: ISODateString;
    noValidRangeCause?: string | undefined;
  }): string | undefined => {
    if (!args.iso) return undefined;
    if (args.minDate > args.maxDate) {
      return buildNoValidDateRangeMessage({
        minDate: args.minDate,
        maxDate: args.maxDate,
        noValidRangeCause: args.noValidRangeCause,
      });
    }
    const result = validateISODateRange(args.iso, args.minDate, args.maxDate);
    return result.isValid ? undefined : result.errorMessage;
  };

  // 1) Periode-rækker fra tabellen.
  // Blokering (komplethed, dato-grænser, cutoff, overlap, rækkefølge) afgøres af den delte,
  // autoritative TAF-periode-validering — samme funktion som eoBlockingValidation kalder (jf.
  // B9), så beskederne er identiske. Debug RENDERER kun resultatet.
  const tafEvaluations = evaluateTafPerioder(perioder, {
    skadedatoISO: context.skadedatoISO,
    erErhvervssygdom: context.erErhvervssygdom,
    differencekravDato: context.differencekravDato,
    endeligEETBeregnetDato: context.endeligEETBeregnetDato,
    midlertidigEETBeregnetDato: context.midlertidigEETBeregnetDato,
    aktivMidlertidigEETBeregnetDato,
    verserendeKlageEet: context.verserendeKlageEet,
  });

  const ferieperioder = values.ferieperioder ?? [];

  perioder.forEach((periode) => {
    const evaluation = tafEvaluations.get(periode.id) ?? { kind: 'ok' as const };
    // Helt tom række springes over.
    if (evaluation.kind === 'skip') return;

    // Visnings-label bruger de clampede datoer (falder tilbage til den rene label, fx for
    // ufuldstændige rækker uden gyldig clamp — så error-rækkernes label er uændret).
    const clamped = clampedTafById.get(periode.id);
    const displayFra = clamped?.fra;
    const displayTil = clamped?.til;
    const displayFraDanish = displayFra ? isoToDanish(displayFra) : undefined;
    const displayTilDanish = displayTil ? isoToDanish(displayTil) : undefined;
    const periodeRowLabel =
      displayFraDanish && displayTilDanish ? `${periodeLabel} (${displayFraDanish} - ${displayTilDanish})` : periodeLabel;

    if (evaluation.kind === 'error') {
      rows.push({
        id: `taf.periode.${periode.id}`,
        label: periodeRowLabel,
        displayValue: `Fejl (${evaluation.message})`,
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
    const maanederDisplay = antalMaaneder === null ? '-' : `${formatDebugMonths(antalMaaneder)} måneder`;
    const arbejdsdageDisplay = breakdown
      ? `${formatDebugCount(breakdown.arbejdsdage)} hverdage - ${formatDebugCount(breakdown.shDage)} SH-dage - ${formatDebugCount(breakdown.feriedage)} feriedage - ${formatDebugCount(breakdown.loseFeriedage)} løse feriedage = ${formatDebugCount(breakdown.tafDage)} arbejdsdage`
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

    if (folkepensionsdato && displayTil >= folkepensionsdato) {
      rows.push({
        id: `taf.folkepensionsalder.${periode.id}`,
        label: 'Advarsel',
        displayValue: `Advarsel (TAF-perioden løber til efter skadelidtes folkepensionsalder (${isoToDanish(folkepensionsdato)}).)`,
        status: 'warning',
        summaryDisplay: 'messageOnly',
      });
    }

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
        skadedatoMinDate: skadedatoMinRule.minDate,
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
        if (skadedatoMinRule.minBoundKind) parts.push('skadedato');
        if (tilISO) parts.push('til-dato i samme række');
        return parts.length > 0 ? parts.join(', ') : undefined;
      })();

      const tilNoValidRangeCause = (() => {
        const parts: string[] = [];
        if (!fraISO && skadedatoMinRule.minBoundKind) parts.push('skadedato');
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

