import React from 'react';
import type { EOAngivetLoenLoenudvikling } from '../../../../schemas/formSchemas';
import type { ISODateString } from '../../../../types/branded';
import { amountValueToNumber } from '../../../../utils/expressionAmount';
import { useShakeFlag } from '../../../../hooks/useShakeFlag';
import { useDialogFocusRestore } from '../../../../hooks/useDialogFocusRestore';
import {
  calculateLoentrinFinderResults,
  resolveLoentrinFinderOverenskomstLabel,
  type LoentrinFinderErrors,
  type LoentrinFinderResult,
} from '../shared/loentrinFinderCore';

export type { LoentrinFinderErrors, LoentrinFinderResult } from '../shared/loentrinFinderCore';

type LoentrinFinderAnsaettelse = 'Månedsløn' | 'Timeløn';

export type UseEoLoentrinFinderResult = Readonly<{
  loentrinFinderOpen: boolean;
  loentrinFinderAnsaettelse: LoentrinFinderAnsaettelse;
  setLoentrinFinderAnsaettelse: React.Dispatch<React.SetStateAction<LoentrinFinderAnsaettelse>>;
  loentrinFinderBeloeb: EOAngivetLoenLoenudvikling['offentligLoenEkstraGrundloen'];
  setLoentrinFinderBeloeb: React.Dispatch<React.SetStateAction<EOAngivetLoenLoenudvikling['offentligLoenEkstraGrundloen']>>;
  loentrinFinderDato: ISODateString | undefined;
  setLoentrinFinderDato: React.Dispatch<React.SetStateAction<ISODateString | undefined>>;
  loentrinFinderErrors: LoentrinFinderErrors;
  setLoentrinFinderErrors: React.Dispatch<React.SetStateAction<LoentrinFinderErrors>>;
  handleLoentrinFinderAmountFieldError: (errorMsg: string | undefined) => void;
  handleLoentrinFinderDateFieldError: (errorMsg: string | undefined) => void;
  loentrinFinderResults: ReadonlyArray<LoentrinFinderResult>;
  loentrinFinderButtonShake: boolean;
  loentrinFinderDialogRef: React.RefObject<HTMLDivElement | null>;
  loentrinFinderAnsaettelseRef: React.RefObject<HTMLDivElement | null>;
  loentrinFinderBeloebRef: React.RefObject<HTMLDivElement | null>;
  loentrinFinderDatoRef: React.RefObject<HTMLDivElement | null>;
  loentrinFinderBeregnRef: React.RefObject<HTMLButtonElement | null>;
  /** Sættes på `Find løntrin`-knappen; fokus vender hertil ved lukning. */
  loentrinFinderTriggerRef: React.RefObject<HTMLButtonElement | null>;
  loentrinFinderHeadingId: string;
  loentrinFinderOverenskomstLabel: string;
  loentrinFinderInputAmountNumber: number | undefined;
  openLoentrinFinder: () => void;
  closeLoentrinFinder: () => void;
  handleLoentrinFinderCalculate: () => void;
}>;

/**
 * Page-lokal state machine for løntrin-finder-overlayet i EO-oplysninger-fanen.
 *
 * Bevidst page-lokal og transient: overlayet skriver aldrig til persisteret sagsdata
 * (jf. mineo-field-pattern §3 "Transiente felter deltager ikke" i undo/redo). Bevidst
 * holdt adskilt fra LoenindkomstTab's løntrin-finder (per-ansættelsesforhold + sessionStorage);
 * EO-varianten er knyttet til ét overenskomst-id og uden sessionStorage. En senere konvergens
 * af de to varianter er en mulig follow-up.
 *
 * Den eksplicitte, hardcodede tab-/keyboard-sekvens (Ansættelse -> Beløb -> Dato -> Beregn)
 * ejes af keyboard-effekten her; dette er bevidst og auditeret UX-adfærd.
 */
export const useEoLoentrinFinder = (
  overenskomstId: EOAngivetLoenLoenudvikling['overenskomstId'],
  offentligLoenType: EOAngivetLoenLoenudvikling['offentligLoenType']
): UseEoLoentrinFinderResult => {
  const [loentrinFinderOpen, setLoentrinFinderOpen] = React.useState(false);
  const [loentrinFinderAnsaettelse, setLoentrinFinderAnsaettelse] = React.useState<LoentrinFinderAnsaettelse>('Månedsløn');
  const [loentrinFinderBeloeb, setLoentrinFinderBeloeb] = React.useState<EOAngivetLoenLoenudvikling['offentligLoenEkstraGrundloen']>(undefined);
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

  // Fokus tilbage til `Find løntrin`-knappen ved lukning (jf. `keyboard-navigation.md`
  // §Popup-fokus-restore). Uden den blev fokus efterladt på overlayets forsvindende felt og
  // faldt til `body` — bekræftet i Chrome, Edge, Firefox og WebKit i AUDIT-2026-08-14-21.
  const { triggerRef: loentrinFinderTriggerRef } =
    useDialogFocusRestore<HTMLButtonElement>({ open: loentrinFinderOpen });

  const resetLoentrinFinderState = React.useCallback(() => {
    setLoentrinFinderBeloeb(undefined);
    setLoentrinFinderDato(undefined);
    setLoentrinFinderErrors({});
    setLoentrinFinderAmountFieldError(undefined);
    setLoentrinFinderDateFieldError(undefined);
    setLoentrinFinderResults([]);
  }, []);

  const openLoentrinFinder = React.useCallback(() => {
    resetLoentrinFinderState();
    setLoentrinFinderAnsaettelse(offentligLoenType ?? 'Månedsløn');
    setLoentrinFinderOpen(true);
  }, [offentligLoenType, resetLoentrinFinderState]);

  const closeLoentrinFinder = React.useCallback(() => {
    setLoentrinFinderOpen(false);
    resetLoentrinFinderState();
  }, [resetLoentrinFinderState]);

  const handleLoentrinFinderAmountFieldError = React.useCallback((errorMsg: string | undefined) => {
    setLoentrinFinderAmountFieldError(errorMsg);
  }, []);

  const handleLoentrinFinderDateFieldError = React.useCallback((errorMsg: string | undefined) => {
    setLoentrinFinderDateFieldError(errorMsg);
  }, []);

  const handleLoentrinFinderCalculate = React.useCallback(() => {
    const outcome = calculateLoentrinFinderResults({
      overenskomstId,
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
    overenskomstId,
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

  const loentrinFinderOverenskomstLabel = React.useMemo(
    () => resolveLoentrinFinderOverenskomstLabel(overenskomstId),
    [overenskomstId]
  );

  React.useEffect(() => {
    if (!loentrinFinderOpen) return;
    const input = loentrinFinderAnsaettelseRef.current?.querySelector<HTMLInputElement>('input');
    input?.focus();
  }, [loentrinFinderOpen]);

  const getLoentrinFinderTabOrder = React.useCallback((): HTMLElement[] => {
    const ansaettelseInput = loentrinFinderAnsaettelseRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const beloebInput = loentrinFinderBeloebRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const datoInput = loentrinFinderDatoRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const beregnButton = loentrinFinderBeregnRef.current;
    const orderedElements: Array<HTMLElement | null> = [ansaettelseInput, beloebInput, datoInput, beregnButton];
    return orderedElements.filter((item): item is HTMLElement => item !== null);
  }, []);

  React.useEffect(() => {
    if (!loentrinFinderOpen) return;

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
            if (!loentrinFinderOpen) return;
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
    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown, true);
    };
  }, [closeLoentrinFinder, getLoentrinFinderTabOrder, handleLoentrinFinderCalculate, loentrinFinderOpen]);

  return {
    loentrinFinderOpen,
    loentrinFinderAnsaettelse,
    setLoentrinFinderAnsaettelse,
    loentrinFinderBeloeb,
    setLoentrinFinderBeloeb,
    loentrinFinderDato,
    setLoentrinFinderDato,
    loentrinFinderErrors,
    setLoentrinFinderErrors,
    handleLoentrinFinderAmountFieldError,
    handleLoentrinFinderDateFieldError,
    loentrinFinderResults,
    loentrinFinderButtonShake,
    loentrinFinderDialogRef,
    loentrinFinderAnsaettelseRef,
    loentrinFinderBeloebRef,
    loentrinFinderDatoRef,
    loentrinFinderBeregnRef,
    loentrinFinderTriggerRef,
    loentrinFinderHeadingId,
    loentrinFinderOverenskomstLabel,
    loentrinFinderInputAmountNumber,
    openLoentrinFinder,
    closeLoentrinFinder,
    handleLoentrinFinderCalculate,
  };
};
