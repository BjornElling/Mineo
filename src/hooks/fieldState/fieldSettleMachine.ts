/**
 * Ren, React-uafhængig beslutningskerne for felt-*settle* — det delte hjerte af `useDraftField`
 * (`commitFromDraft`, form-`<input>`-surface) og `useTableInputCore` (`commitAndEmitBlur`,
 * grid-celle-editor-surface).
 *
 * Begge hooks implementerede den *samme* settle-forgrening hver for sig: parse råstrengen, og forgren
 * på (gyldig | ugyldig-med-besked | tom/partial-uden-besked). I den gyldige gren forgrenes yderligere
 * på (no-op | reel ændring), sættes den optimistiske pending-guard (`target !== formattedValueAtCommit`)
 * og synces draften til den committede repræsentation. Kommentarerne i de to hooks kryds-refererede
 * åbent hinanden ("samme determinisme som useDraftField.pendingCommitRef"). Denne funktion samler
 * forgreningen ét sted — søstermodul til {@link fieldResyncMachine} — og de to hooks driver den med
 * deres egne surface-fakta og udfører de deklarative effekter (write-rejected, value-commit, clear,
 * draft-sync, pending-guard).
 *
 * ## Beslutningen
 *
 * Feltets codec/adapter har allerede parset råstrengen til en {@link FieldSettleParse}. Kernen afgør
 * *hvad der skal ske*, uden at kende surface-specifikke effekter (form `onCommit` vs grid value-`onBlur`,
 * bundet clear-rækkefølge, visuel-fejl-state, staged rejected-clear). Den producerer en
 * {@link FieldSettleCommand}:
 *
 *  1. **`invalid`** — parse gav en ikke-committbar råstreng *med* fejlsemantik (`kind: 'invalid'`, eller
 *     en `partial`/`empty` der bærer en besked). Draften skal bevare den rå tekst, og råstrengen skal
 *     skrives til den ugyldige-draft-slot. `settle` returnerer `false` (ikke committet).
 *  2. **`inert`** — parse gav en tom/partial uden besked (fx tom draft uden krav). Der committes intet
 *     og skrives ingen rejection; den ubundne slot ryddes (bundet clear ejes af kalderens commit-wrapper).
 *     `settle` returnerer `true`.
 *  3. **`commit`** — parse var gyldig. Kommandoen bærer den canonical `value`, den committede `target`-
 *     visning, om committen er en `noop` (uændret canonical værdi), og pending-guarden. Kalderen kører
 *     sin value-commit-effekt og synker draften til `target`.
 *
 * Kernen holder ingen state og kalder ingen effekter — determinismen (rækkefølge, rollback) ejes af de
 * to drivere, præcis som {@link decideFieldResync}. Alle rå→canonical-regler forbliver i codec/adapter.
 */

export type FieldSettleParse<TValue> =
  | Readonly<{ status: 'valid'; value: TValue }>
  /** Ikke-committbar råstreng MED fejlsemantik (skal bevares som ugyldig draft). */
  | Readonly<{ status: 'invalid' }>
  /** Tom/partial UDEN fejlsemantik (ingen commit, ingen rejection). */
  | Readonly<{ status: 'inert' }>;

export type FieldSettleFacts<TValue> = Readonly<{
  /** Codec/adapterens parse af den rå draft, klassificeret til de tre settle-udfald. */
  parse: FieldSettleParse<TValue>;
  /**
   * `true` når den gyldige værdi er semantisk identisk med den aktuelt committede (grid: fingerprint-
   * match). Form-stien har ikke et selvstændigt no-op-begreb og sætter altid `false`; dens pending-guard
   * afgøres alene af `target !== formattedValueAtCommit` nedenfor, hvilket dækker det samme vindue.
   */
  isNoop: boolean;
  /** `format(committed value)` FØR committen — sammenlignes mod `target` for pending-guarden. */
  formattedValueAtCommit: string;
  /** `format(parsed value)` — den committede repræsentation draften optimistisk synces til. */
  target: string;
}>;

export type FieldSettleCommand<TValue> =
  | Readonly<{
      kind: 'invalid';
      /** Den rå tekst der skal skrives til ugyldig-draft-slotten OG vises som draft. */
      raw: string;
    }>
  | Readonly<{
      kind: 'inert';
    }>
  | Readonly<{
      kind: 'commit';
      /** Den canonical værdi kalderens value-commit-effekt skal persistere. */
      value: TValue;
      /** Den committede visning draften synces til efter en vellykket commit. */
      target: string;
      /** `true` når committen ikke ændrer den canonical værdi (kalderen springer value-effekten over). */
      noop: boolean;
      /**
       * Den optimistiske pending-guard, eller `null` når draften ikke skal holdes tilbage. Sat kun når
       * visningen faktisk ændrer sig (`target !== formattedValueAtCommit`); ellers ingen flicker-risiko,
       * og en guard der aldrig kunne divergere ville aldrig afmeldes.
       */
      pending: Readonly<{ formattedValueAtCommit: string }> | null;
    }>;

/**
 * Afgør settle-handlingen for ét commit-forsøg på en allerede parset råstreng. Ren funktion: ingen refs,
 * ingen React, ingen side-effekter — kalderen udfører det returnerede {@link FieldSettleCommand} og ejer
 * effekt-rækkefølgen (write-rejected/value-commit/clear) samt rollback ved fejl.
 */
export const decideFieldSettle = <TValue>(
  raw: string,
  facts: FieldSettleFacts<TValue>
): FieldSettleCommand<TValue> => {
  if (facts.parse.status === 'invalid') {
    return { kind: 'invalid', raw };
  }
  if (facts.parse.status === 'inert') {
    return { kind: 'inert' };
  }
  return {
    kind: 'commit',
    value: facts.parse.value,
    target: facts.target,
    noop: facts.isNoop,
    pending: facts.target !== facts.formattedValueAtCommit ? { formattedValueAtCommit: facts.formattedValueAtCommit } : null,
  };
};
