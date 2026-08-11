import { resolveFieldIssueTooltip, type FieldIssue } from '../inputIssue';

// Feltfejl → de TO tekster, en feltflade viser (§4): den fulde besked og hover-teksten. De var samme streng,
// indtil brugerkravet 2026-07-30 gjorde tooltippet generisk for de fleste `format`-/`schema`-issues. Helperen findes, fordi alle
// otte feltfamilier + de to gridceller skal træffe samme valg: læste hver af dem selv `issue.message` til
// tooltippet, ville forkortelsen skulle huskes tolv steder, og et nyt felt ville arve den gamle opførsel i
// tavshed. Reason→tekst-beslutningen ejes fortsat af `resolveFieldIssueTooltip`; her sker kun sammenkoblingen
// med den eksterne (collection-/tværfelt-)fejl og prioriteringen mellem de to.

export type FieldIssueText = Readonly<{
  /** Den fulde besked: rød markering, a11y-tekst og "Fejl og advarsler". `undefined` = ingen fejl. */
  message: string | undefined;
  /** Hover-teksten. Generisk for `format`/`schema`, den fulde besked for `bounds`/`rule`. */
  tooltip: string | undefined;
}>;

const NO_ISSUE_TEXT: FieldIssueText = Object.freeze({ message: undefined, tooltip: undefined });

/**
 * Vælger feltets aktive issue og udleder begge tekster.
 *
 * Descriptorens eget issue har forrang; et eksternt collection-/tværfelt-issue vises kun, når feltet ikke selv
 * har et format-/bounds-/rule-issue (§1.8: højst én aktiv rød fejl + ét tooltip, og den mest direkte vælges).
 */
export const resolveFieldIssueText = (
  ownIssue: FieldIssue | undefined,
  externalIssue?: FieldIssue
): FieldIssueText => {
  const active = ownIssue ?? externalIssue;
  if (active === undefined) return NO_ISSUE_TEXT;
  return Object.freeze({ message: active.message, tooltip: resolveFieldIssueTooltip(active) });
};
