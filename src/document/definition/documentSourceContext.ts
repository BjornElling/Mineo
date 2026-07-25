/**
 * Kildekonteksten en dokumentdefinition projicerer fra, og den typebundne memo, der gør det gratis
 * for flere outputs at dele én dyr domæneprojektion (Fase 5).
 *
 * **Hvorfor `InputEvaluation` og ikke bare `InputReader`:** `evaluation.reader` og
 * `evaluation.issues` er bundet til det SAMME `EvaluationSourceToken` af `createInputEvaluation`.
 * Flere domæneprojektioner har brug for begge — fx udleder EO's importkilde sine kilde-issues af
 * `evaluation.issues.all`. At sende kun readeren ville tvinge hver definition til at genudlede
 * issue-siden og dermed introducere netop den drift, Fase 5 fjerner.
 *
 * **Hvorfor en memo:** fire EO-dokumenter deler én reader-projektion + ét gate-sæt (som kører
 * `collectAllEoRows`); fire EET-faner deler én projektion; to rente- og to årsløn-outputs ligeledes.
 * Uden memo ville den reaktive knap-gate køre den samme aggregering fire gange pr. render.
 *
 * **Hvorfor nøglen er builderen selv (pass 0-rettelse):** memoen var oprindeligt
 * `shared<T>(key: object, compute: () => T)`, hvor cachen gemte `unknown` og castede til kalderens
 * frit valgte `T`. Samme nøgle kunne derfor lovligt genbruges med en anden forventet type og
 * returnere den første værdi under forkert statisk type — et typehul, ikke bare en skønhedsfejl.
 * Nu ER builder-funktionen både nøgle og beregning, så nøgle og resultattype ikke kan komme fra hinanden.
 *
 * Cachens levetid er kontekstobjektets: én pr. revision på render-siden, én pr. aktivering i
 * preflighten. Nøglen er altså aldrig tokenet — to kontekster med samme token er stadig to
 * selvstændige, immutable snapshots, og cachen kan derfor aldrig udlevere et resultat, der hører til
 * et andet input eller andre settings.
 */
import type { InputEvaluation } from '../../inputCore/inputReader';

/**
 * En delt, memoiserbar domæneprojektion. Fordi builderen selv er nøglen, er `T` bundet til den ene
 * funktion — der findes ingen vej til at læse samme slot som en anden type.
 */
export type SharedProjectionBuilder<TSettings, T> = (context: DocumentSourceContext<TSettings>) => T;

export type DocumentSourceContext<TSettings> = Readonly<{
  evaluation: InputEvaluation;
  settings: TSettings;
  /**
   * Kør `builder` én gang pr. kontekst og genbrug resultatet. `builder` skal være en modul-lokal,
   * stabil reference (typisk en top-level `const`), ellers rammer to kald aldrig samme slot.
   */
  shared: <T>(builder: SharedProjectionBuilder<TSettings, T>) => T;
}>;

export const createDocumentSourceContext = <TSettings>(
  evaluation: InputEvaluation,
  settings: TSettings
): DocumentSourceContext<TSettings> => {
  const memo = new Map<SharedProjectionBuilder<TSettings, unknown>, unknown>();

  const context: DocumentSourceContext<TSettings> = Object.freeze({
    evaluation,
    settings,
    shared: <T>(builder: SharedProjectionBuilder<TSettings, T>): T => {
      const cached = memo.get(builder as SharedProjectionBuilder<TSettings, unknown>);
      if (cached !== undefined || memo.has(builder as SharedProjectionBuilder<TSettings, unknown>)) {
        // Nøglen ER builderen, så det cachede resultat kan kun stamme fra netop denne `T`.
        return cached as T;
      }
      const value = builder(context);
      memo.set(builder as SharedProjectionBuilder<TSettings, unknown>, value);
      return value;
    },
  });

  return context;
};
