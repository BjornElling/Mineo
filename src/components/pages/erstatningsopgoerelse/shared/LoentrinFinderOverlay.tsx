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
  dialogRef: React.RefObject<HTMLDivElement | null>;
  // `loentrinFinder`-præfikset er nu blot beskrivende. Det bar tidligere en tekst-markør, som det
  // slettede `fieldIdentityGuard` scannede JSX'en for; overlayet er i stedet ét af de tre eksplicit
  // navngivne ikke-sagsdata-callsites i `input/persisted-controls-use-field-family`.
  loentrinFinderAnsaettelseRef: React.RefObject<HTMLDivElement | null>;
  loentrinFinderBeloebRef: React.RefObject<HTMLDivElement | null>;
  loentrinFinderDatoRef: React.RefObject<HTMLDivElement | null>;
  beregnRef: React.RefObject<HTMLButtonElement | null>;
  headingId: string;
  overenskomstLabel: string;
  inputAmountNumber: number | undefined;
  onClose: () => void;
  onCalculate: () => void;
}>;

/**
 * Page-lokalt overlay til at finde løntrin ud fra et beløb og en dato. Delt mellem loenindkomst-
 * og EO-oplysninger-fanen.
 *
 * Transient: skriver aldrig til persisteret sagsdata (jf. mineo-field-pattern §3). Den eksplicitte,
 * hardcodede tab-/keyboard-sekvens ejes af den kaldende hooks keyboard-effekt; dette er bevidst og
 * auditeret UX-adfærd (jf. keyboard-navigation.md "Løntrin-finder").
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
    dialogRef,
    loentrinFinderAnsaettelseRef,
    loentrinFinderBeloebRef,
    loentrinFinderDatoRef,
    beregnRef,
    headingId,
    overenskomstLabel,
    inputAmountNumber,
    onClose,
    onCalculate,
  } = props;

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
