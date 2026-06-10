import * as React from 'react';
import type { StorageKey } from '../config/storageManifest';

/**
 * Scope for celle-`invalidDrafts`-recovery-kanalen (jf. `persistence-contract.md` §11 + Fase 3 i
 * `ugyldigt-input-persisteret-invaliddrafts.md`).
 *
 * En feature-tabel wrapper sit grid i denne provider, så hver celle (`useTableInputCore` via
 * `useCellInvalidDraftChannel`) kan udlede sin fuldt kvalificerede `fieldPath` og skrive/læse sin
 * ikke-committbare rå draft. Når konteksten mangler (fx isolerede tabel-tests uden
 * `FormPersistenceProvider`), falder cellen tilbage til lokal draft-bevarelse — samme ubundne
 * adfærd som `useDraftField` uden `onCommitInvalid`-kanal.
 */
export type CellInvalidDraftScope = Readonly<{
  pageKey: StorageKey;
  /** Stabilt, app-unikt tabel-id (route-diskriminerende). Se `config/cellInvalidDraftScopes.ts`. */
  tableId: string;
  /** Valgfri ekstra kvalifikator (fx ansættelsesforhold-id), når samme tabel-id rendres flere gange i én sektion. */
  rowScope: string;
}>;

export const CellInvalidDraftScopeContext = React.createContext<CellInvalidDraftScope | null>(null);

export type CellInvalidDraftScopeProviderProps = Readonly<{
  pageKey: StorageKey;
  tableId: string;
  rowScope?: string;
  children: React.ReactNode;
}>;

export const CellInvalidDraftScopeProvider = ({
  pageKey,
  tableId,
  rowScope = '',
  children,
}: CellInvalidDraftScopeProviderProps): React.ReactElement => {
  const value = React.useMemo<CellInvalidDraftScope>(
    () => ({ pageKey, tableId, rowScope }),
    [pageKey, tableId, rowScope]
  );
  return <CellInvalidDraftScopeContext.Provider value={value}>{children}</CellInvalidDraftScopeContext.Provider>;
};
