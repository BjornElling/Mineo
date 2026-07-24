import type { NavigateFunction } from 'react-router-dom';
import { deserializeFieldAddress } from '../fieldAddress';
import {
  navigateToBlockingInputError,
  type BlockingInputErrorTarget,
} from '../../utils/saveBlockedFocus';

// Greenfield-shell (§1.4/§5.4, WI-002 trin 1): den ene save-blocking focus-targeter for hovedapp-shellen efter
// cutoveren. `.eo`-save blokeres KUN af aktivt relevant rejected råinput (§3.9); `CaseFileOperations.evaluateSave`
// returnerer da de blokerende `SerializedFieldAddress`'er. Denne modul oversætter den FØRSTE blokerende adresse til
// et `BlockingInputErrorTarget` og genbruger den bevarede DOM-/fane-routing i `saveBlockedFocus.ts`.
//
// Til forskel fra legacy sætter greenfield-felter IKKE `data-mineo-field-path`, så `navigateToBlockingInputError`
// falder til `.Mui-error`/besked-fallbacket (`findFirstVisibleErrorElement`) efter fane-/side-routing fra
// sektionen. Målet er at BEVARE den eksisterende save-blocked-fokus-UX uændret (§5.4), ikke ny adfærd: brugeren
// ledes til den blokerende sektion, og det første synlige røde felt dér fokuseres/scrolles i syne.

/**
 * Oversætter en rejected greenfield-feltadresse til den bevarede `BlockingInputErrorTarget`. `section` er
 * StorageKey/pageKey (samme enum som `saveBlockedFocus` router på), så fane-routing og side-navigation genbruges
 * direkte. `fieldName` sættes til adressens feltnavn og `message` til tom streng: greenfield-felter har intet
 * `data-mineo-field-path`, så targeteren læner sig på det synlige `.Mui-error`-fallback for præcis fokus.
 */
export const blockingTargetFromRejectedAddress = (
  address: string
): BlockingInputErrorTarget | null => {
  const parsed = deserializeFieldAddress(address);
  if (parsed === null) return null;
  return Object.freeze({
    kind: 'field' as const,
    pageKey: parsed.section,
    fieldName: parsed.field,
    message: '',
  });
};

/**
 * Fokusér/scroll til det første blokerende rejected felt for et blokeret `.eo`-save. Router til den blokerende
 * sektion (fane + side) og fokuserer dét første synlige røde felt dér — samme UX som legacy Gem-blokering (§5.4).
 * Er der ingen (velformet) rejected adresse, fokuseres blot det første synlige røde felt på den aktuelle side.
 */
export const focusFirstBlockingRejectedField = async (
  rejectedAddresses: readonly string[],
  currentPathname: string,
  navigate: NavigateFunction
): Promise<void> => {
  const target = rejectedAddresses.length > 0
    ? blockingTargetFromRejectedAddress(rejectedAddresses[0])
    : null;
  await navigateToBlockingInputError(target, currentPathname, navigate);
};
