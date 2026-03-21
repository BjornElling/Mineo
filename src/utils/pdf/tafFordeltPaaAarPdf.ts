/**
 * PDF Generator for TAF fordelt på kalenderår
 *
 * Viser tabt arbejdsfortjeneste brudt ned per kalenderår.
 * Genbruger alle beregningsprincipper fra EO-modellen.
 * Årsbeløb er præsentation – samlet TAF-krav er autoritativt.
 * Dokumentet genererer kun fra et præ-projiceret snapshot-dokument.
 * Eventuel fail-closed / blokering er allerede afgjort før denne generator kaldes.
 */

import { createStandardPdfWriter } from './pdfWriter';
import { ensureNonBreakingKr } from './pdfTextUtils';
import { PDF_FONT_FAMILY, PDF_FONT_STYLES } from './pdfConfig';
import { PDF_TITLE_BOTTOM_SPACING_MM, type BrevhovedData } from './pdfHelpers';
import { roundByMethod } from '../rounding';
import { logWarning } from '../logger';
import { formatIsoDateLong as formatDateLong } from '../dateFormatting';
import {
  formatCountWithUnit,
  formatCurrencyFromOre,
  formatMaanederTrimmed,
  formatMoneyOreWithKr,
  formatPercentDelta,
  isSingularCount,
  resolvePdfFileName,
} from './pdfFormatUtils';
import type { TafPerYearPdfDocument } from '../../domain/erstatningsopgoerelse/eoSnapshotToTafPerYearPdfDocument';

const NBSP = '\u00A0';
const FILE_BASE_NAME = 'Tabt arbejdsfortjeneste fordelt på år';
const TAF_RIGHT_COLUMN_WIDTH = 33.125;

// NOTE: Årsbeløb må være negative; PDF viser de beregnede værdier direkte.

interface TafFordeltPaaAarPdfOptions {
  document: TafPerYearPdfDocument;
  visBrevhoved?: boolean;
  visUdkastStempel?: boolean;
}

export const generateTafFordeltPaaAarPdf = (
  options: TafFordeltPaaAarPdfOptions
): void => {
  const { visBrevhoved = false, visUdkastStempel = false } = options;
  const lineHeight = 5;
  const { model, presentation } = options.document;

  const titel = 'Tabt arbejdsfortjeneste fordelt på år';

  const writer = createStandardPdfWriter({
    visUdkastStempel,
    onLayoutFallback: (message: string) => {
      logWarning('PDF-layout fallback aktiveret', {
        context: 'pdf.tafFordeltPaaAar.layout',
        data: { message },
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
  writer.writeTitle(titel);
  writer.advanceY(-(PDF_TITLE_BOTTOM_SPACING_MM - lineHeight));

  // Erstatningsperiode
  writer.setNormalTextStyle();
  if (model.periodeDisplay) {
    writer.writeWrappedText(model.periodeDisplay);
    writer.advanceY(lineHeight);
  }

  // Skadelidtes navn (fed)
  writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.bold);
  if (model.skadelidteNavn) {
    writer.writeWrappedText(model.skadelidteNavn);
  }

  // Skadestype (normal)
  writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
  if (model.skadestypeLinje) {
    writer.writeWrappedText(model.skadestypeLinje);
    writer.advanceY(lineHeight);
  }

  // ─── Tabt arbejdsfortjeneste sektion ──────────────────────────────────

  writer.writeSectionHeader('Tabt arbejdsfortjeneste', lineHeight);

  // Status
  writer.writeSubheader('Status', lineHeight);
  writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
  for (const line of model.tabtArbejdsfortjeneste.statusLinjer) {
    writer.writeWrappedText(line);
  }
  for (const line of model.tabtArbejdsfortjeneste.eetLinjer) {
    writer.writeWrappedText(line);
  }
  if (model.tabtArbejdsfortjeneste.differencekravLinje) {
    writer.writeWrappedText(model.tabtArbejdsfortjeneste.differencekravLinje);
  }

  // TAF-perioder
  const tafPeriodeHeader = model.tabtArbejdsfortjeneste.tafPerioderLinjer.length > 1
    ? 'Erstatningsperioder, hvor der beregnes tabt arbejdsfortjeneste'
    : 'Erstatningsperiode, hvor der beregnes tabt arbejdsfortjeneste';
  writer.writeSubheader(tafPeriodeHeader, lineHeight);
  if (!model.tabtArbejdsfortjeneste.harTafPerioder) {
    writer.writeWrappedText('Ingen');
    writer.writeSubheader('TAF fordelt på kalenderår', lineHeight);
    writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
    writer.writeWrappedText('Ingen');
    writer.addFooter();
    writer.save(resolvePdfFileName(FILE_BASE_NAME, visUdkastStempel, model.brevhoved?.journalnr));
    return;
  } else {
    for (const line of model.tabtArbejdsfortjeneste.tafPerioderLinjer) {
      writer.writeWrappedText(line);
    }
  }
  if (model.forlig.erIndgaaet) {
    writer.writeSubheader('Forlig', lineHeight);
    const forligDatoTekst = model.forlig.dato ? `den ${formatDateLong(model.forlig.dato)}` : null;
    const forligTekst = forligDatoTekst
      ? `Der er ${forligDatoTekst} indgået forlig i sagen på betaling af ${model.forlig.label}.`
      : `Der er indgået forlig i sagen på betaling af ${model.forlig.label}.`;
    writer.writeWrappedText(forligTekst);
  }

  if (!presentation) {
    writer.writeSubheader('TAF fordelt på kalenderår', lineHeight);
    writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
    writer.writeWrappedText('TAF fordelt på år kan ikke beregnes for den valgte opsætning.');
    writer.addFooter();
    writer.save(resolvePdfFileName(FILE_BASE_NAME, visUdkastStempel, model.brevhoved?.journalnr));
    return;
  }

  // ─── TAF fordelt på kalenderår ────────────────────────────────────────

  const rightMaxWidth = writer.getTextWidth('000.000.000,00');

  for (const yearEntry of presentation.years) {
    writer.writeSubheader(`${yearEntry.year}`, lineHeight);
    writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);

    // Segmenter (identisk format med EO-pdf)
    for (const segment of yearEntry.segments) {
      const roundedDeltaPct = roundByMethod(segment.deltaPct, 2, 'halfAwayFromZero');
      const factorText = Math.abs(roundedDeltaPct) < 0.00001
        ? ''
        : ` x (100 % ${roundedDeltaPct >= 0 ? '+' : '-'} ${formatPercentDelta(roundedDeltaPct)} %)`;
      let leftText = '';
      if (segment.kind === 'arbejdsdage') {
        const arbejdsdageText = formatCountWithUnit(segment.quantity, 'arbejdsdag', 'arbejdsdage');
        const dagsloenText = formatCurrencyFromOre(segment.unitAmountOre);
        leftText = `${arbejdsdageText} á ${dagsloenText}${NBSP}kr.${factorText} =`;
      } else {
        const maanederText = `${formatMaanederTrimmed(segment.quantity)} ${isSingularCount(segment.quantity) ? 'måned' : 'måneder'}`;
        const maanedsloenText = formatCurrencyFromOre(segment.unitAmountOre);
        leftText = `${maanederText} á ${maanedsloenText}${NBSP}kr.${factorText} =`;
      }

      const rightText = ensureNonBreakingKr(formatMoneyOreWithKr(segment.amountOre));
      writer.writeLeftRightText(leftText, rightText, { rightFontStyle: 'normal', minRightColumnWidth: rightMaxWidth });
    }

    // Fradrag (med minus-prefix)
    for (const deduction of yearEntry.deductions) {
      const rightText = ensureNonBreakingKr(`- ${formatMoneyOreWithKr(deduction.amountOre)}`);
      writer.writeLeftRightText(deduction.label, rightText, { rightFontStyle: 'normal', minRightColumnWidth: rightMaxWidth });
    }

    // I alt for året
    const iAltRightText = ensureNonBreakingKr(formatMoneyOreWithKr(yearEntry.yearTafOre));
    const iAltLeftText = (() => {
      if (!model.forlig.erIndgaaet) return 'I alt';
      const foerForligOre = yearEntry.yearTafFoerForligOre;
      return `I alt (${model.forlig.label} af ${formatMoneyOreWithKr(foerForligOre)})`;
    })();
    writer.writeLeftRightText(iAltLeftText, iAltRightText, {
      rightFontStyle: 'normal',
      lineAboveRightWidth: TAF_RIGHT_COLUMN_WIDTH,
      lineAboveRightOffset: 4,
      minRightColumnWidth: rightMaxWidth,
    });
  }

  // ─── Samlet ──────────────────────────────────────────────────────────

  writer.writeSubheader('Samlet', lineHeight);
  writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);

  // Per-år linjer
  for (const yearEntry of presentation.years) {
    const rightText = ensureNonBreakingKr(formatMoneyOreWithKr(yearEntry.yearTafOre));
    writer.writeLeftRightText(`${yearEntry.year}`, rightText, { rightFontStyle: 'normal', minRightColumnWidth: rightMaxWidth });
  }

  // Afrunding (kun vist når den ikke er 0)
  if (presentation.afrundingOre !== 0) {
    const afrundingText = ensureNonBreakingKr(formatMoneyOreWithKr(presentation.afrundingOre));
    writer.writeLeftRightText('Afrunding', afrundingText, { rightFontStyle: 'normal', minRightColumnWidth: rightMaxWidth });
  }

  // Samlet TAF-krav (fed, med streg)
  const samletText = ensureNonBreakingKr(formatMoneyOreWithKr(presentation.samletTafKravOre));
  writer.writeLeftRightText('Samlet TAF-krav', samletText, {
    rightFontStyle: 'bold',
    lineAboveRightWidth: TAF_RIGHT_COLUMN_WIDTH,
    lineAboveRightOffset: 4,
    minRightColumnWidth: rightMaxWidth,
  });

  // Footer og gem
  writer.addFooter();
  writer.save(resolvePdfFileName(FILE_BASE_NAME, visUdkastStempel, model.brevhoved?.journalnr));
};
