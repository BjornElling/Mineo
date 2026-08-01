// @vitest-environment jsdom
import type { KeyboardEvent } from 'react';
import { filterAmountExpressionKeyDown } from '../../../components/inputs/inputKeyFilters';

const isBlockedInsertion = (value: string, key: string, cursor = value.length): boolean => {
  const input = document.createElement('input');
  input.value = value;
  input.setSelectionRange(cursor, cursor);
  let prevented = false;
  let stopped = false;
  const event = {
    key,
    currentTarget: input,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    nativeEvent: { isComposing: false },
    preventDefault: () => { prevented = true; },
    stopPropagation: () => { stopped = true; },
  } as unknown as KeyboardEvent<HTMLInputElement>;

  filterAmountExpressionKeyDown(event, {
    allowNegative: true,
    allowDecimals: true,
    maxDecimalDigits: 2,
  });

  return prevented && stopped;
};

describe('filterAmountExpressionKeyDown', () => {
  it('tillader to decimaler og blokerer den tredje', () => {
    expect(isBlockedInsertion('12,3', '4')).toBe(false);
    expect(isBlockedInsertion('12,34', '5')).toBe(true);
  });

  it('håndhæver grænsen i hvert talled i et beløbsudtryk', () => {
    expect(isBlockedInsertion('12,34 + 5,6', '7')).toBe(false);
    expect(isBlockedInsertion('12,34 + 5,67', '8')).toBe(true);
  });

  it('tillader redigering inden for de eksisterende to decimalpladser', () => {
    const input = document.createElement('input');
    input.value = '12,34';
    input.setSelectionRange(4, 5);
    let prevented = false;
    const event = {
      key: '5',
      currentTarget: input,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      nativeEvent: { isComposing: false },
      preventDefault: () => { prevented = true; },
      stopPropagation: () => undefined,
    } as unknown as KeyboardEvent<HTMLInputElement>;

    filterAmountExpressionKeyDown(event, {
      allowNegative: true,
      allowDecimals: true,
      maxDecimalDigits: 2,
    });

    expect(prevented).toBe(false);
  });
});
