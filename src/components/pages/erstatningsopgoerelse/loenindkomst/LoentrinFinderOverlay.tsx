import React from 'react';
import { Box, Button, IconButton, MenuItem, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StyledDropdown, { type StyledDropdownChangeEvent } from '../../../inputs/StyledDropdown';
import StyledAmountField from '../../../inputs/StyledAmountField';
import StyledDateField from '../../../inputs/StyledDateField';
import { offentligLoenTypeEnum, type OffentligLoenTypeLabel } from '../../../../schemas/formSchemas';
import { formatCurrency } from '../../../../utils/formatUtils';
import { hasExactDisplayedAmountMatch } from '../../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import type { UseLoentrinFinderResult } from './useLoentrinFinder';

type Props = Readonly<{
  loentrinFinder: UseLoentrinFinderResult;
}>;

/**
 * Page-lokalt overlay til at finde løntrin ud fra et beløb og en dato.
 *
 * Transient: skriver aldrig til persisteret sagsdata (jf. mineo-field-pattern §3). Den
 * eksplicitte, hardcodede tab-/keyboard-sekvens ejes af useLoentrinFinder's keyboard-effekt;
 * dette er bevidst og auditeret UX-adfærd (jf. keyboard-navigation.md "Løntrin-finder").
 */
const LoentrinFinderOverlay = React.memo(({ loentrinFinder }: Props) => {
  const {
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
    closeLoentrinFinder,
    handleLoentrinFinderAmountFieldError,
    handleLoentrinFinderDateFieldError,
    handleLoentrinFinderCalculate,
  } = loentrinFinder;

  if (!loentrinFinderOpenForAfId) return null;

  return (
    <>
      <Box
        onClick={closeLoentrinFinder}
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
        aria-labelledby={loentrinFinderHeadingId}
        ref={loentrinFinderDialogRef}
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
          <Typography id={loentrinFinderHeadingId} variant="h5" sx={{ fontWeight: 500, color: 'text.primary' }}>
            Find løntrin
          </Typography>
          <IconButton
            onClick={closeLoentrinFinder}
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
              <Typography className="row--text">{loentrinFinderOverenskomstLabel}</Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Ansættelse</Typography>
            <Box className="row--label-right-hover__content">
              <StyledDropdown
                ref={loentrinFinderAnsaettelseRef}
                width={180}
                value={loentrinFinderAnsaettelse}
                allowEmpty={false}
                onChange={(event: StyledDropdownChangeEvent<string>) => {
                  const parsed = offentligLoenTypeEnum.safeParse(event.target.value ?? 'Månedsløn');
                  const nextValue: OffentligLoenTypeLabel = parsed.success ? parsed.data : 'Månedsløn';
                  setLoentrinFinderAnsaettelse(nextValue);
                }}
              >
                <MenuItem value="Månedsløn">Månedsløn</MenuItem>
                <MenuItem value="Timeløn">Timeløn</MenuItem>
              </StyledDropdown>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">{loentrinFinderAnsaettelse}</Typography>
            <Box className="row--label-right-hover__content">
              <StyledAmountField
                ref={loentrinFinderBeloebRef}
                width={180}
                value={loentrinFinderBeloeb}
                allowNegative={false}
                onCommit={(event) => {
                  setLoentrinFinderBeloeb(event.target.value);
                  setLoentrinFinderErrors((prev) => ({ ...prev, beloeb: undefined }));
                }}
                onFieldError={handleLoentrinFinderAmountFieldError}
                error={Boolean(loentrinFinderErrors.beloeb)}
                helperText={loentrinFinderErrors.beloeb ?? ''}
              />
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Dato</Typography>
            <Box className="row--label-right-hover__content">
              <StyledDateField
                ref={loentrinFinderDatoRef}
                value={loentrinFinderDato}
                onCommit={(event) => {
                  setLoentrinFinderDato(event.target.value);
                  setLoentrinFinderErrors((prev) => ({ ...prev, dato: undefined }));
                }}
                onFieldError={handleLoentrinFinderDateFieldError}
                error={Boolean(loentrinFinderErrors.dato)}
                helperText={loentrinFinderErrors.dato ?? ''}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, mb: 1 }}>
            <Button
              ref={loentrinFinderBeregnRef}
              variant="contained"
              onClick={handleLoentrinFinderCalculate}
              sx={{
                borderRadius: '10px',
                px: 3,
                py: 1,
                animation: loentrinFinderButtonShake ? 'shake 0.5s ease' : 'none',
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

          {loentrinFinderResults.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              <Typography className="row--text" sx={{ mb: 1 }}>
                Nærmeste lønsatser
              </Typography>
              {loentrinFinderResults.map((result) => {
                const isExactMatch = loentrinFinderInputAmountNumber === undefined
                  ? false
                  : hasExactDisplayedAmountMatch(loentrinFinderInputAmountNumber, result.beloeb);
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
