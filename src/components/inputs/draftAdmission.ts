import type * as React from 'react';
import { isDateLikeDraftAllowed } from '../../utils/dateDraftNormalization';
import { isFractionDraftAllowed } from '../../utils/fraction';
import { parseDanishNumberString } from '../../utils/numberParsing';
import {
  isAmountExpressionDraftAllowed,
  isPercentDraftAllowed,
  isWeekDraftAllowed,
  isYearDraftAllowed,
} from '../../utils/numericDraftAdmission';

/**
 * Feltfamiliernes tegn- og længdeværn som ÉT prædikat pr. familie (`input-field-behavior-contract.md` §1.2).
 *
 * **Hvorfor dette modul findes.** Værnet var indtil nu udelukkende et `keydown`-filter: `filterDateLikeKeyDown`
 * og dens søskende beregnede den kommende draft ud fra `e.key` og kaldte `preventDefault()`. Det virker på et
 * fysisk tastatur, hvor hvert tegn har en `keydown` med et brugbart `key` – og KUN dér.
 *
 * Et mobilt skærmtastatur (Android/GBoard er det målte tilfælde) skriver derimod tegnet direkte i `<input>` og
 * fyrer et `input`-event. Den `keydown`, der eventuelt følger med, bærer `key === 'Unidentified'`, som filtrenes
 * `isBypassKeyEvent` med vilje lader passere – IME/composition må ikke forstyrres. Resultatet var, at HELE
 * tegn- og længdeværnet var fraværende på mobil: brugerens fund `21-1111111-2026` i et datofelt er præcis den
 * form, `isDateLikeDraftAllowed` afviser ved tastning på desktop. Målt i en mobil-emuleret browser gik strengen
 * uændret ind i feltet.
 *
 * **Derfor er PRÆDIKATET primært, og keydown-filteret afledt.** Værnet flyttes til `onDraftChange` – den ene
 * kanal, ENHVER indtastningsmodalitet passerer (tastatur, skærmtastatur, autofyld, stemmeinput, IME-commit).
 * Et keydown-filter kan aldrig blive udtømmende, fordi det forudsætter en tast; et draft-prædikat forudsætter
 * kun, at draften ændrer sig.
 *
 * `keyFilterFromAdmission` bevarer keydown-benet, fordi det stadig har en egen værdi: det forhindrer tegnet i
 * overhovedet at nå DOM'en, så caret'en ikke flytter sig og springer tilbage. Men de to kan ikke længere drifte
 * fra hinanden, for de læser det SAMME prædikat – og det var netop drift mellem to parallelle værn, der lod
 * fejlen opstå.
 *
 * **Grænsen for prædikatet er uændret §1.2:** tegnsæt og længde, ikke talværdi. En værdi, der bryder en range-,
 * kronologi- eller domænegrænse, skal fortsat kunne tastes og bevares canonical med rød ring (§1.1).
 */
export type DraftAdmission = (draft: string) => boolean;

/** Et fælles længdeværn for alle input-events, også når browseren omgår HTML-attributten. */
export const isDraftWithinMaxLength = (draft: string, maxLength: number | undefined): boolean => {
  if (typeof maxLength !== 'number' || !Number.isFinite(maxLength) || maxLength <= 0) return true;
  return draft.length <= maxLength;
};

type KeyDownEvent = React.KeyboardEvent<HTMLInputElement>;

const isBypassKeyEvent = (e: KeyDownEvent): boolean => {
  // IME/composition og kommandoer på OS-/browser-niveau må ikke forstyrres.
  const native = e.nativeEvent as unknown as { isComposing?: boolean };
  if (native.isComposing === true || e.key === 'Process' || e.key === 'Unidentified') return true;
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  return false;
};

const isNonCharacterKey = (e: KeyDownEvent): boolean => {
  // Tillad navigations-/redigeringstaster.
  const nonCharKeys = new Set([
    'Backspace',
    'Delete',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'Tab',
  ]);
  return nonCharKeys.has(e.key);
};

const getNextValueFromInsertion = (input: HTMLInputElement, insertion: string): string => {
  const current = input.value ?? '';
  const start = typeof input.selectionStart === 'number' ? input.selectionStart : current.length;
  const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
  return current.slice(0, start) + insertion + current.slice(end);
};

/**
 * Afleder et keydown-filter af et draft-prædikat.
 *
 * Filteret er et EKSTRA værn, ikke det bærende: det blokerer tegnet før DOM'en, så caret'en aldrig flytter sig.
 * Går tegnet alligevel ind (skærmtastatur, autofyld, IME-commit), fanger `onDraftChange` det med samme prædikat.
 */
export const keyFilterFromAdmission = (admits: DraftAdmission) => (e: KeyDownEvent): void => {
  if (isBypassKeyEvent(e)) return;
  if (isNonCharacterKey(e)) return;
  if (e.key.length !== 1) return;
  if (admits(getNextValueFromInsertion(e.currentTarget, e.key))) return;
  e.preventDefault();
  e.stopPropagation();
};

/**
 * Skriver den senest ACCEPTEREDE draft tilbage i `<input>` efter en afvist ændring.
 *
 * Nødvendigt fordi elementet er styret af surfacens `displayText`: afviser vi ændringen, er den rendrede
 * værdi uændret, og React skriver derfor ikke elementet tilbage – det afviste tegn ville blive stående i
 * DOM'en med en draft i motoren, der ikke indeholdt det. Altså to samtidige sandheder om feltets indhold.
 *
 * Caret'en sættes til den position, browseren allerede havde flyttet den til, MINUS de tegn, der ikke kom
 * med. Ellers ville markøren hoppe til feltets slutning ved hvert afvist tegn – netop den adfærd,
 * keydown-filteret undgår ved at blokere før DOM'en.
 */
export const restoreDomValueAfterRejectedDraft = (
  element: HTMLInputElement | null,
  admittedDraft: string
): void => {
  if (element === null) return;
  const rejectedLength = element.value.length;
  const caret = element.selectionStart ?? rejectedLength;
  element.value = admittedDraft;
  const restoredCaret = Math.max(
    0,
    Math.min(caret - (rejectedLength - admittedDraft.length), admittedDraft.length)
  );
  try {
    element.setSelectionRange(restoredCaret, restoredCaret);
  } catch {
    // no-op: elementtyper uden selection-API.
  }
};

export type IntegerDraftConstraints = Readonly<{
  maxDigits?: number;
  maxValue?: number;
  allowNegative?: boolean;
}>;

export const isIntegerDraftAllowed = (input: string, options?: IntegerDraftConstraints): boolean => {
  const allowNegative = options?.allowNegative === true;
  const pattern = allowNegative ? /^-?\d*$/ : /^\d*$/;
  if (!pattern.test(input)) return false;

  if (typeof options?.maxDigits === 'number') {
    const withoutSign = input.startsWith('-') ? input.slice(1) : input;
    if (withoutSign.length > options.maxDigits) return false;
  }

  if (typeof options?.maxValue === 'number' && /^-?\d+$/.test(input)) {
    const numeric = Number.parseInt(input, 10);
    if (Number.isFinite(numeric) && numeric > options.maxValue) return false;
  }

  return true;
};

/** Heltal: kun cifre, med feltets valgfrie ciffer-/værdiloft og fortegnspolitik. */
export const integerAdmission = (options?: IntegerDraftConstraints): DraftAdmission =>
  (draft) => isIntegerDraftAllowed(draft, options);

/**
 * År: kun cifre, højst 4 (`YYYY`).
 *
 * Prædikatet bor i `utils/numericDraftAdmission`, fordi pastens `normalizeYearPaste` skal læse præcis
 * det samme (§1.2a: paste = tastning). Regexet stod her som en selvstændig kopi indtil 2026-08-18.
 */
export const yearAdmission = (): DraftAdmission => isYearDraftAllowed;

/** Brøk: cifre og '/', højst én skråstreg. */
export const fractionAdmission = (
  options?: Readonly<{ maxDigits?: number; allowNegative?: boolean }>
): DraftAdmission => (draft) => isFractionDraftAllowed(draft, options);

/** Beløbsudtryk: cifre, ét komma og operatorer/parenteser, med ciffergrænser pr. talled (§2.2). */
export const amountExpressionAdmission = (
  options?: Readonly<{
    allowNegative?: boolean;
    allowDecimals?: boolean;
    maxDecimalDigits?: number;
    maxIntegerDigits?: number;
  }>
): DraftAdmission => (draft) => isAmountExpressionDraftAllowed(draft, options);

/**
 * Procent: cifre og komma efter feltets decimal-/cifferpolitik (§2.3), plus de valgfrie
 * heltalsdels- og værdilofter.
 *
 * Værdilofterne (`maxIntegerPart`/`maxValue`) er bevidst bevaret fra keydown-filteret: de er de eneste
 * steder i familien, hvor et TAL og ikke blot tegnsættet afgør adgangen. Delvise decimaler ("10,") skal
 * fortsat passere under redigering; den endelige værdi afgøres ved commit.
 */
export const percentAdmission = (
  options?: Readonly<{
    allowNegative?: boolean;
    maxIntegerDigits?: number;
    maxIntegerPart?: number;
    allowDecimals?: boolean;
    maxValue?: number;
  }>
): DraftAdmission => (draft) => {
  if (!isPercentDraftAllowed(draft, options)) return false;

  const normalized = draft.startsWith('-') ? draft.slice(1) : draft;
  const [intPart] = normalized.split(',') as [string, string?];
  const intNum = Number.parseInt(intPart, 10);
  if (
    typeof options?.maxIntegerPart === 'number'
    && Number.isFinite(intNum)
    && intNum > options.maxIntegerPart
  ) {
    return false;
  }

  if (typeof options?.maxValue === 'number') {
    const compact = draft.replace(/\s+/g, '');
    // Partial decimal input (fx "10,") må passere under typing; commit-validering håndterer endelig værdi.
    if (compact === '' || compact === '-' || compact.endsWith(',')) return true;

    const numeric = parseDanishNumberString(compact, {
      precision: options.allowDecimals === false ? 0 : 2,
    });
    if (numeric !== undefined && numeric > options.maxValue) return false;
  }

  return true;
};

/**
 * Dato: cifre og separatortegn med segmentværnet `DD`-`MM`-`YYYY` (2-2-4).
 *
 * Tilladte separatorer: ethvert ikke-alfanumerisk tegn. Gentagne separatorer afvises efter den første –
 * det er PRÆCIS den regel, mobilbrugeren kunne omgå, fordi den kun blev håndhævet på keydown.
 */
export const dateLikeAdmission = (): DraftAdmission =>
  (draft) => isDateLikeDraftAllowed(draft, [2, 2, 4]);

/**
 * Uge: cifre + én separator, begrænset til `WW-YYYY` efter segmentlængde (2-4).
 *
 * Samme flytning som {@link yearAdmission}: prædikatet deles nu med `normalizeWeekPaste`.
 */
export const weekAdmission = (): DraftAdmission => isWeekDraftAllowed;
