import { z } from 'zod';
import {
  createFieldAddress,
  type FieldAddress,
  type SectionKey,
} from './fieldAddress';
import type { FieldCodec } from './fieldCodec';
import type { PersistedInputSections } from './settledInput';

// Greenfield-kerne (§3.2): hvert persisteret brugerfelt har ÉN immutable beskrivelse med kun de egenskaber,
// der bruges nu. Kataloget er et almindeligt statisk readonly katalog, som valideres én gang — ingen
// stateful klasse, runtime-registrering, seal-lifecycle, factory-brands eller WeakSet-autorisering.

export type FieldControlKind = 'text' | 'choice' | 'toggle';

/**
 * Adressetemplaten uden konkrete entity-id'er. Statiske felter har kun property-led; dynamiske felter har
 * `entity`-led, som bindes til stabile id'er via {@link FieldDescriptor.bind}.
 */
export type FieldAddressTemplateSegment =
  | Readonly<{ kind: 'property'; name: string }>
  | Readonly<{ kind: 'entity'; collection: string }>;

export type FieldAddressTemplate = Readonly<{
  section: SectionKey;
  path: readonly FieldAddressTemplateSegment[];
  field: string;
}>;

export type CanonicalRead<T> = (sections: PersistedInputSections, address: FieldAddress) => T;
export type CanonicalWrite<T> = (
  sections: PersistedInputSections,
  address: FieldAddress,
  value: T
) => PersistedInputSections;

/**
 * Ren canonical-læsning uden issues (§3.4 pkt. 1). Relevansregler og feltvalidatorer læser HER, aldrig
 * gennem den offentlige reader — så feltvurderingen ikke bliver cirkulær.
 */
export type CanonicalView = Readonly<{
  readCanonical: <V>(field: FieldRef<V>) => V;
}>;

/**
 * Inputdrevet relevansregel (§3.1 pkt. 4). Ren funktion af andre felters canonical værdier; må ALDRIG
 * afhænge af mounted componentstate eller AppSettings for et persisteret felt (§3.1).
 */
export type RelevanceRule = (view: CanonicalView) => boolean;

export type FieldIssueSpec = Readonly<{
  reason: 'bounds' | 'rule';
  code: string;
  message: string;
  detail?: Readonly<Record<string, string | number | boolean>>;
}>;

/**
 * Feltvalidator på en canonical værdi (§1.6): kronologiske/tværgående bounds og feltplacerede domæneregler,
 * som forbliver canonical med et afledt rødt issue (i modsætning til format/range, der er rejected råtekst).
 */
export type FieldValidator<T> = (value: T, view: CanonicalView) => FieldIssueSpec | undefined;

export type FieldDescriptorConfig<T> = Readonly<{
  /** Stabil, menneskelæsbar id — den ene dataidentitet for feltet (§6.1), uafhængig af editorlokation. */
  id: string;
  template: FieldAddressTemplate;
  codec: FieldCodec<T>;
  /** Canonical tomværdi/clear-operation — obligatorisk del af hvert felt (§3.1 pkt. 3, Fase 1 trin 2). */
  emptyValue: T;
  label: string;
  controlKind: FieldControlKind;
  readCanonical: CanonicalRead<T>;
  writeCanonical: CanonicalWrite<T>;
  /** Udeladt = altid relevant. */
  relevance?: RelevanceRule;
  /** Canonical-værdi-validatorer (bounds/rule). Format/range håndteres af codecet, ikke her. */
  validators?: readonly FieldValidator<T>[];
}>;

export type FieldDescriptor<T> = FieldDescriptorConfig<T> & Readonly<{
  /** Binder templaten til konkrete entity-id'er (én pr. `entity`-led) og giver en konkret {@link FieldRef}. */
  bind: (...entityIds: readonly string[]) => FieldRef<T>;
}>;

export type FieldRef<T> = Readonly<{
  address: FieldAddress;
  descriptor: FieldDescriptor<T>;
}>;

/** Type-udslettet ref til issue-/prioritetslag, som kun behøver adresse, label og kontroltype. */
export type AnyFieldRef = Readonly<{
  address: FieldAddress;
  descriptor: Readonly<{ id: string; label: string; controlKind: FieldControlKind }>;
}>;

const idSchema = z.string().min(1).refine((v) => v.trim() === v, 'Felt-id må ikke have ydre mellemrum');
const labelSchema = z.string().min(1).refine((v) => v.trim() === v, 'Feltlabel må ikke have ydre mellemrum');

const templateSegmentCountEntities = (path: readonly FieldAddressTemplateSegment[]): number =>
  path.filter((segment) => segment.kind === 'entity').length;

const bindTemplatePath = (
  template: FieldAddressTemplate,
  entityIds: readonly string[]
): FieldAddress['path'] => {
  const expected = templateSegmentCountEntities(template.path);
  if (entityIds.length !== expected) {
    throw new Error(`FieldDescriptor(${template.field}): forventede ${expected} entity-id'er, modtog ${entityIds.length}`);
  }
  let entityIndex = 0;
  return template.path.map((segment) => {
    if (segment.kind === 'property') return { kind: 'property' as const, name: segment.name };
    const entityId = entityIds[entityIndex];
    entityIndex += 1;
    return { kind: 'entity' as const, collection: segment.collection, entityId };
  });
};

export const defineField = <T>(config: FieldDescriptorConfig<T>): FieldDescriptor<T> => {
  idSchema.parse(config.id);
  labelSchema.parse(config.label);
  for (const [name, fn] of [
    ['parseForSettle', config.codec.parseForSettle],
    ['format', config.codec.format],
    ['formatForEdit', config.codec.formatForEdit],
    ['acceptsInitialKey', config.codec.acceptsInitialKey],
    ['readCanonical', config.readCanonical],
    ['writeCanonical', config.writeCanonical],
  ] as const) {
    if (typeof fn !== 'function') throw new Error(`FieldDescriptor(${config.id}): ${name} skal være en funktion`);
  }

  const descriptor = {
    ...config,
    codec: Object.freeze({ ...config.codec }),
    bind: (...entityIds: readonly string[]): FieldRef<T> => Object.freeze({
      address: createFieldAddress({
        section: config.template.section,
        path: bindTemplatePath(config.template, entityIds),
        field: config.template.field,
      }),
      descriptor,
    }),
  } as FieldDescriptor<T>;

  return Object.freeze(descriptor);
};

export const toAnyFieldRef = <T>(field: FieldRef<T>): AnyFieldRef => Object.freeze({
  address: field.address,
  descriptor: Object.freeze({
    id: field.descriptor.id,
    label: field.descriptor.label,
    controlKind: field.descriptor.controlKind,
  }),
});
