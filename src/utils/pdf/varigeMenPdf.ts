/**
 * PDF Generator for Ménberegning
 *
 * Genererer PDF-dokumentation af ménberegning med fødselsdato, skadesdato, méngrad og resultat
 */

import jsPDF from 'jspdf';
import type { RowInput } from 'jspdf-autotable';
import { MARGINS, SECTION_SPACER } from './pdfConfig';
import { addSectionHeading, addTitle, resolvePdfSectionEndY, type BrevhovedData } from './pdfHelpers';
import { createStandardPdfWriter } from './pdfWriter';
import { cellLeft, cellRight, createPdfTableCell, renderEoStylePdfTable } from './pdfTableRenderer';
import { formatIsoDateLong } from '../dateFormatting';
import type { ISODateString } from '../../types/branded';
import type { StamdataValues } from '../../schemas/formSchemas';
import type { VarigeMenBeregningResult } from '../../domain/varigemen/varigeMenCalculations';
import { TODAY } from '../../config/dateRanges';
import { formatAsAmount } from '../formatUtils';

type PdfDoc = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};

const formatDateReadable = (isoDate: ISODateString | undefined): string => formatIsoDateLong(isoDate);

/**
 * Tilføj stamdata-tabel
 */
const addStamdataTable = (
  doc: PdfDoc,
  fodselsdato: ISODateString | undefined,
  skadesdato: ISODateString | undefined,
  alderVedSkade: number,
  currentY: number
): number => {
  const tableData: RowInput[] = [];

  const headingY = addSectionHeading(doc, 'Stamdata', currentY);

  // Data-rækker
  tableData.push([
    cellLeft('Fødselsdato'),
    cellRight(formatDateReadable(fodselsdato)),
  ]);

  tableData.push([
    cellLeft('Skadesdato'),
    cellRight(formatDateReadable(skadesdato)),
  ]);

  tableData.push([
    cellLeft('Alder på skadestidspunkt'),
    cellRight(`${alderVedSkade} år`),
  ]);

  const finalY = renderEoStylePdfTable({
    doc,
    startY: headingY,
    body: tableData,
    hasHeaderRow: false,
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
  });

  return resolvePdfSectionEndY(finalY, currentY);
};

/**
 * Tilføj beregningsgrundlag-tabel
 */
const addBeregningsgrundlagTable = (
  doc: PdfDoc,
  mengrad: number | undefined,
  beregningsdato: ISODateString | undefined,
  currentY: number
): number => {
  const tableData: RowInput[] = [];

  const headingY = addSectionHeading(doc, 'Beregningsgrundlag', currentY);

  // Méngrad
  tableData.push([
    cellLeft('Méngrad'),
    cellRight(mengrad !== undefined ? `${mengrad} %` : ''),
  ]);

  // Beregningsdato
  tableData.push([
    cellLeft('Beregningsdato'),
    cellRight(formatDateReadable(beregningsdato)),
  ]);

  const finalY = renderEoStylePdfTable({
    doc,
    startY: headingY,
    body: tableData,
    hasHeaderRow: false,
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
  });

  return resolvePdfSectionEndY(finalY, currentY);
};

/**
 * Tilføj beregnet méngodtgørelse-tabel
 */
const addResultatTable = (
  doc: PdfDoc,
  mengrad: number | undefined,
  beregningsResultat: VarigeMenBeregningResult,
  currentY: number
): number => {
  const tableData: RowInput[] = [];

  const headingY = addSectionHeading(doc, 'Beregnet méngodtgørelse', currentY);

  // Grundbeløb
  tableData.push([
    cellLeft(`Grundbeløb: ${mengrad} % mén á ${formatAsAmount(beregningsResultat.satsPerMengrad, 2)} kr.`),
    cellRight(`${formatAsAmount(beregningsResultat.grundbeloebUdenReduktion, 2)} kr.`),
  ]);

  // Aldersreduktion
  const reduktionsBeloeb = beregningsResultat.grundbeloebUdenReduktion * beregningsResultat.aldersreduktionPct / 100;
  tableData.push([
    cellLeft(`Aldersreduktion, ${beregningsResultat.alderVedSkade} år = - ${beregningsResultat.aldersreduktionPct} %`),
    cellRight(`- ${formatAsAmount(reduktionsBeloeb, 2)} kr.`),
  ]);

  // Slutresultat (tekst normal, værdi fed)
  tableData.push([
    cellLeft('Beregnet méngodtgørelse'),
    createPdfTableCell(`${formatAsAmount(beregningsResultat.beregnetGodtgoerelse)} kr.`, { halign: 'right', bold: true }),
  ]);

  const finalY = renderEoStylePdfTable({
    doc,
    startY: headingY,
    body: tableData,
    hasHeaderRow: false,
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
  });

  return resolvePdfSectionEndY(finalY, currentY);
};

/**
 * Generer og download PDF for ménberegning
 */
type GenerateVarigeMenPdfParams = Readonly<{
  fodselsdato: ISODateString | undefined;
  skadesdato: ISODateString | undefined;
  mengrad: number | undefined;
  beregningsdato: ISODateString | undefined;
  beregningsResultat: VarigeMenBeregningResult;
  stamdata: StamdataValues | null;
  visBrevhoved?: boolean;
}>;

export const generateVarigeMenPdf = (params: GenerateVarigeMenPdfParams): void => {
  const {
    fodselsdato,
    skadesdato,
    mengrad,
    beregningsdato,
    beregningsResultat,
    stamdata,
    visBrevhoved = false,
  } = params;

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');
  const doc = writer.getDoc() as PdfDoc;

  // Dokumentets metadata
  writer.setProperties({
    title: 'Ménberegning',
    subject: 'Ménberegning',
    author: 'MINEO',
    creator: 'MINEO',
  });

  let currentY = MARGINS.top;

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: stamdata?.journalnr,
      advokat: stamdata?.advokat,
      sagsbehandler: stamdata?.sagsbehandler,
      dagsDatoISO: TODAY,
    };
    writer.writeBrevhoved(brevhovedData);
    currentY = writer.getY();
  }

  // Tilføj titel
  currentY = addTitle(doc, 'Ménberegning', currentY);

  // Tilføj stamdata-tabel
  currentY = addStamdataTable(doc, fodselsdato, skadesdato, beregningsResultat.alderVedSkade, currentY);

  // Tilføj beregningsgrundlag-tabel
  currentY = addBeregningsgrundlagTable(doc, mengrad, beregningsdato, currentY);

  // Tilføj resultat-tabel
  addResultatTable(doc, mengrad, beregningsResultat, currentY);

  // Tilføj footer med versionsnummer
  writer.addFooter();

  // Generer filnavn
  let filename = 'Ménberegning.pdf';
  if (stamdata) {
    const journalnr = stamdata.journalnr || '';
    const navn = stamdata.skadelidte || '';
    if (journalnr && navn) {
      filename = `${journalnr} - ${navn} - Ménberegning.pdf`;
    } else if (journalnr) {
      filename = `${journalnr} - Ménberegning.pdf`;
    } else if (navn) {
      filename = `${navn} - Ménberegning.pdf`;
    }
  }

  // Download PDF
  writer.save(filename);
};
