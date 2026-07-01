/**
 * Dokument-generator for KL-lønaftaler
 *
 * Genererer ét dokument med periode-reguleringssatserne fra de kommunale lønaftaler
 * fra 2005 og frem. To kolonner: Dato | Regulering (periode-procent, fx 1,40 %).
 *
 * Modsat KRL-dokumentet (fire satstabel-kolonner) er dette en enkelt serie. Der
 * vises bevidst ingen akkumuleret regulering — erstatningsberegningen kæder
 * periodesatserne på lønnen.
 *
 * SÆRLIG KL-LØNAFTALER-LOGIK — se docs/domain/taf/kl-loenaftaler-regulering.md.
 */

import type { RowInput } from 'jspdf-autotable';
import {
  resolveDocumentSectionEndY,
} from '../../layout/documentLayoutHelpers';
import { buildStamdataBrevhovedData, initStandardDocumentWriter } from '../documentGeneratorSetup';
import {
  createDocumentDistributedColumnStyles,
  createDocumentTableCell,
  createDocumentTableHeaderCell,
  renderDocumentTable,
} from '../../layout/documentTableRenderer';
import { klLoenaftalerRaekker } from '../../../data/klLoenaftaler';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import { formatAsAmount } from '../../../utils/formatUtils';
import type { DocumentCommonOptions } from '../../layout/documentOptions';

type KlLoenaftalerPdfParams = DocumentCommonOptions;

const KL_LOENAFTALER_DOCUMENT_TITLE = 'KL-lønaftaler';

export const buildKlLoenaftalerDocumentFilename = (journalnr?: string): string =>
  resolveDocumentArtifactFileName(KL_LOENAFTALER_DOCUMENT_TITLE, false, journalnr);

const formatReguleringPct = (value: number): string => `${formatAsAmount(value, 2)} %`;

export const generateKlLoenaftalerDocument = (params: KlLoenaftalerPdfParams): void => {
  const { visBrevhoved = false, stamdata = null } = params;

  const writer = initStandardDocumentWriter({ title: KL_LOENAFTALER_DOCUMENT_TITLE });
  const doc = writer.getDoc();

  if (visBrevhoved) {
    writer.writeBrevhoved(buildStamdataBrevhovedData(stamdata));
  }

  writer.writeTitle(KL_LOENAFTALER_DOCUMENT_TITLE);

  const headerRow: RowInput = [
    createDocumentTableHeaderCell('Dato', 'center'),
    createDocumentTableHeaderCell('Regulering', 'center'),
  ];

  const bodyRows: RowInput[] = klLoenaftalerRaekker.map((row) => [
    createDocumentTableCell(row.fraDato, { halign: 'center' }),
    createDocumentTableCell(formatReguleringPct(row.reguleringPct), { halign: 'center' }),
  ]);

  if (bodyRows.length === 0) {
    bodyRows.push([
      createDocumentTableCell('Ingen lønaftaler tilgængelige.', { halign: 'center' }),
      createDocumentTableCell('', { halign: 'center' }),
    ]);
  }

  const tableRows: RowInput[] = [headerRow, ...bodyRows];

  const finalY = renderDocumentTable({
    doc,
    startY: writer.getY(),
    body: tableRows,
    columnStyles: createDocumentDistributedColumnStyles(2, { defaultHalign: 'center' }),
  });

  writer.setY(resolveDocumentSectionEndY(finalY, writer.getY()));

  writer.addFooter();
  writer.save(buildKlLoenaftalerDocumentFilename(stamdata?.journalnr));
};
