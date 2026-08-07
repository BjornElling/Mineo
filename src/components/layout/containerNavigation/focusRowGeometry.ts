/**
 * Ren geometri-kerne for `Container`s pil-navigation.
 *
 * Al beslutning om HVILKET felt en piletast peger på er her, som funktioner over værdier
 * (rect + række-container), ikke over live DOM. Det er den halvdel af den gamle
 * `Container.tsx`-monolit, der bar den reelle logik — visuel række-gruppering med
 * tolerance, vandret sortering, cirkulær nabo-udpegning — og som kun kunne rammes
 * gennem en fuld render med jsdom-layout.
 *
 * Modulet kender ikke React, ikke `KeyboardEvent` og ikke fokus. Det tager en liste af
 * kandidater og svarer hvem der er nabo. `useContainerKeyboardNavigation` oversætter
 * tastetryk til kald herind og udfører fokus-effekten.
 *
 * Række-begrebet har bevidst to kilder, i denne prioritet:
 * 1. En eksplicit DOM-række-container (`CONTAINER_ROW_SELECTOR`) — sidens egen markering.
 * 2. Visuel `top`-nærhed inden for `VISUAL_ROW_TOLERANCE_PX` — for felter uden container.
 *
 * Blandingen er ikke et fald-tilbage, men en dokumenteret regel: et felt UDEN container
 * regnes med i en containerbaseret række, hvis det ligger på samme linje visuelt, mens et
 * felt MED en anden container aldrig gør. Det er den adfærd, der får side-labels og
 * inline-knapper til at høre til feltets række, uden at to nabo-rækker smelter sammen.
 */

/** Lodret afstand i px, hvorunder to felter uden række-container regnes som samme visuelle række. */
export const VISUAL_ROW_TOLERANCE_PX = 8;

/**
 * Et navigations-kandidat-felt, reduceret til de egenskaber geometrien har brug for.
 * `element` er kun en opaque identitet her — kernen læser aldrig DOM fra den.
 */
export type FocusCandidate<TElement> = Readonly<{
  element: TElement;
  /** Feltets position; kun `left` og `top` bruges. */
  rect: Readonly<{ left: number; top: number }>;
  /** Feltets eksplicitte række-container, hvis det har en. Identitets-sammenlignes. */
  rowContainer: unknown | null;
  /** Række-containerens egen `top` — rækkens sorteringsnøgle, når den findes. */
  rowContainerTop: number | null;
  /** Ligger feltet inde i et subtræ med egen tabel-navigation? */
  isInTableNavigation: boolean;
}>;

/** En færdigbygget navigations-række, sorteret vandret. */
export type FocusRow<TElement> = Readonly<{
  /** Rækkens lodrette sorteringsnøgle. */
  top: number;
  elements: readonly FocusCandidate<TElement>[];
}>;

const sortByHorizontalPosition = <TElement>(
  candidates: readonly FocusCandidate<TElement>[],
): FocusCandidate<TElement>[] =>
  candidates.slice().sort((a, b) => {
    if (a.rect.left !== b.rect.left) return a.rect.left - b.rect.left;
    return a.rect.top - b.rect.top;
  });

/**
 * Cirkulær nabo i en ordnet liste. `step` er +1 (frem) eller -1 (tilbage).
 * Returnerer `null` hvis `current` ikke er i listen, så kalderen kan lade tasten passere
 * frem for at gætte på et mål.
 */
export const resolveCircularNeighbor = <T>(items: readonly T[], current: T, step: 1 | -1): T | null => {
  if (items.length === 0) return null;
  const index = items.indexOf(current);
  if (index < 0) return null;
  const nextIndex = (index + step + items.length) % items.length;
  return items[nextIndex] ?? null;
};

/**
 * Felterne i SAMME vandrette række som `active`, sorteret venstre-til-højre.
 *
 * Regel (se modul-doc): en eksplicit række-container vinder over visuel nærhed, men et
 * felt uden container kan slutte sig til en containerbaseret række via `top`-nærhed.
 */
export const resolveRowMembers = <TElement>(
  candidates: readonly FocusCandidate<TElement>[],
  active: FocusCandidate<TElement>,
): FocusCandidate<TElement>[] => {
  const members = candidates.filter((candidate) => {
    if (active.rowContainer !== null && candidate.rowContainer !== null) {
      return candidate.rowContainer === active.rowContainer;
    }
    // Kandidat med EN ANDEN container hører aldrig til en container-løs aktiv rækkes linje.
    if (active.rowContainer === null && candidate.rowContainer !== null) return false;
    return Math.abs(candidate.rect.top - active.rect.top) <= VISUAL_ROW_TOLERANCE_PX;
  });
  return sortByHorizontalPosition(members);
};

/**
 * Alle navigations-rækker på siden, sorteret oppefra og ned.
 *
 * Rækker fra DOM-containere og rækker fra visuel nærhed bygges hver for sig og flettes
 * derefter på `top`. Tabel-felter indgår bevidst: en kant-exit fra en tabel skal kunne
 * finde nabo-rækken over/under i den samlede side-navigation.
 */
export const buildFocusRows = <TElement>(
  candidates: readonly FocusCandidate<TElement>[],
): FocusRow<TElement>[] => {
  const byRowContainer = new Map<unknown, FocusCandidate<TElement>[]>();
  const rowContainerTops = new Map<unknown, number>();
  const visualRows: { top: number; elements: FocusCandidate<TElement>[] }[] = [];

  for (const candidate of candidates) {
    if (candidate.rowContainer !== null) {
      const existing = byRowContainer.get(candidate.rowContainer);
      if (existing) {
        existing.push(candidate);
      } else {
        byRowContainer.set(candidate.rowContainer, [candidate]);
        // Containerens egen top er rækkens nøgle; fald tilbage til første felts top, hvis
        // kalderen ikke kunne måle containeren (fx en detached node).
        rowContainerTops.set(candidate.rowContainer, candidate.rowContainerTop ?? candidate.rect.top);
      }
      continue;
    }

    const existing = visualRows.find((row) => Math.abs(row.top - candidate.rect.top) <= VISUAL_ROW_TOLERANCE_PX);
    if (existing) {
      existing.elements.push(candidate);
    } else {
      visualRows.push({ top: candidate.rect.top, elements: [candidate] });
    }
  }

  const rows: FocusRow<TElement>[] = [
    ...Array.from(byRowContainer.entries()).map(([rowContainer, elements]) => ({
      top: rowContainerTops.get(rowContainer) ?? elements[0].rect.top,
      elements: sortByHorizontalPosition(elements),
    })),
    ...visualRows.map((row) => ({ top: row.top, elements: sortByHorizontalPosition(row.elements) })),
  ];

  return rows.filter((row) => row.elements.length > 0).sort((a, b) => a.top - b.top);
};

/**
 * Målfeltet for en lodret piletast: naborækken over/under, cirkulært.
 *
 * Landingspunktet i rækken er retningsafhængigt og bevidst: `down` lander på rækkens
 * FØRSTE felt, `up` på dens SIDSTE. Det gør op/ned til den omvendte af hinanden, så en
 * tur ned og op igen ender samme sted som en læse-rækkefølge ville forvente.
 */
export const resolveVerticalTarget = <TElement>(
  candidates: readonly FocusCandidate<TElement>[],
  active: FocusCandidate<TElement>,
  direction: 'up' | 'down',
): FocusCandidate<TElement> | null => {
  const rows = buildFocusRows(candidates);
  if (rows.length === 0) return null;

  const currentRowIndex = rows.findIndex((row) => row.elements.includes(active));
  if (currentRowIndex < 0) return null;

  const nextRowIndex = (currentRowIndex + (direction === 'down' ? 1 : -1) + rows.length) % rows.length;
  const targetRow = rows[nextRowIndex];
  const target = direction === 'down' ? targetRow.elements[0] : targetRow.elements[targetRow.elements.length - 1];
  return target ?? null;
};

/**
 * Målfeltet for en vandret piletast: naboen i samme række, cirkulært.
 *
 * Tabel-felter er udelukket her (modsat lodret), fordi vandret navigation inde i en tabel
 * ejes af tabellens egen navigation og ikke må slippe ud ved rækkekanten.
 */
export const resolveHorizontalTarget = <TElement>(
  candidates: readonly FocusCandidate<TElement>[],
  active: FocusCandidate<TElement>,
  direction: 'left' | 'right',
): FocusCandidate<TElement> | null => {
  const nonTableCandidates = candidates.filter((candidate) => !candidate.isInTableNavigation);
  if (!nonTableCandidates.includes(active)) return null;

  const rowMembers = resolveRowMembers(nonTableCandidates, active);
  return resolveCircularNeighbor(rowMembers, active, direction === 'right' ? 1 : -1);
};
