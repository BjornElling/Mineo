// @vitest-environment jsdom
import { assignRef } from '../../utils/refUtils';
import type * as React from 'react';

describe('assignRef', () => {
  it('ignorerer en manglende ref', () => {
    expect(() => assignRef<HTMLDivElement>(undefined, null)).not.toThrow();
  });

  it('kalder callback-ref med den nye værdi', () => {
    const callbackRef = vi.fn<(value: HTMLDivElement | null) => void>();
    const value = document.createElement('div');

    assignRef(callbackRef, value);

    expect(callbackRef).toHaveBeenCalledWith(value);
  });

  it('skriver værdien til object-ref og kan rydde den igen', () => {
    const objectRef: { current: HTMLDivElement | null } = { current: null };
    const value = document.createElement('div');

    assignRef(objectRef, value);
    expect(objectRef.current).toBe(value);

    assignRef(objectRef, null);
    expect(objectRef.current).toBeNull();
  });

  it('ignorerer et objekt uden current-felt', () => {
    const malformedRef = {} as React.Ref<HTMLDivElement>;

    expect(() => assignRef(malformedRef, document.createElement('div'))).not.toThrow();
  });
});
