/**
 * Erhvervsevnetabs delte brugervendte navne.
 *
 * Ét navn pr. størrelse, brugt af alle kanaler, så brugeren ikke selv skal koble flere navne til én
 * størrelse på tværs af bokse og papir. Mer-erstatningen ved forhøjet folkepensionsalder hedder
 * «Forhøjet pensionsalder» i bilagsvalget, togglen, boksens overskrift og dokumentets sektion og
 * bilagstitel.
 *
 * Prøven ved en senere ændring: for hvert bilagsvalg skal de FIRE navne (afkrydsningsfelt ·
 * skærmoverskrift · dokumentsektion · bilagstitel) være samme streng – ikke fire strenge, der ligner
 * hinanden. Derfor er navnet en konstant og ikke en litteral pr. kaldssted.
 */

/** Fradrag 4's ene navn: bilagsvalg, boks, specifikation, dokumentsektion og bilagstitel. */
export const FORHOEJET_PENSIONSALDER_LABEL = 'Forhøjet pensionsalder';

/** Beregnings-togglen på differencekrav-fanen, dannet af samme navn. */
export const INDREGN_FORHOEJET_PENSIONSALDER_LABEL = `Indregn ${FORHOEJET_PENSIONSALDER_LABEL.toLowerCase()}`;

/**
 * Bundlinjens underoverskrift på «EET efter EAL» – skærm og dokument.
 *
 * Fanen opgør erhvervsevnetabet EFTER erstatningsansvarsloven, og navnet siger, hvad tallet ER, frem for
 * hvilket lovsæt det kommer fra (fastlagt ordlyd).
 * Forsørgertabs egen «Beregnet EAL-krav»-underoverskrift er BEVIDST uændret: den flade opgør et
 * forsørgertab, ikke et erhvervsevnetab.
 */
export const BEREGNET_EET_EFTER_EAL_LABEL = 'Beregnet EET (efter EAL)';
