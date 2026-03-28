import type jsPDF from 'jspdf';
import type { RowInput } from 'jspdf-autotable';
import { amountValueToDisplayString, amountValueToNumber } from '../../../expressionAmount';
import { formatAsAmount } from '../../../formatUtils';
import { PDF_CONTENT_WIDTH_MM } from '../../pdfConfig';
import { ydelsestyper } from '../../../../data/ydelsestyper';
import { getOffentligeYdelserErrorRowIdSet } from '../../../../domain/erstatningsopgoerelse/indkomstRowValidation';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../../schemas/formSchemas';
import { buildPeriodRangeGroups, normalizeBilagIndkomstYdelserMode, type IsoRange } from '../../../../domain/erstatningsopgoerelse/periodRangeGroups';
import { renderEoStylePdfTable } from '../../pdfTableRenderer';
import { OFFENTLIGE_YDELSER_PDF_HEADERS } from '../../../../domain/erstatningsopgoerelse/offentligeYdelserTableColumns';

type BilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];

type OffentligeYdelserSectionContext = Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  lineHeight: number;
  startBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  shouldIncludeOffentligYdelseRowInBilag: (params: Readonly<{
    row: OffentligeYdelserRow;
    mode: BilagLoenindkomstOgOffentligeYdelserIndgaar;
    ranges: readonly IsoRange[];
    errorRowIds: ReadonlySet<string>;
  }>) => boolean;
  bilagIndkomstYdelserMode: BilagLoenindkomstOgOffentligeYdelserIndgaar;
  bilagIndkomstYdelserRanges: readonly IsoRange[];
  writer: Readonly<{
    addSpacer: (height: number) => void;
    setY: (y: number) => void;
    getY: () => number;
    getDoc: () => unknown;
  }>;
}>;

export const renderOffentligeYdelserSection = (ctx: OffentligeYdelserSectionContext): void => {
  const {
    eoValues,
    lineHeight,
    startBilagPage,
    renderSubheader,
    shouldIncludeOffentligYdelseRowInBilag,
    bilagIndkomstYdelserMode,
    bilagIndkomstYdelserRanges,
    writer,
  } = ctx;
  const normalizedBilagMode = normalizeBilagIndkomstYdelserMode(bilagIndkomstYdelserMode);

  const offentligeErrorRowIds = getOffentligeYdelserErrorRowIdSet(eoValues.offentligeYdelserRows ?? []);

  const renderOffentligeYdelserTable = (rowsToRender: readonly OffentligeYdelserRow[]) => {
    const headerRow: RowInput = OFFENTLIGE_YDELSER_PDF_HEADERS.map((header) => ({
      content: header,
      styles: { fontStyle: 'bold', halign: 'center' as const },
    }));

    const buildTableRows = (groupRows: OffentligeYdelserRow[]): RowInput[] => {
      const tableRows: RowInput[] = [headerRow];
      for (const row of groupRows) {
        const ydelseValue = amountValueToNumber(row.ydelse) ?? 0;
        const ydelse2Value = amountValueToNumber(row.tillaeg) ?? 0;
        const samletValue = ydelseValue + ydelse2Value;
        const samletDisplay = row.ydelse !== undefined || row.tillaeg !== undefined ? formatAsAmount(samletValue, 2) : '';
        const rowValues = [
          row.fraDato?.trim() ?? '',
          row.tilDato?.trim() ?? '',
          amountValueToDisplayString(row.ydelse, 2),
          amountValueToDisplayString(row.tillaeg, 2),
          samletDisplay,
        ];
        tableRows.push(
          rowValues.map((value, index) => {
            const halign: 'center' | 'left' | 'right' = index <= 1 ? 'center' : 'right';
            return {
              content: value,
              styles: { halign },
            };
          })
        );
      }
      return tableRows;
    };

    const grouped = new Map<string, OffentligeYdelserRow[]>();
    const groupOrder: string[] = [];
    for (const row of rowsToRender) {
      const ydelsestypeKey = row.ydelsestype?.trim() ?? '';
      const ydelsestypeLabel = ydelsestypeKey ? (ydelsestyper[ydelsestypeKey]?.label ?? ydelsestypeKey) : 'Ikke angivet';
      if (!grouped.has(ydelsestypeLabel)) {
        grouped.set(ydelsestypeLabel, []);
        groupOrder.push(ydelsestypeLabel);
      }
      grouped.get(ydelsestypeLabel)?.push(row);
    }

    const doc = writer.getDoc() as jsPDF;
    const equalColumnWidth = PDF_CONTENT_WIDTH_MM / OFFENTLIGE_YDELSER_PDF_HEADERS.length;
    const columnStyles = Object.fromEntries(
      Array.from({ length: OFFENTLIGE_YDELSER_PDF_HEADERS.length }, (_, index) => [index, { cellWidth: equalColumnWidth }])
    );

    for (const [index, label] of groupOrder.entries()) {
      if (index > 0) writer.addSpacer(lineHeight);
      renderSubheader(label, lineHeight, { addTopSpacing: index > 0 });
      const tableRows = buildTableRows(grouped.get(label) ?? []);
      const finalY = renderEoStylePdfTable({
        doc,
        startY: writer.getY(),
        body: tableRows,
        columnStyles,
      });
      writer.setY(finalY + lineHeight);
    }
  };

  const rangeGroups = buildPeriodRangeGroups(eoValues, bilagIndkomstYdelserMode, bilagIndkomstYdelserRanges);
  const groupedRows = rangeGroups.map((group) => ({
    group,
    rows: (eoValues.offentligeYdelserRows ?? []).filter((row) => {
      return shouldIncludeOffentligYdelseRowInBilag({
        row,
        mode: normalizedBilagMode,
        ranges: group.ranges,
        errorRowIds: offentligeErrorRowIds,
      });
    }),
  })).filter((entry) => entry.rows.length > 0);
  const skalVisePeriodeSubheadings = groupedRows.length > 1;

  if (groupedRows.length === 0) return;

  startBilagPage('Offentlige ydelser');
  writer.addSpacer(lineHeight);
  for (const [index, entry] of groupedRows.entries()) {
    if (skalVisePeriodeSubheadings && entry.group.label) {
      if (index > 0) writer.addSpacer(lineHeight);
      renderSubheader(entry.group.label, lineHeight, { addTopSpacing: index > 0 });
      writer.addSpacer(lineHeight);
    }
    renderOffentligeYdelserTable(entry.rows);
  }
};
