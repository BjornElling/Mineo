// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useFieldBehavior } from '../../hooks/useFieldBehavior';
import type { UseFieldBehaviorReturn } from '../../hooks/useFieldBehavior';

// ─── Harness ──────────────────────────────────────────────────────────────────

type CapturedResult = { result: UseFieldBehaviorReturn | null };

const makeHarness = (
  value: unknown,
  onChange?: (e: { target: { value: unknown } }) => void
): { captured: CapturedResult; Comp: React.FC } => {
  const captured: CapturedResult = { result: null };
  const Comp = () => {
    captured.result = useFieldBehavior(value, onChange);
    return null;
  };
  return { captured, Comp };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useFieldBehavior', () => {
  // ── Initial state ──────────────────────────────────────────────────────────

  it('returnerer isFocused=false initialt', () => {
    const { captured, Comp } = makeHarness('initial');
    render(<Comp />);
    expect(captured.result!.isFocused).toBe(false);
  });

  it('returnerer inputRef som en React.RefObject', () => {
    const { captured, Comp } = makeHarness('v');
    render(<Comp />);
    expect(captured.result!.inputRef).toBeDefined();
    expect('current' in captured.result!.inputRef).toBe(true);
  });

  // ── handleFocus ────────────────────────────────────────────────────────────

  it('sætter isFocused=true ved handleFocus', async () => {
    const { captured, Comp } = makeHarness('v');
    render(<Comp />);
    expect(captured.result!.isFocused).toBe(false);
    await act(async () => {
      captured.result!.handleFocus();
    });
    expect(captured.result!.isFocused).toBe(true);
  });

  // ── handleBlur ─────────────────────────────────────────────────────────────

  it('sætter isFocused=false ved handleBlur', async () => {
    const { captured, Comp } = makeHarness('v');
    render(<Comp />);
    await act(async () => {
      captured.result!.handleFocus();
    });
    expect(captured.result!.isFocused).toBe(true);
    await act(async () => {
      captured.result!.handleBlur();
    });
    expect(captured.result!.isFocused).toBe(false);
  });

  // ── handleKeyDown / Escape ────────────────────────────────────────────────

  it('kalder onChange med original værdi ved Escape', async () => {
    const onChange = vi.fn();
    const { captured, Comp } = makeHarness('original', onChange);
    render(<Comp />);

    // Focus registrerer den originale værdi
    await act(async () => {
      captured.result!.handleFocus();
    });

    // Simulér Escape-tast
    const escapeEvent = {
      key: 'Escape',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLElement>;

    await act(async () => {
      captured.result!.handleKeyDown(escapeEvent);
    });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith({ target: { value: 'original' } });
    expect(escapeEvent.preventDefault).toHaveBeenCalled();
  });

  it('kalder ikke onChange ved andre taster end Escape', async () => {
    const onChange = vi.fn();
    const { captured, Comp } = makeHarness('v', onChange);
    render(<Comp />);

    const enterEvent = {
      key: 'Enter',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLElement>;

    await act(async () => {
      captured.result!.handleKeyDown(enterEvent);
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('kalder ikke onChange ved Escape når onChange ikke er givet', async () => {
    const { captured, Comp } = makeHarness('v');
    render(<Comp />);

    const escapeEvent = {
      key: 'Escape',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLElement>;

    // Skal ikke kaste
    await act(async () => {
      captured.result!.handleKeyDown(escapeEvent);
    });
  });

  // ── Escape gendanner snapshot fra focus-tidspunkt ─────────────────────────

  it('gendanner værdien fra focus-tidspunktet (ikke nuværende prop)', async () => {
    const onChange = vi.fn();
    let currentValue = 'original';

    const captured: CapturedResult = { result: null };
    const Comp = () => {
      captured.result = useFieldBehavior(currentValue, onChange);
      return null;
    };

    const { rerender } = render(<Comp />);

    // Focus på original
    await act(async () => {
      captured.result!.handleFocus();
    });

    // Prop-værdien ændres (simulerer ekstern opdatering)
    currentValue = 'updated';
    rerender(<Comp />);

    // Escape skal gendanne 'original' (snapshottede ved focus)
    const escapeEvent = {
      key: 'Escape',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLElement>;

    await act(async () => {
      captured.result!.handleKeyDown(escapeEvent);
    });

    expect(onChange).toHaveBeenCalledWith({ target: { value: 'original' } });
  });

  // ── setIsFocused ──────────────────────────────────────────────────────────

  it('eksponerer setIsFocused der kan opdatere focus-state direkte', async () => {
    const { captured, Comp } = makeHarness('v');
    render(<Comp />);
    await act(async () => {
      captured.result!.setIsFocused(true);
    });
    expect(captured.result!.isFocused).toBe(true);
  });
});
