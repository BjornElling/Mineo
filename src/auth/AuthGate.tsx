import React from 'react';
import App from '../App';
import LoginPage from './LoginPage';
import { isAuthenticated } from './auth';
import type { PersistenceRuntime } from '../persistence/persistenceRuntime';
import type { InputRuntimeBinding } from '../inputCore/react';

/**
 * Permanent UX-gate mod utilsigtet adgang. Bevidst svag — ikke en sikkerhedsgrænse.
 * Bindende regler: src/contracts/auth-gate-contract.md (uddybning: docs/architecture/auth-gate-architecture.md).
 */
const AuthGate = ({
  persistenceRuntime,
  inputRuntimeBinding,
}: {
  persistenceRuntime: PersistenceRuntime;
  inputRuntimeBinding: InputRuntimeBinding;
}): React.JSX.Element => {
  const [authenticated, setAuthenticated] = React.useState<boolean>(() => isAuthenticated());

  if (authenticated) {
    return <App persistenceRuntime={persistenceRuntime} inputRuntimeBinding={inputRuntimeBinding} />;
  }

  return <LoginPage onAuthenticated={() => setAuthenticated(true)} />;
};

export default AuthGate;
