import * as React from 'react';
import { InputAdornment } from '@mui/material';
import StyledTextFieldBase from '../StyledTextFieldBase';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { parseAmountInput, amountValueToDraftString } from '../../../utils/expressionAmount';
import { useTransientDraft } from './useTransientDraft';
import {
  amountExpressionAdmission,
  keyFilterFromAdmission,
  restoreDomValueAfterRejectedDraft,
  syncDomValueAfterNormalizedDraft,
} from '../draftAdmission';
import { isTranslatedSignKey, normalizeSignCharactersForCodec } from '../../../inputCore/react/fields/signPolicy';
import { readClipboardText } from '../../../utils/clipboardUtils';
import {
  normalizePasteForDraft,
  resolvePasteContextDraft,
  spliceDraftWithPaste,
} from '../../../inputCore/react/pasteSplice';
import { assignRef } from '../../../utils/refUtils';
import {
  DEFAULT_AMOUNT_PRECISION,
  MAX_AMOUNT_INPUT_INTEGER_DIGITS,
  MAX_AMOUNT_RAW_LENGTH,
} from '../../../utils/amountInputUtils';

// Transient beløbsfelt (§2.1-undtagelse: IKKE sagsdata). Bruges i overlays/dialoger, hvor beløbet kun lever
// i komponentens egen state – fx løntrin-finderens ekstra grundløn. Deler beløbs-/udtryks-parse-kernen
// (`parseAmountInput`) og tegnfilteret med de persisterede beløbsfelter, så indtastningsreglerne er ens;
// men den har hverken feltadresse, issue-snapshot, history eller persistens.
//
// **Totrins-aktivering som alle andre felter.** Feltet var tidligere ETTRINS: ét klik åbnede
// editoren med det samme, mens `TransientDateInput` ved siden af – i samme lille vindue – krævede to.
// To felter side om side opførte sig altså forskelligt. Forskellen havde desuden en konsekvens for
// Escape: et ettrins-felt er ALTID «åbent», så `useTransientDraft` fandt altid noget at annullere, og
// Escape derfra kunne pr. konstruktion aldrig nå det omgivende overlay. Med totrins gælder XOR-reglen
// nu ens for begge felter: Escape i en ÅBEN editor annullerer indtastningen, Escape i et lukket felt
// lukker vinduet.

export type TransientAmountInputProps = Readonly<{
  value: AmountValue | undefined;
  onCommit: (next: AmountValue | undefined) => void;
  allowNegative?: boolean;
  allowDecimals?: boolean;
  /** Vist fejl (ejes af kalderen, som også rydder den ved et nyt commit). */
  errorMessage?: string;
  /**
   * Kaldes med beskeden, når draften afvises ved commit, så kalderen kan vise sin egen fejl, og med
   * `undefined` ved et gyldigt commit, som rydder en tidligere afvisning.
   */
  onReject?: (message: string | undefined) => void;
  width?: number | string;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  'aria-label'?: string;
}>;

const TransientAmountInput = React.forwardRef<HTMLDivElement, TransientAmountInputProps>(
  (
    {
      value,
      onCommit,
      allowNegative = false,
      allowDecimals = true,
      errorMessage,
      onReject,
      width,
      placeholder,
      inputRef,
      ...rest
    },
    ref
  ) => {
    const inputElementRef = React.useRef<HTMLInputElement | null>(null);
    // Blur'en fra caret-værnets egen blur/focus-cyklus må ikke opfattes som brugerens blur og
    // dermed afslutte den editor, der lige blev åbnet.
    const ignoreOpeningBlurRef = React.useRef(false);
    // Decimalpladserne er de samme, uanset om feltet VISER decimaler: kommaet skal kunne tastes
    // og indsættes, ellers springes det over og decimalcifrene glider op i heltalsdelen. `allowDecimals`
    // udtrykkes i stedet som settle-præcision nedenfor.
    const admission = React.useMemo(() => amountExpressionAdmission({
      allowNegative,
      allowDecimals,
      maxIntegerDigits: MAX_AMOUNT_INPUT_INTEGER_DIGITS,
      maxDecimalDigits: DEFAULT_AMOUNT_PRECISION,
    }), [allowDecimals, allowNegative]);
    const settlePrecision = allowDecimals ? DEFAULT_AMOUNT_PRECISION : 0;
    // Samme fortegns-politik og dermed samme minus-normalisering som de persisterede beløbsfelter:
    // `10−1` er subtraktion, ikke `101`. Helperen er den ene, de persisterede flader også bruger.
    const signPolicy = React.useMemo(
      () => ({ signPolicy: allowNegative ? 'signed' as const : 'nonNegative' as const }),
      [allowNegative]
    );
    const normalizeInput = React.useCallback(
      (text: string) => normalizeSignCharactersForCodec(signPolicy, text),
      [signPolicy]
    );
    const draftState = useTransientDraft<AmountValue | undefined>({
      value,
      format: (v) => amountValueToDraftString(v, DEFAULT_AMOUNT_PRECISION),
      parse: (draft) => {
        const parsed = parseAmountInput(draft, {
          precision: settlePrecision,
          allowNegative,
          maxIntegerDigits: MAX_AMOUNT_INPUT_INTEGER_DIGITS,
          maxRawLength: MAX_AMOUNT_RAW_LENGTH,
        });
        if (!parsed.ok) return { ok: false, message: parsed.error.message };
        return { ok: true, value: parsed.value };
      },
      // Samme XOR-regel og samme fejlkontrakt som `TransientDateInput`: et gyldigt commit rydder en tidligere
      // afvisning, og et afvist settle rydder den forrige værdi. Ellers bliver løntrin-finderens «Beregn» ved
      // med at fejle efter `1/0` rettet til et gyldigt beløb, og det gamle beløb ligger skjult under den røde tekst.
      onCommit: (next) => {
        onReject?.(undefined);
        onCommit(next);
      },
      onReject: (_draft, message) => {
        onCommit(undefined);
        onReject?.(message ?? 'Ugyldigt beløb');
      },
      // Åbningstasterne er feltets EGNE lovlige starttegn, ikke en håndskrevet liste: `admission`
      // kender allerede tegnsættet (cifre, separator og evt. minus), så et felt med `allowNegative`
      // eller uden decimaler åbner på præcis de tegn, det også accepterer bagefter.
      twoStageActivation: { acceptsInitialKey: (key) => admission(key) },
      admission,
      normalizeInput,
    });

    const assignInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputElementRef.current = node;
        assignRef(inputRef, node);
      },
      [inputRef]
    );

    // Samme caret-limbo-værn som `TransientDateInput` og de ordinære felter: et andet klik på et
    // allerede fokuseret felt skal åbne en reelt redigerbar editor i alle browsere. Uden blur/focus-
    // cyklussen bliver `readOnly`-ophævelsen i visse browsere kun en visuel markering, og feltet tager
    // ikke imod tastetryk, selv om det ser åbent ud.
    const previousOpenRef = React.useRef(draftState.isOpen);
    React.useLayoutEffect(() => {
      const justOpened = !previousOpenRef.current && draftState.isOpen;
      previousOpenRef.current = draftState.isOpen;
      if (!justOpened) return;
      const element = inputElementRef.current;
      if (!element || element.readOnly || document.activeElement !== element) return;

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

    const handleDraftChange = React.useCallback((raw: string) => {
      const next = normalizeInput(raw);
      if (!admission(next)) {
        // Et afvist input-event ændrer DOM'en, selv om den kontrollerede draft forbliver uændret.
        // Skriv den accepterede tekst tilbage, så DOM og draft ikke kan vise to forskellige værdier.
        restoreDomValueAfterRejectedDraft(inputElementRef.current, draftState.draft);
        return;
      }
      if (next !== raw) syncDomValueAfterNormalizedDraft(inputElementRef.current, next);
      draftState.onDraftChange(next);
    }, [admission, draftState, normalizeInput]);

    const keyFilter = React.useMemo(() => keyFilterFromAdmission(admission), [admission]);

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
      draftState.onKeyDown(event);
      // Tegnfilteret gælder kun den ÅBNE editor. I lukket tilstand ejer `onKeyDown` selv tasten:
      // den afgør, om et tegn åbner editoren, og et filter oveni ville afvise åbningstasten.
      // En tast, der oversættes (typografisk minus), vurderes af `handleDraftChange` på den oversatte draft.
      if (draftState.isOpen && !event.defaultPrevented && !isTranslatedSignKey(signPolicy, event.key)) {
        keyFilter(event);
      }
    }, [draftState, keyFilter, signPolicy]);

    const handlePaste = React.useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const draft = draftState.draft;
      const element = inputElementRef.current;
      const start = typeof element?.selectionStart === 'number' ? element.selectionStart : draft.length;
      const end = typeof element?.selectionEnd === 'number' ? element.selectionEnd : start;
      // Samme paste-normalisering som de persisterede beløbsfelter: minus-oversættelse og kun
      // teksten frem til første tabulator/linjeskift.
      const normalized = normalizePasteForDraft(
        readClipboardText(event),
        { family: 'amount', ...signPolicy },
        resolvePasteContextDraft(draftState.isOpen, draft, start, end)
      );
      const spliced = spliceDraftWithPaste(
        // Lukket felt: paste ERSTATTER værdien i stedet for at splejse ind i den viste tekst – samme
        // regel som `TransientDateInput` og de ordinære felter.
        draftState.isOpen ? draft : '',
        normalized,
        draftState.isOpen ? start : 0,
        draftState.isOpen ? end : 0,
        MAX_AMOUNT_RAW_LENGTH,
        admission
      );
      if (spliced.acceptedLength === 0) {
        restoreDomValueAfterRejectedDraft(inputElementRef.current, draft);
        return;
      }
      if (!draftState.isOpen) {
        // Lukket paste afslutter straks, så feltet ikke efterlades i en halvåben tilstand.
        draftState.commitDraft(spliced.draft, true);
        return;
      }
      draftState.onDraftChange(spliced.draft);
      requestAnimationFrame(() => {
        const currentElement = inputElementRef.current;
        if (!currentElement) return;
        try {
          currentElement.setSelectionRange(spliced.caret, spliced.caret);
        } catch {
          // no-op
        }
      });
    }, [admission, draftState, signPolicy]);

    return (
      <StyledTextFieldBase
        ref={ref}
        accessibleName={rest['aria-label'] ?? 'Beløb'}
        inputRef={assignInputRef}
        width={width}
        placeholder={placeholder}
        sx={{
          '& .MuiInputBase-input': {
            // Den lukkede tilstand skal SES: ingen caret og en peger-markør, præcis som
            // `TransientDateInput` og de ordinære totrins-felter.
            caretColor: draftState.isOpen ? 'auto' : 'transparent',
            cursor: draftState.isOpen ? 'text' : 'pointer',
          },
        }}
        draft={draftState.draft}
        onDraftChange={handleDraftChange}
        onFocus={draftState.onFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onMouseDown={draftState.onMouseDown}
        onClick={draftState.onClick}
        onPaste={handlePaste}
        error={Boolean(errorMessage)}
        helperText={errorMessage ?? ''}
        endAdornment={<InputAdornment position="end">kr.</InputAdornment>}
        htmlInputAttributes={{
          inputMode: allowDecimals ? 'decimal' : 'numeric',
          maxLength: MAX_AMOUNT_RAW_LENGTH,
          readOnly: !draftState.isOpen,
        }}
      />
    );
  }
);

TransientAmountInput.displayName = 'TransientAmountInput';

export default TransientAmountInput;
