import type { RowInput } from 'jspdf-autotable';
import { resolveDocumentSectionEndY } from '../../../layout/documentLayoutHelpers';
import {
  createDocumentDistributedColumnStyles,
  createDocumentGrowColumnStyles,
  createDocumentTableCell,
  createDocumentTableHeaderCell,
  renderDocumentTable,
  resolveDynamicRightAlignedInset,
} from '../../../layout/documentTableRenderer';
import {
  getEffektiveSatserForDato,
  getGrundloenAngivetPerForOverenskomst,
  getOffentligOverenskomstTypeById,
  getOffentligTillaegsSatserForDato,
  resolveOverenskomstNameOnlyDisplay,
  resolveOverenskomstRef,
} from '../../../../data/overenskomstRates';
import type { DocumentWriter } from '../../../writer';
import { EO_ANGIVET_LOEN_ID, resolveLoenudviklingKilde } from '../../../../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { computeTafBeregningsenhed } from '../../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import {
  formatAmount2,
  formatAmountWithoutTrailingDecimals,
  formatAnciennitetConversion,
  isAslStatistikModel,
} from '../../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { capitalizeFirstCharDa } from '../../../../utils/formatUtils';
import { STORE_BEDEDAG_START, STORE_BEDEDAG_PCT } from '../../../../config/indskudteLoentillaeg';
import { isoToDanish, type ISODateString } from '../../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../../schemas/formSchemas';
import type { LoenudviklingSegment } from '../../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import {
  resolveLoenudviklingSegmentBounds,
  resolveLoenudviklingSegmenterForKilde,
  type ReguleringIndexRow,
  type ReguleringValuesTableData,
} from '../../../../domain/erstatningsopgoerelse/engines/reguleringsPresentation';
import { amountValueToNumber } from '../../../../utils/expressionAmount';
import { isGreaterThanWithTolerance } from '../../../../utils/numberComparison';
import { parsePercentPointString } from '../../../../utils/numberParsing';
import { ILON12_DISCONTINUED_NOTE } from '../reguleringNotes';

const REGULERINGSVAERDIER_RIGHT_ALIGNED_INSET_MM = 8;
const REGULERINGSVAERDIER_SH_SO_RIGHT_ALIGNED_INSET_MM = 6;
// Manuel procentsats-tabellernes tal-kolonner deler samme lille højre-indrykning: Reguleringsværdier
// (Procent/Indeks/Akkumuleret) og Beregnet regulering (Indeks/Lønudvikling) er ens (rent visuelt
// inset, udelades i Word).
const MANUEL_PROCENTSATS_NUMBER_INSET_MM = 13;
const MANUEL_PROCENTSATS_NUMBER_HEADERS = new Set(['procent', 'indeks', 'akkumuleret']);
// "Beregnet regulering": Indeksberegnings-kolonnen (index 2) rummer meget varierende indhold — fra
// et enkelt indekstal til lange, ombrudte formler. Den behandles derfor som "grow-kolonne": de øvrige
// kolonner garanteres kun deres indholdsbestemte min-bredde, og Indeksberegning får al den resterende
// plads (med ligelig fordeling af et evt. overskud mellem alle kolonner). Når kolonnen udelades
// (manuel procentsats), deler de fire tilbageværende kolonner hele tabelbredden ligeligt.
const BEREGNET_REGULERING_INDEKSBEREGNING_COLUMN_INDEX = 2;
const RIGHT_ALIGNED_REGULERINGS_HEADERS = new Set([
  'feriepenge',
  'sh/so',
  'fritvalg',
  'store bededag',
  'ag pens. bidrag',
  // Manuel procentsats-tabellens tal-kolonner: højrejusteres (med større indrykning, se resolver nedenfor).
  'procent',
  'indeks',
  'akkumuleret',
]);

type ReguleringSectionContext = Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  stamdataValues: StamdataValues;
  modelLoenudviklingPerAnsaettelse: readonly Readonly<{
    ansaettelsesforholdId: string;
    beregnedeSegmenter: readonly LoenudviklingSegment[];
  }>[];
  // De globale lønudviklingssegmenter (hele det beregnede forløb). Bruges som
  // fallback for enkelt-kilde-modeller (angivet løn), hvor perAnsaettelse er tom.
  modelLoenudviklingGlobaleSegmenter: readonly LoenudviklingSegment[];
  startEoBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, nextLineHeight?: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  safeAddWrappedText: (text: string) => void;
  writeLabelValueLine: (label: string, value: string) => void;
  resolveValgtReguleringDisplay: (ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]) => string;
  resolveAnvendtReguleringsdato: (
    stamdataValues: StamdataValues,
    eoValues: ErstatningsopgoerelseValues,
    ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
  ) => ISODateString | undefined;
  parseOptionalIsoDate: (value: string | undefined) => ISODateString | undefined;
  resolveLoenSkadedatoText: (params: Readonly<{
    subject: 'lønnen';
    anvendtReguleringsdato: ISODateString | undefined;
    skadedato: ISODateString | undefined;
    useUntilWordingForImplicitBeregningsperiodeDate?: boolean;
  }>) => string;
  resolveTafDateBounds: (
    eoValues: ErstatningsopgoerelseValues,
    options?: Readonly<{ skadedatoISO?: ISODateString | undefined }>
  ) => Readonly<{ foerste: ISODateString; sidste: ISODateString }> | null;
  buildReguleringsvaerdierTableData: (params: Readonly<{
    ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
    anvendtReguleringsdato: ISODateString | undefined;
    tafFra: ISODateString;
    tafTil: ISODateString;
    tafBeregningsenhed: ReturnType<typeof computeTafBeregningsenhed>;
  }>) => ReguleringValuesTableData | null;
  buildReguleringIndexRows: (params: Readonly<{
    segments: readonly LoenudviklingSegment[];
    ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
    anvendtReguleringsdato: ISODateString | undefined;
  }>) => readonly ReguleringIndexRow[];
  resolveStatistikModelIdFromLabel: (label: string | undefined) => string | undefined;
  writer: DocumentWriter;
}>;

const percentDeltaIsIncrease = (from: number | null | undefined, to: number | null | undefined): boolean => {
  const a = typeof from === 'number' && Number.isFinite(from) ? from : 0;
  const b = typeof to === 'number' && Number.isFinite(to) ? to : 0;
  return isGreaterThanWithTolerance(b, a);
};

const joinWithCommaAndOg = (parts: readonly string[]): string => {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} og ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} og ${parts[parts.length - 1]}`;
};

const isPopulatedReguleringsCell = (value: string | undefined): boolean => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return normalized !== '' && normalized !== '-';
};

const normalizeReguleringColumnHeader = (value: string): string =>
  value.toLocaleLowerCase('da-DK').replace(/\s+/g, ' ').trim();

const resolveReguleringsvaerdierRightInset = (columnHeader: string): number => {
  const normalized = normalizeReguleringColumnHeader(columnHeader);
  if (normalized === 'sh/so') return REGULERINGSVAERDIER_SH_SO_RIGHT_ALIGNED_INSET_MM;
  if (MANUEL_PROCENTSATS_NUMBER_HEADERS.has(normalized)) return MANUEL_PROCENTSATS_NUMBER_INSET_MM;
  return REGULERINGSVAERDIER_RIGHT_ALIGNED_INSET_MM;
};

const stripEmptyReguleringsColumns = (
  tableData: ReguleringValuesTableData
): Readonly<{ columns: readonly string[]; rows: readonly (readonly string[])[] }> => {
  if (tableData.rows.length === 0) {
    return tableData;
  }

  const visibleColumnIndices = tableData.columns.flatMap((_, columnIndex) => {
    const hasDataInAnyRow = tableData.rows.some((row) => isPopulatedReguleringsCell(row[columnIndex]));
    return hasDataInAnyRow ? [columnIndex] : [];
  });

  return {
    columns: visibleColumnIndices.map((index) => tableData.columns[index] ?? ''),
    rows: tableData.rows.map((row) => visibleColumnIndices.map((index) => row[index] ?? '')),
  };
};

const resolveOverenskomstTillægsStigninger = (params: Readonly<{
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  reguleringTableStartIso: ISODateString;
  tafTilIso: ISODateString;
  reguleringsvaerdierTableData: ReguleringValuesTableData | null;
}>): readonly string[] => {
  const { ansaettelsesforhold, reguleringTableStartIso, tafTilIso, reguleringsvaerdierTableData } = params;

  const startDato = isoToDanish(reguleringTableStartIso);
  const slutDato = isoToDanish(tafTilIso);
  if (!startDato || !slutDato) return [];

  const applyAlmindeligLoenPaaShDageRegel = ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn';
  let fritvalgStiger = false;
  let shSoStiger = false;
  let pensionStiger = false;

  const normalizeColumn = (value: string): string => value.toLocaleLowerCase('da-DK').replace(/\s+/g, ' ').trim();
  const parseCellPercent = (raw: string | undefined): number | null => {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '-') return null;
    const cleaned = trimmed.includes('/')
      ? (() => {
          const parts = trimmed.split('/');
          return parts[parts.length - 1]?.trim() ?? trimmed;
        })()
      : trimmed;
    return parsePercentPointString(cleaned) ?? null;
  };
  const resolveIncreaseFromTable = (columnNames: readonly string[]): boolean => {
    if (!reguleringsvaerdierTableData || reguleringsvaerdierTableData.rows.length < 2) return false;
    const normalizedColumns = reguleringsvaerdierTableData.columns.map(normalizeColumn);
    const columnIndex = normalizedColumns.findIndex((column) => columnNames.includes(column));
    if (columnIndex < 0) return false;
    const firstRow = reguleringsvaerdierTableData.rows[0];
    const lastRow = reguleringsvaerdierTableData.rows[reguleringsvaerdierTableData.rows.length - 1];
    const firstValue = parseCellPercent(firstRow?.[columnIndex]);
    const lastValue = parseCellPercent(lastRow?.[columnIndex]);
    return percentDeltaIsIncrease(firstValue, lastValue);
  };

  fritvalgStiger = resolveIncreaseFromTable(['fritvalg']);
  shSoStiger = resolveIncreaseFromTable(['sh/so', 'shso']);
  pensionStiger = resolveIncreaseFromTable(['ag pens. bidrag', 'ag pension', 'pension']);

  if (!fritvalgStiger && !shSoStiger && !pensionStiger) {
    const overenskomstId = ansaettelsesforhold.overenskomstId?.trim();
    if (overenskomstId && ansaettelsesforhold.harOverenskomst) {
      const offentligType = getOffentligOverenskomstTypeById(overenskomstId);
      if (offentligType) {
        const start = getOffentligTillaegsSatserForDato(overenskomstId, startDato, applyAlmindeligLoenPaaShDageRegel);
        const slut = getOffentligTillaegsSatserForDato(overenskomstId, slutDato, applyAlmindeligLoenPaaShDageRegel);
        fritvalgStiger = percentDeltaIsIncrease(start?.fritvalg, slut?.fritvalg);
        shSoStiger = percentDeltaIsIncrease(start?.shSoSats, slut?.shSoSats);
        pensionStiger = percentDeltaIsIncrease(start?.agPension, slut?.agPension);
      } else {
        const ref = resolveOverenskomstRef(overenskomstId);
        if (ref) {
          const start = getEffektiveSatserForDato({
            overenskomstId: ref.baseId,
            dato: startDato,
            applyAlmindeligLoenPaaShDageRegel,
          });
          const slut = getEffektiveSatserForDato({
            overenskomstId: ref.baseId,
            dato: slutDato,
            applyAlmindeligLoenPaaShDageRegel,
          });
          fritvalgStiger = percentDeltaIsIncrease(start?.fritvalg, slut?.fritvalg);
          shSoStiger = percentDeltaIsIncrease(start?.shSoSats, slut?.shSoSats);
          pensionStiger = percentDeltaIsIncrease(start?.agPension, slut?.agPension);
        }
      }
    }
  }

  const startBededag = applyAlmindeligLoenPaaShDageRegel && reguleringTableStartIso >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0;
  const slutBededag = applyAlmindeligLoenPaaShDageRegel && tafTilIso >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0;
  const bededagStiger = isGreaterThanWithTolerance(slutBededag, startBededag);

  const labels: string[] = [];
  if (fritvalgStiger) labels.push('fritvalg');
  if (shSoStiger) labels.push('SH/SO');
  if (bededagStiger) labels.push('st. bededagstillæg');
  if (pensionStiger) labels.push('pension');
  return labels;
};

export const renderReguleringSection = (ctx: ReguleringSectionContext): void => {
  const {
    eoValues,
    stamdataValues,
    modelLoenudviklingPerAnsaettelse,
    modelLoenudviklingGlobaleSegmenter,
    startEoBilagPage,
    renderSubheader,
    safeAddWrappedText,
    writeLabelValueLine,
    resolveValgtReguleringDisplay,
    resolveAnvendtReguleringsdato,
    parseOptionalIsoDate,
    resolveLoenSkadedatoText,
    resolveTafDateBounds,
    buildReguleringsvaerdierTableData,
    buildReguleringIndexRows,
    resolveStatistikModelIdFromLabel,
    writer,
  } = ctx;
  const tafBeregnesSom = computeTafBeregningsenhed(eoValues);

  const resolveAnciennitetValueDisplay = (
    ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
  ): string | null => {
    if (ansaettelsesforhold.loenudviklingBeregningsgrundlag !== 'Overenskomst') return null;
    if (!ansaettelsesforhold.harOverenskomst) return null;
    if (!ansaettelsesforhold.harAnciennitetstillaegEfterSkadedatoen) return null;
    if (!ansaettelsesforhold.overenskomstId) return null;

    const satsValue = ansaettelsesforhold.anciennitetstillaegSats?.value;
    if (typeof satsValue !== 'number' || !Number.isFinite(satsValue) || satsValue <= 0) {
      return 'Indtastning mangler';
    }
    const dato = parseOptionalIsoDate(ansaettelsesforhold.anciennitetstillaegDato);
    if (!dato) return 'Indtastning mangler';
    const datoDisplay = isoToDanish(dato) ?? dato;

    const grundloenAngivetPer = getGrundloenAngivetPerForOverenskomst(
      ansaettelsesforhold.overenskomstId,
      tafBeregnesSom
    );
    if (!grundloenAngivetPer) return 'Indtastning mangler';

    const inputPer = ansaettelsesforhold.anciennitetstillaegSatsAngivesPer;
    const conversion = formatAnciennitetConversion(satsValue, inputPer, grundloenAngivetPer, formatAmount2);
    return `${conversion.displayText} fra ${datoDisplay}`;
  };

  const renderReguleringIndeksTable = (
    rows: readonly ReguleringIndexRow[],
    options?: Readonly<{ hideIndeksberegning?: boolean }>
  ) => {
    if (rows.length === 0) {
      safeAddWrappedText('Ingen reguleringsrækker i perioden.');
      return;
    }

    // KL-lønaftaler: trinvis kæde-opregulering vises uden indeksberegning; i stedet
    // ses lønudviklingen og den resulterende, afrundede måneds-/dagsløn for perioden.
    // Se docs/domain/taf/kl-loenaftaler-regulering.md.
    const isKlLoenaftalerTable = rows.some((row) => row.reguleretLoen !== undefined);

    const doc = writer.getDoc();
    const startY = writer.getY();

    if (isKlLoenaftalerTable) {
      const reguleretLoenHeader = tafBeregnesSom === 'Måneder' ? 'Reguleret månedsløn' : 'Reguleret dagsløn';
      const tableRows: RowInput[] = [[
        createDocumentTableHeaderCell('Fra-dato', 'center'),
        createDocumentTableHeaderCell('Til-dato', 'center'),
        createDocumentTableHeaderCell('Lønudvikling', 'center'),
        createDocumentTableHeaderCell(reguleretLoenHeader, 'center'),
      ]];
      for (const row of rows) {
        tableRows.push([
          createDocumentTableCell(row.fraDato, { halign: 'center' }),
          createDocumentTableCell(row.tilDato, { halign: 'center' }),
          createDocumentTableCell(row.loenudvikling, { halign: 'center' }),
          createDocumentTableCell(row.reguleretLoen ?? '', { halign: 'center' }),
        ]);
      }
      const finalY = renderDocumentTable({
        doc,
        startY,
        body: tableRows,
        columnStyles: createDocumentDistributedColumnStyles(4, { defaultHalign: 'center' }),
      });
      writer.setY(resolveDocumentSectionEndY(finalY, startY));
      return;
    }

    // Manuel procentsats: indeksberegnings-kolonnen udelades (kildeprocenten er selve reguleringen,
    // ikke en indeksbrøk). De øvrige modeller viser fortsat indeksberegningen.
    const hideIndeksberegning = options?.hideIndeksberegning === true;
    const tableRows: RowInput[] = [[
      createDocumentTableHeaderCell('Fra-dato', 'center'),
      createDocumentTableHeaderCell('Til-dato', 'center'),
      ...(hideIndeksberegning ? [] : [createDocumentTableHeaderCell('Indeksberegning', 'center')]),
      createDocumentTableHeaderCell('Indeks', 'center'),
      createDocumentTableHeaderCell('Lønudvikling', 'center'),
    ]];
    for (const row of rows) {
      tableRows.push([
        createDocumentTableCell(row.fraDato, { halign: 'center' }),
        createDocumentTableCell(row.tilDato, { halign: 'center' }),
        ...(hideIndeksberegning ? [] : [createDocumentTableCell(row.indeksberegning, { halign: 'center' })]),
        createDocumentTableCell(row.indeks, { halign: 'right' }),
        createDocumentTableCell(row.loenudvikling, { halign: 'right' }),
      ]);
    }

    // Indeks + Lønudvikling højrejusteres med samme lille indrykning som Reguleringsværdier-tabellens
    // pct-kolonner (genbrug af inset-konstanten). Insettet er rent visuelt og udelades i Word, mens
    // dataRowColumnHalign giver Word samme højrejustering.
    const columnCount = 4 + (hideIndeksberegning ? 0 : 1);
    const indeksColumnIndex = columnCount - 2;
    const loenudviklingColumnIndex = columnCount - 1;
    const rightAlignedColumnIndices = new Set([indeksColumnIndex, loenudviklingColumnIndex]);
    const dataRowColumnHalign: Record<number, 'right'> = {
      [indeksColumnIndex]: 'right',
      [loenudviklingColumnIndex]: 'right',
    };
    // Indeks/Lønudvikling højrejusteres med en indrykning, der skaleres dynamisk efter den
    // bredde, kolonnen faktisk får (jf. resolveDynamicRightAlignedInset): et kort Indeksberegnings-
    // indhold giver brede tal-kolonner og dermed den fulde, luftige indrykning (maxInset), mens en
    // lang formel (Indeksberegning som grow-kolonne) presser tal-kolonnerne sammen og reducerer
    // indrykningen tilsvarende. maxInset følger de hidtidige faste værdier: den lidt større manuel-
    // procentsats-indrykning uden indeksberegnings-kolonne, ellers Reguleringsværdier-tabellens.
    const rightInsetMax = hideIndeksberegning
      ? MANUEL_PROCENTSATS_NUMBER_INSET_MM
      : REGULERINGSVAERDIER_RIGHT_ALIGNED_INSET_MM;

    // Fordel bredden: Indeksberegning er grow-kolonne (fylder resten efter de øvriges min-bredde),
    // de øvrige garanteres deres indholdsbestemte min-bredde, og et evt. overskud deles ligeligt.
    // Uden Indeksberegning-kolonnen deler de fire tilbageværende kolonner hele tabelbredden ligeligt.
    const columnStyles = hideIndeksberegning
      ? createDocumentDistributedColumnStyles(columnCount)
      : createDocumentGrowColumnStyles(columnCount, BEREGNET_REGULERING_INDEKSBEREGNING_COLUMN_INDEX);

    const finalY = renderDocumentTable({
      doc,
      startY,
      body: tableRows,
      columnStyles,
      dataRowColumnHalign,
      didParseCell: (data, resolvedColumnWidths) => {
        const isDataRow = data.row.index >= 1;
        if (!isDataRow || !rightAlignedColumnIndices.has(data.column.index)) return;
        data.cell.styles.halign = 'right';
        const rightInset = resolveDynamicRightAlignedInset(
          resolvedColumnWidths.get(data.column.index),
          rightInsetMax
        );
        data.cell.styles.cellPadding = {
          top: 1.5,
          bottom: 1.5,
          left: 1.5,
          right: rightInset,
        };
      },
    });
    writer.setY(resolveDocumentSectionEndY(finalY, startY));
  };

  const renderReguleringsvaerdierTable = (tableData: ReguleringValuesTableData | null) => {
    if (!tableData || tableData.rows.length === 0) {
      safeAddWrappedText('Ingen reguleringsværdier.');
      return;
    }

    const normalizedTableData = stripEmptyReguleringsColumns(tableData);
    const rightAlignedColumnInsets = new Map(
      normalizedTableData.columns.flatMap((column, index) =>
        RIGHT_ALIGNED_REGULERINGS_HEADERS.has(normalizeReguleringColumnHeader(column))
          ? [[index, resolveReguleringsvaerdierRightInset(column)]]
          : []
      )
    );

    const tableRows: RowInput[] = [
      normalizedTableData.columns.map((column) => createDocumentTableHeaderCell(column, 'center')),
      ...normalizedTableData.rows.map((row) =>
        row.map((value) => createDocumentTableCell(value, { halign: 'center' }))
      ),
    ];

    const doc = writer.getDoc();
    const startY = writer.getY();
    // Word matcher PDF'ens højrejustering af de reguleringskolonner, hooket
    // højrejusterer (insettet nedenfor er rent visuelt og udelades i Word).
    const dataRowColumnHalign: Record<number, 'right'> = {};
    for (const columnIndex of rightAlignedColumnInsets.keys()) {
      dataRowColumnHalign[columnIndex] = 'right';
    }
    // Fordel pladsen jævnt mellem kolonnerne i stedet for autotables
    // indholdsbaserede bredder. Den adaptive omfordeling i renderDocumentTable
    // udvider stadig kolonner, hvis en kolonnes indhold kræver mere plads.
    const columnStyles = createDocumentDistributedColumnStyles(normalizedTableData.columns.length);
    const finalY = renderDocumentTable({
      doc,
      startY,
      body: tableRows,
      columnStyles,
      dataRowColumnHalign,
      didParseCell: (data) => {
        const isDataRow = data.row.index >= 1;
        const rightInset = rightAlignedColumnInsets.get(data.column.index);
        if (!isDataRow || typeof rightInset !== 'number') return;

        data.cell.styles.halign = 'right';
        data.cell.styles.cellPadding = {
          top: 1.5,
          bottom: 1.5,
          left: 1.5,
          right: rightInset,
        };
      },
    });
    writer.setY(resolveDocumentSectionEndY(finalY, startY));
  };

  const ansaettelser = resolveLoenudviklingKilde(eoValues);
  startEoBilagPage('Regulering');

  if (ansaettelser.length === 0) {
    safeAddWrappedText('Ingen ansættelsesforhold.');
    return;
  }

  const tafBounds = resolveTafDateBounds(eoValues, { skadedatoISO: stamdataValues.skadedato });
  writer.addSectionSpacer();

  for (const [index, ansaettelsesforhold] of ansaettelser.entries()) {
    const perAnsaettelseSegments = resolveLoenudviklingSegmenterForKilde({
      perAnsaettelse: modelLoenudviklingPerAnsaettelse,
      globaleSegmenter: modelLoenudviklingGlobaleSegmenter,
      ansaettelsesforholdId: ansaettelsesforhold.id,
    });
    const coverageBounds = resolveLoenudviklingSegmentBounds(perAnsaettelseSegments) ?? tafBounds;
    const underoverskrift = ansaettelsesforhold.navnPaaArbejdssted?.trim() || `Ansættelsesforhold ${index + 1}`;
    const visUnderoverskrift = ansaettelsesforhold.id !== EO_ANGIVET_LOEN_ID;
    if (visUnderoverskrift) {
      renderSubheader(underoverskrift, undefined, { addTopSpacing: index > 0 });
    }

    const valgtRegulering = resolveValgtReguleringDisplay(ansaettelsesforhold);
    const valgtReguleringForSection =
      ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'Overenskomst'
        ? resolveOverenskomstNameOnlyDisplay(ansaettelsesforhold.overenskomstId)
        : valgtRegulering;
    const anvendtReguleringsdato = resolveAnvendtReguleringsdato(stamdataValues, eoValues, ansaettelsesforhold);
    const skadedatoIso = parseOptionalIsoDate(stamdataValues.skadedato);
    const loenSkadedatoText = resolveLoenSkadedatoText({
      subject: 'lønnen',
      anvendtReguleringsdato,
      skadedato: skadedatoIso,
      useUntilWordingForImplicitBeregningsperiodeDate:
        eoValues.beregnesUdFra === 'Beregningsperiode'
        && !ansaettelsesforhold.saerligFraDatoRegulering
        && Boolean(
          eoValues.tafBeregningsperiodeTil
          && anvendtReguleringsdato === eoValues.tafBeregningsperiodeTil
        ),
    });

    if (ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'Ingen') {
      writeLabelValueLine('Regulering', valgtReguleringForSection);
      writeLabelValueLine('Opgøres på baggrund af', capitalizeFirstCharDa(loenSkadedatoText));
      writer.addSectionSpacer();
      continue;
    }

    writeLabelValueLine(
      'Beregnes som',
      `${capitalizeFirstCharDa(loenSkadedatoText)} tillagt efterfølgende lønstigninger`
    );
    writeLabelValueLine('Regulering', valgtReguleringForSection);
    const anciennitetValueDisplay = resolveAnciennitetValueDisplay(ansaettelsesforhold);
    let ekstraGrundloenDisplay: string | null = null;

    const offentligTypeForLabel = ansaettelsesforhold.overenskomstId
      ? getOffentligOverenskomstTypeById(ansaettelsesforhold.overenskomstId)
      : undefined;
    if (offentligTypeForLabel && ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'Overenskomst') {
      const trin = ansaettelsesforhold.offentligLoenTrin;
      const gruppe = ansaettelsesforhold.offentligLoenGruppe;
      if (typeof trin === 'number' && typeof gruppe === 'number') {
        writeLabelValueLine('Indplacering', `Løntrin ${trin}, gruppe ${gruppe}`);

        const ekstraGrundloen = amountValueToNumber(ansaettelsesforhold.offentligLoenEkstraGrundloen);
        ekstraGrundloenDisplay =
          typeof ekstraGrundloen === 'number' && Number.isFinite(ekstraGrundloen) && ekstraGrundloen > 0
            ? `+ ${formatAmountWithoutTrailingDecimals(ekstraGrundloen)} kr./${
                ansaettelsesforhold.offentligLoenType === 'Timeløn' ? 'time' : 'måned'
              }`
            : null;
      }
    }

    const harSaerligeLoenforhold = Boolean(anciennitetValueDisplay || ekstraGrundloenDisplay);
    if (harSaerligeLoenforhold) {
      writer.writeUnderlinedSubheader('Særlige lønforhold');
      if (ekstraGrundloenDisplay) {
        writeLabelValueLine('Forhøjet grundløn', ekstraGrundloenDisplay);
      }
      if (anciennitetValueDisplay) {
        writeLabelValueLine('Anciennitetstillæg', anciennitetValueDisplay);
      }
    }
    writer.writeUnderlinedSubheader('Reguleringsværdier');

    const reguleringsvaerdierTableData =
      coverageBounds
        ? buildReguleringsvaerdierTableData({
            ansaettelsesforhold,
            anvendtReguleringsdato,
            tafFra: coverageBounds.foerste,
            tafTil: coverageBounds.sidste,
            tafBeregningsenhed: tafBeregnesSom,
          })
        : null;
    renderReguleringsvaerdierTable(reguleringsvaerdierTableData);

    writer.writeUnderlinedSubheader('Beregnet regulering');

    const reguleringTableRows = buildReguleringIndexRows({
      segments: perAnsaettelseSegments,
      ansaettelsesforhold,
      anvendtReguleringsdato,
    });
    renderReguleringIndeksTable(reguleringTableRows, {
      hideIndeksberegning: ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'Manuel procentsats',
    });

    const loenudviklingGrundlag = ansaettelsesforhold.loenudviklingBeregningsgrundlag;
    if ((loenudviklingGrundlag === 'Overenskomst' || loenudviklingGrundlag === 'Manuelt angivet') && coverageBounds) {
      const reguleringTableStartIso = coverageBounds.foerste;
      const tillægsStigninger = resolveOverenskomstTillægsStigninger({
        ansaettelsesforhold,
        reguleringTableStartIso,
        tafTilIso: coverageBounds.sidste,
        reguleringsvaerdierTableData,
      });
      const text = tillægsStigninger.length > 0
        ? `Regulering foretages på baggrund af den procentuelle udvikling i grundløn. Hertil kommer stigninger i ${joinWithCommaAndOg(tillægsStigninger)}.`
        : 'Regulering foretages på baggrund af den procentuelle udvikling i grundløn.';
      writer.addSectionSpacer();
      safeAddWrappedText(text);
    }

    if (ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'KRL satstabel') {
      writer.addSectionSpacer();
      safeAddWrappedText("KRL's sats-tabeller kan genfindes på https://www.krl.dk/#/sats");
    } else if (ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'KL-lønaftaler') {
      writer.addSectionSpacer();
      safeAddWrappedText('Regulering foretages på baggrund af de kommunale lønaftaler, der er indgået med KL.');
    } else if (ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'Statistik') {
      const statistikLabel = (ansaettelsesforhold.loenudviklingStatistikModel ?? '').trim();
      const statistikModelId = resolveStatistikModelIdFromLabel(statistikLabel);
      if (statistikModelId === 'ILON12') {
        writer.addSectionSpacer();
        safeAddWrappedText('Det Implicitte Lønindeks fra Danmarks Statistik (ILON12) anvendes som et retvisende reguleringsgrundlag for lønudvikling i samfundet. Regulering foretages med afsæt i værdierne for K1 (1. kvartal 2005 = indeksværdi 100), uden sæsonkorrektion.');
        safeAddWrappedText(ILON12_DISCONTINUED_NOTE);
      } else if (statistikModelId === 'SBLON2') {
        writer.addSectionSpacer();
        safeAddWrappedText('Det Standardberegnede Lønindeks fra Danmarks Statistik (SBLON2) anvendes som et retvisende reguleringsgrundlag for lønudvikling i samfundet. Regulering foretages med afsæt i værdierne for K1 (1. kvartal 2016 = indeksværdi 100).');
      } else if (isAslStatistikModel(statistikLabel)) {
        writer.addSectionSpacer();
        safeAddWrappedText('ASL-årslønsmaksimum fremgår ikke eksplicit som reguleringsgrundlag i EAL § 15, men anvendes i almindelighed til fremskrivning på erstatnings- og arbejdsskadeområdet, og beror på den statslige tilpasningsprocent, der udgør den beregnede, statistiske lønudvikling i samfundet, som anvendes til fremskrivning af en flerhed af offentlige ydelser.');
      }
    }
  }
};
