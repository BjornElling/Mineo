/**
 * Dokument-generator for KL-lønaftaler
 *
 * Genererer ét dokument med periode-reguleringssatserne fra de kommunale lønaftaler
 * fra 2005 og frem. To kolonner: Dato | Regulering (periode-procent, fx 1,40 %).
 *
 * Modsat KRL-dokumentet (fire satstabel-kolonner) er dette en enkelt serie. Der
 * vises bevidst ingen akkumuleret regulering – erstatningsberegningen kæder
 * periodesatserne på lønnen.
 *
 * SÆRLIG KL-LØNAFTALER-LOGIK – se docs/domain/taf/kl-loenaftaler-regulering.md.
 */

import { buildStamdataBrevhovedData, defineDocument } from '../documentGeneratorSetup';
import { type ColumnSpec, type RowSpec } from '../../layout/tableSpec';
import { klLoenaftalerRaekker } from '../../../data/klLoenaftaler';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import { formatAsAmount } from '../../../utils/formatUtils';
import type { DocumentCommonOptions } from '../../layout/documentOptions';

type KlLoenaftalerDocumentParams = DocumentCommonOptions;

const KL_LOENAFTALER_DOCUMENT_TITLE = 'KL-lønaftaler';

const formatReguleringPct = (value: number): string => `${formatAsAmount(value, 2)} %`;

export const generateKlLoenaftalerDocument = defineDocument<KlLoenaftalerDocumentParams>({
  title: KL_LOENAFTALER_DOCUMENT_TITLE,
  filename: ({ stamdata }, format) => resolveDocumentArtifactFileName(
    KL_LOENAFTALER_DOCUMENT_TITLE,
    false,
    stamdata?.journalnr,
    format
  ),
  brevhoved: ({ visBrevhoved = false, stamdata }) =>
    visBrevhoved ? buildStamdataBrevhovedData(stamdata) : null,
  body: (writer) => {
  // To lige brede, centrerede kolonner. Justering defineres på kolonnerne (`align`),
  // så både PDF og Word læser samme kilde.
  const columns: readonly ColumnSpec[] = [
    { width: { kind: 'flex' }, align: 'center' },
    { width: { kind: 'flex' }, align: 'center' },
  ];

  const dataRows: RowSpec[] = klLoenaftalerRaekker.map((row) => ({
    cells: [{ text: row.fraDato }, { text: formatReguleringPct(row.reguleringPct) }],
  }));

  if (dataRows.length === 0) {
    dataRows.push({ cells: [{ text: 'Ingen lønaftaler tilgængelige.' }, { text: '' }] });
  }

  writer.addTable({
    columns,
    hasHeaderRow: true,
    rows: [{ kind: 'header', cells: [{ text: 'Dato' }, { text: 'Regulering' }] }, ...dataRows],
  });

  },
});
