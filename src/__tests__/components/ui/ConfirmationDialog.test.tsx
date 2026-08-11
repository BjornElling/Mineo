// @vitest-environment jsdom
import * as React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, ThemeProvider, createTheme } from '@mui/material';
import ConfirmationDialog from '../../../components/ui/ConfirmationDialog';

const renderDialog = (props: React.ComponentProps<typeof ConfirmationDialog>) => {
  const theme = createTheme();
  return render(
    <ThemeProvider theme={theme}>
      <ConfirmationDialog {...props} />
    </ThemeProvider>
  );
};

describe('ConfirmationDialog', () => {
  it('flytter fokus ind i dialogen og holder Tab-sekvensen intern', async () => {
    const user = userEvent.setup();
    renderDialog({
      open: true,
      title: 'Bekræft handling',
      message: 'Besked',
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
    });

    const dialog = screen.getByRole('dialog');
    const cancelButton = within(dialog).getByRole('button', { name: 'Annuller' });
    const confirmButton = within(dialog).getByRole('button', { name: 'Ja' });

    await waitFor(() => expect(cancelButton).toHaveFocus());
    await user.tab();
    expect(confirmButton).toHaveFocus();
    await user.tab();
    expect(cancelButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirmButton).toHaveFocus();
  });

  it('inkluderer ekstra actions i den interne Tab-sekvens', async () => {
    const user = userEvent.setup();
    renderDialog({
      open: true,
      title: 'Bekræft handling',
      message: 'Besked',
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
      extraActions: <Button>Flere oplysninger</Button>,
    });

    const dialog = screen.getByRole('dialog');
    const cancelButton = within(dialog).getByRole('button', { name: 'Annuller' });
    const extraButton = within(dialog).getByRole('button', { name: 'Flere oplysninger' });
    const confirmButton = within(dialog).getByRole('button', { name: 'Ja' });

    await waitFor(() => expect(cancelButton).toHaveFocus());
    await user.tab();
    expect(extraButton).toHaveFocus();
    await user.tab();
    expect(confirmButton).toHaveFocus();
    await user.tab();
    expect(cancelButton).toHaveFocus();
  });

  it('lukker ved Escape gennem annuller-callbacken', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderDialog({
      open: true,
      title: 'Bekræft handling',
      message: 'Besked',
      onCancel,
      onConfirm: vi.fn(),
    });

    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuller' })).toHaveFocus());
    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('gendanner fokus til et aktivt felt efter annullering', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const view = renderDialog({
      open: false,
      title: 'Bekræft handling',
      message: 'Besked',
      onCancel,
      onConfirm: vi.fn(),
    });
    const field = document.createElement('input');
    field.setAttribute('aria-label', 'Aktivt felt');
    view.container.append(field);
    field.focus();

    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <ConfirmationDialog
          open
          title="Bekræft handling"
          message="Besked"
          onCancel={onCancel}
          onConfirm={vi.fn()}
        />
      </ThemeProvider>
    );

    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Annuller' })).toHaveFocus());
    await user.click(within(dialog).getByRole('button', { name: 'Annuller' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <ConfirmationDialog
          open={false}
          title="Bekræft handling"
          message="Besked"
          onCancel={onCancel}
          onConfirm={vi.fn()}
        />
      </ThemeProvider>
    );

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Aktivt felt' })).toHaveFocus());
  });

  it('giver bekræft-knappen fokus, når annuller er skjult', async () => {
    renderDialog({
      open: true,
      title: 'Bekræft handling',
      message: 'Besked',
      hideCancelButton: true,
      onConfirm: vi.fn(),
    });

    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Ja' });
    expect(within(dialog).queryByRole('button', { name: 'Annuller' })).toBeNull();
    await waitFor(() => expect(confirmButton).toHaveFocus());
  });

  it('starter ikke bekræftelsen to gange ved dobbeltklik', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({
      open: true,
      title: 'Bekræft handling',
      message: 'Besked',
      onConfirm,
      onCancel: vi.fn(),
    });

    const confirmButton = within(screen.getByRole('dialog')).getByRole('button', { name: 'Ja' });
    await user.click(confirmButton);
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('frigiver bekræftelsen, når handlingen melder fejl uden at lukke dialogen', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => false);
    renderDialog({
      open: true,
      title: 'Bekræft handling',
      message: 'Besked',
      onConfirm,
      onCancel: vi.fn(),
    });

    const confirmButton = within(screen.getByRole('dialog')).getByRole('button', { name: 'Ja' });
    await user.click(confirmButton);
    await user.click(confirmButton);

    // Offentlige ydelser holder dialogen åben ved intern transaktionsfejl. Den skal kunne prøves igen.
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
