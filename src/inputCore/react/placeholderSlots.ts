import * as React from 'react';

/**
 * Den ENE placeholder-identitets-livscyklus for alle dynamiske tabeller (§1.11, §3.7).
 *
 * En dynamisk tabel viser de committede rækker plus mindst én tom indtastningsrække. Den tomme række har en
 * UI-identitet — et række-id — som cellernes feltadresser og editorlokationer bygges af. Ved første ikke-tomme
 * settle promoveres netop det id atomisk til en persisteret række (§1.11), og history-frame'et får en
 * felt-origin, der peger på DEN adresse og DEN editorlokation.
 *
 * DERFOR skal et promoveret id BEVARES, ikke kastes væk. Et undo af promoveringen fjerner rækken igen, og
 * fokusrestoren (`findRestoreTarget`) kræver et eksakt match på både feltadresse og editorlokation. Kunne
 * tabellen kun huske det SENESTE placeholder-id, ville den efter promoveringen have skiftet til et nyt id, og
 * der ville efter undo ikke længere findes noget element, restoren kan finde — fokus forsvinder lydløst ud af
 * tabellen.
 *
 * Puljen løser det ved at være ORDNET og BEVARENDE: hvert slot husker sit id, også efter at id'et er blevet
 * committet. Forsvinder id'et igen fra de committede rækker (undo), genindtræder det som placeholder på sin
 * oprindelige plads med præcis den identitet, fokusrestoren leder efter.
 *
 * Reglen er ikke "genbrug hvis muligt" men "et slots id er stabilt, indtil slottet forsvinder". Det gør også
 * en åben celleeditor sikker: identiteten skifter ikke under redigering.
 */

/** Puljens tilstand: id pr. slot, i visningsrækkefølge. Ejes af kalderens ref og mutéres kun herfra. */
export type PlaceholderSlotState = { ids: string[] };

export const createPlaceholderSlotState = (): PlaceholderSlotState => ({ ids: [] });

/**
 * Beregner de synlige placeholder-id'er og opdaterer puljen.
 *
 * REN i forhold til sit output, men muterer bevidst `state` — den ER hukommelsen på tværs af renders. Den er
 * skilt ud som en almindelig funktion frem for at ligge inde i en hook, så livscyklussen kan unit-testes uden
 * render: netop identitetsforløbet promotion → undo → genindtræden er det, der skal kunne fejle i en test.
 *
 * @param state          Puljen (kalderens ref-værdi).
 * @param committedIds   De aktuelt committede række-id'er.
 * @param slotCount      Antal synlige placeholder-slots (≥ 1).
 * @param createRowId    Deterministisk id-fabrik. Kaldes KUN når et slot mangler et id.
 */
export const resolvePlaceholderSlotIds = (
  state: PlaceholderSlotState,
  committedIds: ReadonlySet<string>,
  slotCount: number,
  createRowId: () => string
): readonly string[] => {
  const visible: string[] = [];
  let cursor = 0;

  for (let slot = 0; slot < slotCount; slot += 1) {
    // Spring de gemte id'er over, der aktuelt ER committede: de hører til en rigtig række lige nu, men
    // beholdes i puljen, så de kan genindtræde, hvis rækken forsvinder igen (undo).
    let id = state.ids[cursor];
    while (id !== undefined && committedIds.has(id)) {
      cursor += 1;
      id = state.ids[cursor];
    }
    if (id === undefined) {
      id = createRowId();
      state.ids[cursor] = id;
    }
    visible.push(id);
    cursor += 1;
  }

  // Trim til den plads, vi nåede. Alt FØR `cursor` er enten synligt nu eller et committet id, der kan
  // genindtræde ved undo, og bevares derfor; alt bagefter er slots, tabellen ikke længere viser, og som ingen
  // history-origin kan pege på. Uden trimmet ville puljen vokse ubegrænset over en lang session.
  state.ids.length = cursor;
  return Object.freeze(visible);
};

/**
 * Hook-formen: de synlige placeholder-id'er for en tabel med `slotCount` tomme rækker.
 *
 * `committedIds` skal være et STABILT sæt (memoiseret af kalderen), da det driver re-evalueringen.
 */
export const usePlaceholderSlotIds = (
  committedIds: ReadonlySet<string>,
  slotCount: number,
  createRowId: () => string
): readonly string[] => {
  const stateRef = React.useRef<PlaceholderSlotState>(createPlaceholderSlotState());
  return React.useMemo(
    () => resolvePlaceholderSlotIds(stateRef.current, committedIds, slotCount, createRowId),
    [committedIds, slotCount, createRowId]
  );
};
