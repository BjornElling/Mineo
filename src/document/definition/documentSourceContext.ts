/**
 * Kildekonteksten en dokumentdefinition projicerer fra, og den typebundne memo, der gør det gratis
 * for flere outputs at dele én dyr domæneprojektion.
 *
 * **Hvorfor `InputEvaluation` og ikke bare `InputReader`:** `evaluation.reader` og
 * `evaluation.issues` er bundet til det SAMME `EvaluationSourceToken` af `createInputEvaluation`.
 * Flere domæneprojektioner har brug for begge — fx udleder EO's importkilde sine kilde-issues af
 * `evaluation.issues.all`. At sende kun readeren ville tvinge hver definition til at genudlede
 * issue-siden og dermed introducere netop den drift, den fælles definition forbyder.
 *
 * **Hvorfor en memo:** fire EO-dokumenter deler én reader-projektion + ét gate-sæt (som kører
 * `collectAllEoRows`); fire EET-faner deler én projektion; to rente- og to årsløn-outputs ligeledes.
 * Uden memo ville den reaktive knap-gate køre den samme aggregering fire gange pr. render.
 *
 * **Hvorfor nøglen er builderen selv (den aktuelle implementering-rettelse):** memoen var oprindeligt
 * `shared<T>(key: object, compute: () => T)`, hvor cachen gemte `unknown` og castede til kalderens
 * frit valgte `T`. Samme nøgle kunne derfor lovligt genbruges med en anden forventet type og
 * returnere den første værdi under forkert statisk type — et typehul, ikke bare en skønhedsfejl.
 * Nu ER builder-funktionen både nøgle og beregning, så nøgle og resultattype ikke kan komme fra hinanden.
 *
 * Cachens levetid er kontekstobjektets: én pr. revision på render-siden, én pr. aktivering i
 * preflighten. Nøglen er altså aldrig tokenet — to kontekster med samme token er stadig to
 * selvstændige, immutable snapshots, og cachen kan derfor aldrig udlevere et resultat, der hører til
 * et andet input eller andre settings.
 *
 * **`settings` er GATE-settings og intet andet.** Konteksten bar før hele hovedappens
 * `SourceSettings`, som også indeholder `documentDownloadFormat`. Enhver definition kunne derfor
 * lovligt forgrene sin gate på det valgte outputformat — en usynlig, formatafhængig blokering, som
 * §A2a's krav om samme definition i begge kanaler ikke fanger, fordi begge kanaler ville se den
 * samme skæve gate. Formatet og brevhovedet bor nu i miljøets `renderSettings` og læses først EFTER
 * gaten; her er de ikke i typen, så et forsøg på at læse dem er en compilerfejl.
 */
import type { InputEvaluation } from '../../inputCore/inputReader';

/**
 * En delt, memoiserbar domæneprojektion. Fordi builderen selv er nøglen, er `T` bundet til den ene
 * funktion — der findes ingen vej til at læse samme slot som en anden type.
 */
export type SharedProjectionBuilder<TGateSettings, T> = (context: DocumentSourceContext<TGateSettings>) => T;

export type DocumentSourceContext<TGateSettings> = Readonly<{
  evaluation: InputEvaluation;
  /** Den gate-relevante politik. Format og brevhoved findes bevidst IKKE her. */
  settings: TGateSettings;
  /**
   * Kør `builder` én gang pr. kontekst og genbrug resultatet. `builder` skal være en modul-lokal,
   * stabil reference (typisk en top-level `const`), ellers rammer to kald aldrig samme slot.
   */
  shared: <T>(builder: SharedProjectionBuilder<TGateSettings, T>) => T;
}>;

export const createDocumentSourceContext = <TGateSettings>(
  evaluation: InputEvaluation,
  settings: TGateSettings
): DocumentSourceContext<TGateSettings> => {
  const memo = new Map<SharedProjectionBuilder<TGateSettings, unknown>, unknown>();

  const context: DocumentSourceContext<TGateSettings> = Object.freeze({
    evaluation,
    settings,
    shared: <T>(builder: SharedProjectionBuilder<TGateSettings, T>): T => {
      const cached = memo.get(builder as SharedProjectionBuilder<TGateSettings, unknown>);
      if (cached !== undefined || memo.has(builder as SharedProjectionBuilder<TGateSettings, unknown>)) {
        // Nøglen ER builderen, så det cachede resultat kan kun stamme fra netop denne `T`.
        return cached as T;
      }
      const value = builder(context);
      memo.set(builder as SharedProjectionBuilder<TGateSettings, unknown>, value);
      return value;
    },
  });

  return context;
};
