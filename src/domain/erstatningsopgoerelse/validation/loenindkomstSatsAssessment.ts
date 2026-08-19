import type { ErstatningsopgoerelseValues, LoenindkomstAnsaettelsesforhold } from '../../../schemas/formSchemas';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import { hasIndtastetLoenoplysninger } from '../helpers/loenoplysningerInput';

/**
 * ÉN sats-vurdering for et lønindkomst-ansættelsesforhold.
 *
 * Tidligere blev de samme satser vurderet af to aktive regelsæt: ét producerede de røde feltfejl i
 * brugerfladen, og ét gatede beregning og dokumentdownload. Reglerne var faktisk forskellige – feltvejen
 * krævede feriegodtgørelse ved enhver reguleringsform, gatevejen kun ved `Overenskomst` og
 * `Manuelt angivet`. Et felt kunne derfor stå rødt, mens beregningen kørte videre uden at betragte værdien
 * som påkrævet. Dette modul er nu den ENE kilde, som både feltvisningen og gaten aftager; ét
 * regelsæt kan ikke drifte fra sig selv.
 *
 * Feriegodtgørelsens relevans følger den godkendte relevansmatrix: den er kun påkrævet, når den valgte
 * reguleringsform faktisk læser den (`Overenskomst`/`Manuelt angivet`). Ved `Statistik`, `KRL satstabel`,
 * `KL-lønaftaler`, `Manuel procentsats` og `Ingen` er et tomt felt hverken rødt eller blokerende. En tom
 * reguleringsform blokerer fortsat som et manglende reguleringsvalg – det er dét valg, der markeres og
 * blokerer, ikke satsen. Relevansen afgøres af den AKTUELT valgte form, så et skift begge veje slår
 * markeringen til og fra i samme øjeblik.
 *
 * AFGRÆNSNING mod de LÅSTE satser. Fritvalg, SH/SO, Store Bededagstillæg og arbejdsgiverpension vurderes
 * IKKE for afvigelse: domæneprojektionen erstatter deres eventuelle historiske inputslot med den
 * aktuelle overenskomst-/lovsats, før UI, beregning og dokumenter læser modellen. En afvigelsesregel på
 * det rå slot ville derfor validere en værdi, consumeren ikke bruger.
 * Feriegodtgørelsen er derimod brugerens eget felt og har derfor både et relevans- og et vejledningsben.
 */

/** Det ene satsfelt, vurderingen kan udpege. Feltnavnet er nøglen under ansættelsesforholdet. */
export type SatsField = 'feriePct';

/** Feltets label, som den vises i brugerfladen – bruges i "Fejl og advarsler"-boksens egen besked. */
export const SATS_FIELD_LABELS: Readonly<Record<SatsField, string>> = Object.freeze({
  feriePct: 'Feriegodtgørelse/-tillæg',
});

/**
 * Én satsfejl. `kind` skelner "ikke udfyldt" fra "afvigelse", så boksens besked ikke påstår, at en tom
 * værdi er forkert indtastet.
 */
export type SatsFinding = Readonly<{
  field: SatsField;
  label: string;
  message: string;
  kind: 'missing' | 'deviation';
}>;

export type SatsAssessmentContext = Readonly<{
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'];
}>;

type FeriePctRelevanceInput = Pick<
  LoenindkomstAnsaettelsesforhold,
  'tillaegAngivesSom' | 'loenudviklingBeregningsgrundlag' | 'indtaegtsoplysningerTableData'
>;

/**
 * Ét sandt sted for "læser denne reguleringsform feriegodtgørelses-/tillægsprocenten?".
 *
 * Kun `Overenskomst` og `Manuelt angivet` opregulerer ud fra de indtastede satser; de øvrige former henter
 * lønudviklingen fra en satstabel eller en angivet procent og rører ikke feltet. Beløb-tilstand angiver
 * basis-satserne i første tabelrække, så de skjulte top-satsfelter må ikke kunne markere eller blokere der.
 *
 * Prædikatet er delt af feltmarkeringen, række-evalueringen og `erstatningsopgoerelseValidator`. Drev de
 * betingelsen hver for sig, kunne download blive blokeret uden en synlig fejl i boksen – eller et felt stå
 * rødt, uden at noget faktisk var blokeret.
 */
export const isFeriePctRelevant = (
  af: FeriePctRelevanceInput,
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra']
): boolean => {
  const grundlag = af.loenudviklingBeregningsgrundlag;
  return (
    af.tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB
    && beregnesUdFra === 'Beregningsperiode'
    && (grundlag === 'Overenskomst' || grundlag === 'Manuelt angivet')
    && hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? [])
  );
};

/**
 * Vurderer satserne for ét ansættelsesforhold. Højst ét fund pr. felt (§1.8); rækkefølgen er den
 * deterministiske prioritet, gaten bruger, når den skal vælge ÉN besked til boksen.
 */
export const assessLoenindkomstSatser = (
  af: LoenindkomstAnsaettelsesforhold,
  ctx: SatsAssessmentContext
): readonly SatsFinding[] => {
  if (af.tillaegAngivesSom === TILLAEG_ANGIVES_SOM.BELOEB) return [];

  const finding = (message: string, kind: SatsFinding['kind']): SatsFinding =>
    Object.freeze({ field: 'feriePct' as const, label: SATS_FIELD_LABELS.feriePct, message, kind });

  if (af.feriePct === undefined) {
    return isFeriePctRelevant(af, ctx.beregnesUdFra)
      ? Object.freeze([finding('Feriegodtgørelse/-tillæg skal udfyldes', 'missing')])
      : [];
  }

  if (af.feriePct < 12) {
    return Object.freeze([finding(
      af.fuldLoenUnderFerie === 'Ja'
        ? 'Løn under ferie beregnes som feriegodtgørelse (12,5 % eller 15 % ved ret til 6. ferieuge)'
        : 'Feriegodtgørelse udgør typisk 12,5 %, men 15 % ved ret til 6. ferieuge',
      'deviation'
    )]);
  }

  return [];
};

/**
 * Én blokerende sats-fejl til "Fejl og advarsler"-boksen: feltets label + en besked, der kan læses UDEN
 * feltets kontekst. Driver `loenindkomst.<af>.satserSkadestidspunkt`-rækken i den autoritative
 * række-evaluerings-motor (jf. B9), hvis `error`-rækker gater produktions-download.
 *
 * Blokeringen udledes af samme vurdering som feltmarkeringen ovenfor. Var det to vurderinger, kunne
 * download blive blokeret uden en synlig besked i boksen – eller et felt stå rødt uden at blokere noget.
 */
export type SatserError = Readonly<{
  field: string;
  message: string;
  kind: 'missing' | 'deviation';
}>;

export const resolveSatserErrorField = (
  af: LoenindkomstAnsaettelsesforhold,
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra']
): SatserError | null => {
  const finding = assessLoenindkomstSatser(af, { beregnesUdFra })[0];
  if (finding === undefined) return null;
  return Object.freeze({
    field: finding.label,
    message: finding.kind === 'missing'
      ? `${finding.label} er ikke udfyldt`
      : `Forkert værdi indtastet i ${finding.label}`,
    kind: finding.kind,
  });
};
