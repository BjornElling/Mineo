import type jsPDF from 'jspdf';
import type { RowInput } from 'jspdf-autotable';
import { formatUtcDateLong, WEEKDAY_NAMES_DA } from '../../../dateFormatting';
import {
  createPdfTableCell,
  createPdfTableHeaderCell,
  renderEoStylePdfTable,
} from '../../pdfTableRenderer';
import { PDF_TABLE_NARROW_COLUMN_WIDTH } from '../../pdfConfig';
import { parseISODate, type ISODateString } from '../../../../types/branded';
import { beregnHelligdageMedNavn } from '../../../shDageBeregning';
import { formatDateLong } from '../../../../domain/erstatningsopgoerelse/sharedPdfUtils';
import type { ErstatningsopgoerelseValues } from '../../../../schemas/formSchemas';
import { buildBeregningsperiodeRange } from '../../../../domain/erstatningsopgoerelse/indtaegtPerioder';
import type { IsoRange } from '../../../../domain/erstatningsopgoerelse/tafPeriodConstraints';
import { erDetteFoersteErstatningsopgoerelse } from '../../../../domain/erstatningsopgoerelse/eoNummerValidering';

type SHDageTableRow = Readonly<{
  ugedag: string;
  datoDisplay: string;
  helligdagNavn: string;
  erSHDag: boolean;
}>;

type SHDageSectionContext = Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  tafRanges: readonly IsoRange[];
  lineHeight: number;
  startBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  safeAddWrappedText: (text: string) => void;
  writer: Readonly<{
    addSpacer: (height: number) => void;
    setY: (y: number) => void;
    getY: () => number;
    getDoc: () => unknown;
  }>;
}>;

const formatDateFromDateObjectLong = (date: Date): string => formatUtcDateLong(date);

const parseIsoDateToUtcDate = (iso: ISODateString | undefined): Date | null => {
  if (!iso) return null;
  return parseISODate(iso) ?? null;
};

const findHelligdageInRange = (fra: ISODateString | undefined, til: ISODateString | undefined): SHDageTableRow[] => {
  const start = parseIsoDateToUtcDate(fra);
  const end = parseIsoDateToUtcDate(til);
  if (!start || !end || start > end) return [];

  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const rows: Array<SHDageTableRow & { sortTs: number }> = [];

  for (let year = startYear; year <= endYear; year += 1) {
    const helligdage = beregnHelligdageMedNavn(year);
    for (const { date: helligdag, navn } of helligdage) {
      if (helligdag < start || helligdag > end) continue;
      const dayOfWeek = helligdag.getUTCDay();
      const erSHDag = dayOfWeek >= 1 && dayOfWeek <= 5;
      rows.push({
        ugedag: WEEKDAY_NAMES_DA[dayOfWeek],
        datoDisplay: formatDateFromDateObjectLong(helligdag),
        helligdagNavn: navn,
        erSHDag,
        sortTs: helligdag.getTime(),
      });
    }
  }

  rows.sort((a, b) => a.sortTs - b.sortTs);
  return rows.map(({ sortTs: _sortTs, ...row }) => row);
};

export const renderShDageSection = (ctx: SHDageSectionContext): void => {
  const {
    eoValues,
    tafRanges,
    lineHeight,
    startBilagPage,
    renderSubheader,
    safeAddWrappedText,
    writer,
  } = ctx;

  const formatRangeLong = (fra: ISODateString | undefined, til: ISODateString | undefined): string => {
    const fraDisplay = formatDateLong(fra);
    const tilDisplay = formatDateLong(til);
    return `${fraDisplay || '-'} - ${tilDisplay || '-'}`;
  };

  const renderShDageTable = (rows: readonly SHDageTableRow[]) => {
    const antalShDage = rows.filter((row) => row.erSHDag).length;
    const tableRows: RowInput[] = [
      [
        createPdfTableHeaderCell('Ugedag', 'left'),
        createPdfTableHeaderCell('Dato', 'left'),
        createPdfTableHeaderCell('Helligdag', 'left'),
        createPdfTableHeaderCell('SH-dag', 'center'),
      ],
    ];

    for (const row of rows) {
      tableRows.push([
        createPdfTableCell(row.ugedag, { halign: 'left' }),
        createPdfTableCell(row.datoDisplay, { halign: 'left' }),
        createPdfTableCell(row.helligdagNavn, { halign: 'left' }),
        createPdfTableCell(row.erSHDag ? 'x' : '', { halign: 'center' }),
      ]);
    }

    tableRows.push([
      createPdfTableCell('SH-dage i alt', { halign: 'left', bold: true, transparent: true }),
      createPdfTableCell('', { bold: true, transparent: true }),
      createPdfTableCell('', { bold: true, transparent: true }),
      createPdfTableCell(String(antalShDage), { halign: 'center', bold: true, transparent: true }),
    ]);

    const doc = writer.getDoc() as jsPDF;
    const finalY = renderEoStylePdfTable({
      doc,
      startY: writer.getY(),
      body: tableRows,
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: PDF_TABLE_NARROW_COLUMN_WIDTH },
      },
      transparentRowIndices: [tableRows.length - 1],
    });
    writer.setY(finalY + lineHeight);
  };

  startBilagPage('SH-dage');

  writer.addSpacer(lineHeight);
  safeAddWrappedText('Helligdage, der falder på hverdage (mandag-fredag).');
  writer.addSpacer(lineHeight);

  const renderPeriodeSection = (label: string, fra: ISODateString | undefined, til: ISODateString | undefined) => {
    renderSubheader(label, lineHeight, { addTopSpacing: false });
    if (!fra || !til || fra > til) {
      safeAddWrappedText('Ingen periode');
      writer.addSpacer(lineHeight);
      return;
    }
    safeAddWrappedText(formatRangeLong(fra, til));
    const helligdage = findHelligdageInRange(fra, til);
    if (helligdage.length === 0) {
      safeAddWrappedText('Ingen helligdage');
      writer.addSpacer(lineHeight);
      return;
    }
    renderShDageTable(helligdage);
    writer.addSpacer(lineHeight);
  };

  const erFoersteOpgoerelse = erDetteFoersteErstatningsopgoerelse(eoValues.eoNummer);
  const beregningsperiodeRange =
    eoValues.beregnesUdFra === 'Beregningsperiode' ? buildBeregningsperiodeRange(eoValues) : undefined;
  const tafFra = tafRanges.length > 0 ? tafRanges[0].fra : undefined;
  const tafTil = tafRanges.length > 0 ? tafRanges[tafRanges.length - 1].til : undefined;

  if (erFoersteOpgoerelse && beregningsperiodeRange) {
    writer.addSpacer(lineHeight);
    renderPeriodeSection('Beregningsperiode', beregningsperiodeRange.fra, beregningsperiodeRange.til);
    writer.addSpacer(lineHeight);
  }

  renderPeriodeSection('TAF-periode', tafFra, tafTil);
};
