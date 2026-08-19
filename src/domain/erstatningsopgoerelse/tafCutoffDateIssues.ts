import { toAnyFieldRef } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { isISODateString, type ISODateString } from '../../types/branded';
import {
  eoTafPeriodeFraField,
  eoTafPeriodeTilField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  buildTafCutoffErrorMessage,
  resolveTafCutoffDates,
} from './validation/tafPeriodConstraints';

// TAF-cutoff mod differencekravsdato og endeligt/midlertidigt EET som STRUKTURELLE feltfejl.
//
// Reglen kunne ikke ligge på descriptoren: den afhænger af datoer, der først findes efter en domæne-udledning
// (klage-suspension, 2011-skæringsdatoen, virkningsdato-præcedens). En descriptor-validator måtte da genskabe
// den udledning inde i inputkernen, og inputkernen ville dermed komme til at kende erstatningsretlige regler.
//
// Derfor samme mønster som `manualRegulationDateIssues`: domænet udleder issuet OG binder selv den rigtige
// feltadresse, og UI'et leverer det til cellen via `collectionRuleIssue`. Reglen bliver et ægte `FieldIssue`
// og deler dermed adresse med rød ring, tooltip, navigation og blokering – ét sprog, ikke fire.
//
// Datogrundlaget kommer fra `resolveTafCutoffDates`, som er den SAMME kilde, motorens clamping bruger.
// Det er den centrale pointe: en cutoff-fejl må aldrig kunne sige noget andet end den grænse, beregningen
// faktisk anvender.

/**
 * Cutoff er INKLUSIV: en dato PÅ skæringsdatoen er allerede for sen, og sidste lovlige dato er dagen før.
 * `buildTafCutoffErrorMessage` bærer den sammenligning (`value >= cutoff`) og navngiver datoen i beskeden;
 * den kaldes derfor pr. felt frem for at få reglen skrevet i hånden endnu et sted.
 */
const cutoffIssueFor = (
  value: ISODateString | undefined,
  field: ReturnType<typeof eoTafPeriodeFraField.bind>,
  cutoffs: ReturnType<typeof resolveTafCutoffDates>
): readonly FieldIssue[] => {
  if (value === undefined) return [];
  const message = buildTafCutoffErrorMessage({ value, ...cutoffs });
  if (message === undefined) return [];
  return [Object.freeze({
    kind: 'field' as const,
    code: `${field.descriptor.id}.tafCutoff`,
    severity: 'error' as const,
    field: toAnyFieldRef(field),
    reason: 'rule' as const,
    message,
  })];
};

/**
 * Udleder cutoff-feltfejlene for alle TAF-perioderækker.
 *
 * BEGGE datoer prøves mod cutoffen, ikke kun til-datoen. En cutoff er en øvre grænse, og en fra-dato efter
 * skæringsdatoen er lige så ulovlig som en til-dato – perioden ligger da HELT efter grænsen. Markeres kun
 * til-datoen i det tilfælde, peger programmet på det felt, brugeren ikke behøver at rette. Hver dato bærer
 * altså sin egen fejl, og en periode, der overskrider grænsen i begge ender, markeres i begge ender.
 *
 * Kravet er tavst, når `kravPaaTabtArbejdsfortjeneste` ikke er 'Ja': rækkerne indgår da ikke i beregningen,
 * og en rød markering på et felt uden virkning ville hverken kunne retfærdiggøres eller ryddes.
 */
export const collectTafCutoffDateIssues = (
  values: ErstatningsopgoerelseValues,
  stamdata: Pick<StamdataValues, 'skadedato'>
): readonly FieldIssue[] => {
  if (values.kravPaaTabtArbejdsfortjeneste !== 'Ja') return [];

  const cutoffs = resolveTafCutoffDates({
    differencekravDato: isISODateString(values.differencekravDato) ? values.differencekravDato : undefined,
    endeligtEETAfgorelse: values.endeligtEETAfgorelse,
    endeligEETVirkningsdato: isISODateString(values.endeligEETVirkningsdato)
      ? values.endeligEETVirkningsdato : undefined,
    endeligEETAfgoerelseDato: isISODateString(values.endeligEETAfgoerelseDato)
      ? values.endeligEETAfgoerelseDato : undefined,
    midlertidigtEETAfgorelse: values.midlertidigtEETAfgorelse,
    midlertidigEETVirkningsdato: isISODateString(values.midlertidigEETVirkningsdato)
      ? values.midlertidigEETVirkningsdato : undefined,
    midlertidigEETAfgoerelseDato: isISODateString(values.midlertidigEETAfgoerelseDato)
      ? values.midlertidigEETAfgoerelseDato : undefined,
    verserendeKlageEet: values.verserendeKlageEet,
    skadedatoISO: stamdata.skadedato,
  });

  if (
    cutoffs.differencekravDato === undefined
    && cutoffs.endeligEETDato === undefined
    && cutoffs.midlertidigEETDato === undefined
  ) return [];

  return values.tafPerioder.flatMap((row) => [
    ...cutoffIssueFor(
      isISODateString(row.fra) ? row.fra : undefined,
      eoTafPeriodeFraField.bind(row.id),
      cutoffs
    ),
    ...cutoffIssueFor(
      isISODateString(row.til) ? row.til : undefined,
      eoTafPeriodeTilField.bind(row.id),
      cutoffs
    ),
  ]);
};
