/**
 * PDF Generator for Regulering
 *
 * Genererer PDF-dokument med reguleringssatser for overenskomst/statistik
 */

import type jsPDF from 'jspdf';
import type { DocumentTableBridgeDocument } from '../../layout/documentTableBridge';
import { buildStamdataBrevhovedData, defineDocument } from '../documentGeneratorSetup';
import { renderTableSpec, type ColumnSpec, type RowSpec } from '../../layout/tableSpec';
import { formatAsAmount, formatCurrency } from '../../../utils/formatUtils';
import { parseDanishDate, formatDanishDate, createDate } from '../../../utils/dateUtils';
import { roundByMethod } from '../../../utils/rounding';
import { resolveAslAarsloensmaksimumForAar } from '../../../domain/satser/aslAarsloensmaksimum';
import {
  formatAmountWithoutTrailingDecimals,
  isAslStatistikModel,
  resolveStatistikModelId,
} from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import {
  formatOverenskomstAmount,
  formatOverenskomstPercent,
} from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import {
  getEffektiveSatserForPeriode,
  getOffentligTillaegsSatserForDato,
  getOffentligTillaegsSatserForPeriode,
  getOverenskomst,
  getOffentligOverenskomstTypeById,
  resolveOverenskomstRef,
  type OverenskomstId,
} from '../../../data/overenskomstRates';
import { getOffentligLoenForPeriode } from '../../../data/offentligLoenLookup';
import { toLoentrin, type Loengruppe } from '../../../data/offentligLoenTypes';
import {
  getStatistiskLoenudvikling,
  type StatistiskLoenudviklingId,
} from '../../../data/statistiskeRates';
import type { DanishDateString } from '../../../types/branded';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import { resolveDocumentArtifactFileName, sanitizeFilenamePart } from '../../layout/documentFormatUtils';
import { ILON12_DISCONTINUED_NOTE } from './reguleringNotes';

type ReguleringDocumentParams = Readonly<{
  overenskomstLabel: string;
  loenudviklingBasis: 'Overenskomst' | 'Statistik';
  overenskomstId: string | undefined;
  statistikModelLabel: string | undefined;
  interval: Readonly<{ fraDato: DanishDateString; tilDato: DanishDateString }>;
  applyAlmindeligLoenPaaShDageRegel: boolean;
  offentligLoenType?: string;
  offentligLoenTrin?: number;
  offentligLoenGruppe?: number;
  offentligLoenEkstraGrundloen?: number;
}> &
  DocumentCommonOptions;

type TableColumn = Readonly<{
  header: string;
}>;

export const buildReguleringDocumentFilename = (params: Readonly<{
  loenudviklingBasis: 'Overenskomst' | 'Statistik';
  valgtLabel: string;
  interval: Readonly<{ fraDato: DanishDateString; tilDato: DanishDateString }>;
  journalnr?: string;
}>): string => {
  const basisTekst = params.loenudviklingBasis === 'Statistik' ? 'Statistik' : 'Overenskomst';
  const labelPart = sanitizeFilenamePart(params.valgtLabel);
  const intervalPart = sanitizeFilenamePart(`${params.interval.fraDato} til ${params.interval.tilDato}`);
  return resolveDocumentArtifactFileName(`Regulering - ${basisTekst} - ${labelPart} (${intervalPart})`, false, params.journalnr);
};

const resolveOffentligLoenInfoLine = (params: Readonly<{
  overenskomstId: string | undefined;
  loenTrin: number | undefined;
  loenGruppe: number | undefined;
}>): string | null => {
  const { overenskomstId, loenTrin, loenGruppe } = params;
  if (!overenskomstId) return null;
  const offentligType = getOffentligOverenskomstTypeById(overenskomstId);
  if (!offentligType) return null;
  if (typeof loenTrin !== 'number' || typeof loenGruppe !== 'number') return null;
  if (loenGruppe < 0 || loenGruppe > 4) return null;
  try {
    const loentrin = toLoentrin(loenTrin);
    const loentrinDisplay = loentrin === '55+' ? loentrin : String(loentrin);
    return `Løntrin ${loentrinDisplay}, Gruppe ${loenGruppe}`;
  } catch {
    return null;
  }
};

const resolveOffentligLoenEkstraGrundloenTekst = (params: Readonly<{
  overenskomstId: string | undefined;
  offentligLoenType: string | undefined;
  offentligLoenEkstraGrundloen: number | undefined;
}>): string | null => {
  const { overenskomstId, offentligLoenType, offentligLoenEkstraGrundloen } = params;
  if (!overenskomstId) return null;
  if (!getOffentligOverenskomstTypeById(overenskomstId)) return null;
  if (typeof offentligLoenEkstraGrundloen !== 'number' || !Number.isFinite(offentligLoenEkstraGrundloen)) return null;
  if (offentligLoenEkstraGrundloen <= 0) return null;

  const enhed = offentligLoenType === 'Timeløn' ? 'time' : 'måned';
  const udenDecimaler = formatAmountWithoutTrailingDecimals(offentligLoenEkstraGrundloen);
  return `${udenDecimaler} kr./${enhed}`;
};

const resolveStatistikModelIdFromLabel = (
  label: string
): StatistiskLoenudviklingId | undefined => resolveStatistikModelId(label);

const formatIndexValue = (value: number): string => {
  return formatAsAmount(roundByMethod(value, 1, 'halfAwayFromZero'), 1);
};

const addReguleringTable = (
  doc: jsPDF | DocumentTableBridgeDocument,
  columns: ReadonlyArray<TableColumn>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
  startY: number
): number => {
  // Alle kolonner: min-bredde 22 mm, centreret. Justering på kolonnerne (ikke via
  // en separat didParseCell-tvang eller columnStyles.halign).
  const specColumns: readonly ColumnSpec[] = columns.map(() => ({ width: { kind: 'min', mm: 22 }, align: 'center' }));

  const dataRows: RowSpec[] = rows.map((row) => ({ cells: row.map((cell) => ({ text: cell })) }));
  if (dataRows.length === 0) {
    dataRows.push({
      cells: columns.map((_, index) => ({ text: index === 0 ? 'Ingen reguleringsrækker i intervallet.' : '' })),
    });
  }

  return renderTableSpec(doc, startY, {
    columns: specColumns,
    hasHeaderRow: true,
    rows: [{ kind: 'header', cells: columns.map((col) => ({ text: col.header })) }, ...dataRows],
  }).endY;
};

const buildOverenskomstTable = (
  overenskomstId: string,
  interval: Readonly<{ fraDato: DanishDateString; tilDato: DanishDateString }>,
  applyAlmindeligLoenPaaShDageRegel: boolean,
  offentlig: Readonly<{
    loenType?: string;
    loenTrin?: number;
    loenGruppe?: number;
  }>
): { columns: TableColumn[]; rows: string[][] } | null => {
  const offentligType = getOffentligOverenskomstTypeById(overenskomstId);
  if (offentligType) {
    const trinValue = offentlig.loenTrin;
    const gruppeValue = offentlig.loenGruppe;
    if (typeof trinValue !== 'number' || typeof gruppeValue !== 'number') return null;
    if (gruppeValue < 0 || gruppeValue > 4) return null;
    let loentrin: ReturnType<typeof toLoentrin>;
    const loengruppe = gruppeValue as Loengruppe;
    try {
      loentrin = toLoentrin(trinValue);
    } catch {
      return null;
    }

    const satser = getOffentligLoenForPeriode(offentligType, interval.fraDato, interval.tilDato, loentrin, loengruppe)
      .slice()
      .reverse();
    const tillaegsSatser = getOffentligTillaegsSatserForPeriode(
      overenskomstId,
      interval.fraDato,
      interval.tilDato,
      applyAlmindeligLoenPaaShDageRegel
    );
    const hasShSo = tillaegsSatser.some((sats) => sats.shSoSats !== null && sats.shSoSats > 0);
    const hasFritvalg = tillaegsSatser.some((sats) => sats.fritvalg !== null && sats.fritvalg > 0);
    const hasAgPension = tillaegsSatser.some((sats) => sats.agPension !== null && sats.agPension > 0);

    const columns: TableColumn[] = [
      { header: 'Fra-dato' },
      { header: 'Månedsløn' },
      { header: 'Timeløn' },
      ...(hasShSo ? [{ header: 'SH/SO' }] : []),
      ...(hasFritvalg ? [{ header: 'Fritvalg' }] : []),
      ...(hasAgPension ? [{ header: 'AG pension' }] : []),
    ];

    const rows = satser.map((sats) => {
      const tillaegSats = getOffentligTillaegsSatserForDato(
        overenskomstId,
        sats.effectiveDate,
        applyAlmindeligLoenPaaShDageRegel
      );
      return [
        sats.effectiveDate,
        formatCurrency(sats.maanedsLoen),
        formatCurrency(sats.timeLoen),
        ...(hasShSo ? [formatOverenskomstPercent(tillaegSats?.shSoSats)] : []),
        ...(hasFritvalg ? [formatOverenskomstPercent(tillaegSats?.fritvalg)] : []),
        ...(hasAgPension ? [formatOverenskomstPercent(tillaegSats?.agPension)] : []),
      ];
    });

    return { columns, rows };
  }

  const ref = resolveOverenskomstRef(overenskomstId);
  if (!ref) return null;

  const satser = getEffektiveSatserForPeriode({
    overenskomstId: ref.baseId as OverenskomstId,
    fraDato: interval.fraDato,
    tilDato: interval.tilDato,
    applyAlmindeligLoenPaaShDageRegel,
  })
    .slice()
    .reverse();

  const allSatser = getOverenskomst(ref.baseId)?.satser ?? satser;

  const hasGrundloen = allSatser.some((sats) => sats.grundloen !== null && sats.grundloen > 0);
  const hasShSo = allSatser.some((sats) => sats.shSoSats !== null && sats.shSoSats > 0);
  const hasFritvalg = allSatser.some((sats) => sats.fritvalg !== null && sats.fritvalg > 0);
  const hasAgPension = allSatser.some((sats) => sats.agPension !== null && sats.agPension > 0);
  const hasSfgg = allSatser.some((sats) => sats.sfgg !== null && sats.sfgg > 0);
  const hasSfggFaglKbh = allSatser.some((sats) => sats.sfggFaglKbh !== null && sats.sfggFaglKbh > 0);
  const hasSfggFaglProv = allSatser.some((sats) => sats.sfggFaglProv !== null && sats.sfggFaglProv > 0);
  const hasSfggUfaglKbh = allSatser.some((sats) => sats.sfggUfaglKbh !== null && sats.sfggUfaglKbh > 0);
  const hasSfggUfaglProv = allSatser.some((sats) => sats.sfggUfaglProv !== null && sats.sfggUfaglProv > 0);

  const columns: TableColumn[] = [
    { header: 'Fra-dato' },
    ...(hasGrundloen ? [{ header: 'Grundløn' }] : []),
    ...(hasShSo ? [{ header: 'SH/SO' }] : []),
    ...(hasFritvalg ? [{ header: 'Fritvalg' }] : []),
    ...(hasAgPension ? [{ header: 'AG pension' }] : []),
    ...(hasSfgg ? [{ header: 'SFGG' }] : []),
    ...(hasSfggFaglKbh ? [{ header: 'SFGG fagl. Kbh' }] : []),
    ...(hasSfggFaglProv ? [{ header: 'SFGG fagl. prov' }] : []),
    ...(hasSfggUfaglKbh ? [{ header: 'SFGG ufagl. Kbh' }] : []),
    ...(hasSfggUfaglProv ? [{ header: 'SFGG ufagl. prov' }] : []),
  ];

  const rows = satser.map((sats) => {
    const row: string[] = [sats.fraDato];
    if (hasGrundloen) row.push(formatOverenskomstAmount(sats.grundloen));
    if (hasShSo) row.push(formatOverenskomstPercent(sats.shSoSats));
    if (hasFritvalg) row.push(formatOverenskomstPercent(sats.fritvalg));
    if (hasAgPension) row.push(formatOverenskomstPercent(sats.agPension));
    if (hasSfgg) row.push(formatOverenskomstAmount(sats.sfgg));
    if (hasSfggFaglKbh) row.push(formatOverenskomstAmount(sats.sfggFaglKbh));
    if (hasSfggFaglProv) row.push(formatOverenskomstAmount(sats.sfggFaglProv));
    if (hasSfggUfaglKbh) row.push(formatOverenskomstAmount(sats.sfggUfaglKbh));
    if (hasSfggUfaglProv) row.push(formatOverenskomstAmount(sats.sfggUfaglProv));
    return row;
  });

  return { columns, rows };
};

const buildStatistikTable = (
  modelLabel: string,
  interval: Readonly<{ fraDato: DanishDateString; tilDato: DanishDateString }>
): { columns: TableColumn[]; rows: string[][] } | null => {
  const trimmed = modelLabel.trim();
  if (trimmed === '') return null;

  if (isAslStatistikModel(trimmed)) {
    const start = parseDanishDate(interval.fraDato);
    const end = parseDanishDate(interval.tilDato);
    if (!start || !end) return null;

    const rows: string[][] = [];
    for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
      const value = resolveAslAarsloensmaksimumForAar(year);
      if (value === undefined) continue;
      rows.push([String(year), formatCurrency(value)]);
    }

    const columns: TableColumn[] = [
      { header: 'År' },
      { header: 'Maksimum årsløn' },
    ];

    return { columns, rows };
  }

  const modelId = resolveStatistikModelIdFromLabel(trimmed);
  if (!modelId) return null;

  const model = getStatistiskLoenudvikling(modelId);
  if (!model) return null;

  const rows = model.indeksvaerdier
    .slice()
    .reverse()
    .map((value): string[] => {
      const match = value.kvartal.match(/^(\d{4})K([1-4])$/);
      if (!match) return [value.kvartal, '', ''];
      const year = Number(match[1]);
      const quarter = Number(match[2]);
      const month = (quarter - 1) * 3 + 1;
      const startDate = formatDanishDate(createDate(year, month - 1, 1));
      return [
        value.kvartal,
        startDate,
        formatIndexValue(value.indeksvaerdi),
      ];
    });

  const columns: TableColumn[] = [
    { header: 'Kvartal' },
    { header: 'Startdato' },
    { header: 'Indeks' },
  ];

  return { columns, rows };
};

export const generateReguleringDocument = defineDocument<ReguleringDocumentParams>({
  title: 'Regulering',
  filename: (params) => {
    const valgtLabel = params.loenudviklingBasis === 'Statistik'
      ? (params.statistikModelLabel?.trim() || '-')
      : (params.overenskomstLabel.trim() || '-');
    return buildReguleringDocumentFilename({
      loenudviklingBasis: params.loenudviklingBasis,
      valgtLabel,
      interval: params.interval,
      journalnr: params.stamdata?.journalnr,
    });
  },
  brevhoved: ({ visBrevhoved = false, stamdata }) =>
    visBrevhoved ? buildStamdataBrevhovedData(stamdata) : null,
  body: (writer, params) => {
  const {
    overenskomstLabel,
    loenudviklingBasis,
    overenskomstId,
    statistikModelLabel,
    interval,
    applyAlmindeligLoenPaaShDageRegel,
    offentligLoenType,
    offentligLoenTrin,
    offentligLoenGruppe,
    offentligLoenEkstraGrundloen,
  } = params;
  const doc = writer.getDoc();

  const valgtLabel =
    loenudviklingBasis === 'Statistik'
      ? (statistikModelLabel?.trim() || '-')
      : (overenskomstLabel.trim() || '-');
  writer.writeWrappedText(valgtLabel);

  const offentligInfoLine = resolveOffentligLoenInfoLine({
    overenskomstId,
    loenTrin: offentligLoenTrin,
    loenGruppe: offentligLoenGruppe,
  });
  if (offentligInfoLine) {
    writer.writeWrappedText(offentligInfoLine);
  }
  const offentligLoenEkstraGrundloenTekst = resolveOffentligLoenEkstraGrundloenTekst({
    overenskomstId,
    offentligLoenType,
    offentligLoenEkstraGrundloen,
  });

  if (offentligLoenEkstraGrundloenTekst) {
    writer.writeBoldSubheader('Forhøjet grundløn');
    writer.writeWrappedText('Skadelidtes grundløn er forhøjet sammenholdt med nedenstående løntrin.');
    writer.writeWrappedText(`Forhøjelsen udgør ${offentligLoenEkstraGrundloenTekst}.`);
  }

  writer.addSectionSpacer();

  let tableData: { columns: TableColumn[]; rows: string[][] } | null = null;

  if (loenudviklingBasis === 'Overenskomst' && overenskomstId) {
    tableData = buildOverenskomstTable(overenskomstId, interval, applyAlmindeligLoenPaaShDageRegel, {
      loenType: offentligLoenType,
      loenTrin: offentligLoenTrin,
      loenGruppe: offentligLoenGruppe,
    });
  }

  if (loenudviklingBasis === 'Statistik' && statistikModelLabel) {
    tableData = buildStatistikTable(statistikModelLabel, interval);
  }

  if (tableData) {
    const startY = writer.getY();
    const nextY = addReguleringTable(doc, tableData.columns, tableData.rows, startY);
    writer.setY(nextY);
  }

  if (loenudviklingBasis === 'Statistik' && resolveStatistikModelId(statistikModelLabel) === 'ILON12') {
    writer.writeWrappedText(ILON12_DISCONTINUED_NOTE);
  }

  },
});
