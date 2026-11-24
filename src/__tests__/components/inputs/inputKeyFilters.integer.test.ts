// @vitest-environment jsdom
import type { KeyboardEvent } from 'react';
import { filterIntegerKeyDown } from '../../../components/inputs/inputKeyFilters';

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
});
