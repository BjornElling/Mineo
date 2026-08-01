import { type ColumnSpec, type RowSpec } from '../../../layout/tableSpec';
import {
  getEffektiveSatserForDato,
  getGrundloenAngivetPerForOverenskomst,
  getOffentligOverenskomstTypeById,
  getOffentligTillaegsSatserForDato,
  resolveOverenskomstRef,
} from '../../../../data/overenskomstRates';
import type { DocumentComposer } from '../../../model/documentModel';
import {
  EO_ANGIVET_LOEN_ID,
  getAngivetLoenOpreguleresFraDato,
  resolveLoenudviklingKilde,
} from '../../../../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { computeTafBeregningsenhed } from '../../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { resolveAktivOverenskomst } from '../../../../domain/erstatningsopgoerelse/helpers/aktivOverenskomst';
import {
  formatAmount2,
  formatAmountWithoutTrailingDecimals,
  formatAnciennitetConversion,
  isAslStatistikModel,
} from '../../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { capitalizeFirstCharDa } from '../../../../utils/formatUtils';
import { STORE_BEDEDAG_START, STORE_BEDEDAG_PCT } from '../../../../data/indskudteLoentillaeg';
import { isoToDanish, type ISODateString } from '../../../../types/branded';
import { formatIsoDateLong } from '../../../../utils/dateFormatting';
import { formatDanishList } from '../../../../utils/danishListFormatting';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../../schemas/formSchemas';
import type { LoenudviklingSegment } from '../../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import {
  resolveLoenudviklingSegmentBounds,
  resolveLoenudviklingSegmenterForKilde,
  type ReguleringIndexRow,
  type ReguleringValuesTableData,
} from '../../../../domain/erstatningsopgoerelse/engines/reguleringsPresentation';
import { type ReguleringForloeb, resolveForloebForAnsaettelse } from '../../../../domain/erstatningsopgoerelse/engines/reguleringForloeb';
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
// "Beregnet regulering": Indeksberegnings-kolonnen rummer meget varierende indhold — fra et
// enkelt indekstal til lange, ombrudte formler. Den behandles derfor som "grow-kolonne": de øvrige
// kolonner garanteres kun deres indholdsbestemte min-bredde, og Indeksberegning får al den resterende
// plads (med ligelig fordeling af et evt. overskud mellem alle kolonner). Når kolonnen udelades
// (manuel procentsats), deler de fire tilbageværende kolonner hele tabelbredden ligeligt.
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
    forloeb?: ReguleringForloeb;
  }>[];
  // De globale lønudviklingssegmenter (hele det beregnede forløb). Bruges som
  // fallback for enkelt-kilde-modeller (angivet løn), hvor perAnsaettelse er tom.
  modelLoenudviklingGlobaleSegmenter: readonly LoenudviklingSegment[];
  // Det motor-emitterede autoritative forløb for enkelt-kilde-modeller (angivet løn), hvor
  // perAnsaettelse er tom. Samme global-fallback-princip som modelLoenudviklingGlobaleSegmenter.
  modelLoenudviklingGlobaltForloeb?: ReguleringForloeb;
  startEoBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
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
    skadestype: StamdataValues['skadestype'] | undefined;
    beregnesUdFra?: ErstatningsopgoerelseValues['beregnesUdFra'] | undefined;
    beregningsperiodeTil?: ISODateString | undefined;
    saerligFraDatoRegulering?: ISODateString | undefined;
    angivetLoenMetodeOpreguleresFraDato?: ISODateString | undefined;
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
    forloeb?: ReguleringForloeb;
  }>) => ReguleringValuesTableData | null;
  buildReguleringIndexRows: (params: Readonly<{
    segments: readonly LoenudviklingSegment[];
    ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
    anvendtReguleringsdato: ISODateString | undefined;
    forloeb?: ReguleringForloeb;
  }>) => readonly ReguleringIndexRow[];
  resolveStatistikModelIdFromLabel: (label: string | undefined) => string | undefined;
  writer: DocumentComposer;
}>;

const percentDeltaIsIncrease = (from: number | null | undefined, to: number | null | undefined): boolean => {
  const a = typeof from === 'number' && Number.isFinite(from) ? from : 0;
  const b = typeof to === 'number' && Number.isFinite(to) ? to : 0;
  return isGreaterThanWithTolerance(b, a);
};

const joinWithCommaAndOg = (parts: readonly string[]): string => {
  return formatDanishList(parts);
};

const isPopulatedReguleringsCell = (value: string | undefined): boolean => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return normalized !== '' && normalized !== '-';
};

// Tomme celler vises som bindestreg, så reguleringstabellerne ikke fremstår med visuelle "huller"
// (fx den første periodes tomme Lønudvikling-celle). Rent visuelt — påvirker ikke beregning eller
// kolonne-filtreringen, der behandler både '' og '-' som ikke-udfyldt.
const cellOrDash = (value: string | undefined): string => {
  const normalized = (value ?? '').trim();
  return normalized === '' ? '-' : value!;
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
  let bededagStiger = false;

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
  bededagStiger = resolveIncreaseFromTable(['store bededag', 'store bededagstillæg', 'st. bededagstillæg']);

  if (!fritvalgStiger && !shSoStiger && !pensionStiger) {
    const aktivOverenskomst = resolveAktivOverenskomst(ansaettelsesforhold);
    if (aktivOverenskomst.aktiv) {
      const overenskomstId = aktivOverenskomst.overenskomstId;
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
  // Reguleringsperioden kan starte efter 01-01-2024, mens basisrækken i tabellen ligger før.
  // Derfor skal tekstnoten læse Store Bededag fra samme tabelspænd som de øvrige tillæg.
  bededagStiger = bededagStiger || isGreaterThanWithTolerance(slutBededag, startBededag);

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
    modelLoenudviklingGlobaltForloeb,
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
    if (!ansaettelsesforhold.harAnciennitetstillaegEfterSkadedatoen) return null;
    // Samme aktiv-prædikat som resten af filen (§ét sandt sted). Den tidligere håndstavede udgave
    // manglede `.trim()` og var dermed uenig med sin egen nabo om et blankt overenskomst-id.
    const aktivOverenskomst = resolveAktivOverenskomst(ansaettelsesforhold);
    if (!aktivOverenskomst.aktiv) return null;

    const satsValue = ansaettelsesforhold.anciennitetstillaegSats?.value;
    if (typeof satsValue !== 'number' || !Number.isFinite(satsValue) || satsValue <= 0) {
      return 'Indtastning mangler';
    }
    const dato = parseOptionalIsoDate(ansaettelsesforhold.anciennitetstillaegDato);
    if (!dato) return 'Indtastning mangler';
    const datoDisplay = isoToDanish(dato) ?? dato;

    const grundloenAngivetPer = getGrundloenAngivetPerForOverenskomst(
      aktivOverenskomst.overenskomstId,
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

    if (isKlLoenaftalerTable) {
      const reguleretLoenHeader = tafBeregnesSom === 'Måneder' ? 'Reguleret månedsløn' : 'Reguleret dagsløn';
      const klColumns: readonly ColumnSpec[] = Array.from({ length: 4 }, () => ({
        width: { kind: 'flex' as const },
        align: 'center' as const,
      }));
      const klRows: RowSpec[] = [
        {
          kind: 'header',
          cells: [{ text: 'Fra-dato' }, { text: 'Til-dato' }, { text: 'Lønudvikling' }, { text: reguleretLoenHeader }],
        },
        ...rows.map((row): RowSpec => ({
          cells: [
            { text: cellOrDash(row.fraDato) },
            { text: cellOrDash(row.tilDato) },
            { text: cellOrDash(row.loenudvikling) },
            { text: cellOrDash(row.reguleretLoen) },
          ],
        })),
      ];
      writer.addTable({ columns: klColumns, hasHeaderRow: true, rows: klRows });
      return;
    }

    // Manuel procentsats: indeksberegnings-kolonnen udelades (kildeprocenten er selve reguleringen,
    // ikke en indeksbrøk). De øvrige modeller viser fortsat indeksberegningen.
    const hideIndeksberegning = options?.hideIndeksberegning === true;
    // Indeks/Lønudvikling højrejusteres med en indrykning, der skaleres dynamisk efter den
    // bredde, kolonnen faktisk får (jf. dynamic-rightInset): et kort Indeksberegnings-indhold
    // giver brede tal-kolonner og dermed den fulde, luftige indrykning (maxMm), mens en lang
    // formel (Indeksberegning som grow-kolonne) presser tal-kolonnerne sammen og reducerer
    // indrykningen tilsvarende. maxMm følger de hidtidige faste værdier: den lidt større manuel-
    // procentsats-indrykning uden indeksberegnings-kolonne, ellers Reguleringsværdier-tabellens.
    // Insettet er rent visuelt (PDF); Word læser cellens højrejustering fra kolonne-intentionen.
    const rightInsetMax = hideIndeksberegning
      ? MANUEL_PROCENTSATS_NUMBER_INSET_MM
      : REGULERINGSVAERDIER_RIGHT_ALIGNED_INSET_MM;
    const numberColumn: ColumnSpec = {
      width: { kind: 'flex' },
      align: 'right',
      rightInset: { kind: 'dynamic', maxMm: rightInsetMax },
    };
    // Fordel bredden: Indeksberegning er grow-kolonne (fylder resten efter de øvriges min-bredde),
    // de øvrige garanteres deres indholdsbestemte min-bredde, og et evt. overskud deles ligeligt.
    // Uden Indeksberegning-kolonnen deler de fire tilbageværende kolonner hele tabelbredden ligeligt.
    const columns: ColumnSpec[] = [
      { width: { kind: 'flex' }, align: 'center' },
      { width: { kind: 'flex' }, align: 'center' },
      ...(hideIndeksberegning
        ? []
        : [{ width: { kind: 'grow' as const }, align: 'center' as const } satisfies ColumnSpec]),
      numberColumn,
      numberColumn,
    ];
    const specRows: RowSpec[] = [
      {
        kind: 'header',
        cells: [
          { text: 'Fra-dato', align: 'center' },
          { text: 'Til-dato', align: 'center' },
          ...(hideIndeksberegning ? [] : [{ text: 'Indeksberegning', align: 'center' as const }]),
          { text: 'Indeks', align: 'center' },
          { text: 'Lønudvikling', align: 'center' },
        ],
      },
      ...rows.map((row): RowSpec => ({
        cells: [
          { text: cellOrDash(row.fraDato) },
          { text: cellOrDash(row.tilDato) },
          ...(hideIndeksberegning ? [] : [{ text: cellOrDash(row.indeksberegning) }]),
          { text: cellOrDash(row.indeks) },
          { text: cellOrDash(row.loenudvikling) },
        ],
      })),
    ];

    writer.addTable({ columns, hasHeaderRow: true, rows: specRows });
  };

  const renderReguleringsvaerdierTable = (tableData: ReguleringValuesTableData | null) => {
    if (!tableData || tableData.rows.length === 0) {
      safeAddWrappedText('Ingen reguleringsværdier.');
      return;
    }

    const normalizedTableData = stripEmptyReguleringsColumns(tableData);

    // Fordel pladsen jævnt mellem kolonnerne (flex) i stedet for autotables indholdsbaserede
    // bredder; den adaptive omfordeling udvider stadig kolonner efter behov. Reguleringskolonnerne
    // (pct/indeks/…) højrejusteres via kolonne-intentionen (Word læser cellens justering) med et
    // fast, rent visuelt PDF-inset pr. kolonne.
    const columns: readonly ColumnSpec[] = normalizedTableData.columns.map((column) =>
      RIGHT_ALIGNED_REGULERINGS_HEADERS.has(normalizeReguleringColumnHeader(column))
        ? { width: { kind: 'flex' }, align: 'right', rightInset: { kind: 'fixed', mm: resolveReguleringsvaerdierRightInset(column) } }
        : { width: { kind: 'flex' }, align: 'center' }
    );

    const specRows: RowSpec[] = [
      { kind: 'header', cells: normalizedTableData.columns.map((column) => ({ text: column, align: 'center' })) },
      ...normalizedTableData.rows.map((row): RowSpec => ({
        cells: row.map((value) => ({ text: cellOrDash(value) })),
      })),
    ];
    writer.addTable({
      columns,
      hasHeaderRow: true,
      rows: specRows,
    });
  };

  const ansaettelser = resolveLoenudviklingKilde(eoValues);
  const reguleredeAnsaettelser = ansaettelser
    .map((ansaettelsesforhold, originalIndex) => ({ ansaettelsesforhold, originalIndex }))
    .filter(({ ansaettelsesforhold }) => {
      const grundlag = ansaettelsesforhold.loenudviklingBeregningsgrundlag;
      return grundlag !== undefined && grundlag !== 'Ingen';
    });

  if (reguleredeAnsaettelser.length === 0) {
    return;
  }

  startEoBilagPage('Regulering');

  const tafBounds = resolveTafDateBounds(eoValues, { skadedatoISO: stamdataValues.skadedato });
  writer.addSectionSpacer();

  for (const [visibleIndex, { ansaettelsesforhold, originalIndex }] of reguleredeAnsaettelser.entries()) {
    const perAnsaettelseSegments = resolveLoenudviklingSegmenterForKilde({
      perAnsaettelse: modelLoenudviklingPerAnsaettelse,
      globaleSegmenter: modelLoenudviklingGlobaleSegmenter,
      ansaettelsesforholdId: ansaettelsesforhold.id,
    });
    // Samme global-fallback-princip som segmenterne ovenfor, via den delte kanoniske resolver.
    const perAnsaettelseForloeb = resolveForloebForAnsaettelse(
      modelLoenudviklingPerAnsaettelse,
      modelLoenudviklingGlobaltForloeb,
      ansaettelsesforhold.id
    );
    const coverageBounds = resolveLoenudviklingSegmentBounds(perAnsaettelseSegments) ?? tafBounds;
    const underoverskrift = ansaettelsesforhold.navnPaaArbejdssted?.trim() || `Ansættelsesforhold ${originalIndex + 1}`;
    const visUnderoverskrift = ansaettelsesforhold.id !== EO_ANGIVET_LOEN_ID;
    if (visUnderoverskrift) {
      renderSubheader(underoverskrift, { addTopSpacing: visibleIndex > 0 });
    }

    // Overenskomst-sporet havde tidligere sin EGEN navn-kun-visning her, så samme overenskomst hed
    // `Industriens overenskomst` i dokumentet og `Industriens overenskomst (3F / DI)` i EO-inspektionen.
    // `resolveValgtReguleringDisplay` bærer nu begge steder — navn OG parter (brugerbeslutning 2026-07-31).
    const valgtRegulering = resolveValgtReguleringDisplay(ansaettelsesforhold);
    const anvendtReguleringsdato = resolveAnvendtReguleringsdato(stamdataValues, eoValues, ansaettelsesforhold);
    const skadedatoIso = parseOptionalIsoDate(stamdataValues.skadedato);
    const loenSkadedatoText = resolveLoenSkadedatoText({
      subject: 'lønnen',
      anvendtReguleringsdato,
      skadedato: skadedatoIso,
      skadestype: stamdataValues.skadestype,
      beregnesUdFra: eoValues.beregnesUdFra,
      beregningsperiodeTil: eoValues.tafBeregningsperiodeTil,
      saerligFraDatoRegulering: ansaettelsesforhold.saerligFraDatoRegulering,
      angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(eoValues),
      useUntilWordingForImplicitBeregningsperiodeDate:
        eoValues.beregnesUdFra === 'Beregningsperiode'
        && !ansaettelsesforhold.saerligFraDatoRegulering
        && Boolean(
          eoValues.tafBeregningsperiodeTil
          && anvendtReguleringsdato === eoValues.tafBeregningsperiodeTil
        ),
    });

    writeLabelValueLine(
      'Beregnes som',
      `${capitalizeFirstCharDa(loenSkadedatoText)} tillagt efterfølgende lønstigninger`
    );
    writeLabelValueLine('Regulering', valgtRegulering);
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
            forloeb: perAnsaettelseForloeb,
          })
        : null;
    renderReguleringsvaerdierTable(reguleringsvaerdierTableData);

    // Note når kilden ikke har satser på/før reguleringsdatoen: tabellen tager afsæt i den
    // tidligste registrerede sats. Uden noten kunne det se ud som en fejl, at tabellen først
    // begynder efter reguleringsdatoen.
    if (reguleringsvaerdierTableData?.tidligsteSatsGaelderFra) {
      writer.addSectionSpacer();
      safeAddWrappedText(
        `Reguleringsgrundlaget indeholder ingen satser før den tidligste registrerede sats, der gælder fra den ${formatIsoDateLong(reguleringsvaerdierTableData.tidligsteSatsGaelderFra)} og anvendes som udgangspunkt for reguleringen.`
      );
    }

    writer.writeUnderlinedSubheader('Beregnet regulering');

    const reguleringTableRows = buildReguleringIndexRows({
      segments: perAnsaettelseSegments,
      ansaettelsesforhold,
      anvendtReguleringsdato,
      forloeb: perAnsaettelseForloeb,
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
        safeAddWrappedText('Erstatningsansvarsloven anviser ikke en specifik fremgangsmåde for fremskrivning af tabt arbejdsfortjeneste. ASL-årslønsmaksimum anvendes i almindelighed til fremskrivninger på erstatnings- og arbejdsskadeområdet, og beror på den statslige tilpasningsprocent, der anvendes til fremskrivning af en lang række øvrige ydelser i samfundet. Metode anses derfor for retvisende.');
      }
    }
  }
};
