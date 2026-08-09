import { z } from 'zod';
import { deepEqual } from '../utils/deepEqual';
import { cloneAndDeepFreeze } from '../utils/deepFreeze';
import { PERSISTED_SECTION_KEYS } from '../config/persistenceRegistry';
import {
  createFieldAddress,
  type FieldAddress,
  type SectionKey,
} from './fieldAddress';
import type { FieldCodec } from './fieldCodec';
import type { DateBoundsDeclaration } from './dateBoundsDeclaration';
import type { PersistedInputSections } from './settledInput';
import { amountResultBoundsValidator } from './amountResultBounds';

// Inputkernen (§3.2): hvert persisteret brugerfelt har ÉN immutable beskrivelse med kun de egenskaber,
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
export type FieldIssueSpec = Readonly<{
  reason: 'bounds' | 'rule' | 'schema';
  code: string;
  message: string;
  detail?: Readonly<Record<string, string | number | boolean>>;
}>;

/**
 * Feltvalidator på en canonical værdi (§1.6): kronologiske/tværgående bounds, feltplacerede domæneregler og
 * defense-in-depth mod schema-tolerante legacy-strenge, som feltets codec ikke kan fortolke.
 */
export type RelevanceRule<T> = (field: FieldRef<T>, view: CanonicalView) => boolean;

export type FieldValidator<T> = (
  value: T,
  field: FieldRef<T>,
  view: CanonicalView
) => FieldIssueSpec | undefined;

export type FieldDescriptorConfig<T> = Readonly<{
  /** Stabil, menneskelæsbar id — den ene dataidentitet for feltet (§6.1), uafhængig af editorlokation. */
  id: string;
  template: FieldAddressTemplate;
  codec: FieldCodec<T>;
  /** Canonical tomværdi/clear-operation — obligatorisk del af hvert felt (§3.1 pkt. 3). */
  emptyValue: T;
  /** Semantisk tomhed er eksplicit; gyldige defaults som `false` eller `'dage'` må ikke gættes som missing. */
  isEmpty: (value: T) => boolean;
  label: string;
  controlKind: FieldControlKind;
  readCanonical: CanonicalRead<T>;
  writeCanonical: CanonicalWrite<T>;
  /** Udeladt = altid relevant. */
  relevance?: RelevanceRule<T>;
  /** Canonical-værdi-validatorer (bounds/rule). Format/range håndteres af codecet, ikke her. */
  validators?: readonly FieldValidator<T>[];
  /**
   * Datofelters erklærede grænser (§1.6a). PÅKRÆVET for hvert felt med codec-familien `date` — håndhævet af
   * `dateFieldsDeclareBounds.test.ts` og `defineField`-runtimeværnet. Typesystemet kan ikke håndhæve det,
   * fordi `FieldDescriptorConfig` er generisk over `T` og ikke kan se codec-familien.
   *
   * Erklæringen findes, fordi `dateRanges.ts` tidligere DEKLAREREDE grænser, som intet bandt til
   * håndhævelsen: 31 af 54 datofelter accepterede år 1900 og år 2100 uden ét issue. Feltet gør bindingen
   * inspicerbar, så et datofelt uden grænser bliver en testfejl frem for en tavs mangel. Den bevidst
   * grænseløse form (`unconstrainedDateBounds('<begrundelse>')`) er et aktivt, dokumenteret fravalg.
   */
  dateBounds?: DateBoundsDeclaration;
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
const templatePartSchema = z.string().min(1).refine((v) => v.trim() === v, 'Templateled må ikke have ydre mellemrum');
const templatePathSegmentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('property'), name: templatePartSchema }).strict().readonly(),
  z.object({ kind: z.literal('entity'), collection: templatePartSchema }).strict().readonly(),
]);
export const fieldAddressTemplateSchema = z.object({
  section: z.enum(PERSISTED_SECTION_KEYS as [
    (typeof PERSISTED_SECTION_KEYS)[number],
    ...(typeof PERSISTED_SECTION_KEYS)[number][],
  ]),
  path: z.array(templatePathSegmentSchema).readonly(),
  field: templatePartSchema,
}).strict().readonly();

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
  const template = fieldAddressTemplateSchema.parse(config.template);
  if (config.codec.family === 'date' && config.dateBounds === undefined) {
    throw new Error(`FieldDescriptor(${config.id}): datofelter skal have en dateBounds-erklæring`);
  }
  for (const [name, fn] of [
    ['parseForSettle', config.codec.parseForSettle],
    ['format', config.codec.format],
    ['formatForEdit', config.codec.formatForEdit],
    ['acceptsInitialKey', config.codec.acceptsInitialKey],
    ['isEmpty', config.isEmpty],
    ['readCanonical', config.readCanonical],
    ['writeCanonical', config.writeCanonical],
  ] as const) {
    if (typeof fn !== 'function') throw new Error(`FieldDescriptor(${config.id}): ${name} skal være en funktion`);
  }

  const emptyValue = cloneAndDeepFreeze(config.emptyValue) as T;
  for (const raw of ['', '   ']) {
    const emptyResolution = config.codec.parseForSettle(raw);
    if (emptyResolution.status !== 'valid' || !deepEqual(emptyResolution.value, emptyValue)) {
      throw new Error(`FieldDescriptor(${config.id}): codec skal resolve semantisk tom tekst til feltets tomværdi`);
    }
  }

  // Beløbsfeltets RESULTAT-grænse er DERIVERET, ikke erklæret pr. felt (§2.2). Ciffergrænsen blokerer
  // det 8. heltalsciffer tegn for tegn, men et gyldigt UDTRYK kan regne sig forbi grænsen — `9999999*2`
  // giver 19.999.998 uden at noget enkelt talled er for langt. Den fejl kan først fanges ved settle, og
  // så skal den være en canonical rød feltfejl med konkret tooltip.
  //
  // Validatoren tilføjes derfor HER, hvor hvert eneste felt passerer, i stedet for at blive skrevet på
  // hver af de ~15 beløbsdescriptorer. Ellers ville et nyt beløbsfelt være uden grænse, indtil nogen
  // huskede den — præcis den fejlklasse, `dateFieldsDeclareBounds` blev bygget for at lukke for datoer.
  // Feltets EGNE, skarpere min/max-validators står før i listen og har derfor forrang (§1.8).
  const derivedValidators = config.codec.family === 'amount'
    ? [
        ...(config.validators ?? []),
        // Issue-prioriteten har kun `reason` og kode som tie-breaker. Det afledte værn skal derfor have
        // en sorteringskode efter feltets egne `.bounds`-/`.rule`-koder, ellers kan det maskere en skarpere
        // feltregel, selv om validatoren står sidst i listen.
        amountResultBoundsValidator(`${config.id}.zz_amountResultBounds`) as FieldValidator<T>,
      ]
    : config.validators;

  let descriptor: FieldDescriptor<T>;
  descriptor = Object.freeze({
    ...config,
    template,
    emptyValue,
    codec: Object.freeze({ ...config.codec }),
    validators: derivedValidators === undefined ? undefined : Object.freeze([...derivedValidators]),
    bind: (...entityIds: readonly string[]): FieldRef<T> => Object.freeze({
      address: createFieldAddress({
        section: template.section,
        path: bindTemplatePath(template, entityIds),
        field: template.field,
      }),
      descriptor,
    }),
  });

  return descriptor;
};

export const toAnyFieldRef = <T>(field: FieldRef<T>): AnyFieldRef => Object.freeze({
  address: field.address,
  descriptor: Object.freeze({
    id: field.descriptor.id,
    label: field.descriptor.label,
    controlKind: field.descriptor.controlKind,
  }),
});
