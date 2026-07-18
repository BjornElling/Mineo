import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box } from '@mui/material';

type ConfirmationDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'error';
  hideCancelButton?: boolean;
  /** Bevar fokus i en åben felteditor, indtil en destruktiv handling faktisk bekræftes. */
  preserveExternalFocus?: boolean;
  /**
   * Ekstra actions (fx "Send fejloplysninger").
   *
   * Renderes mellem cancel- og confirm-knappen.
   */
  extraActions?: React.ReactNode;
};

/**
 * Genbrugelig bekræftelsesdialog med ja/nej funktionalitet
 *
 * @param open - Om dialogen er synlig
 * @param onConfirm - Callback når brugeren bekræfter
 * @param onCancel - Callback når brugeren annullerer. Valgfri når dialogen kun har OK-knap.
 * @param title - Dialogens titel
 * @param message - Bekræftelsesbesked
 * @param confirmText - Tekst på bekræft-knap (default: "Ja")
 * @param cancelText - Tekst på annuller-knap (default: "Annuller")
 * @param confirmColor - Farve på bekræft-knap (default: "primary")
 */
const ConfirmationDialog = React.memo(({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Ja',
  cancelText = 'Annuller',
  confirmColor = 'primary',
  hideCancelButton = false,
  preserveExternalFocus = false,
  extraActions,
}: ConfirmationDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      disableAutoFocus={preserveExternalFocus}
      disableEnforceFocus={preserveExternalFocus}
      disableRestoreFocus={preserveExternalFocus}
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: '10px',
        },
      }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ fontSize: '14px' }}>{message}</Box>
      </DialogContent>
      <DialogActions sx={{ padding: 2, gap: 1 }}>
        {!hideCancelButton && (
          <Button
            onClick={onCancel}
            onMouseDown={preserveExternalFocus ? (event) => event.preventDefault() : undefined}
            variant="outlined"
            sx={{
              borderRadius: '10px',
              '&:hover': {
                backgroundColor: 'var(--color-hover)',
              },
            }}
          >
            {cancelText}
          </Button>
        )}
        {extraActions}
        <Button
          onClick={onConfirm}
          onMouseDown={preserveExternalFocus ? (event) => event.preventDefault() : undefined}
          variant="contained"
          color={confirmColor}
          sx={{
            borderRadius: '10px',
            '&:hover': {
              filter: 'brightness(0.9)',
            },
          }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
});

ConfirmationDialog.displayName = 'ConfirmationDialog';

export default ConfirmationDialog;
