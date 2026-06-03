/**
 * PDF Generator for TAF opreguleret til beregningsåret
 *
 * Viser tabt arbejdsfortjeneste brudt ned per kalenderår – men med hvert års
 * nettobeløb opreguleret til beregningsårets prisniveau. Opreguleringen følger
 * samme indeksprincip som regulering af årsløn.
 *
 * Dokumentet genererer kun fra et præ-projiceret snapshot-dokument.
 * Eventuel fail-closed / blokering er allerede afgjort før denne generator kaldes.
 */

import { createStandardPdfWriter } from '../../infrastructure/pdfWriter';
import { ensureNonBreakingKr } from '../../shared/pdfTextUtils';
import { type BrevhovedData } from '../../shared/pdfHelpers';
import { logWarning } from '../../../utils/logger';
import { formatIsoDateLong as formatDateLong } from '../../../utils/dateFormatting';
import {
  formatCountWithUnit,
  formatCurrencyFromOre,
  formatMaanederTrimmed,
  formatMoneyOreWithKr,
  formatReguleringFactorText,
  isSingularCount,
  resolvePdfFileName,
} from '../../shared/pdfFormatUtils';
import type { TafPerYearOpreguleretPdfDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearOpreguleretPdfDocument';

const NBSP = ' ';
const FILE_BASE_NAME = 'TAF opreguleret til beregningsår';
const TAF_RIGHT_COLUMN_WIDTH = 33.125;

// NOTE: Årsbeløb må være negative; PDF viser de beregnede værdier direkte.

interface TafOpreguleretPaaAarPdfOptions {
  document: TafPerYearOpreguleretPdfDocument;
  visBrevhoved?: boolean;
  visUdkastStempel?: boolean;
}

export const generateTafOpreguleretPaaAarPdf = (
  options: TafOpreguleretPaaAarPdfOptions
): void => {
  const { visBrevhoved = false, visUdkastStempel = false } = options;
  const { model, presentation, opreguleret } = options.document;

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

  // ─── Tabt arbejdsfortjeneste sektion ──────────────────────────────────

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
    writer.addFooter();
    writer.save(resolvePdfFileName(FILE_BASE_NAME, visUdkastStempel, model.brevhoved?.journalnr));
    return;
  } else {
    for (const line of model.tabtArbejdsfortjeneste.tafPerioderLinjer) {
      writer.writeWrappedText(line);
    }
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
    writer.addFooter();
    writer.save(resolvePdfFileName(FILE_BASE_NAME, visUdkastStempel, model.brevhoved?.journalnr));
    return;
  }

  // ─── TAF opreguleret til beregningsåret ───────────────────────────────

  const rightMaxWidth = writer.getTextWidth('000.000.000,00');
  const beregningsAar = opreguleret.beregningsAar;
  const opreguleretByYear = new Map(opreguleret.years.map((entry) => [entry.year, entry] as const));

  for (const yearEntry of presentation.years) {
    writer.writeBoldSubheader(`${yearEntry.year}`);

    // Segmenter (identisk format med TAF-fordelt-på-år-PDF)
    for (const segment of yearEntry.segments) {
      const factorText = formatReguleringFactorText(segment.deltaPct);
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
      const rightText = deduction.amountOre === 0
        ? ensureNonBreakingKr(formatMoneyOreWithKr(deduction.amountOre))
        : ensureNonBreakingKr(`- ${formatMoneyOreWithKr(deduction.amountOre)}`);
      writer.writeLeftRightText(deduction.label, rightText, { rightFontStyle: 'normal', minRightColumnWidth: rightMaxWidth });
    }

    // I alt for året (oprindeligt beløb, med streg)
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

    // Opregulering til beregningsåret
    const opreguleretEntry = opreguleretByYear.get(yearEntry.year);
    if (opreguleretEntry) {
      writer.addSectionSpacer();
      const factorText = formatReguleringFactorText(opreguleretEntry.deltaPct);
      const opreguleretLeftText = `Opreguleret til ${beregningsAar}${factorText} =`;
      const opreguleretRightText = ensureNonBreakingKr(formatMoneyOreWithKr(opreguleretEntry.yearTafOpreguleretOre));
      writer.writeLeftRightText(opreguleretLeftText, opreguleretRightText, {
        rightFontStyle: 'bold',
        minRightColumnWidth: rightMaxWidth,
      });
    }
  }

  // ─── Samlet ──────────────────────────────────────────────────────────

  writer.writeBoldSubheader('Samlet');

  // Per-år linjer (opregulerede beløb)
  for (const opreguleretEntry of opreguleret.years) {
    const rightText = ensureNonBreakingKr(formatMoneyOreWithKr(opreguleretEntry.yearTafOpreguleretOre));
    writer.writeLeftRightText(`${opreguleretEntry.year}`, rightText, { rightFontStyle: 'normal', minRightColumnWidth: rightMaxWidth });
  }

  // Samlet opreguleret TAF-krav (fed, med streg)
  const samletText = ensureNonBreakingKr(formatMoneyOreWithKr(opreguleret.sumOpreguleretOre));
  writer.writeLeftRightText(`Samlet TAF opreguleret til ${beregningsAar}`, samletText, {
    rightFontStyle: 'bold',
    lineAboveRightWidth: TAF_RIGHT_COLUMN_WIDTH,
    lineAboveRightOffset: 4,
    minRightColumnWidth: rightMaxWidth,
  });

  // Footer og gem
  writer.addFooter();
  writer.save(resolvePdfFileName(FILE_BASE_NAME, visUdkastStempel, model.brevhoved?.journalnr));
};
