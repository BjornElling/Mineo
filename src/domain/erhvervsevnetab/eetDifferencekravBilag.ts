/**
 * Differencekravets bilagsvalg: hvilke af dem kan vælges – og hvis ikke, hvorfor.
 *
 * Baggrund (BB-188): fem bilagsvalg behandlede «har intet indhold» på tre måder. To valg blev
 * inaktive og umarkerede med årsagen i tooltippet, tre var altid aktive og udgik enten tavst af
 * dokumentet eller gav en «ingen»-side, og togglen «Medtag udvidet specifikation på løbende ydelser»
 * var aktiv, også når løbende-ydelsesbilaget var fravalgt og togglen derfor styrede ingenting. Et
 * afkrydset felt er et løfte om en side i papiret; brugeren kunne ikke skelne «bilaget var tomt» fra
 * «noget faldt ud», og netop den skelnen er det, gaten skal levere.
 *
 * Modellen er Erstatningsopgørelsens `eoBilagRules.ts`: ét opslag pr. valg, en discriminated union så
 * en inaktiv tilstand ikke kan konstrueres uden en årsag, og samme opslag brugt af BÅDE fladen og
 * dokumentkilden – så et gemt valg for et bilag, der ikke findes i den aktuelle beregning, ikke kan
 * love en side, dokumentet ikke har.
 *
 * «Opgørelse» er bevidst ikke med: den er ikke et valg, men differencekravets forside, som altid
 * dannes. Fladen viser den låst til (`lockedOn`), og dokumentkilden tvinger den sand.
 */
import type { EetDifferencekravComputation } from './eetDifferencekravCalculation';
import {
  resolveMerErstatningPensionsalderBilagDisabledReason,
  resolveProformaKapitaliseringBilagDisabledReason,
} from './eetDifferencekravPresentation';

export const EET_DIFFERENCEKRAV_BILAG_KEYS = [
  'loebendeYdelser',
  'kapitalisering',
  'eetEfterEal',
  'proformaKapitalisering',
  'merErstatningPensionsalder',
  'visUdvidetSpecifikationLoebendeYdelserBilag',
] as const;

export type EetDifferencekravBilagKey = (typeof EET_DIFFERENCEKRAV_BILAG_KEYS)[number];

export type EetDifferencekravBilagAvailabilityState =
  | Readonly<{ enabled: true }>
  | Readonly<{ enabled: false; disabledReason: string }>;

export type EetDifferencekravBilagAvailabilityMap =
  Readonly<Record<EetDifferencekravBilagKey, EetDifferencekravBilagAvailabilityState>>;

// Bilagsvalgenes tooltips: ÉN kort sætning uden punktum, jf. `page-component-contract.md` §10.5 punkt 3.
const INGEN_BEREGNING_REASON = 'Differencekravet kan ikke beregnes for den aktuelle sag';
const INGEN_LOEBENDE_YDELSER_REASON = 'Der er ingen løbende ydelser i sagen';
const INGEN_KAPITALISERINGER_REASON = 'Der er ingen kapitaliserede afgørelser i sagen';
const INTET_EAL_KRAV_REASON = 'Der er intet beregnet EAL-krav i sagen';
const LOEBENDE_YDELSER_BILAG_FRAVALGT_REASON = 'Bilaget «Løbende ydelser» er fravalgt';

const enabled: EetDifferencekravBilagAvailabilityState = { enabled: true };
const disabled = (disabledReason: string): EetDifferencekravBilagAvailabilityState =>
  ({ enabled: false, disabledReason });

const resolveAvailability = (disabledReason: string | null): EetDifferencekravBilagAvailabilityState =>
  disabledReason === null ? enabled : disabled(disabledReason);

export const getEetDifferencekravBilagAvailability = (params: Readonly<{
  computation: EetDifferencekravComputation | null;
  indregnMerErstatningVedForhoejetPensionsalder: boolean;
  /** Sagens gemte valg – afgør alene, om den afhængige udvidet-spec-toggle kan betjenes. */
  loebendeYdelserBilagValgt: boolean;
}>): EetDifferencekravBilagAvailabilityMap => {
  const { computation, indregnMerErstatningVedForhoejetPensionsalder, loebendeYdelserBilagValgt } = params;

  if (computation === null) {
    // Uden en beregning findes ingen af bilagene. Fladen viser i praksis ikke boksen i den tilstand,
    // men dokumentkilden bruger samme opslag og skal have et fail-closed svar.
    const alle = disabled(INGEN_BEREGNING_REASON);
    return {
      loebendeYdelser: alle,
      kapitalisering: alle,
      eetEfterEal: alle,
      proformaKapitalisering: alle,
      merErstatningPensionsalder: alle,
      visUdvidetSpecifikationLoebendeYdelserBilag: alle,
    };
  }

  const harLoebendeYdelser = (computation.loebendeComputation?.afgoerelser.length ?? 0) > 0;
  const harKapitaliseringer = (computation.kapComputation?.afgoerelser.length ?? 0) > 0;

  return {
    loebendeYdelser: harLoebendeYdelser ? enabled : disabled(INGEN_LOEBENDE_YDELSER_REASON),
    // Netop dette bilag var fundets kerne: `no-endelig-afgoerelser` filtreres bevidst væk fra fane 5,
    // så kapitaliseringsbilaget kunne stå afkrydset og aktivt i en sag helt uden kapitaliseringer og
    // derefter udgå tavst af papiret.
    kapitalisering: harKapitaliseringer ? enabled : disabled(INGEN_KAPITALISERINGER_REASON),
    // `ealComputation` kan ikke være null, når gaten slipper igennem; grenen er fail-closed og ikke
    // en tilstand, brugeren kan fremprovokere.
    eetEfterEal: computation.ealComputation !== null ? enabled : disabled(INTET_EAL_KRAV_REASON),
    proformaKapitalisering: resolveAvailability(resolveProformaKapitaliseringBilagDisabledReason(
      computation.proformaKapitalisering !== null,
      computation.resterendeLoebendeYdelser !== null
    )),
    merErstatningPensionsalder: resolveAvailability(resolveMerErstatningPensionsalderBilagDisabledReason(
      indregnMerErstatningVedForhoejetPensionsalder,
      computation.merErstatningPensionsalder !== null,
      harKapitaliseringer
    )),
    // Togglen styrer en EKSTRA side i løbende-ydelsesbilaget og kan derfor kun betjenes, når det
    // bilag både findes og er valgt. Var den aktiv uden det, ville brugeren slå en side til, som
    // dokumentet ikke kunne indeholde.
    visUdvidetSpecifikationLoebendeYdelserBilag: !harLoebendeYdelser
      ? disabled(INGEN_LOEBENDE_YDELSER_REASON)
      : loebendeYdelserBilagValgt
        ? enabled
        : disabled(LOEBENDE_YDELSER_BILAG_FRAVALGT_REASON),
  };
};
