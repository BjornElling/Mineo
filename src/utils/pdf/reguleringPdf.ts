/**
 * PDF Generator for Regulering
 *
 * Genererer PDF-dokument med reguleringssatser for overenskomst/statistik
 */

import jsPDF from 'jspdf';
import type { RowInput } from 'jspdf-autotable';
import {
  resolvePdfSectionEndY,
  PDF_BASE_LINE_HEIGHT_MM,
  type BrevhovedData,
} from './pdfHelpers';
import { createStandardPdfWriter } from './pdfWriter';
import { renderEoStylePdfTable } from './pdfTableRenderer';
import { formatAsAmount, formatCurrency, formatPercent } from '../formatUtils';
import { parseDanishDate, formatDanishDate, createDate } from '../dateUtils';
import { roundByMethod } from '../rounding';
import { aarsloenMax } from '../../data/regulationRates';
import { TODAY } from '../../config/dateRanges';
import {
  formatAmountWithoutTrailingDecimals,
  resolveStatistikModelId,
} from '../../domain/erstatningsopgoerelse/sharedPdfUtils';
import {
  getEffektiveSatserForPeriode,
  getOffentligTillaegsSatserForDato,
  getOffentligTillaegsSatserForPeriode,
  getOverenskomst,
  getOffentligOverenskomstTypeById,
  resolveOverenskomstRef,
  type OverenskomstId,
} from '../../data/overenskomstRates';
import { getOffentligLoenForPeriode } from '../../data/offentligLoenLookup';
import { toLoentrin, type Loengruppe } from '../../data/offentligLoenTypes';
import {
  getStatistiskLoenudvikling,
  type StatistiskLoenudviklingId,
} from '../../data/statistiskLoenudviklingRates';
import type { DanishDateString } from '../../types/branded';
import type { PdfCommonOptions, PdfStamdata } from './pdfOptions';
import { resolvePdfFileName, sanitizeFilenamePart } from './pdfFormatUtils';

type ReguleringPdfParams = Readonly<{
  overenskomstLabel: string;
  loenudviklingBasis: 'Overenskomst' | 'Statistik';
  overenskomstId: string | undefined;
  statistikModelLabel: string | undefined;
  interval: Readonly<{ fraDato: DanishDateString; tilDato: DanishDateString }>;
  applyAlmindeligLoenPaaShDageRegel: boolean;
  offentligLoenType?: string;
  offentligLoenTrin?: number;
  offentligLoenGruppe?: number;
  offentligLoenEkstraGrundloen?: number;
}> &
  PdfCommonOptions &
  Readonly<{ stamdata?: PdfStamdata | null }>;

type TableColumn = Readonly<{
  header: string;
}>;

export const buildReguleringPdfFilename = (params: Readonly<{
  loenudviklingBasis: 'Overenskomst' | 'Statistik';
  valgtLabel: string;
  interval: Readonly<{ fraDato: DanishDateString; tilDato: DanishDateString }>;
}>): string => {
  const basisTekst = params.loenudviklingBasis === 'Statistik' ? 'Statistik' : 'Overenskomst';
  const labelPart = sanitizeFilenamePart(params.valgtLabel);
  const intervalPart = sanitizeFilenamePart(`${params.interval.fraDato} til ${params.interval.tilDato}`);
  return resolvePdfFileName(`Regulering - ${basisTekst} - ${labelPart} (${intervalPart})`, false);
};

const resolveOffentligLoenInfoLine = (params: Readonly<{
  overenskomstId: string | undefined;
  loenTrin: number | undefined;
  loenGruppe: number | undefined;
}>): string | null => {
  const { overenskomstId, loenTrin, loenGruppe } = params;
  if (!overenskomstId) return null;
  const offentligType = getOffentligOverenskomstTypeById(overenskomstId);
  if (!offentligType) return null;
  if (typeof loenTrin !== 'number' || typeof loenGruppe !== 'number') return null;
  if (loenGruppe < 0 || loenGruppe > 4) return null;
  try {
    const loentrin = toLoentrin(loenTrin);
    const loentrinDisplay = loentrin === '55+' ? loentrin : String(loentrin);
    return `Løntrin ${loentrinDisplay}, Gruppe ${loenGruppe}`;
  } catch {
    return null;
  }
};

const resolveOffentligLoenEkstraGrundloenTekst = (params: Readonly<{
  overenskomstId: string | undefined;
  offentligLoenType: string | undefined;
  offentligLoenEkstraGrundloen: number | undefined;
}>): string | null => {
  const { overenskomstId, offentligLoenType, offentligLoenEkstraGrundloen } = params;
  if (!overenskomstId) return null;
  if (!getOffentligOverenskomstTypeById(overenskomstId)) return null;
  if (typeof offentligLoenEkstraGrundloen !== 'number' || !Number.isFinite(offentligLoenEkstraGrundloen)) return null;
  if (offentligLoenEkstraGrundloen <= 0) return null;

  const enhed = offentligLoenType === 'Timeløn' ? 'time' : 'måned';
  const udenDecimaler = formatAmountWithoutTrailingDecimals(offentligLoenEkstraGrundloen);
  return `${udenDecimaler} kr./${enhed}`;
};

const resolveStatistikModelIdFromLabel = (
  label: string
): StatistiskLoenudviklingId | undefined => resolveStatistikModelId(label);

const formatOverenskomstPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  const pct = roundByMethod(value * 100, 2, 'halfAwayFromZero');
  return formatPercent(pct);
};

const formatOverenskomstAmount = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return formatCurrency(value);
};

const formatIndexValue = (value: number): string => {
  return formatAsAmount(roundByMethod(value, 1, 'halfAwayFromZero'), 1);
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
  doc: jsPDF,
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

  const finalY = renderEoStylePdfTable({
    doc,
    startY,
    body: tableRows,
    columnStyles,
    didParseCell: (data) => {
      data.cell.styles.halign = 'center';
    },
  });

  return resolvePdfSectionEndY(finalY, startY);
};

const buildOverenskomstTable = (
  overenskomstId: string,
  interval: Readonly<{ fraDato: DanishDateString; tilDato: DanishDateString }>,
  applyAlmindeligLoenPaaShDageRegel: boolean,
  offentlig: Readonly<{
    loenType?: string;
    loenTrin?: number;
    loenGruppe?: number;
  }>
): { columns: TableColumn[]; rows: string[][] } | null => {
  const offentligType = getOffentligOverenskomstTypeById(overenskomstId);
  if (offentligType) {
    const trinValue = offentlig.loenTrin;
    const gruppeValue = offentlig.loenGruppe;
    if (typeof trinValue !== 'number' || typeof gruppeValue !== 'number') return null;
    if (gruppeValue < 0 || gruppeValue > 4) return null;
    let loentrin: ReturnType<typeof toLoentrin>;
    const loengruppe = gruppeValue as Loengruppe;
    try {
      loentrin = toLoentrin(trinValue);
    } catch {
      return null;
    }

    const satser = getOffentligLoenForPeriode(offentligType, interval.fraDato, interval.tilDato, loentrin, loengruppe)
      .slice()
      .reverse();
    const tillaegsSatser = getOffentligTillaegsSatserForPeriode(
      overenskomstId,
      interval.fraDato,
      interval.tilDato,
      applyAlmindeligLoenPaaShDageRegel
    );
    const hasShSo = tillaegsSatser.some((sats) => sats.shSoSats !== null);
    const hasFritvalg = tillaegsSatser.some((sats) => sats.fritvalg !== null);
    const hasAgPension = tillaegsSatser.some((sats) => sats.agPension !== null);

    const columns: TableColumn[] = [
      { header: 'Fra-dato' },
      { header: 'Månedsløn' },
      { header: 'Timeløn' },
      ...(hasShSo ? [{ header: 'SH/SO' }] : []),
      ...(hasFritvalg ? [{ header: 'Fritvalg' }] : []),
      ...(hasAgPension ? [{ header: 'AG pension' }] : []),
    ];

    const rows = satser.map((sats) => {
      const tillaegSats = getOffentligTillaegsSatserForDato(
        overenskomstId,
        sats.effectiveDate,
        applyAlmindeligLoenPaaShDageRegel
      );
      return [
        sats.effectiveDate,
        formatCurrency(sats.maanedsLoen),
        formatCurrency(sats.timeLoen),
        ...(hasShSo ? [formatOverenskomstPercent(tillaegSats?.shSoSats)] : []),
        ...(hasFritvalg ? [formatOverenskomstPercent(tillaegSats?.fritvalg)] : []),
        ...(hasAgPension ? [formatOverenskomstPercent(tillaegSats?.agPension)] : []),
      ];
    });

    return { columns, rows };
  }

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
    for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
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
      const startDate = formatDanishDate(createDate(year, month - 1, 1));
      return [
        value.kvartal,
        startDate,
        formatIndexValue(value.indeksvaerdi),
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
    offentligLoenType,
    offentligLoenTrin,
    offentligLoenGruppe,
    offentligLoenEkstraGrundloen,
    visBrevhoved = false,
    stamdata = null,
  } = params;

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');
  const doc = writer.getDoc();

  writer.setProperties({
    title: 'Regulering',
    subject: 'Erstatningsberegning',
    author: 'Mineo',
    creator: 'mineo.dk',
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

  writer.writeTitle('Regulering');

  const valgtLabel =
    loenudviklingBasis === 'Statistik'
      ? (statistikModelLabel?.trim() || '-')
      : (overenskomstLabel.trim() || '-');
  writer.writeWrappedText(valgtLabel);

  const offentligInfoLine = resolveOffentligLoenInfoLine({
    overenskomstId,
    loenTrin: offentligLoenTrin,
    loenGruppe: offentligLoenGruppe,
  });
  if (offentligInfoLine) {
    writer.writeWrappedText(offentligInfoLine);
  }
  const offentligLoenEkstraGrundloenTekst = resolveOffentligLoenEkstraGrundloenTekst({
    overenskomstId,
    offentligLoenType,
    offentligLoenEkstraGrundloen,
  });

  if (offentligLoenEkstraGrundloenTekst) {
    writer.writeSubheader('Forhøjet grundløn', 2 * PDF_BASE_LINE_HEIGHT_MM);
    writer.writeWrappedText('Skadelidtes grundløn er forhøjet sammenholdt med nedenstående løntrin.');
    writer.writeWrappedText(`Forhøjelsen udgør ${offentligLoenEkstraGrundloenTekst}.`);
  }

  writer.addSpacer(PDF_BASE_LINE_HEIGHT_MM - 1);

  let tableData: { columns: TableColumn[]; rows: string[][] } | null = null;

  if (loenudviklingBasis === 'Overenskomst' && overenskomstId) {
    tableData = buildOverenskomstTable(overenskomstId, interval, applyAlmindeligLoenPaaShDageRegel, {
      loenType: offentligLoenType,
      loenTrin: offentligLoenTrin,
      loenGruppe: offentligLoenGruppe,
    });
  }

  if (loenudviklingBasis === 'Statistik' && statistikModelLabel) {
    tableData = buildStatistikTable(statistikModelLabel, interval);
  }

  if (tableData) {
    const startY = writer.getY();
    const nextY = addReguleringTable(doc, tableData.columns, tableData.rows, startY);
    writer.setY(nextY);
  }

  writer.addFooter();
  writer.save(buildReguleringPdfFilename({ loenudviklingBasis, valgtLabel, interval }));
};
