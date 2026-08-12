import React from 'react';
import { Alert, Button } from '@mui/material';
import {
  isVitePreloadRecoveryPending,
  reloadAfterVitePreloadRecovery,
  subscribeVitePreloadRecovery,
} from '../../apps/shared/vitePreloadRecovery';
import { useCriticalInputActions } from '../../inputCore/react';

type LazyChunkRecoveryNoticeProps = Readonly<{
  onReloadBlocked: () => void;
}>;

/**
 * Sidste værn for en manglende lazy chunk — IKKE en opdateringslinje.
 *
 * Programmet har ingen synlig opdaterings-UI: en ny version installeres komplet før render ved næste
 * opstart, og en åben session skifter aldrig version (`serviceWorkerBootstrap`). Denne linje dækker
 * derfor kun den restkategori, versionscachen ikke kan nå: ryddet Cache Storage under lagerpres, eller
 * en første installation, der aldrig blev fuldført (fx offline). Se app-shell-kontraktens
 * «Kendte Undtagelser».
 *
 * Genindlæsningen er brugerudløst og går gennem `CriticalActionCoordinator`, så en åben editors draft
 * enten afsluttes eller blokerer navigationen eksplicit.
 */
const LazyChunkRecoveryNotice = ({ onReloadBlocked }: LazyChunkRecoveryNoticeProps): React.ReactElement | null => {
  const recoveryPending = React.useSyncExternalStore(
    subscribeVitePreloadRecovery,
    isVitePreloadRecoveryPending,
    isVitePreloadRecoveryPending,
  );
  const criticalActions = useCriticalInputActions();

  const handleReload = React.useCallback(async () => {
    const preparation = await criticalActions.prepare('reload');
    if (preparation.status === 'blocked') {
      preparation.target?.focus();
      onReloadBlocked();
      return;
    }

    reloadAfterVitePreloadRecovery();
  }, [criticalActions, onReloadBlocked]);

  if (!recoveryPending) return null;

  return (
    <Alert
      severity="info"
      action={
        <Button
          color="inherit"
          onClick={() => {
            void handleReload();
          }}
          size="small"
        >
          Genindlæs nu
        </Button>
      }
      sx={{ marginBottom: 2 }}
    >
      En programdel skal genindlæses, før handlingen kan fortsætte.
    </Alert>
  );
};

LazyChunkRecoveryNotice.displayName = 'LazyChunkRecoveryNotice';

export default LazyChunkRecoveryNotice;
