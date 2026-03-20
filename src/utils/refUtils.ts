import type * as React from 'react';

export const assignRef = <T>(ref: React.Ref<T> | undefined, value: T | null): void => {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (typeof ref === 'object' && ref !== null && 'current' in ref) {
    (ref as React.RefObject<T | null>).current = value;
  }
};
