/**
 * PDF Generator for Regulering
 *
 * Genererer PDF-dokument med reguleringssatser for overenskomst/statistik
 */

import jsPDF from 'jspdf';
import autoTable, { type CellHookData, type RowInput } from 'jspdf-autotable';
import { COLORS, MARGINS, FONT_SIZES, TABLE_STYLES, SECTION_SPACER } from './pdfConfig';
import { addTitle, addFooter, addBrevhoved, type BrevhovedData } from './pdfHelpers';
import { formatCurrency, formatPercent } from '../formatUtils';
import { parseDanishDate, formatDanishDate } from '../dateUtils';
import { aarsloenMax } from '../../data/regulationRates';
import {
  getEffektiveSatserForPeriode,
  getOverenskomst,
  resolveOverenskomstRef,
  type OverenskomstId,
} from '../../data/overenskomstRates';
import {
  getStatistiskLoenudvikling,
  type StatistiskLoenudviklingId,
} from '../../data/statistiskLoenudviklingRates';
import type { DanishDateString, ISODateString } from '../../types/branded';

/**
 * Stamdata til Regulering PDF
 */
export interface ReguleringStamdata {
  skadelidte?: string;
  skadestype?: string;
  skadesdato?: ISODateString;
  journalnr?: string;
}

type PdfDoc = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};

type ReguleringPdfParams = Readonly<{
  overenskomstLabel: string;
  loenudviklingBasis: 'Overenskomst' | 'Statistik';
  overenskomstId: string | undefined;
  statistikModelLabel: string | undefined;
  interval: Readonly<{ fraDato: DanishDateString; tilDato: DanishDateString }>;
  applyAlmindeligLoenPaaShDageRegel: boolean;
  visBrevhoved?: boolean;
  stamdata?: ReguleringStamdata | null;
}>;

type TableColumn = Readonly<{
  header: string;
}>;

const replaceControlChars = (value: string): string => {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    const code = ch.charCodeAt(0);
    out += code >= 0 && code <= 31 ? '_' : ch;
  }
  return out;
};

const sanitizeFilenamePart = (value: string): string => {
  return replaceControlChars(value)
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
};

const resolveStatistikModelIdFromLabel = (
  label: string
): StatistiskLoenudviklingId | undefined => {
  const trimmed = label.trim();
  if (trimmed === '') return undefined;
  if (trimmed.startsWith('ILON12')) return 'ILON12' as StatistiskLoenudviklingId;
  if (trimmed.startsWith('SBLON2')) return 'SBLON2' as StatistiskLoenudviklingId;
  return undefined;
};

const formatOverenskomstPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  const pct = Math.round(value * 10000) / 100;
  return formatPercent(pct);
};

const formatOverenskomstAmount = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return formatCurrency(value);
};

const buildTableRows = (
  columns: ReadonlyArray<TableColumn>,
  rows: ReadonlyArray<ReadonlyArray<string>>
): RowInput[] => {
  const headerRow: RowInput = columns.map((col) => ({
    content: col.header,
    styles: { fontStyle: 'bold', halign: 'center' },
  }));

  const bodyRows: RowInput[] = rows.map((row) =>
    row.map((cell) => ({
      content: cell,
      styles: { halign: 'center' },
    }))
  );

  if (bodyRows.length === 0) {
    bodyRows.push(
      columns.map((_, index) => ({
        content: index === 0 ? 'Ingen reguleringsrækker i intervallet.' : '',
        styles: { halign: 'center' },
      }))
    );
  }

  return [headerRow, ...bodyRows];
};

const addReguleringTable = (
  doc: PdfDoc,
  columns: ReadonlyArray<TableColumn>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
  startY: number
): number => {
  const tableRows = buildTableRows(columns, rows);
  const columnStyles: Record<number, { minCellWidth: number; halign: 'center' }> = Object.fromEntries(
    columns.map((_, index) => [
      index,
      {
        minCellWidth: 22,
        halign: 'center' as const,
      },
    ])
  );

  autoTable(doc, {
    startY,
    head: [],
    body: tableRows,
    margin: { left: MARGINS.left, right: MARGINS.right },
    styles: {
      font: 'helvetica',
      fontSize: TABLE_STYLES.fontSize,
      cellPadding: TABLE_STYLES.cellPadding,
      textColor: COLORS.text,
      halign: 'center',
    },
    columnStyles,
    didParseCell: (data: CellHookData) => {
      if (data.row.index === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.headerBackgroundColor;
      } else if (data.row.index % 2 === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.alternateRowBackgroundColor;
      } else {
        data.cell.styles.fillColor = COLORS.white;
      }
    },
  });

  const finalY = doc.lastAutoTable?.finalY || startY + 50;
  return finalY + SECTION_SPACER;
};

const buildOverenskomstTable = (
  overenskomstId: string,
  interval: Readonly<{ fraDato: DanishDateString; tilDato: DanishDateString }>,
  applyAlmindeligLoenPaaShDageRegel: boolean
): { columns: TableColumn[]; rows: string[][] } | null => {
  const ref = resolveOverenskomstRef(overenskomstId);
  if (!ref) return null;

  const satser = getEffektiveSatserForPeriode({
    overenskomstId: ref.baseId as OverenskomstId,
    fraDato: interval.fraDato,
    tilDato: interval.tilDato,
    applyAlmindeligLoenPaaShDageRegel,
  })
    .slice()
    .reverse();

  const allSatser = getOverenskomst(ref.baseId)?.satser ?? satser;

  const hasGrundloen = allSatser.some((sats) => sats.grundloen !== null);
  const hasShSo = allSatser.some((sats) => sats.shSoSats !== null);
  const hasFritvalg = allSatser.some((sats) => sats.fritvalg !== null);
  const hasAgPension = allSatser.some((sats) => sats.agPension !== null);
  const hasSfgg = allSatser.some((sats) => sats.sfgg !== null);
  const hasSfggFaglKbh = allSatser.some((sats) => sats.sfggFaglKbh !== null);
  const hasSfggFaglProv = allSatser.some((sats) => sats.sfggFaglProv !== null);
  const hasSfggUfaglKbh = allSatser.some((sats) => sats.sfggUfaglKbh !== null);
  const hasSfggUfaglProv = allSatser.some((sats) => sats.sfggUfaglProv !== null);

  const columns: TableColumn[] = [
    { header: 'Fra-dato' },
    ...(hasGrundloen ? [{ header: 'Grundløn' }] : []),
    ...(hasShSo ? [{ header: 'SH/SO' }] : []),
    ...(hasFritvalg ? [{ header: 'Fritvalg' }] : []),
    ...(hasAgPension ? [{ header: 'AG pension' }] : []),
    ...(hasSfgg ? [{ header: 'SFGG' }] : []),
    ...(hasSfggFaglKbh ? [{ header: 'SFGG fagl. Kbh' }] : []),
    ...(hasSfggFaglProv ? [{ header: 'SFGG fagl. prov' }] : []),
    ...(hasSfggUfaglKbh ? [{ header: 'SFGG ufagl. Kbh' }] : []),
    ...(hasSfggUfaglProv ? [{ header: 'SFGG ufagl. prov' }] : []),
  ];

  const rows = satser.map((sats) => {
    const row: string[] = [sats.fraDato];
    if (hasGrundloen) row.push(formatOverenskomstAmount(sats.grundloen));
    if (hasShSo) row.push(formatOverenskomstPercent(sats.shSoSats));
    if (hasFritvalg) row.push(formatOverenskomstPercent(sats.fritvalg));
    if (hasAgPension) row.push(formatOverenskomstPercent(sats.agPension));
    if (hasSfgg) row.push(formatOverenskomstAmount(sats.sfgg));
    if (hasSfggFaglKbh) row.push(formatOverenskomstAmount(sats.sfggFaglKbh));
    if (hasSfggFaglProv) row.push(formatOverenskomstAmount(sats.sfggFaglProv));
    if (hasSfggUfaglKbh) row.push(formatOverenskomstAmount(sats.sfggUfaglKbh));
    if (hasSfggUfaglProv) row.push(formatOverenskomstAmount(sats.sfggUfaglProv));
    return row;
  });

  return { columns, rows };
};

const buildStatistikTable = (
  modelLabel: string,
  interval: Readonly<{ fraDato: DanishDateString; tilDato: DanishDateString }>
): { columns: TableColumn[]; rows: string[][] } | null => {
  const trimmed = modelLabel.trim();
  if (trimmed === '') return null;

  if (trimmed.startsWith('ASL-')) {
    const start = parseDanishDate(interval.fraDato);
    const end = parseDanishDate(interval.tilDato);
    if (!start || !end) return null;

    const rows: string[][] = [];
    for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) {
      const value = aarsloenMax[year as keyof typeof aarsloenMax];
      if (typeof value !== 'number') continue;
      rows.push([String(year), formatCurrency(value)]);
    }

    const columns: TableColumn[] = [
      { header: 'År' },
      { header: 'Maksimum årsløn' },
    ];

    return { columns, rows };
  }

  const modelId = resolveStatistikModelIdFromLabel(trimmed);
  if (!modelId) return null;

  const model = getStatistiskLoenudvikling(modelId);
  if (!model) return null;

  const rows = model.indeksvaerdier
    .slice()
    .reverse()
    .map((value): string[] => {
      const match = value.kvartal.match(/^(\d{4})K([1-4])$/);
      if (!match) return [value.kvartal, '', ''];
      const year = Number(match[1]);
      const quarter = Number(match[2]);
      const month = (quarter - 1) * 3 + 1;
      const startDate = formatDanishDate(new Date(year, month - 1, 1));
      return [
        value.kvartal,
        startDate,
        value.indeks.toLocaleString('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      ];
    });

  const columns: TableColumn[] = [
    { header: 'Kvartal' },
    { header: 'Startdato' },
    { header: 'Indeks' },
  ];

  return { columns, rows };
};

export const generateReguleringPdf = (params: ReguleringPdfParams): void => {
  const {
    overenskomstLabel,
    loenudviklingBasis,
    overenskomstId,
    statistikModelLabel,
    interval,
    applyAlmindeligLoenPaaShDageRegel,
    visBrevhoved = false,
    stamdata = null,
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as PdfDoc;
  doc.setDisplayMode('100%');

  doc.setProperties({
    title: 'Regulering',
    subject: 'Erstatningsberegning',
    author: 'MINEO',
    creator: 'MINEO',
  });

  let currentY = MARGINS.top;

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved && stamdata) {
    const brevhovedData: BrevhovedData = {
      skadelidte: stamdata.skadelidte,
      skadestype: stamdata.skadestype,
      skadesdato: stamdata.skadesdato,
      journalnr: stamdata.journalnr,
    };
    currentY = addBrevhoved(doc, brevhovedData);
  }

  currentY = addTitle(doc, 'Regulering', currentY);

  doc.setFontSize(FONT_SIZES.normal);
  doc.setFont('helvetica', 'normal');
  const valgtLabel =
    loenudviklingBasis === 'Statistik'
      ? (statistikModelLabel?.trim() || '-')
      : (overenskomstLabel.trim() || '-');
  doc.text(valgtLabel, MARGINS.left, currentY);
  currentY += 10;

  let tableData: { columns: TableColumn[]; rows: string[][] } | null = null;

  if (loenudviklingBasis === 'Overenskomst' && overenskomstId) {
    tableData = buildOverenskomstTable(overenskomstId, interval, applyAlmindeligLoenPaaShDageRegel);
  }

  if (loenudviklingBasis === 'Statistik' && statistikModelLabel) {
    tableData = buildStatistikTable(statistikModelLabel, interval);
  }

  if (tableData) {
    currentY = addReguleringTable(doc, tableData.columns, tableData.rows, currentY);
  }

  addFooter(doc);
  const basisTekst = loenudviklingBasis === 'Statistik' ? 'Statistik' : 'Overenskomst';
  const labelPart = sanitizeFilenamePart(valgtLabel);
  const intervalPart = sanitizeFilenamePart(`${interval.fraDato} til ${interval.tilDato}`);
  doc.save(`Regulering - ${basisTekst} - ${labelPart} (${intervalPart}).pdf`);
};
