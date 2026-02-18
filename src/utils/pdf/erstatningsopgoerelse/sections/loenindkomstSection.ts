import type { RowInput } from 'jspdf-autotable';
import { formatAsAmount } from '../../../formatUtils';
import { amountValueToDisplayString } from '../../../expressionAmount';
import { calculateAarsloenRowDerived } from '../../../aarsloenTableCalculations';
import { getAarsloenErrorRowIdSet } from '../../../../domain/erstatningsopgoerelse/indkomstRowValidation';
import { PDF_CONTENT_WIDTH_MM } from '../../pdfConfig';
import type { AarsloenTableRow, ErstatningsopgoerelseValues, Loenperiode } from '../../../../schemas/formSchemas';
import type { ISODateString } from '../../../../types/branded';
import type { SelectedElements } from '../types';
import { buildPeriodRangeGroups, normalizeBilagIndkomstYdelserMode, type IsoRange } from '../../../../domain/erstatningsopgoerelse/periodRangeGroups';

type BilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];
type LoenSectionContext = Readonly<{
  selectedElements: SelectedElements;
  eoValues: ErstatningsopgoerelseValues;
  lineHeight: number;
  startBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  writeLabelValueLine: (label: string, value: string) => void;
  formatJaNej: (value: boolean) => string;
  formatDateLong: (isoDate: ISODateString | undefined) => string;
  resolveOverenskomstDisplay: (overenskomstId: string | undefined) => string;
  formatPctFromInput: (value: number | undefined) => string;
  isZeroPct: (value: number | undefined) => boolean;
  getLoenindkomstTableHeaders: (loenperiode: Loenperiode) => readonly string[];
  resolvePeriodColumns: (row: AarsloenTableRow, loenperiode: Loenperiode) => readonly [string, string];
  hasNonZeroLoenAmount: (value: AarsloenTableRow['col2']) => boolean;
  shouldIncludeLoenRowInBilag: (params: Readonly<{
    row: AarsloenTableRow;
    loenperiode: Loenperiode;
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

export const renderLoenindkomstSection = (ctx: LoenSectionContext): void => {
  const {
    selectedElements,
    eoValues,
    lineHeight,
    startBilagPage,
    renderSubheader,
    writeLabelValueLine,
    formatJaNej,
    formatDateLong,
    resolveOverenskomstDisplay,
    formatPctFromInput,
    isZeroPct,
    getLoenindkomstTableHeaders,
    resolvePeriodColumns,
    hasNonZeroLoenAmount,
    shouldIncludeLoenRowInBilag,
    bilagIndkomstYdelserMode,
    bilagIndkomstYdelserRanges,
    renderStandardPdfTable,
    writer,
  } = ctx;

  if (!selectedElements.loenindkomst) return;
  const normalizedBilagMode = normalizeBilagIndkomstYdelserMode(bilagIndkomstYdelserMode);

  const formatAmountCell = (value: AarsloenTableRow['col2']): string => amountValueToDisplayString(value, 2);
  const loenErrorRowIdsByEmploymentId = new Map<string, ReadonlySet<string>>(
    (eoValues.loenindkomstAnsaettelsesforhold ?? []).map((af) => [
      af.id,
      getAarsloenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode),
    ])
  );

  const renderLoenindkomstTable = (
    ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number],
    errorRowIds: ReadonlySet<string>,
    ranges: readonly IsoRange[]
  ) => {
    const rows = (ansaettelsesforhold.indtaegtsoplysningerTableData ?? []).filter((row) => {
      return shouldIncludeLoenRowInBilag({
        row,
        loenperiode: ansaettelsesforhold.loenperiode,
        mode: normalizedBilagMode,
        ranges,
        errorRowIds,
      });
    });
    if (rows.length === 0) return;

    const allHeaders = getLoenindkomstTableHeaders(ansaettelsesforhold.loenperiode);
    const inputColumnDefs = [
      { index: 2, key: 'col2' as const },
      { index: 3, key: 'col3' as const },
      { index: 4, key: 'col4' as const },
      { index: 5, key: 'col5' as const },
    ];
    const visibleInputColumns = inputColumnDefs.filter((column) =>
      rows.some((row) => hasNonZeroLoenAmount(row[column.key]))
    );
    const headers = [
      allHeaders[0],
      allHeaders[1],
      ...visibleInputColumns.map((column) => allHeaders[column.index]),
      allHeaders[6],
      allHeaders[7],
      allHeaders[8],
      allHeaders[9],
    ];
    const satser = {
      feriePct: ansaettelsesforhold.feriePct,
      fritvalgPct: ansaettelsesforhold.fritvalgPct,
      shSoPct: ansaettelsesforhold.shSoPct,
      storeBededagPct: ansaettelsesforhold.storeBededagPct,
      pensionPct: ansaettelsesforhold.pensionPct,
    };

    const tableRows: RowInput[] = [
      headers.map((header) => ({
        content: header,
        styles: { fontStyle: 'bold', halign: 'center' as const },
      })),
    ];

    for (const row of rows) {
      const [col0, col1] = resolvePeriodColumns(row, ansaettelsesforhold.loenperiode);
      const derived = calculateAarsloenRowDerived(row, satser);
      const rowValues = [
        col0,
        col1,
        ...visibleInputColumns.map((column) => formatAmountCell(row[column.key])),
        formatAsAmount(derived.ferieberet, 2),
        formatAsAmount(derived.fpFvShSo, 2),
        formatAsAmount(derived.pension, 2),
        formatAsAmount(derived.samlet, 2),
      ];
      tableRows.push(
        rowValues.map((value, index) => ({
          content: value,
          styles: { halign: index < 2 ? 'center' : 'right' as const },
        }))
      );
    }

    const doc = writer.getDoc();
    const columnCount = headers.length;
    const defaultCellWidth = PDF_CONTENT_WIDTH_MM / columnCount;
    const columnStyles = Object.fromEntries(
      Array.from({ length: columnCount }, (_, index) => [index, { cellWidth: defaultCellWidth }])
    );
    const finalY = renderStandardPdfTable({
      doc,
      startY: writer.getY(),
      body: tableRows,
      columnStyles,
    });
    writer.setY(finalY + lineHeight);
  };

  const rangeGroups = buildPeriodRangeGroups(eoValues, bilagIndkomstYdelserMode, bilagIndkomstYdelserRanges);
  const hasRowsInAnyGroup = rangeGroups.some((group) =>
    (eoValues.loenindkomstAnsaettelsesforhold ?? []).some((ansaettelsesforhold) => {
      const errorRowIds = loenErrorRowIdsByEmploymentId.get(ansaettelsesforhold.id) ?? new Set<string>();
      return (ansaettelsesforhold.indtaegtsoplysningerTableData ?? []).some((row) =>
        shouldIncludeLoenRowInBilag({
          row,
          loenperiode: ansaettelsesforhold.loenperiode,
          mode: normalizedBilagMode,
          ranges: group.ranges,
          errorRowIds,
        })
      );
    })
  );
  if (!hasRowsInAnyGroup) return;

  startBilagPage('Lønindkomst');
  writer.addSpacer(lineHeight);
  const groupsWithRows = rangeGroups.flatMap((group) => {
    const ansaettelser = (eoValues.loenindkomstAnsaettelsesforhold ?? []).filter((ansaettelsesforhold) => {
      const errorRowIds = loenErrorRowIdsByEmploymentId.get(ansaettelsesforhold.id) ?? new Set<string>();
      return (ansaettelsesforhold.indtaegtsoplysningerTableData ?? []).some((row) => {
        return shouldIncludeLoenRowInBilag({
          row,
          loenperiode: ansaettelsesforhold.loenperiode,
          mode: normalizedBilagMode,
          ranges: group.ranges,
          errorRowIds,
        });
      });
    });
    return ansaettelser.length > 0 ? [{ group, ansaettelser }] : [];
  });

  const shouldRenderPeriodSubheaders =
    groupsWithRows.length > 1 && groupsWithRows.every(({ group }) => group.label !== null);

  for (const [groupIndex, groupWithRows] of groupsWithRows.entries()) {
    if (shouldRenderPeriodSubheaders && groupWithRows.group.label) {
      if (groupIndex > 0) writer.addSpacer(lineHeight);
      renderSubheader(groupWithRows.group.label, lineHeight, { addTopSpacing: groupIndex > 0 });
      writer.addSpacer(lineHeight);
    }

    for (const [index, ansaettelsesforhold] of groupWithRows.ansaettelser.entries()) {
      const fallbackNavn = `Ansættelsesforhold ${index + 1}`;
      const arbejdsstedNavn = ansaettelsesforhold.navnPaaArbejdssted?.trim() || fallbackNavn;
      if (index > 0) writer.addSpacer(lineHeight);
      renderSubheader(arbejdsstedNavn, lineHeight, { addTopSpacing: index > 0 });
      writer.addSpacer(lineHeight);
      writeLabelValueLine(
        'Ansat på skadestidspunktet',
        formatJaNej(ansaettelsesforhold.ansatPaaSkadestidspunktet)
      );
      if (ansaettelsesforhold.ansatPaaSkadestidspunktet !== false) {
        writeLabelValueLine(
          'Opsagt fra stillingen',
          (() => {
            const isOpsagt = ansaettelsesforhold.ansaettelsesforholdOphoert;
            if (!isOpsagt) return 'Nej';
            const sidsteArbejdsdag = formatDateLong(ansaettelsesforhold.sidsteArbejdsdag);
            if (!sidsteArbejdsdag) return 'Ja';
            return `Ja, sidste arbejdsdag ${sidsteArbejdsdag}`;
          })()
        );
      }
      writer.addSpacer(lineHeight);
      const overenskomstId = ansaettelsesforhold.overenskomstId?.trim();
      if (overenskomstId) {
        writeLabelValueLine('Overenskomst', resolveOverenskomstDisplay(overenskomstId));
        writer.addSpacer(lineHeight);
      }
      if (selectedElements.okSatser) {
        if (!isZeroPct(ansaettelsesforhold.feriePct)) {
          writeLabelValueLine('Feriegodtgørelse/-tillæg:', formatPctFromInput(ansaettelsesforhold.feriePct));
        }
        if (!isZeroPct(ansaettelsesforhold.fritvalgPct)) {
          writeLabelValueLine('Fritvalg:', formatPctFromInput(ansaettelsesforhold.fritvalgPct));
        }
        if (!isZeroPct(ansaettelsesforhold.shSoPct)) {
          writeLabelValueLine('SH/SO-sats:', formatPctFromInput(ansaettelsesforhold.shSoPct));
        }
        if (!isZeroPct(ansaettelsesforhold.storeBededagPct)) {
          writeLabelValueLine('Store Bededagstillæg:', formatPctFromInput(ansaettelsesforhold.storeBededagPct));
        }
        if (!isZeroPct(ansaettelsesforhold.pensionPct)) {
          writeLabelValueLine('Arbejdsgivers pensionsbidrag:', formatPctFromInput(ansaettelsesforhold.pensionPct));
        }
      }
      writer.addSpacer(lineHeight);
      const errorRowIds = loenErrorRowIdsByEmploymentId.get(ansaettelsesforhold.id) ?? new Set<string>();
      renderLoenindkomstTable(ansaettelsesforhold, errorRowIds, groupWithRows.group.ranges);
    }
  }
};
