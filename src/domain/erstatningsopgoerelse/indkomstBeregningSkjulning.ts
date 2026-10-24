import type { FieldAddress } from '../../inputCore/fieldAddress';
import type { EoRowPolicy } from '../../settings/sourceSettings';
import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import { isErr } from '../../types/result';
import { safeCompute } from '../../utils/safeComputation';
import { collectAllEoRows } from '../eoRowEvaluation/eoRowAggregator';
import type { ErstatningsopgoerelseReaderProjection } from './erstatningsopgoerelseReaderProjection';
import { selectBlockingLoenindkomstEntityIds } from './eoInputIssues';
import { skalKomprimereIndkomstBeregning } from './validation/eoNummerValidering';

/**
 * «Skjul beregning efter første opgørelse» skjuler kun et beregningsgrundlag, der kan bære TAF-beregningen.
 *
 * Før skjulte togglen grundlaget alene ud fra opgørelsens nummer og togglens værdi. Var grundlaget tomt eller
 * rødt i en senere opgørelse, stod linjerne i «Fejl og advarsler» med et link til et felt, der ikke var på
 * skærmen – brugeren kunne hverken se eller rette det (udviklerafgørelse 2026-10-24).
 *
 * Gyldigheden er beregningsgrundlagets EGNE fejl, ikke opgørelsens: en rød svie/smerte-periode skal ikke åbne
 * lønnen før skaden. Den afgøres to steder fra, der begge allerede er autoritative:
 *  1. «Fejl og advarsler»-rækkerne for beregningsgrundlaget (`taf.beregningsgrundlag.*`) – de samme rækker, der
 *     spærrer downloaden. De dækker både «tomt» (fx «Månedsløn er ikke angivet», manglende beregningsperiode,
 *     ingen indkomst i perioden) og regler, der går på tværs af felterne. Den angivne løns lønudvikling bygges
 *     af lønindkomst-builderen, men under samme præfiks. Rækkerne læses FØR undertrykkelsen af følgefejl:
 *     gyldighed er ikke et spørgsmål om, hvilken linje boksen vælger at vise.
 *  2. Røde feltissues på et af de felter, sektionen skjuler. En rød værdi læses som tom og fanges normalt også
 *     af 1., men et skjult rødt felt er netop det, brugeren ikke må efterlades med – uanset om en række siger det.
 *
 * Dokumentet behøver ikke samme betingelse: et ugyldigt grundlag spærrer downloaden, så papiret komprimerer kun,
 * når grundlaget er gyldigt (`skalKomprimereIndkomstBeregning` er fortsat dokumentets og bilagets kilde).
 */

/**
 * Felterne på EO-oplysninger, som «Indtægt før skaden» skjuler ved komprimering – alt i sektionen undtagen
 * selve togglen (`IndtaegtFoerSkadenSection.tsx`). Rodnøglen dækker også rækkeceller og den angivne løns
 * lønudvikling, der ligger under én rod.
 */
const SKJULTE_BEREGNINGSGRUNDLAG_FELTER: ReadonlySet<keyof ErstatningsopgoerelseValues> = new Set<
  keyof ErstatningsopgoerelseValues
>([
  'beregnesUdFra',
  'tafBeregningsperiodeFra',
  'tafBeregningsperiodeTil',
  'fravaerPerioder',
  'uspecificeredeFerieFridage',
  'oevrigtFravaerUdenLoen',
  'oevrigeFravaersdage',
  'oevrigeFravaersdageBeskrivelse',
  'maanedsloenenUdgoer',
  'dagsloenenUdgoer',
  'angivetMaanedsloenBaseretPaa',
  'angivetDagsloenBaseretPaa',
  'angivetMaanedsloenOpreguleresFraDato',
  'angivetDagsloenOpreguleresFraDato',
  'eoAngivetLoenLoenudvikling',
]);

/** Beregningsgrundlagets rækker i «Fejl og advarsler» – også den angivne løns lønudvikling. */
const BEREGNINGSGRUNDLAG_RAEKKE_PRAEFIKS = 'taf.beregningsgrundlag.';

/** De to builderes undtagelsesrække: kan rækkerne ikke bygges, kendes grundlagets gyldighed ikke. */
const BEREGNINGSGRUNDLAG_BUILDER_UNDTAGELSER: ReadonlySet<string> = new Set([
  'eo.rowBuilder.taf-beregningsgrundlag.exception',
  'eo.rowBuilder.loenindkomst.exception',
]);

const rodnoegle = (address: FieldAddress): string => {
  const foerste = address.path[0];
  if (foerste === undefined) return address.field;
  return foerste.kind === 'property' ? foerste.name : foerste.collection;
};

const erSkjultBeregningsgrundlagFelt = (address: FieldAddress): boolean =>
  address.section === 'erstatningsopgoerelse'
  && (SKJULTE_BEREGNINGSGRUNDLAG_FELTER as ReadonlySet<string>).has(rodnoegle(address));

/**
 * Kan beregningsgrundlaget bære TAF-beregningen? Falsk, når det mangler noget, har en blokerende fejl, eller
 * når rækkerne ikke kan evalueres – i tvivl vises grundlaget hellere end at gemme en fejl af syne.
 */
export const erIndkomstBeregningsgrundlagGyldigt = (
  projection: ErstatningsopgoerelseReaderProjection,
  rowPolicy: EoRowPolicy,
): boolean => {
  const { snapshot, eoValues, stamdataValues, eoErrors, stamdataErrors } = projection;
  if (eoErrors.all.some((issue) => erSkjultBeregningsgrundlagFelt(issue.field.address))) return false;

  const rows = safeCompute(
    () => collectAllEoRows(
      stamdataValues,
      stamdataErrors,
      eoValues,
      eoErrors,
      selectBlockingLoenindkomstEntityIds(eoErrors),
      rowPolicy,
      snapshot.data?.canonicalOutput,
      snapshot.data?.pdfModel,
    ),
    'indkomstBeregningSkjulning.collectAllEoRows',
    { code: 'eo_inspektion:aggregation_failed' },
  );
  if (isErr(rows)) return false;

  return !rows.value.relevantRows.some((row) =>
    row.status === 'error'
    && (row.id.startsWith(BEREGNINGSGRUNDLAG_RAEKKE_PRAEFIKS) || BEREGNINGSGRUNDLAG_BUILDER_UNDTAGELSER.has(row.id)));
};

/**
 * Må «Indtægt før skaden» skjules lige nu? Kræver togglen og en senere opgørelse (`skalKomprimereIndkomstBeregning`)
 * OG et gyldigt grundlag. Rækkerne evalueres kun, når togglen faktisk gælder – i 1. opgørelse koster det intet.
 *
 * Svaret er tilstanden, ikke skærmen: at et grundlag, der bliver gyldigt undervejs, ikke forsvinder midt i
 * indtastningen, ejes af fladen (`useIndtaegtFoerSkadenSkjult`).
 */
export const kanIndkomstBeregningenSkjules = (
  projection: ErstatningsopgoerelseReaderProjection,
  rowPolicy: EoRowPolicy,
): boolean =>
  skalKomprimereIndkomstBeregning(projection.eoValues) && erIndkomstBeregningsgrundlagGyldigt(projection, rowPolicy);
