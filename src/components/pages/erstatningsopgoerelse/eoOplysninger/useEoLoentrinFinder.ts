import React from 'react';
import type { EOAngivetLoenLoenudvikling } from '../../../../schemas/formSchemas';
import type { ISODateString } from '../../../../types/branded';
import { parseISODate } from '../../../../types/branded';
import { formatDanishDate } from '../../../../utils/dateUtils';
import { amountValueToNumber } from '../../../../utils/expressionAmount';
import { getOverenskomstMetaById, getOffentligOverenskomstTypeById } from '../../../../data/overenskomstRates';
import { getOffentligLoenTabelForDato } from '../../../../data/offentligLoenLookup';
import { useShakeFlag } from '../../../../hooks/useShakeFlag';

type LoentrinFinderAnsaettelse = 'Månedsløn' | 'Timeløn';

export type LoentrinFinderErrors = Readonly<{ beloeb?: string; dato?: string }>;
export type LoentrinFinderResult = Readonly<{
  loentrin: number | '55+';
  gruppe: 0 | 1 | 2 | 3 | 4;
  beloeb: number;
  diff: number;
}>;

const LOENGRUPPER = [0, 1, 2, 3, 4] as const;

const parseLoentrinSortValue = (loentrin: number | '55+'): number => (loentrin === '55+' ? 56 : loentrin);

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
  setLoentrinFinderAmountFieldError: React.Dispatch<React.SetStateAction<string | undefined>>;
  setLoentrinFinderDateFieldError: React.Dispatch<React.SetStateAction<string | undefined>>;
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

  const validateLoentrinFinderInput = React.useCallback((): {
    errors: LoentrinFinderErrors;
    beloebNumber: number | undefined;
  } => {
    const errors: { beloeb?: string; dato?: string } = {};
    const beloebNumber = amountValueToNumber(loentrinFinderBeloeb);

    if (loentrinFinderAmountFieldError) {
      errors.beloeb = loentrinFinderAmountFieldError;
    } else if (beloebNumber === undefined) {
      errors.beloeb = 'Beløb skal udfyldes';
    } else if (beloebNumber <= 0) {
      errors.beloeb = 'Beløb skal være større end 0';
    }

    if (loentrinFinderDateFieldError) {
      errors.dato = loentrinFinderDateFieldError;
    } else if (!loentrinFinderDato) {
      errors.dato = 'Dato skal udfyldes';
    }

    return { errors, beloebNumber };
  }, [
    loentrinFinderAmountFieldError,
    loentrinFinderBeloeb,
    loentrinFinderDateFieldError,
    loentrinFinderDato,
  ]);

  const handleLoentrinFinderCalculate = React.useCallback(() => {
    const resolvedOverenskomstId = overenskomstId ?? '';
    const offentligOverenskomstType = getOffentligOverenskomstTypeById(resolvedOverenskomstId);
    const overenskomstLabel = getOverenskomstMetaById(resolvedOverenskomstId)?.navn ?? resolvedOverenskomstId;

    if (!offentligOverenskomstType) {
      setLoentrinFinderErrors({ dato: 'Offentlig overenskomst er ikke valgt' });
      setLoentrinFinderResults([]);
      triggerLoentrinFinderButtonError();
      return;
    }

    const validation = validateLoentrinFinderInput();
    const hasInputErrors = Boolean(validation.errors.beloeb) || Boolean(validation.errors.dato);
    if (hasInputErrors || validation.beloebNumber === undefined || !loentrinFinderDato) {
      setLoentrinFinderErrors(validation.errors);
      setLoentrinFinderResults([]);
      triggerLoentrinFinderButtonError();
      return;
    }

    const parsedDate = parseISODate(loentrinFinderDato);
    if (!parsedDate) {
      setLoentrinFinderErrors((prev) => ({ ...prev, dato: 'Dato skal udfyldes' }));
      setLoentrinFinderResults([]);
      triggerLoentrinFinderButtonError();
      return;
    }

    const danishDate = formatDanishDate(parsedDate);
    const loenTabel = getOffentligLoenTabelForDato(offentligOverenskomstType, danishDate);
    if (!loenTabel) {
      setLoentrinFinderErrors((prev) => ({
        ...prev,
        dato: `Der findes ingen satser for ${overenskomstLabel} på den valgte dato`,
      }));
      setLoentrinFinderResults([]);
      triggerLoentrinFinderButtonError();
      return;
    }

    const results: LoentrinFinderResult[] = [];
    for (const entry of loenTabel.entries) {
      for (const gruppe of LOENGRUPPER) {
        const beloeb =
          loentrinFinderAnsaettelse === 'Timeløn'
            ? entry.timeLoen[gruppe]
            : entry.maanedsLoen[gruppe];
        results.push({
          loentrin: entry.loentrin,
          gruppe,
          beloeb,
          diff: Math.abs(beloeb - validation.beloebNumber),
        });
      }
    }

    results.sort((a, b) => {
      if (a.diff !== b.diff) return a.diff - b.diff;
      const trinDiff = parseLoentrinSortValue(a.loentrin) - parseLoentrinSortValue(b.loentrin);
      if (trinDiff !== 0) return trinDiff;
      return a.gruppe - b.gruppe;
    });

    setLoentrinFinderErrors({});
    setLoentrinFinderResults(results.slice(0, 5));
  }, [
    overenskomstId,
    loentrinFinderAnsaettelse,
    loentrinFinderDato,
    triggerLoentrinFinderButtonError,
    validateLoentrinFinderInput,
  ]);

  const loentrinFinderInputAmountNumber = React.useMemo(
    () => amountValueToNumber(loentrinFinderBeloeb),
    [loentrinFinderBeloeb]
  );

  const loentrinFinderOverenskomstLabel = React.useMemo(() => {
    const id = overenskomstId?.trim();
    if (!id) return 'Ingen overenskomst valgt';
    const meta = getOverenskomstMetaById(id);
    return meta?.navn ?? id;
  }, [overenskomstId]);

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
    setLoentrinFinderAmountFieldError,
    setLoentrinFinderDateFieldError,
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
    handleLoentrinFinderCalculate,
  };
};
