import React from 'react';
import App from '../App';
import LoginPage from '../components/pages/LoginPage';
import { isAuthenticated } from './auth';

/**
 * Permanent UX-gate mod utilsigtet adgang. Bevidst svag — ikke en sikkerhedsgrænse.
 * Se docs/architecture/auth-gate-architecture.md.
 */
const AuthGate = (): React.JSX.Element => {
  const [authenticated, setAuthenticated] = React.useState<boolean>(() => isAuthenticated());

  if (authenticated) {
    return <App />;
  }

  return <LoginPage onAuthenticated={() => setAuthenticated(true)} />;
};

export default AuthGate;
