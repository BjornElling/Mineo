import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from '../StyledTextFieldBase';
import type { ISODateString } from '../../../types/branded';
import { parseDateDraftForCommit } from '../../../utils/dateDraftCommit';
import { formatISOToDanish } from '../../../utils/dateFormatting';
import {
  resolveDateRangeErrorMessage,
  STATIC_DATE_BOUNDS,
  type DateRangeBoundsOrigin,
  type DateRangeSpecialErrors,
} from '../../../utils/dateRangeErrorMessages';
import { useTransientDraft } from './useTransientDraft';
// Transient input er IKKE sagsdata, men datoens FORM er den samme for brugeren — så formvejledningen
// læses fra den ene kilde frem for at være en fjerde kopi af strengen (UT-F06).
import { DATE_FORMAT_PLACEHOLDER } from '../../../utils/fieldFormatPlaceholders';

// Transient datofelt (§3.1-undtagelse: IKKE sagsdata). Bruges i overlays/dialoger, hvor datoen kun lever i
// komponentens egen state — fx løntrin-finderens opslagsdato. Deler dato-parse-kernen
// (`parseDateDraftForCommit`) og tegnfilteret med de persisterede datofelter, så indtastningsreglerne er ens;
// men den har hverken feltadresse, issue-snapshot, history eller persistens.

export type TransientDateInputProps = Readonly<{
  value: ISODateString | undefined;
  onCommit: (next: ISODateString | undefined) => void;
  /** Vist fejl (ejes af kalderen, som også rydder den ved et nyt commit). */
  errorMessage?: string;
  /**
   * Kaldes når draften afvises ved commit, så kalderen kan vise sin egen fejl. Kaldes også med
   * `undefined` ved et gyldigt commit, så kalderen kan rydde en tidligere fejl.
   */
  onReject?: (message: string | undefined) => void;
  /** Kronologiske grænser. Overtrædelse afvises ved commit med den delte bounds-besked. */
  minDate?: ISODateString;
  maxDate?: ISODateString;
  /**
   * Grænsernes oprindelse (R3-F03). Udledes en grænse af et ANDET felt — fx det andet felt i et fra/til-par —
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
      width,
      placeholder,
      inputRef,
      sx,
      ...rest
    },
    ref
  ) => {
    const draftState = useTransientDraft<ISODateString | undefined>({
      value,
      format: (v) => (v === undefined ? '' : formatISOToDanish(v)),
      parse: (draft) => {
        const parsed = parseDateDraftForCommit(draft, { twoDigitYearPolicy: 'infer' });
        if (!parsed.ok) return { ok: false, message: parsed.message };
        if (parsed.iso !== undefined) {
          // Bounds afgøres ved commit gennem den DELTE bounds-besked-kerne, så et transient datofelt
          // giver samme fejltekst som et persisteret felt med samme grænser.
          const boundsMessage = resolveDateRangeErrorMessage({
            iso: parsed.iso,
            minDate,
            maxDate,
            special: specialRangeErrors,
            bounds,
          });
          // ⚠️ `resolveDateRangeErrorMessage` signalerer "ingen fejl" med en TOM STRENG, ikke med `undefined`.
          // En `!== undefined`-test her afviste derfor ENHVER gyldig dato — med en tom fejlbesked, så feltet
          // bare aldrig committede. Test dermed på indhold, ikke på tilstedeværelse.
          if (boundsMessage !== '') return { ok: false, message: boundsMessage };
        }
        return { ok: true, value: parsed.iso };
      },
      onCommit: (next) => {
        onReject?.(undefined);
        onCommit(next);
      },
      onReject: (_draft, message) => onReject?.(message ?? 'Ugyldig dato'),
    });

    return (
      <StyledTextFieldBase
        ref={ref}
        inputRef={inputRef}
        width={width}
        sx={sx}
        placeholder={placeholder ?? DATE_FORMAT_PLACEHOLDER}
        draft={draftState.draft}
        onDraftChange={(next) => draftState.onDraftChange(next)}
        onFocus={draftState.onFocus}
        onBlur={draftState.onBlur}
        // Bevidst UDEN tegnfilter under indtastning: filtrene (`filterDateLikeKeyDown`) læser
        // `e.currentTarget.value`, som halter bag den kontrollerede draft i et transient felt og derfor ville
        // blokere indtastning efter de første cifre. Korrektheden ligger i stedet ved commit, hvor den DELTE
        // `parseDateDraftForCommit` afviser en malformet dato med samme besked som de persisterede datofelter.
        onKeyDown={draftState.onKeyDown}
        error={Boolean(errorMessage)}
        helperText={errorMessage ?? ''}
        htmlInputAttributes={{ inputMode: 'numeric', 'aria-label': rest['aria-label'] }}
      />
    );
  }
);

TransientDateInput.displayName = 'TransientDateInput';

export default TransientDateInput;
