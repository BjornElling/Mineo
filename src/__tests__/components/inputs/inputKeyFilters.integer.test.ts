import { describe, expect, it } from 'vitest';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { filterIntegerKeyDown, filterIntegerPaste } from '../../../components/inputs/inputKeyFilters';

const makeKeyboardEvent = (input: HTMLInputElement, key: string) => {
  let prevented = false;
  let stopped = false;
  const event = {
    key,
    currentTarget: input,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    nativeEvent: { isComposing: false },
    preventDefault: () => {
      prevented = true;
    },
    stopPropagation: () => {
      stopped = true;
    },
  } as unknown as KeyboardEvent<HTMLInputElement>;

  return {
    event,
    wasBlocked: () => prevented && stopped,
  };
};

const makePasteEvent = (input: HTMLInputElement, pasted: string) => {
  let prevented = false;
  let stopped = false;
  const event = {
    currentTarget: input,
    clipboardData: {
      getData: (type: string) => (type === 'text' || type === 'text/plain' ? pasted : ''),
    },
    nativeEvent: { isComposing: false },
    preventDefault: () => {
      prevented = true;
    },
    stopPropagation: () => {
      stopped = true;
    },
  } as unknown as ClipboardEvent<HTMLInputElement>;

  return {
    event,
    wasBlocked: () => prevented && stopped,
  };
};

describe('inputKeyFilters integer constraints', () => {
  it('blokkerer tastetryk når maxDigits overskrides', () => {
    const input = document.createElement('input');
    input.value = '12';
    input.setSelectionRange(2, 2);
    const key = makeKeyboardEvent(input, '3');

    filterIntegerKeyDown(key.event, { maxDigits: 2 });

    expect(key.wasBlocked()).toBe(true);
  });

  it('blokkerer tastetryk når maxValue overskrides', () => {
    const input = document.createElement('input');
    input.value = '9';
    input.setSelectionRange(1, 1);
    const key = makeKeyboardEvent(input, '9');

    filterIntegerKeyDown(key.event, { maxValue: 95 });

    expect(key.wasBlocked()).toBe(true);
  });

  it('tillader valid tastetryk indenfor grænser', () => {
    const input = document.createElement('input');
    input.value = '9';
    input.setSelectionRange(1, 1);
    const key = makeKeyboardEvent(input, '5');

    filterIntegerKeyDown(key.event, { maxDigits: 2, maxValue: 95 });

    expect(key.wasBlocked()).toBe(false);
  });

  it('blokkerer paste når maxDigits overskrides', () => {
    const input = document.createElement('input');
    input.value = '';
    input.setSelectionRange(0, 0);
    const paste = makePasteEvent(input, '123');

    filterIntegerPaste(paste.event, { maxDigits: 2 });

    expect(paste.wasBlocked()).toBe(true);
  });

  it('blokkerer paste når maxValue overskrides', () => {
    const input = document.createElement('input');
    input.value = '';
    input.setSelectionRange(0, 0);
    const paste = makePasteEvent(input, '99');

    filterIntegerPaste(paste.event, { maxValue: 95 });

    expect(paste.wasBlocked()).toBe(true);
  });

  it('tillader valid paste indenfor grænser', () => {
    const input = document.createElement('input');
    input.value = '';
    input.setSelectionRange(0, 0);
    const paste = makePasteEvent(input, '95');

    filterIntegerPaste(paste.event, { maxDigits: 2, maxValue: 95 });

    expect(paste.wasBlocked()).toBe(false);
  });
});
