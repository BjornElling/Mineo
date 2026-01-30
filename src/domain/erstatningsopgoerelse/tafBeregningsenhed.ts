import type { Beregningsmetode, ErstatningsopgoerelseValues, JaNej, LoenPaaHelligdage } from '../../schemas/formSchemas';
import type { DeepReadonly } from '../../types/deepReadonly';

export const TAF_BEREGNES_SOM = {
  MAANEDER: 'Måneder',
  ARBEJDSDAGE: 'Arbejdsdage',
} as const;

export type TafBeregningsenhed = (typeof TAF_BEREGNES_SOM)[keyof typeof TAF_BEREGNES_SOM];

/**
 * Central omregningsfaktor for "løse feriedage og andre fraværsdage" når TAF beregnes i måneder.
 *
 * Domæneprincip (normativt):
 * - 1 arbejdsdag svarer til 4,8% af en måned.
 *
 * Bemærk:
 * - Faktoren er udtrykt som "måneder pr. arbejdsdag".
 * - `0.048` svarer til 4,8% (dansk decimal: 4,8%).
 */
export const TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR = 0.048;

const BEREGNES_UD_FRA_DAGSLOEN: Beregningsmetode = 'Angivet dagsløn';
const ALMINDELIG_LOEN_PAA_HELLIGDAGE: LoenPaaHelligdage = 'Almindelig løn';
const JA: JaNej = 'Ja';

/**
 * Afgør om tabt arbejdsfortjeneste (TAF) beregnes i `Måneder` eller `Arbejdsdage`.
 *
 * Hvorfor denne afgrænsning er central
 * - Den påvirker fremtidige beregningsprincipper (fx hvordan "løse feriedage" og andre fraværsdage prissættes).
 * - Den skal kunne anvendes bredt i domænelogikken (beregning, debug/audit, PDF), uden afhængighed af UI-state.
 *
 * Regler (normative, implementeres præcist som angivet)
 *
 * 1) Standard: TAF beregnes i måneder.
 * 2) EOOplysninger → "Beregnes ud fra":
 *    - "Angivet dagsløn" ⇒ `Arbejdsdage`
 *    - Ellers ⇒ `Måneder` (inkl. "Beregningsperiode" og "Angivet månedsløn")
 * 3) Overstyring fra lønindkomst (har forrang uanset punkt 2):
 *    Hvis der findes blot ét ansættelsesforhold under Lønindkomst hvor
 *    - "Løn på helligdage" ≠ "Almindelig løn", eller
 *    - "Fuld løn under ferie" ≠ "Ja"
 *    så beregnes TAF som `Arbejdsdage`.
 *
 * Bemærkning (domæneprincip, til brug ved fremtidig implementering):
 * - Når TAF beregnes i måneder, indebærer det at "løse feriedage" og andre fraværsdage
 *   beregnes som 4,8% af en måned.
 *
 * VIGTIGT:
 * - Funktionen er ren (pure) og må kun afhænge af schema-valideret (committed) input.
 * - Ingen UI-draft state, ingen side effects.
 */
export type TafBeregningsenhedInput = Readonly<{
  // Input is designed for engine usage and may be DeepReadonly.
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'];
  loenindkomstAnsaettelsesforhold: ReadonlyArray<DeepReadonly<ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]>>;
  oevrigtFravaerUdenLoen: ErstatningsopgoerelseValues['oevrigtFravaerUdenLoen'];
  oevrigeFravaersdage?: ErstatningsopgoerelseValues['oevrigeFravaersdage'];
}>;

export const computeTafBeregningsenhed = (values: TafBeregningsenhedInput): TafBeregningsenhed => {
  const loenindkomstOverstyrerTilArbejdsdage = (values.loenindkomstAnsaettelsesforhold ?? []).some(
    (af) => af.loenPaaHelligdage !== ALMINDELIG_LOEN_PAA_HELLIGDAGE || af.fuldLoenUnderFerie !== JA
  );

  if (loenindkomstOverstyrerTilArbejdsdage) return TAF_BEREGNES_SOM.ARBEJDSDAGE;

  const harOevrigtFravaerUdenLoenMedAntalDage =
    values.beregnesUdFra === 'Beregningsperiode' &&
    values.oevrigtFravaerUdenLoen === JA &&
    values.oevrigeFravaersdage !== undefined &&
    values.oevrigeFravaersdage !== 0;
  if (harOevrigtFravaerUdenLoenMedAntalDage) return TAF_BEREGNES_SOM.ARBEJDSDAGE;

  if (values.beregnesUdFra === BEREGNES_UD_FRA_DAGSLOEN) return TAF_BEREGNES_SOM.ARBEJDSDAGE;

  return TAF_BEREGNES_SOM.MAANEDER;
};
