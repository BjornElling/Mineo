/**
 * Kildekonteksten en dokumentdefinition projicerer fra, og den token-nøglede memo, der gør det
 * gratis for flere outputs at dele én dyr domæneprojektion (Fase 5).
 *
 * **Hvorfor `InputEvaluation` og ikke bare `InputReader`:** `evaluation.reader` og
 * `evaluation.issues` er bundet til det SAMME `EvaluationSourceToken` af `createInputEvaluation`.
 * Flere domæneprojektioner har brug for begge — fx udleder EO's importkilde
 * (`buildMidlertidigtEetInsertSource`) sine kilde-issues af `evaluation.issues.all`. At sende kun
 * readeren ville tvinge hver definition til at genudlede issue-siden og dermed introducere netop
 * den drift, Fase 5 fjerner.
 *
 * **Hvorfor en memo:** fire EO-dokumenter deler én `buildErstatningsopgoerelseReaderProjection` +
 * én `evaluateErstatningsopgoerelseDownloadGates` (som kører `collectAllEoRows`); fire EET-faner
 * deler én `buildErhvervsevnetabReaderProjection`; to rente- og to årsløn-outputs deler ligeledes
 * hver sin. Uden memo ville den reaktive knap-gate køre den samme aggregering fire gange pr.
 * render. Nøglen er kildekonteksten SELV (objektidentitet) — ikke tokenet: to forskellige
 * kontekster med samme token er stadig to selvstændige, immutable snapshots, og render-siden
 * genbruger bevidst ét kontekstobjekt pr. revision. Cachen kan derfor aldrig udlevere et
 * resultat, der hører til et andet input eller andre settings.
 */
import type { InputEvaluation } from '../../inputCore/inputReader';
import type { DocumentSettings } from '../layout/documentBrevhoved';

export type DocumentSourceContext = Readonly<{
  evaluation: InputEvaluation;
  settings: DocumentSettings;
  /**
   * Memoiserer delt domænearbejde for netop denne kontekst. `key` skal være en modul-lokal,
   * stabil reference (typisk selve builder-funktionen), så to domæner ikke kan kollidere.
   */
  shared: <T>(key: object, compute: () => T) => T;
}>;

/**
 * Bygger en kildekontekst med sin egen, isolerede memo. Kaldes ét sted pr. render (den reaktive
 * gate) og ét sted pr. aktivering (click-preflighten), så delt arbejde deles inden for én
 * evaluering — men aldrig hen over to.
 */
export const createDocumentSourceContext = (
  evaluation: InputEvaluation,
  settings: DocumentSettings
): DocumentSourceContext => {
  const memo = new Map<object, unknown>();
  return Object.freeze({
    evaluation,
    settings,
    shared: <T>(key: object, compute: () => T): T => {
      if (memo.has(key)) {
        return memo.get(key) as T;
      }
      const value = compute();
      memo.set(key, value);
      return value;
    },
  });
};
