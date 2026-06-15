import type * as React from 'react';

import type { CommittedPayload } from '../../types/parserSpec';

export type TableAdapterParseResult<TModel> =
  | Readonly<{ ok: true; value: TModel; visualErrorMessage?: string }>
  | Readonly<{ ok: false; errorMessage: string }>;

export type TableInputPasteResult = Readonly<{
  draft: string;
  caretPosition?: number;
}> | null;

export type TableInputPasteContext = Readonly<{
  currentDraft: string;
  isEditing: boolean;
  selectionStart: number | null;
  selectionEnd: number | null;
}>;

/**
 * Indsætter normaliseret paste-tekst ved markørens position (eller erstatter en markeret
 * selektion) i et tabel-inputs aktive draft, og returnerer den nye draft + caret-position.
 *
 * Splice-aritmetikken var tidligere kopieret verbatim i alle paste-adaptere (amount/date/
 * integer/percent/week/year). Per-adapter afviger kun i `normalizeXxxPaste` og eventuelle
 * efter-splice-guards (fx amounts unary-minus-afvisning), som bliver i den enkelte adapter.
 */
export const spliceDraftPaste = (
  context: TableInputPasteContext,
  normalized: string
): { draft: string; caretPosition: number } => {
  const start = typeof context.selectionStart === 'number' ? context.selectionStart : context.currentDraft.length;
  const end = typeof context.selectionEnd === 'number' ? context.selectionEnd : start;
  return {
    draft: context.currentDraft.slice(0, start) + normalized + context.currentDraft.slice(end),
    caretPosition: start + normalized.length,
  };
};

export type TableInputAdapter<TModel, TCanonical extends string, TFingerprint extends string> = Readonly<{
  format: (value: TModel) => string;
  toDraftString?: (value: TModel) => string;
  toClipboardString?: (value: TModel) => string;
  parse: (draft: string) => TableAdapterParseResult<TModel>;
  toCommittedPayload: (value: TModel) => CommittedPayload<TModel, TCanonical, TFingerprint>;
  isValidStartKey: (key: string) => boolean;
  /** Udelad, når inputtet skal ignorere paste-events og bevare browserens/standardhåndteringen urørt. */
  applyPaste?: (raw: string, context: TableInputPasteContext) => TableInputPasteResult;
  filterKeyDown?: (
    e: React.KeyboardEvent<HTMLInputElement>,
    context: Readonly<{ isEditing: boolean; hasError: boolean }>
  ) => boolean;
  normalizeDraftChange?: (draft: string) => string;
  /**
   * Styrer, om en ikke-committbar draft overlever committed-value-resyncs.
   *
   * Default: true. Sæt kun til false for inputs, hvor hver draft er committbar,
   * og forældet lokal draft-tekst straks skal vige for den committede værdi.
   */
  preserveInvalidDraft?: boolean;
  /**
   * Rydder touched-state, når brugeren redigerer draften til en tom streng.
   *
   * Default: false. Brug til inputs, hvis tomme draft midlertidigt skal fjerne
   * den røde commit-error-UI indtil næste eksplicitte commit.
   */
  clearTouchedOnEmptyDraft?: boolean;
  /**
   * Registrerer ikke-committbare input-fejl i save-error-registret.
   *
   * Default: false. Aktivér til tabel-inputs, hvor en ugyldig draft skal blokere
   * save, indtil brugeren committer en gyldig værdi eller annullerer/gendanner draften.
   */
  useSaveError?: boolean;
  /**
   * Returnerer en visual-only fejlbesked for en allerede-committet model-værdi,
   * uden at re-parse display-strengen.
   *
   * PÅKRÆVET sammen med `parse().visualErrorMessage`: `useTableInputCore` reconciler den lokale
   * visual-fejl mod den committede værdi via denne funktion, så snart cellen ikke redigeres. En
   * adapter der returnerer `visualErrorMessage` UDEN `getCommittedVisualError` ville få sin visual-
   * fejl ryddet straks ved editor-luk. Implementér derfor altid begge (eller ingen af dem).
   *
   * Udelad (eller returnér '') når den committede værdi ikke bærer nogen visuel fejl.
   */
  getCommittedVisualError?: (value: TModel) => string;
}>;
