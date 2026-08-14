import React from 'react';
import { Box, Button, IconButton, MenuItem, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StyledDropdown from '../../../inputs/StyledDropdown';
import TransientAmountInput from '../../../inputs/transient/TransientAmountInput';
import TransientDateInput from '../../../inputs/transient/TransientDateInput';
import { offentligLoenTypeEnum, type OffentligLoenTypeLabel } from '../../../../schemas/formSchemas';
import type { AmountValue } from '../../../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../../../types/branded';
import { formatCurrency } from '../../../../utils/formatUtils';
import { hasExactDisplayedAmountMatch } from '../../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { useDialogFocusRestore } from '../../../../hooks/useDialogFocusRestore';
import type { LoentrinFinderErrors, LoentrinFinderResult } from './loentrinFinderCore';

/**
 * Delt props-kontrakt for løntrin-finder-overlayet. Komponenten er drevet udelukkende af props,
 * så både loenindkomst- (per-ansættelsesforhold + sessionStorage) og EO-varianten (ét overenskomst-id,
 * uden sessionStorage) kan dele præcis samme præsentation.
 *
 * Bemærk: `onAmountFieldError`/`onDateFieldError` modtages som allerede-indpakkede callbacks, så de
 * to kaldssteder opfører sig byte-identisk. Felterne er transiente (`Transient*Input`), så en afvist
 * draft rapporteres som en almindelig besked-streng — der findes ingen feltissue-kanal for et felt,
 * der ikke er sagsdata.
 */
export type LoentrinFinderOverlayProps = Readonly<{
  open: boolean;
  ansaettelse: OffentligLoenTypeLabel;
  setAnsaettelse: React.Dispatch<React.SetStateAction<OffentligLoenTypeLabel>>;
  beloeb: AmountValue | undefined;
  setBeloeb: React.Dispatch<React.SetStateAction<AmountValue | undefined>>;
  dato: ISODateString | undefined;
  setDato: React.Dispatch<React.SetStateAction<ISODateString | undefined>>;
  errors: LoentrinFinderErrors;
  setErrors: React.Dispatch<React.SetStateAction<LoentrinFinderErrors>>;
  onAmountFieldError: (errorMsg: string | undefined) => void;
  onDateFieldError: (errorMsg: string | undefined) => void;
  results: ReadonlyArray<LoentrinFinderResult>;
  buttonShake: boolean;
  headingId: string;
  overenskomstLabel: string;
  inputAmountNumber: number | undefined;
  /**
   * Den `Find løntrin`-knap, fokus skal vende tilbage til ved lukning. Sættes af `useLoentrinFinder` ved
   * åbning til NETOP den trigger, brugeren brugte — Lønindkomst har én pr. ansættelsesforhold.
   */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onCalculate: () => void;
}>;

/**
 * Page-lokalt overlay til at finde løntrin ud fra et beløb og en dato. Delt mellem loenindkomst-
 * og EO-oplysninger-fanen.
 *
 * Transient: skriver aldrig til persisteret sagsdata (jf. mineo-field-pattern §3). Den eksplicitte,
 * hardcodede tab-/keyboard-sekvens ejes af overlayet selv (nedenfor); dette er bevidst og auditeret
 * UX-adfærd (jf. keyboard-navigation.md "Løntrin-finder"). Overlayet ejer også fokus-restoren ved
 * lukning gennem `useDialogFocusRestore`; `useLoentrinFinder` leverer kun restore-MÅLET (`triggerRef`),
 * fordi det er en knap uden for overlayet, og kaldes fladen fra flere kort, er der én knap pr. kort.
 */
const LoentrinFinderOverlay = React.memo((props: LoentrinFinderOverlayProps) => {
  const {
    open,
    ansaettelse,
    setAnsaettelse,
    beloeb,
    setBeloeb,
    dato,
    setDato,
    errors,
    setErrors,
    onAmountFieldError,
    onDateFieldError,
    results,
    buttonShake,
    headingId,
    overenskomstLabel,
    inputAmountNumber,
    triggerRef,
    onClose,
    onCalculate,
  } = props;

  // Fokus tilbage til den `Find løntrin`-knap, der åbnede overlayet (jf. `keyboard-navigation.md`
  // §Popup-fokus-restore). Uden den blev fokus efterladt på overlayets forsvindende felt og faldt til
  // `body` — bekræftet i Chrome, Edge, Firefox og WebKit i AUDIT-2026-08-14-21. Restoren bor her, hvor
  // popupen bor, så overlayets øvrige `focus()`-kald (tastaturnavigationen nedenfor) ikke er en
  // konkurrerende restore-vej.
  useDialogFocusRestore<HTMLButtonElement>({ open, triggerRef });

  // Refs til overlayets egen tastaturnavigation. De hørte tidligere i de kaldende hooks og blev sendt ind
  // som otte props — men de bruges KUN her, og kontrakten placerer focus-trap'en i overlayet
  // (`keyboard-navigation.md` §Løntrin-finder: «Overlayets interne focus-trap ejes af overlay-komponenten
  // selv»). `loentrinFinder`-præfikset er beskrivende: overlayet er ét af de tre eksplicit navngivne
  // ikke-sagsdata-callsites i `input/persisted-controls-use-field-family`.
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const loentrinFinderAnsaettelseRef = React.useRef<HTMLDivElement>(null);
  const loentrinFinderBeloebRef = React.useRef<HTMLDivElement>(null);
  const loentrinFinderDatoRef = React.useRef<HTMLDivElement>(null);
  const beregnRef = React.useRef<HTMLButtonElement>(null);

  // Fokusér første felt ved åbning.
  React.useEffect(() => {
    if (!open) return;
    loentrinFinderAnsaettelseRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [open]);

  const getTabOrder = React.useCallback((): HTMLElement[] => {
    const ansaettelseInput = loentrinFinderAnsaettelseRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const beloebInput = loentrinFinderBeloebRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const datoInput = loentrinFinderDatoRef.current?.querySelector<HTMLInputElement>('input') ?? null;
    const orderedElements: Array<HTMLElement | null> = [ansaettelseInput, beloebInput, datoInput, beregnRef.current];
    return orderedElements.filter((item): item is HTMLElement => item !== null);
  }, []);

  React.useEffect(() => {
    if (!open) return undefined;

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      const activeElement = document.activeElement as HTMLElement | null;
      const isInsideOverlay = Boolean(dialog && activeElement && dialog.contains(activeElement));

      if (!isInsideOverlay) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
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
            // Overlayet kan være lukket imens (fx Escape i samme frame); fokusér da ikke et felt væk.
            if (!dialogRef.current) return;
            input.focus();
          });
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (activeElement === beregnRef.current) {
          onCalculate();
        }
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const tabOrder = getTabOrder();
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

      const tabOrder = getTabOrder();
      if (tabOrder.length === 0) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const first = tabOrder[0];
      const last = tabOrder[tabOrder.length - 1];
      const activeIndex = tabOrder.findIndex((element) => element === activeElement);

      // Bevidst hardcodet tab-sekvens:
      // Ansættelse -> Beløb -> Dato -> Beregn.
      // Vi tvinger denne rækkefølge, fordi generisk focus-trap-adfærd viste sig ustabil med StyledDropdowns popover-fokus
      // og forårsagede focus leaks til den underliggende side. Denne eksplicitte sekvens er bevidst og auditeret UX-adfærd.
      event.preventDefault();
      event.stopPropagation();

      if (event.shiftKey) {
        if (activeIndex === -1 || activeElement === first) {
          last.focus();
          return;
        }
        tabOrder[activeIndex - 1].focus();
        return;
      }

      if (activeIndex === -1 || activeElement === last) {
        first.focus();
        return;
      }
      tabOrder[activeIndex + 1].focus();
    };

    document.addEventListener('keydown', handleDocumentKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown, true);
    };
  }, [getTabOrder, onCalculate, onClose, open]);

  if (!open) return null;

  return (
    <>
      <Box
        onClick={onClose}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--color-shadow)',
          zIndex: (theme) => theme.zIndex.modal - 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />
      <Box
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        ref={dialogRef}
        sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '700px',
          maxHeight: '85vh',
          backgroundColor: 'var(--color-background-white)',
          borderRadius: '20px',
          boxShadow: '0 8px 32px var(--color-shadow)',
          border: '1px solid var(--color-border)',
          zIndex: (theme) => theme.zIndex.modal,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '24px 32px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <Typography id={headingId} variant="h5" sx={{ fontWeight: 500, color: 'text.primary' }}>
            Find løntrin
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label="Luk"
            tabIndex={-1}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'var(--color-hover)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Overenskomst</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{overenskomstLabel}</Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Ansættelse</Typography>
            <Box className="row--label-right-hover__content">
              <StyledDropdown
                ariaLabel="Ansættelse"
                ref={loentrinFinderAnsaettelseRef}
                width={180}
                value={ansaettelse}
                allowEmpty={false}
                onChange={(event) => {
                  // `value`-proppen er `OffentligLoenTypeLabel`, så `TValue` inferes til den —
                  // ingen annotation, ingen runtime-reparation af en type der ikke blev kastet væk.
                  setAnsaettelse(event.target.value);
                }}
              >
                {offentligLoenTypeEnum.options.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </StyledDropdown>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">{ansaettelse}</Typography>
            <Box className="row--label-right-hover__content">
              <TransientAmountInput
                ref={loentrinFinderBeloebRef}
                aria-label={ansaettelse}
                width={180}
                value={beloeb}
                allowNegative={false}
                onCommit={(next) => {
                  setBeloeb(next);
                  setErrors((prev) => ({ ...prev, beloeb: undefined }));
                }}
                onReject={onAmountFieldError}
                errorMessage={errors.beloeb}
              />
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Dato</Typography>
            <Box className="row--label-right-hover__content">
              <TransientDateInput
                ref={loentrinFinderDatoRef}
                aria-label="Dato"
                value={dato}
                onCommit={(next) => {
                  setDato(next);
                  setErrors((prev) => ({ ...prev, dato: undefined }));
                }}
                onReject={onDateFieldError}
                errorMessage={errors.dato}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, mb: 1 }}>
            <Button
              ref={beregnRef}
              variant="contained"
              onClick={onCalculate}
              sx={{
                borderRadius: '10px',
                px: 3,
                py: 1,
                animation: buttonShake ? 'shake 0.5s ease' : 'none',
                '@keyframes shake': {
                  '0%, 100%': { transform: 'translateX(0)' },
                  '25%': { transform: 'translateX(-4px)' },
                  '75%': { transform: 'translateX(4px)' },
                },
              }}
            >
              Beregn
            </Button>
          </Box>

          {results.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              <Typography className="row--text" sx={{ mb: 1 }}>
                Nærmeste lønsatser
              </Typography>
              {results.map((result) => {
                const isExactMatch = inputAmountNumber === undefined
                  ? false
                  : hasExactDisplayedAmountMatch(inputAmountNumber, result.beloeb);
                return (
                  <Box
                    key={`${String(result.loentrin)}-${result.gruppe}`}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-active-bg)',
                      mb: 0.75,
                    }}
                  >
                    <Typography className={`row--text${isExactMatch ? ' text-bold' : ''}`}>
                      {`Løntrin ${String(result.loentrin)}, gruppe ${result.gruppe}`}
                    </Typography>
                    <Typography className={`row--text${isExactMatch ? ' text-bold' : ''}`}>
                      {`${formatCurrency(result.beloeb)} kr.`}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          ) : null}
        </Box>
      </Box>
    </>
  );
});

LoentrinFinderOverlay.displayName = 'LoentrinFinderOverlay';

export default LoentrinFinderOverlay;
