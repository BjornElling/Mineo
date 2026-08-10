import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from '../StyledTextFieldBase';
import type { ISODateString } from '../../../types/branded';
import { parseDateDraftForCommit, MAX_DATE_DRAFT_LENGTH } from '../../../utils/dateDraftCommit';
import { formatISOToDanish } from '../../../utils/dateFormatting';
import {
  dateLikeAdmission,
  keyFilterFromAdmission,
  restoreDomValueAfterRejectedDraft,
} from '../draftAdmission';
import { normalizeDatePaste } from '../../../utils/inputPasteNormalization';
import { readClipboardText } from '../../../utils/clipboardUtils';
import { spliceDraftWithPaste } from '../../../inputCore/react/pasteSplice';
import { assignRef } from '../../../utils/refUtils';
import { mergeSx } from '../../../utils/mergeSx';
import {
  resolveDateRangeErrorMessage,
  STATIC_DATE_BOUNDS,
  type DateRangeBoundsOrigin,
  type DateRangeSpecialErrors,
} from '../../../utils/dateRangeErrorMessages';
import { useTransientDraft } from './useTransientDraft';
// Transient input er IKKE sagsdata, men datoens FORM er den samme for brugeren — så formvejledningen
// læses fra den ene kilde frem for at være en fjerde kopi af strengen.
import { DATE_FORMAT_PLACEHOLDER } from '../../../utils/fieldFormatPlaceholders';

// Transient datofelt (§3.1-undtagelse: IKKE sagsdata). Bruges i overlays/dialoger, hvor datoen kun lever i
// komponentens egen state — fx løntrin-finderens opslagsdato. Scratch-værdien har ingen feltadresse, history
// eller persistens, men dens redigeringsflade følger BEVIDST det ordinære datofelt: samme to-trins-aktivering,
// tegnfilter, paste-normalisering, længerestriksning og bounds-tilstand. Ellers ville den samme dato have to
// brugerregler afhængigt af, om den tilfældigvis indgik i en sag.

export type TransientDateInputProps = Readonly<{
  value: ISODateString | undefined;
  onCommit: (next: ISODateString | undefined) => void;
  /** Vist fejl (ejes af kalderen, som også rydder den ved et nyt commit). */
  errorMessage?: string;
  /**
   * Kaldes både ved formatfejl og ved et canonical bounds-issue, så kalderen kan vise den samme røde
   * ring/tooltip og holde sin lokale handling disabled. `undefined` rydder en tidligere fejl.
   */
  onReject?: (message: string | undefined) => void;
  /** Kronologiske grænser. En overtrædelse bevares canonical og vises som feltfejl. */
  minDate?: ISODateString;
  maxDate?: ISODateString;
  /**
   * Grænsernes oprindelse. Udledes en grænse af et ANDET felt — fx det andet felt i et fra/til-par —
   * skal kalderen navngive årsagsinputtene med `derivedDateBounds(...)`, så en umulig kombination fortæller
   * brugeren HVAD der skal rettes. Udelades kun når begge grænser er konstanter (eller helt fraværende).
   */
  bounds?: DateRangeBoundsOrigin;
  /** Domænespecifikke bounds-beskeder (fx fra/til-rollen i et datopar). */
  specialRangeErrors?: DateRangeSpecialErrors;
  width?: number | string;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
  'aria-label'?: string;
}>;

// Ét prædikat for datoformen; keydown-filteret afledes af PRÆCIS samme prædikat (§1.2, `draftAdmission.ts`).
const DATE_ADMISSION = dateLikeAdmission();
const DATE_KEY_FILTER = keyFilterFromAdmission(DATE_ADMISSION);

const TransientDateInput = React.forwardRef<HTMLDivElement, TransientDateInputProps>(
  (
    {
      value,
      onCommit,
      errorMessage,
      onReject,
      minDate,
      maxDate,
      bounds = STATIC_DATE_BOUNDS,
      specialRangeErrors,
      width = 130,
      placeholder,
      inputRef,
      sx,
      ...rest
    },
    ref
  ) => {
    const inputElementRef = React.useRef<HTMLInputElement | null>(null);
    const ignoreOpeningBlurRef = React.useRef(false);
    const draftState = useTransientDraft<ISODateString | undefined>({
      value,
      format: (next) => (next === undefined ? '' : formatISOToDanish(next)),
      parse: (draft) => {
        const parsed = parseDateDraftForCommit(draft, { twoDigitYearPolicy: 'infer' });
        if (!parsed.ok) return { ok: false, message: parsed.message };
        if (parsed.iso === undefined) return { ok: true, value: undefined };

        const boundsMessage = resolveDateRangeErrorMessage({
          iso: parsed.iso,
          minDate,
          maxDate,
          special: specialRangeErrors,
          bounds,
        });
        return {
          ok: true,
          value: parsed.iso,
          ...(boundsMessage === '' ? {} : { issueMessage: boundsMessage }),
        };
      },
      onCommit: (next, issueMessage) => {
        onReject?.(issueMessage);
        onCommit(next);
      },
      onReject: (_draft, message) => {
        // Et formatfejl-settle må ikke lade den foregående canonical dato gemme sig under den røde tekst.
        // Hjælperækken følger dermed samme XOR-regel som sagsdata: enten en dato eller fejlteksten, aldrig begge.
        onCommit(undefined);
        onReject?.(message ?? 'Ugyldig dato');
      },
      twoStageActivation: { acceptsInitialKey: (key) => /^\d$/.test(key) },
      admission: DATE_ADMISSION,
    });

    const assignInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputElementRef.current = node;
        assignRef(inputRef, node);
      },
      [inputRef]
    );

    const previousOpenRef = React.useRef(draftState.isOpen);
    React.useLayoutEffect(() => {
      const justOpened = !previousOpenRef.current && draftState.isOpen;
      previousOpenRef.current = draftState.isOpen;
      if (!justOpened) return;
      const element = inputElementRef.current;
      if (!element || element.readOnly || document.activeElement !== element) return;

      // Samme caret-limbo-værn som ordinære DateField: et andet klik på et allerede fokuseret felt skal
      // åbne en reelt redigerbar editor i alle browsere, ikke blot skifte den visuelle markering.
      const end = element.value.length;
      const caret = element.selectionStart ?? end;
      ignoreOpeningBlurRef.current = true;
      try {
        element.blur();
        element.focus({ preventScroll: true });
        element.setSelectionRange(caret, caret);
      } finally {
        ignoreOpeningBlurRef.current = false;
      }
    }, [draftState.isOpen]);

    const handleBlur = React.useCallback(() => {
      if (ignoreOpeningBlurRef.current) return;
      draftState.onBlur();
    }, [draftState]);

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
      draftState.onKeyDown(event);
      if (draftState.isOpen && !event.defaultPrevented) {
        DATE_KEY_FILTER(event);
      }
    }, [draftState]);

    // `<input>` er styret af draften. Afviser prædikatet en ændring, er den rendrede draft uændret, og
    // React skriver derfor ikke elementet tilbage — det afviste tegn ville blive stående i DOM'en.
    const handleDraftChange = React.useCallback((next: string) => {
      if (!DATE_ADMISSION(next)) {
        restoreDomValueAfterRejectedDraft(inputElementRef.current, draftState.draft);
        return;
      }
      draftState.onDraftChange(next);
    }, [draftState]);

    const handlePaste = React.useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
      const normalized = normalizeDatePaste(readClipboardText(event));
      event.preventDefault();
      event.stopPropagation();

      if (!draftState.isOpen) {
        // Lukket paste erstatter værdien og afslutter straks — præcis som et ordinært datofelt.
        draftState.commitDraft(normalized, true);
        return;
      }

      const draft = draftState.draft;
      const element = inputElementRef.current;
      const start = typeof element?.selectionStart === 'number' ? element.selectionStart : draft.length;
      const end = typeof element?.selectionEnd === 'number' ? element.selectionEnd : start;
      const spliced = spliceDraftWithPaste(draft, normalized, start, end, MAX_DATE_DRAFT_LENGTH);
      draftState.onDraftChange(spliced.draft);
      requestAnimationFrame(() => {
        const currentElement = inputElementRef.current;
        if (!currentElement) return;
        currentElement.setSelectionRange(spliced.caret, spliced.caret);
      });
    }, [draftState]);

    return (
      <StyledTextFieldBase
        ref={ref}
        inputRef={assignInputRef}
        width={width}
        sx={mergeSx({
          '& .MuiInputBase-input': {
            textAlign: 'center',
            caretColor: draftState.isOpen ? 'auto' : 'transparent',
            cursor: draftState.isOpen ? 'text' : 'pointer',
          },
        }, sx)}
        placeholder={placeholder ?? DATE_FORMAT_PLACEHOLDER}
        draft={draftState.draft}
        onDraftChange={handleDraftChange}
        onFocus={draftState.onFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onMouseDown={draftState.onMouseDown}
        onClick={draftState.onClick}
        onPaste={handlePaste}
        error={errorMessage !== undefined}
        helperText={errorMessage ?? ''}
        htmlInputAttributes={{
          inputMode: 'numeric',
          maxLength: MAX_DATE_DRAFT_LENGTH,
          readOnly: !draftState.isOpen,
          'aria-label': rest['aria-label'],
        }}
      />
    );
  }
);

TransientDateInput.displayName = 'TransientDateInput';

export default TransientDateInput;
