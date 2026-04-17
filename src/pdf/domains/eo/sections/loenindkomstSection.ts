import type jsPDF from 'jspdf';
import type { RowInput } from 'jspdf-autotable';
import { formatAsAmount } from '../../../../utils/formatUtils';
import { amountValueToDisplayString } from '../../../../utils/expressionAmount';
import { calculateStandardLoenRowDerived } from '../../../../domain/aarsloen/standardLoenRowCalculations';
import { getStandardLoenErrorRowIdSet } from '../../../../domain/erstatningsopgoerelse/validation/indkomstRowValidation';
import type { StandardLoenTableRow, ErstatningsopgoerelseValues, Loenperiode } from '../../../../schemas/formSchemas';
import type { ISODateString } from '../../../../types/branded';
import { resolveOverenskomstNameOnlyDisplay } from '../../../../data/overenskomstRates';
import type { SelectedElements } from '../types';
import { buildPeriodRangeGroups, normalizeBilagIndkomstYdelserMode, type IsoRange } from '../../../../domain/erstatningsopgoerelse/engines/periodRangeGroups';
import { createPdfDistributedColumnStyles, renderEoStylePdfTable } from '../../../shared/pdfTableRenderer';
import { getStandardLoenHeaderIndex, STANDARD_LOEN_FPFVSHSO_LABEL, STANDARD_LOEN_PENSION_LABEL, STANDARD_LOEN_SAMLET_LABEL } from '../../../../domain/aarsloen/standardLoenTableColumns';

type BilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];
type LoenSectionContext = Readonly<{
  selectedElements: SelectedElements;
  eoValues: ErstatningsopgoerelseValues;
  lineHeight: number;
  startBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  safeAddWrappedText: (text: string) => void;
  writeLabelValueLine: (label: string, value: string) => void;
  formatDateLong: (isoDate: ISODateString | undefined) => string;
  formatPctFromInput: (value: number | undefined) => string;
  isZeroPct: (value: number | undefined) => boolean;
  getLoenindkomstTableHeaders: (loenperiode: Loenperiode) => readonly string[];
  resolvePeriodColumns: (row: StandardLoenTableRow, loenperiode: Loenperiode) => readonly [string, string];
  hasNonZeroLoenAmount: (value: StandardLoenTableRow['col2']) => boolean;
  shouldIncludeLoenRowInBilag: (params: Readonly<{
    row: StandardLoenTableRow;
    loenperiode: Loenperiode;
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

export const renderLoenindkomstSection = (ctx: LoenSectionContext): void => {
  const {
    selectedElements,
    eoValues,
    lineHeight,
    startBilagPage,
    renderSubheader,
    safeAddWrappedText,
    writeLabelValueLine,
    formatDateLong,
    formatPctFromInput,
    isZeroPct,
    getLoenindkomstTableHeaders,
    resolvePeriodColumns,
    hasNonZeroLoenAmount,
    shouldIncludeLoenRowInBilag,
    bilagIndkomstYdelserMode,
    bilagIndkomstYdelserRanges,
    writer,
  } = ctx;

  if (!selectedElements.loenindkomst) return;
  const normalizedBilagMode = normalizeBilagIndkomstYdelserMode(bilagIndkomstYdelserMode);

  const formatAmountCell = (value: StandardLoenTableRow['col2']): string => amountValueToDisplayString(value, 2);
  const loenErrorRowIdsByEmploymentId = new Map<string, ReadonlySet<string>>(
    (eoValues.loenindkomstAnsaettelsesforhold ?? []).map((af) => [
      af.id,
      getStandardLoenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode),
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

    const loenperiode = ansaettelsesforhold.loenperiode;
    const allHeaders = getLoenindkomstTableHeaders(loenperiode);
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
      allHeaders[getStandardLoenHeaderIndex(loenperiode, STANDARD_LOEN_FPFVSHSO_LABEL)],
      allHeaders[getStandardLoenHeaderIndex(loenperiode, STANDARD_LOEN_PENSION_LABEL)],
      allHeaders[getStandardLoenHeaderIndex(loenperiode, STANDARD_LOEN_SAMLET_LABEL)],
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
      const derived = calculateStandardLoenRowDerived(row, satser);
      const rowValues = [
        col0,
        col1,
        ...visibleInputColumns.map((column) => formatAmountCell(row[column.key])),
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

    const doc = writer.getDoc() as jsPDF;
    const columnCount = headers.length;
    const finalY = renderEoStylePdfTable({
      doc,
      startY: writer.getY(),
      body: tableRows,
      columnStyles: createPdfDistributedColumnStyles(columnCount),
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
  const combinedRanges = rangeGroups.flatMap((group) => group.ranges);
  const ansaettelserWithRows = (eoValues.loenindkomstAnsaettelsesforhold ?? []).filter((ansaettelsesforhold) => {
    const errorRowIds = loenErrorRowIdsByEmploymentId.get(ansaettelsesforhold.id) ?? new Set<string>();
    return (ansaettelsesforhold.indtaegtsoplysningerTableData ?? []).some((row) =>
      shouldIncludeLoenRowInBilag({
        row,
        loenperiode: ansaettelsesforhold.loenperiode,
        mode: normalizedBilagMode,
        ranges: combinedRanges,
        errorRowIds,
      })
    );
  });

  for (const [index, ansaettelsesforhold] of ansaettelserWithRows.entries()) {
      const fallbackNavn = `Ansættelsesforhold ${index + 1}`;
      const arbejdsstedNavn = ansaettelsesforhold.navnPaaArbejdssted?.trim() || fallbackNavn;
      const shouldAddTopSpacing = index > 0;
      if (shouldAddTopSpacing) writer.addSpacer(lineHeight);
      renderSubheader(arbejdsstedNavn, lineHeight, { addTopSpacing: shouldAddTopSpacing });
      writer.addSpacer(lineHeight);
      const overenskomstId = ansaettelsesforhold.overenskomstId?.trim();
      if (overenskomstId && ansaettelsesforhold.harOverenskomst) {
        writeLabelValueLine('Overenskomst', resolveOverenskomstNameOnlyDisplay(overenskomstId));
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
      if (ansaettelsesforhold.ansatPaaSkadestidspunktet && ansaettelsesforhold.ansaettelsesforholdOphoert) {
        const sidsteArbejdsdag = formatDateLong(ansaettelsesforhold.sidsteArbejdsdag);
        const opsigelsesLinje = sidsteArbejdsdag
          ? `Skadelidte er opsagt fra stillingen med sidste arbejdsdag ${sidsteArbejdsdag}.`
          : 'Skadelidte er opsagt fra stillingen.';
        writer.addSpacer(lineHeight);
        safeAddWrappedText(opsigelsesLinje);
      }
      writer.addSpacer(lineHeight);
      const errorRowIds = loenErrorRowIdsByEmploymentId.get(ansaettelsesforhold.id) ?? new Set<string>();
      renderLoenindkomstTable(ansaettelsesforhold, errorRowIds, combinedRanges);
  }
};
