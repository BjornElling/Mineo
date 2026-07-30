/**
 * Hovedappens definition-alias.
 *
 * `DocumentDefinition` er generisk over fire parametre, fordi kernen ikke må kende nogen apps
 * settings- eller brevhoved-type (standalone MinProcesrente har hverken `AppSettings` eller
 * brevhoved). Men hovedappens 18 definitioner binder altid de samme to, og at gentage dem i hver
 * definition ville være støj, der samtidig kunne drifte.
 *
 * Derfor dette alias: ÉT sted binder hovedappens definitioner deres settings- og brevhoved-kontrakt.
 *
 * **Gate-settings er `EoRowPolicy` og ikke `SourceSettings`.** Definitionernes `project` har
 * præcis ÉN settings-afhængighed i produktionen: EO's rækkepolitik (`eoDocumentDefinitions.ts`).
 * Formatet og brevhoved-flagene bor i miljøets `renderSettings` og anvendes først EFTER gaten, fordi
 * formatet vælger writer og ikke dækning. Var hele `SourceSettings` fortsat gate-halvdelen, kunne
 * enhver definition lovligt gøre samme sag `ready` som PDF og `blocked` som Word — en skæv gate,
 * §A2a's paritet mellem reaktiv gate og click-preflight IKKE fanger, fordi begge kanaler ville se
 * samme skævhed. Nu er et sådant læs en compilerfejl frem for en regel, et værn skal overvåge.
 *
 * `AppSettings` opfylder ikke kontrakten strukturelt: begge halvdele er nominelle, og deres
 * projektorer er deres eneste konstruktører. UI-laget skal derfor projicere eksplicit — hovedappen gør
 * det i `useMineoDocumentEnvironment`. Det er tilsigtet: så kan en dokumentdefinition ikke læse en
 * indstilling uden for `SOURCE_SETTINGS_KEYS` og dermed indføre en source-afhængighed, der ikke gør et
 * optaget `EvaluationSourceToken` stale.
 */
import type { DocumentDefinition } from './documentDefinition';
import type { DocumentBrevhovedType } from '../layout/documentBrevhoved';
import type { EoRowPolicy } from '../../settings/sourceSettings';

/**
 * Hovedappens GATE-settings: alt, en definitions `project` må se. Aliasset findes, så de 18
 * definitioner ikke hver især navngiver rækkepolitikken — og så en udvidelse af gate-fladen sker ét
 * sted, hvor den kan begrundes.
 */
export type MineoDocumentGateSettings = EoRowPolicy;

/**
 * En definition i hovedappen. `TRequest` er `void` for de outputs, der kun findes i én instans;
 * rækkebaserede outputs (`rente`, `regulering` pr. ansættelsesforhold) binder deres egen
 * identitetstype.
 */
export type MineoDocumentDefinition<TInput, TRequest = void> = DocumentDefinition<
  TRequest,
  TInput,
  MineoDocumentGateSettings,
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
