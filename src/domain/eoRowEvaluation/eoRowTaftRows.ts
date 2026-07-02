import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import { formatCurrency } from '../../utils/formatUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { resolveEoRowDisplay } from './eoRowCommon';
import type { EoRowModel, EoRowStatus } from './eoRowTypes';
import { getDayBeforeIso } from '../../utils/isoDateHelpers';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from '../erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { calculateTafArbejdsdageBreakdown, calculateTafAntalMaanederPraecis } from '../erstatningsopgoerelse/engines/tafCalculations';
import { clampTafRange, getValidTafRange, resolveTafConstraintBounds, resolveMidlertidigEetDatoHvisAktiv } from '../erstatningsopgoerelse/validation/tafPeriodConstraints';
import { evaluateTafPerioder } from '../erstatningsopgoerelse/validation/tafPeriodeValidation';
import { evaluateFerieperioder } from '../erstatningsopgoerelse/validation/ferieperiodeValidation';
import { getFolkepensionsdato } from '../../data/folkepensionAlderRates';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import type { ErstatningsopgoerelseValues, ErstatningsopgoerelseFieldErrorsBySource } from './eoRowShared';
import { formatRowCount, formatRowMonths } from './eoRowShared';
import { erDetteFoersteErstatningsopgoerelse } from '../erstatningsopgoerelse/validation/eoNummerValidering';

const resolveFolkepensionsdato = (
  fodselsdato: ISODateString | undefined,
  controlDate: ISODateString | undefined
): ISODateString | undefined => {
  if (!fodselsdato || !controlDate) return undefined;
  return getFolkepensionsdato(fodselsdato, controlDate);
};


export const buildEoTaftRows = (
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
): EoRowModel[] => {
  const rows: EoRowModel[] = [];
  const tafBeregnesSom = computeTafBeregningsenhed(values);
  const perioder = values.tafPerioder ?? [];
  const synligeTafPerioder = perioder.filter((periode) => periode.fra || periode.til);
  const harPerioder = synligeTafPerioder.length > 0;
  const periodeLabel = synligeTafPerioder.length === 1 ? 'Periode' : 'Perioder';

  if (!harPerioder) {
    return [
      {
        id: 'taf.ingenTafIEoPerioden',
        label: 'Advarsel',
        displayValue: 'Advarsel (Der er ikke angivet nogen TAF-periode i EO-perioden)',
        status: 'warning',
        summaryDisplay: 'messageOnly',
      },
      {
        id: 'taf.periode.empty',
        label: periodeLabel,
        displayValue: 'Ingen',
        status: 'ok',
      },
    ];
  }

  const tafBounds = resolveTafConstraintBounds(values, { skadedatoISO: context.skadedatoISO });
  const aktivMidlertidigEETBeregnetDato = resolveMidlertidigEetDatoHvisAktiv({
    ...values,
    skadedatoISO: context.skadedatoISO,
  });
  const clampedTafById = new Map<string, { fra: ISODateString; til: ISODateString }>();
  const tafIkkeRejstLabel = 'Der er ikke rejst TAF-krav for hele EO-perioden';
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

  const tafKravDatoer = (() => {
    let earliest: ISODateString | undefined = undefined;
    let latest: ISODateString | undefined = undefined;
    for (const periode of values.tafPerioder ?? []) {
      const valid = getValidTafRange(periode);
      if (!valid) continue;
      const clamped = clampTafRange(valid, tafBounds);
      if (!clamped) continue;
      clampedTafById.set(periode.id, clamped);
      if (!earliest || clamped.fra < earliest) earliest = clamped.fra;
      if (!latest || clamped.til > latest) latest = clamped.til;
    }
    return { first: earliest, last: latest };
  })();
  const firstTafKravDato = tafKravDatoer.first;
  const lastTafKravDato = tafKravDatoer.last;
  const manglerTafVedStartAfIkkeFoersteEo =
    !erDetteFoersteErstatningsopgoerelse(values.eoNummer) &&
    firstTafKravDato !== undefined &&
    values.vedroererPeriodeFra !== undefined &&
    firstTafKravDato > values.vedroererPeriodeFra;

  // `tafOphoerSkyldes` beregnes kun, når der er TAF inden for EO-perioden.
  // Er der ingen TAF i EO-perioden (lastTafKravDato === undefined), vises
  // i stedet taf.perioder.clampedAway og taf.ophoerSkyldes emitteres ikke.
  const tafOphoerSkyldes = lastTafKravDato
    ? (() => {
        // Ved EO 2+ er manglende TAF i starten af EO-perioden også et fravalg af TAF
        // for hele perioden. Første EO beholder den hidtidige ophørsbaserede advarsel.
        if (manglerTafVedStartAfIkkeFoersteEo) {
          return tafIkkeRejstLabel;
        }

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
      })()
    : undefined;

  const tafOphoerSkyldesDatoISO = (() => {
    if (!lastTafKravDato) return undefined;
    if (manglerTafVedStartAfIkkeFoersteEo) return undefined;

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

  if (tafOphoerSkyldes !== undefined) {
    const dateDanish = tafOphoerSkyldesDatoISO ? isoToDanish(tafOphoerSkyldesDatoISO) : undefined;
    const tafOphoerSkyldesDisplayValue = dateDanish
      ? `${tafOphoerSkyldes} (${dateDanish})`
      : tafOphoerSkyldes;
    rows.push({
      id: 'taf.ophoerSkyldes',
      label: 'TAF-ophør skyldes',
      displayValue: tafOphoerSkyldesDisplayValue,
      status: tafOphoerSkyldes === tafIkkeRejstLabel ? 'warning' : 'ok',
    });
  }

  // 1) Periode-rækker fra tabellen.
  // Blokering (komplethed, dato-grænser, cutoff, overlap, rækkefølge) afgøres af den delte,
  // autoritative TAF-periode-validering i domænets validerings-lag (`tafPeriodeValidation`) — ÉN
  // sandhedskilde (jf. B9). Denne builder RENDERER kun resultatet; dens `error`-rækker gater PDF.
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
        focusFieldHint: evaluation.field,
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
    const maanederDisplay = antalMaaneder === null ? '-' : `${formatRowMonths(antalMaaneder)} måneder`;
    const arbejdsdageDisplay = breakdown
      ? `${formatRowCount(breakdown.arbejdsdage)} hverdage - ${formatRowCount(breakdown.shDage)} SH-dage - ${formatRowCount(breakdown.feriedage)} feriedage - ${formatRowCount(breakdown.loseFeriedage)} løse feriedage = ${formatRowCount(breakdown.tafDage)} arbejdsdage`
      : '-';

    const visMaaneder = tafBeregnesSom === TAF_BEREGNES_SOM.MAANEDER;
    const displayValue = visMaaneder ? maanederDisplay : arbejdsdageDisplay;
    const status: EoRowStatus = visMaaneder
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

  // Ferieperiode-blokering (komplethed, dato-grænser, overlap) afgøres af den delte, autoritative
  // validering (jf. B9); kontrollaget RENDERER kun resultatet.
  const ferieEvaluations = evaluateFerieperioder(ferieperioder, {
    skadedatoISO: context.skadedatoISO,
    erErhvervssygdom: context.erErhvervssygdom,
    differencekravDato: context.differencekravDato,
    endeligEETBeregnetDato: context.endeligEETBeregnetDato,
    midlertidigEETBeregnetDato: context.midlertidigEETBeregnetDato,
    aktivMidlertidigEETBeregnetDato,
    verserendeKlageEet: context.verserendeKlageEet,
  });

  if (!harFerieperioder) {
    rows.push({
      id: 'taf.ferie.empty',
      label: ferieperiodeLabel,
      displayValue: 'Ingen',
      status: 'ok',
    });
  } else {
    ferieperioder.forEach((periode) => {
      const evaluation = ferieEvaluations.get(periode.id) ?? { kind: 'ok' as const };
      if (evaluation.kind === 'skip') return;

      if (evaluation.kind === 'error') {
        rows.push({
          id: `taf.ferie.${periode.id}`,
          label: ferieperiodeLabel,
          displayValue: `Fejl (${evaluation.message})`,
          status: 'error',
          focusFieldHint: evaluation.field,
        });
        return;
      }

      // evaluation.kind === 'ok': formatér visning. isoToDanish-tjekket er rent display-
      // defensivt (kan i praksis ikke fejle på schema-validerede datoer).
      const fraISO = periode.fra;
      const tilISO = periode.til;
      const fraDanish = fraISO ? isoToDanish(fraISO) : undefined;
      const tilDanish = tilISO ? isoToDanish(tilISO) : undefined;
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
    ...resolveEoRowDisplay({ value: tidligereModtagetTafDisplay, errors: errors.tidligereModtagetTaf, emptyState: 'ok' }),
  });

  return rows;
};
