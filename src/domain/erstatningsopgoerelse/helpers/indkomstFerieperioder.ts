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
 * beregningsperioden» i beregningsperioden og TAF-afsnittets «Evt. ferie i TAF-perioden» i TAF-perioderne.
 *
 * De to tabeller må ikke lægges sammen over hele tidslinjen. En TAF-ferie dateret i (eller lige før) en
 * beregningsperiode efter skaden ville da ændre, hvordan en lønrække fordeles i beregningsperioden, mens
 * nævneren (`calculateTafArbejdsdageBreakdown`) kun fradrager beregningsperiodens egen ferie: dagsindkomsten
 * flytter sig, uden at antallet af arbejdsdage gør, og programmets kontrol melder uoverensstemmelse.
 * TAF-afsnittets ferie fradrages heller ikke andre steder end i TAF-perioderne, så fordelingen følger samme ramme.
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
