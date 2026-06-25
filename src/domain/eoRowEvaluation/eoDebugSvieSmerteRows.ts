import type { ISODateString } from '../../types/branded';
import { isoToDanish, dateToISO } from '../../types/branded';
import { formatCurrency } from '../../utils/formatUtils';
import { addMonths } from '../../utils/dateUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { isNonEmptyString, resolveDebugDisplay, collectPresentFieldErrors } from './eoDebugCommon';
import type { DebugRowModel, DebugStatus } from './eoDebugTypes';
import { isoDateToDate } from '../dates/isoDate';
import { countInclusiveUtcDays } from '../../utils/utcDayMath';
import { erDetteFoersteErstatningsopgoerelse } from '../erstatningsopgoerelse/validation/eoNummerValidering';
import { getDayBeforeIso } from '../../utils/isoDateHelpers';
import { evaluateSvieSmertePerioder } from '../erstatningsopgoerelse/validation/svieSmertePeriodeValidation';
import { mergeDateRanges } from '../erstatningsopgoerelse/engines/periodMerging';
import { svieSmertePrDag, svieSmerteMax } from '../../data/lovbestemteRates';
import { parseForligsgrad } from '../erstatningsopgoerelse/engines/forligsgrad';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import type { ErstatningsopgoerelseValues, ErstatningsopgoerelseFieldErrorsBySource } from './eoDebugEoShared';

const getYearAfterAddingOneMonth = (isoDate: ISODateString | undefined): number | undefined => {
  if (!isoDate) return undefined;
  // Kanonisk addMonths (clamp til månedsslut) — ÉN "læg måneder til dato"-semantik i
  // hele kodebasen, ingen rå setUTCMonth-rollover. Adfærdsbevarende her, fordi vi kun
  // udtrækker *årstallet*: clamp og rollover er kun forskellige i dag-på-måneden, og den
  // forskel kan aldrig ændre året. December + 1 måned ruller ganske vist til næste år —
  // men identisk under begge semantikker — så det udtrukne år er det samme.
  return addMonths(isoDateToDate(isoDate), 1).getUTCFullYear();
};


export const buildEODebugSvieSmerteRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldErrorsBySource,
  context: Readonly<{
    skadedatoISO: ISODateString | undefined;
    erErhvervssygdom: boolean;
    menAfgoerelseDatoForTabel: ISODateString | undefined;
    verserendeKlageMen: boolean;
  }>,
  canonicalOutput?: EoCanonicalOutput
): DebugRowModel[] => {
  const rows: DebugRowModel[] = [];
  const erFoersteOpgoerelse = erDetteFoersteErstatningsopgoerelse(values.eoNummer);
  const svieSmerteIkkeRejstLabel = 'Ikke rejst svie/smerte-krav for hele perioden';

  // Tjek om periode-tabellen er synlig (kun synlig hvis tidligereSsMax er 'Nej')
  const periodeErSynlig = values.tidligereSsMax === 'Nej';

  // 1) Tidligere beregnet S/S til max. (fejl ved tom)
  rows.push({
    id: 'sviesmerte.tidligereSsMax',
    label: 'Tidligere beregnet S/S til max.',
    ...resolveDebugDisplay({ value: values.tidligereSsMax, errors: errors.tidligereSsMax, emptyState: 'error' }),
  });

  // 2) Periode rows fra tabellen - kun hvis synlig
  const perioder = periodeErSynlig ? (values.svieSmertePerioder ?? []) : [];
  const harPerioder = perioder.length > 0 && perioder.some((p) => p.fra || p.til || p.tilstand);
  // Periode-blokering (komplethed, dato-grænser, overlap, rækkefølge) afgøres af den delte,
  // autoritative validering i domænets validerings-lag (`svieSmertePeriodeValidation`) — ÉN
  // sandhedskilde. Denne builder RENDERER kun resultatet; dens `error`-rækker gater PDF-download
  // (jf. B9). Overlap afvises altid (også samme tilstand), jf. periodisering-contract §7.
  const periodeEvaluations = evaluateSvieSmertePerioder(perioder, {
    skadedatoISO: context.skadedatoISO,
    erErhvervssygdom: context.erErhvervssygdom,
    menAfgoerelseDatoForTabel: context.menAfgoerelseDatoForTabel,
    verserendeKlageMen: context.verserendeKlageMen,
  });

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
      const evaluation = periodeEvaluations.get(periode.id) ?? { kind: 'ok' as const };
      // Helt tom række springes over (ingen fejl, ingen visning).
      if (evaluation.kind === 'skip') return;

      const fraISO = periode.fra;
      const tilISO = periode.til;
      const periodeLabel = (() => {
        if (!fraISO || !tilISO) return 'Periode';
        const fraDanishLabel = isoToDanish(fraISO);
        const tilDanishLabel = isoToDanish(tilISO);
        return fraDanishLabel && tilDanishLabel ? `Periode (${fraDanishLabel} - ${tilDanishLabel})` : 'Periode';
      })();

      if (evaluation.kind === 'error') {
        const displayValue = `Fejl (${evaluation.message})`;
        periodeFejlBeskeder.push(displayValue);
        rows.push({
          id: `sviesmerte.periode.${periode.id}`,
          label: periodeLabel,
          displayValue,
          status: 'error',
        });
        return;
      }

      // evaluation.kind === 'ok': formatér visning. try/catch + dato-tjek er rent
      // display-defensivt (isoToDanish kan i praksis ikke fejle på schema-validerede datoer,
      // og 'ok' garanterer at begge datoer er udfyldt).
      try {
        const fraDanish = fraISO ? isoToDanish(fraISO) : undefined;
        const tilDanish = tilISO ? isoToDanish(tilISO) : undefined;

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
      return `Svie/smerte-satsen for ${opgoerelsePlusOneMonthYear} kan anvendes.`;
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
    label: 'Hvilket års svie/smerte-satser lægges til grund?',
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
    label: 'Svie/smerte-sats ved delvis sygemelding',
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

  // 4) Svie/smerte krav i tidligere erstatningsopgørelser (ok hvis tomt) — kun ved ikke-første opgørelse
  if (!erFoersteOpgoerelse) {
    const tidligereTotalValue = formatCurrency(amountValueToNumber(values.svieSmerteTidligereTotal));
    rows.push({
      id: 'sviesmerte.tidligereTotal',
      label: 'Svie/smerte-krav i tidligere erstatningsopgørelser',
      ...resolveDebugDisplay({ value: tidligereTotalValue, errors: errors.svieSmerteTidligereTotal, emptyState: 'ok' }),
    });
  }

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
      const dayBeforeMenISO = getDayBeforeIso(menAfgoerelseDato);
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
      const dayBeforeMenISO2 = getDayBeforeIso(menAfgoerelseDato);
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
    label: 'Antal svie/smerte-dage i erstatningsperioden',
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
    if (values.kravPaaSvieSmerteGodtgoerelse !== 'Ja') {
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
      getDayBeforeIso(values.menAfgoerelseDato) === lastSvieSmerteKravDato
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
    label: 'Svie/smerte-ophør skyldes',
    displayValue: svieSmerteOphoerSkyldes.displayValue,
    status: svieSmerteOphoerSkyldes.status,
  });

  return rows;
};

