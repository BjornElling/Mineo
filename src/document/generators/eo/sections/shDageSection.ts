import type { DocumentComposer } from '../../../model/documentModel';
import { formatUtcDateLong, formatIsoDateLong as formatDateLong, WEEKDAY_NAMES_DA } from '../../../../utils/dateFormatting';
import { buildSummedTotalRowSpec, type ColumnSpec, type RowSpec } from '../../../layout/tableSpec';
import { PDF_TABLE_NARROW_COLUMN_WIDTH } from '../../../layout/pdfConfig';
import type { ISODateString } from '../../../../types/branded';
import { findNamedHolidaysInIsoRanges } from '../../../../domain/dates/shDageOversigt';
import type { ErstatningsopgoerelseValues } from '../../../../schemas/formSchemas';
import { buildBeregningsperiodeRange } from '../../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import type { IsoRange } from '../../../../domain/erstatningsopgoerelse/validation/tafPeriodConstraints';
import { erDetteFoersteErstatningsopgoerelse } from '../../../../domain/erstatningsopgoerelse/validation/eoNummerValidering';
import { mergeIsoDateRanges } from '../../../../domain/erstatningsopgoerelse/engines/isoRangeAlgebra';
import type { SHDageTableRow } from '../types';
import { round0 } from '../../../../utils/roundingShortcuts';

type SHDageSectionContext = Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  tafRanges: readonly IsoRange[];
  sfggReferenceperiodeRanges?: readonly IsoRange[];
  harSfggReferenceperiodeMedShFradrag?: boolean;
  startEoBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  writer: Pick<DocumentComposer, 'addSectionSpacer' | 'addTable' | 'writeWrappedText'>;
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
    startEoBilagPage,
    renderSubheader,
    writer,
  } = ctx;
  const safeAddWrappedText = writer.writeWrappedText;

  const formatRangeLong = (fra: ISODateString | undefined, til: ISODateString | undefined): string => {
    const fraDisplay = formatDateLong(fra);
    const tilDisplay = formatDateLong(til);
    return `${fraDisplay || '-'} - ${tilDisplay || '-'}`;
  };
  const formatRangesLong = (ranges: readonly IsoRange[]): string[] => ranges.map((range) => formatRangeLong(range.fra, range.til));

  const columns: readonly ColumnSpec[] = [
    { width: { kind: 'flex' }, align: 'left' },
    { width: { kind: 'flex' }, align: 'left' },
    { width: { kind: 'flex' }, align: 'left' },
    { width: { kind: 'fixed', mm: PDF_TABLE_NARROW_COLUMN_WIDTH }, align: 'center' },
  ];

  const renderShDageTable = (rows: readonly SHDageTableRow[]) => {
    const specRows: RowSpec[] = [
      { kind: 'header', cells: [{ text: 'Ugedag' }, { text: 'Dato' }, { text: 'Helligdag' }, { text: 'SH-dag' }] },
      ...rows.map((row): RowSpec => ({
        cells: [
          { text: row.ugedag },
          { text: row.datoDisplay },
          { text: row.helligdagNavn },
          { text: row.erSHDag ? 'x' : '' },
        ],
      })),
    ];

    const totalRow = buildSummedTotalRowSpec(
      'SH-dage i alt',
      rows.map((row) => (row.erSHDag ? 1 : 0)),
      {
        columnCount: 4,
        valueColumnIndex: 3,
        formatValue: (total) => String(total),
        roundDisplayedValue: round0,
        valueAlign: 'center',
        preserveValueColumn: true,
      }
    );
    if (totalRow) specRows.push(totalRow);

    writer.addTable({ columns, hasHeaderRow: true, rows: specRows });
  };

  startEoBilagPage('SH-dage');

  safeAddWrappedText(
    eoValues.beregnesUdFra === 'Beregningsperiode'
      ? 'Helligdage i de viste perioder. SH-dage er helligdage, der falder på hverdage (mandag-fredag).'
      : 'Helligdage, der falder på hverdage (mandag-fredag).'
  );
  writer.addSectionSpacer();

  const renderPeriodeSection = (label: string, fra: ISODateString | undefined, til: ISODateString | undefined) => {
    renderSubheader(label, { addTopSpacing: false });
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

  renderSubheader('TAF-periode', { addTopSpacing: false });
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
    renderSubheader('SFGG-referenceperiode', { addTopSpacing: false });
    formatRangesLong(mergedSfggReferenceperiodeRanges).forEach((line) => safeAddWrappedText(line));
    renderShDageTable(sfggHelligdage);
  }
};
