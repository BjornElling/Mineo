/**
 * PDF Generator for Løbende ydelser i erhvervsevnetab
 *
 * Genererer PDF-dokumentation af løbende EET-ydelser.
 * Hver afgørelse renderes på sin egen side. Udvidet specifikation
 * (Grundløn, Ydelsesniveau) tilføjes på en separat slutside hvis valgt.
 */

import type { RowInput } from 'jspdf-autotable';
import {
  PDF_BASE_LINE_HEIGHT_MM,
  resolvePdfSectionEndY,
  type BrevhovedData,
} from '../../shared/pdfHelpers';
import { MARGINS } from '../../infrastructure/pdfConfig';
import { createStandardPdfWriter, type PdfWriter } from '../../infrastructure/pdfWriter';
import {
  cellRight,
  createPdfTableCell,
  createPdfTableSummedTotalRow,
  renderEoStylePdfTable,
} from '../../shared/pdfTableRenderer';
import { formatIsoDateLong, formatIsoDateShort } from '../../../utils/dateFormatting';
import type { ISODateString } from '../../../types/branded';
import type {
  EetLoebendeComputation,
  EetLoebendeAfgoerelseComputation,
} from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import {
  formatPct,
  formatSkadedatoCompact,
  shouldShowLoebende2024ConversionBlock,
  toAfgoerelseTypeLabel,
  toOphoerAarsagLabel,
} from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import type { PdfCommonOptions } from '../../shared/pdfOptions';
import { TODAY } from '../../../config/dateRanges';
import { formatAsAmount } from '../../../utils/formatUtils';
import { resolvePdfFileName, formatMaaneder4, formatReguleringPct } from '../../shared/pdfFormatUtils';
import { round4 } from '../../../utils/roundingShortcuts';
import {
  ASL_MAX_AARSLOEN_2003,
  ASL_MAX_AARSLOEN_2024,
  reguleringsprocentErhvervsevnetabFoer2024,
} from '../../../data/lovbestemteRates';
import { formatJaNejEet as formatJaNej, formatKrEet as formatKr } from '../eet/eetPdfUtils';

const formatEetLabel = (eetPct: number, priorKapPct: number): string =>
  priorKapPct > 0
    ? `Erhvervsevnetab (${formatPct(eetPct)} - ${formatPct(priorKapPct)} tidligere kap.)`
    : 'Erhvervsevnetab';

const formatEetValue = (eetPct: number, priorKapPct: number): string =>
  priorKapPct > 0
    ? formatPct(Math.max(0, eetPct - priorKapPct))
    : formatPct(eetPct);

export const buildLoebendeYdelserPdfFilename = (journalnr?: string): string =>
  resolvePdfFileName('Løbende ydelser (EET)', false, journalnr);

export const addLoebendeYdelserEmptyState = (
  writer: PdfWriter
): void => {
  writer.writeSectionHeader('Specifikation', PDF_BASE_LINE_HEIGHT_MM);
  writer.writeWrappedText('Der er ingen afgørelser i sagen.');
};

// ============================================================================
// AFGØRELSE-SIDE
// ============================================================================

export const addLoebendeAfgoerelseSection = (
  writer: PdfWriter,
  afgoerelse: EetLoebendeAfgoerelseComputation,
  computation: EetLoebendeComputation,
  isFirst: boolean
): void => {
  if (!isFirst) {
    writer.addPage();
  }

  const typeLabel = toAfgoerelseTypeLabel(
    afgoerelse.afgoerelseType,
    afgoerelse.harRestSektion,
    afgoerelse.harKapitalisering
  );

  writer.writeSectionHeader(
    `Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`,
    PDF_BASE_LINE_HEIGHT_MM
  );

  const rowOpts = { rightFontStyle: 'normal' as const };

  writer.writeLeftRightText('Type', typeLabel, rowOpts);
  writer.writeLeftRightText(
    formatEetLabel(afgoerelse.eetPct, afgoerelse.priorKapPct),
    formatEetValue(afgoerelse.eetPct, afgoerelse.priorKapPct),
    rowOpts
  );

  if (afgoerelse.harKapitalisering && afgoerelse.kapitaliseringsdato) {
    const kapLabel = afgoerelse.harRestSektion
      ? `Delvist kapitaliseret (${formatPct(afgoerelse.kapPctAktuel)})`
      : 'Kapitaliseret';
    writer.writeLeftRightText(
      kapLabel,
      formatIsoDateShort(afgoerelse.kapitaliseringsdato),
      rowOpts
    );
  }

  writer.writeLeftRightText('Årsløn', formatKr(computation.benyttetAarsloen), rowOpts);

  writer.writeSubheader('Periodeafgrænsning', PDF_BASE_LINE_HEIGHT_MM);

  writer.writeLeftRightText('Afgørelsesdato', formatIsoDateShort(afgoerelse.afgoerelsesdato), rowOpts);
  writer.writeLeftRightText('Virkningsdato', formatIsoDateShort(afgoerelse.virkningsdato), rowOpts);
  writer.writeLeftRightText('Afgørelse med tilbagevirkende kraft?', formatJaNej(afgoerelse.tilbagevirkendeKraft), rowOpts);
  writer.writeLeftRightText('Løbende ydelse ophører', formatIsoDateShort(afgoerelse.ophoerDato), rowOpts);
  writer.writeLeftRightText('Ophør skyldes', toOphoerAarsagLabel(afgoerelse.ophoerAarsag), rowOpts);

  writer.addSpacer(PDF_BASE_LINE_HEIGHT_MM);

  // Beregnede ydelser
  const hasRowsBefore2024 = afgoerelse.perioder.some((r) => r.satsAar <= 2023);
  const hasRowsFrom2024 = afgoerelse.perioder.some((r) => r.satsAar >= 2024);
  const viserGrundydelseNiveauSkift =
    computation.grundloenNiveau === '2003' && hasRowsBefore2024 && hasRowsFrom2024;
  const ingenLoebendeYdelse = afgoerelse.iAltBeregnetEet === 0;

  writer.writeSubheader('Beregnede ydelser', PDF_BASE_LINE_HEIGHT_MM);

  if (viserGrundydelseNiveauSkift) {
    writer.writeWrappedText(
      'Frem til 1. januar 2024 beregnes grundydelsen i 2003-niveau og derefter i 2024-niveau.'
    );
    writer.addSpacer(2);
  }
  if (ingenLoebendeYdelse) {
    writer.writeWrappedText('Afgørelsen giver ingen løbende ydelse i den valgte periode.');
    writer.addSpacer(2);
  }
  if (!ingenLoebendeYdelse) {
    const ydelserHeader: RowInput = [
      createPdfTableCell('Fra o.m.', { halign: 'center', bold: true }),
      createPdfTableCell('Til o.m.', { halign: 'center', bold: true }),
      createPdfTableCell('Mdr.', { halign: 'right', bold: true }),
      createPdfTableCell('Grundydelse', { halign: 'right', bold: true }),
      createPdfTableCell('Regulering', { halign: 'right', bold: true }),
      createPdfTableCell('Ydelse/md.', { halign: 'right', bold: true }),
      createPdfTableCell('Beregnet EET', { halign: 'right', bold: true }),
    ];

    const ydelserBody: RowInput[] = [
      ydelserHeader,
      ...afgoerelse.perioder.map(
        (row): RowInput => [
          createPdfTableCell(formatIsoDateShort(row.fra), { halign: 'center' }),
          createPdfTableCell(formatIsoDateShort(row.til), { halign: 'center' }),
          cellRight(formatMaaneder4(row.maanederPraecis)),
          cellRight(formatKr(row.grundydelseAfrundet, 2)),
          cellRight(formatReguleringPct(row.reguleringPct)),
          cellRight(formatKr(row.maanedligYdelse)),
          cellRight(formatKr(row.beregnetEet)),
        ]
      ),
    ];
    const totalRow = createPdfTableSummedTotalRow(
      'I alt',
      afgoerelse.perioder.map((row) => row.beregnetEet),
      {
        columnCount: 7,
        valueColumnIndex: 6,
        formatValue: (total) => formatKr(total),
        valueHasKrSuffix: true,
      }
    );
    const totalRowIndex = totalRow ? ydelserBody.length : null;
    if (totalRow) {
      ydelserBody.push(totalRow.row);
    }

    const doc = writer.getDoc();
    const startY = writer.getY();
    const finalY = renderEoStylePdfTable({
      doc,
      startY,
      body: ydelserBody,
      hasHeaderRow: true,
      underlinedCellPositions: totalRowIndex === null || totalRow === null
        ? []
        : [{ rowIndex: totalRowIndex, columnIndex: totalRow.valueCellColumnIndex }],
    });
    writer.setY(resolvePdfSectionEndY(finalY, startY));
  }
};

// ============================================================================
// UDVIDET SPECIFIKATION-SIDE
// ============================================================================

export const addLoebendeUdvidetSpecifikationPage = (
  writer: PdfWriter,
  computation: EetLoebendeComputation
): void => {
  writer.addPage();

  writer.writeSectionHeader('Udvidet specifikation', PDF_BASE_LINE_HEIGHT_MM);

  const rowOpts = { rightFontStyle: 'normal' as const };

  // Årsløn
  writer.writeSubheader('Årsløn', PDF_BASE_LINE_HEIGHT_MM);
  const aslLabel = `ASL årsløn (afrundet til nærmeste 1000 og maks. ${formatAsAmount(computation.maxAarsloenISkadesaar, 0)} kr.)`;
  writer.writeLeftRightText(aslLabel, formatKr(computation.benyttetAarsloen), rowOpts);

  // Grundløn
  writer.writeSubheader('Grundløn', PDF_BASE_LINE_HEIGHT_MM);
  if (computation.grundloenNiveau === '2003') {
    writer.writeWrappedText('Skaden er sket før 1. juli 2024, og grundlønnen beregnes derfor i 2003-niveau.');
    writer.writeWrappedTextContinued(`Årsløn × (Maks. årsløn 1/1-2003 / Maks. årsløn ${formatSkadedatoCompact(computation.skadedato)}) =`);
    writer.writeLeftRightText(
      `${formatKr(computation.benyttetAarsloen)} × (${formatAsAmount(ASL_MAX_AARSLOEN_2003, 0)} / ${formatAsAmount(computation.maxAarsloenISkadesaar, 0)}) =`,
      formatKr(computation.grundloen),
      rowOpts
    );
  } else {
    writer.writeWrappedText('Skaden er sket fra 1. juli 2024, og grundlønnen beregnes derfor i 2024-niveau.');
    writer.writeWrappedTextContinued(`Årsløn × (Maks. årsløn 1/1-2024 / Maks. årsløn ${formatSkadedatoCompact(computation.skadedato)}) =`);
    writer.writeLeftRightText(
      `${formatKr(computation.benyttetAarsloen)} × (${formatAsAmount(ASL_MAX_AARSLOEN_2024, 0)} / ${formatAsAmount(computation.maxAarsloenISkadesaar, 0)}) =`,
      formatKr(computation.grundloen),
      rowOpts
    );
  }

  // Ydelsesniveau
  writer.writeSubheader('Ydelsesniveau', PDF_BASE_LINE_HEIGHT_MM);
  if (computation.erstatningsniveauPct === 83) {
    writer.writeLeftRightText(
      'Da skaden er sket 1/1-2011 eller senere, udgør erstatningsniveauet',
      '83 %',
      rowOpts
    );
    writer.writeLeftRightText(
      'Der trækkes AM-bidrag (8 %) fra årslønnen og sker dermed yderligere regulering til',
      '92 %',
      rowOpts
    );
  } else {
    writer.writeLeftRightText(
      'Da skaden er før 1/1-2011, udgør erstatningsniveauet',
      '80 %',
      rowOpts
    );
    writer.writeWrappedText('Der trækkes ikke AM-bidrag fra årslønnen.');
  }

  // Grundydelse pr. afgørelse
  const reguleringFoer2024Pct = reguleringsprocentErhvervsevnetabFoer2024[2024] ?? 0;
  const reguleringFoer2024FaktorTekst = formatAsAmount(
    round4(1 + reguleringFoer2024Pct / 100),
    3
  );

  for (const afgoerelse of computation.afgoerelser) {
    const show2024Block =
      computation.grundloenNiveau === '2003' && shouldShowLoebende2024ConversionBlock(afgoerelse);
    const hasKapitaliseringsdato = afgoerelse.kapitaliseringsdato !== null;
    const hasRestSection = afgoerelse.harRestSektion && hasKapitaliseringsdato;
    const kapitaliseringFra2024 =
      afgoerelse.kapitaliseringsdato !== null &&
      afgoerelse.kapitaliseringsdato >= '2024-01-01';
    const hasRestAfterKapBefore2024 = Boolean(
      hasRestSection &&
        afgoerelse.kapitaliseringsdato &&
        afgoerelse.kapitaliseringsdato < '2024-01-01'
    );
    const showRest2003 = hasRestSection && (!show2024Block || !kapitaliseringFra2024);
    const showRest2024 = show2024Block && hasRestSection && kapitaliseringFra2024;

    const eetFaktor = formatEetValue(afgoerelse.eetPct, afgoerelse.priorKapPct);
    const grundydelseFormulaLine1 =
      computation.erstatningsniveauPct === 83
        ? 'Grundløn x EET x Erstatningsniveau x (100 % - AM-bidrag) ='
        : 'Grundløn x EET x Erstatningsniveau =';
    const grundydelseFormulaLine2 =
      computation.erstatningsniveauPct === 83
        ? `${formatKr(computation.grundloen)} x ${eetFaktor} x 83 % x 92 % =`
        : `${formatKr(computation.grundloen)} x ${eetFaktor} x 80 % =`;

    const primaryGrundydelse =
      computation.grundloenNiveau === '2024'
        ? afgoerelse.grundydelse2024Fuld
        : afgoerelse.grundydelseFuld;

    const restGrundydelse2003 = afgoerelse.grundydelseRest ?? afgoerelse.grundydelseFuld;
    const restGrundydelse2024 = afgoerelse.grundydelse2024Rest ?? afgoerelse.grundydelse2024Fuld;
    const grundydelse2003BaseFor2024 = hasRestAfterKapBefore2024
      ? restGrundydelse2003
      : afgoerelse.grundydelseFuld;
    const grundydelse2024Result = hasRestAfterKapBefore2024
      ? restGrundydelse2024
      : afgoerelse.grundydelse2024Fuld;

    writer.writeSubheader(
      `Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`,
      PDF_BASE_LINE_HEIGHT_MM
    );

    writer.writeLeftRightText(
      formatEetLabel(afgoerelse.eetPct, afgoerelse.priorKapPct),
      eetFaktor,
      rowOpts
    );

    const grundydelseHeading = show2024Block ? 'Grundydelse før 1. januar 2024' : 'Grundydelse';
    writer.writeUnderlinedLabel(grundydelseHeading, MARGINS.left);
    writer.writeWrappedTextContinued(grundydelseFormulaLine1);
    writer.writeLeftRightText(grundydelseFormulaLine2, formatKr(primaryGrundydelse, 2), rowOpts);

    if (showRest2003) {
      const restEetExpression = `${afgoerelse.eetPct} - ${formatPct(afgoerelse.kapPctAktuel)} = ${formatPct(afgoerelse.restEetPct)}`;
      const restTextPrefix =
        afgoerelse.kapitaliseringsdato !== null
          ? `Resterende EET (${restEetExpression}) efter kapitalisering ${formatIsoDateShort(afgoerelse.kapitaliseringsdato as ISODateString)}`
          : 'Resterende EET efter kapitalisering';
      writer.writeLeftRightText(restTextPrefix, formatKr(restGrundydelse2003, 2), rowOpts);
    }

    if (show2024Block) {
      writer.writeUnderlinedLabel('Grundydelse fra 1. januar 2024', MARGINS.left);
      writer.writeWrappedTextContinued(`Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ ${formatPct(reguleringFoer2024Pct)}):`);
      writer.writeLeftRightText(
        `${formatKr(grundydelse2003BaseFor2024, 2)} x ${reguleringFoer2024FaktorTekst} =`,
        formatKr(grundydelse2024Result, 2),
        rowOpts
      );
      if (showRest2024) {
        const restEetExpression = `${afgoerelse.eetPct} - ${formatPct(afgoerelse.kapPctAktuel)} = ${formatPct(afgoerelse.restEetPct)}`;
        const restTextPrefix =
          afgoerelse.kapitaliseringsdato !== null
            ? `Resterende EET (${restEetExpression}) efter kapitalisering ${formatIsoDateShort(afgoerelse.kapitaliseringsdato as ISODateString)}`
            : 'Resterende EET efter kapitalisering';
        writer.writeLeftRightText(restTextPrefix, formatKr(restGrundydelse2024, 2), rowOpts);
      }
    }
  }
};

// ============================================================================
// HOVED-GENERATOR
// ============================================================================

type GenerateLoebendeYdelserPdfParams = PdfCommonOptions &
  Readonly<{
    computation: EetLoebendeComputation;
    visUdvidetSpecifikation?: boolean;
  }>;

export const generateLoebendeYdelserPdf = (
  params: GenerateLoebendeYdelserPdfParams
): void => {
  const {
    computation,
    visUdvidetSpecifikation = false,
    stamdata,
    visBrevhoved = false,
  } = params;

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');

  writer.setProperties({
    title: 'Løbende ydelser (EET)',
    subject: 'Erstatningsberegning',
    author: 'Mineo',
    creator: 'mineo.dk',
  });

  if (visBrevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: stamdata?.journalnr,
      advokat: stamdata?.advokat,
      sagsbehandler: stamdata?.sagsbehandler,
      dagsDatoISO: TODAY,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  writer.writeTitle('Løbende ydelser (EET)');

  if (computation.afgoerelser.length === 0) {
    addLoebendeYdelserEmptyState(writer);
  } else {
    // Én side pr. afgørelse
    computation.afgoerelser.forEach((afgoerelse, index) => {
      addLoebendeAfgoerelseSection(writer, afgoerelse, computation, index === 0);
    });
  }

  // Udvidet specifikation på separat slutside
  if (visUdvidetSpecifikation) {
    addLoebendeUdvidetSpecifikationPage(writer, computation);
  }

  writer.addFooter();
  writer.save(buildLoebendeYdelserPdfFilename(stamdata?.journalnr));
};
