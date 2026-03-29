/**
 * Renderer for EO SFGG-data fra PdfModel til en eksisterende PdfWriter.
 *
 * Opretter IKKE sin egen writer og kalder IKKE writer.save().
 * Bruger PdfModel-data direkte — ingen genberegning.
 *
 * Renderingsrækkefølge per scenarie:
 * 1. Scenarie-header (via scenarioHeaderRenderer)
 * 2. For hvert ansættelsesforhold i SFGG:
 *    a. Ansættelsesforholdets navn og SFGG-kilde
 *    b. Referenceperiode og -sats (hvis tilgængelig)
 *    c. Segment-tabel (fra, til, antal dage, sats, krav)
 *    d. Total
 * 3. Samlet SFGG-total
 */

import type { PdfWriter } from '../../../utils/pdf/pdfWriter';
import type { PdfModel } from '../../../domain/erstatningsopgoerelse/eoPdfModelTypes';
import type { BatchScenario } from '../types';
import { renderScenarioHeader } from './scenarioHeaderRenderer';
import { formatCurrencyFromOre, formatMoneyOreWithKr } from '../../../utils/pdf/pdfFormatUtils';
import { isoToDanish } from '../../../types/branded';

/**
 * Formaterer en ISO-dato til dansk format, eller returnerer fallback-streng.
 */
const formatIso = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  return isoToDanish(iso as Parameters<typeof isoToDanish>[0]) ?? iso;
};

/**
 * Renderer SFGG-data for et enkelt ansættelsesforhold.
 */
const renderSfggPerAnsaettelse = (
  writer: PdfWriter,
  af: PdfModel['tabtArbejdsfortjeneste']['sygeferiegodtgoerelse']['perAnsaettelsesforhold'][number]
): void => {
  writer.writeSectionHeader(af.ansaettelsesforholdNavn, 6);

  writer.writeLeftRightText('SFGG-kilde', af.sfggSourceLabel, {
    rightFontStyle: 'normal',
  });

  if (af.sfggReferenceperiode) {
    const periodeStr = `${formatIso(af.sfggReferenceperiode.fra)} – ${formatIso(af.sfggReferenceperiode.til)}`;
    writer.writeLeftRightText(af.sfggReferenceperiodeLabel, periodeStr, {
      rightFontStyle: 'normal',
    });
  }

  if (af.sfggReferencesats.status === 'ok') {
    const satsStr = formatCurrencyFromOre(af.sfggReferencesats.value) + ' kr./dag';
    const directLabel = af.sfggDirectRateLabel ?? 'Dagssats';
    writer.writeLeftRightText(directLabel, satsStr, {
      rightFontStyle: 'normal',
    });
  }

  if (af.sfggIntroText) {
    writer.writeWrappedText(af.sfggIntroText);
  }

  if (af.sfggFirstTafDayExcludedText) {
    writer.writeWrappedText(af.sfggFirstTafDayExcludedText);
  }

  for (const line of af.pdfExplanatoryLines) {
    writer.writeWrappedText(line);
  }

  // Segment-tabel
  if (af.segments.length > 0) {
    writer.writeSubheader('Perioder', 6, { addTopSpacing: true });
    writer.writeAtomicTableChunks({
      rows: af.segments,
      renderHeader: () => {
        writer.writeLeftRightText('Fra – Til (antal dage)', 'Krav (øre)', {
          rightFontStyle: 'bold',
        });
      },
      renderRow: (seg) => {
        const fraStr = formatIso(seg.fra);
        const tilStr = formatIso(seg.til);
        const dageStr = `${seg.antalDage} dage`;
        const kravStr = formatCurrencyFromOre(seg.feriepengekravOre) + ' kr.';
        writer.writeLeftRightText(
          `${fraStr} – ${tilStr} (${dageStr})`,
          kravStr,
          { rightFontStyle: 'normal' }
        );
      },
      estimateRowHeight: 6,
      headerHeight: 6,
    });
  } else {
    writer.writeWrappedText('Ingen SFGG-perioder beregnet for dette ansættelsesforhold.');
  }

  // Total for ansættelsesforholdet
  writer.addSpacer(2);
  writer.writeLeftRightText(
    'SFGG i alt (dette ansættelsesforhold)',
    formatMoneyOreWithKr(af.feriepengekravTotalOre)
  );

  if (af.alleredeBetaltOre > 0) {
    writer.writeLeftRightText(
      'Allerede betalt',
      '– ' + formatMoneyOreWithKr(af.alleredeBetaltOre),
      { rightFontStyle: 'normal' }
    );
    writer.writeLeftRightText(
      'SFGG netto (dette ansættelsesforhold)',
      formatMoneyOreWithKr(af.totalOre)
    );
  }
};

/**
 * Renderer EO SFGG-data fra en PdfModel ind i en eksisterende PdfWriter.
 *
 * Kalder renderScenarioHeader og renderer derefter SFGG-sektionen.
 * Forudsætter at writer er klar — tilføjer ikke footer.
 */
export const renderEoSfggBatchPage = (
  writer: PdfWriter,
  scenario: BatchScenario<unknown>,
  model: PdfModel
): void => {
  renderScenarioHeader(writer, scenario, 'ok');

  const sfgg = model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse;

  writer.writeSectionHeader('Sygeferiegodtgørelse', 6);

  const perAf = sfgg.perAnsaettelsesforhold;

  if (perAf.length === 0) {
    writer.writeWrappedText('Ingen ansættelsesforhold med SFGG-konfiguration fundet.');
    return;
  }

  for (const af of perAf) {
    renderSfggPerAnsaettelse(writer, af);
  }

  // Samlet SFGG-total (kun vist ved mere end ét ansættelsesforhold)
  if (perAf.length > 1) {
    writer.addSpacer(4);
    writer.writeLeftRightText(
      'SFGG i alt (alle ansættelsesforhold)',
      formatMoneyOreWithKr(sfgg.totalOre),
      { lineAboveRightWidth: 40 }
    );
  }
};
