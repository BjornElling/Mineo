/**
 * PDF Generator for Ménberegning
 *
 * Genererer PDF-dokumentation af ménberegning med fødselsdato, skadesdato, méngrad og resultat
 */

import type { RowInput } from 'jspdf-autotable';
import {
  PDF_BASE_LINE_HEIGHT_MM,
  type BrevhovedData,
} from './pdfHelpers';
import { createStandardPdfWriter, type PdfWriter } from './pdfWriter';
import { cellLeft, cellRight, createPdfTableCell, renderEoStylePdfTable } from './pdfTableRenderer';
import { formatIsoDateLong } from '../dateFormatting';
import type { ISODateString } from '../../types/branded';
import type { StamdataValues } from '../../schemas/formSchemas';
import type { VarigeMenBeregningResult } from '../../domain/varigemen/varigeMenCalculations';
import { TODAY } from '../../config/dateRanges';
import { formatAsAmount } from '../formatUtils';

const formatDateReadable = (isoDate: ISODateString | undefined): string => formatIsoDateLong(isoDate);

/**
 * Tilføj stamdata-sektion
 */
const addStamdataSection = (
  writer: PdfWriter,
  fodselsdato: ISODateString | undefined,
  skadesdato: ISODateString | undefined,
  alderVedSkade: number
): void => {
  writer.writeSubheader('Stamdata', PDF_BASE_LINE_HEIGHT_MM);
  const tableData: RowInput[] = [
    [cellLeft('Fødselsdato'), cellRight(formatDateReadable(fodselsdato))],
    [cellLeft('Skadesdato'), cellRight(formatDateReadable(skadesdato))],
    [cellLeft('Alder på skadestidspunkt'), cellRight(`${alderVedSkade} år`)],
  ];
  const doc = writer.getDoc();
  const startY = writer.getY();
  const finalY = renderEoStylePdfTable({
    doc,
    startY,
    body: tableData,
    hasHeaderRow: false,
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
  });
  writer.setY(finalY + PDF_BASE_LINE_HEIGHT_MM);
};

/**
 * Tilføj beregningsgrundlag-sektion
 */
const addBeregningsgrundlagSection = (
  writer: PdfWriter,
  mengrad: number | undefined,
  beregningsdato: ISODateString | undefined
): void => {
  writer.writeSubheader('Beregningsgrundlag', PDF_BASE_LINE_HEIGHT_MM);
  const tableData: RowInput[] = [
    [cellLeft('Méngrad'), cellRight(mengrad !== undefined ? `${mengrad} %` : '')],
    [cellLeft('Beregningsdato'), cellRight(formatDateReadable(beregningsdato))],
  ];
  const doc = writer.getDoc();
  const startY = writer.getY();
  const finalY = renderEoStylePdfTable({
    doc,
    startY,
    body: tableData,
    hasHeaderRow: false,
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
  });
  writer.setY(finalY + PDF_BASE_LINE_HEIGHT_MM);
};

/**
 * Tilføj beregnet méngodtgørelse-sektion
 */
const addResultatSection = (
  writer: PdfWriter,
  mengrad: number | undefined,
  beregningsResultat: VarigeMenBeregningResult
): void => {
  writer.writeSubheader('Beregnet méngodtgørelse', PDF_BASE_LINE_HEIGHT_MM);
  const tableData: RowInput[] = [];
  tableData.push([
    cellLeft(`Grundbeløb: ${mengrad} % mén á ${formatAsAmount(beregningsResultat.satsPerMengrad, 2)} kr.`),
    cellRight(`${formatAsAmount(beregningsResultat.grundbeloebUdenReduktion, 2)} kr.`),
  ]);
  const reduktionsBeloeb = beregningsResultat.grundbeloebUdenReduktion * beregningsResultat.aldersreduktionPct / 100;
  tableData.push([
    cellLeft(`Aldersreduktion, ${beregningsResultat.alderVedSkade} år = - ${beregningsResultat.aldersreduktionPct} %`),
    cellRight(`- ${formatAsAmount(reduktionsBeloeb, 2)} kr.`),
  ]);
  tableData.push([
    cellLeft('Beregnet méngodtgørelse'),
    createPdfTableCell(`${formatAsAmount(beregningsResultat.beregnetGodtgoerelse)} kr.`, { halign: 'right', bold: true }),
  ]);
  const doc = writer.getDoc();
  const startY = writer.getY();
  const finalY = renderEoStylePdfTable({
    doc,
    startY,
    body: tableData,
    hasHeaderRow: false,
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
  });
  writer.setY(finalY + PDF_BASE_LINE_HEIGHT_MM);
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

  // Dokumentets metadata
  writer.setProperties({
    title: 'Ménberegning',
    subject: 'Ménberegning',
    author: 'MINEO',
    creator: 'MINEO',
  });

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: stamdata?.journalnr,
      advokat: stamdata?.advokat,
      sagsbehandler: stamdata?.sagsbehandler,
      dagsDatoISO: TODAY,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  // Tilføj titel
  writer.writeTitle('Ménberegning');

  // Tilføj stamdata-sektion
  addStamdataSection(writer, fodselsdato, skadesdato, beregningsResultat.alderVedSkade);

  // Tilføj beregningsgrundlag-sektion
  addBeregningsgrundlagSection(writer, mengrad, beregningsdato);

  // Tilføj resultat-sektion
  addResultatSection(writer, mengrad, beregningsResultat);

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
