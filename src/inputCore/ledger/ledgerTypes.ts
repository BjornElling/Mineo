import type { SectionKey } from '../fieldAddress';

// Greenfield-kerne (§6): maskinlæsbare migrationsledgers med én dataidentitet pr. felt, collection og
// consumer. Ledgerne er coverage-backstops og migrationschecklister — ikke runtime-routere. De fastlåser
// den eksisterende, låste feature-flade, indtil de enkelte entrypoints fuses ind i `src/inputCore`-
// descriptorkataloget (Fase 1/2) og consumer-cutoveren (Fase 3–5).

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
