import type { ErstatningsopgoerelseValues, FerieperiodeRow } from '../../../schemas/formSchemas';
import { isISODateString, type ISODateString } from '../../../types/branded';
import { mergeIsoDateRanges } from '../engines/isoRangeAlgebra';

export type IndkomstFerieperioderInput = Pick<
  ErstatningsopgoerelseValues,
  'ferieperioder' | 'fravaerPerioder' | 'tafPerioder' | 'beregnesUdFra' | 'tafBeregningsperiodeFra' | 'tafBeregningsperiodeTil'
>;

type Range = Readonly<{ fra: ISODateString; til: ISODateString }>;

const validRange = (row: Readonly<{ fra?: ISODateString | undefined; til?: ISODateString | undefined }>): Range | undefined =>
  isISODateString(row.fra) && isISODateString(row.til) && row.fra <= row.til ? { fra: row.fra, til: row.til } : undefined;

const clipTo = (rows: readonly FerieperiodeRow[], ranges: readonly Range[]): FerieperiodeRow[] =>
  rows.flatMap((row) => {
    const ferie = validRange(row);
    if (ferie === undefined) return [];
    return ranges.flatMap((range, index) => {
      const fra = ferie.fra > range.fra ? ferie.fra : range.fra;
      const til = ferie.til < range.til ? ferie.til : range.til;
      return fra <= til ? [{ ...row, id: index === 0 ? row.id : `${row.id}#${index}`, fra, til }] : [];
    });
  });

/**
 * De ferieperioder, lønnen fordeles efter i arbejdsdage – hver tabel KUN i sin egen periode: «Ferie i
 * beregningsperioden» i beregningsperioden og TAF-afsnittets «Evt. ferie i perioden» i TAF-perioderne.
 *
 * Før blev de to tabeller lagt sammen over hele tidslinjen. En TAF-ferie dateret i (eller lige før) en
 * beregningsperiode efter skaden ændrede da, hvordan en lønrække blev fordelt i beregningsperioden, mens
 * nævneren (`calculateTafArbejdsdageBreakdown`) kun fradrog beregningsperiodens egen ferie: dagsindkomsten
 * flyttede sig, uden at antallet af arbejdsdage gjorde, og programmets kontrol meldte uoverensstemmelse
 * (udviklerafgørelse 2026-10-02, opfølgning på BB-261). TAF-afsnittets ferie fradrages heller ikke andre steder
 * end i TAF-perioderne (BB-249), så fordelingen følger nu samme ramme.
 */
export const resolveIndkomstFerieperioder = (values: IndkomstFerieperioderInput): readonly FerieperiodeRow[] => {
  const tafRanges = mergeIsoDateRanges(
    (values.tafPerioder ?? []).flatMap((row) => validRange(row) ?? []),
    { mergeAdjacent: true },
  );
  const tafFerie = clipTo(values.ferieperioder ?? [], tafRanges);
  const beregningsperiode = values.beregnesUdFra === 'Beregningsperiode'
    ? validRange({ fra: values.tafBeregningsperiodeFra, til: values.tafBeregningsperiodeTil })
    : undefined;
  if (beregningsperiode === undefined) return tafFerie;
  return [...clipTo(values.fravaerPerioder ?? [], [beregningsperiode]), ...tafFerie];
};
