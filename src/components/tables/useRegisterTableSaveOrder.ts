import * as React from 'react';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import { registerTableSaveOrder, unregisterTableSaveOrder } from '../../utils/tableSaveOrderRegistry';

export const useRegisterTableSaveOrder = (
  saveOrderPath: TableSaveOrderPath | undefined,
  visibleRowIds: readonly string[]
): void => {
  const rowIdsKey = React.useMemo(() => visibleRowIds.join('\u0001'), [visibleRowIds]);

  React.useEffect(() => {
    if (!saveOrderPath) return;
    // rowIdsKey styrer genregistrering ved indholdsændring; visibleRowIds bruges som den autoritative rækkefølge.
    registerTableSaveOrder(saveOrderPath, visibleRowIds);
    return () => {
      unregisterTableSaveOrder(saveOrderPath);
    };
  }, [saveOrderPath, rowIdsKey, visibleRowIds]);
};
