import {
  FERIE_SATS_FELTNAVN,
  ferieYdelseNavn,
  resolveFerieYdelse,
  resolveHoejFeriePctAdvarsel,
} from '../../loen/feriePctYdelse';
export { FERIE_PCT_ADVARSELSGRAENSE } from '../../loen/feriePctYdelse';
import { erFeriePctPaakraevet, FERIE_PCT_MANGLER_BESKED } from '../../loen/feriePctKrav';
import type { ErstatningsopgoerelseValues, LoenindkomstAnsaettelsesforhold } from '../../../schemas/formSchemas';
import { formatPercent } from '../../../utils/formatUtils';
import { erFuldLoenUnderFerieRelevant } from '../helpers/eoInputRelevance';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';

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
 * `error-contract.md` §`missing`). En indtastet værdi vurderes af {@link vurderEoFeriesats}.
 *
 * AFGRÆNSNING mod de LÅSTE satser. Fritvalg, SH/SO, Store Bededagstillæg og arbejdsgiverpension vurderes
 * IKKE her: domæneprojektionen erstatter deres eventuelle historiske inputslot med den aktuelle
 * overenskomst-/lovsats, før UI, beregning og dokumenter læser modellen.
 */

/** Det ene satsfelt, vurderingen kan udpege. Feltnavnet er nøglen under ansættelsesforholdet. */
export type SatsField = 'feriePct';

/** Feltets label, som den vises i brugerfladen. */
export const SATS_FIELD_LABELS: Readonly<Record<SatsField, string>> = Object.freeze({
  feriePct: FERIE_SATS_FELTNAVN,
});

/**
 * Ét satsfund.
 * - `missing`: tomt, men påkrævet. Ingen ring; blokerende linje i boksen.
 * - `deviation`: et ferietillæg (under 12 %), selv om brugeren har svaret Nej til fuld løn under ferie. Rød ring; blokerer.
 * - `unusual`: et ferietillæg ved løn under ferie, eller en sats over 20 %. Gul ring; blokerer ikke.
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
 * «Skal feriegodtgørelsen være udfyldt?» for ét ansættelsesforhold – den fælles regel med Årsløn
 * (`domain/loen/feriePctKrav.ts`). Beløb-tilstand angiver tillæggene som beløb i tabellen, så det skjulte
 * procentfelt hverken markeres eller blokerer dér. EO opgør altid satsen som feriegodtgørelse (regel 3).
 */
export const isFeriePctPaakraevet = (af: FeriePctRequirementInput): boolean =>
  erFeriePctPaakraevet({
    satserErIBrug: af.tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB,
    loenraekker: af.indtaegtsoplysningerTableData ?? [],
    satsenOpgoeresSomFeriegodtgoerelse: true,
  });

export { FERIE_PCT_MANGLER_BESKED };

/** Den indtastede satsfejl eller -advarsel – uden felt; ansættelsesforholdet og den manuelle tabel adresserer den selv. */
export type EoFeriesatsFund = Readonly<{ kind: 'deviation' | 'unusual'; message: string }>;

/**
 * Vurderer en INDTASTET feriesats i erstatningsopgørelsen (`feriepenge-begreber-contract.md` §2b, udviklerafgørelse
 * 2026-11-04). Deles af ansættelsesforholdets satsfelt og den manuelle lønudviklingstabels kolonne, som er samme sats
 * fra en senere dato.
 *
 * Erstatningsopgørelsen opgør TAF med en tvungen både-og: også ved løn under ferie skal satsen beregningsteknisk
 * angives som feriegodtgørelse (regel 3). En sats under 12 % er et FERIETILLÆG og er derfor næsten altid en fejl –
 * men ikke altid, så den advarer kun (gul). Har brugeren derimod svaret Nej til fuld løn under ferie, siger satsen og
 * svaret hinanden imod: uden løn under ferie og med kun et ferietillæg mangler ydelsen reelt, og det er rødt.
 * Satser over 25 % er feltets egen røde grænse (descriptoren), så de når ikke hertil.
 *
 * @param fuldLoenUnderFerie Svaret, NÅR spørgsmålet stilles (beregningsperiode) – ellers `undefined`.
 */
export const vurderEoFeriesats = (
  feriePct: number,
  fuldLoenUnderFerie: 'Ja' | 'Nej' | undefined,
): EoFeriesatsFund | undefined => {
  if (resolveFerieYdelse(feriePct) === 'ferietillaeg') {
    const sats = formatPercent(feriePct);
    return fuldLoenUnderFerie === 'Nej'
      ? {
        kind: 'deviation',
        message: `${ferieYdelseNavn(feriePct)} på ${sats} forudsætter løn under ferie, men «Fuld løn under ferie» er Nej. `
          + 'Uden løn under ferie angives feriegodtgørelsen: typisk 12,5 %, eller 15 % ved ret til 6. ferieuge',
      }
      : {
        kind: 'unusual',
        message: `${ferieYdelseNavn(feriePct)} på ${sats}: i erstatningsopgørelsen angives løn under ferie normalt `
          + 'beregningsteknisk som feriegodtgørelse – 12,5 %, eller 15 % ved ret til 6. ferieuge, plus et eventuelt '
          + 'forhøjet ferietillæg',
      };
  }
  const hoejSatsAdvarsel = resolveHoejFeriePctAdvarsel(feriePct);
  return hoejSatsAdvarsel === undefined ? undefined : { kind: 'unusual', message: hoejSatsAdvarsel };
};

/** Svaret på «Fuld løn under ferie», når spørgsmålet stilles – ellers `undefined` (et skjult valg vurderes ikke). */
export const resolveEoFuldLoenUnderFerieSvar = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'fuldLoenUnderFerie'>,
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'],
): 'Ja' | 'Nej' | undefined =>
  erFuldLoenUnderFerieRelevant({ beregnesUdFra }) ? af.fuldLoenUnderFerie : undefined;

/**
 * Vurderer satserne for ét ansættelsesforhold. Højst ét fund pr. felt (§1.8).
 *
 * `beregnesUdFra`: «Fuld løn under ferie» stilles kun ved beregningsperiode; et skjult valg læses som tomværdien
 * «Nej» og må ikke gøre et ferietillæg rødt.
 * `feriePctHarFeltfejl`: feltet har allerede sin egen røde fejl (fx over 25 %). Readeren giver da feltet som tomt
 * til alle læsere, og vurderingen må ikke kalde en ugyldig indtastning for «ikke udfyldt».
 */
export const assessLoenindkomstSatser = (
  af: LoenindkomstAnsaettelsesforhold,
  options: Readonly<{
    beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'];
    feriePctHarFeltfejl?: boolean;
  }>,
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

  const fund = vurderEoFeriesats(af.feriePct, resolveEoFuldLoenUnderFerieSvar(af, options.beregnesUdFra));
  return fund === undefined ? [] : Object.freeze([finding(fund.message, fund.kind)]);
};
