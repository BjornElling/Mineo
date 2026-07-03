import type { RowInput } from 'jspdf-autotable';
import { resolveDocumentSectionEndY } from '../../../layout/documentLayoutHelpers';
import { amountValueToDisplayString, amountValueToNumber } from '../../../../utils/expressionAmount';
import { formatAsAmount } from '../../../../utils/formatUtils';
import { roundByMethod } from '../../../../utils/rounding';
import { ydelsestyper } from '../../../../data/ydelsestyper';
import { getOffentligeYdelserErrorRowIdSet } from '../../../../domain/erstatningsopgoerelse/validation/indkomstRowValidation';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../../schemas/formSchemas';
import type { ISODateString } from '../../../../types/branded';
import { buildPeriodRangeGroups, normalizeEoBilagIndkomstYdelserMode, type IsoRange } from '../../../../domain/erstatningsopgoerelse/engines/periodRangeGroups';
import { cellRight, createDocumentDistributedColumnStyles, createDocumentTableCell, renderDocumentTable } from '../../../layout/documentTableRenderer';
import { OFFENTLIGE_YDELSER_PDF_HEADERS } from '../../../../domain/erstatningsopgoerelse/tables/offentligeYdelserTableColumns';
import type { MidlertidigtEetAfgoerelseGroup } from '../../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { buildMidlertidigtEetPdfGroupsForTafRanges } from '../../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetBilagGroups';
import { formatPct } from '../../../../domain/erhvervsevnetab/eetFormatUtils';
import { formatISOToDanish } from '../../../../utils/dateFormatting';
import { formatMaaneder4, formatReguleringPct, formatKr } from '../../../layout/documentFormatUtils';
import type { DocumentWriter } from '../../../writer';

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
  writer: Pick<DocumentWriter, 'addSectionSpacer' | 'addSpacer' | 'setY' | 'getY' | 'getDoc' | 'writeUnderlinedSubheader'>;
}>;

type RenderOffentligeYdelserRowsPageContext = Readonly<{
  rows: readonly OffentligeYdelserRow[];
  visYdelsestypeSubheader?: boolean;
  writer: Pick<DocumentWriter, 'addSectionSpacer' | 'addSpacer' | 'setY' | 'getY' | 'getDoc' | 'writeUnderlinedSubheader'>;
}>;

export const renderOffentligeYdelserRowsPage = (ctx: RenderOffentligeYdelserRowsPageContext): void => {
  const {
    rows,
    visYdelsestypeSubheader = true,
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
      // "Samlet" skal være summen af de VISTE (2-decimal-afrundede) ydelse- og tillæg-tal, så
      // kolonnen kan efterregnes fra de to viste beløb (ikke summen af de rå udtryksværdier).
      const samletValue =
        roundByMethod(ydelseValue, 2, 'halfAwayFromZero') + roundByMethod(ydelse2Value, 2, 'halfAwayFromZero');
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

  const doc = writer.getDoc();
  const columnStyles = createDocumentDistributedColumnStyles(OFFENTLIGE_YDELSER_PDF_HEADERS.length);

  for (const label of groupOrder) {
    if (visYdelsestypeSubheader) writer.writeUnderlinedSubheader(label);
    const startY = writer.getY();
    const tableRows = buildTableRows(grouped.get(label) ?? []);
    const finalY = renderDocumentTable({
      doc,
      startY,
      body: tableRows,
      columnStyles,
    });
    writer.setY(resolveDocumentSectionEndY(finalY, startY));
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
  writer: Pick<DocumentWriter, 'addSectionSpacer' | 'addSpacer' | 'setY' | 'getY' | 'getDoc'>;
}>;

export const renderMidlertidigtEetSection = (ctx: MidlertidigtEetSectionContext): void => {
  const { groups, startEoBilagPage, renderSubheader, formatAfgoerelsesdato, tafRanges, writer } = ctx;

  const ydelserHeader: RowInput = [
    createDocumentTableCell('Fra o.m.', { halign: 'center', bold: true }),
    createDocumentTableCell('Til o.m.', { halign: 'center', bold: true }),
    createDocumentTableCell('Mdr.', { halign: 'right', bold: true }),
    createDocumentTableCell('Grundydelse', { halign: 'right', bold: true }),
    createDocumentTableCell('Regulering', { halign: 'right', bold: true }),
    createDocumentTableCell('Ydelse/md.', { halign: 'right', bold: true }),
    createDocumentTableCell('Beregnet EET', { halign: 'right', bold: true }),
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
    const pctText = Number.isFinite(group.eetPct) ? ` (${formatPct(group.eetPct)})` : '';
    renderSubheader(`Afgørelse ${datoText}${pctText}`, undefined, { addTopSpacing: bilagIndex > 1 });

    const body: RowInput[] = [
      ydelserHeader,
      ...perioder.map(
        (row): RowInput => [
          createDocumentTableCell(formatISOToDanish(row.fra), { halign: 'center' }),
          createDocumentTableCell(formatISOToDanish(row.til), { halign: 'center' }),
          cellRight(formatMaaneder4(row.maanederPraecis)),
          cellRight(formatKr(row.grundydelseAfrundet, 2)),
          cellRight(formatReguleringPct(row.reguleringPct)),
          cellRight(formatKr(row.maanedligYdelse)),
          cellRight(formatKr(row.beregnetEet)),
        ]
      ),
    ];

    const doc = writer.getDoc();
    const startY = writer.getY();
    const finalY = renderDocumentTable({ doc, startY, body, hasHeaderRow: true });
    writer.setY(resolveDocumentSectionEndY(finalY, startY));
  }
};
