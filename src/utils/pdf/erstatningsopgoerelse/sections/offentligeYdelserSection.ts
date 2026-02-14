import type { RowInput } from 'jspdf-autotable';
import { amountValueToDisplayString, amountValueToNumber } from '../../../expressionAmount';
import { formatAsAmount } from '../../../formatUtils';
import { ydelsestyper } from '../../../../data/ydelsestyper';
import { getOffentligeYdelserErrorRowIdSet } from '../../../../domain/erstatningsopgoerelse/indkomstRowValidation';
import type { ISODateString } from '../../../../types/branded';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../../schemas/formSchemas';

type BilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];
type IsoRange = Readonly<{ fra: ISODateString; til: ISODateString }>;

const OFFENTLIGE_YDELSER_HEADERS = [
  'Fra-dato',
  'Til-dato',
  'Ydelse',
  'Evt. tillæg',
  'I alt',
  'Ydelsestype',
] as const;

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
  renderStandardPdfTable: (params: Readonly<{
    doc: unknown;
    startY: number;
    body: RowInput[];
    columnStyles?: unknown;
  }>) => number;
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
    renderStandardPdfTable,
    writer,
  } = ctx;

  const offentligeErrorRowIds = getOffentligeYdelserErrorRowIdSet(eoValues.offentligeYdelserRows ?? []);
  const rows = (eoValues.offentligeYdelserRows ?? []).filter((row) => {
    return shouldIncludeOffentligYdelseRowInBilag({
      row,
      mode: bilagIndkomstYdelserMode,
      ranges: bilagIndkomstYdelserRanges,
      errorRowIds: offentligeErrorRowIds,
    });
  });

  const renderOffentligeYdelserTable = (rowsToRender: readonly OffentligeYdelserRow[]) => {
    const headerRow: RowInput = OFFENTLIGE_YDELSER_HEADERS.map((header) => ({
      content: header,
      styles: { fontStyle: 'bold', halign: 'center' as const },
    }));

    const buildTableRows = (groupRows: OffentligeYdelserRow[]): RowInput[] => {
      const tableRows: RowInput[] = [headerRow];
      for (const row of groupRows) {
        const ydelsestypeKey = row.ydelsestype?.trim() ?? '';
        const ydelsestypeLabel = ydelsestypeKey ? (ydelsestyper[ydelsestypeKey]?.label ?? ydelsestypeKey) : '';
        const ydelseValue = amountValueToNumber(row.ydelse) ?? 0;
        const tillaegValue = amountValueToNumber(row.tillaeg) ?? 0;
        const samletValue = ydelseValue + tillaegValue;
        const samletDisplay = row.ydelse !== undefined || row.tillaeg !== undefined ? formatAsAmount(samletValue, 2) : '';
        const rowValues = [
          row.fraDato?.trim() ?? '',
          row.tilDato?.trim() ?? '',
          amountValueToDisplayString(row.ydelse, 2),
          amountValueToDisplayString(row.tillaeg, 2),
          samletDisplay,
          ydelsestypeLabel,
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

    const doc = writer.getDoc();
    const columnStyles = {
      0: { cellWidth: 29 },
      1: { cellWidth: 29 },
      2: { cellWidth: 29 },
      3: { cellWidth: 29 },
      4: { cellWidth: 29 },
      5: { cellWidth: 29 },
    };

    for (const [index, label] of groupOrder.entries()) {
      if (index > 0) writer.addSpacer(lineHeight);
      renderSubheader(label, lineHeight, { addTopSpacing: index > 0 });
      writer.addSpacer(lineHeight);
      const tableRows = buildTableRows(grouped.get(label) ?? []);
      const finalY = renderStandardPdfTable({
        doc,
        startY: writer.getY(),
        body: tableRows,
        columnStyles,
      });
      writer.setY(finalY + lineHeight);
    }
  };

  if (rows.length === 0) return;

  startBilagPage('Offentlige ydelser');
  writer.addSpacer(lineHeight);
  renderOffentligeYdelserTable(rows);
};
