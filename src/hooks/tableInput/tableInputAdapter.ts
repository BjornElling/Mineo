import type * as React from 'react';

import type { CommittedPayload } from '../../types/parserSpec';

export type TableAdapterParseResult<TModel> =
  | Readonly<{ ok: true; value: TModel; visualErrorMessage?: string }>
  | Readonly<{ ok: false; errorMessage: string }>;

export type TableInputPasteResult = Readonly<{
  draft: string;
  caretPosition?: number;
}> | null;

export type TableInputAdapter<TModel, TCanonical extends string, TFingerprint extends string> = Readonly<{
  format: (value: TModel) => string;
  toDraftString?: (value: TModel) => string;
  toClipboardString?: (value: TModel) => string;
  parse: (draft: string) => TableAdapterParseResult<TModel>;
  toCommittedPayload: (value: TModel) => CommittedPayload<TModel, TCanonical, TFingerprint>;
  isValidStartKey: (key: string) => boolean;
  /** Udelad, når inputtet skal ignorere paste-events og bevare browserens/standardhåndteringen urørt. */
  applyPaste?: (
    raw: string,
    context: Readonly<{
      currentDraft: string;
      isEditing: boolean;
      selectionStart: number | null;
      selectionEnd: number | null;
    }>
  ) => TableInputPasteResult;
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
   * Styrer, om en succesfuldt committet draft med visual-only valideringsfejl
   * (fx en tilladt, men uden-for-interval dato) forbliver synlig efter
   * committed-value-resync.
   *
   * Default: true. Sæt til false, når den committede display-værdi er den kanoniske
   * UI-repræsentation, og draft-formen ikke bør bevares alene, fordi feltet
   * har en visuel valideringsfejl.
   */
  preserveVisualErrorDraft?: boolean;
  /**
   * Rydder lokal input-/save-error-state, så snart brugeren redigerer draften.
   *
   * Default: false. Brug til afgrænsede inputs, hvor tastning forventes at være et
   * nyt korrektionsforsøg. Den validerer eller committer ikke under onChange.
   */
  clearErrorOnChange?: boolean;
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
   * uden at re-parse display-strengen. Implementér dette på adaptere, der kan
   * producere en visualErrorMessage fra parse(), så committedVisualError kan
   * udledes direkte fra modellen i stedet for at gen-invoke parse().
   *
   * Udelad (eller returnér '') når den committede værdi ikke bærer nogen visuel fejl.
   */
  getCommittedVisualError?: (value: TModel) => string;
}>;
