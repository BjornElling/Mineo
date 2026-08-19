import * as React from 'react';

/**
 * Den ENE placeholder-identitets-livscyklus for alle dynamiske tabeller (§1.11, §3.7).
 *
 * En dynamisk tabel viser de committede rækker plus mindst én tom indtastningsrække. Den tomme række har en
 * UI-identitet – et række-id – som cellernes feltadresser og editorlokationer bygges af. Ved første ikke-tomme
 * settle promoveres netop det id atomisk til en persisteret række (§1.11), og history-frame'et får en
 * felt-origin, der peger på DEN adresse og DEN editorlokation.
 *
 * DERFOR er identiteten nødt til at være en REN FUNKTION af den aktuelle committede tilstand – ikke af den vej,
 * brugeren tog derhen. Undo/redo er en tidsmaskine over inputtet: samme committede tilstand kan nås forfra
 * (redigering), bagfra (undo) og forfra igen (redo). Peger en history-origin på et placeholder-id, findes det
 * kun, hvis tabellen viser SAMME identitet, hver gang den samme tilstand er aktuel. Ellers finder
 * `findRestoreTarget` intet element, og fokus forlader lydløst tabellen.
 *
 * Modellen er derfor:
 *
 *   synlige placeholder-id'er = de første `slotCount` medlemmer af tabellens id-SEKVENS,
 *                               som ikke aktuelt er committede.
 *
 * Sekvensen er APPEND-ONLY og doven: `at(index)` mønter id'et, første gang indekset bruges, og returnerer
 * derefter altid det samme. Der findes INGEN operation, der fjerner et id – det er hele pointen, og det er
 * udtrykt i typen frem for i en regel, man kan glemme. Et tidligere `state.ids.length = cursor`-trim gjorde
 * netop dét: efter et undo helt tilbage faldt de senere slots bag markøren og blev kastet væk, og et
 * efterfølgende redo møntede et NYT id til den plads. Fra da af pegede alle history-origins fra den oprindelige
 * session på et id, tabellen aldrig ville vise igen.
 *
 * Sekvensen vokser ikke ubegrænset: der møntes kun et nyt id, når alle tidligere medlemmer er committede, så
 * dens længde er højst «flest samtidigt committede rækker» + `slotCount`.
 */

/**
 * Tabellens append-only id-sekvens. `at(index)` er TOTAL og STABIL: samme indeks giver altid samme id i hele
 * sekvensens levetid. Der findes bevidst ingen fjern-/trim-/nulstil-operation.
 */
export type PlaceholderIdSequence = Readonly<{ at: (index: number) => string }>;

/**
 * Bygger sekvensen over en id-fabrik. Fabrikken kaldes KUN for et indeks, der ikke er møntet før.
 *
 * Skilt ud som en almindelig funktion frem for at ligge inde i en hook, så identitetsforløbet
 * promotion → undo → redo → undo kan unit-testes uden render.
 */
export const createPlaceholderIdSequence = (mintId: () => string): PlaceholderIdSequence => {
  const minted: string[] = [];
  return Object.freeze({
    at: (index: number): string => {
      while (minted.length <= index) minted.push(mintId());
      return minted[index]!;
    },
  });
};

/**
 * De synlige placeholder-id'er for én render: de første `slotCount` sekvensmedlemmer, der ikke er committede.
 *
 * REN i forhold til (sekvens, committede id'er, slotCount) – den eneste mutation er sekvensens dovne møntning,
 * som per konstruktion ikke kan ændre et allerede udleveret id. Derfor gælder invarianten: samme committede
 * tilstand → samme synlige id'er, uanset hvornår og i hvilken rækkefølge tilstanden opstod.
 *
 * @param sequence     Tabellens append-only id-sekvens (ejes af kalderens ref).
 * @param committedIds De aktuelt committede række-id'er.
 * @param slotCount    Antal synlige placeholder-slots (≥ 1).
 */
export const resolvePlaceholderSlotIds = (
  sequence: PlaceholderIdSequence,
  committedIds: ReadonlySet<string>,
  slotCount: number
): readonly string[] => {
  const visible: string[] = [];
  // Højst `committedIds.size` medlemmer kan springes over, så loftet er nået, netop når sekvensen mønter
  // dubletter – umuligt for en unik id-fabrik, men et defekt loft er at foretrække frem for en uendelig løkke.
  const maxIndex = committedIds.size + slotCount;
  for (let index = 0; visible.length < slotCount && index < maxIndex; index += 1) {
    const id = sequence.at(index);
    if (!committedIds.has(id)) visible.push(id);
  }
  return Object.freeze(visible);
};

/**
 * Hook-formen: de synlige placeholder-id'er for en tabel med `slotCount` tomme rækker.
 *
 * `committedIds` skal være et STABILT sæt (memoiseret af kalderen), da det driver re-evalueringen.
 *
 * Sekvensen oprettes ÉN gang pr. tabelinstans og overlever et skift af `createRowId`-identitet: fabrikken
 * læses gennem en ref, så en kaldsside, der (gen)skaber sin fabrik pr. render, ikke nulstiller identiteten.
 */
export const usePlaceholderSlotIds = (
  committedIds: ReadonlySet<string>,
  slotCount: number,
  createRowId: () => string
): readonly string[] => {
  const mintRef = React.useRef(createRowId);
  mintRef.current = createRowId;
  const sequenceRef = React.useRef<PlaceholderIdSequence | null>(null);
  sequenceRef.current ??= createPlaceholderIdSequence(() => mintRef.current());
  const sequence = sequenceRef.current;
  return React.useMemo(
    () => resolvePlaceholderSlotIds(sequence, committedIds, slotCount),
    [sequence, committedIds, slotCount]
  );
};
