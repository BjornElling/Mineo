import { z } from 'zod';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { PERSISTED_SECTION_KEYS, type PersistedSectionKey } from '../../config/persistenceRegistry';
import { cloneAndDeepFreeze } from '../../utils/deepFreeze';
import { parseInboundPersistedSection } from '../../utils/inboundPersistedSection';
import {
  createEmptyPersistedInputSections,
  rejectedInputsSchema,
  settledInputBaseSchema,
  type PersistedInputSections,
  type SettledInput,
} from '../settledInput';

// Input-runtime (§2.1.6/§3.7): ÉN sessions-envelope. Envelopens struktur er current-only, men canonical
// sektionsdata passerer den samme versionerede inbound-kæde som `.eo`-load. Det er afgørende ved deployment
// midt i en aktiv session: et schema-bump må ikke gøre gårsdagens afsluttede input til tom data.
// Katalog-afhængig XOR-/eksistens-validering ligger på `InputCatalog` og køres af hydration/dispatch.

export const CURRENT_INPUT_ENVELOPE_VERSION = '2';

// Den nye current-session-envelope blev introduceret sammen med persisted-data-version 3.10. Kun
// versioner fra denne runtime-levetid må derfor komme ind her; en ukendt/fremtidig version må ikke
// behandles som identity, selv hvis dens payload tilfældigvis ligner det aktuelle schema.
const CURRENT_SESSION_SOURCE_VERSIONS = new Set([
  '3.10',
  '3.11',
  PERSISTED_DATA_VERSION,
]);

const currentInputEnvelopeSchema = z.object({
  envelopeVersion: z.literal(CURRENT_INPUT_ENVELOPE_VERSION),
  // Versionen er kildens autoritative nøgle til den delte sektionsmigrering. Den må ikke udledes af
  // payloadens form, da samme form kan forekomme i to schema-versioner med forskellig semantik.
  persistedDataVersion: z.string().min(1),
  input: z.object({
    sections: z.record(z.string(), z.unknown()),
    rejectedInputs: rejectedInputsSchema,
  }).strict(),
}).strict().readonly();

export type CurrentInputEnvelope = Readonly<{
  envelopeVersion: typeof CURRENT_INPUT_ENVELOPE_VERSION;
  persistedDataVersion: typeof PERSISTED_DATA_VERSION;
  input: SettledInput;
}>;

/** Serialiserer den aktuelle programversions afsluttede input til den ene sessionsnøgle. */
export const serializeCurrentEnvelope = (input: SettledInput): string => JSON.stringify({
  envelopeVersion: CURRENT_INPUT_ENVELOPE_VERSION,
  persistedDataVersion: PERSISTED_DATA_VERSION,
  input,
} satisfies CurrentInputEnvelope);

/**
 * Parser og normaliserer envelopen. Hver canonical sektion går gennem den fælles kæde
 * migrator → sanitize → schema-parse med envelope-versionens `persistedDataVersion`. Et input, som ikke kan
 * migreres helt uden at strippe en brugeroplysning, afvises fail-closed; bootstrap bevarer da de rå bytes i
 * stedet for at overskrive dem. Returnerer et dybtfrossent `SettledInput` uden katalog-XOR – det udfører
 * `catalog.validateSettledInput` i hydration/dispatch.
 */
export const parseCurrentEnvelope = (raw: string): SettledInput => {
  const parsed = currentInputEnvelopeSchema.parse(JSON.parse(raw));
  if (!CURRENT_SESSION_SOURCE_VERSIONS.has(parsed.persistedDataVersion)) {
    throw new Error(`Sessionen indeholder en ukendt persisted-data-version: ${parsed.persistedDataVersion}.`);
  }
  const rawSections = parsed.input.sections;

  for (const sectionKey of Object.keys(rawSections)) {
    if (!PERSISTED_SECTION_KEYS.includes(sectionKey as PersistedSectionKey)) {
      throw new Error(`Sessionen indeholder en ukendt sektion: ${sectionKey}.`);
    }
  }

  const sections = {
    ...createEmptyPersistedInputSections(),
  } as Record<PersistedSectionKey, unknown>;
  for (const sectionKey of PERSISTED_SECTION_KEYS) {
    const rawSection = rawSections[sectionKey];
    if (rawSection === undefined || rawSection === null) continue;

    const inbound = parseInboundPersistedSection(sectionKey, rawSection, parsed.persistedDataVersion);
    // `.eo`-load kan vise en eksplicit preflight for strippede felter. Session-bootstrap har ingen
    // sådan godkendelsesflade, så den eneste sikre adfærd er at bevare den rå envelope og låse writes.
    if (!inbound.ok || inbound.unknownPaths.length > 0 || inbound.invalidPaths.length > 0) {
      throw new Error(`Sessionens sektion ${sectionKey} kan ikke migreres uden datatab.`);
    }
    sections[sectionKey] = inbound.data;
  }

  const normalized = settledInputBaseSchema.parse({
    sections: sections as PersistedInputSections,
    rejectedInputs: parsed.input.rejectedInputs,
  });
  return cloneAndDeepFreeze(normalized) as SettledInput;
};
