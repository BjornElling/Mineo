/**
 * PDF Generator for TAF fordelt på kalenderår
 *
 * Viser tabt arbejdsfortjeneste brudt ned per kalenderår.
 * Genbruger alle beregningsprincipper fra EO-modellen.
 * Årsbeløb er præsentation – samlet TAF-krav er autoritativt.
 */

import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import type { MoneyOre } from '../../domain/erstatningsopgoerelse/eoPdfModel';
import { buildErstatningsopgoerelsePdfModel } from '../../domain/erstatningsopgoerelse/eoPdfModel';
import { buildTafPerYearResult } from '../../domain/erstatningsopgoerelse/tafPerYearDerived';
import { formatCurrency } from '../formatUtils';
import { createPdfWriter, ensureNonBreakingKr } from './pdfWriter';
import { FONT_SIZES } from './pdfConfig';
import type { BrevhovedData } from './pdfHelpers';
import { TODAY } from '../../config/dateRanges';

const NBSP = '\u00A0';

const formatCurrencyFromOre = (ore: MoneyOre): string => formatCurrency(ore / 100);

const formatMoneyOreWithKr = (ore: MoneyOre): string => `${formatCurrencyFromOre(ore)}${NBSP}kr.`;

const formatMaanederTrimmed = (value: number): string => {
  const rounded = Math.round(value * 10000) / 10000;
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};

const formatPercentDelta = (value: number): string => {
  const abs = Math.abs(value);
  const rounded = Math.round(abs * 100) / 100;
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

interface TafFordeltPaaAarPdfOptions {
  visBrevhoved?: boolean;
  visUdkastStempel?: boolean;
}

export const generateTafFordeltPaaAarPdf = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  options: TafFordeltPaaAarPdfOptions = {}
) => {
  const { visBrevhoved = false, visUdkastStempel = false } = options;
  const lineHeight = 5;
  const doubleLineHeight = lineHeight * 2;

  const model = buildErstatningsopgoerelsePdfModel(stamdataValues, eoValues, { dagsDatoISO: TODAY });
  const presentation = buildTafPerYearResult(model, eoValues);

  if (!presentation) {
    throw new Error('TAF fordelt på år kan ikke beregnes for den valgte opsætning.');
  }

  const titel = 'Tabt arbejdsfortjeneste fordelt på år';

  const writer = createPdfWriter({
    lineHeight,
    doubleLineHeight,
    visUdkastStempel,
    onLayoutFallback: (message: string) => {
      console.warn(`PDF-layout: ${message}`);
    },
  });
  writer.setDisplayMode('fullheight');

  writer.setProperties({
    title: titel,
    subject: 'Erstatningsberegning',
    author: 'MINEO',
    creator: 'MINEO',
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

  // Titel (fed skrift)
  writer.setFontSize(FONT_SIZES.title);
  writer.setFont('helvetica', 'bold');
  writer.writeWrappedText(titel);

  // Erstatningsperiode
  writer.setFontSize(FONT_SIZES.normal);
  writer.setFont('helvetica', 'normal');
  if (model.periodeDisplay) {
    writer.writeWrappedText(model.periodeDisplay);
    writer.advanceY(lineHeight);
  }

  // Skadelidtes navn (fed)
  writer.setFont('helvetica', 'bold');
  if (model.skadelidteNavn) {
    writer.writeWrappedText(model.skadelidteNavn);
  }

  // Skadestype (normal)
  writer.setFont('helvetica', 'normal');
  if (model.skadestypeLinje) {
    writer.writeWrappedText(model.skadestypeLinje);
    writer.advanceY(lineHeight);
  }

  // ─── Tabt arbejdsfortjeneste sektion ──────────────────────────────────

  writer.writeSectionHeader('Tabt arbejdsfortjeneste', lineHeight);

  // Status
  writer.writeSubheader('Status', lineHeight, { addTopSpacing: false });
  writer.setFont('helvetica', 'normal');
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
  } else {
    for (const line of model.tabtArbejdsfortjeneste.tafPerioderLinjer) {
      writer.writeWrappedText(line);
    }
  }

  // ─── TAF fordelt på kalenderår ────────────────────────────────────────

  const rightMaxWidth = writer.getTextWidth('000.000.000,00');

  for (const yearEntry of presentation.years) {
    writer.writeSubheader(`${yearEntry.year}`, lineHeight);
    writer.setFont('helvetica', 'normal');

    // Segmenter (identisk format med EO-pdf)
    for (const segment of yearEntry.segments) {
      const roundedDeltaPct = Math.round(segment.deltaPct * 100) / 100;
      const factorText = Math.abs(roundedDeltaPct) < 0.00001
        ? ''
        : ` x (100 % ${roundedDeltaPct >= 0 ? '+' : '-'} ${formatPercentDelta(roundedDeltaPct)} %)`;
      let leftText = '';
      if (segment.kind === 'arbejdsdage') {
        const arbejdsdageText = segment.quantity.toLocaleString('da-DK');
        const dagsloenText = formatCurrencyFromOre(segment.unitAmountOre);
        leftText = `${arbejdsdageText} arbejdsdage á ${dagsloenText}${NBSP}kr.${factorText} =`;
      } else {
        const maanederText = formatMaanederTrimmed(segment.quantity);
        const maanedsloenText = formatCurrencyFromOre(segment.unitAmountOre);
        leftText = `${maanederText} måneder á ${maanedsloenText}${NBSP}kr.${factorText} =`;
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
    writer.writeLeftRightText('I alt', iAltRightText, {
      rightFontStyle: 'normal',
      lineAboveRightWidth: 33.125,
      lineAboveRightOffset: 4,
      minRightColumnWidth: rightMaxWidth,
    });
  }

  // ─── Samlet ──────────────────────────────────────────────────────────

  writer.writeSubheader('Samlet', lineHeight);
  writer.setFont('helvetica', 'normal');

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
    lineAboveRightWidth: 33.125,
    lineAboveRightOffset: 4,
    minRightColumnWidth: rightMaxWidth,
  });

  // Footer og gem
  writer.addFooter();
  writer.save('Tabt arbejdsfortjeneste fordelt på år.pdf');
};
