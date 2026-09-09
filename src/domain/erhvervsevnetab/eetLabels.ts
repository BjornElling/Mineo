/**
 * Erhvervsevnetabs delte brugervendte navne.
 *
 * Ét navn pr. størrelse, brugt af alle kanaler. Baggrunden er BB-191: mer-erstatningen ved forhøjet
 * folkepensionsalder hed fire ting i samme sag – ét navn i bilagsvalget, et andet i togglen, et
 * tredje i boksens overskrift og et fjerde i dokumentets sektion og bilagstitel. Brugeren skulle selv
 * koble fire navne til én størrelse på tværs af to bokse og et papir. Udvikleren valgte
 * «Forhøjet pensionsalder» som det ene navn (2026-09-09).
 *
 * Prøven ved en senere ændring: for hvert bilagsvalg skal de FIRE navne (afkrydsningsfelt ·
 * skærmoverskrift · dokumentsektion · bilagstitel) være samme streng – ikke fire strenge, der ligner
 * hinanden. Derfor er navnet en konstant og ikke en litteral pr. kaldssted.
 */

/** Fradrag 4's ene navn: bilagsvalg, boks, specifikation, dokumentsektion og bilagstitel. */
export const FORHOEJET_PENSIONSALDER_LABEL = 'Forhøjet pensionsalder';

/** Beregnings-togglen på differencekrav-fanen, dannet af samme navn. */
export const INDREGN_FORHOEJET_PENSIONSALDER_LABEL = `Indregn ${FORHOEJET_PENSIONSALDER_LABEL.toLowerCase()}`;
