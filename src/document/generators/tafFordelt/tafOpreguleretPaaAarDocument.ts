/**
 * PDF Generator for TAF opreguleret til beregningsåret
 *
 * Viser tabt arbejdsfortjeneste opbygget i samme stil som den almindelige
 * erstatningsopgørelse-PDF, men hvor TAF-kravet beregnes individuelt for hvert
 * kalenderår og dernæst opreguleres til beregningsårets prisniveau. De opregulerede
 * årsbeløb summeres til sidst til ét samlet krav.
 *
 * Fælles top (Status, Erstatningsperiode, Beregningsgrundlag, Forventet indkomst-
 * introtekst) vises én gang. Herefter ét afsnit pr. kalenderår med understregede
 * underafsnit (Forventet indkomst, Indtægter i erstatningsperioden, Beregnet krav,
 * Opreguleret til beregningsåret). Til sidst medtages præcis de samme bilag som i den
 * almindelige erstatningsopgørelse-PDF (gated på de samme valgte elementer).
 *
 * Opreguleringen følger den akkumulerede reguleringssats ("tilpasningsprocenten
 * plus to procent") — samme metode som fremskrivning af årsløn til EET efter EAL
 * og regulering af offentlige ydelser.
 *
 * Dokumentet genererer kun fra et præ-projiceret snapshot-dokument.
 * Eventuel fail-closed / blokering er allerede afgjort før denne generator kaldes.
 */

import { createStandardPdfWriter } from '../../writer';
import { ensureNonBreakingKr } from '../../layout/pdfTextUtils';
import { type BrevhovedData } from '../../layout/documentLayoutHelpers';
import { PDF_BASE_LINE_HEIGHT_MM, PDF_AMOUNT_RIGHT_COLUMN_WIDTH_MM } from '../../layout/pdfConfig';
import { logWarning } from '../../../utils/logger';
import { formatIsoDateLong as formatDateLong, formatISOToDanish as formatDateShort } from '../../../utils/dateFormatting';
import {
  formatCountWithUnit,
  formatCurrencyFromOre,
  formatMaanederTrimmed,
  formatMoneyOreWithKr,
  formatReguleringFactorText,
  isSingularCount,
  resolveDocumentArtifactFileName,
} from '../../layout/documentFormatUtils';
import { parseOptionalIsoDate } from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { resolveLoenSkadedatoText } from '../../../domain/erstatningsopgoerelse/engines/reguleringsPresentation';
import type { Calculable, MoneyOre } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { MidlertidigtEetAfgoerelseGroup } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import type { SelectedElements } from '../eo/types';
import { renderEoBilagSections } from '../eo/sections/eoBilagSections';
import {
  renderTafBeregningsgrundlag,
  resolveTafForventetIndkomstIntroText,
} from '../eo/sections/tafBeregningsgrundlagSection';
import type { TafPerYearOpreguleretDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearOpreguleretDocument';

const NBSP = '\u00A0';
const FILE_BASE_NAME = 'TAF opreguleret til beregningsår';
const TAF_RIGHT_COLUMN_WIDTH = PDF_AMOUNT_RIGHT_COLUMN_WIDTH_MM;

// NOTE: Årsbeløb må være negative; PDF viser de beregnede værdier direkte.

interface TafOpreguleretPaaAarPdfOptions {
  document: TafPerYearOpreguleretDocument;
  visBrevhoved?: boolean;
  visUdkastStempel?: boolean;
  /** Valgfri – kræves kun for at medtage bilag (samme som den almindelige EO-PDF). */
  eoValues?: ErstatningsopgoerelseValues;
  stamdataValues?: StamdataValues;
  selectedElements?: SelectedElements;
  midlertidigtEetGroups?: readonly MidlertidigtEetAfgoerelseGroup[];
}

export const generateTafOpreguleretPaaAarDocument = (
  options: TafOpreguleretPaaAarPdfOptions
): void => {
  const { visBrevhoved = false, visUdkastStempel = false } = options;
  const { model, presentation, opreguleret } = options.document;
  const { eoValues, stamdataValues, selectedElements, midlertidigtEetGroups } = options;

  const titel = 'TAF opreguleret til beregningsår';

  const writer = createStandardPdfWriter({
    visUdkastStempel,
    onLayoutFallback: ({ message, label }) => {
      logWarning('PDF-layout fallback aktiveret', {
        context: 'pdf.tafOpreguleretPaaAar.layout',
        data: { message, label },
      });
    },
  });
  writer.setDisplayMode('fullheight');

  writer.setProperties({
    title: titel,
    subject: 'Erstatningsberegning',
    author: 'Mineo',
    creator: 'mineo.dk',
  });

  const lineHeight = PDF_BASE_LINE_HEIGHT_MM;
  const rightMaxWidth = writer.getTextWidth('000.000.000,00');

  // Lokale tekst-hjælpere på linje med den almindelige EO-PDF (samme signatur).
  const safeAddLeftRightText = (
    leftText: string,
    rightText: string,
    minRightWidth: number,
    options?: Readonly<{
      leftFontStyle?: 'normal' | 'bold';
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
    }>
  ) => {
    writer.writeLeftRightText(leftText, rightText, {
      ...options,
      minRightColumnWidth: Math.max(minRightWidth, TAF_RIGHT_COLUMN_WIDTH),
    });
  };
  const renderMoneyWithKr = (value: Calculable<MoneyOre>): string =>
    value.status === 'ok' ? `${formatCurrencyFromOre(value.value)}${NBSP}kr.` : '—';
  // Beregningsgrundlag-lønnen er gated fail-closed i snapshot-projektionen
  // (tafBeregningsgrundlagAngivetLoenMangler) — den er altid 'ok', når vi når hertil.
  // Skulle den mod forventning ikke være det, kaster vi (systemfejl routes via A5) frem for
  // at udskrive en teknisk fejlkode i et tillidskritisk dokument.
  const renderMoneyWithKrOrError = (value: Calculable<MoneyOre>): string => {
    if (value.status !== 'ok') {
      throw new Error(`Beregningsgrundlag-løn ikke beregnelig ved dokument-rendering: ${value.reason}`);
    }
    return `${formatCurrencyFromOre(value.value)}${NBSP}kr.`;
  };

  // Udkast-stempel på første side
  writer.addUdkastWatermark();

  // Brevhoved
  if (visBrevhoved && model.brevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: model.brevhoved.journalnr,
      advokat: model.brevhoved.advokat,
      sagsbehandler: model.brevhoved.sagsbehandler,
      dagsDatoISO: model.brevhoved.dagsDatoISO,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  // Titel
  writer.writeTitle(titel, { trailingSpacing: 0 });

  // Erstatningsperiode
  if (model.periodeDisplay) {
    writer.writeWrappedText(model.periodeDisplay);
    writer.addSectionSpacer();
  }

  // Skadelidtes navn (fed)
  if (model.skadelidteNavn) {
    writer.writeBoldWrappedText(model.skadelidteNavn);
  }

  // Skadestype (normal)
  if (model.skadestypeLinje) {
    writer.writeWrappedText(model.skadestypeLinje);
    writer.addSectionSpacer();
  }

  const finishAndSave = () => {
    writer.addFooter();
    writer.save(resolveDocumentArtifactFileName(FILE_BASE_NAME, visUdkastStempel, model.brevhoved?.journalnr));
  };

  // ─── Tabt arbejdsfortjeneste sektion (fælles top) ─────────────────────

  writer.writeSectionHeader('Tabt arbejdsfortjeneste');

  writer.writeBoldSubheaderIfContent({
    text: 'Status',
    hasContent:
      model.tabtArbejdsfortjeneste.statusLinjer.length > 0 ||
      model.tabtArbejdsfortjeneste.eetLinjer.length > 0 ||
      model.tabtArbejdsfortjeneste.differencekravLinje !== null,
    renderContent: () => {
      for (const line of model.tabtArbejdsfortjeneste.statusLinjer) {
        writer.writeWrappedText(line);
      }
      if (model.tabtArbejdsfortjeneste.differencekravLinje) {
        writer.writeWrappedText(model.tabtArbejdsfortjeneste.differencekravLinje);
      }
      for (const line of model.tabtArbejdsfortjeneste.eetLinjer) {
        writer.writeWrappedText(line);
      }
    },
  });

  // TAF-perioder
  const tafPeriodeHeader = model.tabtArbejdsfortjeneste.tafPerioderLinjer.length > 1
    ? 'Erstatningsperioder med tabt arbejdsfortjeneste'
    : 'Erstatningsperiode med tabt arbejdsfortjeneste';
  writer.writeBoldSubheader(tafPeriodeHeader);
  if (!model.tabtArbejdsfortjeneste.harTafPerioder) {
    writer.writeWrappedText('Ingen');
    writer.writeBoldSubheader('TAF opreguleret til beregningsåret');
    writer.writeWrappedText('Ingen');
    finishAndSave();
    return;
  }
  for (const line of model.tabtArbejdsfortjeneste.tafPerioderLinjer) {
    writer.writeWrappedText(line);
  }

  if (model.forlig.erIndgaaet) {
    writer.writeBoldSubheader('Forlig');
    const forligDatoTekst = model.forlig.dato ? `den ${formatDateLong(model.forlig.dato)}` : null;
    const forligTekst = forligDatoTekst
      ? `Der er ${forligDatoTekst} indgået forlig i sagen på betaling af ${model.forlig.label}.`
      : `Der er indgået forlig i sagen på betaling af ${model.forlig.label}.`;
    writer.writeWrappedText(forligTekst);
  }

  if (!presentation || !opreguleret) {
    writer.writeBoldSubheader('TAF opreguleret til beregningsåret');
    writer.writeWrappedText('TAF opreguleret til beregningsåret kan ikke beregnes for den valgte opsætning.');
    finishAndSave();
    return;
  }

  // Beregningsgrundlag (dagsløn/månedsløn ved skadestidspunktet) – fælles for alle år.
  renderTafBeregningsgrundlag({
    model,
    lineHeight,
    rightColumnWidth: TAF_RIGHT_COLUMN_WIDTH,
    rightMaxWidth,
    NBSP,
    renderSubheader: writer.writeBoldSubheader,
    safeAddWrappedText: writer.writeWrappedText,
    safeAddLeftRightText,
    renderMoneyWithKr,
    renderMoneyWithKrOrError,
    formatMoneyOreWithKr,
    formatCurrencyFromOre,
    formatCountWithUnit,
    formatMaanederTrimmed,
    isSingularCount,
    writer,
  });

  // Forventet indkomst-introtekst – fælles for alle år (kan kun beregnes med rå-input).
  if (eoValues && stamdataValues) {
    const introTekst = resolveTafForventetIndkomstIntroText({
      model,
      eoValues,
      stamdataValues,
      parseOptionalIsoDate,
      resolveLoenSkadedatoText,
      formatDateLong,
    });
    // Løn- og offentlige-ydelser-sætningerne (adskilt af \n) skrives som separate afsnit,
    // så de får samme normale afsnits-linjeafstand (B5.2) som ferie-/fravær-linjen nedenfor —
    // ens med EO-opgørelsens "Forventet indkomst".
    writer.writeBoldSubheader('Forventet indkomst');
    for (const afsnit of introTekst.split('\n')) {
      writer.writeWrappedText(afsnit);
    }
    if (model.tabtArbejdsfortjeneste.ferieFravaerLinje) {
      writer.writeWrappedText(model.tabtArbejdsfortjeneste.ferieFravaerLinje);
    }
  }

  const beregningsAar = opreguleret.beregningsAar;
  const opreguleretByYear = new Map(opreguleret.years.map((entry) => [entry.year, entry] as const));

  // ─── Beregning pr. kalenderår ─────────────────────────────────────────

  for (const yearEntry of presentation.years) {
    writer.writeSectionHeader(`${yearEntry.year}`);

    // Forventet indkomst (årets løn-/ydelsessegmenter).
    writer.writeUnderlinedSubheader('Forventet indkomst');
    if (yearEntry.segments.length === 0) {
      writer.writeWrappedText('Ingen');
    }
    for (const segment of yearEntry.segments) {
      const factorText = formatReguleringFactorText(segment.deltaPct);
      let leftText = '';
      if (segment.kind === 'arbejdsdage') {
        const arbejdsdageText = formatCountWithUnit(segment.quantity, 'arbejdsdag', 'arbejdsdage');
        const dagsloenText = formatCurrencyFromOre(segment.unitAmountOre);
        leftText = `${formatDateShort(segment.fra)} - ${formatDateShort(segment.til)}: ${arbejdsdageText} á ${dagsloenText}${NBSP}kr.${factorText} =`;
      } else {
        const maanederText = `${formatMaanederTrimmed(segment.quantity)} ${isSingularCount(segment.quantity) ? 'måned' : 'måneder'}`;
        const maanedsloenText = formatCurrencyFromOre(segment.unitAmountOre);
        leftText = `${formatDateShort(segment.fra)} - ${formatDateShort(segment.til)}: ${maanederText} á ${maanedsloenText}${NBSP}kr.${factorText} =`;
      }
      const rightText = ensureNonBreakingKr(formatMoneyOreWithKr(segment.amountOre));
      safeAddLeftRightText(leftText, rightText, rightMaxWidth, { rightFontStyle: 'normal' });
    }
    if (yearEntry.segments.length > 1) {
      const indkomstIAltText = ensureNonBreakingKr(formatMoneyOreWithKr(yearEntry.yearIncomeOre));
      safeAddLeftRightText('I alt', indkomstIAltText, rightMaxWidth, {
        rightFontStyle: 'normal',
        lineAboveRightWidth: TAF_RIGHT_COLUMN_WIDTH,
        lineAboveRightOffset: 4,
      });
    }

    // Indtægter i erstatningsperioden (årets fradrag).
    writer.writeUnderlinedSubheader('Indtægter i erstatningsperioden');
    if (yearEntry.deductions.length === 0) {
      writer.writeWrappedText('Ingen');
    }
    for (const deduction of yearEntry.deductions) {
      const rightText = ensureNonBreakingKr(formatMoneyOreWithKr(deduction.amountOre));
      safeAddLeftRightText(deduction.label, rightText, rightMaxWidth, { rightFontStyle: 'normal' });
    }
    if (yearEntry.deductions.length > 1) {
      const fradragIAltText = ensureNonBreakingKr(formatMoneyOreWithKr(yearEntry.yearDeductionsOre));
      safeAddLeftRightText('I alt', fradragIAltText, rightMaxWidth, {
        rightFontStyle: 'normal',
        lineAboveRightWidth: TAF_RIGHT_COLUMN_WIDTH,
        lineAboveRightOffset: 4,
      });
    }

    // Beregnet krav for året (fuld udregningslinje, som i den almindelige EO-PDF).
    writer.writeUnderlinedSubheader('Beregnet krav');
    const positiveLed = formatCurrencyFromOre(yearEntry.yearIncomeOre);
    const fradragLed = yearEntry.deductions.map((deduction) => formatCurrencyFromOre(deduction.amountOre));
    const expressionText = `${positiveLed}${fradragLed.length > 0 ? ` - ${fradragLed.join(' - ')}` : ''}${NBSP}kr.`;
    const beregnetKravLeftText = model.forlig.erIndgaaet
      ? `${model.forlig.label} x (${expressionText}) =`
      : `${expressionText} =`;
    const beregnetKravRightText = ensureNonBreakingKr(formatMoneyOreWithKr(yearEntry.yearTafOre));
    safeAddLeftRightText(beregnetKravLeftText, beregnetKravRightText, rightMaxWidth, { rightFontStyle: 'normal' });

    // Opregulering til beregningsåret.
    const opreguleretEntry = opreguleretByYear.get(yearEntry.year);
    if (opreguleretEntry) {
      writer.writeUnderlinedSubheader('Opreguleret til beregningsåret');
      const factorText = formatReguleringFactorText(opreguleretEntry.deltaPct);
      const opreguleretLeftText = `Opreguleret til ${beregningsAar}${factorText} =`;
      const opreguleretRightText = ensureNonBreakingKr(formatMoneyOreWithKr(opreguleretEntry.yearTafOpreguleretOre));
      safeAddLeftRightText(opreguleretLeftText, opreguleretRightText, rightMaxWidth, { rightFontStyle: 'bold' });
    }
  }

  // ─── Samlet ──────────────────────────────────────────────────────────

  writer.writeSectionHeader('Samlet');

  // Per-år linjer (opregulerede beløb)
  for (const opreguleretEntry of opreguleret.years) {
    const rightText = ensureNonBreakingKr(formatMoneyOreWithKr(opreguleretEntry.yearTafOpreguleretOre));
    safeAddLeftRightText(`${opreguleretEntry.year}`, rightText, rightMaxWidth, { rightFontStyle: 'normal' });
  }

  // Samlet opreguleret TAF-krav (fed, med streg)
  const samletText = ensureNonBreakingKr(formatMoneyOreWithKr(opreguleret.sumOpreguleretOre));
  safeAddLeftRightText(`Samlet TAF opreguleret til ${beregningsAar}`, samletText, rightMaxWidth, {
    rightFontStyle: 'bold',
    lineAboveRightWidth: TAF_RIGHT_COLUMN_WIDTH,
    lineAboveRightOffset: 4,
  });

  // ─── Bilag (samme som den almindelige erstatningsopgørelse-PDF) ───────

  if (eoValues && stamdataValues && selectedElements) {
    renderEoBilagSections({
      writer,
      model,
      eoValues,
      stamdataValues,
      selectedElements,
      midlertidigtEetGroups,
    });
  }

  finishAndSave();
};
