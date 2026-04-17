import type jsPDF from 'jspdf';
import type { RowInput } from 'jspdf-autotable';
import { formatUtcDateLong, formatIsoDateLong as formatDateLong, WEEKDAY_NAMES_DA } from '../../../../utils/dateFormatting';
import {
  createPdfDistributedColumnStyles,
  createPdfTableCell,
  createPdfTableHeaderCell,
  createPdfTableSummedTotalRow,
  renderEoStylePdfTable,
} from '../../../shared/pdfTableRenderer';
import { PDF_TABLE_NARROW_COLUMN_WIDTH } from '../../../infrastructure/pdfConfig';
import { parseISODate, type ISODateString } from '../../../../types/branded';
import { beregnHelligdageMedNavn } from '../../../../domain/dates/shDageBeregning';
import type { ErstatningsopgoerelseValues } from '../../../../schemas/formSchemas';
import { buildBeregningsperiodeRange } from '../../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import type { IsoRange } from '../../../../domain/erstatningsopgoerelse/validation/tafPeriodConstraints';
import { erDetteFoersteErstatningsopgoerelse } from '../../../../domain/erstatningsopgoerelse/validation/eoNummerValidering';
import { mergeIsoDateRanges } from '../../../../domain/erstatningsopgoerelse/engines/periodMerging';

type SHDageTableRow = Readonly<{
  ugedag: string;
  datoDisplay: string;
  helligdagNavn: string;
  erSHDag: boolean;
}>;

type SHDageSectionContext = Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  tafRanges: readonly IsoRange[];
  sfggReferenceperiodeRanges?: readonly IsoRange[];
  harSfggReferenceperiodeMedShFradrag?: boolean;
  lineHeight: number;
  startBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  safeAddWrappedText: (text: string) => void;
  writer: Readonly<{
    addSpacer: (height: number) => void;
    setY: (y: number) => void;
    getY: () => number;
    getDoc: () => jsPDF;
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

const findHelligdageInRanges = (ranges: readonly IsoRange[]): SHDageTableRow[] => {
  const mergedRanges = mergeIsoDateRanges(ranges, { mergeAdjacent: true });
  if (mergedRanges.length === 0) return [];

  const rows: SHDageTableRow[] = [];
  const seen = new Set<string>();

  for (const range of mergedRanges) {
    for (const row of findHelligdageInRange(range.fra, range.til)) {
      const key = `${row.datoDisplay}|${row.helligdagNavn}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }

  return rows;
};

export const renderShDageSection = (ctx: SHDageSectionContext): void => {
  const {
    eoValues,
    tafRanges,
    sfggReferenceperiodeRanges = [],
    harSfggReferenceperiodeMedShFradrag = false,
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
  const formatRangesLong = (ranges: readonly IsoRange[]): string[] => ranges.map((range) => formatRangeLong(range.fra, range.til));

  const renderShDageTable = (rows: readonly SHDageTableRow[]) => {
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

    const totalRow = createPdfTableSummedTotalRow(
      'SH-dage i alt',
      rows.map((row) => (row.erSHDag ? 1 : 0)),
      {
        columnCount: 4,
        valueColumnIndex: 3,
        formatValue: (total) => String(total),
        valueAlign: 'center',
      }
    );
    const totalRowIndex = totalRow ? tableRows.length : null;
    if (totalRow) {
      tableRows.push(totalRow.row);
    }

    const doc = writer.getDoc();
    const finalY = renderEoStylePdfTable({
      doc,
      startY: writer.getY(),
      body: tableRows,
      columnStyles: createPdfDistributedColumnStyles(4, {
        fixedColumns: {
          3: PDF_TABLE_NARROW_COLUMN_WIDTH,
        },
      }),
      underlinedCellPositions: totalRowIndex === null || totalRow === null
        ? []
        : [{ rowIndex: totalRowIndex, columnIndex: totalRow.valueCellColumnIndex }],
    });
    writer.setY(finalY + lineHeight);
  };

  startBilagPage('SH-dage');

  writer.addSpacer(lineHeight);
  safeAddWrappedText(
    eoValues.beregnesUdFra === 'Beregningsperiode'
      ? 'Helligdage i de viste perioder. SH-dage er helligdage, der falder på hverdage (mandag-fredag).'
      : 'Helligdage, der falder på hverdage (mandag-fredag).'
  );
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
  const mergedSfggReferenceperiodeRanges = mergeIsoDateRanges(sfggReferenceperiodeRanges, { mergeAdjacent: true });

  if (erFoersteOpgoerelse && beregningsperiodeRange && harSfggReferenceperiodeMedShFradrag) {
    writer.addSpacer(lineHeight);
    renderPeriodeSection('Beregningsperiode', beregningsperiodeRange.fra, beregningsperiodeRange.til);
    writer.addSpacer(lineHeight);
  }

  renderSubheader('TAF-periode', lineHeight, { addTopSpacing: false });
  if (tafRanges.length === 0) {
    safeAddWrappedText('Ingen periode');
    writer.addSpacer(lineHeight);
  } else {
    formatRangesLong(tafRanges).forEach((line) => safeAddWrappedText(line));
    const tafHelligdage = findHelligdageInRanges(tafRanges);
    if (tafHelligdage.length === 0) {
      safeAddWrappedText('Ingen helligdage');
      writer.addSpacer(lineHeight);
    } else {
      renderShDageTable(tafHelligdage);
      writer.addSpacer(lineHeight);
    }
  }

  const sfggHelligdage = findHelligdageInRanges(mergedSfggReferenceperiodeRanges);
  const harSfggShDage = sfggHelligdage.some((row) => row.erSHDag);
  if (mergedSfggReferenceperiodeRanges.length > 0 && harSfggReferenceperiodeMedShFradrag && harSfggShDage) {
    writer.addSpacer(lineHeight);
    renderSubheader('SFGG-referenceperiode', lineHeight, { addTopSpacing: false });
    formatRangesLong(mergedSfggReferenceperiodeRanges).forEach((line) => safeAddWrappedText(line));
    renderShDageTable(sfggHelligdage);
    writer.addSpacer(lineHeight);
  }
};
