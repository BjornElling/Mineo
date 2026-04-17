import type jsPDF from 'jspdf';
import type { RowInput } from 'jspdf-autotable';
import { MARGINS } from '../../../infrastructure/pdfConfig';
import {
  createPdfTableCell,
  createPdfTableHeaderCell,
  renderPdfTable,
} from '../../../shared/pdfTableRenderer';
import {
  getEffektiveSatserForDato,
  getGrundloenAngivetPerForOverenskomst,
  getOffentligOverenskomstTypeById,
  getOffentligTillaegsSatserForDato,
  resolveOverenskomstNameOnlyDisplay,
  resolveOverenskomstRef,
} from '../../../../data/overenskomstRates';
import type { PdfWriter } from '../../../infrastructure/pdfWriter';
import { EO_ANGIVET_LOEN_ID, resolveLoenudviklingKilde } from '../../../../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { computeTafBeregningsenhed } from '../../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import {
  formatAmount2,
  formatAmountWithoutTrailingDecimals,
  formatAnciennitetConversion,
  isAslStatistikModel,
} from '../../../../domain/erstatningsopgoerelse/pdf/sharedPdfUtils';
import { STORE_BEDEDAG_START } from '../../../../config/dateRanges';
import { STORE_BEDEDAG_PCT } from '../../../../config/regulatoryRates';
import { isoToDanish, type ISODateString } from '../../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../../schemas/formSchemas';
import type { LoenudviklingSegment } from '../../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type {
  ReguleringIndexRow,
  ReguleringValuesTableData,
} from '../../../../domain/erstatningsopgoerelse/pdf/eoPdfRegulering';
import { resolveLoenudviklingSegmentBounds } from '../../../../domain/erstatningsopgoerelse/engines/reguleringsBeregning';
import { amountValueToNumber } from '../../../../utils/expressionAmount';

type ReguleringSectionContext = Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  stamdataValues: StamdataValues;
  lineHeight: number;
  modelLoenudviklingPerAnsaettelse: readonly Readonly<{
    ansaettelsesforholdId: string;
    beregnedeSegmenter: readonly LoenudviklingSegment[];
  }>[];
  startBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
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
  }>) => string;
  resolveTafDateBounds: (eoValues: ErstatningsopgoerelseValues) => Readonly<{ foerste: ISODateString; sidste: ISODateString }> | null;
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
  writer: PdfWriter;
}>;

const percentDeltaIsIncrease = (from: number | null | undefined, to: number | null | undefined): boolean => {
  const a = typeof from === 'number' && Number.isFinite(from) ? from : 0;
  const b = typeof to === 'number' && Number.isFinite(to) ? to : 0;
  return b > a + 1e-9;
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
    const normalized = cleaned.replace('%', '').trim().replace(/\./g, '').replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
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
  const bededagStiger = slutBededag > startBededag + 1e-9;

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
    lineHeight,
    modelLoenudviklingPerAnsaettelse,
    startBilagPage,
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
  const toSentenceCase = (value: string): string => {
    if (value.length === 0) return value;
    return `${value.charAt(0).toLocaleUpperCase('da-DK')}${value.slice(1)}`;
  };

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
    const datoDisplay = dato.split('-').reverse().join('-');

    const grundloenAngivetPer = getGrundloenAngivetPerForOverenskomst(
      ansaettelsesforhold.overenskomstId,
      tafBeregnesSom
    );
    if (!grundloenAngivetPer) return 'Indtastning mangler';

    const inputPer = ansaettelsesforhold.anciennitetstillaegSatsAngivesPer;
    const conversion = formatAnciennitetConversion(satsValue, inputPer, grundloenAngivetPer, formatAmount2);
    return `${conversion.displayText} fra ${datoDisplay}`;
  };

  const renderReguleringIndeksTable = (rows: readonly ReguleringIndexRow[]) => {
    if (rows.length === 0) {
      safeAddWrappedText('Ingen reguleringsrækker i perioden.');
      return;
    }

    const tableRows: RowInput[] = [
      [
        createPdfTableHeaderCell('Fra-dato', 'center'),
        createPdfTableHeaderCell('Til-dato', 'center'),
        createPdfTableHeaderCell('Indeksberegning', 'center'),
        createPdfTableHeaderCell('Indeks', 'center'),
        createPdfTableHeaderCell('Lønudvikling', 'center'),
      ],
    ];

    for (const row of rows) {
      tableRows.push([
        createPdfTableCell(row.fraDato, { halign: 'center' }),
        createPdfTableCell(row.tilDato, { halign: 'center' }),
        createPdfTableCell(row.indeksberegning, { halign: 'center' }),
        createPdfTableCell(row.indeks, { halign: 'right' }),
        createPdfTableCell(row.loenudvikling, { halign: 'right' }),
      ]);
    }

    const doc = writer.getDoc() as jsPDF;
    const finalY = renderPdfTable({
      doc,
      startY: writer.getY(),
      body: tableRows,
    });
    writer.setY(finalY + lineHeight);
  };

  const renderReguleringsvaerdierTable = (tableData: ReguleringValuesTableData | null) => {
    if (!tableData || tableData.rows.length === 0) {
      safeAddWrappedText('Ingen reguleringsværdier.');
      return;
    }

    const normalizedTableData = stripEmptyReguleringsColumns(tableData);

    const tableRows: RowInput[] = [
      normalizedTableData.columns.map((column) => createPdfTableHeaderCell(column, 'center')),
      ...normalizedTableData.rows.map((row) =>
        row.map((value) => createPdfTableCell(value, { halign: 'center' }))
      ),
    ];

    const doc = writer.getDoc() as jsPDF;
    const finalY = renderPdfTable({
      doc,
      startY: writer.getY(),
      body: tableRows,
    });
    writer.setY(finalY + lineHeight);
  };

  const ansaettelser = resolveLoenudviklingKilde(eoValues);
  startBilagPage('Regulering');

  if (ansaettelser.length === 0) {
    safeAddWrappedText('Ingen ansættelsesforhold.');
    return;
  }

  const tafBounds = resolveTafDateBounds(eoValues);
  writer.addSpacer(lineHeight);

  for (const [index, ansaettelsesforhold] of ansaettelser.entries()) {
    const perAnsaettelseSegments =
      modelLoenudviklingPerAnsaettelse.find((entry) => entry.ansaettelsesforholdId === ansaettelsesforhold.id)?.beregnedeSegmenter
      ?? [];
    const coverageBounds = resolveLoenudviklingSegmentBounds(perAnsaettelseSegments) ?? tafBounds;
    const underoverskrift = ansaettelsesforhold.navnPaaArbejdssted?.trim() || `Ansættelsesforhold ${index + 1}`;
    const visUnderoverskrift = ansaettelsesforhold.id !== EO_ANGIVET_LOEN_ID;
    if (index > 0) writer.addSpacer(lineHeight);
    if (visUnderoverskrift) {
      renderSubheader(underoverskrift, lineHeight, { addTopSpacing: index > 0 });
      writer.addSpacer(lineHeight);
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
    });

    if (ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'Ingen') {
      writeLabelValueLine('Regulering', valgtReguleringForSection);
      writeLabelValueLine('Opgøres på baggrund af', toSentenceCase(loenSkadedatoText));
      writer.addSpacer(lineHeight);
      continue;
    }

    writeLabelValueLine(
      'Beregnes som',
      `${loenSkadedatoText.charAt(0).toUpperCase()}${loenSkadedatoText.slice(1)} tillagt efterfølgende lønstigninger`
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
    writer.addSpacer(lineHeight);
    safeAddWrappedText('Reguleringsværdier:');

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

    writer.addSpacer(lineHeight);
    safeAddWrappedText('Beregnet regulering:');

    const reguleringTableRows = buildReguleringIndexRows({
      segments: perAnsaettelseSegments,
      ansaettelsesforhold,
      anvendtReguleringsdato,
    });
    renderReguleringIndeksTable(reguleringTableRows);

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
      writer.addSpacer(lineHeight);
      safeAddWrappedText(text);
    }

    if (ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'KRL satstabel') {
      writer.addSpacer(lineHeight);
      safeAddWrappedText("KRL's sats-tabeller kan genfindes på https://www.krl.dk/#/sats");
    } else if (ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'Statistik') {
      const statistikLabel = (ansaettelsesforhold.loenudviklingStatistikModel ?? '').trim();
      const statistikModelId = resolveStatistikModelIdFromLabel(statistikLabel);
      if (statistikModelId === 'ILON12') {
        writer.addSpacer(lineHeight);
        safeAddWrappedText('Det Implicitte Lønindeks fra Danmarks Statistik (ILON12) anvendes som et retvisende reguleringsgrundlag for lønudvikling i samfundet. Regulering foretages med afsæt i værdierne for K1 (1. kvartal 2005 = indeksværdi 100), uden sæsonkorrektion.');
      } else if (statistikModelId === 'SBLON2') {
        writer.addSpacer(lineHeight);
        safeAddWrappedText('Det Standardberegnede Lønindeks fra Danmarks Statistik (SBLON2) anvendes som et retvisende reguleringsgrundlag for lønudvikling i samfundet. Regulering foretages med afsæt i værdierne for K1 (1. kvartal 2016 = indeksværdi 100).');
      } else if (isAslStatistikModel(statistikLabel)) {
        writer.addSpacer(lineHeight);
        safeAddWrappedText('ASL-årslønsmaksimum fremgår ikke eksplicit som reguleringsgrundlag i EAL § 15, men anvendes i almindelighed til fremskrivning på erstatnings- og arbejdsskadeområdet, og beror på den statslige tilpasningsprocent, der udgør den beregnede, statistiske lønudvikling i samfundet, som anvendes til fremskrivning af en flerhed af offentlige ydelser.');
      }
    }
  }
};
