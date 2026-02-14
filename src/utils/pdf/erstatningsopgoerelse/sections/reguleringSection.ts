import type { RowInput } from 'jspdf-autotable';
import { getOffentligOverenskomstTypeById } from '../../../../data/overenskomstRates';
import { resolveLoenudviklingKilde } from '../../../../domain/erstatningsopgoerelse/angivetLoenHelpers';
import type { ISODateString } from '../../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../../schemas/formSchemas';
import type { LoenudviklingSegment } from '../../../../domain/erstatningsopgoerelse/eoPdfModel';

type ReguleringValuesTableData = Readonly<{
  columns: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<string>>;
}>;

type ReguleringIndexRow = Readonly<{
  fraDato: string;
  tilDato: string;
  indeksberegning: string;
  indeks: string;
  loenudvikling: string;
}>;

type ReguleringSectionContext = Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  stamdataValues: StamdataValues;
  lineHeight: number;
  modelLoenudviklingSegmenter: readonly LoenudviklingSegment[];
  startBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  safeAddWrappedText: (text: string) => void;
  writeLabelValueLine: (label: string, value: string) => void;
  resolveValgtReguleringDisplay: (ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]) => string;
  resolveReguleringsdato: (
    stamdataValues: StamdataValues,
    eoValues: ErstatningsopgoerelseValues,
    ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
  ) => ISODateString | undefined;
  parseOptionalIsoDate: (value: string | undefined) => ISODateString | undefined;
  resolveLoenSkadesdatoText: (params: Readonly<{
    subject: 'lønnen';
    skadesdato: ISODateString | undefined;
    saerligFraDatoRegulering: ISODateString | undefined;
  }>) => string;
  resolveTafDateBounds: (eoValues: ErstatningsopgoerelseValues) => Readonly<{ foerste: ISODateString; sidste: ISODateString }> | null;
  buildReguleringsvaerdierTableData: (params: Readonly<{
    ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
    reguleringsdato: ISODateString | undefined;
    tafFra: ISODateString;
    tafTil: ISODateString;
  }>) => ReguleringValuesTableData | null;
  buildReguleringIndexRows: (params: Readonly<{
    segments: readonly LoenudviklingSegment[];
    ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
    reguleringsdato: ISODateString | undefined;
  }>) => readonly ReguleringIndexRow[];
  resolveStatistikModelIdFromLabel: (label: string | undefined) => string | undefined;
  renderStandardPdfTable: (params: Readonly<{
    doc: unknown;
    startY: number;
    body: RowInput[];
    columnStyles?: unknown;
  }>) => number;
  writer: Readonly<{
    addSpacer: (height: number) => void;
    setY: (y: number) => void;
    getY: () => number;
    getDoc: () => unknown;
  }>;
}>;

export const renderReguleringSection = (ctx: ReguleringSectionContext): void => {
  const {
    eoValues,
    stamdataValues,
    lineHeight,
    modelLoenudviklingSegmenter,
    startBilagPage,
    renderSubheader,
    safeAddWrappedText,
    writeLabelValueLine,
    resolveValgtReguleringDisplay,
    resolveReguleringsdato,
    parseOptionalIsoDate,
    resolveLoenSkadesdatoText,
    resolveTafDateBounds,
    buildReguleringsvaerdierTableData,
    buildReguleringIndexRows,
    resolveStatistikModelIdFromLabel,
    renderStandardPdfTable,
    writer,
  } = ctx;

  const renderReguleringIndeksTable = (rows: readonly ReguleringIndexRow[]) => {
    if (rows.length === 0) {
      safeAddWrappedText('Ingen reguleringsrækker i perioden.');
      return;
    }

    const tableRows: RowInput[] = [
      [
        { content: 'Fra-dato', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: 'Til-dato', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: 'Indeksberegning', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: 'Indeks', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: 'Lønudvikling', styles: { fontStyle: 'bold', halign: 'center' } },
      ],
    ];

    for (const row of rows) {
      tableRows.push([
        { content: row.fraDato, styles: { halign: 'center' } },
        { content: row.tilDato, styles: { halign: 'center' } },
        { content: row.indeksberegning, styles: { halign: 'center' } },
        { content: row.indeks, styles: { halign: 'right' } },
        { content: row.loenudvikling, styles: { halign: 'right' } },
      ]);
    }

    const doc = writer.getDoc();
    const finalY = renderStandardPdfTable({
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

    const tableRows: RowInput[] = [
      tableData.columns.map((column) => ({
        content: column,
        styles: { fontStyle: 'bold', halign: 'center' as const },
      })),
      ...tableData.rows.map((row) =>
        row.map((value) => ({
          content: value,
          styles: { halign: 'center' as const },
        }))
      ),
    ];

    const doc = writer.getDoc();
    const finalY = renderStandardPdfTable({
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
    const underoverskrift = ansaettelsesforhold.navnPaaArbejdssted?.trim() || `Ansættelsesforhold ${index + 1}`;
    if (index > 0) writer.addSpacer(lineHeight);
    renderSubheader(underoverskrift, lineHeight, { addTopSpacing: index > 0 });
    writer.addSpacer(lineHeight);

    const valgtRegulering = resolveValgtReguleringDisplay(ansaettelsesforhold);
    const reguleringsdato = resolveReguleringsdato(stamdataValues, eoValues, ansaettelsesforhold);
    const skadesdatoIso = parseOptionalIsoDate(stamdataValues.skadesdato);
    const saerligFraDatoIso = parseOptionalIsoDate(ansaettelsesforhold.saerligFraDatoRegulering);
    const loenSkadesdatoText = resolveLoenSkadesdatoText({
      subject: 'lønnen',
      skadesdato: skadesdatoIso,
      saerligFraDatoRegulering: saerligFraDatoIso,
    });

    if (ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'Ingen') {
      writeLabelValueLine('Regulering', valgtRegulering);
      writeLabelValueLine('Opgøres på baggrund af', loenSkadesdatoText);
      writer.addSpacer(lineHeight);
      continue;
    }

    writeLabelValueLine(
      'Beregnes som',
      `${loenSkadesdatoText.charAt(0).toUpperCase()}${loenSkadesdatoText.slice(1)} tillagt efterfølgende lønstigninger`
    );
    writeLabelValueLine('Regulering', valgtRegulering);

    const offentligTypeForLabel = ansaettelsesforhold.overenskomstId
      ? getOffentligOverenskomstTypeById(ansaettelsesforhold.overenskomstId)
      : undefined;
    if (offentligTypeForLabel && ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'Overenskomst') {
      const trin = ansaettelsesforhold.offentligLoenTrin;
      const gruppe = ansaettelsesforhold.offentligLoenGruppe;
      if (typeof trin === 'number' && typeof gruppe === 'number') {
        writeLabelValueLine('Indplacering', `Løntrin ${trin}, gruppe ${gruppe}`);
      }
    }
    writer.addSpacer(lineHeight);
    safeAddWrappedText('Reguleringsværdier:');

    const reguleringsvaerdierTableData =
      tafBounds
        ? buildReguleringsvaerdierTableData({
            ansaettelsesforhold,
            reguleringsdato,
            tafFra: tafBounds.foerste,
            tafTil: tafBounds.sidste,
          })
        : null;
    renderReguleringsvaerdierTable(reguleringsvaerdierTableData);

    writer.addSpacer(lineHeight);
    safeAddWrappedText('Beregnet regulering');

    const reguleringTableRows = buildReguleringIndexRows({
      segments: modelLoenudviklingSegmenter,
      ansaettelsesforhold,
      reguleringsdato,
    });
    renderReguleringIndeksTable(reguleringTableRows);

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
      } else if (statistikLabel.startsWith('ASL-')) {
        writer.addSpacer(lineHeight);
        safeAddWrappedText('ASL-årslønsmaksimum fremgår ikke eksplicit som reguleringsgrundlag i EAL § 15, men anvendes til fremskrivning på erstatnings- og arbejdsskadeområdet, og beror på den statslige tilpasningsprocent, der i almindelighed anvendes til fremskrivning af ydelser i samfundet.');
      }
    }
  }
};
