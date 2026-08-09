import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { isoToDanish, dateToISO, isISODateString, parseISODate } from '../../types/branded';
import { formatCurrency } from '../../utils/formatUtils';
import { addDays } from '../../utils/dateUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { presentIssuesForRow, resolveEoRowDisplay } from './eoRowCommon';
import { isNonEmptyString } from '../erstatningsopgoerelse/validation/eoDateRangeMessages';
import type { EoRowModel, EoRowStatus } from './eoRowTypes';
import { detectOverlappingPeriods } from '../erstatningsopgoerelse/engines/periodOverlapDetection';
import { computeTafBeregningsenhed, TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR, TAF_BEREGNES_SOM } from '../erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { calculateTafArbejdsdageBreakdown, calculateTafAntalMaaneder } from '../erstatningsopgoerelse/engines/tafCalculations';
import { sumMaanedsbroekForInterval } from '../dates/maanedsbroek';
import { calculateFerieHverdageMinusSHDage } from '../erstatningsopgoerelse/engines/ferieCalculations';
import { computeTafOverlapWithBeregningsperiode } from '../erstatningsopgoerelse/engines/beregningsperiodeTafOverlap';
import { getAngivetLoenBaseretPaa, getAngivetLoenOpreguleresFraDato } from '../erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from '../erstatningsopgoerelse/helpers/eoSharedUtils';
import { buildBeregningsperiodeRange, buildIncomeForRanges } from '../erstatningsopgoerelse/helpers/indtaegtPerioder';
import type { ErstatningsopgoerelseValues, ErstatningsopgoerelseFieldIssues } from './eoRowShared';
import { formatRowCount, formatRowMonths, calculateElapsedWholeMonths } from './eoRowShared';
import { topLevelFieldIssue } from '../erstatningsopgoerelse/eoInputIssues';
import {
  eoAngivetDagsloenBaseretPaaField,
  eoAngivetMaanedsloenBaseretPaaField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';

export const buildEoTafBeregningsgrundlagRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldIssues,
  stamdataValues: PersistedSectionMap['stamdata']
): EoRowModel[] => {
  const rows: EoRowModel[] = [];

  const tafBeregnesSom = computeTafBeregningsenhed(values);

  rows.push({
    id: 'taf.beregningsgrundlag.beregnesUdFra',
    label: 'Beregnes ud fra',
    ...resolveEoRowDisplay({
      value: values.beregnesUdFra,
      issue: topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'beregnesUdFra'),
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
  const periodeFra = values.tafBeregningsperiodeFra;
  const periodeTil = values.tafBeregningsperiodeTil;

  const periodeFraErrors = presentIssuesForRow(topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'tafBeregningsperiodeFra'));
  const periodeTilErrors = presentIssuesForRow(topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'tafBeregningsperiodeTil'));
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
      return { displayValue: '-', status: 'ok' as EoRowStatus };
    }
    if (periodeErrorValue) {
      return { displayValue: periodeErrorValue, status: hasPeriodeErrorSeverity ? 'error' as EoRowStatus : 'warning' as EoRowStatus };
    }

    if (filledCount !== 2) {
      return { displayValue: 'Fejl (Ikke alle felter udfyldt)', status: 'error' as EoRowStatus };
    }
    if (!periodeFra || !periodeTil) {
      return { displayValue: 'Fejl (Ugyldig dato)', status: 'error' as EoRowStatus };
    }
    if (periodeFra > periodeTil) {
      return { displayValue: 'Fejl (Til-dato skal være efter fra-dato)', status: 'error' as EoRowStatus };
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
      return { displayValue: `Fejl (${overlap.firstOverlapMessage})`, status: 'error' as EoRowStatus };
    }

    const fraDanish = isoToDanish(periodeFra);
    const tilDanish = isoToDanish(periodeTil);
    if (!fraDanish || !tilDanish) {
      return { displayValue: 'Fejl (Ugyldig dato)', status: 'error' as EoRowStatus };
    }

    return { displayValue: `${fraDanish} - ${tilDanish}`, status: 'ok' as EoRowStatus };
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
        status: 'error' as EoRowStatus,
      };
    }
    return {
      label: 'Indkomst',
      displayValue: '-',
      message: `Ingen indkomst i beregningsperioden (${fraDanish} - ${tilDanish})`,
      status: 'error' as EoRowStatus,
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
    return calculateElapsedWholeMonths(periodeFra, inclusivePeriodeEnd) >= 6;
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
          displayValue: `Fejl (${hasFra ? 'Til-dato' : 'Fra-dato'} er ikke angivet)`,
          status: 'error',
          focusFieldHint: hasFra ? 'til' : 'fra',
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
          displayValue: 'Fejl (Til-dato skal være efter fra-dato)',
          status: 'error',
          focusFieldHint: 'til',
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
        displayValue: feriedage === null ? '-' : `${formatRowCount(feriedage)} feriedage`,
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
          ? `${formatRowCount(uspecificeredeFerie)} dage`
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
    if (!oevrigtFravaerAktivt) return { displayValue: '-', status: 'ok' as EoRowStatus, message: undefined };
    if (oevrigeFravaersdage === undefined) {
      return { displayValue: 'Fejl (Antal fraværsdage er ikke angivet)', status: 'error' as EoRowStatus, message: 'Antal fraværsdage er ikke angivet' };
    }
    if (oevrigeFravaersdage === 0) {
      return { displayValue: 'Advarsel (Antal fraværsdage er 0)', status: 'warning' as EoRowStatus, message: 'Antal fraværsdage er sat til 0' };
    }
    return { displayValue: `${formatRowCount(oevrigeFravaersdage)} dage`, status: 'ok' as EoRowStatus, message: undefined };
  })();

  if (oevrigtFravaerAktivt) {
    rows.push({
      id: 'taf.beregningsgrundlag.oevrigeFravaersdage',
      label: 'Antal fraværsdage',
      displayValue: oevrigeFravaersdageDisplay.displayValue,
      status: oevrigeFravaersdageDisplay.status,
      message: oevrigeFravaersdageDisplay.message,
      summaryDisplay: oevrigeFravaersdageDisplay.status !== 'ok' ? 'messageOnly' : undefined,
    });
  }

  const oevrigeFravaerBeskrivelse = values.oevrigeFravaersdageBeskrivelse?.trim() ?? '';
  const oevrigeFravaerBeskrivelseDisplay = (() => {
    if (!oevrigtFravaerAktivt) return { displayValue: '-', status: 'ok' as EoRowStatus };
    if (oevrigeFravaerBeskrivelse === '') {
      return { displayValue: 'Advarsel (Beskrivelse er ikke udfyldt)', status: 'warning' as EoRowStatus };
    }
    return { displayValue: oevrigeFravaerBeskrivelse, status: 'ok' as EoRowStatus };
  })();

  if (oevrigtFravaerAktivt) {
    rows.push({
      id: 'taf.beregningsgrundlag.oevrigeFravaersdageBeskrivelse',
      label: 'Beskrivelse',
      displayValue: oevrigeFravaerBeskrivelseDisplay.displayValue,
      status: oevrigeFravaerBeskrivelseDisplay.status,
      message: oevrigeFravaerBeskrivelseDisplay.status === 'warning' ? 'Beskrivelse af fravær er ikke udfyldt' : undefined,
      summaryDisplay: oevrigeFravaerBeskrivelseDisplay.status === 'warning' ? 'messageOnly' : undefined,
    });
  }

  const arbejdsdageRow = (() => {
    if (!isBeregningsperiode) {
      return { label: 'Arbejdsdage', displayValue: '-', status: 'ok' as EoRowStatus };
    }
    if (!beregningsperiodeRangeOk || !periodeFra || !periodeTil) {
      return { label: 'Arbejdsdage', displayValue: 'Fejl (Beregningsperioden er ugyldig)', status: 'error' as EoRowStatus };
    }
    if (values.oevrigtFravaerUdenLoen === 'Ja' && values.oevrigeFravaersdage === undefined) {
      return { label: 'Arbejdsdage', displayValue: 'Fejl (Antal fraværsdage er ikke angivet)', status: 'error' as EoRowStatus };
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
      return { label: 'Arbejdsdage', displayValue: 'Fejl (Ugyldig periode)', status: 'error' as EoRowStatus };
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
      .map((component) => `${formatRowCount(component.value)} ${component.label}`);
    const label = `${parts.join(' - ')} =`;
    const displayValue = `${formatRowCount(samletArbejdsdage)} arbejdsdage`;

    return { label, displayValue, status: 'ok' as EoRowStatus };
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
      return { label: 'Måneder', displayValue: '-', status: 'ok' as EoRowStatus };
    }
    if (!beregningsperiodeRangeOk || !periodeFra || !periodeTil) {
      return { label: 'Måneder', displayValue: 'Fejl (Beregningsperioden er ugyldig)', status: 'error' as EoRowStatus };
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
      return { label: 'Måneder', displayValue: 'Fejl (Ugyldig periode)', status: 'error' as EoRowStatus };
    }

    if (values.oevrigtFravaerUdenLoen === 'Ja' && values.oevrigeFravaersdage === undefined) {
      return { label: 'Måneder', displayValue: 'Fejl (Antal fraværsdage er ikke angivet)', status: 'error' as EoRowStatus };
    }

    const totalMaaneder = sumMaanedsbroekForInterval(periodeFra, periodeTil);
    const fravaerMaaneder = oevrigeFravaersdageValue * TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR;

    const fravaerBeskrivelse =
      values.oevrigtFravaerUdenLoen === 'Ja'
        ? values.oevrigeFravaersdageBeskrivelse?.trim()
        : '';
    const fravaerLabelTekst = fravaerBeskrivelse && fravaerBeskrivelse !== ''
      ? `fraværsdage pga. ${fravaerBeskrivelse}`
      : 'fraværsdage';
    const label = oevrigeFravaersdageValue === 0
      ? `Beregningsperiode: ${formatRowMonths(totalMaaneder)} måneder (0 ${fravaerLabelTekst} uden løn) =`
      : `Beregningsperiode: ${formatRowMonths(totalMaaneder)} - ${formatRowMonths(fravaerMaaneder)} måneder (${formatRowCount(oevrigeFravaersdageValue)} ${fravaerLabelTekst} uden løn x 4,8 % måned) =`;
    const maanederEfterFradrag = Math.max(0, totalMaaneder - fravaerMaaneder);
    const formatted = formatRowMonths(maanederEfterFradrag);
    const displayValue = `${formatted} måneder`;

    return { label, displayValue, status: 'ok' as EoRowStatus };
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
        return { displayValue: 'Fejl (Månedsløn er ikke angivet)', status: 'error' as EoRowStatus };
      }
      return { displayValue: display, status: 'ok' as EoRowStatus };
    })();

    rows.push({
      id: 'taf.beregningsgrundlag.maanedsloen',
      label: 'Månedslønnen udgør',
      displayValue: maanedsloenDisplay.displayValue,
      status: maanedsloenDisplay.status,
      message: maanedsloenDisplay.status === 'error' ? 'Månedsløn er ikke angivet' : undefined,
      summaryDisplay: maanedsloenDisplay.status === 'error' ? 'messageOnly' : undefined,
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregnesUdFra' },
      ],
    });
  }

  if (beregnesUdFra === 'Angivet dagsløn') {
    const dagsloenDisplay = (() => {
      const display = formatCurrency(amountValueToNumber(values.dagsloenenUdgoer));
      if (display.trim() === '') {
        return { displayValue: 'Fejl (Dagsløn er ikke angivet)', status: 'error' as EoRowStatus };
      }
      return { displayValue: display, status: 'ok' as EoRowStatus };
    })();

    rows.push({
      id: 'taf.beregningsgrundlag.dagsloen',
      label: 'Dagslønnen udgør',
      displayValue: dagsloenDisplay.displayValue,
      status: dagsloenDisplay.status,
      message: dagsloenDisplay.status === 'error' ? 'Dagsløn er ikke angivet' : undefined,
      summaryDisplay: dagsloenDisplay.status === 'error' ? 'messageOnly' : undefined,
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregnesUdFra' },
      ],
    });
  }

  if (beregnesUdFra === 'Angivet månedsløn' || beregnesUdFra === 'Angivet dagsløn') {
    const loenBaseretPaaDisplay = resolveEoRowDisplay({
      value: getAngivetLoenBaseretPaa(values),
      issue:
        beregnesUdFra === 'Angivet månedsløn'
          ? topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'angivetMaanedsloenBaseretPaa')
          : topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'angivetDagsloenBaseretPaa'),
      emptyState: 'warning',
    });

    rows.push({
      id: 'taf.beregningsgrundlag.loenBaseretPaa',
      label: '- baseret på',
      displayValue: loenBaseretPaaDisplay.displayValue,
      status: loenBaseretPaaDisplay.status,
      // Rækken samler to betingede skalarer; builderen ejer betingelsen og må derfor også binde
      // det konkrete felt. Kataloget kan ikke udlede dette sikkert fra række-id'et alene.
      focusTarget: {
        kind: 'fieldAddress',
        address: (beregnesUdFra === 'Angivet månedsløn'
          ? eoAngivetMaanedsloenBaseretPaaField
          : eoAngivetDagsloenBaseretPaaField
        ).bind().address,
      },
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregnesUdFra' },
      ],
    });
  }

  if (beregnesUdFra === 'Angivet månedsløn' || beregnesUdFra === 'Angivet dagsløn') {
    const loenLabel = beregnesUdFra === 'Angivet månedsløn' ? 'månedsløn' : 'dagsløn';
    const opreguleresLabel = `Det angivne beløb afspejler ${loenLabel}en den`;

    const opreguleresFraISO = resolveAnvendtReguleringsdato({
      beregnesUdFra: values.beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
      saerligFraDatoRegulering: undefined,
      beregningsperiodeTil: values.tafBeregningsperiodeTil,
      skadedato: stamdataValues.skadedato,
    });
    const opreguleresFraDisplay = opreguleresFraISO ? isoToDanish(opreguleresFraISO) : undefined;

    const hasMissingRequired = !opreguleresFraISO;

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
