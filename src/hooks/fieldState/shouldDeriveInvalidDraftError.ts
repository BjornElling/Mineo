/**
 * Delt fejl-re-derivations-gate (useDraftField + useTableInputCore).
 *
 * En bevaret ikke-committbar rå draft (`effectiveInvalidDraft`) skal kun vise sin fejl, når draften
 * aktuelt VISER netop den råstreng — ikke mens brugeren taster en ny korrektion. Selve beskeden
 * gen-udledes af hver surface ved at re-parse råstrengen (single source of truth = råstrengen); denne
 * gate afgør blot *om* der overhovedet skal udledes en fejl.
 */
export const shouldDeriveInvalidDraftError = (
  effectiveInvalidDraft: string | undefined,
  draft: string
): effectiveInvalidDraft is string => effectiveInvalidDraft !== undefined && draft === effectiveInvalidDraft;
