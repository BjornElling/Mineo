type TableInputErrorEntry = Readonly<{
  message: string;
  getElement: () => HTMLElement | null;
}>;

const tableInputErrors = new Map<string, TableInputErrorEntry>();

export type BlockingTableInputErrorTarget = Readonly<{
  kind: 'table-input';
  message: string;
  element: HTMLElement | null;
}>;

export const setTableInputError = (key: string, entry: TableInputErrorEntry | null): void => {
  if (entry === null || entry.message.trim() === '') {
    tableInputErrors.delete(key);
    return;
  }

  tableInputErrors.set(key, {
    message: entry.message.trim(),
    getElement: entry.getElement,
  });
};

export const clearTableInputError = (key: string): void => {
  tableInputErrors.delete(key);
};

export const getFirstBlockingTableInputErrorTarget = (): BlockingTableInputErrorTarget | null => {
  for (const [key, entry] of tableInputErrors) {
    const element = entry.getElement();
    if (element === null || !element.isConnected) {
      tableInputErrors.delete(key);
      continue;
    }

    return {
      kind: 'table-input',
      message: entry.message,
      element,
    };
  }

  return null;
};
