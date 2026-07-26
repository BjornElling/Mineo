/**
 * Hovedappens definition-alias (Fase 5, pass 0).
 *
 * `DocumentDefinition` er generisk over fire parametre, fordi kernen ikke må kende nogen apps
 * settings- eller brevhoved-type (standalone MinProcesrente har hverken `AppSettings` eller
 * brevhoved). Men hovedappens 18 definitioner binder altid de samme to, og at gentage dem i hver
 * definition ville være støj, der samtidig kunne drifte.
 *
 * Derfor dette alias: ÉT sted binder hovedappens definitioner deres settings- og brevhoved-kontrakt.
 *
 * Bemærk at `TSettings` er `SourceSettings` og ikke `AppSettings`: definitionerne læser kun
 * de source-relevante værdier (format, brevhoved-flags, EO-regelpolitik), og afhængighedspilen peger
 * fortsat UI → dokument.
 *
 * `AppSettings` opfylder IKKE længere kontrakten strukturelt (WI-009): `SourceSettings` er nominel, og
 * `projectSourceSettings` er dens eneste konstruktør. UI-laget skal derfor projicere eksplicit —
 * hovedappen gør det i `useMineoDocumentEnvironment`. Det er tilsigtet: så kan en dokumentdefinition
 * ikke læse en indstilling uden for `SOURCE_SETTINGS_KEYS` og dermed indføre en source-afhængighed,
 * der ikke gør et optaget `EvaluationSourceToken` stale.
 */
import type { DocumentDefinition } from './documentDefinition';
import type { DocumentBrevhovedType } from '../layout/documentBrevhoved';
import type { SourceSettings } from '../../settings/sourceSettings';

/**
 * En definition i hovedappen. `TRequest` er `void` for de outputs, der kun findes i én instans;
 * rækkebaserede outputs (`rente`, `regulering` pr. ansættelsesforhold) binder deres egen
 * identitetstype.
 */
export type MineoDocumentDefinition<TInput, TRequest = void> = DocumentDefinition<
  TRequest,
  TInput,
  SourceSettings,
  DocumentBrevhovedType
>;

/**
 * Konstruktør for hovedappens definitioner.
 *
 * Findes fordi `defineDocumentOutput` inferer `TBrevhovedKey` fra det konkrete literal i
 * `brevhoved` (fx `'shDage'`), hvilket giver en definition, der er SMALLERE end
 * `MineoDocumentDefinition` og derfor ikke kan tildeles den: `DocumentBrevhovedPolicy` er invariant i
 * sin nøgletype. At binde nøgletypen her ét sted er bedre end at annotere hver af de 18 definitioner
 * — og bedre end at gøre policyen kovariant, hvilket ville tillade en fremmed nøgle.
 */
export const defineMineoDocument = <TInput, TRequest = void>(
  definition: MineoDocumentDefinition<TInput, TRequest>
): MineoDocumentDefinition<TInput, TRequest> => Object.freeze(definition);
