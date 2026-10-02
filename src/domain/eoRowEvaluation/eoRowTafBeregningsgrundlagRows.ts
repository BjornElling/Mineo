import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { isoToDanish, dateToISO, isISODateString, parseISODate } from '../../types/branded';
import { formatCurrency } from '../../utils/formatUtils';
import { addDays } from '../../utils/dateUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { presentIssuesForRow, resolveEoRowDisplay, summarizeFieldErrorsForEoRow } from './eoRowCommon';
import { isNonEmptyString } from '../erstatningsopgoerelse/validation/eoDateRangeMessages';
import type { EoRowModel, EoRowStatus } from './eoRowTypes';
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
import { activeFieldIssue } from '../../inputCore/inputIssue';
import { serializeFieldAddress } from '../../inputCore/fieldAddress';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import {
  eoAngivetDagsloenBaseretPaaField,
  eoAngivetMaanedsloenBaseretPaaField,
  eoDagsloenenUdgoerField,
  eoFravaerPeriodeFraField,
  eoFravaerPeriodeTilField,
  eoMaanedsloenenUdgoerField,
  eoOevrigeFravaersdageField,
  eoTafBeregningsperiodeFraField,
  eoUspecificeredeFerieFridageField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { isPeriodOverlapIssue } from '../erstatningsopgoerelse/periodOverlapIssues';
import { evaluateFerieperioder } from '../erstatningsopgoerelse/validation/ferieperiodeValidation';
import { BEREGNINGSPERIODE_FERIE_OVERLAP_LINJE, TAF_LOSE_FERIEDAGE_LABEL } from '../erstatningsopgoerelse/validation/tafRowRules';
import {
  evaluateBeregningsgrundlagFradragAdvarsel,
  INGEN_INDKOMST_I_BEREGNINGSPERIODEN_MESSAGE,
  resolveBeregningsgrundlagFradrag,
} from '../erstatningsopgoerelse/validation/beregningsgrundlagFradragRules';
import {
  OEVRIGE_FRAVAERSDAGE_ER_NUL_MESSAGE,
  OEVRIGE_FRAVAERSDAGE_IKKE_ANGIVET_MESSAGE,
  OEVRIGT_FRAVAER_AARSAG_IKKE_UDFYLDT_MESSAGE,
  resolveAngivetLoenAdvarsel,
} from '../erstatningsopgoerelse/validation/beregningsgrundlagFeltAdvarsler';
import {
  buildBeregningsperiodeIndkomstHullerMessage,
  resolveBeregningsperiodeIndkomstHuller,
} from '../erstatningsopgoerelse/validation/beregningsperiodeIndkomstHuller';

export const buildEoTafBeregningsgrundlagRows = (
  values: ErstatningsopgoerelseValues,
  errors: ErstatningsopgoerelseFieldIssues,
  stamdataValues: PersistedSectionMap['stamdata']
): EoRowModel[] => {
  const rows: EoRowModel[] = [];

  const tafBeregnesSom = computeTafBeregningsenhed(values);
  const cellIssue = <T,>(descriptor: FieldDescriptor<T>, rowId: string) =>
    activeFieldIssue(errors, serializeFieldAddress(descriptor.bind(rowId).address));

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

  // Overlappet med en TAF-periode farver begge datoer (BB-262), men har sin egen linje nedenfor; her kom det
  // ellers med to gange i samme linje (én pr. dato).
  const periodeIssues = (field: 'tafBeregningsperiodeFra' | 'tafBeregningsperiodeTil') =>
    presentIssuesForRow(topLevelFieldIssue(errors, 'erstatningsopgoerelse', field))
      .filter((issue) => !isPeriodOverlapIssue(issue));
  const periodeFraErrors = periodeIssues('tafBeregningsperiodeFra');
  const periodeTilErrors = periodeIssues('tafBeregningsperiodeTil');
  const hasPeriodeErrors = periodeFraErrors.length > 0 || periodeTilErrors.length > 0;
  const hasPeriodeErrorSeverity = periodeFraErrors.concat(periodeTilErrors).some((e) => e.severity === 'error');

  // Beregnes én gang: rækkens linje og gyldigheden af perioden nedenfor læser samme svar.
  const beregningsperiodeOverlap = computeTafOverlapWithBeregningsperiode({
    beregningsperiode: { fra: periodeFra, til: periodeTil },
    tafPerioder: (values.tafPerioder ?? []).map((periode) => ({
      id: periode.id,
      fra: periode.fra,
      til: periode.til,
    })),
  });

  const periodeErrorValue = (() => {
    if (!hasPeriodeErrors) return undefined;

    const parts: string[] = [];
    const fraBeskeder = periodeFraErrors.map((e) => e.message.trim());
    const tilBeskeder = periodeTilErrors.map((e) => e.message.trim());
    // En regel om HELE perioden (fx «Beregningsperioden indeholder ingen arbejdsdage») står på begge datoer;
    // den siges én gang og uden «Fra og med»/«Til og med».
    const faelles = fraBeskeder.filter((message) => tilBeskeder.includes(message));
    parts.push(...faelles);
    for (const message of fraBeskeder) {
      if (!faelles.includes(message)) parts.push(`Fra og med: ${message}`);
    }
    for (const message of tilBeskeder) {
      if (!faelles.includes(message)) parts.push(`Til og med: ${message}`);
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

    if (beregningsperiodeOverlap.firstOverlapMessage) {
      return { displayValue: `Fejl (${beregningsperiodeOverlap.firstOverlapMessage})`, status: 'error' as EoRowStatus };
    }

    const fraDanish = isoToDanish(periodeFra);
    const tilDanish = isoToDanish(periodeTil);
    if (!fraDanish || !tilDanish) {
      return { displayValue: 'Fejl (Ugyldig dato)', status: 'error' as EoRowStatus };
    }

    return { displayValue: `${fraDanish} - ${tilDanish}`, status: 'ok' as EoRowStatus };
  })();

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
        message: INGEN_INDKOMST_I_BEREGNINGSPERIODEN_MESSAGE,
        status: 'error' as EoRowStatus,
      };
    }
    return {
      label: 'Indkomst',
      displayValue: '-',
      message: `${INGEN_INDKOMST_I_BEREGNINGSPERIODEN_MESSAGE} (${fraDanish} - ${tilDanish})`,
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

  // Perioder uden hverken løn eller ydelse udtynder månedslønnen tavst (BB-260). Linjen er gul og fører til
  // Lønindkomst – til det første ansættelsesforhold, eller til perioden, når der kun er ydelser.
  const indkomstHuller = isBeregningsperiode && beregningsperiodeRangeOk
    ? resolveBeregningsperiodeIndkomstHuller(values)
    : [];
  if (indkomstHuller.length > 0) {
    const foersteAnsaettelse = values.loenindkomstAnsaettelsesforhold[0];
    const message = buildBeregningsperiodeIndkomstHullerMessage(indkomstHuller);
    rows.push({
      id: foersteAnsaettelse === undefined
        ? 'taf.beregningsgrundlag.indkomstHuller'
        : `loenindkomst.${foersteAnsaettelse.id}.indkomstHuller`,
      ...(foersteAnsaettelse === undefined ? {} : { employmentId: foersteAnsaettelse.id }),
      label: 'Indkomst',
      displayValue: `Advarsel (${message})`,
      status: 'warning',
      message,
      summaryDisplay: 'messageOnly',
      focusTarget: foersteAnsaettelse === undefined
        ? { kind: 'fieldAddress', address: eoTafBeregningsperiodeFraField.bind().address }
        : { kind: 'rowId', rowId: foersteAnsaettelse.id },
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregningsperiode' },
      ],
    });
  }

  const fravaerPerioder = values.fravaerPerioder ?? [];
  // Beregningsperiodens ferie og løse dage vises og vurderes kun, hvor de virker: i arbejdsdage. I måneder
  // fradrages de ikke, og readeren giver dem som tomme (BB-263).
  const shouldIncludeFravaer = isBeregningsperiode && tafBeregnesSom === TAF_BEREGNES_SOM.ARBEJDSDAGE;
  // Rækkens linje samler dens røde celler (vinduet, overlappet og en ferie over hele perioden projekteres i
  // `beregningsgrundlagCellIssues.ts`) og dens manglende datoer, med rækkens navn og link til cellen – samme
  // skabelon som TAF-afsnittets ferie (BB-264). Før stod reglerne her uden feltadresse og farvede ingen celle.
  const ferieEvaluations = evaluateFerieperioder(fravaerPerioder, (rowId) => ({
    fra: cellIssue(eoFravaerPeriodeFraField, rowId),
    til: cellIssue(eoFravaerPeriodeTilField, rowId),
  }), BEREGNINGSPERIODE_FERIE_OVERLAP_LINJE);
  const harFravaer = shouldIncludeFravaer
    && fravaerPerioder.some((periode) => ferieEvaluations.get(periode.id)?.kind !== 'skip');
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
      const evaluation = ferieEvaluations.get(periode.id) ?? { kind: 'ok' as const };
      if (evaluation.kind === 'skip') return;

      if (evaluation.kind === 'error') {
        rows.push({
          id: `taf.beregningsgrundlag.ferie.${periode.id}`,
          label: 'Ferieperiode',
          displayValue: `Fejl (${evaluation.message})`,
          status: 'error',
          ...(evaluation.field === undefined ? {} : { focusFieldHint: evaluation.field }),
        });
        return;
      }

      const fraDanish = periode.fra ? isoToDanish(periode.fra) : undefined;
      const tilDanish = periode.til ? isoToDanish(periode.til) : undefined;
      if (!periode.fra || !periode.til || !fraDanish || !tilDanish) {
        rows.push({
          id: `taf.beregningsgrundlag.ferie.${periode.id}`,
          label: 'Ferieperiode',
          displayValue: 'Fejl (Ugyldig dato)',
          status: 'error',
        });
        return;
      }

      const feriedage = calculateFerieHverdageMinusSHDage(periode.fra, periode.til);
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
  if (shouldIncludeFravaer) {
    // Feltets egen fejl (loftet, eller at der skal være en arbejdsdag tilbage) står på rækken (BB-264). Før var
    // rækken altid `ok`, og reglen kom kun frem gennem sikkerhedsnettet, når intet andet var galt (BB-265).
    const summary = summarizeFieldErrorsForEoRow(
      topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'uspecificeredeFerieFridage'),
    );
    rows.push({
      id: 'taf.beregningsgrundlag.uspecificeredeFerieFridage',
      label: TAF_LOSE_FERIEDAGE_LABEL,
      displayValue: summary?.displayValue
        ?? (typeof uspecificeredeFerie === 'number' ? `${formatRowCount(uspecificeredeFerie)} dage` : '-'),
      status: summary?.status ?? 'ok',
    });
  }

  if (isBeregningsperiode) {
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
    // En rød værdi er tom for readeren; feltets egen fejl skal da stå frem for «ikke angivet».
    const summary = summarizeFieldErrorsForEoRow(
      topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'oevrigeFravaersdage'),
    );
    if (summary) return { ...summary, message: undefined };
    if (oevrigeFravaersdage === undefined) {
      return {
        displayValue: `Fejl (${OEVRIGE_FRAVAERSDAGE_IKKE_ANGIVET_MESSAGE})`,
        status: 'error' as EoRowStatus,
        message: OEVRIGE_FRAVAERSDAGE_IKKE_ANGIVET_MESSAGE,
      };
    }
    if (oevrigeFravaersdage === 0) {
      return {
        displayValue: 'Advarsel (Antal fraværsdage er 0)',
        status: 'warning' as EoRowStatus,
        message: OEVRIGE_FRAVAERSDAGE_ER_NUL_MESSAGE,
      };
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
      summaryDisplay: oevrigeFravaersdageDisplay.message !== undefined ? 'messageOnly' : undefined,
    });
  }

  const oevrigeFravaerBeskrivelse = values.oevrigeFravaersdageBeskrivelse?.trim() ?? '';
  const oevrigeFravaerBeskrivelseDisplay = (() => {
    if (!oevrigtFravaerAktivt) return { displayValue: '-', status: 'ok' as EoRowStatus };
    if (oevrigeFravaerBeskrivelse === '') {
      return { displayValue: 'Advarsel (Årsag er ikke udfyldt)', status: 'warning' as EoRowStatus };
    }
    return { displayValue: oevrigeFravaerBeskrivelse, status: 'ok' as EoRowStatus };
  })();

  if (oevrigtFravaerAktivt) {
    rows.push({
      id: 'taf.beregningsgrundlag.oevrigeFravaersdageBeskrivelse',
      // Skærmens tekst (BB-270); rækken hed «Beskrivelse», og boksen «Beskrivelse af fravær».
      label: 'Årsag til fravær',
      displayValue: oevrigeFravaerBeskrivelseDisplay.displayValue,
      status: oevrigeFravaerBeskrivelseDisplay.status,
      message: oevrigeFravaerBeskrivelseDisplay.status === 'warning' ? OEVRIGT_FRAVAER_AARSAG_IKKE_UDFYLDT_MESSAGE : undefined,
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
    const displayValue = `${formatRowCount(samletArbejdsdage)} ${samletArbejdsdage === 1 ? 'arbejdsdag' : 'arbejdsdage'}`;

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
        { kind: 'id', id: 'taf.beregningsgrundlag.uspecificeredeFerieFridage' },
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
      // Fraværet er sin egen række; uden afhængigheden meldte «Måneder» samme mangel en gang til (BB-269).
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregningsperiode' },
        { kind: 'id', id: 'taf.beregningsgrundlag.oevrigeFravaersdage' },
      ],
    });
  }

  // Næsten intet tilbage efter fradragene (BB-259): ikke-blokerende, med samme tekst som feltets gule ring.
  // Linket fører til det første indtastede fradrag; er det kun ferien, til ferietabellens første række.
  const fradragAdvarsel = evaluateBeregningsgrundlagFradragAdvarsel(
    resolveBeregningsgrundlagFradrag(values, tafBeregnesSom),
  );
  if (fradragAdvarsel !== undefined) {
    const foersteFelt = fradragAdvarsel.felter.find((felt) => felt !== 'ferie');
    const foersteFerie = fravaerPerioder.find((periode) => periode.fra !== undefined || periode.til !== undefined);
    const focusAddress = foersteFelt === 'loseFeriedage'
      ? eoUspecificeredeFerieFridageField.bind().address
      : foersteFelt === 'fravaersdage'
        ? eoOevrigeFravaersdageField.bind().address
        : foersteFerie === undefined
          ? eoTafBeregningsperiodeFraField.bind().address
          : eoFravaerPeriodeFraField.bind(foersteFerie.id).address;
    rows.push({
      id: 'taf.beregningsgrundlag.fradragAdvarsel',
      label: 'Fradrag i beregningsperioden',
      displayValue: `Advarsel (${fradragAdvarsel.message})`,
      status: 'warning',
      message: fradragAdvarsel.message,
      summaryDisplay: 'messageOnly',
      focusTarget: { kind: 'fieldAddress', address: focusAddress },
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregningsperiode' },
      ],
    });
  }

  if (beregnesUdFra === 'Angivet månedsløn') {
    const maanedsloenDisplay = (() => {
      const summary = summarizeFieldErrorsForEoRow(topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'maanedsloenenUdgoer'));
      if (summary) return summary;
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
      ...(maanedsloenDisplay.displayValue === 'Fejl (Månedsløn er ikke angivet)'
        ? { message: 'Månedsløn er ikke angivet', summaryDisplay: 'messageOnly' as const }
        : {}),
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregnesUdFra' },
      ],
    });
  }

  if (beregnesUdFra === 'Angivet dagsløn') {
    const dagsloenDisplay = (() => {
      const summary = summarizeFieldErrorsForEoRow(topLevelFieldIssue(errors, 'erstatningsopgoerelse', 'dagsloenenUdgoer'));
      if (summary) return summary;
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
      ...(dagsloenDisplay.displayValue === 'Fejl (Dagsløn er ikke angivet)'
        ? { message: 'Dagsløn er ikke angivet', summaryDisplay: 'messageOnly' as const }
        : {}),
      dependsOn: [
        { kind: 'id', id: 'taf.beregningsgrundlag.beregnesUdFra' },
      ],
    });
  }

  // En dagsløn, der ligner en månedsløn, og omvendt (BB-268): gul ring på beløbet og samme tekst her.
  const angivetLoenAdvarsel = resolveAngivetLoenAdvarsel(values);
  if (angivetLoenAdvarsel !== undefined) {
    rows.push({
      id: 'taf.beregningsgrundlag.angivetLoenAdvarsel',
      label: beregnesUdFra === 'Angivet dagsløn' ? 'Dagslønnen udgør' : 'Månedslønnen udgør',
      displayValue: `Advarsel (${angivetLoenAdvarsel})`,
      status: 'warning',
      message: angivetLoenAdvarsel,
      summaryDisplay: 'messageOnly',
      focusTarget: {
        kind: 'fieldAddress',
        address: (beregnesUdFra === 'Angivet dagsløn' ? eoDagsloenenUdgoerField : eoMaanedsloenenUdgoerField).bind().address,
      },
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
      // Skærmens tekst uden den visuelle tankestreg; ellers citerede boksen «'- baseret på' er ikke angivet» (BB-270).
      label: 'Baseret på',
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
    // Bestemt form skrevet ud: en bøjning ved sammensætning gav «månedslønen» (BB-271).
    const loenLabel = beregnesUdFra === 'Angivet månedsløn' ? 'månedslønnen' : 'dagslønnen';
    const opreguleresLabel = `Det angivne beløb afspejler ${loenLabel} den`;

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
