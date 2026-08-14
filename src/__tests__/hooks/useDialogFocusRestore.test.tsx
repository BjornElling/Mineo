// @vitest-environment jsdom
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDialogFocusRestore } from '../../hooks/useDialogFocusRestore';

/**
 * Kontraktkravet: når en popup lukkes, vender fokus tilbage til den kontrol, brugeren åbnede
 * den med (`keyboard-navigation.md` §Popup-fokus-restore).
 *
 * Testfladen er en minimal popup, der efterligner de tre virkelige former: en trigger, en
 * popup der tager fokus ved åbning, og en lukkevej. Selve `role="dialog"`-elementet er med,
 * fordi hookens tabt-fokus-prædikat netop behandler et popup-ejet element som «fokus tabt».
 */
const PopupHarness = ({
  allowFirstFocusableFallback = false,
  removeTriggerOnClose = false,
}: {
  allowFirstFocusableFallback?: boolean;
  removeTriggerOnClose?: boolean;
}) => {
  const [open, setOpen] = React.useState(false);
  const [triggerRemoved, setTriggerRemoved] = React.useState(false);
  const { triggerRef } = useDialogFocusRestore<HTMLButtonElement>({
    open,
    allowFirstFocusableFallback,
  });
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  return (
    <div>
      <button type="button">Før</button>
      {!triggerRemoved && (
        <button type="button" ref={triggerRef} onClick={() => setOpen(true)}>
          Åbn popup
        </button>
      )}
      <button type="button">Efter</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Popup">
          <button
            type="button"
            ref={closeButtonRef}
            onClick={() => {
              setOpen(false);
              if (removeTriggerOnClose) setTriggerRemoved(true);
            }}
          >
            Luk
          </button>
        </div>
      )}
    </div>
  );
};

describe('useDialogFocusRestore', () => {
  it('gendanner fokus til triggeren, når popupen lukkes', async () => {
    const user = userEvent.setup();
    render(<PopupHarness />);

    const trigger = screen.getByRole('button', { name: 'Åbn popup' });
    await user.click(trigger);

    const closeButton = screen.getByRole('button', { name: 'Luk' });
    await waitFor(() => expect(closeButton).toHaveFocus());

    await user.click(closeButton);

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('gendanner fokus til triggeren, selv når klikket ikke efterlod den fokuseret (WebKit-formen)', async () => {
    const user = userEvent.setup();
    render(<PopupHarness />);

    const trigger = screen.getByRole('button', { name: 'Åbn popup' });
    // WebKit fokuserer ikke `<button>` ved klik: der findes derfor intet husket aktivt element,
    // og restoren må hvile udelukkende på den eksplicitte trigger-ref.
    trigger.blur();
    await user.click(trigger);
    trigger.blur();

    const closeButton = screen.getByRole('button', { name: 'Luk' });
    await user.click(closeButton);

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('efterlader ikke fokus på body efter lukning', async () => {
    const user = userEvent.setup();
    render(<PopupHarness />);

    await user.click(screen.getByRole('button', { name: 'Åbn popup' }));
    await user.click(screen.getByRole('button', { name: 'Luk' }));

    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
  });

  it('falder tilbage til sidens første fokusbare element, når triggeren blev fjernet og fallback er slået til', async () => {
    const user = userEvent.setup();
    render(<PopupHarness allowFirstFocusableFallback removeTriggerOnClose />);

    await user.click(screen.getByRole('button', { name: 'Åbn popup' }));
    await user.click(screen.getByRole('button', { name: 'Luk' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Før' })).toHaveFocus());
  });

  it('flytter ikke fokus, når en anden kontrol med rette har overtaget det', async () => {
    const user = userEvent.setup();
    render(<PopupHarness />);

    await user.click(screen.getByRole('button', { name: 'Åbn popup' }));

    // Brugeren forlader selv popupen til et blivende element uden for den; restoren skal da
    // holde sig væk frem for at rykke fokus tilbage til triggeren.
    const efter = screen.getByRole('button', { name: 'Efter' });
    await user.click(efter);
    expect(efter).toHaveFocus();
  });
});
