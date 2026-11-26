/**
 * Den resterende periode vises i hele år og måneder, fordi kapitaliseringstabellen
 * slår op på netop denne opdeling.
 *
 * Selve resten opgøres dagbaseret (`resterendeMaanederTotal`, bevidst valg) som samlet periode
 * minus tabellens egen sum af udbetalte måneder; afkortningen til hele år og måneder sker først ved
 * tabelopslaget. Etiketten siger derfor netop, hvad den viste værdi er: den afkortede opslagsnøgle,
 * ikke den fulde rest.
 */
export const FORSOERGERTAB_RESTERENDE_PERIODE_LABEL = 'Resterende periode (hele år og måneder)';

/**
 * Fladen har to personer i sig – skadelidte og den efterladte – så en bar «Køn»-række er tvetydig.
 * Ordlyden er én konstant, så feltets egen label og ASL-halvdelens forudsætningsrækker på skærm og i
 * dokument ikke kan komme ud af trit. Erhvervsevnetab beholder bevidst «Køn»: dér handler hele fladen om skadelidte.
 */
export const FORSOERGERTAB_SKADELIDTES_KOEN_LABEL = 'Skadelidtes køn';
