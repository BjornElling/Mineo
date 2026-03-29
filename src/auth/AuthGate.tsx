import React from 'react';
import App from '../App';
import LoginPage from '../components/pages/LoginPage';
import { isAuthenticated } from './auth';

const AuthGate = (): React.JSX.Element => {
  const [authenticated, setAuthenticated] = React.useState<boolean>(() => isAuthenticated());

  React.useEffect(() => {
    const handleStorage = (): void => {
      setAuthenticated(isAuthenticated());
    };

    // 'storage'-events fyrer kun i andre browsertabs (per Web Storage spec) — ikke i
    // den tab der skriver. Det er acceptabelt her: der er ingen logout-funktion, og
    // sessionStorage er tab-isoleret. Eventet bruges udelukkende til at synkronisere
    // auth-tilstand ved login i en anden tab.
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  if (authenticated) {
    return <App />;
  }

  return <LoginPage onAuthenticated={() => setAuthenticated(true)} />;
};

export default AuthGate;
