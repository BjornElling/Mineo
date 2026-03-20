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
