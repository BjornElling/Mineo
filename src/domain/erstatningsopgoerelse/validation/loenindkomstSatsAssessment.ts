import type { LoenindkomstAnsaettelsesforhold } from '../../../schemas/formSchemas';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import { hasIndtastetLoenoplysninger } from '../helpers/loenoplysningerInput';

/**
 * ÉN sats-vurdering for et lønindkomst-ansættelsesforhold.
 *
 * Tidligere blev de samme satser vurderet af to aktive regelsæt: ét producerede de røde feltfejl i
 * brugerfladen, og ét gatede beregning og dokumentdownload. Dette modul er den ENE kilde, som både
 * feltvisningen, rækken i «Fejl og advarsler» og validatoren aftager; ét regelsæt kan ikke drifte fra sig selv.
 *
 * Feriegodtgørelsen er påkrævet, når kortet har lønoplysninger i procent-tilstand – UANSET beregningsmåde og
 * reguleringsform. Lønrækkernes tillæg, fradraget for indtægt efter skaden og beregningsgrundlaget læser feltet
 * i alle former, og en lønmodtager får altid enten feriegodtgørelse eller ferietillæg
 * (`feriepenge-begreber-contract.md` regel 1). Før krævedes feltet kun ved «Overenskomst» og «Manuelt
 * angivet», og et tomt felt fjernede tavst 12,5 % af lønnen fra kravet ved de øvrige former (BB-274).
 *
 * Et TOMT felt er en manglende indtastning, ikke en forkert: det giver ingen rød ring – brugeren har ikke
 * skrevet noget – men en blokerende linje i «Fejl og advarsler» (udviklerafgørelse 2026-10-06, jf.
 * `error-contract.md` §`missing`). En faktisk indtastet værdi under 12 % er rød og blokerer; over 20 % får den
 * en gul, ikke-blokerende ring (BB-286 – 12 % er sjældent, men lovligt).
 *
 * AFGRÆNSNING mod de LÅSTE satser. Fritvalg, SH/SO, Store Bededagstillæg og arbejdsgiverpension vurderes
 * IKKE her: domæneprojektionen erstatter deres eventuelle historiske inputslot med den aktuelle
 * overenskomst-/lovsats, før UI, beregning og dokumenter læser modellen.
 */

/** Det ene satsfelt, vurderingen kan udpege. Feltnavnet er nøglen under ansættelsesforholdet. */
export type SatsField = 'feriePct';

/** Feltets label, som den vises i brugerfladen. */
export const SATS_FIELD_LABELS: Readonly<Record<SatsField, string>> = Object.freeze({
  feriePct: 'Feriegodtgørelse/-tillæg',
});

/** Over denne sats får feriegodtgørelsen en gul advarsel (udviklerafgørelse 2026-10-06, BB-286). */
export const FERIE_PCT_ADVARSELSGRAENSE = 20;

/**
 * Ét satsfund.
 * - `missing`: tomt, men påkrævet. Ingen ring; blokerende linje i boksen.
 * - `deviation`: en indtastet værdi under 12 %. Rød ring; blokerer.
 * - `unusual`: en indtastet værdi over 20 %. Gul ring; blokerer ikke.
 */
export type SatsFinding = Readonly<{
  field: SatsField;
  label: string;
  message: string;
  kind: 'missing' | 'deviation' | 'unusual';
  severity: 'error' | 'warning';
}>;

type FeriePctRequirementInput = Pick<LoenindkomstAnsaettelsesforhold, 'tillaegAngivesSom' | 'indtaegtsoplysningerTableData'>;

/**
 * Ét sandt sted for «skal feriegodtgørelsen være udfyldt?». Beløb-tilstand angiver tillæggene som beløb i
 * tabellen, så det skjulte procentfelt hverken markeres eller blokerer dér.
 */
export const isFeriePctPaakraevet = (af: FeriePctRequirementInput): boolean =>
  af.tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB
  && hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []);

export const FERIE_PCT_MANGLER_BESKED = `${SATS_FIELD_LABELS.feriePct} er ikke udfyldt`;

/**
 * Vurderer satserne for ét ansættelsesforhold. Højst ét fund pr. felt (§1.8).
 *
 * `feriePctHarFeltfejl`: feltet har allerede sin egen røde fejl (fx en grænse som `150`). Readeren giver da
 * feltet som tomt til alle læsere, og vurderingen må ikke kalde en ugyldig indtastning for «ikke udfyldt».
 */
export const assessLoenindkomstSatser = (
  af: LoenindkomstAnsaettelsesforhold,
  options: Readonly<{ feriePctHarFeltfejl?: boolean }> = {}
): readonly SatsFinding[] => {
  if (af.tillaegAngivesSom === TILLAEG_ANGIVES_SOM.BELOEB) return [];

  const finding = (message: string, kind: SatsFinding['kind']): SatsFinding =>
    Object.freeze({
      field: 'feriePct' as const,
      label: SATS_FIELD_LABELS.feriePct,
      message,
      kind,
      severity: kind === 'unusual' ? 'warning' as const : 'error' as const,
    });

  if (af.feriePct === undefined) {
    if (options.feriePctHarFeltfejl === true) return [];
    return isFeriePctPaakraevet(af) ? Object.freeze([finding(FERIE_PCT_MANGLER_BESKED, 'missing')]) : [];
  }

  if (af.feriePct < 12) {
    return Object.freeze([finding(
      // Med løn under ferie får lønmodtageren FERIETILLÆG, ikke feriegodtgørelse
      // (`feriepenge-begreber-contract.md` regel 2). Det korrekte er den beregningstekniske omregning
      // (regel 3): tillægget OPGØRES som feriegodtgørelse med 12,5 %/15 %.
      af.fuldLoenUnderFerie === 'Ja'
        ? 'Ved løn under ferie opgøres ferietillægget beregningsteknisk som feriegodtgørelse (12,5 %, eller 15 % ved ret til 6. ferieuge)'
        : 'Feriegodtgørelse udgør typisk 12,5 %, men 15 % ved ret til 6. ferieuge',
      'deviation'
    )]);
  }

  if (af.feriePct > FERIE_PCT_ADVARSELSGRAENSE) {
    return Object.freeze([finding(
      `${SATS_FIELD_LABELS.feriePct} over ${String(FERIE_PCT_ADVARSELSGRAENSE)} % er usædvanligt – kontrollér satsen`,
      'unusual'
    )]);
  }

  return [];
};
