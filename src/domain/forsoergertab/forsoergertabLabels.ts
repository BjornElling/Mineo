/**
 * Den resterende periode vises i hele år og måneder, fordi kapitaliseringstabellen
 * slår op på netop denne opdeling.
 *
 * Selve resten opgøres dagbaseret (`resterendeMaanederTotal`, afgjort 2026-09-04) som samlet periode
 * minus tabellens egen sum af udbetalte måneder; afkortningen til hele år og måneder sker først ved
 * tabelopslaget. Etiketten siger derfor netop, hvad den viste værdi er: den afkortede opslagsnøgle,
 * ikke den fulde rest.
 */
export const FORSOERGERTAB_RESTERENDE_PERIODE_LABEL = 'Resterende periode (hele år og måneder)';

/**
 * Fladen har to personer i sig – skadelidte og den efterladte – så en bar «Køn»-række er tvetydig
 * (BB-134). Ordlyden er én konstant, fordi rettelsen første gang kun ramte to af fire visningssteder:
 * feltets egen label og ASL-halvdelens forudsætningsrækker stod tilbage med «Køn» på skærm og i
 * dokument (BB-137). Erhvervsevnetab beholder bevidst «Køn»: dér handler hele fladen om skadelidte.
 */
export const FORSOERGERTAB_SKADELIDTES_KOEN_LABEL = 'Skadelidtes køn';
