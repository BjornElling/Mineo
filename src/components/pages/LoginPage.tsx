import React from 'react';
import { setAuthenticated, verifySharedPassword } from '../../auth/auth';

type LoginPageProps = {
  onAuthenticated: () => void;
};

const panelStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '420px',
  backgroundColor: '#ffffff',
  border: '1px solid #d7dce2',
  borderRadius: '12px',
  boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)',
  padding: '24px',
};

const LoginPage = ({ onAuthenticated }: LoginPageProps) => {
  const [passwordDraft, setPasswordDraft] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (!passwordDraft.trim()) {
        setErrorMessage('Indtast adgangskode.');
        return;
      }

      const isValid = await verifySharedPassword(passwordDraft);
      if (!isValid) {
        setErrorMessage('Forkert adgangskode.');
        return;
      }

      setAuthenticated();
      setPasswordDraft('');
      onAuthenticated();
    } catch {
      setErrorMessage('Login kunne ikke gennemføres i denne browser.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background:
          'linear-gradient(180deg, #f5f7fa 0%, #edf2f7 45%, #e3ebf4 100%)',
      }}
    >
      <section style={panelStyle} aria-label="Login">
        <h1
          style={{
            margin: 0,
            marginBottom: '8px',
            fontSize: '24px',
            lineHeight: 1.3,
            color: '#0f172a',
          }}
        >
          Login
        </h1>
        <p style={{ margin: 0, marginBottom: '18px', color: '#475569' }}>
          Indtast adgangskode for at åbne Mineo.
        </p>
        <form onSubmit={handleSubmit}>
          <label
            htmlFor="mineo-login-password"
            style={{
              display: 'block',
              marginBottom: '6px',
              color: '#1e293b',
              fontWeight: 600,
            }}
          >
            Adgangskode
          </label>
          <input
            id="mineo-login-password"
            type="password"
            value={passwordDraft}
            autoFocus
            onChange={(event) => setPasswordDraft(event.target.value)}
            title={errorMessage ?? ''}
            aria-invalid={errorMessage ? 'true' : 'false'}
            style={{
              width: '100%',
              border: errorMessage ? '1px solid #d32f2f' : '1px solid #94a3b8',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '16px',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '12px',
            }}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              border: 0,
              borderRadius: '8px',
              padding: '11px 12px',
              fontSize: '16px',
              color: '#ffffff',
              backgroundColor: '#1d4ed8',
              cursor: isSubmitting ? 'default' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Logger ind...' : 'Log ind'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default LoginPage;
