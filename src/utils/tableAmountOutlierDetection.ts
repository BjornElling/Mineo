/**
 * Rimelighedskontrol af beløbsrækker – ÉN kerne for løntabellerne og offentlige ydelser (BB-297,
 * udviklerafgørelse 2026-10-19).
 *
 * **Reglen.** En række, hvis beløb er over ti gange MEDIANEN af de øvrige rækker i samme gruppe, får en gul,
 * ikke-blokerende advarsel. Typisk et nul for meget: 300.000 kr. i en måned blandt måneder à 30.000 kr.
 *
 * **Kun «større», aldrig «mindre».** De almindelige undtagelser er små beløb – en efterregulering på 1.000 kr., en
 * løn for to dage, en deltidsmåned, en tilbagebetaling – og de ligner præcis et nul for lidt. En regel for «ti gange
 * mindre» ville derfor give falske advarsler i almindelige sager; den er bevidst fravalgt.
 *
 * **Værnene mod falske advarsler:**
 * - **Gruppen** er kaldets: et ansættelsesforhold eller en ydelsestype i én periode (beregningsperioden for sig,
 *   erstatningsperioden for sig), så en lav løn efter skaden ikke får lønnen før skaden til at se høj ud.
 * - **Medianen**, ikke gennemsnittet, så én høj række ikke trækker sammenligningsgrundlaget op – og så to høje
 *   rækker blandt mange normale stadig ses hver for sig.
 * - **Mindst tre andre rækker** at sammenligne med; færre er ikke et mønster. Kun rækker med et positivt beløb
 *   tæller – en måned på 0 kr. eller en tilbagebetaling siger intet om det normale niveau.
 * - **Sammenlignelig enhed** er kaldets: en månedsrækkes samlede beløb, eller beløb pr. kalenderdag for uge- og
 *   datorækker, så et kvartal ikke ligner en tastefejl ved siden af måneder. Korte datorækker (under en uge)
 *   vurderes hverken eller indgår i medianen – en slutløn for to dage med feriepenge ville ellers ligne 15 gange
 *   dagslønnen.
 */

export const AMOUNT_OUTLIER_FACTOR = 10;
export const AMOUNT_OUTLIER_MIN_OTHER_ROWS = 3;

export type AmountOutlierCandidate = Readonly<{
  id: string;
  /** Rækkens gruppe; der sammenlignes kun inden for samme gruppe. */
  group: string;
  /** Den sammenlignelige værdi (fx beløb pr. kalenderdag). Kun endelige, positive værdier vurderes og tæller med. */
  value: number;
}>;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  // Heltalsindekset uden afrundingsfunktion (numerikreglen forbyder direkte afrunding, også af et indeks).
  const middle = (sorted.length - (sorted.length % 2)) / 2;
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

/** Id'erne på de rækker, hvis værdi er over `AMOUNT_OUTLIER_FACTOR` gange medianen af gruppens øvrige rækker. */
export const findAmountOutliers = (candidates: readonly AmountOutlierCandidate[]): ReadonlySet<string> => {
  const valid = candidates.filter((candidate) => Number.isFinite(candidate.value) && candidate.value > 0);
  const outliers = new Set<string>();
  for (const candidate of valid) {
    const others = valid
      .filter((other) => other.group === candidate.group && other.id !== candidate.id)
      .map((other) => other.value);
    if (others.length < AMOUNT_OUTLIER_MIN_OTHER_ROWS) continue;
    const reference = median(others);
    if (candidate.value > AMOUNT_OUTLIER_FACTOR * reference) outliers.add(candidate.id);
  }
  return outliers;
};
