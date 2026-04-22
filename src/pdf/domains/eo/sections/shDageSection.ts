import type jsPDF from 'jspdf';
import type { RowInput } from 'jspdf-autotable';
import { resolvePdfSectionEndY } from '../../../shared/pdfHelpers';
import { formatUtcDateLong, formatIsoDateLong as formatDateLong, WEEKDAY_NAMES_DA } from '../../../../utils/dateFormatting';
import {
  createPdfDistributedColumnStyles,
  createPdfTableCell,
  createPdfTableHeaderCell,
  createPdfTableSummedTotalRow,
  renderPdfTable,
} from '../../../shared/pdfTableRenderer';
import { PDF_TABLE_NARROW_COLUMN_WIDTH } from '../../../infrastructure/pdfConfig';
import type { ISODateString } from '../../../../types/branded';
import { findNamedHolidaysInIsoRanges } from '../../../../domain/dates/shDageOversigt';
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
  startBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, nextLineHeight?: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  safeAddWrappedText: (text: string) => void;
  writer: Readonly<{
    addSectionSpacer: () => void;
    addSpacer: (height: number) => void;
    setY: (y: number) => void;
    getY: () => number;
    getDoc: () => jsPDF;
  }>;
}>;

const formatDateFromDateObjectLong = (date: Date): string => formatUtcDateLong(date);

const findHelligdageInRange = (fra: ISODateString | undefined, til: ISODateString | undefined): SHDageTableRow[] => {
  if (!fra || !til || fra > til) return [];

  return findNamedHolidaysInIsoRanges([{ fra, til }]).map(({ date, navn, erHverdag }) => ({
    ugedag: WEEKDAY_NAMES_DA[date.getUTCDay()],
    datoDisplay: formatDateFromDateObjectLong(date),
    helligdagNavn: navn,
    erSHDag: erHverdag,
  }));
};

const findHelligdageInRanges = (ranges: readonly IsoRange[]): SHDageTableRow[] => {
  return findNamedHolidaysInIsoRanges(ranges).map(({ date, navn, erHverdag }) => ({
    ugedag: WEEKDAY_NAMES_DA[date.getUTCDay()],
    datoDisplay: formatDateFromDateObjectLong(date),
    helligdagNavn: navn,
    erSHDag: erHverdag,
  }));
};

export const renderShDageSection = (ctx: SHDageSectionContext): void => {
  const {
    eoValues,
    tafRanges,
    sfggReferenceperiodeRanges = [],
    harSfggReferenceperiodeMedShFradrag = false,
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
        preserveValueColumn: true,
      }
    );
    const totalRowIndex = totalRow ? tableRows.length : null;
    if (totalRow) {
      tableRows.push(totalRow.row);
    }

    const doc = writer.getDoc();
    const startY = writer.getY();
    const finalY = renderPdfTable({
      doc,
      startY,
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
    writer.setY(resolvePdfSectionEndY(finalY, startY));
  };

  startBilagPage('SH-dage');

  safeAddWrappedText(
    eoValues.beregnesUdFra === 'Beregningsperiode'
      ? 'Helligdage i de viste perioder. SH-dage er helligdage, der falder på hverdage (mandag-fredag).'
      : 'Helligdage, der falder på hverdage (mandag-fredag).'
  );
  writer.addSectionSpacer();

  const renderPeriodeSection = (label: string, fra: ISODateString | undefined, til: ISODateString | undefined) => {
    renderSubheader(label, undefined, { addTopSpacing: false });
    if (!fra || !til || fra > til) {
      safeAddWrappedText('Ingen periode');
      return;
    }
    safeAddWrappedText(formatRangeLong(fra, til));
    const helligdage = findHelligdageInRange(fra, til);
    if (helligdage.length === 0) {
      safeAddWrappedText('Ingen helligdage');
      return;
    }
    renderShDageTable(helligdage);
  };

  const erFoersteOpgoerelse = erDetteFoersteErstatningsopgoerelse(eoValues.eoNummer);
  const beregningsperiodeRange =
    eoValues.beregnesUdFra === 'Beregningsperiode' ? buildBeregningsperiodeRange(eoValues) : undefined;
  const mergedSfggReferenceperiodeRanges = mergeIsoDateRanges(sfggReferenceperiodeRanges, { mergeAdjacent: true });

  if (erFoersteOpgoerelse && beregningsperiodeRange && harSfggReferenceperiodeMedShFradrag) {
    renderPeriodeSection('Beregningsperiode', beregningsperiodeRange.fra, beregningsperiodeRange.til);
    writer.addSectionSpacer();
  }

  renderSubheader('TAF-periode', undefined, { addTopSpacing: false });
  if (tafRanges.length === 0) {
    safeAddWrappedText('Ingen periode');
  } else {
    formatRangesLong(tafRanges).forEach((line) => safeAddWrappedText(line));
    const tafHelligdage = findHelligdageInRanges(tafRanges);
    if (tafHelligdage.length === 0) {
      safeAddWrappedText('Ingen helligdage');
    } else {
      renderShDageTable(tafHelligdage);
    }
  }

  const sfggHelligdage = findHelligdageInRanges(mergedSfggReferenceperiodeRanges);
  const harSfggShDage = sfggHelligdage.some((row) => row.erSHDag);
  if (mergedSfggReferenceperiodeRanges.length > 0 && harSfggReferenceperiodeMedShFradrag && harSfggShDage) {
    renderSubheader('SFGG-referenceperiode', undefined, { addTopSpacing: false });
    formatRangesLong(mergedSfggReferenceperiodeRanges).forEach((line) => safeAddWrappedText(line));
    renderShDageTable(sfggHelligdage);
  }
};
