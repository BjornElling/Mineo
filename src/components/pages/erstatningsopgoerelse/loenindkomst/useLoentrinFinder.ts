import React from 'react';
import { z } from 'zod';
import { offentligLoenTypeEnum, type OffentligLoenTypeLabel, type ErstatningsopgoerelseValues } from '../../../../schemas/formSchemas';
import { optionalAmountValueSchema } from '../../../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../../../types/branded';
import { isISODateString } from '../../../../types/branded';
import { amountValueToNumber } from '../../../../utils/expressionAmount';
import { useShakeFlag } from '../../../../hooks/useShakeFlag';
import { UI_STORAGE_KEYS } from '../../../../config/storageManifest';
import {
  readOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from '../../../../utils/safeSessionStorage';
import {
  calculateLoentrinFinderResults,
  resolveLoentrinFinderOverenskomstLabel,
  type LoentrinFinderErrors,
  type LoentrinFinderResult,
} from '../shared/loentrinFinderCore';

export type { LoentrinFinderErrors, LoentrinFinderResult } from '../shared/loentrinFinderCore';

type Ansaettelsesforhold =
  ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

const loentrinFinderSessionEntrySchema = z.object({
  ansaettelse: offentligLoenTypeEnum,
  beloeb: optionalAmountValueSchema,
  dato: z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === '') return undefined;
      return value;
    },
    z.string().refine((value) => isISODateString(value), 'Skal være gyldig ISO dato').optional()
  ),
}).strict();

const loentrinFinderSessionStateSchema = z.record(z.string(), loentrinFinderSessionEntrySchema);
type LoentrinFinderSessionState = z.infer<typeof loentrinFinderSessionStateSchema>;

export type UseLoentrinFinderResult = Readonly<{
  loentrinFinderOpenForAfId: string | null;
  loentrinFinderAnsaettelse: OffentligLoenTypeLabel;
  setLoentrinFinderAnsaettelse: React.Dispatch<React.SetStateAction<OffentligLoenTypeLabel>>;
  loentrinFinderBeloeb: Ansaettelsesforhold['offentligLoenEkstraGrundloen'];
  setLoentrinFinderBeloeb: React.Dispatch<React.SetStateAction<Ansaettelsesforhold['offentligLoenEkstraGrundloen']>>;
  loentrinFinderDato: ISODateString | undefined;
  setLoentrinFinderDato: React.Dispatch<React.SetStateAction<ISODateString | undefined>>;
  loentrinFinderErrors: LoentrinFinderErrors;
  setLoentrinFinderErrors: React.Dispatch<React.SetStateAction<LoentrinFinderErrors>>;
  loentrinFinderResults: ReadonlyArray<LoentrinFinderResult>;
  loentrinFinderButtonShake: boolean;
  loentrinFinderDialogRef: React.RefObject<HTMLDivElement | null>;
  loentrinFinderAnsaettelseRef: React.RefObject<HTMLDivElement | null>;
  loentrinFinderBeloebRef: React.RefObject<HTMLDivElement | null>;
  loentrinFinderDatoRef: React.RefObject<HTMLDivElement | null>;
  loentrinFinderBeregnRef: React.RefObject<HTMLButtonElement | null>;
  loentrinFinderHeadingId: string;
  loentrinFinderOverenskomstLabel: string;
  loentrinFinderInputAmountNumber: number | undefined;
  openLoentrinFinder: (af: Ansaettelsesforhold) => void;
  closeLoentrinFinder: () => void;
  handleLoentrinFinderAmountFieldError: (errorMsg: string | undefined) => void;
  handleLoentrinFinderDateFieldError: (errorMsg: string | undefined) => void;
  handleLoentrinFinderCalculate: () => void;
}>;

/**
 * Page-lokal state machine for løntrin-finder-overlayet.
 *
 * Bevidst page-lokal og transient: overlayet skriver aldrig til persisteret sagsdata
 * (jf. mineo-field-pattern §3 "Transiente felter deltager ikke" i undo/redo). State
 * persisteres kun til sessionStorage som UX-bekvemmelighed.
 *
 * Den eksplicitte tab-/keyboard-sekvens i overlayet ejes af LoentrinFinderOverlay; denne
 * hook ejer state, beregning, sessionStorage-roundtrip og fokus-/keyboard-effekterne.
 */
export const useLoentrinFinder = (
  loenindkomstAnsaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold']
): UseLoentrinFinderResult => {
  const [loentrinFinderOpenForAfId, setLoentrinFinderOpenForAfId] = React.useState<string | null>(null);
  const [loentrinFinderAnsaettelse, setLoentrinFinderAnsaettelse] = React.useState<OffentligLoenTypeLabel>('Månedsløn');
  const [loentrinFinderBeloeb, setLoentrinFinderBeloeb] = React.useState<Ansaettelsesforhold['offentligLoenEkstraGrundloen']>(undefined);
  const [loentrinFinderDato, setLoentrinFinderDato] = React.useState<ISODateString | undefined>(undefined);
  const [loentrinFinderErrors, setLoentrinFinderErrors] = React.useState<LoentrinFinderErrors>({});
  const [loentrinFinderAmountFieldError, setLoentrinFinderAmountFieldError] = React.useState<string | undefined>(undefined);
  const [loentrinFinderDateFieldError, setLoentrinFinderDateFieldError] = React.useState<string | undefined>(undefined);
  const [loentrinFinderResults, setLoentrinFinderResults] = React.useState<ReadonlyArray<LoentrinFinderResult>>([]);
  const { shake: loentrinFinderButtonShake, triggerShake: triggerLoentrinFinderButtonError } = useShakeFlag();
  const loentrinFinderDialogRef = React.useRef<HTMLDivElement>(null);
  const loentrinFinderAnsaettelseRef = React.useRef<HTMLDivElement>(null);
  const loentrinFinderBeloebRef = React.useRef<HTMLDivElement>(null);
  const loentrinFinderDatoRef = React.useRef<HTMLDivElement>(null);
  const loentrinFinderBeregnRef = React.useRef<HTMLButtonElement>(null);
  const loentrinFinderHeadingId = React.useId();

  const resetLoentrinFinderState = React.useCallback(() => {
    setLoentrinFinderBeloeb(undefined);
    setLoentrinFinderDato(undefined);
    setLoentrinFinderErrors({});
    setLoentrinFinderAmountFieldError(undefined);
    setLoentrinFinderDateFieldError(undefined);
    setLoentrinFinderResults([]);
  }, []);

  const readLoentrinFinderSessionState = React.useCallback((): LoentrinFinderSessionState => {
    try {
      const raw = readOptionalSessionStorageValue(UI_STORAGE_KEYS.loentrinFinderOverlay);
      if (!raw) return {};
      const parsedJson: unknown = JSON.parse(raw);
      const parsed = loentrinFinderSessionStateSchema.safeParse(parsedJson);
      return parsed.success ? parsed.data : {};
    } catch {
      return {};
    }
  }, []);

  const writeLoentrinFinderSessionState = React.useCallback((nextState: LoentrinFinderSessionState): void => {
    writeOptionalSessionStorageValue(UI_STORAGE_KEYS.loentrinFinderOverlay, JSON.stringify(nextState));
  }, []);

  const openLoentrinFinder = React.useCallback((af: Ansaettelsesforhold) => {
    resetLoentrinFinderState();
    const persistedState = readLoentrinFinderSessionState();
    const persistedEntry = persistedState[af.id];
    const fallbackAnsaettelse = af.offentligLoenType ?? 'Månedsløn';

    setLoentrinFinderAnsaettelse(persistedEntry?.ansaettelse ?? fallbackAnsaettelse);
    setLoentrinFinderOpenForAfId(af.id);
    setLoentrinFinderBeloeb(persistedEntry?.beloeb);
    setLoentrinFinderDato((persistedEntry?.dato as ISODateString | undefined) ?? undefined);
  }, [readLoentrinFinderSessionState, resetLoentrinFinderState]);

  const closeLoentrinFinder = React.useCallback(() => {
    setLoentrinFinderOpenForAfId(null);
    resetLoentrinFinderState();
  }, [resetLoentrinFinderState]);

  const loentrinFinderCurrentAf = React.useMemo(
    () => loenindkomstAnsaettelsesforhold.find((item) => item.id === loentrinFinderOpenForAfId),
    [loentrinFinderOpenForAfId, loenindkomstAnsaettelsesforhold]
  );
  const loentrinFinderOverenskomstLabel = React.useMemo(
    () => resolveLoentrinFinderOverenskomstLabel(loentrinFinderCurrentAf?.overenskomstId),
    [loentrinFinderCurrentAf?.overenskomstId]
  );

  const handleLoentrinFinderAmountFieldError = React.useCallback((errorMsg: string | undefined) => {
    setLoentrinFinderAmountFieldError(errorMsg);
  }, []);

  const handleLoentrinFinderDateFieldError = React.useCallback((errorMsg: string | undefined) => {
    setLoentrinFinderDateFieldError(errorMsg);
  }, []);

  const handleLoentrinFinderCalculate = React.useCallback(() => {
    const outcome = calculateLoentrinFinderResults({
      overenskomstId: loentrinFinderCurrentAf?.overenskomstId,
      ansaettelse: loentrinFinderAnsaettelse,
      beloeb: loentrinFinderBeloeb,
      dato: loentrinFinderDato,
      amountFieldError: loentrinFinderAmountFieldError,
      dateFieldError: loentrinFinderDateFieldError,
    });

    if (!outcome.ok) {
      setLoentrinFinderErrors(outcome.errors);
      setLoentrinFinderResults([]);
      triggerLoentrinFinderButtonError();
      return;
    }

    setLoentrinFinderErrors({});
    setLoentrinFinderResults(outcome.results);
  }, [
    loentrinFinderCurrentAf?.overenskomstId,
    loentrinFinderAnsaettelse,
    loentrinFinderBeloeb,
    loentrinFinderDato,
    loentrinFinderAmountFieldError,
    loentrinFinderDateFieldError,
    triggerLoentrinFinderButtonError,
  ]);

  const loentrinFinderInputAmountNumber = React.useMemo(
    () => amountValueToNumber(loentrinFinderBeloeb),
    [loentrinFinderBeloeb]
  );

  React.useEffect(() => {
    if (!loentrinFinderOpenForAfId) return;
    const input = loentrinFinderAnsaettelseRef.current?.querySelector<HTMLInputElement>('input');
    input?.focus();
  }, [loentrinFinderOpenForAfId]);

  React.useEffect(() => {
    if (!loentrinFinderOpenForAfId) return;

    const current = readLoentrinFinderSessionState();
    const next: LoentrinFinderSessionState = {
      ...current,
      [loentrinFinderOpenForAfId]: {
        ansaettelse: loentrinFinderAnsaettelse,
        beloeb: loentrinFinderBeloeb,
        dato: loentrinFinderDato,
      },
    };
    writeLoentrinFinderSessionState(next);
  }, [
    loentrinFinderAnsaettelse,
    loentrinFinderBeloeb,
    loentrinFinderDato,
    loentrinFinderOpenForAfId,
    readLoentrinFinderSessionState,
    writeLoentrinFinderSessionState,
  ]);

  const getLoentrinFinderTabOrder = React.useCallback((): HTMLElement[] => {
    const ansaettelseInput = loentrinFinderAnsaettelseRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const beloebInput = loentrinFinderBeloebRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const datoInput = loentrinFinderDatoRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const beregnButton = loentrinFinderBeregnRef.current;
    const orderedElements: Array<HTMLElement | null> = [ansaettelseInput, beloebInput, datoInput, beregnButton];
    return orderedElements.filter((item): item is HTMLElement => item !== null);
  }, []);

  React.useEffect(() => {
    if (!loentrinFinderOpenForAfId) return;

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      const dialog = loentrinFinderDialogRef.current;
      const activeElement = document.activeElement as HTMLElement | null;
      const isInsideOverlay = Boolean(dialog && activeElement && dialog.contains(activeElement));

      if (!isInsideOverlay) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeLoentrinFinder();
        return;
      }

      if (event.key === 'Enter') {
        const isDropdownCombobox = activeElement?.getAttribute('role') === 'combobox';
        if (isDropdownCombobox) {
          // StyledDropdown håndterer Enter selv (åbn/vælg). Undlad at overskrive den adfærd.
          return;
        }

        const isOpenTextEditor =
          activeElement instanceof HTMLInputElement &&
          !activeElement.readOnly;
        if (isOpenTextEditor) {
          // Overlay-regel: Enter i åben editor skal afslutte redigering (commit/close via blur),
          // men fokus skal blive i samme felt.
          const input = activeElement;
          event.preventDefault();
          event.stopPropagation();
          input.blur();
          requestAnimationFrame(() => {
            if (!loentrinFinderOpenForAfId) return;
            input.focus();
          });
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (activeElement === loentrinFinderBeregnRef.current) {
          handleLoentrinFinderCalculate();
        }
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const tabOrder = getLoentrinFinderTabOrder();
        if (tabOrder.length === 0) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        const isDropdownCombobox = activeElement?.getAttribute('role') === 'combobox';
        const isDropdownExpanded = activeElement?.getAttribute('aria-expanded') === 'true';
        if (isDropdownCombobox && isDropdownExpanded) {
          // Når dropdown-menuen er åben, skal pil-op/pil-ned navigere i menuen.
          return;
        }

        if (activeElement instanceof HTMLInputElement && !activeElement.readOnly) {
          // Når editor er åben, skal piletaster ikke kapres af overlay-navigationen.
          return;
        }

        const activeIndex = tabOrder.findIndex((element) => element === activeElement);
        event.preventDefault();
        event.stopPropagation();

        const step = event.key === 'ArrowDown' ? 1 : -1;
        if (activeIndex === -1) {
          tabOrder[0].focus();
          return;
        }

        const nextIndex = (activeIndex + step + tabOrder.length) % tabOrder.length;
        tabOrder[nextIndex].focus();
        return;
      }

      if (event.key !== 'Tab') return;

      const tabOrder = getLoentrinFinderTabOrder();
      if (tabOrder.length === 0) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const first = tabOrder[0];
      const last = tabOrder[tabOrder.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const activeIndex = tabOrder.findIndex((element) => element === active);

      // Bevidst hardcodet tab-sekvens:
      // Ansættelse -> Beløb -> Dato -> Beregn.
      // Vi tvinger denne rækkefølge, fordi generisk focus-trap-adfærd viste sig ustabil med StyledDropdowns popover-fokus
      // og forårsagede focus leaks til den underliggende side. Denne eksplicitte sekvens er bevidst og auditeret UX-adfærd.
      event.preventDefault();
      event.stopPropagation();

      if (event.shiftKey) {
        if (activeIndex === -1 || active === first) {
          last.focus();
          return;
        }
        tabOrder[activeIndex - 1].focus();
        return;
      }

      if (activeIndex === -1 || active === last) {
        first.focus();
        return;
      }
      tabOrder[activeIndex + 1].focus();
    };

    document.addEventListener('keydown', handleDocumentKeyDown, true);
    return () => document.removeEventListener('keydown', handleDocumentKeyDown, true);
  }, [closeLoentrinFinder, getLoentrinFinderTabOrder, handleLoentrinFinderCalculate, loentrinFinderOpenForAfId]);

  return {
    loentrinFinderOpenForAfId,
    loentrinFinderAnsaettelse,
    setLoentrinFinderAnsaettelse,
    loentrinFinderBeloeb,
    setLoentrinFinderBeloeb,
    loentrinFinderDato,
    setLoentrinFinderDato,
    loentrinFinderErrors,
    setLoentrinFinderErrors,
    loentrinFinderResults,
    loentrinFinderButtonShake,
    loentrinFinderDialogRef,
    loentrinFinderAnsaettelseRef,
    loentrinFinderBeloebRef,
    loentrinFinderDatoRef,
    loentrinFinderBeregnRef,
    loentrinFinderHeadingId,
    loentrinFinderOverenskomstLabel,
    loentrinFinderInputAmountNumber,
    openLoentrinFinder,
    closeLoentrinFinder,
    handleLoentrinFinderAmountFieldError,
    handleLoentrinFinderDateFieldError,
    handleLoentrinFinderCalculate,
  };
};
