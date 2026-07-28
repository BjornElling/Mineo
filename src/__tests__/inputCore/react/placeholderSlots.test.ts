import {
  createPlaceholderSlotState,
  resolvePlaceholderSlotIds,
} from '../../../inputCore/react/placeholderSlots';

/**
 * Placeholder-identitetens LIVSCYKLUS (§1.11, §3.7, UT-F03).
 *
 * Den afgørende invariant er ikke "genbrug id'er hvis muligt", men: et promoveret id skal kunne GENINDTRÆDE som
 * placeholder, hvis rækken forsvinder igen. Fokusrestoren efter et promotion-undo kræver et eksakt match på både
 * feltadresse og editorlokation, og begge bygges af rækkens id. Kastes id'et væk ved promoveringen, findes der
 * efter undo intet element at fokusere, og fokus forlader lydløst tabellen.
 *
 * Testene kører den rene funktion, så identitetsforløbet kan måles uden render.
 */

/** Deterministisk id-fabrik, så testene kan udtale sig om HVILKET id der bruges. */
const createIdFactory = () => {
  let next = 0;
  return () => {
    next += 1;
    return `p${next}`;
  };
};

const ids = (...values: readonly string[]): ReadonlySet<string> => new Set(values);

describe('resolvePlaceholderSlotIds', () => {
  it('giver et stabilt id, så længe intet er committet (en åben editor skifter ikke identitet)', () => {
    const state = createPlaceholderSlotState();
    const createRowId = createIdFactory();

    expect(resolvePlaceholderSlotIds(state, ids(), 1, createRowId)).toEqual(['p1']);
    // Samme kald igen må IKKE generere et nyt id: en celleeditor, der er åben i placeholder-rækken, ville
    // ellers skifte feltadresse midt i redigeringen.
    expect(resolvePlaceholderSlotIds(state, ids(), 1, createRowId)).toEqual(['p1']);
  });

  it('flytter til et nyt id, når det gamle er promoveret', () => {
    const state = createPlaceholderSlotState();
    const createRowId = createIdFactory();

    expect(resolvePlaceholderSlotIds(state, ids(), 1, createRowId)).toEqual(['p1']);
    // p1 er nu en rigtig række; tabellen skal vise en ny tom trailing række.
    expect(resolvePlaceholderSlotIds(state, ids('p1'), 1, createRowId)).toEqual(['p2']);
  });

  /**
   * KERNEN i UT-F03. Efter promoveringen af p1 viser tabellen p2. Et undo fjerner p1 fra de committede rækker,
   * og DA skal p1 genindtræde som placeholder — med præcis den identitet, history-originen peger på.
   */
  it('lader et promoveret id GENINDTRÆDE som placeholder efter undo', () => {
    const state = createPlaceholderSlotState();
    const createRowId = createIdFactory();

    resolvePlaceholderSlotIds(state, ids(), 1, createRowId);          // viser p1
    resolvePlaceholderSlotIds(state, ids('p1'), 1, createRowId);      // promoveret → viser p2

    // Undo: p1 er ikke længere committet.
    expect(resolvePlaceholderSlotIds(state, ids(), 1, createRowId)).toEqual(['p1']);
  });

  it('genindtræder korrekt efter FLERE promoveringer i rækkefølge', () => {
    const state = createPlaceholderSlotState();
    const createRowId = createIdFactory();

    resolvePlaceholderSlotIds(state, ids(), 1, createRowId);              // p1
    resolvePlaceholderSlotIds(state, ids('p1'), 1, createRowId);          // p2
    resolvePlaceholderSlotIds(state, ids('p1', 'p2'), 1, createRowId);    // p3

    // Undo af den seneste promotion: p2 genindtræder, ikke p1 og ikke et nyt id.
    expect(resolvePlaceholderSlotIds(state, ids('p1'), 1, createRowId)).toEqual(['p2']);
    // Endnu et undo: p1 genindtræder på sin oprindelige plads.
    expect(resolvePlaceholderSlotIds(state, ids(), 1, createRowId)).toEqual(['p1']);
  });

  it('understøtter et minimum af synlige tomme rækker med stabile id pr. slot', () => {
    const state = createPlaceholderSlotState();
    const createRowId = createIdFactory();

    expect(resolvePlaceholderSlotIds(state, ids(), 3, createRowId)).toEqual(['p1', 'p2', 'p3']);
    // Uændret input → uændrede id'er pr. slot.
    expect(resolvePlaceholderSlotIds(state, ids(), 3, createRowId)).toEqual(['p1', 'p2', 'p3']);
  });

  it('bevarer de resterende slots id, når ét af flere promoveres', () => {
    const state = createPlaceholderSlotState();
    const createRowId = createIdFactory();

    resolvePlaceholderSlotIds(state, ids(), 3, createRowId); // p1, p2, p3
    // p2 promoveres (brugeren skrev i den midterste tomme række). De to øvrige slots må BEHOLDE deres id —
    // ellers ville en åben editor i p1 eller p3 skifte identitet, fordi naboen blev committet.
    const after = resolvePlaceholderSlotIds(state, ids('p2'), 3, createRowId);
    expect(after).toContain('p1');
    expect(after).toContain('p3');
    expect(after).not.toContain('p2');
    // Og p2 genindtræder ved undo.
    expect(resolvePlaceholderSlotIds(state, ids(), 3, createRowId)).toEqual(['p1', 'p2', 'p3']);
  });

  it('vokser ikke ubegrænset: puljen trimmes til de slots, tabellen faktisk viser', () => {
    const state = createPlaceholderSlotState();
    const createRowId = createIdFactory();

    resolvePlaceholderSlotIds(state, ids(), 5, createRowId); // p1..p5
    expect(state.ids).toHaveLength(5);
    // Færre synlige slots (fx fordi committede rækker nu udgør minimum) → puljen skrumper.
    resolvePlaceholderSlotIds(state, ids(), 1, createRowId);
    expect(state.ids).toHaveLength(1);
  });

  it('genererer kun et nyt id, når et slot mangler ét', () => {
    const state = createPlaceholderSlotState();
    let calls = 0;
    const createRowId = () => {
      calls += 1;
      return `p${calls}`;
    };

    resolvePlaceholderSlotIds(state, ids(), 2, createRowId);
    expect(calls).toBe(2);
    // Uændret tilstand → ingen nye id'er.
    resolvePlaceholderSlotIds(state, ids(), 2, createRowId);
    expect(calls).toBe(2);
  });
});
