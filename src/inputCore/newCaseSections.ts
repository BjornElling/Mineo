import { createEmptyPersistedInputSections, type SettledInputCandidate } from './settledInput';

// Inputkernen (§1.12/§2.11): ÉN sandhed om, hvilke sektionsværdier en HELT NY sag starter med.
//
// En sektion er `null`, indtil noget giver den en værdi. To ting kan gøre det: brugerens første berøring af et
// felt på siden (reduceren materialiserer sektionen fra `createEmpty<Sektion>Section` + schemaets defaults),
// eller en NY-SAGS-SEED. Seeden er stedet, hvor et krav om "sådan starter en ny sag" hører hjemme, når kravet
// IKKE kan udtrykkes i det persisterede schema — fordi det afhænger af brugerens programindstillinger, eller
// fordi schemaets egen default bevidst tjener load-tolerance for ældre `.eo`-filer frem for en ny sag.
//
// Kernen er domæneneutral: den kender hverken AppSettings eller det enkelte felt. Domænet leverer seeds, og
// kernen ejer konstruktionen, sammenfletningen og frysningen af aggregatet.

type SeededSections = SettledInputCandidate['sections'];
type MutableSections = { -readonly [K in keyof SeededSections]: SeededSections[K] };

/**
 * Hvad én seed ønsker sat. Nøglerne er sektioner; værdien er sektionens INPUT-form, så en seed kun behøver
 * angive sektionens påkrævede felter plus dem, den faktisk bestemmer — schemaet udfylder resten med sine
 * egne defaults.
 *
 * Signaturen giver bevidst IKKE domænet den rå `SettledInput`: en seed skal kunne sige HVAD der seedes, ikke
 * bygge aggregatet. Grænsen, som `domain/raw-section-access-boundary` ellers ville skulle håndhæve med en
 * allowlist-post, er dermed lukket i selve typen.
 */
export type NewCaseSeedSections = { -readonly [K in keyof SeededSections]?: SeededSections[K] };

/** En seed evalueres på det tidspunkt, sagen faktisk oprettes — aldrig ved modulets import. */
export type NewCaseSeed = () => NewCaseSeedSections | undefined;

/** Kopierer én sektionsværdi med bevaret nøgle-/værditype; uden helperen kollapser nøglen til en union. */
const copySeededSection = <K extends keyof SeededSections>(
  target: NewCaseSeedSections,
  key: K,
  source: NewCaseSeedSections
): void => {
  target[key] = source[key];
};

const assignSeededSection = <K extends keyof SeededSections>(
  target: MutableSections,
  key: K,
  source: NewCaseSeedSections
): void => {
  const value = source[key];
  if (value === undefined || value === null) return;
  Object.freeze(value);
  target[key] = value;
};

/**
 * Fletter flere seeds til én. Kaster, hvis to seeds vil eje SAMME sektion.
 *
 * Kravet er ikke pedanteri: en stiltiende "sidste vinder"-fletning ville gøre spørgsmålet "hvor kommer denne
 * nye sags værdi fra?" til et spørgsmål om importrækkefølge. Med kastet har hver sektion præcis én ejer.
 */
export const composeNewCaseSeeds = (...seeds: readonly NewCaseSeed[]): NewCaseSeed => () => {
  const merged: NewCaseSeedSections = {};
  const owner = new Map<string, number>();

  seeds.forEach((seed, index) => {
    const seeded = seed();
    if (seeded === undefined) return;
    for (const key of Object.keys(seeded) as (keyof SeededSections)[]) {
      if (seeded[key] === undefined || seeded[key] === null) continue;
      const previous = owner.get(key);
      if (previous !== undefined) {
        throw new Error(
          `NewCaseSeed: sektionen '${key}' seedes af både seed #${previous} og seed #${index}. `
          + 'En sektions ny-sags-værdi skal have præcis én ejer.'
        );
      }
      owner.set(key, index);
      copySeededSection(merged, key, seeded);
    }
  });

  return merged;
};

/**
 * Bygger sektions-mappet for en ny sag: den tomme baseline med seedens sektioner lagt oveni.
 *
 * Kernen ejer konstruktionen, så en seed hverken kan fjerne en sektion, tilføje en ukendt nøgle eller røre
 * `rejectedInputs`. Resultatet er en KANDIDAT — den validerende grænse (`catalog.validateSettledInput`)
 * materialiserer schemaets defaults og håndhæver envelope-invarianterne.
 */
export const buildNewCaseSections = (seed?: NewCaseSeed): SeededSections => {
  // Den tomme baseline er OUTPUT-formen (alle sektioner `null`), som per konstruktion også er en gyldig
  // input-form. Castet udtrykker netop det og udvider ikke, hvad en seed kan nå.
  const sections = { ...createEmptyPersistedInputSections() } as MutableSections;

  const seeded = seed?.();
  if (seeded !== undefined) {
    for (const key of Object.keys(seeded) as (keyof SeededSections)[]) {
      assignSeededSection(sections, key, seeded);
    }
  }

  return Object.freeze(sections);
};
