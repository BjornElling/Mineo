/**
 * PDF Generator for Årslønsberegning
 *
 * Genererer detaljeret specifikation af årslønsberegning med satser, indtægtsoplysninger og beregning
 */

import type { DocumentComposer } from '../../model/documentModel';
import { buildStamdataBrevhovedData, defineDocument, writeLabelValueRows } from '../documentGeneratorSetup';
import { buildFormattedTotalRowSpec, type ColumnSpec, type RowSpec } from '../../layout/tableSpec';
import { calculateStandardLoenRowDerived, type StandardLoenSatserInput } from '../../../domain/aarsloen/standardLoenRowCalculations';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { StandardLoenTableRow, LoenPaaHelligdage, Loenperiode, TillaegAngivesSom } from '../../../schemas/formSchemas';
import type { PeriodeResult } from '../../../utils/periodeBeregning';
import type { AarsloenBeregningResult } from '../../../types/calculation';
import { amountValueToDisplayString, amountValueToNumber } from '../../../utils/expressionAmount';
import { parsePercentToDecimal } from '../../../utils/numberParsing';
import { formatAsAmount, formatCountWithUnit, formatPercent } from '../../../utils/formatUtils';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import {
  STANDARD_LOEN_COL2_LABEL,
  STANDARD_LOEN_COL3_LABEL,
  resolveStandardLoenDocumentColumnLabel,
  resolveStandardLoenPeriodColumns,
} from '../../../domain/aarsloen/standardLoenTableColumns';
import {
  aarsloenAntalEnhederLabel,
  aarsloenFradragsParentes,
  aarsloenOmregningFormel,
  resolveAarsloenIndtastetEnhedSummary,
} from '../../../domain/aarsloen/aarsloenPeriodDisplay';
import { STANDARD_HVERDAGE_PAA_AAR, STANDARD_SH_DAGE_PAA_AAR } from '../../../utils/periodeBeregning';

const NBSP = '\u00A0';

/**
 * Formaterer beløb til dansk format med tusindtalsseparator.
 * Kalderne sender enten en AmountValue (tabelceller) eller et beregnet tal; aldrig en rå streng.
 */
const formatDanishAmount = (amount: AmountValue | number | null | undefined): string => {
  if (amount === null || amount === undefined) return '';
  if (typeof amount === 'number') {
    return formatAsAmount(amount, 2);
  }
  return amountValueToDisplayString(amount, 2);
};

/**
 * TOM celle: intet indtastet. En eksplicit `0` er IKKE tom.
 *
 * Bruges til at afgøre, om en TABELRÆKKE kommer med i dokumentet. En lønrække med 0 kr. er en oplysning –
 * den siger, at der i perioden ikke var lønindkomst – og brugeren indtaster den netop for at tydeliggøre
 * det frem for at udelade perioden, som da kunne se glemt ud. Rækken skal derfor med i bilaget
 * (brugerbeslutning 2026-08-26).
 */
const erCelleTom = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return true;

  if (typeof value === 'object' && value !== null && 'kind' in value) {
    return amountValueToNumber(value as AmountValue) === undefined;
  }

  return String(value).trim() === '';
};

/**
 * UDELADT SATS: tom ELLER nul.
 *
 * Bruges kun om Satser-afsnittets procentsatser, og her er nul-reglen den modsatte af tabellens. At
 * indtaste 0 i en tillægssats er for brugeren det samme som at sige, at satsen ikke findes i
 * ansættelsesforholdet – brugere skriver fra tid til anden 0, fordi de tror, det er sådan, man angiver et
 * fravær. Dokumentet retter den misforståelse ved at udelade satsen (brugerbeslutning 2026-08-26).
 *
 * De to prædikater var før ÉN funktion (`isEmptyOrZero`), som gjorde begge dele. Den udelod derfor også en
 * lønrække med 0 kr. fra bilaget – stik imod reglen ovenfor. Skellet er nu udtrykt som to navne.
 */
const erSatsUdeladt = (value: unknown): boolean => {
  if (erCelleTom(value)) return true;

  if (typeof value === 'object' && value !== null && 'kind' in value) {
    return amountValueToNumber(value as AmountValue) === 0;
  }

  const str = String(value).trim();
  return str === '0' || str === '0,00' || str === '0.00' || str === '0 %' || str === '0,0 %' || str === '0,00 %';
};

// Bruger parsePercentToDecimal (kanonisk parsing af dansk procentformat, komma som decimaltegn) × 100 → formatPercent.
// Undgår den fejlbehæftede manuelle .→, fjern-tusindtalsseparator-logik.
const formatPdfPercent = (pct: string | number | undefined): string => {
  if (pct === null || pct === undefined || pct === '') return '';
  const decimal = parsePercentToDecimal(pct);
  return formatPercent(decimal * 100);
};

/**
 * Tilføj satser-sektion som almindelige tekstlinjer
 * VIGTIGT: Filtrerer tomme/nul satser - skip hele sektionen hvis ingen satser er udfyldt
 */
const addSatserSection = (
  writer: DocumentComposer,
  satser: StandardLoenSatserInput,
): void => {
  // Definer alle mulige satser
  const satsDefinitioner: Array<{ key: keyof StandardLoenSatserInput; label: string }> = [
    { key: 'feriePct', label: 'Feriegodtgørelse/-tillæg' },
    { key: 'fritvalgPct', label: 'Fritvalg' },
    { key: 'shSoPct', label: 'SH/SO-sats' },
    { key: 'storeBededagPct', label: 'Store Bededagstillæg' },
    { key: 'pensionPct', label: 'Arbejdsgivers pensionsbidrag' }
  ];

  // Filtrer satser - behold kun udfyldte
  const udfyldteSatser = satsDefinitioner.filter(sats => !erSatsUdeladt(satser[sats.key]));

  // Hvis ingen satser er udfyldt, skip hele sektionen
  if (udfyldteSatser.length === 0) {
    return;
  }

  writer.writeBoldSubheader('Satser');
  writeLabelValueRows(
    writer,
    udfyldteSatser.map((sats) => ({
      label: sats.label,
      value: formatPdfPercent(satser[sats.key]),
    }))
  );
  writer.addSectionSpacer();
};

/**
 * Tilføj indtægtsoplysninger-tabel
 */
const addIndtaegtsoplysningerTable = (
  writer: DocumentComposer,
  tableData: readonly StandardLoenTableRow[],
  loenperiode: Loenperiode,
  satser: StandardLoenSatserInput,
  beregnetAarsloen: number,
  tillaegAngivesSom: TillaegAngivesSom
): void => {
  writer.writeBoldSubheader('Indtægtsoplysninger');

  // Filtrer rækker - behold kun rækker hvor MINDST én input-celle er udfyldt
  const filteredData = tableData.filter(row => {
    // Tjek periode-kolonner baseret på loenperiode
    let harPeriode = false;
    if (loenperiode === 'maaned') {
      harPeriode = !erCelleTom(row.col0_maaned) || !erCelleTom(row.col1_maaned);
    } else if (loenperiode === 'uge') {
      harPeriode = !erCelleTom(row.col0_uge) || !erCelleTom(row.col1_uge);
    } else if (loenperiode === 'dag') {
      harPeriode = !erCelleTom(row.col0_dag) || !erCelleTom(row.col1_dag);
    }

    // Tjek beløbsfelter (Løn, Løn (2), Ikke-pensionsgivende løn, ATP og anden ikke-FB løn)
    const harLoen = !erCelleTom(row.col2) || !erCelleTom(row.col3) || !erCelleTom(row.col4) ||
                     !erCelleTom(row.col5);

    // Behold række hvis der er data i periode ELLER løn
    return harPeriode || harLoen;
  });

  // Headers afhænger af lønperiode
  const periodHeaders =
    loenperiode === 'maaned'
      ? ['Måned', 'År']
      : loenperiode === 'uge'
        ? ['Uge fra', 'Uge til']
        : ['Dato fra', 'Dato til'];

  const headerLabels = [
    ...periodHeaders,
    STANDARD_LOEN_COL2_LABEL,
    STANDARD_LOEN_COL3_LABEL,
    // Forkortelserne er den ERKLÆREDE dokument-form af de kanoniske kolonnenavne (§3.2a), ikke frie
    // strenge – et værn beviser, at hver er afledt af navnet. Den viste tekst er uændret.
    resolveStandardLoenDocumentColumnLabel('col4'),
    resolveStandardLoenDocumentColumnLabel('col5'),
    resolveStandardLoenDocumentColumnLabel('fpFvShSoBeloeb'),
    resolveStandardLoenDocumentColumnLabel('pensionBeloeb'),
    'Samlet løn',
  ];

  const columnCount = headerLabels.length;

  // Data-justering: to centrerede periode-kolonner + syv højrejusterede tal-kolonner.
  // Alle headere er derimod centrerede – derfor eksplicit celle-override på header-rækken.
  const columns: readonly ColumnSpec[] = headerLabels.map((_, index) => ({
    width: { kind: 'flex' },
    align: index < 2 ? 'center' : 'right',
  }));

  const dataRows: RowSpec[] = filteredData.map((row) => {
    // Periode-kolonner (fra/til) via den delte resolver – dag-perioden formateres
    // til dansk DD-MM-ÅÅÅÅ dér, så ISO-datoer aldrig lækker ud i tabellen.
    const [col0Val, col1Val] = resolveStandardLoenPeriodColumns(row, loenperiode);
    const derived = calculateStandardLoenRowDerived(row, {
      feriePct: satser?.feriePct,
      fritvalgPct: satser?.fritvalgPct,
      shSoPct: satser?.shSoPct,
      storeBededagPct: satser?.storeBededagPct,
      pensionPct: satser?.pensionPct,
    }, { mode: tillaegAngivesSom });

    return {
      cells: [
        { text: col0Val },
        { text: col1Val },
        { text: formatDanishAmount(row.col2) },
        { text: formatDanishAmount(row.col3) },
        { text: formatDanishAmount(row.col4) },
        { text: formatDanishAmount(row.col5) },
        { text: formatDanishAmount(derived.fpFvShSo) },
        { text: formatDanishAmount(derived.pension) },
        { text: formatDanishAmount(derived.samlet) },
      ],
    };
  });

  const totalRow = filteredData.length > 1
    ? buildFormattedTotalRowSpec(
        'I alt',
        `${formatDanishAmount(beregnetAarsloen)}${NBSP}kr.`,
        { columnCount, valueColumnIndex: 8, labelAlign: 'center', valueHasKrSuffix: false }
      )
    : null;

  writer.addTable({
    columns,
    hasHeaderRow: true,
    rows: [
      { kind: 'header', cells: headerLabels.map((text) => ({ text, align: 'center' as const })) },
      ...dataRows,
      ...(totalRow ? [totalRow] : []),
    ],
  });
};

/**
 * Tilføj beregningsprincipper-sektion som almindelige tekstlinjer
 */
type BeregningsprincipperParams = Readonly<{
  tableData: readonly StandardLoenTableRow[];
  periodeData: PeriodeResult | null;
  beregningsData: AarsloenBeregningResult;
  loenperiode: Loenperiode;
  fuldLoenUnderFerie: boolean;
  retTilSjetteFerieuge: boolean;
  antalFeriedage: number | undefined;
  loenPaaHelligdage: LoenPaaHelligdage;
  shDageAntal: number | null;
}>;

const addBeregningsprinciperSection = (
  writer: DocumentComposer,
  params: BeregningsprincipperParams,
): void => {
  const {
    tableData,
    periodeData,
    beregningsData,
    loenperiode,
    fuldLoenUnderFerie,
    retTilSjetteFerieuge,
    antalFeriedage,
    loenPaaHelligdage,
    shDageAntal,
  } = params;

  const rows: Array<{
    label: string;
    value: string;
  }> = [];

  const indtastetEnhedSummary = resolveAarsloenIndtastetEnhedSummary({
    tableData,
    periodeData,
    beregningsData,
    loenperiode,
  });

  rows.push({
    label: indtastetEnhedSummary.label,
    value: indtastetEnhedSummary.value,
  });

  // Fuld løn under ferie
  rows.push({
    label: 'Fuld løn under ferie',
    value: fuldLoenUnderFerie ? 'Ja' : 'Nej',
  });

  // Ret til 6. ferieuge og Antal feriedage (kun hvis ikke fuld løn under ferie)
  if (!fuldLoenUnderFerie) {
    // Ret til 6. ferieuge
    rows.push({
      label: 'Ret til 6. ferieuge',
      value: retTilSjetteFerieuge ? 'Ja' : 'Nej',
    });

    // Antal feriedage
    const feriedageVal = String(antalFeriedage ?? 0);
    rows.push({
      label: 'Antal feriedage (mandag-fredag) i de indtastede perioder',
      value: feriedageVal,
    });
  }

  // Løn på helligdage
  rows.push({
    label: 'Løn på helligdage',
    value: loenPaaHelligdage || '',
  });

  // Antal SH-dage (kun hvis loenPaaHelligdage === 'SH-udbetaling' eller 'Ingen')
  if (loenPaaHelligdage === 'SH-udbetaling' || loenPaaHelligdage === 'Ingen') {
    rows.push({
      label: 'Antal SH-dage i de indtastede perioder',
      value: String(shDageAntal ?? 0),
    });
  }

  writer.writeBoldSubheader('Beregningsprincipper');
  writeLabelValueRows(writer, rows);
  writer.addSectionSpacer();
};

/**
 * Tilføj beregning-sektion som almindelige tekstlinjer
 */
type BeregningSectionParams = Readonly<{
  beregningsData: AarsloenBeregningResult;
  beregnetAarsloen: number;
  fuldLoenUnderFerie: boolean;
  shDageAntal: number | null;
  loenperiode: Loenperiode;
  retTilSjetteFerieuge: boolean;
}>;

const addBeregningSection = (
  writer: DocumentComposer,
  params: BeregningSectionParams,
): void => {
  const { beregningsData, beregnetAarsloen, fuldLoenUnderFerie, shDageAntal, loenperiode, retTilSjetteFerieuge } = params;

  const rows: Array<{
    label: string;
    value: string;
    rightFontStyle?: 'normal' | 'bold';
  }> = [];

  // Første data-række: Sammentælling af løn fra tabellen
  rows.push({
    label: 'Sammentælling af løn fra tabellen',
    value: `${formatDanishAmount(beregnetAarsloen)} kr.`,
  });

  // Tilføj rækker baseret på beregningsmetode
  if (beregningsData.metode === 'A') {
    // METODE A: Arbejdsdage
    const shDageAntalSafe = shDageAntal ?? 0;
    const linje1Label = `Arbejdsdage i beregningsperioden${aarsloenFradragsParentes(
      `${beregningsData.hverdageIPeriode} hverdage`,
      [
        !fuldLoenUnderFerie && beregningsData.feriedageFraInput > 0
          ? ` - ${beregningsData.feriedageFraInput} feriedage` : '',
        shDageAntalSafe > 0 ? ` - ${shDageAntalSafe} SH-dage` : '',
      ]
    )}`;

    rows.push({
      label: linje1Label,
      value: `${beregningsData.arbejdsdageIPeriode} arbejdsdage`,
    });

    const linje2Label = fuldLoenUnderFerie
      ? `Arbejdsdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${STANDARD_SH_DAGE_PAA_AAR} SH-dage)`
      : `Arbejdsdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'} - ${STANDARD_SH_DAGE_PAA_AAR} SH-dage)`;

    rows.push({
      label: linje2Label,
      value: `${beregningsData.arbejdsdagePaaAar} arbejdsdage`,
    });

    rows.push({
      label: `Beregnet årsløn (${aarsloenOmregningFormel(formatDanishAmount(beregnetAarsloen), beregningsData.arbejdsdageIPeriode, String(beregningsData.arbejdsdagePaaAar))})`,
      value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
      rightFontStyle: 'bold',
    });

  } else if (beregningsData.metode === 'B') {
    // METODE B: Hverdage
    const linje1Label = `Hverdage i beregningsperioden${aarsloenFradragsParentes(
      `${beregningsData.hverdageIPeriode} hverdage`,
      [!fuldLoenUnderFerie && beregningsData.feriedageFraInput > 0
        ? ` - ${beregningsData.feriedageFraInput} feriedage` : '']
    )}`;

    rows.push({
      label: linje1Label,
      value: `${beregningsData.arbejdsdageIPeriode} hverdage`,
    });

    rows.push({
      label: fuldLoenUnderFerie
        ? `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage)`
        : `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'})`,
      value: `${beregningsData.hverdagePaaAar} hverdage`,
    });

    rows.push({
      label: `Beregnet årsløn (${aarsloenOmregningFormel(formatDanishAmount(beregnetAarsloen), beregningsData.arbejdsdageIPeriode, String(beregningsData.hverdagePaaAar))})`,
      value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
      rightFontStyle: 'bold',
    });

  } else if (beregningsData.metode === 'C') {
    // METODE C: Måneder/Uger/Dage
    if (loenperiode === 'maaned') {
      rows.push({
        label: aarsloenAntalEnhederLabel('måneder', beregningsData.antalEnheder === 1),
        value: formatCountWithUnit(beregningsData.antalEnheder, 'måned', 'måneder'),
      });

      const linje2Label = `Beregnet årsløn (${aarsloenOmregningFormel(
        formatDanishAmount(beregnetAarsloen), beregningsData.antalEnheder, '12'
      )})`;

      rows.push({
        label: linje2Label,
        value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
        rightFontStyle: 'bold',
      });

    } else if (loenperiode === 'uge') {
      rows.push({
        label: aarsloenAntalEnhederLabel('uger', beregningsData.antalEnheder === 1),
        value: formatCountWithUnit(beregningsData.antalEnheder, 'uge', 'uger'),
      });

      rows.push({
        label: `Beregnet årsløn (${aarsloenOmregningFormel(formatDanishAmount(beregnetAarsloen), beregningsData.antalEnheder, '52,14')})`,
        value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
        rightFontStyle: 'bold',
      });

    } else if (loenperiode === 'dag') {
      if (beregningsData.antalHeleKalendermaaneder !== null) {
        // Hele kalendermåneder – vis måneds-omregning som ved månedsløn
        const n = beregningsData.antalHeleKalendermaaneder;
        rows.push({
          label: aarsloenAntalEnhederLabel('måneder', n === 1),
          value: formatCountWithUnit(n, 'måned', 'måneder'),
        });
        rows.push({
          label: `Beregnet årsløn (${aarsloenOmregningFormel(formatDanishAmount(beregnetAarsloen), n, '12')})`,
          value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
          rightFontStyle: 'bold',
        });
      } else {
        // Dag-fallback: hverdagsomregning identisk med metode B (bevidst domænevalg)
        const linje1Label = `Hverdage i beregningsperioden${aarsloenFradragsParentes(
          `${beregningsData.hverdageIPeriode} hverdage`,
          [!fuldLoenUnderFerie && beregningsData.feriedageFraInput > 0
            ? ` - ${beregningsData.feriedageFraInput} feriedage` : '']
        )}`;

        rows.push({
          label: linje1Label,
          value: `${beregningsData.arbejdsdageIPeriode} hverdage`,
        });

        rows.push({
          label: fuldLoenUnderFerie
            ? `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage)`
            : `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'})`,
          value: `${beregningsData.hverdagePaaAar} hverdage`,
        });

        rows.push({
          label: `Beregnet årsløn (${aarsloenOmregningFormel(formatDanishAmount(beregnetAarsloen), beregningsData.arbejdsdageIPeriode, String(beregningsData.hverdagePaaAar))})`,
          value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
          rightFontStyle: 'bold',
        });
      }
    }
  }

  writer.writeBoldSubheader('Beregning');
  writeLabelValueRows(writer, rows);
};


/**
 * Generer og download PDF for årslønsberegning
 *
 * @param {object} params - Parameter-objekt med alle nødvendige data
 */
type GenerateAarsloenDocumentParams = DocumentCommonOptions & Readonly<{
  satser: StandardLoenSatserInput;
  loenperiode: Loenperiode;
  tillaegAngivesSom: TillaegAngivesSom;
  tableData: readonly StandardLoenTableRow[];
  beregnetAarsloen: number;
  omregningTilFuldtAar: boolean;
  periodeData: PeriodeResult | null;
  fuldLoenUnderFerie: boolean;
  retTilSjetteFerieuge: boolean;
  antalFeriedage: number | undefined;
  loenPaaHelligdage: LoenPaaHelligdage;
  shDageAntal: number | null;
  beregningsData: AarsloenBeregningResult;
}>;

export const generateAarsloenDocument = defineDocument<GenerateAarsloenDocumentParams>({
  title: 'Årslønsberegning',
  filename: ({ stamdata }, format) => resolveDocumentArtifactFileName(
    'Årslønsberegning',
    false,
    stamdata?.journalnr,
    format
  ),
  brevhoved: ({ visBrevhoved = false, stamdata }) =>
    visBrevhoved ? buildStamdataBrevhovedData(stamdata) : null,
  body: (writer, params) => {
  const {
    satser,
    loenperiode,
    tillaegAngivesSom,
    tableData,
    beregnetAarsloen,
    omregningTilFuldtAar,
    periodeData,
    fuldLoenUnderFerie,
    retTilSjetteFerieuge,
    antalFeriedage,
    loenPaaHelligdage,
    shDageAntal,
    beregningsData,
  } = params;

  // Tilføj satser-sektion (kun hvis der er udfyldte satser). I Beløb-tilstand bruges satserne
  // ikke (tillæg er indtastet som beløb i tabellen), og sektionen udelades.
  if (tillaegAngivesSom !== 'beloeb') {
    addSatserSection(writer, satser);
  }

  // Tilføj indtægtsoplysninger-tabel (inkl. "I alt"-linje)
  addIndtaegtsoplysningerTable(
    writer,
    tableData,
    loenperiode,
    satser,
    beregnetAarsloen,
    tillaegAngivesSom
  );

  // Betinget: Beregningsprincipper og beregning (kun hvis omregning er aktiveret)
  if (omregningTilFuldtAar && periodeData) {
    // Tilføj beregningsprincipper-sektion
    addBeregningsprinciperSection(writer, {
      tableData,
      periodeData,
      beregningsData,
      loenperiode,
      fuldLoenUnderFerie,
      retTilSjetteFerieuge,
      antalFeriedage,
      loenPaaHelligdage,
      shDageAntal
    });

    // Tilføj beregning-sektion (kun hvis der er mellemregning)
    if (beregningsData.metode !== 'ingen' && !beregningsData.erEtAar) {
      addBeregningSection(writer, {
        beregningsData,
        beregnetAarsloen,
        fuldLoenUnderFerie,
        shDageAntal,
        loenperiode,
        retTilSjetteFerieuge
      });
    }
  }

  },
});
