// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledToggleSwitch from '../../../components/inputs/StyledToggleSwitch';
import type { CommitEvent } from '../../../types/fieldEvents';
import {
  TOGGLE_REFUSAL_SHAKE_CLASS,
  TOGGLE_REFUSAL_SHAKE_DURATION_MS,
} from '../../../components/inputs/toggleRefusalShake';

/**
 * Test-wrapper der simulerer korrekt controlled usage.
 *
 * - Holder checked i state
 * - Opdaterer checked synkront via onCommit
 * - Eksponerer commit-spy til assertions
 */
function renderControlledToggle(
  initialChecked = false,
  disabled = false,
  withLabel = true
) {
  const commitSpy = vi.fn<(event: CommitEvent<boolean>) => void>();

  const Wrapper = () => {
    const [checked, setChecked] = React.useState(initialChecked);

    const handleCommit = React.useCallback((e: CommitEvent<boolean>) => {
      commitSpy(e);
      setChecked(e.target.value);
      return true;
    }, []);

    return (
      <StyledToggleSwitch
        // Navnet er obligatorisk. `withLabel` vælger nu mellem SYNLIG tekst og et rent
        // accessibility-navn – ikke mellem navn og intet navn, som ikke længere er en mulig tilstand.
        {...(withLabel ? { visibleLabel: 'Test toggle' } : { ariaLabel: 'Test toggle' })}
        checked={checked}
        disabled={disabled}
        onCommit={handleCommit}
      />
    );
  };

  render(<Wrapper />);
  const toggle = screen.getByRole('checkbox');

  return { toggle, commitSpy };
}

describe('StyledToggleSwitch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // POINTER INPUT
  // ===========================================================================

  describe('pointer-input (klik)', () => {
    it('toggler fra false til true ved klik', async () => {
      const user = userEvent.setup();
      const { toggle, commitSpy } = renderControlledToggle(false);

      expect(toggle).not.toBeChecked();

      await user.click(toggle);

      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(commitSpy.mock.calls[0][0].target.value).toBe(true);
      expect(toggle).toBeChecked();
    });

    it('toggler fra true til false ved klik', async () => {
      const user = userEvent.setup();
      const { toggle, commitSpy } = renderControlledToggle(true);

      expect(toggle).toBeChecked();

      await user.click(toggle);

      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(commitSpy.mock.calls[0][0].target.value).toBe(false);
      expect(toggle).not.toBeChecked();
    });

    it('kalder IKKE onCommit når disabled=true', async () => {
      // Brug pointerEventsCheck: false for at tillade klik på disabled element
      // (tester at komponenten selv blokerer, ikke bare CSS)
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const { toggle, commitSpy } = renderControlledToggle(false, true);

      expect(toggle).toBeDisabled();

      await user.click(toggle);

      expect(commitSpy).not.toHaveBeenCalled();
      expect(toggle).not.toBeChecked();
    });
  });

  // ===========================================================================
  // KEYBOARD INPUT
  // ===========================================================================

  describe('keyboard-input (Enter)', () => {
    it('toggler ved Enter', async () => {
      const user = userEvent.setup();
      const { toggle, commitSpy } = renderControlledToggle(false);

      act(() => toggle.focus());
      expect(toggle).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(commitSpy.mock.calls[0][0].target.value).toBe(true);
      expect(toggle).toBeChecked();
    });

    it('kalder IKKE onCommit når disabled=true', async () => {
      const user = userEvent.setup();
      const { toggle, commitSpy } = renderControlledToggle(false, true);

      act(() => toggle.focus());
      await user.keyboard('{Enter}');

      expect(commitSpy).not.toHaveBeenCalled();
      expect(toggle).not.toBeChecked();
    });
  });

  describe('keyboard-input (Space)', () => {
    it('toggler ved Space', async () => {
      const user = userEvent.setup();
      const { toggle, commitSpy } = renderControlledToggle(false);

      act(() => toggle.focus());
      expect(toggle).toHaveFocus();

      await user.keyboard(' ');

      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(commitSpy.mock.calls[0][0].target.value).toBe(true);
      expect(toggle).toBeChecked();
    });

    it('kalder IKKE onCommit når disabled=true', async () => {
      const user = userEvent.setup();
      const { toggle, commitSpy } = renderControlledToggle(false, true);

      act(() => toggle.focus());
      await user.keyboard(' ');

      expect(commitSpy).not.toHaveBeenCalled();
      expect(toggle).not.toBeChecked();
    });
  });

  describe('gentagne keyboard-inputs', () => {
    it('toggler frem og tilbage ved gentagne Enter', async () => {
      const user = userEvent.setup();
      const { toggle, commitSpy } = renderControlledToggle(false);

      act(() => toggle.focus());

      // Første Enter: false → true
      await user.keyboard('{Enter}');
      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(toggle).toBeChecked();

      // Anden Enter: true → false
      await user.keyboard('{Enter}');
      expect(commitSpy).toHaveBeenCalledTimes(2);
      expect(toggle).not.toBeChecked();

      // Tredje Enter: false → true
      await user.keyboard('{Enter}');
      expect(commitSpy).toHaveBeenCalledTimes(3);
      expect(toggle).toBeChecked();
    });

    it('toggler frem og tilbage ved gentagne Space', async () => {
      const user = userEvent.setup();
      const { toggle, commitSpy } = renderControlledToggle(false);

      act(() => toggle.focus());

      await user.keyboard(' ');
      expect(toggle).toBeChecked();

      await user.keyboard(' ');
      expect(toggle).not.toBeChecked();

      expect(commitSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // INGEN IMPERATIV FLADE
  // ===========================================================================

  describe('ingen imperativ ref-flade', () => {
    it('eksponerer INTET handle – rystelsen udløses af afvisningen, ikke udefra', () => {
      // Kontakten havde et `StyledToggleSwitchHandle` med præcis ét medlem, `shake()`, som en gate
      // skulle huske at kalde. Rystelsen er genindført (udviklerbeslutning 2026-10-28), men ejes nu af
      // kontakten selv og udløses af en afvist commit – se describe-blokken herunder.
      //
      // Testen måler fraværet på den ENESTE måde, der ikke kan blive grøn af tomhed: den renderer
      // komponenten med en ref og fastslår, at intet bliver tildelt. Ville nogen genindføre et
      // `useImperativeHandle`, bliver `ref.current` non-null, og denne test bliver rød.
      const ref = React.createRef<unknown>();
      render(
        <StyledToggleSwitch
          checked={false}
          onCommit={() => true}
          ariaLabel="Test toggle"
          {...({ ref } as Record<string, unknown>)}
        />
      );

      expect(screen.getByRole('checkbox', { name: 'Test toggle' })).toBeInTheDocument();
      expect(ref.current).toBeNull();
    });
  });

  // ===========================================================================
  // AFVISNINGSRYSTELSE (page-component-contract §11.1b)
  // ===========================================================================

  describe('afvisningsrystelse', () => {
    const switchRoot = (toggle: HTMLElement): HTMLElement => {
      const root = toggle.closest<HTMLElement>('.MuiSwitch-root');
      if (root === null) throw new Error('Switchens rod blev ikke fundet');
      return root;
    };

    const renderRefusingToggle = (props: { disabled?: boolean; withLabel?: boolean } = {}) => {
      const onCommit = vi.fn(() => false);
      render(
        <StyledToggleSwitch
          {...(props.withLabel === false ? { ariaLabel: 'Afvisende toggle' } : { visibleLabel: 'Afvisende toggle' })}
          checked={false}
          disabled={props.disabled ?? false}
          onCommit={onCommit}
        />
      );
      return { toggle: screen.getByRole('checkbox'), onCommit };
    };

    it('ryster, når onCommit afviser et klik, og bliver stående', async () => {
      const user = userEvent.setup();
      const { toggle, onCommit } = renderRefusingToggle();

      await user.click(toggle);

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(toggle).not.toBeChecked();
      expect(switchRoot(toggle)).toHaveClass(TOGGLE_REFUSAL_SHAKE_CLASS);
    });

    it.each([' ', '{Enter}'])('ryster, når onCommit afviser tastaturaktivering (%j)', async (key) => {
      const user = userEvent.setup();
      const { toggle, onCommit } = renderRefusingToggle();

      toggle.focus();
      await user.keyboard(key);
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(switchRoot(toggle)).toHaveClass(TOGGLE_REFUSAL_SHAKE_CLASS);
    });

    it('ryster ikke, når commit accepteres', async () => {
      const user = userEvent.setup();
      const { toggle } = renderControlledToggle(false);

      await user.click(toggle);

      expect(toggle).toBeChecked();
      expect(switchRoot(toggle)).not.toHaveClass(TOGGLE_REFUSAL_SHAKE_CLASS);
    });

    it('ryster ved klik på den synlige tekst af en inaktiv toggle', async () => {
      const user = userEvent.setup();
      const { toggle, onCommit } = renderRefusingToggle({ disabled: true });

      // Klik på den synlige tekst: labelen videresender ikke klik til et disabled input.
      await user.click(screen.getByText('Afvisende toggle'));

      expect(onCommit).not.toHaveBeenCalled();
      expect(switchRoot(toggle)).toHaveClass(TOGGLE_REFUSAL_SHAKE_CLASS);
    });

    it('ryster ved klik på roden af en inaktiv toggle uden synlig label', async () => {
      const { toggle, onCommit } = renderRefusingToggle({ disabled: true, withLabel: false });

      // MUI giver den deaktiverede switch-knap `pointer-events: none`; klikket lander på roden.
      act(() => {
        switchRoot(toggle).click();
      });

      expect(onCommit).not.toHaveBeenCalled();
      expect(switchRoot(toggle)).toHaveClass(TOGGLE_REFUSAL_SHAKE_CLASS);
    });

    it('fjerner klassen efter animationen og genstarter den ved et nyt klik', async () => {
      vi.useFakeTimers();
      const { toggle } = renderRefusingToggle();
      const root = switchRoot(toggle);

      act(() => {
        toggle.click();
      });
      expect(root).toHaveClass(TOGGLE_REFUSAL_SHAKE_CLASS);

      act(() => {
        vi.advanceTimersByTime(TOGGLE_REFUSAL_SHAKE_DURATION_MS - 1);
        toggle.click();
      });
      // Det gentagne klik nulstiller timeren, så rystelsen ikke klippes af den første oprydning.
      act(() => {
        vi.advanceTimersByTime(TOGGLE_REFUSAL_SHAKE_DURATION_MS - 1);
      });
      expect(root).toHaveClass(TOGGLE_REFUSAL_SHAKE_CLASS);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(root).not.toHaveClass(TOGGLE_REFUSAL_SHAKE_CLASS);
    });
  });

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  describe('rendering', () => {
    it('viser korrekt initial checked=false state', () => {
      renderControlledToggle(false);
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('viser korrekt initial checked=true state', () => {
      renderControlledToggle(true);
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('viser label korrekt og bruger den som kontrollens navn', () => {
      renderControlledToggle(false, false, true);
      expect(screen.getByText('Test toggle')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Test toggle' })).toBeInTheDocument();
    });

    it('har et navn uden synlig tekst, når navnet gives som ariaLabel', () => {
      renderControlledToggle(false, false, false);
      expect(screen.queryByText('Test toggle')).not.toBeInTheDocument();
      // Navnløs er ikke længere en mulig tilstand: kontrollen kan altid findes på sit navn.
      expect(screen.getByRole('checkbox', { name: 'Test toggle' })).toBeInTheDocument();
    });

    it('viser disabled state', () => {
      renderControlledToggle(false, true);
      expect(screen.getByRole('checkbox')).toBeDisabled();
    });
  });

  // ===========================================================================
  // COMMIT EVENT STRUKTUR
  // ===========================================================================

  describe('CommitEvent struktur', () => {
    it('sender korrekt CommitEvent ved toggle til true', async () => {
      const user = userEvent.setup();
      const { toggle, commitSpy } = renderControlledToggle(false);

      await user.click(toggle);

      const event = commitSpy.mock.calls[0][0];
      expect(event).toHaveProperty('__mineoEvent', 'MineoFieldEvent');
      expect(event).toHaveProperty('kind', 'commit');
      expect(event).toHaveProperty('target');
      expect(event.target).toHaveProperty('value', true);
    });

    it('sender korrekt CommitEvent ved toggle til false', async () => {
      const user = userEvent.setup();
      const { toggle, commitSpy } = renderControlledToggle(true);

      await user.click(toggle);

      const event = commitSpy.mock.calls[0][0];
      expect(event.target.value).toBe(false);
    });
  });
});
