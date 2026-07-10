import React from 'react';
import App from '../App';
import LoginPage from './LoginPage';
import { isAuthenticated } from './auth';
import type { PersistenceRuntime } from '../persistence/persistenceRuntime';

/**
 * Permanent UX-gate mod utilsigtet adgang. Bevidst svag — ikke en sikkerhedsgrænse.
 * Bindende regler: src/contracts/auth-gate-contract.md (uddybning: docs/architecture/auth-gate-architecture.md).
 */
const AuthGate = ({ persistenceRuntime }: { persistenceRuntime: PersistenceRuntime }): React.JSX.Element => {
  const [authenticated, setAuthenticated] = React.useState<boolean>(() => isAuthenticated());

  if (authenticated) {
    return <App persistenceRuntime={persistenceRuntime} />;
  }

  return <LoginPage onAuthenticated={() => setAuthenticated(true)} />;
};

export default AuthGate;
