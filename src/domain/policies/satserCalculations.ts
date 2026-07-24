/**
 * Default-årgang for et helt frisk (ikke-committed) satser-felt.
 *
 * Reglen: brug det aktuelle år, hvis det ligger i [minYear, maxYear]. Ligger det aktuelle
 * år over intervallet (satsdata rækker endnu ikke så langt frem), falder vi tilbage til det
 * højeste år ≤ det aktuelle år, som stadig er inden for intervallet — dvs. `maxYear`. Ligger
 * det aktuelle år under intervallet (kun teoretisk), findes intet gyldigt år ≤ aktuelt, og vi
 * returnerer `undefined`, så feltet starter tomt frem for at foreslå et fremtidigt år.
 *
 * Bruges kun som initial-værdi, når der ikke findes en committed satser-sektion (ny sag) —
 * et gemt eller bevidst tomt valg overskrives aldrig af denne default (jf. usePersistedForm).
 */
export const resolveSatserDefaultAargang = (
  currentYear: number,
  minYear: number,
  maxYear: number
): number | undefined => {
  if (currentYear < minYear) return undefined;
  return Math.min(currentYear, maxYear);
};
