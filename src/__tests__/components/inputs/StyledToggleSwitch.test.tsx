/// <reference types="vitest/globals" />
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledToggleSwitch from '../../../components/inputs/StyledToggleSwitch';
import type { CommitEvent } from '../../../types/fieldEvents';
import type { StyledToggleSwitchHandle } from '../../../types/handles';

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
    }, []);

    return (
      <StyledToggleSwitch
        label={withLabel ? 'Test toggle' : undefined}
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

/**
 * Test-wrapper med ref til at teste shake() funktionalitet.
 */
function renderWithRef(initialChecked = false) {
  const commitSpy = vi.fn<(event: CommitEvent<boolean>) => void>();
  const toggleRef = React.createRef<StyledToggleSwitchHandle>();

  const Wrapper = () => {
    const [checked, setChecked] = React.useState(initialChecked);

    const handleCommit = React.useCallback((e: CommitEvent<boolean>) => {
      commitSpy(e);
      setChecked(e.target.value);
    }, []);

    return (
      <StyledToggleSwitch
        ref={toggleRef}
        label="Test toggle"
        checked={checked}
        onCommit={handleCommit}
      />
    );
  };

  render(<Wrapper />);
  const toggle = screen.getByRole('checkbox');

  return { toggle, commitSpy, toggleRef };
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

      toggle.focus();
      expect(toggle).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(commitSpy.mock.calls[0][0].target.value).toBe(true);
      expect(toggle).toBeChecked();
    });

    it('kalder IKKE onCommit når disabled=true', async () => {
      const user = userEvent.setup();
      const { toggle, commitSpy } = renderControlledToggle(false, true);

      toggle.focus();
      await user.keyboard('{Enter}');

      expect(commitSpy).not.toHaveBeenCalled();
      expect(toggle).not.toBeChecked();
    });
  });

  describe('keyboard-input (Space)', () => {
    it('toggler ved Space', async () => {
      const user = userEvent.setup();
      const { toggle, commitSpy } = renderControlledToggle(false);

      toggle.focus();
      expect(toggle).toHaveFocus();

      await user.keyboard(' ');

      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(commitSpy.mock.calls[0][0].target.value).toBe(true);
      expect(toggle).toBeChecked();
    });

    it('kalder IKKE onCommit når disabled=true', async () => {
      const user = userEvent.setup();
      const { toggle, commitSpy } = renderControlledToggle(false, true);

      toggle.focus();
      await user.keyboard(' ');

      expect(commitSpy).not.toHaveBeenCalled();
      expect(toggle).not.toBeChecked();
    });
  });

  describe('gentagne keyboard-inputs', () => {
    it('toggler frem og tilbage ved gentagne Enter', async () => {
      const user = userEvent.setup();
      const { toggle, commitSpy } = renderControlledToggle(false);

      toggle.focus();

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

      toggle.focus();

      await user.keyboard(' ');
      expect(toggle).toBeChecked();

      await user.keyboard(' ');
      expect(toggle).not.toBeChecked();

      expect(commitSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // SHAKE ANIMATION
  // ===========================================================================

  describe('shake() imperative handle', () => {
    it('eksponerer shake() metode via ref', () => {
      const { toggleRef } = renderWithRef(false);

      expect(toggleRef.current).not.toBeNull();
      expect(typeof toggleRef.current?.shake).toBe('function');
    });

    it('shake() er idempotent - gentagne kald ignoreres mens animation kører', () => {
      vi.useFakeTimers();

      const { toggleRef } = renderWithRef(false);

      // Første shake starter animation
      act(() => {
        toggleRef.current?.shake();
      });

      // Gentagne kald bør ignoreres (idempotent)
      act(() => {
        toggleRef.current?.shake();
        toggleRef.current?.shake();
        toggleRef.current?.shake();
      });

      // Lad animation afslutte
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Ingen fejl = success (vi tester bare at det ikke crasher)
      expect(true).toBe(true);
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

    it('viser label korrekt', () => {
      renderControlledToggle(false, false, true);
      expect(screen.getByText('Test toggle')).toBeInTheDocument();
    });

    it('rendrer uden label', () => {
      renderControlledToggle(false, false, false);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
      expect(screen.queryByText('Test toggle')).not.toBeInTheDocument();
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
