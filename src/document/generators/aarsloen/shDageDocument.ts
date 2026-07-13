/**
 * PDF Generator for SH-dage (Søgnehelligdage på hverdage)
 *
 * Genererer PDF-dokument med oversigt over danske helligdage der falder på hverdage
 */

import { PDF_TABLE_NARROW_COLUMN_WIDTH } from '../../layout/pdfConfig';
import { findNamedHolidaysInDateRanges } from '../../../domain/dates/shDageOversigt';
import type { DocumentComposer } from '../../model/documentModel';
import { buildStamdataBrevhovedData, defineDocument } from '../documentGeneratorSetup';
import { DOCUMENT_TABLE_FONT_SIZE_PT } from '../../layout/tableSpec';
import { buildSummedTotalRowSpec, type ColumnSpec, type RowSpec } from '../../layout/tableSpec';
import { formatDanishDate } from '../../../utils/dateUtils';
import { formatUtcDateLong, WEEKDAY_NAMES_DA } from '../../../utils/dateFormatting';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import type { DocumentDownloadFormat } from '../../documentFormat';
import { mergeDateRanges } from '../../../domain/erstatningsopgoerelse/engines/isoRangeAlgebra';
import type { DocumentGenerationSession } from '../../documentGenerationSession';
import type { DocumentArtifact } from '../../downloadArtifact';

type SHDageDocumentOptions = DocumentCommonOptions;
type SHDagePeriod = { start: Date; end: Date };
type SHDagEntry = Readonly<{
  dato: Date;
  ugedag: (typeof WEEKDAY_NAMES_DA)[number];
  helligdagNavn: string;
  erHverdag: boolean;
}>;
type SHDageTableSpec = Readonly<{
  columns: readonly ColumnSpec[];
  rows: RowSpec[];
}>;

const buildSHDagePeriodLabel = (perioder: ReadonlyArray<SHDagePeriod>): string => {
  return perioder
    .map(({ start, end }) => `${formatDanishDate(start)} - ${formatDanishDate(end)}`)
    .join(' + ');
};

export const buildSHDageDocumentFilename = (
  perioder: ReadonlyArray<SHDagePeriod>,
  journalnr?: string,
  format: DocumentDownloadFormat = 'pdf'
): string => {
  const periodLabel = buildSHDagePeriodLabel(perioder);
  const baseTitle = periodLabel.length > 0 ? `SH-dage (${periodLabel})` : 'SH-dage';
  return resolveDocumentArtifactFileName(baseTitle, false, journalnr, format);
};

/**
 * Formater dato til dansk format (d. måned åååå)
 *
 * @param {Date} date - Datoen at formatere
 * @returns {string} Formateret dato
 */
const formatDanskDato = (date: Date): string => formatUtcDateLong(date);

/**
 * Find alle helligdage i de angivne perioder
 *
 * @param {Array} perioder - Array af {start: Date, end: Date}
 * @returns {Array} Array af helligdags-objekter
 */
const findSHDageIPerioder = (perioder: ReadonlyArray<SHDagePeriod>): SHDagEntry[] => {
  return findNamedHolidaysInDateRanges(perioder).map(({ date, navn, erHverdag }) => ({
    dato: date,
    ugedag: WEEKDAY_NAMES_DA[date.getUTCDay()],
    helligdagNavn: navn,
    erHverdag,
  }));
};

/**
 * Sammenlæg overlappende eller sammenhængende perioder
 *
 * @param {Array} perioder - Array af {start: Date, end: Date}
 * @returns {Array} Sammensatte perioder
 */
const sammenlaegPerioder = (perioder: ReadonlyArray<SHDagePeriod>): SHDagePeriod[] => {
  return mergeDateRanges(
    perioder.map((periode) => ({ fra: periode.start, til: periode.end })),
    { mergeAdjacent: true }
  ).map(({ fra, til }) => ({
    start: fra,
    end: til,
  }));
};

/**
 * Formater periode-oversigt som tekst
 *
 * @param {Array} perioder - Array af {start: Date, end: Date}
 * @returns {string} Formateret periode-tekst
 */
const formaterPeriodeOversigt = (perioder: ReadonlyArray<SHDagePeriod>): string => {
  if (!perioder || perioder.length === 0) {
    return '';
  }

  const sammensatte = sammenlaegPerioder(perioder);

  if (sammensatte.length === 1) {
    const { start, end } = sammensatte[0];
    return `${formatDanskDato(start)} - ${formatDanskDato(end)}`;
  } else {
    const periodeTekster = sammensatte.map(({ start, end }) =>
      `${formatDanskDato(start)} - ${formatDanskDato(end)}`
    );
    return periodeTekster.join(', ');
  }
};

export const buildSHDageTableRows = (
  helligdage: ReadonlyArray<SHDagEntry>
): SHDageTableSpec => {
  // Tre venstrejusterede tekst-kolonner + en smal centreret SH-dag-kolonne.
  const columns: readonly ColumnSpec[] = [
    { width: { kind: 'flex' }, align: 'left' },
    { width: { kind: 'flex' }, align: 'left' },
    { width: { kind: 'flex' }, align: 'left' },
    { width: { kind: 'fixed', mm: PDF_TABLE_NARROW_COLUMN_WIDTH }, align: 'center' },
  ];

  const rows: RowSpec[] = [
    {
      kind: 'header',
      cells: [{ text: 'Ugedag' }, { text: 'Dato' }, { text: 'Helligdag' }, { text: 'SH-dag' }],
    },
    // Helligdage der ikke falder på en hverdag dæmpes (tone: 'muted') og tæller ikke som SH-dag.
    ...helligdage.map(({ dato, ugedag, helligdagNavn, erHverdag }): RowSpec => ({
      cells: [
        { text: ugedag },
        { text: formatDanskDato(dato) },
        { text: helligdagNavn },
        { text: erHverdag ? 'x' : '', valign: 'middle', fontSize: DOCUMENT_TABLE_FONT_SIZE_PT },
      ],
      ...(erHverdag ? {} : { tone: 'muted' as const }),
    })),
  ];

  const totalRow = buildSummedTotalRowSpec(
    'SH-dage i alt',
    helligdage.map((helligdag) => (helligdag.erHverdag ? 1 : 0)),
    {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => String(total),
      valueAlign: 'center',
      preserveValueColumn: true,
    }
  );
  if (totalRow) rows.push(totalRow);

  return { columns, rows };
};

/**
 * Generer og download PDF for SH-dage
 *
 * @param {Array} perioder - Array af {start: Date, end: Date} periode-objekter
 * @param {SHDageDocumentOptions} options - Valgfrie indstillinger (inkl. stamdata og brevhoved)
 */
type SHDageDocumentInput = Readonly<{
  perioder: ReadonlyArray<SHDagePeriod>;
  options: SHDageDocumentOptions;
}>;

const generateSHDage = defineDocument<SHDageDocumentInput>({
  title: 'SH-dage',
  filename: ({ perioder, options }, format) =>
    buildSHDageDocumentFilename(perioder, options.stamdata?.journalnr, format),
  brevhoved: ({ options: { visBrevhoved = false, stamdata } }) =>
    visBrevhoved ? buildStamdataBrevhovedData(stamdata) : null,
  body: (writer, { perioder }) => {
    addDescription(writer, perioder);
    const helligdage = findSHDageIPerioder(perioder);

    if (helligdage.length === 0) {
      writer.writeWrappedText('Ingen helligdage fundet i de angivne perioder.');
    } else {
      addSHDageTable(writer, helligdage);
      addExplanationText(writer);
    }
  },
});

export const generateSHDageDocument = (
  session: DocumentGenerationSession,
  perioder: ReadonlyArray<SHDagePeriod>,
  options: SHDageDocumentOptions = {}
): Promise<DocumentArtifact> => {
  return generateSHDage(session, { perioder, options });
};


/**
 * Tilføj periode-beskrivelse
 */
const addDescription = (writer: DocumentComposer, perioder: ReadonlyArray<SHDagePeriod>): void => {
  const periodeTekst = formaterPeriodeOversigt(perioder);
  writer.writeWrappedText(`Periode: ${periodeTekst}`);
  writer.addSectionSpacer();
};

/**
 * Tilføj SH-dage tabel
 */
const addSHDageTable = (writer: DocumentComposer, helligdage: ReadonlyArray<SHDagEntry>): void => {
  const { columns, rows } = buildSHDageTableRows(helligdage);
  writer.addTable({ columns, hasHeaderRow: true, rows });
};

/**
 * Tilføj forklaringstekst
 */
const addExplanationText = (writer: DocumentComposer): void => {
  writer.writeBoldSubheader('Forklaring');

  const explanations = [
    'Søgnehelligdage er helligdage, der falder på hverdage (mandag-fredag).',
    'Helligdage, der falder i weekenden, fremgår af tabellen men medregnes ikke.',
  ];

  for (const explanation of explanations) {
    writer.writeWrappedText(explanation);
  }
};
