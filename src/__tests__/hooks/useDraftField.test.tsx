import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';

const parseTrimmedString: DraftParse<string> = (draft, context) => {
  if (draft.trim() === '') {
    return context.mode === 'commit'
      ? { ok: false, kind: 'invalid', message: 'Tom værdi' }
      : { ok: false, kind: 'empty' };
  }
  return { ok: true, value: draft.trim() };
};

describe('useDraftField', () => {
  it('committer én gang på blur', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useDraftField({
        value: 'old',
        format: (v) => v,
        parse: parseTrimmedString,
        onCommit,
      })
    );

    act(() => {
      result.current.onFocus();
      result.current.setDraft('next');
    });
    act(() => {
      result.current.onBlur();
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('next');
  });

  it('Enter giver commit, og efterfølgende blur giver ikke dobbelt-commit', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useDraftField({
        value: 'old',
        format: (v) => v,
        parse: parseTrimmedString,
        onCommit,
      })
    );

    const keyEvent = {
      key: 'Enter',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: document.createElement('div'),
    } as unknown as React.KeyboardEvent<HTMLInputElement>;

    act(() => {
      result.current.onFocus();
      result.current.setDraft('next');
    });
    act(() => {
      result.current.onKeyDown(keyEvent);
      result.current.onBlur();
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('next');
  });

  it('Escape annullerer commit og suppress’er næste blur-commit', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useDraftField({
        value: 'start',
        format: (v) => v,
        parse: parseTrimmedString,
        onCommit,
      })
    );

    const keyEvent = {
      key: 'Escape',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLInputElement>;

    act(() => {
      result.current.onFocus();
      result.current.setDraft('changed');
      result.current.onKeyDown(keyEvent);
      result.current.onBlur();
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.draft).toBe('start');
  });

  it('muterer ikke draft under typing', () => {
    const { result } = renderHook(() =>
      useDraftField({
        value: 'x',
        format: (v) => v,
        parse: parseTrimmedString,
        onCommit: vi.fn(),
      })
    );

    act(() => {
      result.current.onFocus();
      result.current.setDraft('  abc  ');
    });

    expect(result.current.draft).toBe('  abc  ');
  });

  it('resyncer draft ved ekstern committed value-ændring uden commit callback', () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) =>
        useDraftField({
          value,
          format: (v) => v,
          parse: parseTrimmedString,
          onCommit,
        }),
      { initialProps: { value: 'før' } }
    );

    act(() => {
      result.current.onBlur();
    });
    expect(onCommit).toHaveBeenCalledTimes(1);

    rerender({ value: 'efter' });
    expect(result.current.draft).toBe('efter');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('overskriver IKKE draften ved ekstern value-ændring mens feltet er fokuseret (React-fokus)', () => {
    // Fase 2-invariant (physical-focus-beskyttelse): mens brugeren aktivt redigerer, må en ekstern
    // committed value-ændring (fx fra en samtidig store-opdatering) ikke trække draften væk under
    // fingrene på brugeren — det ville give flicker/silent-rollback. Resync sker først når fokus slippes.
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) =>
        useDraftField({
          value,
          format: (v) => v,
          parse: parseTrimmedString,
          onCommit,
        }),
      { initialProps: { value: 'før' } }
    );

    act(() => {
      result.current.onFocus();
      result.current.setDraft('redigerer');
    });

    // Ekstern committed value skifter mens feltet er fokuseret.
    rerender({ value: 'efter' });

    // Draften bevares uændret — brugerens redigering vinder, ingen overskrivning, intet commit.
    expect(result.current.draft).toBe('redigerer');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('beskytter draften ved fysisk DOM-fokus (inputElementRef) selv uden React-isFocused — værn mod focus-lag', () => {
    // Ved hurtig tab-navigation kan React-fokus-state lagge bag DOM'ens activeElement. hasPhysicalFocus
    // (document.activeElement mod inputElementRef) er det robuste værn, der hindrer resync af et felt der
    // reelt har fokus, selv før onFocus-state'n er sat. Her sættes draften UDEN at kalde onFocus.
    const el = document.createElement('input');
    document.body.appendChild(el);
    el.focus();
    const inputElementRef = { current: el } as React.RefObject<HTMLInputElement>;

    try {
      const onCommit = vi.fn();
      const { result, rerender } = renderHook(
        ({ value }) =>
          useDraftField({
            value,
            format: (v) => v,
            parse: parseTrimmedString,
            onCommit,
            inputElementRef,
          }),
        { initialProps: { value: 'før' } }
      );

      act(() => {
        // Ingen onFocus() — kun fysisk DOM-fokus (el er document.activeElement).
        result.current.setDraft('redigerer');
      });

      rerender({ value: 'efter' });
      expect(result.current.draft).toBe('redigerer');

      // Når den fysiske fokus slippes, følger draften igen den eksterne kilde ved næste resync.
      el.blur();
      rerender({ value: 'endelig' });
      expect(result.current.draft).toBe('endelig');
    } finally {
      document.body.removeChild(el);
    }
  });

  it('commitDraft suppress’er efterfølgende blur-commit', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useDraftField({
        value: 'old',
        format: (v) => v,
        parse: parseTrimmedString,
        onCommit,
      })
    );

    act(() => {
      result.current.onFocus();
      result.current.commitDraft('next');
      result.current.onBlur();
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('next');
  });
});
