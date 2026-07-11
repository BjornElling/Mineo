// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useInvalidDraftSlot, type InvalidDraftChannel } from '../../../hooks/fieldState/useInvalidDraftSlot';

describe('useInvalidDraftSlot — delt bundet/lokal-forgrening', () => {
  it('ubundet: holder en lokal fallback for write/clear (kanalen røres ikke)', () => {
    const onCommitInvalid = vi.fn();
    const clearInvalidDraft = vi.fn();
    const channel: InvalidDraftChannel = {
      bound: false,
      committedInvalidDraft: 'kanal-værdi',
      onCommitInvalid,
      clearInvalidDraft,
    };
    const { result } = renderHook(() => useInvalidDraftSlot(channel));

    // Ubundet ignorerer kanalens committede værdi.
    expect(result.current.effectiveInvalidDraft).toBeUndefined();

    act(() => result.current.writeInvalidDraft('12,,3'));
    expect(result.current.effectiveInvalidDraft).toBe('12,,3');
    expect(onCommitInvalid).not.toHaveBeenCalled();

    act(() => result.current.clearInvalidDraft());
    expect(result.current.effectiveInvalidDraft).toBeUndefined();
    expect(clearInvalidDraft).not.toHaveBeenCalled();
  });

  it('bundet: læser kanalens committede værdi og dispatcher write/clear til kanalen', () => {
    const onCommitInvalid = vi.fn();
    const clearInvalidDraft = vi.fn();
    const channel: InvalidDraftChannel = {
      bound: true,
      committedInvalidDraft: 'kanal-værdi',
      onCommitInvalid,
      clearInvalidDraft,
    };
    const { result } = renderHook(() => useInvalidDraftSlot(channel));

    expect(result.current.effectiveInvalidDraft).toBe('kanal-værdi');

    act(() => result.current.writeInvalidDraft('rå'));
    expect(onCommitInvalid).toHaveBeenCalledWith('rå');

    act(() => result.current.clearInvalidDraft());
    expect(clearInvalidDraft).toHaveBeenCalledTimes(1);
  });
});
