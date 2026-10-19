import { formatAsAmount } from '../../../../utils/formatUtils';
import { amountValueToDisplayString } from '../../../../utils/expressionAmount';
import { getStandardLoenErrorRowIdSet } from '../../../../domain/erstatningsopgoerelse/validation/indkomstRowValidation';
import type { StandardLoenTableRow, ErstatningsopgoerelseValues, Loenperiode, StamdataValues, TillaegAngivesSom } from '../../../../schemas/formSchemas';
import { sortStandardLoenRowsChronologically } from '../../../../domain/standardLoen/standardLoenRowOrder';
import { isISODateString, type ISODateString } from '../../../../types/branded';
import { resolveOverenskomstDisplay } from '../../../../data/overenskomstRates';
import { resolveAktivOverenskomst } from '../../../../domain/erstatningsopgoerelse/helpers/aktivOverenskomst';
import { resolveAnsaettelsesforholdNavn } from '../../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { resolveSatserHeadingForAnsaettelsesforhold } from '../../../../domain/erstatningsopgoerelse/helpers/satserHeading';
import type { SelectedElements } from '../types';
import { buildPeriodRangeGroups, normalizeEoBilagIndkomstYdelserMode, type IsoRange } from '../../../../domain/erstatningsopgoerelse/engines/periodRangeGroups';
import { type ColumnSpec, type RowSpec } from '../../../layout/tableSpec';
import { getStandardLoenHeaderIndex, STANDARD_LOEN_FPFVSHSO_LABEL, STANDARD_LOEN_PENSION_LABEL, STANDARD_LOEN_SAMLET_LABEL } from '../../../../domain/aarsloen/standardLoenTableColumns';
import { calculateLoenindkomstRowDerived } from '../../../../domain/erstatningsopgoerelse/helpers/loenindkomstRowDerived';
import type { DocumentComposer } from '../../../model/documentModel';
import {
  buildLoenindkomstDelvisePerioderLinjer,
  type EoBilagDelvisPeriode,
} from '../../../../domain/erstatningsopgoerelse/helpers/eoBilagDelvisePerioder';

type EoBilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];
type LoenSectionContext = Readonly<{
  selectedElements: SelectedElements;
  eoValues: ErstatningsopgoerelseValues;
  stamdataValues: Pick<StamdataValues, 'skadedato' | 'skadestype'>;
  startEoBilagPage: (titleText: string) => void;
  renderSubheader: (text: string, options?: Readonly<{ addTopSpacing?: boolean }>) => void;
  safeAddWrappedText: (text: string) => void;
  writeLabelValueLine: (label: string, value: string) => void;
  formatDateLong: (isoDate: ISODateString | undefined) => string;
  formatPctFromInput: (value: number | undefined) => string;
  isZeroPct: (value: number | undefined) => boolean;
  getLoenindkomstTableHeaders: (loenperiode: Loenperiode) => readonly string[];
  resolvePeriodColumns: (row: StandardLoenTableRow, loenperiode: Loenperiode) => readonly [string, string];
  hasLoenAmountInput: (value: StandardLoenTableRow['col2']) => boolean;
  shouldIncludeLoenRowInEoBilag: (params: Readonly<{
    row: StandardLoenTableRow;
    loenperiode: Loenperiode;
    mode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar;
    ranges: readonly IsoRange[];
    errorRowIds: ReadonlySet<string>;
    tillaegAngivesSom?: TillaegAngivesSom;
  }>) => boolean;
  eoBilagIndkomstYdelserMode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar;
  eoBilagIndkomstYdelserRanges: readonly IsoRange[];
  /** Perioderne, en delvist medregnet lønseddel forklares for under tabellen (BB-293). */
  delvisePerioder?: readonly EoBilagDelvisPeriode[];
  writer: Pick<DocumentComposer, 'addSectionSpacer' | 'addTable'>;
}>;

export const renderLoenindkomstSection = (ctx: LoenSectionContext): void => {
  const {
    selectedElements,
    eoValues,
    stamdataValues,
    startEoBilagPage,
    renderSubheader,
    safeAddWrappedText,
    writeLabelValueLine,
    formatDateLong,
    formatPctFromInput,
    isZeroPct,
    getLoenindkomstTableHeaders,
    resolvePeriodColumns,
    hasLoenAmountInput,
    shouldIncludeLoenRowInEoBilag,
    eoBilagIndkomstYdelserMode,
    eoBilagIndkomstYdelserRanges,
    delvisePerioder = [],
    writer,
  } = ctx;

  if (!selectedElements.loenindkomst) return;
  const normalizedEoBilagMode = normalizeEoBilagIndkomstYdelserMode(eoBilagIndkomstYdelserMode);

  const formatAmountCell = (value: StandardLoenTableRow['col2']): string => amountValueToDisplayString(value, 2);
  const loenErrorRowIdsByEmploymentId = new Map<string, ReadonlySet<string>>(
    (eoValues.loenindkomstAnsaettelsesforhold ?? []).map((af) => [
      af.id,
      getStandardLoenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode, af.tillaegAngivesSom),
    ])
  );

  const renderLoenindkomstTable = (
    ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number],
    errorRowIds: ReadonlySet<string>,
    ranges: readonly IsoRange[]
  ) => {
    // Bilaget trykker altid rækkerne kronologisk, uafhængigt af den sortering, brugeren har valgt på skærmen
    // (udviklerafgørelse 2026-10-19, BB-294): skærmens rækkefølge er en visningsdetalje, papiret er et bilag.
    const rows = sortStandardLoenRowsChronologically(
      (ansaettelsesforhold.indtaegtsoplysningerTableData ?? []).filter((row) => {
        return shouldIncludeLoenRowInEoBilag({
          row,
          loenperiode: ansaettelsesforhold.loenperiode,
          mode: normalizedEoBilagMode,
          ranges,
          errorRowIds,
          tillaegAngivesSom: ansaettelsesforhold.tillaegAngivesSom,
        });
      }),
      ansaettelsesforhold.loenperiode
    );
    if (rows.length === 0) return;

    const loenperiode = ansaettelsesforhold.loenperiode;
    const allHeaders = getLoenindkomstTableHeaders(loenperiode);
    const inputColumnDefs = [
      { index: 2, key: 'col2' as const },
      { index: 3, key: 'col3' as const },
      { index: 4, key: 'col4' as const },
      { index: 5, key: 'col5' as const },
    ];
    const visibleInputColumns = inputColumnDefs.filter((column) =>
      rows.some((row) => hasLoenAmountInput(row[column.key]))
    );
    const headers = [
      allHeaders[0],
      allHeaders[1],
      ...visibleInputColumns.map((column) => allHeaders[column.index]),
      allHeaders[getStandardLoenHeaderIndex(loenperiode, STANDARD_LOEN_FPFVSHSO_LABEL)],
      allHeaders[getStandardLoenHeaderIndex(loenperiode, STANDARD_LOEN_PENSION_LABEL)],
      allHeaders[getStandardLoenHeaderIndex(loenperiode, STANDARD_LOEN_SAMLET_LABEL)],
    ];
    // De to periode-kolonner centreres; alle beløbskolonner højrejusteres. Justeringen
    // bæres af kolonne-intentionen (celle-fallback), mens header-cellerne altid centreres.
    const columns: readonly ColumnSpec[] = headers.map((_, index) => ({
      width: { kind: 'flex' },
      align: index < 2 ? 'center' : 'right',
    }));
    const specRows: RowSpec[] = [
      { kind: 'header', cells: headers.map((header) => ({ text: header, align: 'center' })) },
    ];

    for (const row of rows) {
      const [col0, col1] = resolvePeriodColumns(row, ansaettelsesforhold.loenperiode);
      const derived = calculateLoenindkomstRowDerived({
        row,
        ansaettelsesforhold,
        context: {
          beregnesUdFra: eoValues.beregnesUdFra,
          tafBeregningsperiodeFra: eoValues.tafBeregningsperiodeFra,
          tafBeregningsperiodeTil: eoValues.tafBeregningsperiodeTil,
          loenindkomstAnsaettelsesforhold: eoValues.loenindkomstAnsaettelsesforhold ?? [],
          ferieperioder: eoValues.ferieperioder,
          fravaerPerioder: eoValues.fravaerPerioder,
          tafPerioder: eoValues.tafPerioder,
        },
      });
      const rowValues = [
        col0,
        col1,
        ...visibleInputColumns.map((column) => formatAmountCell(row[column.key])),
        formatAsAmount(derived.fpFvShSo, 2),
        formatAsAmount(derived.pension, 2),
        formatAsAmount(derived.samlet, 2),
      ];
      specRows.push({ cells: rowValues.map((value) => ({ text: value })) });
    }

    writer.addTable({ columns, hasHeaderRow: true, rows: specRows });

    // Tabellen står som lønsedlerne; en kort sætning under den forklarer de rækker, beregningen kun medregner en
    // del af, fordi perioden skærer igennem dem (BB-293). Ingen linjer inde i tabellen – den skal kun indeholde
    // sine værdier (udviklerafgørelse 2026-10-19).
    const delvisePerioderLinjer = buildLoenindkomstDelvisePerioderLinjer({
      eoValues,
      ansaettelsesforholdIndex: (eoValues.loenindkomstAnsaettelsesforhold ?? []).indexOf(ansaettelsesforhold),
      trykteRaekkeIds: rows.map((row) => row.id),
      perioder: delvisePerioder,
      skadedato: isISODateString(stamdataValues.skadedato) ? stamdataValues.skadedato : undefined,
    });
    if (delvisePerioderLinjer.length > 0) {
      writer.addSectionSpacer();
      delvisePerioderLinjer.forEach((linje) => safeAddWrappedText(linje));
    }
  };

  const rangeGroups = buildPeriodRangeGroups(eoValues, eoBilagIndkomstYdelserMode, eoBilagIndkomstYdelserRanges);
  const hasRowsInAnyGroup = rangeGroups.some((group) =>
    (eoValues.loenindkomstAnsaettelsesforhold ?? []).some((ansaettelsesforhold) => {
      const errorRowIds = loenErrorRowIdsByEmploymentId.get(ansaettelsesforhold.id) ?? new Set<string>();
      return (ansaettelsesforhold.indtaegtsoplysningerTableData ?? []).some((row) =>
        shouldIncludeLoenRowInEoBilag({
          row,
          loenperiode: ansaettelsesforhold.loenperiode,
          mode: normalizedEoBilagMode,
          ranges: group.ranges,
          errorRowIds,
          tillaegAngivesSom: ansaettelsesforhold.tillaegAngivesSom,
        })
      );
    })
  );
  if (!hasRowsInAnyGroup) return;

  startEoBilagPage('Lønindkomst');
  writer.addSectionSpacer();
  const combinedRanges = rangeGroups.flatMap((group) => group.ranges);
  const ansaettelserWithRows = (eoValues.loenindkomstAnsaettelsesforhold ?? []).filter((ansaettelsesforhold) => {
    const errorRowIds = loenErrorRowIdsByEmploymentId.get(ansaettelsesforhold.id) ?? new Set<string>();
    return (ansaettelsesforhold.indtaegtsoplysningerTableData ?? []).some((row) =>
      shouldIncludeLoenRowInEoBilag({
        row,
        loenperiode: ansaettelsesforhold.loenperiode,
        mode: normalizedEoBilagMode,
        ranges: combinedRanges,
        errorRowIds,
        tillaegAngivesSom: ansaettelsesforhold.tillaegAngivesSom,
      })
    );
  });

  const alleAnsaettelser = eoValues.loenindkomstAnsaettelsesforhold ?? [];
  for (const [index, ansaettelsesforhold] of ansaettelserWithRows.entries()) {
      // Nummeret er kortets plads på skærmen, ikke pladsen blandt de ansættelsesforhold, bilaget viser.
      const arbejdsstedNavn = resolveAnsaettelsesforholdNavn(
        ansaettelsesforhold.navnPaaArbejdssted,
        alleAnsaettelser.indexOf(ansaettelsesforhold)
      );
      const shouldAddTopSpacing = index > 0;
      renderSubheader(arbejdsstedNavn, { addTopSpacing: shouldAddTopSpacing });
      const aktivOverenskomst = resolveAktivOverenskomst(ansaettelsesforhold);
      if (aktivOverenskomst.aktiv) {
        writeLabelValueLine('Overenskomst', resolveOverenskomstDisplay(aktivOverenskomst.overenskomstId));
        writer.addSectionSpacer();
      }
      // Beløb-tilstand: de skjulte top-satsfelter er ikke dokumentkilde; relevante satser står i
      // lønoplysningerne/manuelle reguleringsrækker, hvor brugeren har indtastet dem.
      if (selectedElements.okSatser && ansaettelsesforhold.tillaegAngivesSom !== 'beloeb') {
        const satsLinjer: ReadonlyArray<readonly [string, number | undefined]> = [
          ['Feriegodtgørelse/-tillæg:', ansaettelsesforhold.feriePct],
          ['Fritvalg:', ansaettelsesforhold.fritvalgPct],
          ['SH/SO-sats:', ansaettelsesforhold.shSoPct],
          ['Store Bededagstillæg:', ansaettelsesforhold.storeBededagPct],
          ['Arbejdsgivers pensionsbidrag:', ansaettelsesforhold.pensionPct],
        ];
        const synligeSatsLinjer = satsLinjer.filter(([, value]) => !isZeroPct(value));
        if (synligeSatsLinjer.length > 0) {
          // Satslinjerne er satserne på reguleringsdatoen – dem, beregningsgrundlaget regner med – mens tabellens
          // rækker viser lønsedlens tillæg med månedens satser. Uden datoen stod «SH/SO-sats: 3,4 %» over rækker
          // regnet med 2,7 % (BB-276; rækkerne følger bevidst lønsedlen, udviklerafgørelse 2026-10-06). Den
          // forklarende linje om månedens satser er fjernet efter udviklerens ønske (BB-299, 2026-10-19): brugeren
          // forventer adfærden, og datoen i overskriften er nok til at skelne satserne.
          safeAddWrappedText(`${resolveSatserHeadingForAnsaettelsesforhold({
            values: eoValues,
            ansaettelsesforhold,
            skadedato: isISODateString(stamdataValues.skadedato) ? stamdataValues.skadedato : undefined,
            skadestype: stamdataValues.skadestype,
          })}:`);
          synligeSatsLinjer.forEach(([label, value]) => writeLabelValueLine(label, formatPctFromInput(value)));
        }
      }
      if (ansaettelsesforhold.ansatPaaSkadestidspunktet && ansaettelsesforhold.ansaettelsesforholdOphoert) {
        const sidsteDag = formatDateLong(ansaettelsesforhold.sidsteArbejdsdag);
        // Feltets egen betegnelse (BB-283): «sidste arbejdsdag» og feltets navn er samme dato.
        const opsigelsesLinje = sidsteDag
          ? `Skadelidte er opsagt fra stillingen med sidste dag i ansættelsesforholdet ${sidsteDag}.`
          : 'Skadelidte er opsagt fra stillingen.';
        writer.addSectionSpacer();
        safeAddWrappedText(opsigelsesLinje);
      }
      const errorRowIds = loenErrorRowIdsByEmploymentId.get(ansaettelsesforhold.id) ?? new Set<string>();
      renderLoenindkomstTable(ansaettelsesforhold, errorRowIds, combinedRanges);
  }
};
