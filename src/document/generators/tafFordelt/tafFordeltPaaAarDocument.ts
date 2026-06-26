/**
 * PDF Generator for TAF fordelt på kalenderår
 *
 * Viser tabt arbejdsfortjeneste brudt ned per kalenderår.
 * Genbruger alle beregningsprincipper fra EO-modellen.
 * Årsbeløb er præsentation – samlet TAF-krav er autoritativt.
 * Dokumentet genererer kun fra et præ-projiceret snapshot-dokument.
 * Eventuel fail-closed / blokering er allerede afgjort før denne generator kaldes.
 */

import { initStandardDocumentWriter } from '../documentGeneratorSetup';
import { PDF_AMOUNT_RIGHT_COLUMN_WIDTH_MM } from '../../layout/pdfConfig';
import { ensureNonBreakingKr } from '../../layout/pdfTextUtils';
import { type BrevhovedData } from '../../layout/documentLayoutHelpers';
import { logWarning } from '../../../utils/logger';
import { formatIsoDateLong as formatDateLong } from '../../../utils/dateFormatting';
import {
  formatCountWithUnit,
  formatCurrencyFromOre,
  formatMaanederTrimmed,
  formatMoneyOreWithKr,
  formatReguleringFactorText,
  isSingularCount,
  resolveDocumentArtifactFileName,
} from '../../layout/documentFormatUtils';
import type { TafPerYearDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearDocument';

const NBSP = '\u00A0';
const FILE_BASE_NAME = 'Tabt arbejdsfortjeneste fordelt på år';
const TAF_RIGHT_COLUMN_WIDTH = PDF_AMOUNT_RIGHT_COLUMN_WIDTH_MM;

// NOTE: Årsbeløb må være negative; PDF viser de beregnede værdier direkte.

interface TafFordeltPaaAarPdfOptions {
  document: TafPerYearDocument;
  visBrevhoved?: boolean;
  visUdkastStempel?: boolean;
}

export const generateTafFordeltPaaAarDocument = (
  options: TafFordeltPaaAarPdfOptions
): void => {
  const { visBrevhoved = false, visUdkastStempel = false } = options;
  const { model, presentation } = options.document;

  const titel = 'Tabt arbejdsfortjeneste fordelt på år';

  const writer = initStandardDocumentWriter({
    title: titel,
    options: {
      visUdkastStempel,
      onLayoutFallback: ({ message, label }) => {
        logWarning('PDF-layout fallback aktiveret', {
          context: 'pdf.tafFordeltPaaAar.layout',
          data: { message, label },
        });
      },
    },
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
    writer.writeBoldSubheader('TAF fordelt på kalenderår');
    writer.writeWrappedText('Ingen');
    writer.addFooter();
    writer.save(resolveDocumentArtifactFileName(FILE_BASE_NAME, visUdkastStempel, model.brevhoved?.journalnr));
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

  if (!presentation) {
    writer.writeBoldSubheader('TAF fordelt på kalenderår');
    writer.writeWrappedText('TAF fordelt på år kan ikke beregnes for den valgte opsætning.');
    writer.addFooter();
    writer.save(resolveDocumentArtifactFileName(FILE_BASE_NAME, visUdkastStempel, model.brevhoved?.journalnr));
    return;
  }

  // ─── TAF fordelt på kalenderår ────────────────────────────────────────

  const rightMaxWidth = writer.getTextWidth('000.000.000,00');

  for (const yearEntry of presentation.years) {
    writer.writeBoldSubheader(`${yearEntry.year}`);

    // Segmenter (identisk format med EO-pdf)
    for (const segment of yearEntry.segments) {
      // KL-lønaftaler: enhedsløn vises som den allerede regulerede løn uden faktor-tekst.
      // Se docs/domain/taf/kl-loenaftaler-regulering.md.
      const erReguleretLoen = segment.reguleretLoenOre !== undefined;
      const factorText = erReguleretLoen ? '' : formatReguleringFactorText(segment.deltaPct);
      let leftText = '';
      if (segment.kind === 'arbejdsdage') {
        const arbejdsdageText = formatCountWithUnit(segment.quantity, 'arbejdsdag', 'arbejdsdage');
        const dagsloenText = formatCurrencyFromOre(segment.reguleretLoenOre ?? segment.unitAmountOre);
        leftText = `${arbejdsdageText} á ${dagsloenText}${NBSP}kr.${factorText} =`;
      } else {
        const maanederText = `${formatMaanederTrimmed(segment.quantity)} ${isSingularCount(segment.quantity) ? 'måned' : 'måneder'}`;
        const maanedsloenText = formatCurrencyFromOre(segment.reguleretLoenOre ?? segment.unitAmountOre);
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

  writer.writeBoldSubheader('Samlet');

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
  writer.save(resolveDocumentArtifactFileName(FILE_BASE_NAME, visUdkastStempel, model.brevhoved?.journalnr));
};
