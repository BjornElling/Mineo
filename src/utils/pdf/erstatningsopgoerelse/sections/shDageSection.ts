import type { RowInput } from 'jspdf-autotable';
import { formatUtcDateLong } from '../../../dateFormatting';
import { parseISODate, type ISODateString } from '../../../../types/branded';
import { beregnHelligdageMedNavn } from '../../../shDageBeregning';
import { formatDateLong } from '../../../../domain/erstatningsopgoerelse/sharedPdfUtils';
import type { ErstatningsopgoerelseValues } from '../../../../schemas/formSchemas';

type SHDageTableRow = Readonly<{
  ugedag: string;
  datoDisplay: string;
  helligdagNavn: string;
  erSHDag: boolean;
}>;

const SH_DAGE_WEEKDAY_NAMES = [
  'Søndag',
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
] as const;

type SHDageSectionContext = Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  lineHeight: number;
  startBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  safeAddWrappedText: (text: string) => void;
  renderStandardPdfTable: (params: Readonly<{
    doc: unknown;
    startY: number;
    body: RowInput[];
    columnStyles?: unknown;
    transparentRowIndices?: readonly number[];
  }>) => number;
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
        ugedag: SH_DAGE_WEEKDAY_NAMES[dayOfWeek],
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
    lineHeight,
    startBilagPage,
    renderSubheader,
    safeAddWrappedText,
    renderStandardPdfTable,
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
        { content: 'Ugedag', styles: { fontStyle: 'bold', halign: 'left' } },
        { content: 'Dato', styles: { fontStyle: 'bold', halign: 'left' } },
        { content: 'Helligdag', styles: { fontStyle: 'bold', halign: 'left' } },
        { content: 'SH-dag', styles: { fontStyle: 'bold', halign: 'center' } },
      ],
    ];

    for (const row of rows) {
      tableRows.push([
        { content: row.ugedag, styles: { halign: 'left' } },
        { content: row.datoDisplay, styles: { halign: 'left' } },
        { content: row.helligdagNavn, styles: { halign: 'left' } },
        { content: row.erSHDag ? 'x' : '', styles: { halign: 'center' } },
      ]);
    }

    tableRows.push([
      { content: 'SH-dage i alt', styles: { fontStyle: 'bold', halign: 'left', fillColor: false } },
      { content: '', styles: { fontStyle: 'bold', fillColor: false } },
      { content: '', styles: { fontStyle: 'bold', fillColor: false } },
      { content: String(antalShDage), styles: { fontStyle: 'bold', halign: 'center', fillColor: false } },
    ]);

    const doc = writer.getDoc();
    const finalY = renderStandardPdfTable({
      doc,
      startY: writer.getY(),
      body: tableRows,
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 25 },
      },
      transparentRowIndices: [tableRows.length - 1],
    });
    writer.setY(finalY + lineHeight);
  };

  startBilagPage('SH-dage');

  writer.addSpacer(lineHeight);
  safeAddWrappedText('Helligdage, der falder på hverdage (mandag-fredag).');
  writer.addSpacer(lineHeight);

  if (eoValues.beregnesUdFra === 'Beregningsperiode') {
    writer.addSpacer(lineHeight);
    renderSubheader('Beregningsperiode', lineHeight, { addTopSpacing: false });
    safeAddWrappedText(formatRangeLong(eoValues.periodeTilBeregningFra, eoValues.periodeTilBeregningTil));
    writer.addSpacer(lineHeight);
    const beregningsperiodeHelligdage = findHelligdageInRange(eoValues.periodeTilBeregningFra, eoValues.periodeTilBeregningTil);
    if (beregningsperiodeHelligdage.length === 0) {
      safeAddWrappedText('Ingen helligdage');
      writer.addSpacer(lineHeight * 2);
    } else {
      renderShDageTable(beregningsperiodeHelligdage);
      writer.addSpacer(lineHeight);
    }
  }

  renderSubheader('Erstatningsperiode', lineHeight, { addTopSpacing: false });
  safeAddWrappedText(formatRangeLong(eoValues.vedroererPeriodeFra, eoValues.vedroererPeriodeTil));
  writer.addSpacer(lineHeight);
  const erstatningsperiodeHelligdage = findHelligdageInRange(eoValues.vedroererPeriodeFra, eoValues.vedroererPeriodeTil);
  if (erstatningsperiodeHelligdage.length === 0) {
    safeAddWrappedText('Ingen helligdage');
  } else {
    renderShDageTable(erstatningsperiodeHelligdage);
  }
};
