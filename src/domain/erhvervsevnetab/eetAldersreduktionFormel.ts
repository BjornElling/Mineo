// Aldersreduktionens etiket i mellemregningerne.
//
// **Ved 0 % er der ingen formel (BB-129).** Funktionen returnerede før `'0 ='`, som indsat i skabelonen
// «Aldersreduktion {formel}» blev til «Aldersreduktion 0 =» – ikke et regnestykke, men en påstand om et
// lighedstegn uden venstreside, hvor 45-års-tilfældet giver «Aldersreduktion (45 - 29) =». Ved nul er der
// intet at regne, så rækken hedder blot «Aldersreduktion».
//
// Hele ETIKETTEN bygges her, ikke kun formeldelen. Præfikset var hardkodet på alle fire kaldssteder
// (Forsørgertab og EET efter EAL, hver med skærm og dokument), så en helper, der kun leverede formlen,
// ikke kunne fjerne lighedstegnet uden at fire filer rettede deres skabelon i takt.

/** Alderen hvor reduktionen begynder; under den er reduktionen 0 % og formlen tom. */
const ALDERSREDUKTION_START_AAR = 29;
/** Alderen hvor det andet, dobbelte led kommer til. */
const ALDERSREDUKTION_EKSTRA_AAR = 54;
const ALDERSREDUKTION_MAX_PCT = 70;

/**
 * Formeldelen alene: «(45 - 29)», «(60 - 29) + (60 - 54) x 2 (max 70 %)» – eller `undefined`, når der ikke
 * er nogen reduktion at forklare.
 */
const buildFormel = (alderVedSkade: number): string | undefined => {
  if (alderVedSkade <= ALDERSREDUKTION_START_AAR) return undefined;
  if (alderVedSkade > ALDERSREDUKTION_EKSTRA_AAR) {
    const uncappedPct =
      (alderVedSkade - ALDERSREDUKTION_START_AAR)
      + (alderVedSkade - ALDERSREDUKTION_EKSTRA_AAR) * 2;
    const suffix = uncappedPct > ALDERSREDUKTION_MAX_PCT ? ` (max ${ALDERSREDUKTION_MAX_PCT} %)` : '';
    return `(${alderVedSkade} - ${ALDERSREDUKTION_START_AAR}) + (${alderVedSkade} - ${ALDERSREDUKTION_EKSTRA_AAR}) x 2${suffix}`;
  }
  return `(${alderVedSkade} - ${ALDERSREDUKTION_START_AAR})`;
};

/**
 * Den fulde etiket til aldersreduktionsrækken: «Aldersreduktion (45 - 29) =» – eller blot
 * «Aldersreduktion», når reduktionen er nul og der ingen formel er at vise.
 */
export const buildAldersreduktionEtiket = (alderVedSkade: number): string => {
  const formel = buildFormel(alderVedSkade);
  return formel === undefined ? 'Aldersreduktion' : `Aldersreduktion ${formel} =`;
};
