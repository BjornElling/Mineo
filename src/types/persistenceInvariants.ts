import type { EoFileData } from '../schemas/eoFileSchema';
import type { PersistedSectionKey } from '../config/persistenceRegistry';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Assert<T extends true> = T;

/**
 * Den forventede sektionsmængde, skrevet UD som en uafhængig literal.
 *
 * Uden den ville invarianten nedenfor være en tautologi: `EoFileData`s nøgler udledes af
 * `persistenceSchemas` (`eoFileSchema.ts`), og `PersistedSectionKey` gør nu det samme — så en sammenligning
 * af de to ville sammenligne den samme kilde med sig selv og aldrig kunne fejle. Tidligere var
 * `PersistedSectionKey` en håndskrevet nøglemapping i `storageManifest.ts` og udgjorde dermed selv den
 * uafhængige side; den mapping er slettet (WI-007), og literalen her har overtaget rollen.
 *
 * Tilføjes eller fjernes en sektion i `persistenceSchemas`, fejler compilen her, indtil listen
 * bevidst opdateres. Det er meningen: en sektion, der lydløst forsvinder, er datatab ved load.
 */
type ExpectedSection =
  | 'stamdata'
  | 'satser'
  | 'aarsloen'
  | 'faellesAarsloen'
  | 'renteberegning'
  | 'varigemen'
  | 'forsoergertab'
  | 'erstatningsopgoerelse'
  | 'erhvervsevnetab';

// Compile-time invariant: registry'ets sektioner, .eo-filens sektioner og den forventede
// mængde skal være præcis ét og samme sæt.
export type _AssertStorageSectionsAsExpected = Assert<Equal<PersistedSectionKey, ExpectedSection>>;
export type _AssertFileSectionsAsExpected = Assert<Equal<keyof EoFileData, ExpectedSection>>;
