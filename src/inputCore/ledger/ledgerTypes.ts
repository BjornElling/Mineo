import type { SectionKey } from '../fieldAddress';

// Maskinlæsbare COVERAGE-REGISTRE med én dataidentitet pr. felt, collection og makro-consumer.
//
// **Levende og load-bearing (R1-F06).** Typerne beskrev sig selv som midlertidige migrationsinventarer, der
// skulle slettes efter cutoveren. De er i stedet blevet en release-gate: `verify:ledgers` kører som del af
// `verify:release`, og registrene er den opregnelige mængde, completeness-testene måler dækning imod.
// Deres levende ansvar er SCHEMA-/CONSUMERDRIFT — at et nyt felt, en ny collection eller et nyt entrypoint
// ikke kan glide ind uregistreret, og at et registreret symbol ikke kan forsvinde ubemærket.
//
// De er coverage-registre og ikke runtime-routere: de opregner, hvad der findes, og afgør intet om, hvad der
// sker. Den grænse er fortsat bindende.

/** Codec-familier på tværs af form og grid (§3.3). Én familie pr. inputtype. */
export type CodecFamily =
  | 'date'
  | 'amount'
  | 'percent'
  | 'integer'
  | 'fraction'
  | 'week'
  | 'year'
  | 'text'
  | 'optionalText'
  | 'choice'
  | 'boolean';

export type ControlKind = 'text' | 'choice' | 'toggle';

export type { SectionKey };
