/**
 * Den lukkede aktivering af et dokumentoutput.
 *
 * En `DocumentAction` kan vælge et konkret output FØRST efter settle og frisk source-capture. Det
 * er nødvendigt for reguleringsknappen, hvor det committed grundlag afgør, om der skal dannes
 * regulering, KRL eller KL-lønaftaler. Selection og afvikling forbliver i samme lifecycle.
 */
import type { DocumentArtifact } from '../downloadArtifact';
import type { DocumentGenerationSession } from '../documentGenerationSession';
import type { DocumentDefinition, DocumentLabels, DocumentProjectionResult } from './documentDefinition';
import type { DocumentBrevhovedPolicy } from './documentExecutionEnvironment';
import type { DocumentGateReasons } from './documentOutcome';
import type { DocumentOutputId } from './documentOutputId';
import type { DocumentSourceContext } from './documentSourceContext';

const documentActionBrand = Symbol('DocumentAction');

/**
 * Den indkapslede renderer efter en godkendt projektion.
 *
 * **Ingen settings-parameter.** Den løftede renderer tog før `settings: TSettings` ved
 * siden af `visBrevhoved`, men parameteren blev ikke brugt af sin ENESTE producent
 * (`resolveDocumentDefinition` nedenfor lukker `input` ind og videresender kun brevhoved-beslutningen),
 * og `DocumentRenderer<TInput>` har den slet ikke. Den var altså en åben vej for en generator til at
 * læse hovedappens format og brevhoved-flags rå. Den capability må ikke findes på gate-siden.
 * Generatoren modtager stadig præcis det, §A1.4 giver den: den godkendte, tokenbundne `TInput` og den
 * afgjorte `visBrevhoved`.
 */
export type ResolvedDocumentAction<TBrevhovedKey extends string> = Readonly<{
  id: DocumentOutputId;
  labels: DocumentLabels;
  brevhoved: DocumentBrevhovedPolicy<TBrevhovedKey>;
  loadRenderer: () => Promise<(
    session: DocumentGenerationSession,
    visBrevhoved: boolean
  ) => Promise<DocumentArtifact>>;
}>;

export type DocumentActionProjection<TBrevhovedKey extends string> =
  | Readonly<{ status: 'ready'; document: ResolvedDocumentAction<TBrevhovedKey> }>
  | Readonly<{ status: 'blocked'; reasons: DocumentGateReasons }>;

/**
 * Et aktiveringsobjekt er nominalt, så React ikke kan koble gate og download fra forskellige
 * implementeringer. Kun fabrikkens resolver kan udstede en operation til livscyklussen.
 */
export type DocumentAction<TRequest, TGateSettings, TBrevhovedKey extends string> = Readonly<{
  readonly [documentActionBrand]: true;
  /** Fallback-diagnostik før et dynamisk output er valgt. */
  id: DocumentOutputId;
  labels: DocumentLabels;
  resolve: (context: DocumentSourceContext<TGateSettings>, request: TRequest) => DocumentActionProjection<TBrevhovedKey>;
}>;

export const defineDocumentAction = <TRequest, TGateSettings, TBrevhovedKey extends string>(
  action: Omit<DocumentAction<TRequest, TGateSettings, TBrevhovedKey>, typeof documentActionBrand>
): DocumentAction<TRequest, TGateSettings, TBrevhovedKey> => Object.freeze({
  ...action,
  [documentActionBrand]: true as const,
});

/** Løfter en almindelig typed definition til lifecycle-aktionens lukkede rendererform. */
export const resolveDocumentDefinition = <TRequest, TInput, TGateSettings, TBrevhovedKey extends string>(
  definition: DocumentDefinition<TRequest, TInput, TGateSettings, TBrevhovedKey>,
  context: DocumentSourceContext<TGateSettings>,
  request: TRequest
): DocumentActionProjection<TBrevhovedKey> => {
  const projection: DocumentProjectionResult<TInput> = definition.project(context, request);
  if (projection.status === 'blocked') return projection;

  const input = projection.input;
  return {
    status: 'ready',
    document: Object.freeze({
      id: definition.id,
      labels: definition.labels,
      brevhoved: definition.brevhoved,
      loadRenderer: async () => {
        const renderer = await definition.loadRenderer();
        return (session, visBrevhoved) => renderer(session, input, { visBrevhoved });
      },
    }),
  };
};

/** Den almindelige case: ét output svarer direkte til én typed definition. */
export const documentActionFromDefinition = <TRequest, TInput, TGateSettings, TBrevhovedKey extends string>(
  definition: DocumentDefinition<TRequest, TInput, TGateSettings, TBrevhovedKey>
): DocumentAction<TRequest, TGateSettings, TBrevhovedKey> => defineDocumentAction({
  id: definition.id,
  labels: definition.labels,
  resolve: (context, request) => resolveDocumentDefinition(definition, context, request),
});
