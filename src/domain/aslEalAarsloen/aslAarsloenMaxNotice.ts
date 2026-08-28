// Feltoplysningen når ASL-årslønnen står præcis på skadesårets maksimum (BB-124).
//
// **Ét sted, fordi to flader viser den samme situation.** `faellesAarsloen.aslAarsloen` og `.ealAarsloen`
// deles af Erhvervsevnetab og Forsørgertab, og begge flader udledte deres egen tekst for samme trigger:
//
//   Forsørgertab:    «Når årsløn efter ASL svarer til maksimum, skal den faktiske årsløn indtastes.»
//   Erhvervsevnetab: «Årsløn efter ASL er sat til max-årslønnen»
//
// Den ene konstaterer, den anden beder om en handling. En bruger, der mødte begge i samme sag, måtte tro,
// at der var tale om to forskellige forhold – og halvdelen af brugerne fik den tekst, der ikke siger, hvad
// man skal gøre. Den handlingsanvisende form er valgt, fordi den hjælper.
//
// Teksten bor i `aslEalAarsloen`-domænet frem for i `erhvervsevnetab/eetFieldWarnings.ts`, hvor den lå: den
// hører til det DELTE årslønsfelt, ikke til en af de to flader, der viser det. Lå den hos den ene flade,
// ville den anden fortsat læse på tværs af et domæne, den ikke hører til – og den næste flade, der viser
// feltet, ville lige så let skrive sin egen tredje variant.

/**
 * Den kanoniske, ikke-blokerende oplysning. Ikke-blokerende med vilje: den faktiske EAL-årsløn KAN
 * legitimt være præcis ASL-maksimum, og en blokering ville da forhindre en korrekt beregning.
 */
export const ASL_AARSLOEN_MAX_NOTICE =
  'Når årsløn efter ASL svarer til maksimum, skal den faktiske årsløn indtastes.';
