// Der findes højst ÉN aktiv persisted editor pr. app-runtime (§2.2.1/§3.5). Registret holder den
// aktive editors settle-kald,
// isEditing-probe samt fokusmål for fail-closed-feedback.
//
// Registret ejer INGEN parsing, validering eller persistence (jf. critical-action-contract §2). Det er en ren
// beholder: React-adapteren (inputkernen) registrerer den åbne editor med et settle-kald, der internt kører
// state-machinens `settleEditor` → `settleIntentToCommand` → `dispatchInput`. Coordinatoren kalder KUN settle;
// den kender ikke felt, codec eller command.

/** Fokusmål for et blokeret/fejlende resultat. Fokuserer uden scroll, når elementet stadig er forbundet. */
export type EditorFocusTarget = Readonly<{ focus: () => void }>;

/**
 * En registreret aktiv editor. `settle` afslutter editoren gennem den normale settle-sti og resolver FØRST, når
 * inputtransaktionens resultat foreligger (ingen promise-tick/timeout som kvittering, jf. contract §2). Et
 * fejlende settle er stadig et gennemført settle: editoren lukker, fejlen bevares, og settle resolver normalt.
 */
export type ActiveEditor = Readonly<{
  id: string;
  isEditing: () => boolean;
  /**
   * Om den åbne draft faktisk afviger fra den afsluttede værdi, editoren blev åbnet over. Bruges KUN til
   * beskyttelse mod tab (exit-advarsel og Erstat-bekræftelse ved Hent): teksten er synligt arbejde, selv om
   * den aldrig når beregning eller `.eo`. En uændret åbning er ikke arbejde, der kan mistes.
   */
  hasDraftChanges: () => boolean;
  settle: () => void | Promise<void>;
  /** Kasserer den åbne draft uden command efter en vellykket autoritativ replacement. */
  discard: () => void;
  getFocusTarget?: () => EditorFocusTarget | null;
}>;

/**
 * Højst-én-aktiv-editor-registret. En ny registrering, mens en anden editor allerede er registreret, er en
 * invariantbrud: efter §3.5 kan der kun være én åben persisted editor. Adapteren afmelder altid den forrige,
 * før den åbner den næste, så to samtidige registreringer aldrig opstår.
 */
export class ActiveEditorRegistry {
  private active: ActiveEditor | null = null;

  register(editor: ActiveEditor): () => void {
    if (this.active !== null) {
      throw new Error(
        `ActiveEditorRegistry: der er allerede en aktiv editor (${this.active.id}); kun én må være åben ad gangen (§3.5).`
      );
    }
    this.active = editor;
    return () => {
      if (this.active === editor) this.active = null;
    };
  }

  /** Den aktuelt registrerede editor, hvis den faktisk redigerer; ellers `null`. */
  getEditing(): ActiveEditor | null {
    if (this.active === null) return null;
    return this.active.isEditing() ? this.active : null;
  }

  /** Om der står en åben, faktisk ændret draft, som brugeren kan miste ved reload eller erstatning. */
  hasChangedDraft(): boolean {
    return this.getEditing()?.hasDraftChanges() ?? false;
  }
}

/** Mineo-runtime-singleton. */
export const activeEditorRegistry = new ActiveEditorRegistry();
