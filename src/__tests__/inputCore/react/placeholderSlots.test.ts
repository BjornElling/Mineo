import {
  createPlaceholderIdSequence,
  resolvePlaceholderSlotIds,
} from '../../../inputCore/react/placeholderSlots';

/**
 * Placeholder-identitetens LIVSCYKLUS (§1.11, §3.7).
 *
 * Den afgørende invariant er ikke "genbrug id'er hvis muligt", men: de synlige placeholder-id'er er en REN
 * FUNKTION af de aktuelt committede rækker. Undo/redo er en tidsmaskine over inputtet, så den samme committede
 * tilstand kan nås forfra, bagfra og forfra igen. Fokusrestoren efter et promotion-undo kræver et eksakt match
 * på både feltadresse og editorlokation, og begge bygges af rækkens id – så identiteten skal være den samme,
 * hver gang den samme tilstand er aktuel. Ellers findes der intet element at fokusere, og fokus forlader
 * lydløst tabellen.
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

const newSequence = () => createPlaceholderIdSequence(createIdFactory());

const ids = (...values: readonly string[]): ReadonlySet<string> => new Set(values);

describe('resolvePlaceholderSlotIds', () => {
  it('giver et stabilt id, så længe intet er committet (en åben editor skifter ikke identitet)', () => {
    const sequence = newSequence();

    expect(resolvePlaceholderSlotIds(sequence, ids(), 1)).toEqual(['p1']);
    // Samme kald igen må IKKE generere et nyt id: en celleeditor, der er åben i placeholder-rækken, ville
    // ellers skifte feltadresse midt i redigeringen.
    expect(resolvePlaceholderSlotIds(sequence, ids(), 1)).toEqual(['p1']);
  });

  it('flytter til et nyt id, når det gamle er promoveret', () => {
    const sequence = newSequence();

    expect(resolvePlaceholderSlotIds(sequence, ids(), 1)).toEqual(['p1']);
    // p1 er nu en rigtig række; tabellen skal vise en ny tom trailing række.
    expect(resolvePlaceholderSlotIds(sequence, ids('p1'), 1)).toEqual(['p2']);
  });

  /**
   * KERNEN. Efter promoveringen af p1 viser tabellen p2. Et undo fjerner p1 fra de committede rækker,
   * og DA skal p1 genindtræde som placeholder – med præcis den identitet, history-originen peger på.
   */
  it('lader et promoveret id GENINDTRÆDE som placeholder efter undo', () => {
    const sequence = newSequence();

    resolvePlaceholderSlotIds(sequence, ids(), 1);          // viser p1
    resolvePlaceholderSlotIds(sequence, ids('p1'), 1);      // promoveret → viser p2

    // Undo: p1 er ikke længere committet.
    expect(resolvePlaceholderSlotIds(sequence, ids(), 1)).toEqual(['p1']);
  });

  it('genindtræder korrekt efter FLERE promoveringer i rækkefølge', () => {
    const sequence = newSequence();

    resolvePlaceholderSlotIds(sequence, ids(), 1);              // p1
    resolvePlaceholderSlotIds(sequence, ids('p1'), 1);          // p2
    resolvePlaceholderSlotIds(sequence, ids('p1', 'p2'), 1);    // p3

    // Undo af den seneste promotion: p2 genindtræder, ikke p1 og ikke et nyt id.
    expect(resolvePlaceholderSlotIds(sequence, ids('p1'), 1)).toEqual(['p2']);
    // Endnu et undo: p1 genindtræder på sin oprindelige plads.
    expect(resolvePlaceholderSlotIds(sequence, ids(), 1)).toEqual(['p1']);
  });

  /**
   * Brugerens forløb: to promoveringer, undo HELT tilbage, redo HELT frem, og derefter ét undo.
   *
   * Det er præcis her, en hukommelsesbaseret pulje svigtede: undo'et helt tilbage skubbede de senere slots bag
   * markøren, hvor de blev trimmet væk, og redo'et møntede derfor et NYT id til pladsen. Fra da af pegede
   * history-originen fra den oprindelige promotion på et id, tabellen aldrig ville vise igen – fokus forsvandt
   * lydløst, og fejlen var permanent for resten af sessionen.
   */
  it('bevarer identiteten gennem undo HELT tilbage og redo HELT frem', () => {
    const sequence = newSequence();

    resolvePlaceholderSlotIds(sequence, ids(), 1);              // p1 vises
    resolvePlaceholderSlotIds(sequence, ids('p1'), 1);          // p1 promoveret → p2 vises
    resolvePlaceholderSlotIds(sequence, ids('p1', 'p2'), 1);    // p2 promoveret → p3 vises

    // Undo helt tilbage.
    expect(resolvePlaceholderSlotIds(sequence, ids('p1'), 1)).toEqual(['p2']);
    expect(resolvePlaceholderSlotIds(sequence, ids(), 1)).toEqual(['p1']);

    // Redo helt frem: SAMME tilstande skal give SAMME identiteter.
    expect(resolvePlaceholderSlotIds(sequence, ids('p1'), 1)).toEqual(['p2']);
    expect(resolvePlaceholderSlotIds(sequence, ids('p1', 'p2'), 1)).toEqual(['p3']);

    // Og det afgørende undo bagefter: p2 genindtræder – ikke et nyt, fjerde id.
    expect(resolvePlaceholderSlotIds(sequence, ids('p1'), 1)).toEqual(['p2']);
  });

  /**
   * Den GENERELLE invariant, målt over en tilfældig vandring frem og tilbage gennem committede
   * tilstande: en tilstand, der ses igen, skal give præcis de samme synlige id'er. Scenarie-testene ovenfor er
   * enkeltpunkter på den kurve; denne siger, at der ikke findes andre punkter, hvor identiteten kan skride.
   */
  it('giver samme synlige id for enhver committet tilstand, uanset hvordan den blev nået', () => {
    const sequence = newSequence();
    const slotCount = 2;
    const seen = new Map<string, readonly string[]>();

    // Deterministisk pseudo-tilfældig vandring: promovér det først synlige id, eller fjern et committet.
    let committed: string[] = [];
    let seed = 7;
    const nextStep = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % 3;
    };

    for (let step = 0; step < 200; step += 1) {
      const committedSet = new Set(committed);
      const visible = resolvePlaceholderSlotIds(sequence, committedSet, slotCount);
      const key = [...committed].sort().join('|');
      const previous = seen.get(key);
      if (previous === undefined) seen.set(key, visible);
      else expect(visible).toEqual(previous);

      // Fremad (promovér den første synlige placeholder) eller tilbage (fjern en committet række).
      if (nextStep() === 0 && committed.length > 0) {
        committed = committed.slice(0, -1);
      } else {
        committed = [...committed, visible[0]!];
      }
    }

    // Vandringen skal reelt have besøgt de samme tilstande igen – ellers måler testen ingenting.
    expect(seen.size).toBeLessThan(200);
  });

  it('understøtter et minimum af synlige tomme rækker med stabile id pr. slot', () => {
    const sequence = newSequence();

    expect(resolvePlaceholderSlotIds(sequence, ids(), 3)).toEqual(['p1', 'p2', 'p3']);
    // Uændret input → uændrede id'er pr. slot.
    expect(resolvePlaceholderSlotIds(sequence, ids(), 3)).toEqual(['p1', 'p2', 'p3']);
  });

  it('bevarer de resterende slots id, når ét af flere promoveres', () => {
    const sequence = newSequence();

    resolvePlaceholderSlotIds(sequence, ids(), 3); // p1, p2, p3
    // p2 promoveres (brugeren skrev i den midterste tomme række). De to øvrige slots må BEHOLDE deres id –
    // ellers ville en åben editor i p1 eller p3 skifte identitet, fordi naboen blev committet.
    const after = resolvePlaceholderSlotIds(sequence, ids('p2'), 3);
    expect(after).toContain('p1');
    expect(after).toContain('p3');
    expect(after).not.toContain('p2');
    // Og p2 genindtræder ved undo.
    expect(resolvePlaceholderSlotIds(sequence, ids(), 3)).toEqual(['p1', 'p2', 'p3']);
  });

  /**
   * Sekvensen er append-only, men den vokser ikke ubegrænset: der møntes kun et nyt id, når alle tidligere
   * medlemmer er committede. Færre synlige slots mønter derfor ingenting – og de tidligere møntede id'er
   * BEVARES, fordi en history-origin fra dengang stadig kan pege på dem.
   */
  it('mønter ikke nye id, når antallet af synlige slots falder – og glemmer ikke de gamle', () => {
    let calls = 0;
    const sequence = createPlaceholderIdSequence(() => {
      calls += 1;
      return `p${calls}`;
    });

    expect(resolvePlaceholderSlotIds(sequence, ids(), 5)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(calls).toBe(5);
    expect(resolvePlaceholderSlotIds(sequence, ids(), 1)).toEqual(['p1']);
    expect(calls).toBe(5);
    // Tilbage til fem slots: de fem OPRINDELIGE id'er, ikke fem nye.
    expect(resolvePlaceholderSlotIds(sequence, ids(), 5)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(calls).toBe(5);
  });

  it('genererer kun et nyt id, når et slot mangler ét', () => {
    let calls = 0;
    const sequence = createPlaceholderIdSequence(() => {
      calls += 1;
      return `p${calls}`;
    });

    resolvePlaceholderSlotIds(sequence, ids(), 2);
    expect(calls).toBe(2);
    // Uændret tilstand → ingen nye id'er.
    resolvePlaceholderSlotIds(sequence, ids(), 2);
    expect(calls).toBe(2);
  });
});
