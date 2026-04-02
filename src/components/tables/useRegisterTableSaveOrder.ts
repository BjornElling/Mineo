import * as React from 'react';
import { registerTableSaveOrder, unregisterTableSaveOrder } from '../../utils/tableSaveOrderRegistry';

export const useRegisterTableSaveOrder = (
  saveOrderPath: string | undefined,
  visibleRowIds: readonly string[]
): void => {
  const rowIdsKey = React.useMemo(() => visibleRowIds.join('\u0001'), [visibleRowIds]);

  React.useEffect(() => {
    if (!saveOrderPath) return;
    registerTableSaveOrder(saveOrderPath, visibleRowIds);
    return () => {
      unregisterTableSaveOrder(saveOrderPath);
    };
  }, [saveOrderPath, rowIdsKey, visibleRowIds]);
};
