import { captureStableSource, type EvaluationSourceToken } from '../evaluationSource';
import { readSourceToken } from './evaluationSourceBinding';
import type { SlimInputStore } from './slimInputStore';
import {
  type ActiveEditor,
  type ActiveEditorRegistry,
  type EditorFocusTarget,
} from './activeEditorRegistry';

// Greenfield-runtime (§2.2/§1.4, critical-action-contract): den ENE barriere for handlinger, der aflæser,
// erstatter eller kan unmount'e autoritativ sagsinput. Den er materielt anderledes end den legacy
// `CriticalActionCoordinator`: den rebasede §1.4-matrix har INGEN `block`-policy. Navigation settler begge
// surfaces; save/download settler først og evaluerer derefter et FRISK `EvaluationSourceToken`; load/reset/
// `Slet alt` gennemføres UDEN settle (draften må aldrig blokere); undo/redo er et stille no-op.
//
// Coordinatoren ejer KUN editor-/transaktionsklargøring (contract §2/§6). Dokumentets dependencies, gate og
// output-invariants ejes af dokumentdefinitionen (Fase 5); `.eo`-save-evalueringen ejes af caseporten (Fase 4).
// Her afsluttes kun editoren, og der leveres et frisk kildesnapshot til den efterfølgende use-case.

/**
 * De kritiske handlinger, klassificeret efter den rebasede §1.4-matrix. `load` dækker manuel/PWA-indlæsning,
 * reset OG `Slet alt`: de deler den samme no-settle-regel, fordi en gennemført handling under alle
 * omstændigheder erstatter eller sletter det input, draften kunne være blevet til (contract §7).
 */
export type CriticalAction = 'save' | 'download' | 'navigate' | 'load' | 'undo' | 'redo';

/**
 * Hvordan den åbne editor behandles for en given handling (§1.4):
 * - `settle`: afslut editoren gennem normal settle-sti, også ved fejlende settle (save/download/navigate).
 * - `replace`: klargør uden settle; replacement-porten kasserer først draften efter vellykket apply.
 * - `noop`: handlingen må ikke nå history, mens editoren er åben.
 */
type EditorHandling = 'settle' | 'replace' | 'noop';

const EDITOR_HANDLING: Readonly<Record<CriticalAction, EditorHandling>> = {
  save: 'settle',
  download: 'settle',
  navigate: 'settle',
  load: 'replace',
  undo: 'noop',
  redo: 'noop',
};

/**
 * Resultatet af klargøringen. `committed` bærer et frisk `EvaluationSourceToken`, som save/download evaluerer
 * imod (contract §5): en godkendelse fra et tidligere token må ikke genbruges. `noop` er undo/redo med åben editor.
 * `blocked` opstår kun fail-closed ved en uventet fejl under settle (contract §2).
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
 * Én barriere pr. app-runtime (contract §2). Samtidige klargøringer serialiseres, så den samme editor aldrig
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
   */
  applyReplacement<T>(apply: () => T | Promise<T>): Promise<T> {
    const replacement = this.preparationTail
      .catch(() => undefined)
      .then(async () => {
        const generationBefore = this.store.getState().replacementGeneration;
        const result = await apply();
        if (this.store.getState().replacementGeneration === generationBefore) {
          throw new Error('Replacement-handlingen afsluttede uden en autoritativ input-replacement.');
        }
        this.registry.getEditing()?.discard();
        return result;
      });
    this.preparationTail = replacement.catch(() => undefined);
    return replacement;
  }

  /**
   * Udfører en bekræftet destruktiv deltransaktion uden først at settle editoren. Draften kasseres først efter
   * et succesfuldt apply; en exception bevarer både afsluttet input og editor. Bruges kun til sektionsafgrænset
   * "Slet alle indtastninger", hvor hel-sags-replacement-generationen ikke skal flyttes.
   */
  applyDestructive<T>(apply: () => T | Promise<T>): Promise<T> {
    const operation = this.preparationTail
      .catch(() => undefined)
      .then(async () => {
        const generationBefore = this.store.getState().replacementGeneration;
        const revisionBefore = this.store.getState().revision;
        const result = await apply();
        const stateAfter = this.store.getState();
        if (
          stateAfter.revision === revisionBefore
          && stateAfter.replacementGeneration === generationBefore
        ) {
          throw new Error('Destruktiv apply afsluttede uden en autoritativ inputtransaktion');
        }
        this.registry.getEditing()?.discard();
        return result;
      });
    this.preparationTail = operation.catch(() => undefined);
    return operation;
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
   * handlingen fortsætter) — kun en uventet exception/afvist promise er fail-closed (contract §2), fordi vi da
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
