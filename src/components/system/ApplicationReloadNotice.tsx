import React from 'react';
import { Alert, Button } from '@mui/material';
import {
  activateAvailableServiceWorkerUpdate,
  getServiceWorkerUpdateStatus,
  subscribeServiceWorkerUpdateStatus,
} from '../../apps/mineo/serviceWorkerBootstrap';
import {
  isVitePreloadRecoveryPending,
  reloadAfterVitePreloadRecovery,
  subscribeVitePreloadRecovery,
} from '../../apps/shared/vitePreloadRecovery';
import { useCriticalInputActions } from '../../inputCore/react';

type ApplicationReloadNoticeProps = Readonly<{
  onReloadBlocked: () => void;
}>;

/**
 * Den ene synlige indgang til en PWA-opdatering. Opdateringen ligger klar, men den må først
 * aktivere den nye worker efter brugerens valg og inputkernens settle-barriere.
 */
const ApplicationReloadNotice = ({ onReloadBlocked }: ApplicationReloadNoticeProps): React.ReactElement | null => {
  const updateStatus = React.useSyncExternalStore(
    subscribeServiceWorkerUpdateStatus,
    getServiceWorkerUpdateStatus,
    getServiceWorkerUpdateStatus,
  );
  const lazyRecoveryPending = React.useSyncExternalStore(
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

    if (lazyRecoveryPending) {
      reloadAfterVitePreloadRecovery();
      return;
    }

    // Workerens tilstand kan have ændret sig, mens editoren blev afsluttet. I så fald bliver
    // brugeren på den aktuelle revision; næste update-check offentliggør igen ved behov.
    activateAvailableServiceWorkerUpdate();
  }, [criticalActions, lazyRecoveryPending, onReloadBlocked]);

  if (updateStatus === 'idle' && !lazyRecoveryPending) return null;

  return (
    <Alert
      severity="info"
      action={
        <Button
          color="inherit"
          disabled={updateStatus === 'activating' && !lazyRecoveryPending}
          onClick={() => {
            void handleReload();
          }}
          size="small"
        >
          {updateStatus === 'activating' && !lazyRecoveryPending ? 'Genindlæser…' : 'Genindlæs nu'}
        </Button>
      }
      sx={{ marginBottom: 2 }}
    >
      {lazyRecoveryPending
        ? 'En programdel skal genindlæses, før handlingen kan fortsætte.'
        : 'En ny version er klar.'}
    </Alert>
  );
};

ApplicationReloadNotice.displayName = 'ApplicationReloadNotice';

export default ApplicationReloadNotice;
