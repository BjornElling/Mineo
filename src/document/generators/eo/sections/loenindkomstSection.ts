import { formatAsAmount } from '../../../../utils/formatUtils';
import { amountValueToDisplayString } from '../../../../utils/expressionAmount';
import { getStandardLoenErrorRowIdSet } from '../../../../domain/erstatningsopgoerelse/validation/indkomstRowValidation';
import type { StandardLoenTableRow, ErstatningsopgoerelseValues, Loenperiode } from '../../../../schemas/formSchemas';
import type { ISODateString } from '../../../../types/branded';
import { resolveOverenskomstDisplay } from '../../../../data/overenskomstRates';
import { resolveAktivOverenskomst } from '../../../../domain/erstatningsopgoerelse/helpers/aktivOverenskomst';
import type { SelectedElements } from '../types';
import { buildPeriodRangeGroups, normalizeEoBilagIndkomstYdelserMode, type IsoRange } from '../../../../domain/erstatningsopgoerelse/engines/periodRangeGroups';
import { type ColumnSpec, type RowSpec } from '../../../layout/tableSpec';
import { getStandardLoenHeaderIndex, STANDARD_LOEN_FPFVSHSO_LABEL, STANDARD_LOEN_PENSION_LABEL, STANDARD_LOEN_SAMLET_LABEL } from '../../../../domain/aarsloen/standardLoenTableColumns';
import { calculateLoenindkomstRowDerived } from '../../../../domain/erstatningsopgoerelse/helpers/loenindkomstRowDerived';
import type { DocumentComposer } from '../../../model/documentModel';

type EoBilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];
type LoenSectionContext = Readonly<{
  selectedElements: SelectedElements;
  eoValues: ErstatningsopgoerelseValues;
  startEoBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, nextLineHeight?: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  safeAddWrappedText: (text: string) => void;
  writeLabelValueLine: (label: string, value: string) => void;
  formatDateLong: (isoDate: ISODateString | undefined) => string;
  formatPctFromInput: (value: number | undefined) => string;
  isZeroPct: (value: number | undefined) => boolean;
  getLoenindkomstTableHeaders: (loenperiode: Loenperiode) => readonly string[];
  resolvePeriodColumns: (row: StandardLoenTableRow, loenperiode: Loenperiode) => readonly [string, string];
  hasNonZeroLoenAmount: (value: StandardLoenTableRow['col2']) => boolean;
  shouldIncludeLoenRowInEoBilag: (params: Readonly<{
    row: StandardLoenTableRow;
    loenperiode: Loenperiode;
    mode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar;
    ranges: readonly IsoRange[];
    errorRowIds: ReadonlySet<string>;
  }>) => boolean;
  eoBilagIndkomstYdelserMode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar;
  eoBilagIndkomstYdelserRanges: readonly IsoRange[];
  writer: Pick<DocumentComposer, 'addSectionSpacer' | 'addSpacer' | 'addTable'>;
}>;

export const renderLoenindkomstSection = (ctx: LoenSectionContext): void => {
  const {
    selectedElements,
    eoValues,
    startEoBilagPage,
    renderSubheader,
    safeAddWrappedText,
    writeLabelValueLine,
    formatDateLong,
    formatPctFromInput,
    isZeroPct,
    getLoenindkomstTableHeaders,
    resolvePeriodColumns,
    hasNonZeroLoenAmount,
    shouldIncludeLoenRowInEoBilag,
    eoBilagIndkomstYdelserMode,
    eoBilagIndkomstYdelserRanges,
    writer,
  } = ctx;

  if (!selectedElements.loenindkomst) return;
  const normalizedEoBilagMode = normalizeEoBilagIndkomstYdelserMode(eoBilagIndkomstYdelserMode);

  const formatAmountCell = (value: StandardLoenTableRow['col2']): string => amountValueToDisplayString(value, 2);
  const loenErrorRowIdsByEmploymentId = new Map<string, ReadonlySet<string>>(
    (eoValues.loenindkomstAnsaettelsesforhold ?? []).map((af) => [
      af.id,
      getStandardLoenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode, af.tillaegAngivesSom),
    ])
  );

  const renderLoenindkomstTable = (
    ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number],
    errorRowIds: ReadonlySet<string>,
    ranges: readonly IsoRange[]
  ) => {
    const rows = (ansaettelsesforhold.indtaegtsoplysningerTableData ?? []).filter((row) => {
      return shouldIncludeLoenRowInEoBilag({
        row,
        loenperiode: ansaettelsesforhold.loenperiode,
        mode: normalizedEoBilagMode,
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
    // De to periode-kolonner centreres; alle beløbskolonner højrejusteres. Justeringen
    // bæres af kolonne-intentionen (celle-fallback), mens header-cellerne altid centreres.
    const columns: readonly ColumnSpec[] = headers.map((_, index) => ({
      width: { kind: 'flex' },
      align: index < 2 ? 'center' : 'right',
    }));
    const specRows: RowSpec[] = [
      { kind: 'header', cells: headers.map((header) => ({ text: header, align: 'center' })) },
    ];

    for (const row of rows) {
      const [col0, col1] = resolvePeriodColumns(row, ansaettelsesforhold.loenperiode);
      const derived = calculateLoenindkomstRowDerived({
        row,
        ansaettelsesforhold,
        context: {
          beregnesUdFra: eoValues.beregnesUdFra,
          tafBeregningsperiodeFra: eoValues.tafBeregningsperiodeFra,
          tafBeregningsperiodeTil: eoValues.tafBeregningsperiodeTil,
          loenindkomstAnsaettelsesforhold: eoValues.loenindkomstAnsaettelsesforhold ?? [],
          ferieperioder: eoValues.ferieperioder,
          fravaerPerioder: eoValues.fravaerPerioder,
        },
      });
      const rowValues = [
        col0,
        col1,
        ...visibleInputColumns.map((column) => formatAmountCell(row[column.key])),
        formatAsAmount(derived.fpFvShSo, 2),
        formatAsAmount(derived.pension, 2),
        formatAsAmount(derived.samlet, 2),
      ];
      specRows.push({ cells: rowValues.map((value) => ({ text: value })) });
    }

    writer.addTable({ columns, hasHeaderRow: true, rows: specRows });
  };

  const rangeGroups = buildPeriodRangeGroups(eoValues, eoBilagIndkomstYdelserMode, eoBilagIndkomstYdelserRanges);
  const hasRowsInAnyGroup = rangeGroups.some((group) =>
    (eoValues.loenindkomstAnsaettelsesforhold ?? []).some((ansaettelsesforhold) => {
      const errorRowIds = loenErrorRowIdsByEmploymentId.get(ansaettelsesforhold.id) ?? new Set<string>();
      return (ansaettelsesforhold.indtaegtsoplysningerTableData ?? []).some((row) =>
        shouldIncludeLoenRowInEoBilag({
          row,
          loenperiode: ansaettelsesforhold.loenperiode,
          mode: normalizedEoBilagMode,
          ranges: group.ranges,
          errorRowIds,
        })
      );
    })
  );
  if (!hasRowsInAnyGroup) return;

  startEoBilagPage('Lønindkomst');
  writer.addSectionSpacer();
  const combinedRanges = rangeGroups.flatMap((group) => group.ranges);
  const ansaettelserWithRows = (eoValues.loenindkomstAnsaettelsesforhold ?? []).filter((ansaettelsesforhold) => {
    const errorRowIds = loenErrorRowIdsByEmploymentId.get(ansaettelsesforhold.id) ?? new Set<string>();
    return (ansaettelsesforhold.indtaegtsoplysningerTableData ?? []).some((row) =>
      shouldIncludeLoenRowInEoBilag({
        row,
        loenperiode: ansaettelsesforhold.loenperiode,
        mode: normalizedEoBilagMode,
        ranges: combinedRanges,
        errorRowIds,
      })
    );
  });

  for (const [index, ansaettelsesforhold] of ansaettelserWithRows.entries()) {
      const fallbackNavn = `Ansættelsesforhold ${index + 1}`;
      const arbejdsstedNavn = ansaettelsesforhold.navnPaaArbejdssted?.trim() || fallbackNavn;
      const shouldAddTopSpacing = index > 0;
      renderSubheader(arbejdsstedNavn, undefined, { addTopSpacing: shouldAddTopSpacing });
      const aktivOverenskomst = resolveAktivOverenskomst(ansaettelsesforhold);
      if (aktivOverenskomst.aktiv) {
        writeLabelValueLine('Overenskomst', resolveOverenskomstDisplay(aktivOverenskomst.overenskomstId));
        writer.addSectionSpacer();
      }
      // Beløb-tilstand: de skjulte top-satsfelter er ikke dokumentkilde; relevante satser står i
      // lønoplysningerne/manuelle reguleringsrækker, hvor brugeren har indtastet dem.
      if (selectedElements.okSatser && ansaettelsesforhold.tillaegAngivesSom !== 'beloeb') {
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
        writer.addSectionSpacer();
        safeAddWrappedText(opsigelsesLinje);
      }
      const errorRowIds = loenErrorRowIdsByEmploymentId.get(ansaettelsesforhold.id) ?? new Set<string>();
      renderLoenindkomstTable(ansaettelsesforhold, errorRowIds, combinedRanges);
  }
};
