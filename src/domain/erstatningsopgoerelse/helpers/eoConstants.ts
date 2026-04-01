import { toISODateString } from '../../../types/branded';

/**
 * Særregel: sygedagpenge periodiseret før denne dato er uden SH-fradrag.
 * Hjemmel: lovændring pr. 2. juli 2012.
 */
export const SYGEDAGPENGE_SH_CUTOFF = toISODateString('2012-07-02');

/**
 * Skæringsdato for midlertidig EET's virkning på TAF.
 * Skader opstået før denne dato (< 2011-06-16): en upåklaget midlertidig EET-afgørelse
 * bringer retten til tabt arbejdsfortjeneste til ophør på samme måde som en endelig afgørelse.
 * Hjemmel: arbejdsskadesikringslovens overgangsbestemmelse pr. 16. juni 2011.
 */
export const TAF_MIDLERTIDIG_EET_SKAERINGSDATO = toISODateString('2011-06-16');
