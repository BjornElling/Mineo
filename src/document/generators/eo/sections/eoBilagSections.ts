/**
 * Delt bilag-renderer for erstatningsopgørelses-dokumenter.
 *
 * Indeholder hele bilags-sekvensen (lønindkomst, offentlige ydelser, midlertidigt
 * EET, regulering, regulering af offentlige ydelser, SH-dage og sygeferiegodtgørelse),
 * udtrukket fra `erstatningsopgoerelsePdf.ts` så den kan genbruges uændret af både
 * den almindelige EO-PDF og "TAF opreguleret til beregningsåret"-PDF'en.
 *
 * Gating på `selectedElements` og datagrundlag er identisk med den oprindelige
 * inline-implementering — outputtet skal være bit-for-bit det samme.
 */

import type { RowInput } from 'jspdf-autotable';
import { resolveDocumentSectionEndY } from '../../../layout/documentLayoutHelpers';
import { createStandardPdfWriter } from '../../../writer';
import { PDF_AMOUNT_RIGHT_COLUMN_WIDTH_MM } from '../../../layout/pdfConfig';
import type { ErstatningsopgoerelseValues, Loenperiode, StamdataValues } from '../../../../schemas/formSchemas';
import type { MidlertidigtEetAfgoerelseGroup } from '../../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { capitalizeFirstCharDa, formatPercent as formatPercentUtil, formatAsAmount } from '../../../../utils/formatUtils';
import { isEffectivelyZero, isWithinTolerance } from '../../../../utils/numberComparison';
import { getStandardLoenTableHeaders, resolveStandardLoenPeriodColumns } from '../../../../domain/aarsloen/standardLoenTableColumns';
import {
  createDocumentTableCell,
  createDocumentTableHeaderCell,
  createDocumentTableSummedTotalRow,
  renderDocumentTable,
} from '../../../layout/documentTableRenderer';
import {
  buildEoBilagIndkomstYdelserRanges,
  hasNonZeroLoenAmount,
  shouldRenderEoIndkomstOgYdelserBilag,
  shouldIncludeLoenRowInEoBilag,
  shouldIncludeOffentligYdelseRowInEoBilag,
  hasLoenReguleringEoBilagData,
  hasOffentligeYdelserReguleringInModel,
} from '../../../../domain/erstatningsopgoerelse/helpers/eoBilagRules';
import { parseOptionalIsoDate } from '../../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { formatISOToDanish as formatDateShort, formatIsoDateLong as formatDateLong } from '../../../../utils/dateFormatting';
import { buildOffentligeYdelserReguleringTableData } from '../../../../domain/erstatningsopgoerelse/engines/offentligeYdelserUdviklingBeregning';
import {
  buildReguleringIndexRows,
  buildReguleringsvaerdierTableData,
  resolveLoenSkadedatoText,
  resolveAnvendtReguleringsdato,
  resolveStatistikModelIdFromLabel,
  resolveTafDateBounds,
} from '../../../../domain/erstatningsopgoerelse/engines/reguleringsPresentation';
import { resolveValgtReguleringDisplayForPdf } from '../../../../domain/erstatningsopgoerelse/helpers/loenudviklingDisplay';
import {
  formatCurrencyFromOre,
  formatCurrencyFromOreTrimmed,
  formatMoneyOreWithKrTrimmed,
} from '../../../layout/documentFormatUtils';
import type { SelectedElements } from '../types';
import { renderLoenindkomstSection } from './loenindkomstSection';
import { renderMidlertidigtEetSection, renderOffentligeYdelserSection } from './offentligeYdelserSection';
import { renderShDageSection } from './shDageSection';
import { renderReguleringSection } from './reguleringSection';
import type { EoModel } from '../../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import { mergeIsoDateRanges } from '../../../../domain/erstatningsopgoerelse/engines/isoRangeAlgebra';
import {
  SFGG_FERIEPENGE_HVIS_IKKE_SKADE_LABEL,
  SFGG_FERIEPENGE_MODTAGET_LABEL,
  SFGG_TABLE_TOTAL_LABEL,
  buildSfggReferenceperiodeCountLabel,
  formatSfggAfkortningPdfLine,
} from '../../../../domain/erstatningsopgoerelse/helpers/sygeferiegodtgoerelseTexts';

type StandardPdfWriter = ReturnType<typeof createStandardPdfWriter>;

const EO_RIGHT_COLUMN_WIDTH = PDF_AMOUNT_RIGHT_COLUMN_WIDTH_MM;

type EoBilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];

const formatPctFromInput = (value: number | undefined): string => {
  return formatPercentUtil(value ?? 0);
};

const normalizeSfggIntroRightText = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed === '') return trimmed;
  return capitalizeFirstCharDa(trimmed.replace(/\.$/, ''));
};

const resolveSfggReferenceSatsUnit = (divisorLabel: 'kalenderdage' | 'arbejdsdage'): string =>
  divisorLabel === 'kalenderdage' ? 'kr./kalenderdag' : 'kr./arbejdsdag';

const resolveSfggPeriodDayUnitSingular = (divisorLabel: 'kalenderdage' | 'arbejdsdage'): 'kalenderdag' | 'arbejdsdag' =>
  divisorLabel === 'kalenderdage' ? 'kalenderdag' : 'arbejdsdag';

const getLoenindkomstTableHeaders = (loenperiode: Loenperiode): readonly string[] => {
  return getStandardLoenTableHeaders(loenperiode).map((header) => {
    if (header === 'Ikke-pensions-\ngivende løn') return 'Ikke-pens.\ngiv. løn';
    if (header === 'ATP og anden\nløn u. tillæg') return 'ATP og løn\nu. till./pens.';
    return header;
  });
};

export type RenderEoBilagSectionsContext = Readonly<{
  writer: StandardPdfWriter;
  model: EoModel;
  eoValues: ErstatningsopgoerelseValues;
  stamdataValues: StamdataValues;
  selectedElements: SelectedElements;
  midlertidigtEetGroups?: readonly MidlertidigtEetAfgoerelseGroup[];
}>;

/**
 * Renderer hele bilags-sekvensen for et erstatningsopgørelses-dokument.
 *
 * Hver enkelt bilag-side gates på `selectedElements` og sit eget datagrundlag,
 * fuldstændig som i den oprindelige inline-implementering i `erstatningsopgoerelsePdf.ts`.
 */
export const renderEoBilagSections = (ctx: RenderEoBilagSectionsContext): void => {
  const { writer, model, eoValues, stamdataValues, selectedElements } = ctx;
  const midlertidigtEetGroups = ctx.midlertidigtEetGroups ?? [];

  const eoBilagIndkomstYdelserMode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar =
    eoValues.eoBilagLoenindkomstOgOffentligeYdelserIndgaar ?? 'Perioden';
  const eoBilagIndkomstYdelserRanges = buildEoBilagIndkomstYdelserRanges(eoValues, eoBilagIndkomstYdelserMode);

  const safeAddWrappedText = (text: string) => {
    writer.writeWrappedText(text);
  };

  const safeAddLeftRightText = (
    leftText: string,
    rightText: string,
    rightMaxWidth: number,
    options?: Readonly<{
      leftFontStyle?: 'normal' | 'bold';
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
    }>
  ) => {
    writer.writeLeftRightText(
      leftText,
      rightText,
      {
        ...options,
        minRightColumnWidth: Math.max(rightMaxWidth, EO_RIGHT_COLUMN_WIDTH),
      }
    );
  };

  const standardRightMaxWidth = writer.getTextWidth('000.000.000,00');
  const renderSubheader = writer.writeBoldSubheader;

  const writeLabelValueLine = (label: string, value: string) => {
    safeAddLeftRightText(label, capitalizeFirstCharDa(value), standardRightMaxWidth, { rightFontStyle: 'normal' });
  };

  const renderSfggReferenceSatsBlock = (
    entry: EoModel['tabtArbejdsfortjeneste']['sygeferiegodtgoerelse']['perAnsaettelsesforhold'][number]
  ) => {
    const usesReferenceperiodeRate = entry.sfggReferencesatsFormula !== null;

    if (usesReferenceperiodeRate) {
      writer.writeUnderlinedSubheader('Referencesats');
    }

    if (entry.sfggSourceKind === 'overenskomst_direkte') {
      const satsText = (() => {
        const satsOre = entry.segments[0]?.satsOre;
        if (typeof satsOre === 'number') {
          return `${formatCurrencyFromOre(satsOre)} kr./arbejdsdag`;
        }
        return null;
      })();
      if (satsText && entry.sfggDirectRateLabel) {
        safeAddLeftRightText(entry.sfggDirectRateLabel, satsText, standardRightMaxWidth, { rightFontStyle: 'normal' });
      }
      return;
    }

    if (
      !entry.sfggReferenceperiode
      || !entry.sfggReferenceperiode.fra
      || !entry.sfggReferenceperiode.til
      || !entry.sfggReferencesatsFormula
      || entry.sfggReferencesats.status !== 'ok'
    ) {
      return;
    }
    const { sfggReferencesatsFormula } = entry;
    if (!entry.sfggReferenceperiodeAuthorityText) {
      return;
    }

    safeAddWrappedText(
      `Opgøres som den gennemsnitlige feriepengebetaling i ${entry.sfggReferenceperiodeLabel} før sygeforløbet.`
    );
    if (entry.sfggLovbestemtFeriepengeNote) {
      safeAddWrappedText(entry.sfggLovbestemtFeriepengeNote);
    }
    writer.addSectionSpacer();
    writeLabelValueLine(
      'Referenceperiode',
      `${formatDateShort(entry.sfggReferenceperiode.fra)} - ${formatDateShort(entry.sfggReferenceperiode.til)}`
    );
    writeLabelValueLine(
      buildSfggReferenceperiodeCountLabel(sfggReferencesatsFormula),
      `${formatAsAmount(sfggReferencesatsFormula.divisorDage, 0)} ${sfggReferencesatsFormula.divisorLabel}`
    );
    writeLabelValueLine(
      'Lønnen i referenceperioden udgør',
      `${formatAsAmount(sfggReferencesatsFormula.loenPlusLoen2PlusIkkePensLoenKroner, 2)} kr.`
    );
    safeAddLeftRightText(
      `Referencesats (${formatAsAmount(sfggReferencesatsFormula.loenPlusLoen2PlusIkkePensLoenKroner, 2)} x ${formatPercentUtil(sfggReferencesatsFormula.feriePctDecimal * 100)} / ${formatAsAmount(sfggReferencesatsFormula.divisorDage, 0)} ${sfggReferencesatsFormula.divisorLabel}) =`,
      `${formatCurrencyFromOre(entry.sfggReferencesats.value)} ${resolveSfggReferenceSatsUnit(sfggReferencesatsFormula.divisorLabel)}`,
      standardRightMaxWidth,
      { rightFontStyle: 'bold' }
    );
  };

  const renderSfggPeriodBlock = (
    entry: EoModel['tabtArbejdsfortjeneste']['sygeferiegodtgoerelse']['perAnsaettelsesforhold'][number]
  ) => {
    const sfggVisningsperiodeLines = entry.sfggVisningsperiode.map((range) =>
      `${formatDateShort(range.fra)} - ${formatDateShort(range.til)}`
    );
    const divisorLabel = entry.sfggDayBasis;
    const dayUnit = resolveSfggPeriodDayUnitSingular(divisorLabel);
    const rateLabel = entry.sfggSourceKind === 'overenskomst_direkte' ? 'overenskomstens referencesats' : 'referencesatsen';
    const hasRegulatedSfggRate = entry.segments.some((segment) =>
      typeof segment.reguleringsindeks === 'number' && !isWithinTolerance(segment.reguleringsindeks, 100)
    );
    const baseAdjustmentText = divisorLabel === 'arbejdsdage'
      ? 'Der beregnes ikke sygeferiegodtgørelse på SH-dage, under ferie og på andre fraværsdage uden løn.'
      : 'Der beregnes ikke sygeferiegodtgørelse under ferie og på eventuelle andre fraværsdage uden løn.';
    writer.writeUnderlinedSubheader(
      entry.sfggVisningsperiode.length === 1
        ? 'Periode med sygeferiegodtgørelse'
        : 'Perioder med sygeferiegodtgørelse'
    );
    if (sfggVisningsperiodeLines.length === 0) {
      safeAddWrappedText('Ingen');
    } else {
      sfggVisningsperiodeLines.forEach((line) => safeAddWrappedText(line));
    }

    writer.writeUnderlinedSubheader(SFGG_FERIEPENGE_HVIS_IKKE_SKADE_LABEL);
    safeAddWrappedText(
      hasRegulatedSfggRate
        ? `Kravet beregnes per ${dayUnit} med ${rateLabel} tillagt efterfølgende lønstigninger.`
        : `Kravet beregnes per ${dayUnit} med ${rateLabel}.`
    );

    const firstDayAdjustmentText = entry.sfggFirstTafDayExcludedText
      ? ` ${entry.sfggFirstTafDayExcludedText}`
      : '';
    safeAddWrappedText(`${baseAdjustmentText}${firstDayAdjustmentText}`);

    if (entry.sfggAfterEmployerSickPayText) {
      safeAddWrappedText(entry.sfggAfterEmployerSickPayText);
    }

    const rows = entry.segments;
    if (rows.length === 0) {
      if (entry.sfggAfterEmployerSickPayText) {
        writer.writeUnderlinedSubheader('Beregnet krav');
        safeAddWrappedText('Der er betalt sygeløn i hele perioden og derfor ikke krav på sygeferiegodtgørelse.');
      }
      return;
    }

    const antalDageHeader = divisorLabel === 'kalenderdage' ? 'Antal kalenderdage' : 'Antal arbejdsdage';
    const tableRows: RowInput[] = [
      [
        createDocumentTableHeaderCell('Fra-dato', 'center'),
        createDocumentTableHeaderCell('Til-dato', 'center'),
        createDocumentTableHeaderCell('Feriepenge-sats', 'center'),
        createDocumentTableHeaderCell('AG-pension', 'center'),
        createDocumentTableHeaderCell(antalDageHeader, 'center'),
        createDocumentTableHeaderCell(SFGG_TABLE_TOTAL_LABEL, 'center'),
      ],
    ];

    for (const row of rows) {
      tableRows.push(
        [
          createDocumentTableCell(formatDateShort(row.fra) ?? '', { halign: 'center' }),
          createDocumentTableCell(formatDateShort(row.til) ?? '', { halign: 'center' }),
          createDocumentTableCell(formatCurrencyFromOreTrimmed(row.satsOre), { halign: 'center' }),
          createDocumentTableCell(`+ ${formatPercentUtil(row.agPensionPct)}`, { halign: 'center' }),
          createDocumentTableCell(String(row.antalDage), { halign: 'center' }),
          createDocumentTableCell(formatCurrencyFromOreTrimmed(row.feriepengekravOre), { halign: 'right' }),
        ]
      );
    }

    const totalRow = createDocumentTableSummedTotalRow(
      'I alt',
      rows.map((row) => row.feriepengekravOre),
      {
        columnCount: 6,
        valueColumnIndex: 5,
        formatValue: (total) => formatMoneyOreWithKrTrimmed(total),
        valueHasKrSuffix: false,
      }
    );
    const totalRowIndex = totalRow ? tableRows.length : null;
    if (totalRow) {
      tableRows.push(totalRow.row);
    }

    const startY = writer.getY();
    const finalY = renderDocumentTable({
      doc: writer.getDoc(),
      startY,
      body: tableRows,
      underlinedCellPositions: totalRowIndex === null || totalRow === null
        ? []
        : [{ rowIndex: totalRowIndex, columnIndex: totalRow.valueCellColumnIndex }],
    });
    writer.setY(resolveDocumentSectionEndY(finalY, startY));

    const feriepengeHvisIkkeSkadeOre = entry.feriepengekravTotalOre;
    const feriepengeModtagetOre = entry.feriepengeModtagetFormula?.totalOre ?? 0;
    const alleredeBetaltOre = entry.alleredeBetaltOre ?? 0;
    const beregnetSygeferiegodtgoerelseOre = entry.totalOre;
    const feriepengeModtagetLabel = SFGG_FERIEPENGE_MODTAGET_LABEL;

    writer.writeUnderlinedSubheader('Beregnet krav');
    writeLabelValueLine(SFGG_FERIEPENGE_HVIS_IKKE_SKADE_LABEL, formatCurrencyFromOre(feriepengeHvisIkkeSkadeOre));
    writeLabelValueLine(feriepengeModtagetLabel, formatCurrencyFromOre(-feriepengeModtagetOre));
    writeLabelValueLine('Allerede betalt sygeferiegodtgørelse i perioden', formatCurrencyFromOre(-alleredeBetaltOre));
    safeAddLeftRightText(
      'Beregnet sygeferiegodtgørelse',
      formatCurrencyFromOre(beregnetSygeferiegodtgoerelseOre),
      standardRightMaxWidth,
      { rightFontStyle: 'bold' }
    );
  };

  const startEoBilagPage = (titleText: string) => {
    writer.addPage();
    writer.writeTitle(titleText);
  };

  const skalViseIndkomstOgYdelserBilag =
    shouldRenderEoIndkomstOgYdelserBilag(eoValues, eoBilagIndkomstYdelserMode);

  if (selectedElements.loenindkomst && skalViseIndkomstOgYdelserBilag) {
    renderLoenindkomstSection({
      selectedElements,
      eoValues,
      startEoBilagPage,
      renderSubheader,
      safeAddWrappedText: writer.writeWrappedText,
      writeLabelValueLine,
      formatDateLong,
      formatPctFromInput,
      isZeroPct: isEffectivelyZero,
      getLoenindkomstTableHeaders,
      resolvePeriodColumns: resolveStandardLoenPeriodColumns,
      hasNonZeroLoenAmount,
      shouldIncludeLoenRowInEoBilag,
      eoBilagIndkomstYdelserMode,
      eoBilagIndkomstYdelserRanges,
      writer,
    });
  }

  if (selectedElements.offentligeYdelser && skalViseIndkomstOgYdelserBilag) {
    renderOffentligeYdelserSection({
      eoValues,
      startEoBilagPage,
      renderSubheader,
      shouldIncludeOffentligYdelseRowInEoBilag,
      eoBilagIndkomstYdelserMode,
      eoBilagIndkomstYdelserRanges,
      writeBoldSubheaderWithWrappedText: writer.writeBoldSubheaderWithWrappedText,
      writer,
    });
  }

  if (selectedElements.midlertidigEet && midlertidigtEetGroups.length > 0) {
    renderMidlertidigtEetSection({
      groups: midlertidigtEetGroups,
      startEoBilagPage,
      renderSubheader,
      formatAfgoerelsesdato: formatDateLong,
      tafRanges: model.tafRanges,
      writer,
    });
  }

  // Bilagsvalget "Regulering" styrer både lønregulering og regulering af offentlige ydelser.
  // De to sektioner renderes fortsat kun, når deres eget datagrundlag faktisk findes.
  if (
    selectedElements.regulering &&
    skalViseIndkomstOgYdelserBilag &&
    hasLoenReguleringEoBilagData(eoValues, model.tabtArbejdsfortjeneste.loenudvikling)
  ) {
    renderReguleringSection({
      eoValues,
      stamdataValues,
      modelLoenudviklingPerAnsaettelse: model.tabtArbejdsfortjeneste.loenudvikling?.perAnsaettelse ?? [],
      modelLoenudviklingGlobaleSegmenter: model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [],
      modelLoenudviklingGlobaltForloeb: model.tabtArbejdsfortjeneste.loenudvikling?.forloeb,
      startEoBilagPage,
      renderSubheader,
      safeAddWrappedText: writer.writeWrappedText,
      writeLabelValueLine,
      resolveValgtReguleringDisplay: resolveValgtReguleringDisplayForPdf,
      resolveAnvendtReguleringsdato,
      parseOptionalIsoDate,
      resolveLoenSkadedatoText,
      resolveTafDateBounds,
      buildReguleringsvaerdierTableData,
      buildReguleringIndexRows: (params) => buildReguleringIndexRows({
        ...params,
        tafBeregningsenhed: model.tabtArbejdsfortjeneste.tafBeregningsenhed,
      }),
      resolveStatistikModelIdFromLabel,
      writer,
    });
  }

  const offentligeYdelserUdvikling = model.tabtArbejdsfortjeneste.offentligeYdelserUdvikling;
  if (
    selectedElements.regulering &&
    eoValues.regulerOffentligeYdelser === 'Ja' &&
    offentligeYdelserUdvikling &&
    offentligeYdelserUdvikling.entries.length > 0 &&
    hasOffentligeYdelserReguleringInModel(offentligeYdelserUdvikling)
  ) {
    startEoBilagPage('Regulering af offentlige ydelser');
    const reguleringsBaseDato = offentligeYdelserUdvikling.reguleringsBaseIso
      ? formatDateShort(offentligeYdelserUdvikling.reguleringsBaseIso)
      : 'ikke angivet';
    writeLabelValueLine('Regulering foretages med afsæt i værdier den', reguleringsBaseDato);
    if (model.periodeDisplay) {
      writeLabelValueLine('Periode', model.periodeDisplay);
    }
    // Skadelidtes navn udelades bevidst her: det fremgår allerede af dokumentets brevhoved,
    // så en separat "Skadelidte"-linje i regulerings-bilaget er overflødig.
    writer.writeUnderlinedSubheader('Reguleringsværdier');
    let tableData: ReturnType<typeof buildOffentligeYdelserReguleringTableData> = null;
    let tableDataError = false;
    try {
      tableData = buildOffentligeYdelserReguleringTableData(offentligeYdelserUdvikling);
    } catch {
      tableDataError = true;
      tableData = null;
    }
    if (tableData && tableData.rows.length > 0) {
      const tableRows: RowInput[] = [
        tableData.columns.map((column) => createDocumentTableHeaderCell(column, 'center')),
        ...tableData.rows.map((row) => row.map((cell) => createDocumentTableCell(cell, { halign: 'center' }))),
      ];
      const startY = writer.getY();
      // Word matcher PDF'ens højrejustering af talkolonnerne (alle kolonner ≥ 1).
      // Insettet nedenfor er rent visuelt og udelades bevidst i Word.
      const dataRowColumnHalign: Record<number, 'right'> = {};
      for (let columnIndex = 1; columnIndex < tableData.columns.length; columnIndex += 1) {
        dataRowColumnHalign[columnIndex] = 'right';
      }
      const finalY = renderDocumentTable({
        doc: writer.getDoc(),
        startY,
        body: tableRows,
        dataRowColumnHalign,
        didParseCell: (data) => {
          const isDataRow = data.row.index >= 1;
          const isNumericColumn = data.column.index >= 1;
          if (!isDataRow || !isNumericColumn) return;

          data.cell.styles.halign = 'right';
          data.cell.styles.cellPadding = {
            top: 1.5,
            bottom: 1.5,
            left: 1.5,
            right: 8,
          };
        },
      });
      writer.setY(resolveDocumentSectionEndY(finalY, startY));
    } else if (tableDataError) {
      safeAddWrappedText('Reguleringsværdier kan ikke vises, fordi en nødvendig reguleringssats mangler.');
    } else {
      safeAddWrappedText('Ingen regulering i den relevante periode.');
    }
    // Selve udregningen af de regulerede offentlige ydelser (per-ydelse segmentlinjer + I alt)
    // vises IKKE her — den fremgår alene på selve erstatningsopgørelsen under "Forventet
    // indkomst". Dette bilag dokumenterer kun reguleringsværdierne (tabellen ovenfor) og
    // reguleringsprincippet (teksten nedenfor). Afstanden tabel → tekst (én addSectionSpacer)
    // matcher bevidst "Regulering"-bilagets afslutning (tabel → addSectionSpacer → tekst).
    writer.addSectionSpacer();
    writer.writeWrappedText('Offentlige ydelser fremskrives årligt per 1. januar med tilpasningsprocenten + 2 %, svarende til den almene statslige regulering af offentlige ydelser.');
  }

  if (selectedElements.shDage) {
    const sfggReferenceperiodeRanges = mergeIsoDateRanges(
      model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.flatMap((entry) => {
        if (entry.sfggDayBasis !== 'arbejdsdage' || entry.sfggReferencesatsFormula === null) return [];
        return entry.sfggReferenceperiode ? [entry.sfggReferenceperiode] : [];
      }),
      { mergeAdjacent: true }
    );
    const harSfggReferenceperiodeMedShFradrag =
      model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.some((entry) =>
        entry.sfggDayBasis === 'arbejdsdage' && entry.sfggReferencesatsFormula !== null
      );
    renderShDageSection({
      eoValues,
      tafRanges: model.tafRanges,
      sfggReferenceperiodeRanges,
      harSfggReferenceperiodeMedShFradrag,
      startEoBilagPage,
      renderSubheader,
      safeAddWrappedText: writer.writeWrappedText,
      writer,
    });
  }

  if (selectedElements.sygeferiegodtgoerelse && model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.length > 0) {
    startEoBilagPage('Sygeferiegodtgørelse');
    model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.forEach((entry) => {
      renderSubheader(entry.ansaettelsesforholdNavn);
      if (entry.sfggIntroText) {
        const introPrefix = 'Sygeferiegodtgørelse beregnes i henhold til ';
        if (entry.sfggIntroText.startsWith(introPrefix)) {
          safeAddLeftRightText(
            introPrefix.trimEnd(),
            normalizeSfggIntroRightText(entry.sfggIntroText.slice(introPrefix.length)),
            standardRightMaxWidth,
            { rightFontStyle: 'normal' }
          );
        } else {
          safeAddWrappedText(entry.sfggIntroText);
        }
      }
      const usesReferenceperiodeRate = entry.sfggReferencesatsFormula !== null;
      if (entry.sfggSourceKind === 'manuel' && entry.sfggReferencesats.status === 'ok') {
        writeLabelValueLine('Referencesatsen udgør', `${formatCurrencyFromOre(entry.sfggReferencesats.value)} kr./arbejdsdag`);
      }
      entry.sfggAfkortninger.forEach((afkortning) => {
        const { left, right } = formatSfggAfkortningPdfLine(afkortning);
        safeAddLeftRightText(left, right, standardRightMaxWidth, { rightFontStyle: 'normal' });
      });
      if (entry.sfggSourceKind !== 'manuel') {
        renderSfggReferenceSatsBlock(entry);
      }
      if (!usesReferenceperiodeRate && entry.sfggSourceKind !== 'manuel' && entry.sfggReferenceperiode) {
        safeAddWrappedText(`Referenceperiode: ${formatDateShort(entry.sfggReferenceperiode.fra)} - ${formatDateShort(entry.sfggReferenceperiode.til)}`);
      }
      if (!usesReferenceperiodeRate && entry.sfggSourceKind !== 'manuel' && entry.sfggReferencesats.status === 'ok') {
        safeAddWrappedText(`Referencesats: ${formatCurrencyFromOre(entry.sfggReferencesats.value)} kr.`);
      }
      renderSfggPeriodBlock(entry);
      writer.addSectionSpacer();
    });
  }
};
