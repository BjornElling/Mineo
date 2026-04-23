import type jsPDF from 'jspdf';
import type { RowInput } from 'jspdf-autotable';
import { resolvePdfSectionEndY } from '../../../shared/pdfHelpers';
import { amountValueToDisplayString, amountValueToNumber } from '../../../../utils/expressionAmount';
import { formatAsAmount } from '../../../../utils/formatUtils';
import { ydelsestyper } from '../../../../data/ydelsestyper';
import { getOffentligeYdelserErrorRowIdSet } from '../../../../domain/erstatningsopgoerelse/validation/indkomstRowValidation';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../../schemas/formSchemas';
import type { ISODateString } from '../../../../types/branded';
import { buildPeriodRangeGroups, normalizeEoBilagIndkomstYdelserMode, type IsoRange } from '../../../../domain/erstatningsopgoerelse/engines/periodRangeGroups';
import { cellRight, createPdfDistributedColumnStyles, createPdfTableCell, renderPdfTable } from '../../../shared/pdfTableRenderer';
import { OFFENTLIGE_YDELSER_PDF_HEADERS } from '../../../../domain/erstatningsopgoerelse/tables/offentligeYdelserTableColumns';
import type { MidlertidigtEetAfgoerelseGroup } from '../../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { formatIsoDateShort } from '../../../../utils/dateFormatting';
import { formatMaaneder4, formatReguleringPct, formatKr } from '../../../shared/pdfFormatUtils';

type EoBilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];

type OffentligeYdelserSectionContext = Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  startEoBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, nextLineHeight?: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  shouldIncludeOffentligYdelseRowInEoBilag: (params: Readonly<{
    row: OffentligeYdelserRow;
    mode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar;
    ranges: readonly IsoRange[];
    errorRowIds: ReadonlySet<string>;
  }>) => boolean;
  eoBilagIndkomstYdelserMode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar;
  eoBilagIndkomstYdelserRanges: readonly IsoRange[];
  writer: Readonly<{
    addSectionSpacer: () => void;
    addSpacer: (height: number) => void;
    setY: (y: number) => void;
    getY: () => number;
    getDoc: () => unknown;
  }>;
}>;

type RenderOffentligeYdelserRowsPageContext = Readonly<{
  rows: readonly OffentligeYdelserRow[];
  visYdelsestypeSubheader?: boolean;
  renderSubheader: (text: string, nextLineHeight?: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  writer: Readonly<{
    addSectionSpacer: () => void;
    addSpacer: (height: number) => void;
    setY: (y: number) => void;
    getY: () => number;
    getDoc: () => unknown;
  }>;
}>;

export const renderOffentligeYdelserRowsPage = (ctx: RenderOffentligeYdelserRowsPageContext): void => {
  const {
    rows,
    visYdelsestypeSubheader = true,
    renderSubheader,
    writer,
  } = ctx;
  if (rows.length === 0) return;

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
  for (const row of rows) {
    const ydelsestypeKey = row.ydelsestype?.trim() ?? '';
    const ydelsestypeLabel = ydelsestypeKey ? (ydelsestyper[ydelsestypeKey]?.label ?? ydelsestypeKey) : 'Ikke angivet';
    if (!grouped.has(ydelsestypeLabel)) {
      grouped.set(ydelsestypeLabel, []);
      groupOrder.push(ydelsestypeLabel);
    }
    grouped.get(ydelsestypeLabel)?.push(row);
  }

  const doc = writer.getDoc() as jsPDF;
  const columnStyles = createPdfDistributedColumnStyles(OFFENTLIGE_YDELSER_PDF_HEADERS.length);

  for (const [index, label] of groupOrder.entries()) {
    if (visYdelsestypeSubheader) renderSubheader(label, undefined, { addTopSpacing: index > 0 });
    const startY = writer.getY();
    const tableRows = buildTableRows(grouped.get(label) ?? []);
    const finalY = renderPdfTable({
      doc,
      startY,
      body: tableRows,
      columnStyles,
    });
    writer.setY(resolvePdfSectionEndY(finalY, startY));
  }
};

export const renderOffentligeYdelserSection = (ctx: OffentligeYdelserSectionContext): void => {
  const {
    eoValues,
    startEoBilagPage,
    renderSubheader,
    shouldIncludeOffentligYdelseRowInEoBilag,
    eoBilagIndkomstYdelserMode,
    eoBilagIndkomstYdelserRanges,
    writer,
  } = ctx;
  const normalizedEoBilagMode = normalizeEoBilagIndkomstYdelserMode(eoBilagIndkomstYdelserMode);

  const offentligeErrorRowIds = getOffentligeYdelserErrorRowIdSet(eoValues.offentligeYdelserRows ?? []);

  // Bemærk: midlertidigt_eet-rækker filtreres IKKE fra her — det er tilsigtet.
  // Offentlige ydelser viser de faktiske beløb som brugeren har importeret (rå EET-beløb pr. periode),
  // mens renderMidlertidigtEetSection viser beregningsprincipperne (grundydelse, regulering, mdr., osv.).
  // De to sektioner er komplementære og tjener forskelligt formål i bilagets dokumentation.
  const kandidatRaekker = eoValues.offentligeYdelserRows ?? [];

  const rangeGroups = buildPeriodRangeGroups(eoValues, eoBilagIndkomstYdelserMode, eoBilagIndkomstYdelserRanges);
  const groupedRows = rangeGroups.map((group) => ({
    group,
    rows: kandidatRaekker.filter((row) => {
      return shouldIncludeOffentligYdelseRowInEoBilag({
        row,
        mode: normalizedEoBilagMode,
        ranges: group.ranges,
        errorRowIds: offentligeErrorRowIds,
      });
    }),
  })).filter((entry) => entry.rows.length > 0);
  const skalVisePeriodeSubheadings = groupedRows.length > 1;

  if (groupedRows.length === 0) return;

  for (const [index, entry] of groupedRows.entries()) {
    if (skalVisePeriodeSubheadings && entry.group.label) {
      if (index === 0) {
        startEoBilagPage('Offentlige ydelser');
        writer.addSectionSpacer();
      }
      renderSubheader(entry.group.label, undefined, { addTopSpacing: index > 0 });
    } else if (index === 0) {
      startEoBilagPage('Offentlige ydelser');
      writer.addSectionSpacer();
    }
    renderOffentligeYdelserRowsPage({
      rows: entry.rows,
      renderSubheader,
      writer,
    });
  }
};

type MidlertidigtEetSectionContext = Readonly<{
  groups: readonly MidlertidigtEetAfgoerelseGroup[];
  startEoBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, nextLineHeight?: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  formatAfgoerelsesdato: (date: ISODateString) => string | undefined;
  eoBilagIndkomstYdelserMode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar;
  eoBilagIndkomstYdelserRanges: readonly IsoRange[];
  writer: Readonly<{
    addSectionSpacer: () => void;
    addSpacer: (height: number) => void;
    setY: (y: number) => void;
    getY: () => number;
    getDoc: () => unknown;
  }>;
}>;

export const renderMidlertidigtEetSection = (ctx: MidlertidigtEetSectionContext): void => {
  const { groups, startEoBilagPage, renderSubheader, formatAfgoerelsesdato, eoBilagIndkomstYdelserMode, eoBilagIndkomstYdelserRanges, writer } = ctx;
  const normalizedEoBilagMode = normalizeEoBilagIndkomstYdelserMode(eoBilagIndkomstYdelserMode);

  const ydelserHeader: RowInput = [
    createPdfTableCell('Fra o.m.', { halign: 'center', bold: true }),
    createPdfTableCell('Til o.m.', { halign: 'center', bold: true }),
    createPdfTableCell('Mdr.', { halign: 'right', bold: true }),
    createPdfTableCell('Grundydelse', { halign: 'right', bold: true }),
    createPdfTableCell('Regulering', { halign: 'right', bold: true }),
    createPdfTableCell('Ydelse/md.', { halign: 'right', bold: true }),
    createPdfTableCell('Beregnet EET', { halign: 'right', bold: true }),
  ];

  const periodeMatcherRanges = (fra: ISODateString, til: ISODateString): boolean => {
    if (normalizedEoBilagMode === 'Alle') return true;
    if (eoBilagIndkomstYdelserRanges.length === 0) return false;
    return eoBilagIndkomstYdelserRanges.some((range) => range.fra <= til && fra <= range.til);
  };

  let bilagIndex = 0;
  for (const group of groups) {
    const perioder = group.perioder.filter((periode) => periodeMatcherRanges(periode.fra, periode.til));
    if (perioder.length === 0) continue;

    if (bilagIndex === 0) {
      startEoBilagPage('Midlertidig EET');
      writer.addSectionSpacer();
    } else {
      writer.addSectionSpacer();
    }
    bilagIndex++;

    const datoText = formatAfgoerelsesdato(group.afgoerelsesdato) ?? group.afgoerelsesdato;
    renderSubheader(`Afgørelse ${datoText}`, undefined, { addTopSpacing: bilagIndex > 1 });

    const body: RowInput[] = [
      ydelserHeader,
      ...perioder.map(
        (row): RowInput => [
          createPdfTableCell(formatIsoDateShort(row.fra), { halign: 'center' }),
          createPdfTableCell(formatIsoDateShort(row.til), { halign: 'center' }),
          cellRight(formatMaaneder4(row.maanederPraecis)),
          cellRight(formatKr(row.grundydelseAfrundet, 2)),
          cellRight(formatReguleringPct(row.reguleringPct)),
          cellRight(formatKr(row.maanedligYdelse)),
          cellRight(formatKr(row.beregnetEet)),
        ]
      ),
    ];

    const doc = writer.getDoc() as jsPDF;
    const startY = writer.getY();
    const finalY = renderPdfTable({ doc, startY, body, hasHeaderRow: true });
    writer.setY(resolvePdfSectionEndY(finalY, startY));
  }
};
