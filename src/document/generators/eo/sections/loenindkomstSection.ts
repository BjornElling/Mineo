import { formatAsAmount } from '../../../../utils/formatUtils';
import { amountValueToDisplayString } from '../../../../utils/expressionAmount';
import { getStandardLoenErrorRowIdSet } from '../../../../domain/erstatningsopgoerelse/validation/indkomstRowValidation';
import type { StandardLoenTableRow, ErstatningsopgoerelseValues, Loenperiode, StamdataValues } from '../../../../schemas/formSchemas';
import { isISODateString, type ISODateString } from '../../../../types/branded';
import { resolveOverenskomstDisplay } from '../../../../data/overenskomstRates';
import { resolveAktivOverenskomst } from '../../../../domain/erstatningsopgoerelse/helpers/aktivOverenskomst';
import { resolveAnsaettelsesforholdNavn } from '../../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { resolveSatserHeadingForAnsaettelsesforhold } from '../../../../domain/erstatningsopgoerelse/helpers/satserHeading';
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
  stamdataValues: Pick<StamdataValues, 'skadedato' | 'skadestype'>;
  startEoBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
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
  writer: Pick<DocumentComposer, 'addSectionSpacer' | 'addTable'>;
}>;

export const renderLoenindkomstSection = (ctx: LoenSectionContext): void => {
  const {
    selectedElements,
    eoValues,
    stamdataValues,
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
          tafPerioder: eoValues.tafPerioder,
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

  const alleAnsaettelser = eoValues.loenindkomstAnsaettelsesforhold ?? [];
  for (const [index, ansaettelsesforhold] of ansaettelserWithRows.entries()) {
      // Nummeret er kortets plads på skærmen, ikke pladsen blandt de ansættelsesforhold, bilaget viser.
      const arbejdsstedNavn = resolveAnsaettelsesforholdNavn(
        ansaettelsesforhold.navnPaaArbejdssted,
        alleAnsaettelser.indexOf(ansaettelsesforhold)
      );
      const shouldAddTopSpacing = index > 0;
      renderSubheader(arbejdsstedNavn, { addTopSpacing: shouldAddTopSpacing });
      const aktivOverenskomst = resolveAktivOverenskomst(ansaettelsesforhold);
      if (aktivOverenskomst.aktiv) {
        writeLabelValueLine('Overenskomst', resolveOverenskomstDisplay(aktivOverenskomst.overenskomstId));
        writer.addSectionSpacer();
      }
      // Beløb-tilstand: de skjulte top-satsfelter er ikke dokumentkilde; relevante satser står i
      // lønoplysningerne/manuelle reguleringsrækker, hvor brugeren har indtastet dem.
      if (selectedElements.okSatser && ansaettelsesforhold.tillaegAngivesSom !== 'beloeb') {
        const satsLinjer: ReadonlyArray<readonly [string, number | undefined]> = [
          ['Feriegodtgørelse/-tillæg:', ansaettelsesforhold.feriePct],
          ['Fritvalg:', ansaettelsesforhold.fritvalgPct],
          ['SH/SO-sats:', ansaettelsesforhold.shSoPct],
          ['Store Bededagstillæg:', ansaettelsesforhold.storeBededagPct],
          ['Arbejdsgivers pensionsbidrag:', ansaettelsesforhold.pensionPct],
        ];
        const synligeSatsLinjer = satsLinjer.filter(([, value]) => !isZeroPct(value));
        if (synligeSatsLinjer.length > 0) {
          // Satslinjerne er satserne på reguleringsdatoen – dem, beregningsgrundlaget regner med – mens tabellens
          // rækker viser lønsedlens tillæg med månedens satser. Uden datoen stod «SH/SO-sats: 3,4 %» over rækker
          // regnet med 2,7 % (BB-276; rækkerne følger bevidst lønsedlen, udviklerafgørelse 2026-10-06).
          safeAddWrappedText(`${resolveSatserHeadingForAnsaettelsesforhold({
            values: eoValues,
            ansaettelsesforhold,
            skadedato: isISODateString(stamdataValues.skadedato) ? stamdataValues.skadedato : undefined,
            skadestype: stamdataValues.skadestype,
          })}:`);
          synligeSatsLinjer.forEach(([label, value]) => writeLabelValueLine(label, formatPctFromInput(value)));
          safeAddWrappedText('Tillæg i tabellen er beregnet med de satser, der gjaldt i den enkelte måned.');
        }
      }
      if (ansaettelsesforhold.ansatPaaSkadestidspunktet && ansaettelsesforhold.ansaettelsesforholdOphoert) {
        const sidsteDag = formatDateLong(ansaettelsesforhold.sidsteArbejdsdag);
        // Feltets egen betegnelse (BB-283): «sidste arbejdsdag» og feltets navn er samme dato.
        const opsigelsesLinje = sidsteDag
          ? `Skadelidte er opsagt fra stillingen med sidste dag i ansættelsesforholdet ${sidsteDag}.`
          : 'Skadelidte er opsagt fra stillingen.';
        writer.addSectionSpacer();
        safeAddWrappedText(opsigelsesLinje);
      }
      const errorRowIds = loenErrorRowIdsByEmploymentId.get(ansaettelsesforhold.id) ?? new Set<string>();
      renderLoenindkomstTable(ansaettelsesforhold, errorRowIds, combinedRanges);
  }
};
