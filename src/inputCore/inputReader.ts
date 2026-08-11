import { cloneAndDeepFreeze } from '../utils/deepFreeze';
import {
  serializeFieldAddress,
  type CollectionRef,
} from './fieldAddress';
import type { CanonicalView, FieldRef } from './fieldDescriptor';
import type { InputCatalog } from './fieldCatalog';
import type { RejectedInput, SettledInput } from './settledInput';
import {
  buildFieldIssueMessage,
  buildFieldIssueSet,
  bindFieldIssueSnapshot,
  activeFieldIssue,
  type FieldIssue,
  type FieldIssueSet,
  type FieldIssueSnapshot,
} from './inputIssue';
import { resolveFieldLabel, toAnyFieldRef } from './fieldDescriptor';
import type { EvaluationSourceToken } from './evaluationSource';

export type EntityRef = Readonly<{ collection: CollectionRef; entityId: string }>;

// ── §3.4 pkt. 1: ValidationReader ──────────────────────────────────────────────────────────────────
// Læser afsluttet canonical/rejected input og dependencies UDEN at anvende feltissues. Kun
// input-/valideringsinfrastrukturen må bruge den. Den er grundlaget for både relevans, feltvalidatorer
// og den offentlige reader — så feltvurderingen aldrig bliver cirkulær.

export type ValidationReader = Readonly<{
  input: SettledInput;
  readCanonical: <T>(field: FieldRef<T>) => T;
  readRejected: <T>(field: FieldRef<T>) => RejectedInput | undefined;
  isRelevant: <T>(field: FieldRef<T>) => boolean;
  listEntities: (collection: CollectionRef) => readonly EntityRef[];
}>;

export const createValidationReader = (input: SettledInput, catalog: InputCatalog): ValidationReader => {
  const snapshot = cloneAndDeepFreeze(input) as SettledInput;

  const readCanonical = <T>(field: FieldRef<T>): T => {
    if (!catalog.isKnownField(field) || !catalog.containsAddressEntities(snapshot.sections, field.address)) {
      throw new Error('ValidationReader: ukendt, slettet eller forkert bundet feltreference');
    }
    return cloneAndDeepFreeze(field.descriptor.readCanonical(snapshot.sections, field.address)) as T;
  };

  const view: CanonicalView = Object.freeze({ readCanonical });

  const isRelevant = <T>(field: FieldRef<T>): boolean => {
    const relevance = field.descriptor.relevance;
    return relevance === undefined ? true : relevance(field, view);
  };

  return Object.freeze({
    input: snapshot,
    readCanonical,
    readRejected: <T>(field: FieldRef<T>): RejectedInput | undefined => {
      // Samme grænse som canonical read: ukendte/slettede refs må aldrig bruges som valideringsbypass.
      readCanonical(field);
      return snapshot.rejectedInputs[serializeFieldAddress(field.address)];
    },
    isRelevant,
    listEntities: (collection) => Object.freeze(
      catalog.listEntityIds(snapshot.sections, collection).map((entityId) =>
        Object.freeze({ collection, entityId }))
    ),
  });
};

// ── §3.4 pkt. 2: feltvalidatorerne udleder det immutable issue-snapshot ──────────────────────────────

/**
 * Bygger det immutable feltissue-snapshot fra afsluttet input. Rejected råtekst giver et `format`-issue;
 * canonical validatorer giver bounds/rule-issues (fx en out-of-bounds-værdi, der forbliver gembar i `.eo`).
 * Mounted komponenter indgår aldrig.
 *
 * Irrelevante (= skjulte, §7.3) felter giver aldrig et aktivt issue (§1.9): en rød markering, brugeren ikke
 * kan se, kan hverken rettes eller retfærdiggøres. Det gælder BEGGE fejlformer, og det er netop derfor
 * `reduceImmediateChoice` RYDDER et felt, som et valg skjuler, mens det bar en rød fejl (§7.5 pkt. 2) —
 * ellers ville en skjult rejection blokere `.eo`-save globalt (§8) uden et felt at pege på. Rydningen og
 * denne tavshed er to halvdele af samme regel: det skjulte er tavst, FORDI det er ryddet.
 */
export const deriveFieldIssueSet = (reader: ValidationReader, catalog: InputCatalog): FieldIssueSet => {
  const issues: FieldIssue[] = [];
  const view: CanonicalView = Object.freeze({ readCanonical: reader.readCanonical });

  for (const field of catalog.listFieldInstances(reader.input.sections)) {
    if (!reader.isRelevant(field)) continue;
    // Kontekstuelle labels (§3.2a) opløses HER, hvor konteksten findes: issuet skal navngive feltet med
    // præcis det navn, brugeren ser stå ved feltet i denne tilstand.
    const anyRef = toAnyFieldRef(field, view);

    const rejected = reader.readRejected(field);
    if (rejected !== undefined) {
      // Rejected råtekst er efter kravændringen 2026-07-18 altid `format` (§1.6): en schema-repræsenterbar
      // out-of-bounds-værdi er canonical og fanges i stedet af validatorerne nedenfor.
      issues.push(Object.freeze({
        kind: 'field',
        code: `${field.descriptor.id}.${rejected.reason}`,
        severity: 'error',
        field: anyRef,
        reason: rejected.reason,
        message: buildFieldIssueMessage(anyRef),
        ...(rejected.detail === undefined ? {} : { detail: rejected.detail }),
      }));
      continue;
    }

    const validators = field.descriptor.validators;
    if (validators === undefined || validators.length === 0) continue;
    const value = reader.readCanonical(field);
    // Tomhed er consumerens `missing`, aldrig en rød feltfejl.
    if (field.descriptor.isEmpty(value)) continue;
    for (const validate of validators) {
      const spec = validate(value, field, view);
      if (spec === undefined) continue;
      issues.push(Object.freeze({
        kind: 'field',
        code: spec.code,
        severity: 'error',
        field: anyRef,
        reason: spec.reason,
        message: spec.message,
        ...(spec.detail === undefined ? {} : { detail: spec.detail }),
      }));
    }
  }

  return buildFieldIssueSet(issues);
};

// ── §3.4 pkt. 3: den offentlige InputReader ─────────────────────────────────────────────────────────
// Kombinerer samme input med issue-snapshottet og SKJULER enhver værdi med en aktiv feltfejl. Ingen
// consumer må se den canonical værdi bag en rød feltfejl (§1.5/§2.1).

export type ReadFieldResult<T> =
  | Readonly<{ status: 'usable'; value: T }>
  | Readonly<{ status: 'error'; issue: FieldIssue }>;

/**
 * Den offentlige reader (design §3.4 pkt. 3).
 *
 * ⚠️ Der er BEVIDST ingen `fieldIssues: FieldIssueSnapshot` her. Et frit issue-snapshot ville lade en
 * consumer filtrere på sektionsnavn og blokere på felter, den aldrig læser. Afhængigheder ville dermed
 * være en konvention frem for en grænse. `read(field)` skjuler værdien bag en rød feltfejl og returnerer
 * issuet for netop det felt, consumeren faktisk læser.
 *
 * En projektion, der skal samle fejl fra flere reads, bruger `createTrackedInputReader`. Dermed kommer
 * issue-sættet fra de konkrete `FieldRef`s, projektionen faktisk læste, ikke fra en efterfølgende
 * sektionsscan eller en manuel tekstliste.
 */
export type InputReader = Readonly<{
  sourceToken: EvaluationSourceToken;
  read: <T>(field: FieldRef<T>) => ReadFieldResult<T>;
  listEntities: (collection: CollectionRef) => readonly EntityRef[];
  /**
   * Feltets brugervendte navn i den aktuelle kontekst (§3.2a) — det navn brugeren SER stå ved feltet.
   *
   * Kanalen er bevidst SMAL: readeren navngiver et felt, den udleverer ikke canonical værdier. En
   * kontekstuel labelregel læser andre felters canonical værdier, men gør det INDE i readeren, hvor
   * `ValidationReader` allerede ejer den grænse. Havde consumers i stedet fået en fri `CanonicalView`
   * for at kunne navngive et felt, var issue-grænsen (§1.5: ingen consumer ser værdien bag en rød
   * feltfejl) åben for enhver læser, der bare kaldte sig en labelopløser.
   *
   * Navngivning er tilladt på et felt med en rød fejl — det er netop DA, navnet skal være rigtigt.
   */
  labelOf: <T>(field: FieldRef<T>) => string;
}>;

export type TrackedInputReader = Readonly<{
  reader: InputReader;
  readIssues: () => readonly FieldIssue[];
}>;

/** Binder en issue-opsamler til præcis de feltreferencer, consumerens projektion læser. */
export const createTrackedInputReader = (reader: InputReader): TrackedInputReader => {
  const issues = new Map<string, FieldIssue>();
  return Object.freeze({
    reader: Object.freeze({
      sourceToken: reader.sourceToken,
      listEntities: reader.listEntities,
      labelOf: reader.labelOf,
      read: <T>(field: FieldRef<T>): ReadFieldResult<T> => {
        const result = reader.read(field);
        if (result.status === 'error') {
          issues.set(serializeFieldAddress(field.address), result.issue);
        }
        return result;
      },
    }),
    readIssues: () => Object.freeze([...issues.values()]),
  });
};

const createInputReader = (options: Readonly<{
  input: SettledInput;
  catalog: InputCatalog;
  issues: FieldIssueSnapshot;
}>): InputReader => {
  const validation = createValidationReader(options.input, options.catalog);
  const labelView: CanonicalView = Object.freeze({ readCanonical: validation.readCanonical });

  return Object.freeze({
    sourceToken: options.issues.sourceToken,
    read: <T>(field: FieldRef<T>): ReadFieldResult<T> => {
      const value = validation.readCanonical(field); // verificerer også kendt + eksisterende entity
      const issue = activeFieldIssue(options.issues, serializeFieldAddress(field.address));
      if (issue !== undefined) return Object.freeze({ status: 'error', issue });
      return Object.freeze({ status: 'usable', value });
    },
    labelOf: <T>(field: FieldRef<T>): string => {
      validation.readCanonical(field); // samme grænse som `read`: ukendt/forkert bundet ref er en fejl
      return resolveFieldLabel(field.descriptor, labelView);
    },
    listEntities: validation.listEntities,
  });
};

export type InputEvaluation = Readonly<{
  issues: FieldIssueSnapshot;
  reader: InputReader;
}>;

/**
 * Kobler input, issue-snapshot og token i én factory. Consumers kan derfor ikke ved en fejl sætte et gammelt
 * issue-snapshot sammen med et nyt input/token og eksponere en bounds-fejlende canonical værdi.
 *
 * **Tager ikke `settings`.** Factoryen havde tidligere en generisk `settings: TSettings` plus en
 * valgfri `deriveSettingsFieldIssues`-hook. Ingen produktionskaldssted leverede nogensinde hooken —
 * dens eneste eksercerer var en test af mekanismen selv — så `settings` blev udelukkende dybfrosset
 * og kastet væk. Den frie typeparameter var samtidig den sidste vej, ad hvilken hele `AppSettings`
 * kunne nå evalueringen. En fremtidig settings-læsning her ville derfor kunne
 * ændre et issue uden at indgå i `SOURCE_SETTINGS_KEYS` og altså uden at gøre et optaget
 * `EvaluationSourceToken` stale.
 *
 * Capabilityen er derfor FJERNET frem for bevogtet — samme afgørelse som inputkernens skrivegrænse.
 *
 * **Hvis der senere OPSTÅR behov for en settingsafhængig feltissue:** den kan ikke blot lægges i en
 * eksisterende validator. Descriptor-validatorer modtager i dag ikke `SourceSettings`, og
 * consumer-issues bliver ikke til kernens feltissues (og dermed ikke til et rødt standardfelt). En
 * sådan regel kræver altså en NY, eksplicit auditeret grænse, hvor kilden er det projekterede
 * snapshot og nøglen indgår i `SOURCE_SETTINGS_KEYS` — ikke en genindførelse af en fri
 * typeparameter her. Ingen aktuel regel har behovet.
 */
export const createInputEvaluation = (options: Readonly<{
  input: SettledInput;
  catalog: InputCatalog;
  sourceToken: EvaluationSourceToken;
}>): InputEvaluation => {
  const validation = createValidationReader(options.input, options.catalog);
  const issues = bindFieldIssueSnapshot(
    buildFieldIssueSet([...deriveFieldIssueSet(validation, options.catalog).all]),
    options.sourceToken
  );
  return Object.freeze({
    issues,
    reader: createInputReader({ input: validation.input, catalog: options.catalog, issues }),
  });
};
