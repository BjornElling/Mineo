export type InputSelectionSnapshot = Readonly<{
  selectionStart: number | null;
  selectionEnd: number | null;
}>;

export type DraftNormalizer = (draft: string) => string;

export type NormalizedSelection = Readonly<{
  selectionStart: number;
  selectionEnd: number;
}>;

const clampSelection = (value: number, max: number): number => Math.max(0, Math.min(value, max));

/**
 * Mapper en browser-selection fra rå draft til normaliseret draft.
 *
 * Bruges når `onChange` fjerner/ændrer tegn (fx tusindpunktummer i beløb). Uden denne
 * mapping skriver React den normaliserede value tilbage i inputtet, hvorefter browseren
 * typisk placerer caret'en til sidst.
 */
export const mapSelectionThroughDraftNormalization = (
  rawDraft: string,
  normalizedDraft: string,
  selection: InputSelectionSnapshot,
  normalize: DraftNormalizer
): NormalizedSelection | null => {
  if (selection.selectionStart === null || selection.selectionEnd === null) return null;

  const mapPoint = (point: number): number => {
    const rawPrefix = rawDraft.slice(0, clampSelection(point, rawDraft.length));
    return clampSelection(normalize(rawPrefix).length, normalizedDraft.length);
  };

  const start = mapPoint(selection.selectionStart);
  const end = mapPoint(selection.selectionEnd);
  return {
    selectionStart: Math.min(start, end),
    selectionEnd: Math.max(start, end),
  };
};

const applyInputSelection = (input: HTMLInputElement, selection: NormalizedSelection): void => {
  try {
    input.setSelectionRange(selection.selectionStart, selection.selectionEnd);
  } catch {
    // Browseren kan afvise selection på visse inputtyper; draften er stadig korrekt.
  }
};

export const restoreInputSelectionAfterControlledChange = (
  input: HTMLInputElement | null,
  selection: NormalizedSelection
): void => {
  if (!input) return;
  applyInputSelection(input, selection);
  if (typeof requestAnimationFrame !== 'function') return;
  requestAnimationFrame(() => {
    applyInputSelection(input, selection);
  });
};
