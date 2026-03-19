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
