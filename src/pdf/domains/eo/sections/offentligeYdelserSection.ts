import type jsPDF from 'jspdf';
import type { RowInput } from 'jspdf-autotable';
import { resolvePdfSectionEndY } from '../../../shared/pdfHelpers';
import { amountValueToDisplayString, amountValueToNumber } from '../../../../utils/expressionAmount';
import { formatAsAmount } from '../../../../utils/formatUtils';
import { ydelsestyper } from '../../../../data/ydelsestyper';
import { getOffentligeYdelserErrorRowIdSet } from '../../../../domain/erstatningsopgoerelse/validation/indkomstRowValidation';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../../schemas/formSchemas';
import type { ISODateString } from '../../../../types/branded';
import { parseISODate } from '../../../../types/branded';
import { buildPeriodRangeGroups, normalizeEoBilagIndkomstYdelserMode, type IsoRange } from '../../../../domain/erstatningsopgoerelse/engines/periodRangeGroups';
import { periodiserBeloebForOffentligYdelse } from '../../../../domain/erstatningsopgoerelse/engines/periodiseringsMotor';
import { roundHeleKroner } from '../../../../domain/erstatningsopgoerelse/shared/eoMoney';
import { cellRight, createPdfDistributedColumnStyles, createPdfTableCell, renderPdfTable } from '../../../shared/pdfTableRenderer';
import { OFFENTLIGE_YDELSER_PDF_HEADERS } from '../../../../domain/erstatningsopgoerelse/tables/offentligeYdelserTableColumns';
import type { MidlertidigtEetAfgoerelseGroup } from '../../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { formatISOToDanish } from '../../../../utils/dateFormatting';
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
  writeBoldSubheaderWithWrappedText: (subheaderText: string, bodyText: string) => void;
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
        formatISOToDanish(row.fraDato) || row.fraDato?.trim() || '',
        formatISOToDanish(row.tilDato) || row.tilDato?.trim() || '',
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
    writeBoldSubheaderWithWrappedText,
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

  // Kommentarer (hvis udfyldt) renderes under en underoverskrift nederst på bilaget,
  // i samme stil som procesrente-PDF'ens kommentarafsnit.
  const kommentarer = eoValues.offentligeYdelserKommentarer?.trim() ?? '';
  if (kommentarer !== '') {
    writer.addSectionSpacer();
    writeBoldSubheaderWithWrappedText('Kommentarer', kommentarer);
  }
};

type MidlertidigtEetSectionContext = Readonly<{
  groups: readonly MidlertidigtEetAfgoerelseGroup[];
  startEoBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, nextLineHeight?: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  formatAfgoerelsesdato: (date: ISODateString) => string | undefined;
  tafRanges: readonly IsoRange[];
  writer: Readonly<{
    addSectionSpacer: () => void;
    addSpacer: (height: number) => void;
    setY: (y: number) => void;
    getY: () => number;
    getDoc: () => unknown;
  }>;
}>;

type ClampedMidlertidigtEetRow = MidlertidigtEetAfgoerelseGroup['perioder'][number];
type ClampedMidlertidigtEetGroup = Readonly<{
  afgoerelsesdato: MidlertidigtEetAfgoerelseGroup['afgoerelsesdato'];
  perioder: readonly ClampedMidlertidigtEetRow[];
}>;

type PendingClampedMidlertidigtEetRow = Readonly<{
  groupIndex: number;
  row: ClampedMidlertidigtEetRow;
  rawBeregnetEet: number;
}>;

const emptyShDays = new Set<ISODateString>();

const clampIsoRange = (range: IsoRange, fra: ISODateString, til: ISODateString): IsoRange | null => {
  const clampedFra = range.fra > fra ? range.fra : fra;
  const clampedTil = range.til < til ? range.til : til;
  return clampedFra <= clampedTil ? { fra: clampedFra, til: clampedTil } : null;
};

export const buildMidlertidigtEetPdfGroupsForTafRanges = (
  groups: readonly MidlertidigtEetAfgoerelseGroup[],
  tafRanges: readonly IsoRange[]
): readonly ClampedMidlertidigtEetGroup[] => {
  if (groups.length === 0 || tafRanges.length === 0) return [];

  const pendingRows: PendingClampedMidlertidigtEetRow[] = [];
  const outputGroups = groups.map((group) => ({
    afgoerelsesdato: group.afgoerelsesdato,
    perioder: [] as ClampedMidlertidigtEetRow[],
  }));

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    if (!group) continue;
    for (const row of group.perioder) {
      const rowStart = parseISODate(row.fra);
      const rowEnd = parseISODate(row.til);
      if (!rowStart || !rowEnd || rowStart > rowEnd) continue;

      for (const tafRange of tafRanges) {
        const clamped = clampIsoRange(tafRange, row.fra, row.til);
        if (!clamped) continue;
        const clampedStart = parseISODate(clamped.fra);
        const clampedEnd = parseISODate(clamped.til);
        if (!clampedStart || !clampedEnd || clampedStart > clampedEnd) continue;

        const rawBeregnetEet = periodiserBeloebForOffentligYdelse({
          totalBeloeb: row.beregnetEet,
          interval: { start: rowStart, end: rowEnd },
          range: clamped,
          periodisering: ydelsestyper.midlertidigt_eet.periodisering,
          ydelsestypeKey: 'midlertidigt_eet',
          shDays: emptyShDays,
        });
        if (!Number.isFinite(rawBeregnetEet) || rawBeregnetEet <= 0) continue;

        const roundedBeregnetEet = roundHeleKroner(rawBeregnetEet);
        // Skip rækker der runder til 0 — de bidrager intet til bilagets total og
        // ville ellers indgå i delta-justeringen som en "modtager" der ikke kan
        // bære delta uden at gå negativ.
        if (roundedBeregnetEet <= 0) continue;
        const maanederPraecis = row.maanedligYdelse > 0
          ? roundedBeregnetEet / row.maanedligYdelse
          : row.maanederPraecis;
        pendingRows.push({
          groupIndex,
          rawBeregnetEet,
          row: {
            ...row,
            fra: clamped.fra,
            til: clamped.til,
            maanederPraecis,
            beregnetEet: roundedBeregnetEet,
          },
        });
      }
    }
  }

  if (pendingRows.length === 0) return [];

  const targetRoundedTotal = roundHeleKroner(pendingRows.reduce((sum, row) => sum + row.rawBeregnetEet, 0));
  const roundedRowsTotal = pendingRows.reduce((sum, row) => sum + row.row.beregnetEet, 0);
  const roundingDelta = targetRoundedTotal - roundedRowsTotal;

  // Læg delta'en på den største række frem for "sidste række".
  // Største-række-strategien er stabil under sortering og garanterer, at delta
  // ikke kan gøre en lille bær-række negativ — typisk delta er ≤ 0,5 kr, og største
  // række har her allerede ≥ 1 kr (jf. `roundedBeregnetEet > 0`-filteret ovenfor),
  // så `nextBeregnetEet > 0` er bevaret. Hvis to rækker har samme beregnetEet, vinder
  // den første (deterministisk fra `findIndex`).
  const deltaRecipientIndex = pendingRows.reduce(
    (bestIndex, entry, index) =>
      entry.row.beregnetEet > pendingRows[bestIndex].row.beregnetEet ? index : bestIndex,
    0
  );

  pendingRows.forEach((entry, index) => {
    const nextBeregnetEet = index === deltaRecipientIndex
      ? entry.row.beregnetEet + roundingDelta
      : entry.row.beregnetEet;
    if (nextBeregnetEet <= 0) return;
    const adjustedRow: ClampedMidlertidigtEetRow = {
      ...entry.row,
      beregnetEet: nextBeregnetEet,
      maanederPraecis: entry.row.maanedligYdelse > 0
        ? nextBeregnetEet / entry.row.maanedligYdelse
        : entry.row.maanederPraecis,
    };
    outputGroups[entry.groupIndex]?.perioder.push(adjustedRow);
  });

  return outputGroups.filter((group) => group.perioder.length > 0);
};

export const renderMidlertidigtEetSection = (ctx: MidlertidigtEetSectionContext): void => {
  const { groups, startEoBilagPage, renderSubheader, formatAfgoerelsesdato, tafRanges, writer } = ctx;

  const ydelserHeader: RowInput = [
    createPdfTableCell('Fra o.m.', { halign: 'center', bold: true }),
    createPdfTableCell('Til o.m.', { halign: 'center', bold: true }),
    createPdfTableCell('Mdr.', { halign: 'right', bold: true }),
    createPdfTableCell('Grundydelse', { halign: 'right', bold: true }),
    createPdfTableCell('Regulering', { halign: 'right', bold: true }),
    createPdfTableCell('Ydelse/md.', { halign: 'right', bold: true }),
    createPdfTableCell('Beregnet EET', { halign: 'right', bold: true }),
  ];

  const clampedGroups = buildMidlertidigtEetPdfGroupsForTafRanges(groups, tafRanges);

  let bilagIndex = 0;
  for (const group of clampedGroups) {
    const perioder = group.perioder;
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
          createPdfTableCell(formatISOToDanish(row.fra), { halign: 'center' }),
          createPdfTableCell(formatISOToDanish(row.til), { halign: 'center' }),
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
