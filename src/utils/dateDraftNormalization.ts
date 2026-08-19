const ASCII_DIGIT_REGEX = /^[0-9]$/;
const UNICODE_ALPHANUMERIC_REGEX = /[\p{L}\p{N}]/u;

const isAsciiDigit = (char: string): boolean => ASCII_DIGIT_REGEX.test(char);

const isUnicodeAlphanumeric = (char: string): boolean => UNICODE_ALPHANUMERIC_REGEX.test(char);

export const isDateDraftSeparatorChar = (char: string): boolean => {
  if (char === '') return false;
  return !isUnicodeAlphanumeric(char);
};

export const normalizeDateDraftSeparators = (draft: string): string => {
  return draft
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-');
};

export const normalizeDateDraftOnCommit = (draft: string): string => draft.trim();

/**
 * Om en dato-draft må EKSISTERE under indtastning (`input-field-behavior-contract.md` §2.1).
 *
 * Reglen har tre dele, og de tre er bevidst forskellige – de skal ikke ensrettes:
 *
 * 1. **Ciffer-lofter pr. segment.** Dag og måned må have højst to cifre, år højst fire
 *    (`segmentMaxLengths = [2, 2, 4]`). Det tredje dag-/månedsciffer og det femte årsciffer kommer
 *    aldrig ind i feltet.
 * 2. **Gentagne separatorer afvises efter den første.** `12-2----------` er fejlformen: den anden
 *    separator på stribe blokeres, så en serie bindestreger ikke kan hobe sig op i draften.
 * 3. **Separatorer FØR første tal ignoreres.** `-12` og `---12-2-2026` er lovlige at taste. De
 *    åbner ikke et segment; de springes bare over.
 *
 * **Hvorfor ikke bare rulle den gamle regex tilbage.** Indtil `5c864afe` (2026-04-23) var reglen en
 * segment-regex, som håndhævede pkt. 1 og 2 korrekt. Den blev udskiftet, og pkt. 2 forsvandt med den –
 * uden at nogen test blev rød, fordi ingen test nogensinde dækkede gentagne separatorer. Men den gamle
 * regex tillod kun separatorsættet `[.,/\- ]`, og kontrakten kræver nu ETHVERT ikke-alfanumerisk tegn:
 * `1,1@28` skal kunne tastes og blive `01-01-2028`. Et verbatim tilbagerul ville derfor genindføre én
 * fejl for at rette en anden. To yderligere forskelle er MÅLT frem for antaget: den gamle regex
 * tillod `-12` (den afviste altså ikke ledende separatorer, jf. pkt. 3), og den blokerede
 * `12-2-2026-`, selv om en trailing separator skal kunne tastes og først afvises ved commit.
 *
 * **Paste følger en ANDEN vej, med vilje.** §2.1 siger, at gentagne bindestreger «afvises efter den
 * første; paste fortsætter derfor gennem dem». Tastning BLOKERER den anden separator; paste SPRINGER
 * den over og fortsætter med resten (§1.2a pkt. 3: et ulovligt tegn må aldrig afbryde pasten).
 * `normalizeDatePaste` ejer den vej – kald ikke denne funktion derfra.
 */
export const isDateLikeDraftAllowed = (
  draft: string,
  segmentMaxLengths: readonly number[]
): boolean => {
  let segmentIndex = 0;
  let currentSegmentLength = 0;
  let previousWasSeparator = false;
  let hasSeenDigit = false;

  for (const char of Array.from(draft)) {
    if (isAsciiDigit(char)) {
      if (segmentIndex >= segmentMaxLengths.length) return false;
      currentSegmentLength += 1;
      if (currentSegmentLength > segmentMaxLengths[segmentIndex]!) return false;
      previousWasSeparator = false;
      hasSeenDigit = true;
      continue;
    }

    if (isDateDraftSeparatorChar(char)) {
      // Pkt. 3: før det første tal er separatoren betydningsløs og åbner ikke et segment.
      if (!hasSeenDigit) continue;
      // Pkt. 2: den anden separator på stribe afvises.
      if (previousWasSeparator) return false;
      segmentIndex += 1;
      currentSegmentLength = 0;
      previousWasSeparator = true;
      continue;
    }

    return false;
  }

  return true;
};
