import { captureStableSource, type EvaluationSourceToken } from '../evaluationSource';
import { readSourceToken } from './evaluationSourceBinding';
import type { SlimInputStore } from './slimInputStore';
import {
  type ActiveEditor,
  type ActiveEditorRegistry,
  type EditorFocusTarget,
} from './activeEditorRegistry';

// Den ene barriere for handlinger, der aflæser, erstatter eller kan unmount'e autoritativt sagsinput
// (`critical-action-contract.md` §2 og §6). Navigation settler åbne editorer; save/download settler først
// og evaluerer derefter et FRISK `EvaluationSourceToken`; load/reset/`Slet alt` gennemføres UDEN settle,
// fordi draften aldrig må blokere en replacement; undo/redo er et stille no-op med en åben editor.
//
// Coordinatoren ejer KUN editor-/transaktionsklargøring. Dokumentets dependencies, gate og
// output-invariants ejes af dokumentdefinitionen; `.eo`-save-evalueringen ejes af caseporten (inputkernen).
// Her afsluttes kun editoren, og der leveres et frisk kildesnapshot til den efterfølgende use-case.

/**
 * De kritiske handlinger, klassificeret efter `critical-action-contract.md` §1.4. `load` dækker manuel/PWA-indlæsning,
 * reset OG `Slet alt`: de deler den samme no-settle-regel, fordi en gennemført handling under alle
 * omstændigheder erstatter eller sletter det input, draften kunne være blevet til (§7).
 */
export type CriticalAction = 'save' | 'download' | 'navigate' | 'reload' | 'load' | 'undo' | 'redo';

/**
 * Hvordan den åbne editor behandles for en given handling (§1.4):
 * - `settle`: afslut editoren gennem normal settle-sti, også ved fejlende settle
 *   (save/download/navigate/reload).
 * - `replace`: klargør uden settle; replacement-porten kasserer først draften efter vellykket apply.
 * - `noop`: handlingen må ikke nå history, mens editoren er åben.
 */
type EditorHandling = 'settle' | 'replace' | 'noop';

const EDITOR_HANDLING: Readonly<Record<CriticalAction, EditorHandling>> = {
  save: 'settle',
  download: 'settle',
  navigate: 'settle',
  reload: 'settle',
  load: 'replace',
  undo: 'noop',
  redo: 'noop',
};

/**
 * Resultatet af klargøringen. `committed` bærer et frisk `EvaluationSourceToken`, som save/download evaluerer
 * imod (§5): en godkendelse fra et tidligere token må ikke genbruges. `noop` er undo/redo med åben editor.
 * `blocked` opstår kun fail-closed ved en uventet fejl under settle (§2).
 */
export type CriticalActionPreparationResult =
  | Readonly<{ status: 'committed'; token: EvaluationSourceToken }>
  | Readonly<{ status: 'noop'; reason: 'editor-open' }>
  | Readonly<{
      status: 'blocked';
      reason: 'settle-failed';
      editorId: string;
      target: EditorFocusTarget | null;
    }>;

/**
 * En kritisk mutation må afsluttes i samme stack frame. Den betingede type gør en callback med
 * `PromiseLike`-retur til `never`, så `async` ikke kan snige sig ind gennem en generisk returtype.
 */
type SynchronousResult<T> = [Extract<T, PromiseLike<unknown>>] extends [never] ? T : never;

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === 'object' && value !== null) || typeof value === 'function'
    ? typeof Reflect.get(value, 'then') === 'function'
    : false;

/**
 * Én barriere pr. app-runtime (§2). Samtidige klargøringer serialiseres, så den samme editor aldrig
 * finaliseres parallelt. Coordinatoren rører ikke DOM, parsing eller persistence; den kalder kun editorens
 * settle og læser et frisk token fra den levende store.
 */
export class CriticalActionCoordinator {
  private preparationTail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: SlimInputStore,
    private readonly registry: ActiveEditorRegistry
  ) {}

  prepare(action: CriticalAction): Promise<CriticalActionPreparationResult> {
    // Serialisér klargøringer (contract §2): to samtidige kritiske handlinger må aldrig settle den samme åbne
    // editor parallelt. Det efterfølgende I/O-flow ejes fortsat af use-casen.
    const preparation = this.preparationTail
      .catch(() => undefined)
      .then(() => this.prepareSerial(action));
    this.preparationTail = preparation.catch(() => undefined);
    return preparation;
  }

  /**
   * Udfører den autoritative replace/clear/reset-transaktion og kasserer først derefter en eventuel åben draft.
   * Ved annullering eller apply-fejl skal kalderen undlade dette kald eller kaste; begge dele bevarer draften.
   *
   * `apply` skal være SYNKRON. Draft-discard rammer præcis den editor, der var åben, da handlingen
   * begyndte – jf. `discardReplacedDraft` – og en asynkron apply ville lade brugeren åbne en NY editor i den
   * netop erstattede sag, hvis draft så blev kasseret bagefter. Metadata-/filhåndtags-synkronisering hører
   * derfor uden for barrieren; den ejer ikke replacement-transaktionen.
   */
  applyReplacement<T>(apply: () => SynchronousResult<T>): Promise<T> {
    const replacement = this.preparationTail
      .catch(() => undefined)
      .then(() => {
        const editorBefore = this.registry.getEditing();
        const generationBefore = this.store.getState().replacementGeneration;
        const result = apply();
        // Defense-in-depth mod JavaScript-kald og usikre casts. Typegrænsen ovenfor er den primære
        // barriere; runtime-værnet sikrer, at en thenable aldrig kan optræde som en godkendt replacement.
        if (isPromiseLike(result)) {
          throw new Error('Replacement-handlingen skal være synkron.');
        }
        if (this.store.getState().replacementGeneration === generationBefore) {
          throw new Error('Replacement-handlingen afsluttede uden en autoritativ input-replacement.');
        }
        this.discardReplacedDraft(editorBefore);
        return result;
      });
    this.preparationTail = replacement.catch(() => undefined);
    return replacement;
  }

  /**
   * Udfører en bekræftet destruktiv deltransaktion uden først at settle editoren. Draften kasseres først efter
   * et succesfuldt apply; en exception bevarer både afsluttet input og editor. Bruges kun til sektionsafgrænset
   * "Slet alle indtastninger", hvor hel-sags-replacement-generationen ikke skal flyttes.
   *
   * Som `applyReplacement` skal `apply` være SYNKRON og discard rammer den editor, der var åben ved starten.
   */
  applyDestructive<T>(apply: () => SynchronousResult<T>): Promise<T> {
    const operation = this.preparationTail
      .catch(() => undefined)
      .then(() => {
        const editorBefore = this.registry.getEditing();
        const generationBefore = this.store.getState().replacementGeneration;
        const revisionBefore = this.store.getState().revision;
        const result = apply();
        if (isPromiseLike(result)) {
          throw new Error('Den destruktive handling skal være synkron.');
        }
        const stateAfter = this.store.getState();
        if (
          stateAfter.revision === revisionBefore
          && stateAfter.replacementGeneration === generationBefore
        ) {
          throw new Error('Destruktiv apply afsluttede uden en autoritativ inputtransaktion');
        }
        this.discardReplacedDraft(editorBefore);
        return result;
      });
    this.preparationTail = operation.catch(() => undefined);
    return operation;
  }

  /**
   * Kasserer PRÆCIS den draft, handlingen erstattede. Et registry-opslag EFTER apply er ikke en stabil
   * identitet: var der ingen editor åben, da handlingen begyndte, findes der ingen draft at kassere, og en editor,
   * brugeren har åbnet imens, tilhører den NYE sag. `getEditing()` kaldes igen for at bekræfte, at editoren stadig
   * er den registrerede og fortsat redigerer – er den unmountet eller udskiftet, er der intet at kassere.
   */
  private discardReplacedDraft(editorBefore: ActiveEditor | null): void {
    if (editorBefore === null) return;
    if (this.registry.getEditing() !== editorBefore) return;
    editorBefore.discard();
  }

  private async prepareSerial(action: CriticalAction): Promise<CriticalActionPreparationResult> {
    const editor = this.registry.getEditing();

    if (editor !== null && EDITOR_HANDLING[action] === 'noop') {
      return Object.freeze({ status: 'noop' as const, reason: 'editor-open' as const });
    }

    if (editor !== null && EDITOR_HANDLING[action] === 'settle') {
      const blocked = await this.settleEditor(editor);
      if (blocked !== null) return blocked;
    }

    // §3.4/contract §5: efter en vellykket klargøring læses et FRISK, stabilt kildesnapshot. Save/download
    // evaluerer imod dette token; navigation/load/undo/redo bruger det ikke, men et frisk token er altid gyldigt.
    const { token } = captureStableSource(
      () => readSourceToken(this.store),
      () => null
    );
    return Object.freeze({ status: 'committed', token });
  }

  /**
   * Afslutter editoren gennem dens egen settle. Et fejlende settle er IKKE en blokering (§1.4: fejlen bevares og
   * handlingen fortsætter) – kun en uventet exception/afvist promise er fail-closed (contract §2), fordi vi da
   * ikke kan garantere, at editoren blev finaliseret. Returnerer `null` ved succes, ellers et `blocked`-resultat.
   */
  private async settleEditor(editor: ActiveEditor): Promise<CriticalActionPreparationResult | null> {
    try {
      await editor.settle();
      return null;
    } catch {
      return Object.freeze({
        status: 'blocked' as const,
        reason: 'settle-failed' as const,
        editorId: editor.id,
        target: editor.getFocusTarget?.() ?? null,
      });
    }
  }
}
