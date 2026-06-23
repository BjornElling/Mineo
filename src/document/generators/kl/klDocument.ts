/**
 * Dokument-generator for KL-lønaftaler
 *
 * Genererer ét dokument med alle linjer i de kommunale lønaftaler fra 2005 og frem.
 * Tre kolonner: Dato | Tekst | Akkumuleret regulering (indeks-form, fx 1,124454).
 *
 * Modsat KRL-dokumentet (fire satstabel-kolonner) er dette en enkelt indeksserie,
 * og alle linjer vises — også ikke-regulerende datoer og delkomponenter på samme dato.
 */

import type { RowInput } from 'jspdf-autotable';
import { PDF_CONTENT_WIDTH_MM } from '../../layout/pdfConfig';
import {
  resolveDocumentSectionEndY,
} from '../../layout/documentLayoutHelpers';
import { buildStamdataBrevhovedData, initStandardDocumentWriter } from '../documentGeneratorSetup';
import {
  createDocumentTableCell,
  createDocumentTableHeaderCell,
  renderDocumentTable,
} from '../../layout/documentTableRenderer';
import { klLoenaftaleRaekker } from '../../../data/klLoenaftaler';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import { formatAsAmount } from '../../../utils/formatUtils';
import type { DocumentCommonOptions } from '../../layout/documentOptions';

type KLPdfParams = DocumentCommonOptions;

const KL_DOCUMENT_TITLE = 'KL-lønaftaler';

export const buildKLDocumentFilename = (journalnr?: string): string =>
  resolveDocumentArtifactFileName(KL_DOCUMENT_TITLE, false, journalnr);

const formatIndeks = (value: number): string => formatAsAmount(value, 6);

export const generateKLDocument = (params: KLPdfParams): void => {
  const { visBrevhoved = false, stamdata = null } = params;

  const writer = initStandardDocumentWriter({ title: KL_DOCUMENT_TITLE });
  const doc = writer.getDoc();

  if (visBrevhoved) {
    writer.writeBrevhoved(buildStamdataBrevhovedData(stamdata));
  }

  writer.writeTitle(KL_DOCUMENT_TITLE);

  const headerRow: RowInput = [
    createDocumentTableHeaderCell('Dato', 'left'),
    createDocumentTableHeaderCell('Regulering', 'left'),
    createDocumentTableHeaderCell('Procent', 'right'),
    createDocumentTableHeaderCell('Akkumuleret regulering', 'right'),
  ];

  const bodyRows: RowInput[] = klLoenaftaleRaekker.map((row) => [
    createDocumentTableCell(row.fraDato, { halign: 'left' }),
    createDocumentTableCell(row.regulering, { halign: 'left' }),
    createDocumentTableCell(row.procent, { halign: 'right' }),
    createDocumentTableCell(formatIndeks(row.indeks), { halign: 'right' }),
  ]);

  if (bodyRows.length === 0) {
    bodyRows.push([
      createDocumentTableCell('Ingen lønaftaler tilgængelige.', { halign: 'left' }),
      createDocumentTableCell('', { halign: 'left' }),
      createDocumentTableCell('', { halign: 'right' }),
      createDocumentTableCell('', { halign: 'right' }),
    ]);
  }

  const tableWidth = PDF_CONTENT_WIDTH_MM;
  const datoWidth = 22;
  const procentWidth = 24;
  const akkumuleretWidth = 38;
  const reguleringWidth = tableWidth - datoWidth - procentWidth - akkumuleretWidth;
  const tableRows: RowInput[] = [headerRow, ...bodyRows];

  const finalY = renderDocumentTable({
    doc,
    startY: writer.getY(),
    body: tableRows,
    tableWidth,
    columnStyles: {
      0: { cellWidth: datoWidth, halign: 'left' },
      1: { cellWidth: reguleringWidth, halign: 'left' },
      2: { cellWidth: procentWidth, halign: 'right' },
      3: { cellWidth: akkumuleretWidth, halign: 'right' },
    },
  });

  writer.setY(resolveDocumentSectionEndY(finalY, writer.getY()));

  writer.addFooter();
  writer.save(buildKLDocumentFilename(stamdata?.journalnr));
};
