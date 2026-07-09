import { act, fireEvent, waitFor } from '@testing-library/react';

export const flushTableInteraction = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  await Promise.resolve();
};

export const focusTableElement = async (element: HTMLElement): Promise<void> => {
  await act(async () => {
    element.focus();
    await Promise.resolve();
  });
};

export const keyDownTableElement = async (
  element: HTMLElement,
  init: Parameters<typeof fireEvent.keyDown>[1]
): Promise<void> => {
  await act(async () => {
    fireEvent.keyDown(element, init);
    await Promise.resolve();
  });
};

export const changeTableInput = async (input: HTMLElement, value: string): Promise<void> => {
  await act(async () => {
    fireEvent.change(input, { target: { value } });
    await Promise.resolve();
  });
};

export const blurTableElement = async (element: HTMLElement): Promise<void> => {
  await act(async () => {
    fireEvent.blur(element);
    await Promise.resolve();
  });
};

export const openTableInputEditing = async (input: HTMLElement, startKey = '1'): Promise<void> => {
  await focusTableElement(input);
  if (input.hasAttribute('readonly')) {
    await keyDownTableElement(input, { key: startKey });
  }
  await waitFor(() => {
    expect(input).not.toHaveAttribute('readonly');
  });
};

export const clearFocusedTableCell = async (
  input: HTMLElement,
  key: 'Backspace' | 'Delete'
): Promise<void> => {
  await focusTableElement(input);
  await keyDownTableElement(input, { key });
};
